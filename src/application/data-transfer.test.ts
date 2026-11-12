import { describe, expect, it } from "vitest";
import {
  exportFormat,
  exportVersion,
  importData,
  parseExport,
  previewImport,
  serializeExport,
  type ExportEnvelope,
} from "./data-transfer";
import type { NativeRepositories } from "../storage/sqlite/repositories";

const envelope = (): ExportEnvelope => ({
  format: exportFormat,
  version: exportVersion,
  exportedAt: "2026-01-01T00:00:00.000Z",
  materials: [
    {
      id: "material-1",
      originalUrl: "https://example.com/article",
      normalizedUrl: "https://example.com/article",
      domain: "example.com",
      title: "Article",
      thumbnailUrl: null,
      type: "article",
      status: "queued",
      sourceDurationSeconds: 600,
      sourceDurationProvenance: "publisher-estimate",
      sourceDurationCompleteness: "full",
      playbackSpeed: 1,
      manualEstimatedSeconds: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  notes: [
    {
      id: "note-1",
      materialId: "material-1",
      content: "Keep the main idea.",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  settings: {
    id: "settings",
    weekdayMinutes: 30,
    weekendMinutes: 60,
    onboardingDismissed: true,
    availabilityReminderAt: null,
  },
  events: [
    {
      id: "event-1",
      materialId: "material-1",
      type: "captured",
      at: "2026-01-01T00:00:00.000Z",
    },
  ],
  sessions: [],
});

describe("native transfer boundary", () => {
  it("round-trips the current envelope without a storage dependency", () => {
    const parsed = parseExport(serializeExport(envelope()));
    expect(parsed).toEqual(envelope());
  });

  it("returns an additive import plan and preserves conflicts", () => {
    const result = previewImport(envelope(), {
      materialIds: new Set(["material-1"]),
      noteIds: new Set(),
      eventIds: new Set(),
      sessionIds: new Set(),
      hasSettings: false,
    });
    expect(result.conflicts).toBe(1);
    expect(result.importable).toBe(3);
    expect(result.additions.materials).toEqual([]);
    expect(result.additions.notes).toHaveLength(1);
    expect(result.additions.settings?.id).toBe("settings");
  });

  it("preserves stable IDs and independent multiple notes", () => {
    const data = envelope();
    data.notes.push({
      id: "note-2",
      materialId: "material-1",
      content: "Keep the supporting detail too.",
      createdAt: "2026-01-02T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });

    const parsed = parseExport(serializeExport(data));

    expect(parsed.materials[0]?.id).toBe("material-1");
    expect(parsed.notes.map((note) => note.id)).toEqual(["note-1", "note-2"]);
    expect(parsed.notes.map((note) => note.materialId)).toEqual([
      "material-1",
      "material-1",
    ]);
  });

  it("rejects malformed JSON and unsupported or future versions", () => {
    expect(() => parseExport("{not json")).toThrow(
      "Choose a valid stop-tumpuk export file.",
    );
    expect(() => parseExport(42 as unknown as string)).toThrow(
      "Choose a valid stop-tumpuk export file.",
    );
    expect(() =>
      parseExport(JSON.stringify({ ...envelope(), version: 2 })),
    ).toThrow("This export format is not supported.");
    expect(() =>
      parseExport(JSON.stringify({ ...envelope(), version: 999 })),
    ).toThrow("This export format is not supported.");
  });

  it("rejects invalid URLs, statuses, numbers, duplicate IDs, and references", () => {
    expect(() =>
      parseExport(
        JSON.stringify({
          ...envelope(),
          materials: [
            { ...envelope().materials[0], originalUrl: "javascript:alert(1)" },
          ],
        }),
      ),
    ).toThrow("Each material needs an HTTP(S) URL.");
    expect(() =>
      parseExport(
        JSON.stringify({
          ...envelope(),
          materials: [{ ...envelope().materials[0], status: "done" }],
        }),
      ),
    ).toThrow("A material record is invalid.");
    expect(() =>
      parseExport(
        JSON.stringify({
          ...envelope(),
          materials: [
            { ...envelope().materials[0], sourceDurationSeconds: -1 },
          ],
        }),
      ),
    ).toThrow("A source duration is invalid.");
    expect(() =>
      parseExport(
        JSON.stringify({
          ...envelope(),
          materials: [{ ...envelope().materials[0], playbackSpeed: 0 }],
        }),
      ),
    ).toThrow("A playback speed is invalid.");
    expect(() =>
      parseExport(
        JSON.stringify({
          ...envelope(),
          notes: [envelope().notes[0], { ...envelope().notes[0] }],
        }),
      ),
    ).toThrow("Note IDs must be unique.");
    expect(() =>
      parseExport(
        JSON.stringify({
          ...envelope(),
          notes: [{ ...envelope().notes[0], materialId: "missing" }],
        }),
      ),
    ).toThrow(
      "Every imported note, event, and session must reference an imported material.",
    );
  });

  it("applies only additive records through one repository transaction", async () => {
    const inserted = {
      materials: 0,
      notes: 0,
      events: 0,
      sessions: 0,
      settings: 0,
    };
    const repositories = {} as NativeRepositories;
    repositories.materials = {
      get: async () => null,
      list: async () => [],
      findByNormalizedUrl: async () => null,
      insert: async () => {
        inserted.materials += 1;
      },
      update: async () => undefined,
      delete: async () => undefined,
    };
    repositories.notes = {
      list: async () => [],
      listForMaterial: async () => [],
      get: async () => null,
      insert: async () => {
        inserted.notes += 1;
      },
      update: async () => undefined,
      delete: async () => undefined,
    };
    repositories.events = {
      list: async () => [],
      listForMaterial: async () => [],
      append: async () => {
        inserted.events += 1;
      },
    };
    repositories.sessions = {
      list: async () => [],
      getActiveForMaterial: async () => null,
      listForMaterial: async () => [],
      insert: async () => {
        inserted.sessions += 1;
      },
      update: async () => undefined,
    };
    repositories.settings = {
      get: async () => null,
      save: async () => {
        inserted.settings += 1;
      },
    };
    repositories.captureIntake = {
      get: async () => null,
      stage: async () => undefined,
      consume: async () => undefined,
    };
    repositories.transaction = async (work) => work(repositories);

    const result = await importData(envelope(), repositories);

    expect(result.importable).toBe(4);
    expect(inserted).toEqual({
      materials: 1,
      notes: 1,
      events: 1,
      sessions: 0,
      settings: 1,
    });
  });

  it("validates before opening a repository transaction and therefore performs no writes", async () => {
    const inserted = {
      materials: 0,
      notes: 0,
      events: 0,
      sessions: 0,
      settings: 0,
    };
    let transactions = 0;
    const repositories = {} as NativeRepositories;
    repositories.materials = {
      get: async () => null,
      list: async () => [],
      findByNormalizedUrl: async () => null,
      insert: async () => {
        inserted.materials += 1;
      },
      update: async () => undefined,
      delete: async () => undefined,
    };
    repositories.notes = {
      list: async () => [],
      listForMaterial: async () => [],
      get: async () => null,
      insert: async () => {
        inserted.notes += 1;
      },
      update: async () => undefined,
      delete: async () => undefined,
    };
    repositories.events = {
      list: async () => [],
      listForMaterial: async () => [],
      append: async () => {
        inserted.events += 1;
      },
    };
    repositories.sessions = {
      list: async () => [],
      getActiveForMaterial: async () => null,
      listForMaterial: async () => [],
      insert: async () => {
        inserted.sessions += 1;
      },
      update: async () => undefined,
    };
    repositories.settings = {
      get: async () => null,
      save: async () => {
        inserted.settings += 1;
      },
    };
    repositories.captureIntake = {
      get: async () => null,
      stage: async () => undefined,
      consume: async () => undefined,
    };
    repositories.transaction = async (work) => {
      transactions += 1;
      return work(repositories);
    };

    await expect(
      importData(
        JSON.stringify({
          ...envelope(),
          notes: [{ ...envelope().notes[0], materialId: "missing-material" }],
        }),
        repositories,
      ),
    ).rejects.toThrow(
      "Every imported note, event, and session must reference an imported material.",
    );

    expect(transactions).toBe(0);
    expect(inserted).toEqual({
      materials: 0,
      notes: 0,
      events: 0,
      sessions: 0,
      settings: 0,
    });
  });
});
