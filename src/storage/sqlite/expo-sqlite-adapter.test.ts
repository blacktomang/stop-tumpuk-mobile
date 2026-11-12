import { beforeEach, describe, expect, it, vi } from "vitest";

type FakeRow = Record<string, unknown>;
type FakeTables = Record<string, Map<string, FakeRow>>;

class FakeDatabase {
  readonly executedSql: string[] = [];
  readonly tables: FakeTables = {
    schema_migrations: new Map(),
    materials: new Map(),
    notes: new Map(),
    settings: new Map(),
    sessions: new Map(),
    material_events: new Map(),
    capture_intake: new Map(),
  };

  clone(): FakeDatabase {
    const clone = new FakeDatabase();
    clone.executedSql.push(...this.executedSql);
    for (const [table, rows] of Object.entries(this.tables)) {
      clone.tables[table] = new Map(
        [...rows].map(([id, row]) => [id, { ...row }]),
      );
    }
    return clone;
  }

  copyFrom(other: FakeDatabase): void {
    this.executedSql.length = 0;
    this.executedSql.push(...other.executedSql);
    for (const [table, rows] of Object.entries(other.tables)) {
      this.tables[table] = new Map(
        [...rows].map(([id, row]) => [id, { ...row }]),
      );
    }
  }

  async execAsync(sql: string): Promise<void> {
    this.executedSql.push(sql);
  }

  async runAsync(sql: string, ...parameters: unknown[]): Promise<void> {
    this.executedSql.push(sql);

    if (sql.startsWith("INSERT INTO schema_migrations")) {
      const version = Number(parameters[0]);
      this.tables.schema_migrations.set(String(version), {
        version,
        applied_at: parameters[1],
      });
      return;
    }

    if (sql.startsWith("INSERT INTO materials")) {
      this.insert(
        "materials",
        [
          "id",
          "original_url",
          "normalized_url",
          "domain",
          "title",
          "thumbnail_url",
          "type",
          "status",
          "source_duration_seconds",
          "source_duration_provenance",
          "source_duration_completeness",
          "playback_speed",
          "manual_estimated_seconds",
          "created_at",
          "updated_at",
        ],
        parameters,
      );
      return;
    }

    if (sql.startsWith("INSERT INTO notes")) {
      this.insert(
        "notes",
        ["id", "material_id", "content", "created_at", "updated_at"],
        parameters,
      );
      return;
    }

    if (sql.startsWith("INSERT INTO settings")) {
      this.tables.settings.set("settings", {
        id: parameters[0],
        weekday_minutes: parameters[1],
        weekend_minutes: parameters[2],
        onboarding_dismissed: parameters[3],
        availability_reminder_at: parameters[4],
      });
      return;
    }

    if (sql.startsWith("INSERT INTO sessions")) {
      this.insert(
        "sessions",
        [
          "id",
          "material_id",
          "started_at",
          "elapsed_seconds",
          "state",
          "state_changed_at",
          "ended_at",
        ],
        parameters,
      );
      return;
    }

    if (sql.startsWith("INSERT INTO material_events")) {
      this.insert(
        "material_events",
        ["id", "material_id", "type", "at"],
        parameters,
      );
      return;
    }

    if (sql.startsWith("INSERT INTO capture_intake")) {
      this.insert(
        "capture_intake",
        ["id", "url", "title", "received_at", "consumed_at"],
        parameters,
      );
      return;
    }

    const materialUpdate = sql.match(/^UPDATE materials SET (.+) WHERE id/);
    if (materialUpdate) {
      this.update("materials", materialUpdate[1], parameters);
      return;
    }

    const sessionUpdate = sql.match(/^UPDATE sessions SET (.+) WHERE id/);
    if (sessionUpdate) {
      this.update("sessions", sessionUpdate[1], parameters);
      return;
    }

    if (sql.startsWith("UPDATE notes SET")) {
      const row = this.tables.notes.get(String(parameters[2]));
      if (row) {
        row.content = parameters[0];
        row.updated_at = parameters[1];
      }
      return;
    }

    if (sql.startsWith("UPDATE capture_intake SET")) {
      const row = this.tables.capture_intake.get(String(parameters[1]));
      if (row && row.consumed_at === null) row.consumed_at = parameters[0];
      return;
    }

    const materialDelete = sql.match(/^DELETE FROM materials WHERE id/);
    if (materialDelete) {
      const materialId = String(parameters[0]);
      this.tables.materials.delete(materialId);
      for (const table of ["notes", "sessions", "material_events"]) {
        for (const [id, row] of this.tables[table]) {
          if (row.material_id === materialId) this.tables[table].delete(id);
        }
      }
      return;
    }

    if (sql.startsWith("DELETE FROM notes")) {
      this.tables.notes.delete(String(parameters[0]));
    }
  }

  async getFirstAsync<T>(
    sql: string,
    ...parameters: unknown[]
  ): Promise<T | null> {
    const rows = await this.getAllAsync<T>(sql, ...parameters);
    return rows[0] ?? null;
  }

  async getAllAsync<T>(sql: string, ...parameters: unknown[]): Promise<T[]> {
    this.executedSql.push(sql);
    if (sql === "SELECT version FROM schema_migrations;") {
      return [...this.tables.schema_migrations.values()] as T[];
    }

    const table = [
      "materials",
      "notes",
      "settings",
      "sessions",
      "material_events",
      "capture_intake",
    ].find((candidate) => sql.includes(`FROM ${candidate}`));
    if (!table) throw new Error(`Unsupported fake query: ${sql}`);

    let rows = [...this.tables[table].values()];
    const idMatch = sql.match(/WHERE id = \?/);
    if (idMatch) rows = rows.filter((row) => row.id === parameters[0]);

    const materialMatch = sql.match(/WHERE material_id = \?/);
    if (materialMatch)
      rows = rows.filter((row) => row.material_id === parameters[0]);

    const normalizedMatch = sql.match(/WHERE normalized_url = \?/);
    if (normalizedMatch)
      rows = rows.filter((row) => row.normalized_url === parameters[0]);

    if (sql.includes("state IN ('running', 'paused')")) {
      rows = rows.filter(
        (row) => row.state === "running" || row.state === "paused",
      );
    }

    const orderColumn = sql.match(/ORDER BY ([a-z_]+) ASC/);
    if (orderColumn) {
      const column = orderColumn[1];
      rows.sort((a, b) => String(a[column]).localeCompare(String(b[column])));
    }
    if (sql.includes("ORDER BY state_changed_at DESC")) {
      rows.sort((a, b) =>
        String(b.state_changed_at).localeCompare(String(a.state_changed_at)),
      );
    }
    if (sql.includes("LIMIT 1")) rows = rows.slice(0, 1);
    return rows as T[];
  }

  async withExclusiveTransactionAsync(
    task: (transaction: FakeDatabase) => Promise<void>,
  ): Promise<void> {
    const transaction = this.clone();
    await task(transaction);
    this.copyFrom(transaction);
  }

  private insert(
    table: string,
    columns: readonly string[],
    parameters: readonly unknown[],
  ): void {
    const row = Object.fromEntries(
      columns.map((column, index) => [column, parameters[index]]),
    );
    this.tables[table].set(String(row.id), row);
  }

  private update(
    table: string,
    assignmentSql: string,
    parameters: readonly unknown[],
  ): void {
    const id = String(parameters.at(-1));
    const row = this.tables[table].get(id);
    if (!row) return;
    for (const [index, assignment] of assignmentSql
      .split(", ")
      .map((value) => value.split(" = ")[0])
      .entries()) {
      row[assignment] = parameters[index];
    }
  }
}

const { databases, openedNames } = vi.hoisted(() => ({
  databases: new Map<string, FakeDatabase>(),
  openedNames: [] as string[],
}));

vi.mock("expo-sqlite", () => ({
  openDatabaseAsync: async (name: string) => {
    openedNames.push(name);
    let database = databases.get(name);
    if (!database) {
      database = new FakeDatabase();
      databases.set(name, database);
    }
    return database;
  },
}));

import { openNativeRepositories } from "./expo-sqlite-adapter";
import {
  exportData,
  importData,
  parseExport,
} from "../../application/data-transfer";
import type {
  CaptureIntake,
  LearningSession,
  Material,
  MaterialEvent,
  Note,
  Settings,
} from "../../types";

const material: Material = {
  id: "material-1",
  originalUrl: "https://example.com/read?utm_source=test",
  normalizedUrl: "https://example.com/read",
  domain: "example.com",
  title: "Boundary testing",
  thumbnailUrl: null,
  type: "article",
  status: "queued",
  sourceDurationSeconds: 600,
  sourceDurationProvenance: "publisher-estimate",
  sourceDurationCompleteness: "full",
  playbackSpeed: 1,
  manualEstimatedSeconds: 0,
  createdAt: "2026-11-12T00:00:00.000Z",
  updatedAt: "2026-11-12T00:00:00.000Z",
};

const note = (id: string, content: string): Note => ({
  id,
  materialId: material.id,
  content,
  createdAt: `2026-11-12T00:0${id.at(-1)}:00.000Z`,
  updatedAt: `2026-11-12T00:0${id.at(-1)}:00.000Z`,
});

const session: LearningSession = {
  id: "session-1",
  materialId: material.id,
  startedAt: "2026-11-12T01:00:00.000Z",
  elapsedSeconds: 90,
  state: "running",
  stateChangedAt: "2026-11-12T01:00:00.000Z",
  endedAt: null,
};

const event: MaterialEvent = {
  id: "event-1",
  materialId: material.id,
  type: "queued",
  at: "2026-11-12T01:00:00.000Z",
};

const intake: CaptureIntake = {
  id: "intake-1",
  url: "https://example.com/shared",
  title: null,
  receivedAt: "2026-11-12T02:00:00.000Z",
  consumedAt: null,
};

const settings: Settings = {
  id: "settings",
  weekdayMinutes: 30,
  weekendMinutes: 0,
  onboardingDismissed: true,
  availabilityReminderAt: null,
};

describe("mocked SQLite adapter boundary (automated; not native runtime proof)", () => {
  beforeEach(() => {
    databases.clear();
    openedNames.length = 0;
  });

  it("maps material, note, settings, session, event, and intake repositories", async () => {
    const repositories = await openNativeRepositories("crud.sqlite");

    await repositories.materials.insert(material);
    expect(await repositories.materials.get(material.id)).toEqual(material);
    expect(await repositories.materials.list()).toEqual([material]);
    expect(
      await repositories.materials.findByNormalizedUrl(material.normalizedUrl),
    ).toEqual(material);

    await repositories.materials.update(material.id, {
      title: "Updated boundary",
      manualEstimatedSeconds: 0,
      updatedAt: "2026-11-12T03:00:00.000Z",
    });
    expect(await repositories.materials.get(material.id)).toMatchObject({
      title: "Updated boundary",
      manualEstimatedSeconds: 0,
      updatedAt: "2026-11-12T03:00:00.000Z",
    });

    await repositories.notes.insert(note("note-1", "first"));
    await repositories.notes.insert(note("note-2", "second"));
    expect(await repositories.notes.get("note-1")).toEqual(
      note("note-1", "first"),
    );
    expect(await repositories.notes.listForMaterial(material.id)).toHaveLength(
      2,
    );
    await repositories.notes.update("note-1", {
      content: "edited",
      updatedAt: "2026-11-12T03:00:00.000Z",
    });
    expect(await repositories.notes.get("note-1")).toMatchObject({
      content: "edited",
      updatedAt: "2026-11-12T03:00:00.000Z",
    });
    await repositories.notes.delete("note-1");
    expect(await repositories.notes.get("note-1")).toBeNull();
    expect(await repositories.notes.list()).toEqual([note("note-2", "second")]);

    await repositories.settings.save(settings);
    expect(await repositories.settings.get()).toEqual(settings);
    await repositories.settings.save({
      ...settings,
      weekdayMinutes: null,
      onboardingDismissed: false,
    });
    expect(await repositories.settings.get()).toEqual({
      ...settings,
      weekdayMinutes: null,
      onboardingDismissed: false,
    });

    await repositories.sessions.insert(session);
    expect(await repositories.sessions.listForMaterial(material.id)).toEqual([
      session,
    ]);
    expect(
      await repositories.sessions.getActiveForMaterial(material.id),
    ).toEqual(session);
    await repositories.sessions.update(session.id, {
      elapsedSeconds: 125,
      state: "paused",
      stateChangedAt: "2026-11-12T01:02:00.000Z",
    });
    expect(
      await repositories.sessions.getActiveForMaterial(material.id),
    ).toMatchObject({
      elapsedSeconds: 125,
      state: "paused",
    });

    await repositories.events.append(event);
    expect(await repositories.events.list()).toEqual([event]);
    expect(await repositories.events.listForMaterial(material.id)).toEqual([
      event,
    ]);

    await repositories.captureIntake.stage(intake);
    expect(await repositories.captureIntake.get(intake.id)).toEqual(intake);
    await repositories.captureIntake.consume(
      intake.id,
      "2026-11-12T03:00:00.000Z",
    );
    expect(await repositories.captureIntake.get(intake.id)).toEqual({
      ...intake,
      consumedAt: "2026-11-12T03:00:00.000Z",
    });
  });

  it("preserves foreign-key delete-cascade intent for notes, sessions, and events", async () => {
    const repositories = await openNativeRepositories("cascade.sqlite");
    await repositories.materials.insert(material);
    await repositories.notes.insert(note("note-1", "child"));
    await repositories.sessions.insert(session);
    await repositories.events.append(event);

    await repositories.materials.delete(material.id);

    expect(await repositories.materials.get(material.id)).toBeNull();
    expect(await repositories.notes.list()).toEqual([]);
    expect(await repositories.sessions.list()).toEqual([]);
    expect(await repositories.events.list()).toEqual([]);
  });

  it("propagates exclusive transaction failures and rolls back all writes", async () => {
    const repositories = await openNativeRepositories("rollback.sqlite");
    const failure = new Error("transaction failure");

    await expect(
      repositories.transaction(async (transaction) => {
        await transaction.materials.insert(material);
        await transaction.notes.insert(note("note-1", "rolled back"));
        throw failure;
      }),
    ).rejects.toBe(failure);

    expect(await repositories.materials.list()).toEqual([]);
    expect(await repositories.notes.list()).toEqual([]);
  });

  it("retains rows and applies migrations once across repeated initialization", async () => {
    const first = await openNativeRepositories("repeat.sqlite");
    await first.materials.insert(material);
    const database = databases.get("repeat.sqlite");
    expect(database).toBeDefined();
    const migrationInserts = database?.executedSql.filter((sql) =>
      sql.startsWith("INSERT INTO schema_migrations"),
    );

    const second = await openNativeRepositories("repeat.sqlite");

    expect(openedNames).toEqual(["repeat.sqlite", "repeat.sqlite"]);
    expect(await second.materials.get(material.id)).toEqual(material);
    expect(
      database?.executedSql.filter((sql) =>
        sql.startsWith("INSERT INTO schema_migrations"),
      ),
    ).toEqual(migrationInserts);
  });

  it("round-trips durable records through current-format transfer while excluding intake", async () => {
    const source = await openNativeRepositories("round-trip-source.sqlite");
    const target = await openNativeRepositories("round-trip-target.sqlite");
    const secondSession: LearningSession = {
      ...session,
      id: "session-2",
      startedAt: "2026-11-12T04:00:00.000Z",
      state: "ended",
      stateChangedAt: "2026-11-12T04:10:00.000Z",
      endedAt: "2026-11-12T04:10:00.000Z",
    };
    const secondEvent: MaterialEvent = {
      ...event,
      id: "event-2",
      type: "completed",
      at: "2026-11-12T04:10:00.000Z",
    };

    await source.materials.insert(material);
    await source.notes.insert(note("note-1", "first durable note"));
    await source.notes.insert(note("note-2", "second durable note"));
    await source.settings.save(settings);
    await source.events.append(event);
    await source.events.append(secondEvent);
    await source.sessions.insert(session);
    await source.sessions.insert(secondSession);
    await source.captureIntake.stage(intake);

    const backup = await exportData(source, "2026-11-12T05:00:00.000Z");
    const parsed = parseExport(backup);
    expect(parsed).toMatchObject({
      materials: [material],
      notes: [
        note("note-1", "first durable note"),
        note("note-2", "second durable note"),
      ],
      settings,
      events: [event, secondEvent],
      sessions: [session, secondSession],
    });
    expect(parsed).not.toHaveProperty("captureIntake");

    const result = await importData(backup, target);

    expect(result.conflicts).toBe(0);
    expect(result.importable).toBe(8);
    await expect(target.materials.list()).resolves.toEqual([material]);
    await expect(target.notes.list()).resolves.toEqual([
      note("note-1", "first durable note"),
      note("note-2", "second durable note"),
    ]);
    await expect(target.settings.get()).resolves.toEqual(settings);
    await expect(target.events.list()).resolves.toEqual([event, secondEvent]);
    await expect(target.sessions.list()).resolves.toEqual([
      session,
      secondSession,
    ]);
    await expect(target.captureIntake.get(intake.id)).resolves.toBeNull();
  });
});
