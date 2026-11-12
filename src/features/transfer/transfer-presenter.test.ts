import { describe, expect, it } from "vitest";
import { exportFormat, exportVersion } from "../../application/data-transfer";
import { previewDescription, previewTransfer } from "./transfer-presenter";

const existing = {
  materialIds: new Set<string>(),
  noteIds: new Set<string>(),
  eventIds: new Set<string>(),
  sessionIds: new Set<string>(),
  hasSettings: false,
};

const validExport = JSON.stringify({
  format: exportFormat,
  version: exportVersion,
  exportedAt: "2026-01-01T00:00:00.000Z",
  materials: [],
  notes: [],
  settings: null,
  events: [],
  sessions: [],
});

const exportWithRecords = JSON.stringify({
  format: exportFormat,
  version: exportVersion,
  exportedAt: "2026-01-01T00:00:00.000Z",
  materials: [
    {
      id: "material-1",
      originalUrl: "https://example.com/lesson",
      normalizedUrl: "https://example.com/lesson",
      domain: "example.com",
      title: "Lesson",
      thumbnailUrl: null,
      type: "article",
      status: "queued",
      sourceDurationSeconds: null,
      sourceDurationProvenance: "unknown",
      sourceDurationCompleteness: "unknown",
      playbackSpeed: 1,
      manualEstimatedSeconds: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  notes: [],
  settings: null,
  events: [],
  sessions: [],
});

describe("transfer screen state", () => {
  it("preserves a rejected-file error without attempting an import", () => {
    expect(previewTransfer("not json", existing)).toEqual({
      kind: "error",
      message: "Choose a valid stop-tumpuk export file.",
    });
  });

  it("rejects an unsupported backup format before a preview can be imported", () => {
    expect(
      previewTransfer(
        validExport.replace(`"version":1`, `"version":2`),
        existing,
      ),
    ).toEqual({
      kind: "error",
      message: "This export format is not supported.",
    });
  });

  it("keeps a valid preview available for an explicit Import action", () => {
    const state = previewTransfer(validExport, existing);
    expect(state.kind).toBe("preview");
    if (state.kind !== "preview") return;
    expect(state.preview.importable).toBe(0);
    expect(previewDescription(state.preview)).toBe(
      "0 records ready to import.",
    );
  });

  it("describes conflicts while keeping the preview additive", () => {
    const state = previewTransfer(exportWithRecords, {
      ...existing,
      materialIds: new Set(["material-1"]),
    });

    expect(state.kind).toBe("preview");
    if (state.kind !== "preview") return;
    expect(state.preview.conflicts).toBe(1);
    expect(state.preview.importable).toBe(0);
    expect(state.preview.additions.materials).toEqual([]);
    expect(previewDescription(state.preview)).toBe(
      "Everything in this backup already exists locally. Nothing will be changed.",
    );
  });

  it("reports a conflict-free preview with the exact additive count", () => {
    const state = previewTransfer(exportWithRecords, existing);

    expect(state.kind).toBe("preview");
    if (state.kind !== "preview") return;
    expect(state.preview.conflicts).toBe(0);
    expect(state.preview.importable).toBe(1);
    expect(previewDescription(state.preview)).toBe("1 record ready to import.");
  });
});
