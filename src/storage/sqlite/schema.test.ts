import { describe, expect, it } from "vitest";
import {
  applyMigrationPlan,
  applyMigrations,
  currentSchemaVersion,
  databaseName,
  migrations,
  type SqlMigrationExecutor,
} from "./schema";

describe("native SQLite schema metadata", () => {
  it("declares a single ordered initial migration", () => {
    expect(databaseName).toBe("stop-tumpuk-reading-plan.sqlite");
    expect(migrations.map((migration) => migration.version)).toEqual([1]);
    expect(migrations.at(-1)?.version).toBe(currentSchemaVersion);
  });

  it("creates all local-first tables and protective indexes", () => {
    const sql = migrations[0]?.statements.join("\n") ?? "";
    for (const table of [
      "schema_migrations",
      "materials",
      "notes",
      "settings",
      "sessions",
      "material_events",
      "capture_intake",
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
    expect(sql).toContain("ON DELETE CASCADE");
    expect(sql).toContain("materials_normalized_url_idx");
    expect(sql).not.toContain(
      "CREATE UNIQUE INDEX IF NOT EXISTS materials_normalized_url_idx",
    );
    expect(sql).toContain("materials_status_updated_idx");
    expect(sql).toContain("PRAGMA foreign_keys = ON;");
  });

  it("applies only missing migrations and records their application", async () => {
    const executed: string[] = [];
    const applied: Array<[number, string]> = [];
    const database: SqlMigrationExecutor = {
      execAsync: async (sql) => {
        executed.push(sql);
      },
      runAsync: async (sql, ...parameters) => {
        expect(sql).toBe(
          "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?);",
        );
        applied.push([Number(parameters[0]), String(parameters[1])]);
      },
    };

    await applyMigrations(database, new Set(), "2026-11-12T00:00:00.000Z");
    expect(executed.length).toBeGreaterThan(1);
    expect(applied).toEqual([[1, "2026-11-12T00:00:00.000Z"]]);

    executed.length = 0;
    applied.length = 0;
    await applyMigrations(database, new Set([1]), "2026-11-12T00:00:00.000Z");
    expect(executed).toEqual([]);
    expect(applied).toEqual([]);
  });

  it("fills a skipped version without replaying recorded versions", async () => {
    const applied: number[] = [];
    const database: SqlMigrationExecutor = {
      execAsync: async () => undefined,
      runAsync: async (_sql, ...parameters) => {
        applied.push(Number(parameters[0]));
      },
    };
    const plan = [
      { version: 1, statements: ["migration one"] },
      { version: 2, statements: ["migration two"] },
      { version: 3, statements: ["migration three"] },
    ] as const;

    await applyMigrationPlan(database, plan, new Set([1, 3]));

    expect(applied).toEqual([2]);
  });

  it("rejects malformed migration plans and recorded versions", async () => {
    const database: SqlMigrationExecutor = {
      execAsync: async () => undefined,
      runAsync: async () => undefined,
    };
    await expect(
      applyMigrationPlan(
        database,
        [
          { version: 2, statements: [] },
          { version: 1, statements: [] },
        ],
        new Set(),
      ),
    ).rejects.toThrow("strictly increasing");
    await expect(
      applyMigrationPlan(database, migrations, new Set([0])),
    ).rejects.toThrow("positive integers");
  });
});
