import {
  previewImport,
  type ExistingRecordIds,
  type ImportPreview,
} from "../../application/data-transfer";

export type TransferScreenState =
  | { kind: "idle" }
  | { kind: "preview"; preview: ImportPreview }
  | { kind: "error"; message: string };

export function previewTransfer(
  contents: string,
  existing: ExistingRecordIds,
): TransferScreenState {
  try {
    return { kind: "preview", preview: previewImport(contents, existing) };
  } catch (error) {
    return {
      kind: "error",
      message:
        error instanceof Error
          ? error.message
          : "Choose a valid stop-tumpuk export file.",
    };
  }
}

export function previewDescription(preview: ImportPreview): string {
  if (preview.importable === 0 && preview.conflicts > 0)
    return "Everything in this backup already exists locally. Nothing will be changed.";
  if (preview.conflicts === 0)
    return `${preview.importable} record${preview.importable === 1 ? "" : "s"} ready to import.`;
  return `${preview.importable} new record${preview.importable === 1 ? "" : "s"}; ${preview.conflicts} existing record${preview.conflicts === 1 ? "" : "s"} will be skipped.`;
}
