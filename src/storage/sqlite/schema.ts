/**
 * Native SQLite schema metadata. This module is deliberately independent of
 * expo-sqlite so migrations can be inspected and tested without a native
 * runtime.
 */
export const databaseName = "stop-tumpuk-reading-plan.sqlite";
export const currentSchemaVersion = 1;

export interface SqlMigration {
  version: number;
  statements: readonly string[];
}

export const migrations: readonly SqlMigration[] = [
  {
    version: 1,
    statements: [
      "PRAGMA foreign_keys = ON;",
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY NOT NULL,
        applied_at TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS materials (
        id TEXT PRIMARY KEY NOT NULL,
        original_url TEXT NOT NULL,
        normalized_url TEXT NOT NULL,
        domain TEXT NOT NULL,
        title TEXT NOT NULL,
        thumbnail_url TEXT,
        type TEXT NOT NULL CHECK (type IN ('article', 'video', 'unknown')),
        status TEXT NOT NULL CHECK (status IN ('inbox', 'queued', 'in-progress', 'completed', 'archived')),
        source_duration_seconds REAL,
        source_duration_provenance TEXT NOT NULL,
        source_duration_completeness TEXT NOT NULL,
        playback_speed REAL NOT NULL,
        manual_estimated_seconds REAL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
      "CREATE INDEX IF NOT EXISTS materials_normalized_url_idx ON materials (normalized_url);",
      "CREATE INDEX IF NOT EXISTS materials_status_updated_idx ON materials (status, updated_at);",
      `CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY NOT NULL,
        material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
      "CREATE INDEX IF NOT EXISTS notes_material_updated_idx ON notes (material_id, updated_at);",
      `CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY NOT NULL CHECK (id = 'settings'),
        weekday_minutes REAL,
        weekend_minutes REAL,
        onboarding_dismissed INTEGER NOT NULL CHECK (onboarding_dismissed IN (0, 1)),
        availability_reminder_at TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY NOT NULL,
        material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
        started_at TEXT NOT NULL,
        elapsed_seconds REAL NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('running', 'paused', 'ended')),
        state_changed_at TEXT NOT NULL,
        ended_at TEXT
      );`,
      "CREATE INDEX IF NOT EXISTS sessions_material_state_idx ON sessions (material_id, state);",
      `CREATE TABLE IF NOT EXISTS material_events (
        id TEXT PRIMARY KEY NOT NULL,
        material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK (type IN ('captured', 'queued', 'in-progress', 'completed', 'reopened', 'returned-to-inbox', 'archived', 'deleted')),
        at TEXT NOT NULL
      );`,
      "CREATE INDEX IF NOT EXISTS material_events_material_at_idx ON material_events (material_id, at);",
      `CREATE TABLE IF NOT EXISTS capture_intake (
        id TEXT PRIMARY KEY NOT NULL,
        url TEXT NOT NULL,
        title TEXT,
        received_at TEXT NOT NULL,
        consumed_at TEXT
      );`,
      "CREATE INDEX IF NOT EXISTS capture_intake_received_idx ON capture_intake (received_at);",
    ],
  },
];

export interface SqlMigrationExecutor {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...parameters: unknown[]): Promise<unknown>;
}

/** Applies migrations in order; callers provide the transaction boundary. */
export async function applyMigrations(
  database: SqlMigrationExecutor,
  appliedVersions: ReadonlySet<number>,
  now = new Date().toISOString(),
): Promise<void> {
  for (const migration of migrations) {
    if (appliedVersions.has(migration.version)) continue;
    for (const statement of migration.statements)
      await database.execAsync(statement);
    await database.runAsync(
      "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?);",
      migration.version,
      now,
    );
  }
}
