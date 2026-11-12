import { beforeEach, describe, expect, it, vi } from "vitest";

interface FakeState {
  versions: Set<number>;
  appliedStatements: string[];
  preservedValue: string;
  failOnStatement: string | null;
}

class PersistentFakeDatabase {
  readonly state: FakeState = {
    versions: new Set(),
    appliedStatements: [],
    preservedValue: "existing local material",
    failOnStatement: null,
  };

  async execAsync(sql: string): Promise<void> {
    if (this.state.failOnStatement === sql) {
      throw new Error("forced migration failure");
    }
    this.state.appliedStatements.push(sql);
  }

  async runAsync(sql: string, ...parameters: unknown[]): Promise<void> {
    if (sql.startsWith("INSERT INTO schema_migrations")) {
      this.state.versions.add(Number(parameters[0]));
    }
  }

  async getAllAsync<T>(sql: string): Promise<T[]> {
    if (sql === "SELECT version FROM schema_migrations;") {
      return [...this.state.versions].map((version) => ({ version }) as T);
    }
    return [];
  }

  async getFirstAsync<T>(): Promise<T | null> {
    return null;
  }

  async withExclusiveTransactionAsync(
    task: (transaction: this) => Promise<void>,
  ): Promise<void> {
    const versions = new Set(this.state.versions);
    const statements = [...this.state.appliedStatements];
    const preservedValue = this.state.preservedValue;
    try {
      await task(this);
    } catch (error) {
      this.state.versions = versions;
      this.state.appliedStatements = statements;
      this.state.preservedValue = preservedValue;
      throw error;
    }
  }
}

const fakeDatabase = new PersistentFakeDatabase();

vi.mock("expo-sqlite", () => ({
  openDatabaseAsync: async () => fakeDatabase,
}));

import {
  initializeNativeDatabase,
  openNativeRepositories,
} from "./expo-sqlite-adapter";
import { currentSchemaVersion } from "./schema";

describe("native SQLite migration recovery", () => {
  beforeEach(() => {
    fakeDatabase.state.versions = new Set();
    fakeDatabase.state.appliedStatements = [];
    fakeDatabase.state.preservedValue = "existing local material";
    fakeDatabase.state.failOnStatement = null;
  });

  it("persists the schema and local data across repeat opens", async () => {
    await openNativeRepositories("repeat-open.sqlite");
    fakeDatabase.state.preservedValue = "saved material";
    const firstOpenStatements = fakeDatabase.state.appliedStatements.length;

    await openNativeRepositories("repeat-open.sqlite");

    expect(fakeDatabase.state.versions).toEqual(
      new Set([currentSchemaVersion]),
    );
    expect(fakeDatabase.state.preservedValue).toBe("saved material");
    expect(fakeDatabase.state.appliedStatements).toHaveLength(
      firstOpenStatements + 2,
    );
    expect(fakeDatabase.state.appliedStatements.at(-1)).toBe(
      "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL);",
    );
  });

  it("rejects a database newer than the app without resetting it", async () => {
    fakeDatabase.state.versions.add(currentSchemaVersion + 1);
    const before = [...fakeDatabase.state.appliedStatements];

    await expect(initializeNativeDatabase(fakeDatabase)).rejects.toThrow(
      "newer than this app",
    );

    expect(fakeDatabase.state.versions).toEqual(
      new Set([currentSchemaVersion + 1]),
    );
    expect(fakeDatabase.state.appliedStatements).toEqual(before);
    expect(fakeDatabase.state.preservedValue).toBe("existing local material");
  });

  it("rolls back a failed upgrade and keeps the existing store intact", async () => {
    fakeDatabase.state.preservedValue = "saved material";
    fakeDatabase.state.failOnStatement =
      "CREATE TABLE IF NOT EXISTS materials (\n        id TEXT PRIMARY KEY NOT NULL,\n        original_url TEXT NOT NULL,\n        normalized_url TEXT NOT NULL,\n        domain TEXT NOT NULL,\n        title TEXT NOT NULL,\n        thumbnail_url TEXT,\n        type TEXT NOT NULL CHECK (type IN ('article', 'video', 'unknown')),\n        status TEXT NOT NULL CHECK (status IN ('inbox', 'queued', 'in-progress', 'completed', 'archived')),\n        source_duration_seconds REAL,\n        source_duration_provenance TEXT NOT NULL,\n        source_duration_completeness TEXT NOT NULL,\n        playback_speed REAL NOT NULL,\n        manual_estimated_seconds REAL,\n        created_at TEXT NOT NULL,\n        updated_at TEXT NOT NULL\n      );";

    await expect(initializeNativeDatabase(fakeDatabase)).rejects.toThrow(
      "forced migration failure",
    );

    expect(fakeDatabase.state.versions).toEqual(new Set());
    expect(fakeDatabase.state.appliedStatements).toEqual([]);
    expect(fakeDatabase.state.preservedValue).toBe("saved material");
    expect(fakeDatabase.state.appliedStatements.join("\n")).not.toMatch(
      /DROP TABLE|DELETE FROM|reset|empty/i,
    );
  });
});
