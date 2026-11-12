import {
  openDatabaseAsync,
  type SQLiteBindValue,
  type SQLiteDatabase,
} from "expo-sqlite";

import type {
  CaptureIntake,
  LearningSession,
  Material,
  MaterialEvent,
  Note,
  Settings,
} from "../../types";
import {
  applyMigrations,
  currentSchemaVersion,
  databaseName,
  type SqlMigrationExecutor,
} from "./schema";
import type { NativeRepositories } from "./repositories";

type SqlRow = Record<string, unknown>;

/** The subset shared by SQLiteDatabase and an exclusive transaction handle. */
interface SqliteConnection {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...parameters: SQLiteBindValue[]): Promise<unknown>;
  getFirstAsync<T>(
    sql: string,
    ...parameters: SQLiteBindValue[]
  ): Promise<T | null>;
  getAllAsync<T>(sql: string, ...parameters: SQLiteBindValue[]): Promise<T[]>;
}

interface RootSqliteConnection extends SqliteConnection {
  withExclusiveTransactionAsync(
    task: (transaction: SqliteConnection) => Promise<void>,
  ): Promise<void>;
}

const asString = (value: unknown): string => String(value);
const asNullableString = (value: unknown): string | null =>
  value === null || value === undefined ? null : String(value);
const asNumber = (value: unknown): number => Number(value);
const asNullableNumber = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value);

function toBindValue(value: unknown): SQLiteBindValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value instanceof Uint8Array
  ) {
    return value as SQLiteBindValue;
  }
  throw new TypeError("Unsupported SQLite bind value.");
}

const toBindValues = (values: readonly unknown[]): SQLiteBindValue[] =>
  values.map(toBindValue);

function materialFromRow(row: SqlRow): Material {
  return {
    id: asString(row.id),
    originalUrl: asString(row.original_url),
    normalizedUrl: asString(row.normalized_url),
    domain: asString(row.domain),
    title: asString(row.title),
    thumbnailUrl: asNullableString(row.thumbnail_url),
    type: row.type as Material["type"],
    status: row.status as Material["status"],
    sourceDurationSeconds: asNullableNumber(row.source_duration_seconds),
    sourceDurationProvenance:
      row.source_duration_provenance as Material["sourceDurationProvenance"],
    sourceDurationCompleteness:
      row.source_duration_completeness as Material["sourceDurationCompleteness"],
    playbackSpeed: asNumber(row.playback_speed),
    manualEstimatedSeconds: asNullableNumber(row.manual_estimated_seconds),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  };
}

function noteFromRow(row: SqlRow): Note {
  return {
    id: asString(row.id),
    materialId: asString(row.material_id),
    content: asString(row.content),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  };
}

function settingsFromRow(row: SqlRow): Settings {
  return {
    id: "settings",
    weekdayMinutes: asNullableNumber(row.weekday_minutes),
    weekendMinutes: asNullableNumber(row.weekend_minutes),
    onboardingDismissed: Boolean(row.onboarding_dismissed),
    availabilityReminderAt: asNullableString(row.availability_reminder_at),
  };
}

function sessionFromRow(row: SqlRow): LearningSession {
  return {
    id: asString(row.id),
    materialId: asString(row.material_id),
    startedAt: asString(row.started_at),
    elapsedSeconds: asNumber(row.elapsed_seconds),
    state: row.state as LearningSession["state"],
    stateChangedAt: asString(row.state_changed_at),
    endedAt: asNullableString(row.ended_at),
  };
}

function eventFromRow(row: SqlRow): MaterialEvent {
  return {
    id: asString(row.id),
    materialId: asString(row.material_id),
    type: row.type as MaterialEvent["type"],
    at: asString(row.at),
  };
}

function intakeFromRow(row: SqlRow): CaptureIntake {
  return {
    id: asString(row.id),
    url: asString(row.url),
    title: asNullableString(row.title),
    receivedAt: asString(row.received_at),
    consumedAt: asNullableString(row.consumed_at),
  };
}

const run = (
  db: SqliteConnection,
  sql: string,
  params: SQLiteBindValue[] = [],
) => db.runAsync(sql, ...params);
const first = <T extends SqlRow>(
  db: SqliteConnection,
  sql: string,
  params: SQLiteBindValue[] = [],
) => db.getFirstAsync<T>(sql, ...params);
const all = <T extends SqlRow>(
  db: SqliteConnection,
  sql: string,
  params: SQLiteBindValue[] = [],
) => db.getAllAsync<T>(sql, ...params);

const materialColumns: Record<string, string> = {
  originalUrl: "original_url",
  normalizedUrl: "normalized_url",
  domain: "domain",
  title: "title",
  thumbnailUrl: "thumbnail_url",
  type: "type",
  status: "status",
  sourceDurationSeconds: "source_duration_seconds",
  sourceDurationProvenance: "source_duration_provenance",
  sourceDurationCompleteness: "source_duration_completeness",
  playbackSpeed: "playback_speed",
  manualEstimatedSeconds: "manual_estimated_seconds",
  createdAt: "created_at",
  updatedAt: "updated_at",
};
const sessionColumns: Record<string, string> = {
  materialId: "material_id",
  startedAt: "started_at",
  elapsedSeconds: "elapsed_seconds",
  state: "state",
  stateChangedAt: "state_changed_at",
  endedAt: "ended_at",
};

function createRepositories(
  db: SqliteConnection,
  root = false,
): NativeRepositories {
  const repositories = {} as NativeRepositories;
  repositories.materials = {
    get: async (id) => {
      const row = await first(db, "SELECT * FROM materials WHERE id = ?;", [
        id,
      ]);
      return row ? materialFromRow(row) : null;
    },
    list: async () =>
      (await all(db, "SELECT * FROM materials ORDER BY created_at ASC;")).map(
        materialFromRow,
      ),
    findByNormalizedUrl: async (url) => {
      const row = await first(
        db,
        "SELECT * FROM materials WHERE normalized_url = ? ORDER BY created_at ASC LIMIT 1;",
        [url],
      );
      return row ? materialFromRow(row) : null;
    },
    insert: async (m) => {
      await run(
        db,
        "INSERT INTO materials (id, original_url, normalized_url, domain, title, thumbnail_url, type, status, source_duration_seconds, source_duration_provenance, source_duration_completeness, playback_speed, manual_estimated_seconds, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);",
        [
          m.id,
          m.originalUrl,
          m.normalizedUrl,
          m.domain,
          m.title,
          m.thumbnailUrl,
          m.type,
          m.status,
          m.sourceDurationSeconds,
          m.sourceDurationProvenance,
          m.sourceDurationCompleteness,
          m.playbackSpeed,
          m.manualEstimatedSeconds,
          m.createdAt,
          m.updatedAt,
        ],
      );
    },
    update: async (id, patch) => {
      const entries = Object.entries(patch).filter(
        ([key]) => key !== "id" && key in materialColumns,
      );
      if (!entries.length) return;
      const assignments = entries
        .map(([key]) => `${materialColumns[key]} = ?`)
        .join(", ");
      await run(
        db,
        `UPDATE materials SET ${assignments} WHERE id = ?;`,
        toBindValues([...entries.map(([, value]) => value), id]),
      );
    },
    delete: async (id) => {
      await run(db, "DELETE FROM materials WHERE id = ?;", [id]);
    },
  };
  repositories.notes = {
    list: async () =>
      (await all(db, "SELECT * FROM notes ORDER BY created_at ASC;")).map(
        noteFromRow,
      ),
    listForMaterial: async (id) =>
      (
        await all(
          db,
          "SELECT * FROM notes WHERE material_id = ? ORDER BY created_at ASC;",
          [id],
        )
      ).map(noteFromRow),
    get: async (id) => {
      const row = await first(db, "SELECT * FROM notes WHERE id = ?;", [id]);
      return row ? noteFromRow(row) : null;
    },
    insert: async (n) => {
      await run(
        db,
        "INSERT INTO notes (id, material_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?);",
        [n.id, n.materialId, n.content, n.createdAt, n.updatedAt],
      );
    },
    update: async (id, patch) => {
      await run(
        db,
        "UPDATE notes SET content = ?, updated_at = ? WHERE id = ?;",
        [patch.content, patch.updatedAt, id],
      );
    },
    delete: async (id) => {
      await run(db, "DELETE FROM notes WHERE id = ?;", [id]);
    },
  };
  repositories.settings = {
    get: async () => {
      const row = await first(
        db,
        "SELECT * FROM settings WHERE id = 'settings';",
      );
      return row ? settingsFromRow(row) : null;
    },
    save: async (s) => {
      await run(
        db,
        "INSERT INTO settings (id, weekday_minutes, weekend_minutes, onboarding_dismissed, availability_reminder_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET weekday_minutes = excluded.weekday_minutes, weekend_minutes = excluded.weekend_minutes, onboarding_dismissed = excluded.onboarding_dismissed, availability_reminder_at = excluded.availability_reminder_at;",
        [
          s.id,
          s.weekdayMinutes,
          s.weekendMinutes,
          s.onboardingDismissed ? 1 : 0,
          s.availabilityReminderAt,
        ],
      );
    },
  };
  repositories.sessions = {
    list: async () =>
      (await all(db, "SELECT * FROM sessions ORDER BY started_at ASC;")).map(
        sessionFromRow,
      ),
    getActiveForMaterial: async (id) => {
      const row = await first(
        db,
        "SELECT * FROM sessions WHERE material_id = ? AND state IN ('running', 'paused') ORDER BY state_changed_at DESC LIMIT 1;",
        [id],
      );
      return row ? sessionFromRow(row) : null;
    },
    listForMaterial: async (id) =>
      (
        await all(
          db,
          "SELECT * FROM sessions WHERE material_id = ? ORDER BY started_at ASC;",
          [id],
        )
      ).map(sessionFromRow),
    insert: async (s) => {
      await run(
        db,
        "INSERT INTO sessions (id, material_id, started_at, elapsed_seconds, state, state_changed_at, ended_at) VALUES (?, ?, ?, ?, ?, ?, ?);",
        [
          s.id,
          s.materialId,
          s.startedAt,
          s.elapsedSeconds,
          s.state,
          s.stateChangedAt,
          s.endedAt,
        ],
      );
    },
    update: async (id, patch) => {
      const entries = Object.entries(patch).filter(
        ([key]) => key !== "id" && key in sessionColumns,
      );
      if (!entries.length) return;
      const assignments = entries
        .map(([key]) => `${sessionColumns[key]} = ?`)
        .join(", ");
      await run(
        db,
        `UPDATE sessions SET ${assignments} WHERE id = ?;`,
        toBindValues([...entries.map(([, value]) => value), id]),
      );
    },
  };
  repositories.events = {
    list: async () =>
      (await all(db, "SELECT * FROM material_events ORDER BY at ASC;")).map(
        eventFromRow,
      ),
    listForMaterial: async (id) =>
      (
        await all(
          db,
          "SELECT * FROM material_events WHERE material_id = ? ORDER BY at ASC;",
          [id],
        )
      ).map(eventFromRow),
    append: async (e) => {
      await run(
        db,
        "INSERT INTO material_events (id, material_id, type, at) VALUES (?, ?, ?, ?);",
        [e.id, e.materialId, e.type, e.at],
      );
    },
  };
  repositories.captureIntake = {
    get: async (id) => {
      const row = await first(
        db,
        "SELECT * FROM capture_intake WHERE id = ?;",
        [id],
      );
      return row ? intakeFromRow(row) : null;
    },
    stage: async (i) => {
      await run(
        db,
        "INSERT INTO capture_intake (id, url, title, received_at, consumed_at) VALUES (?, ?, ?, ?, ?);",
        [i.id, i.url, i.title, i.receivedAt, i.consumedAt],
      );
    },
    consume: async (id, consumedAt) => {
      await run(
        db,
        "UPDATE capture_intake SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL;",
        [consumedAt, id],
      );
    },
  };
  repositories.transaction = async <T>(
    work: (repos: NativeRepositories) => Promise<T>,
  ) => {
    let result!: T;
    if (!root) {
      throw new Error("Nested SQLite transactions are not supported.");
    }
    await (db as RootSqliteConnection).withExclusiveTransactionAsync(
      async (transaction) => {
        result = await work(createRepositories(transaction, false));
      },
    );
    return result;
  };
  return repositories;
}

/** Opens the native database, applies pending migrations atomically, and returns repository boundaries. */
export async function openNativeRepositories(
  name = databaseName,
): Promise<NativeRepositories> {
  const db = await openDatabaseAsync(name);
  await db.execAsync("PRAGMA foreign_keys = ON;");
  await db.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.execAsync(
      "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL);",
    );
    const rows = await all<SqlRow>(
      transaction,
      "SELECT version FROM schema_migrations;",
    );
    if (rows.some((row) => Number(row.version) > currentSchemaVersion)) {
      throw new Error("Native database schema is newer than this app");
    }
    const executor: SqlMigrationExecutor = {
      execAsync: (sql) => transaction.execAsync(sql),
      runAsync: (sql, ...parameters) =>
        run(transaction, sql, toBindValues(parameters)),
    };
    await applyMigrations(
      executor,
      new Set(rows.map((row) => Number(row.version))),
    );
  });
  return createRepositories(db, true);
}
