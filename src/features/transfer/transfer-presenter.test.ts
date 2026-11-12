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

describe("transfer screen state", () => {
  it("preserves a rejected-file error without attempting an import", () => {
    expect(previewTransfer("not json", existing)).toEqual({
      kind: "error",
      message: "Choose a valid stop-tumpuk export file.",
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
});
