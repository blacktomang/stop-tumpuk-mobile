import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDocumentAsync: vi.fn(),
  readAsStringAsync: vi.fn(),
  writeAsStringAsync: vi.fn(),
  isAvailableAsync: vi.fn(),
  shareAsync: vi.fn(),
  documentDirectory: "/documents/" as string | null,
}));

vi.mock("expo-document-picker", () => ({
  getDocumentAsync: mocks.getDocumentAsync,
}));

vi.mock("expo-file-system/legacy", () => ({
  get documentDirectory() {
    return mocks.documentDirectory;
  },
  EncodingType: { UTF8: "utf8" },
  readAsStringAsync: mocks.readAsStringAsync,
  writeAsStringAsync: mocks.writeAsStringAsync,
}));

vi.mock("expo-sharing", () => ({
  isAvailableAsync: mocks.isAvailableAsync,
  shareAsync: mocks.shareAsync,
}));

import { nativeTransferFileAdapter } from "./transfer-file-adapter";

describe("native transfer file adapter boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.documentDirectory = "/documents/";
  });

  it("returns null and does not read when the picker is cancelled", async () => {
    mocks.getDocumentAsync.mockResolvedValue({ canceled: true, assets: [] });

    await expect(nativeTransferFileAdapter.pickBackup()).resolves.toBeNull();
    expect(mocks.readAsStringAsync).not.toHaveBeenCalled();
  });

  it("rejects a picker result with no usable asset", async () => {
    mocks.getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [],
    });

    await expect(nativeTransferFileAdapter.pickBackup()).resolves.toBeNull();
    expect(mocks.readAsStringAsync).not.toHaveBeenCalled();
  });

  it("reads the selected file and propagates file-read failures", async () => {
    mocks.getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ name: "backup.json", uri: "file:///backup.json" }],
    });
    mocks.readAsStringAsync.mockRejectedValue(new Error("file is unreadable"));

    await expect(nativeTransferFileAdapter.pickBackup()).rejects.toThrow(
      "file is unreadable",
    );
    expect(mocks.readAsStringAsync).toHaveBeenCalledWith(
      "file:///backup.json",
      { encoding: "utf8" },
    );
  });

  it("returns the selected file contents for validation at the application boundary", async () => {
    mocks.getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ name: "not-a-backup.txt", uri: "file:///picked" }],
    });
    mocks.readAsStringAsync.mockResolvedValue("not a stop-tumpuk backup");

    await expect(nativeTransferFileAdapter.pickBackup()).resolves.toEqual({
      name: "not-a-backup.txt",
      contents: "not a stop-tumpuk backup",
    });
  });

  it("rejects export when document storage is unavailable", async () => {
    mocks.documentDirectory = null;

    await expect(
      nativeTransferFileAdapter.writeExport("{}" as string),
    ).rejects.toThrow("Local file storage is unavailable.");
    expect(mocks.writeAsStringAsync).not.toHaveBeenCalled();
  });

  it("propagates export write failures", async () => {
    mocks.writeAsStringAsync.mockRejectedValue(new Error("disk full"));

    await expect(
      nativeTransferFileAdapter.writeExport("{}" as string),
    ).rejects.toThrow("disk full");
  });

  it("rejects sharing when the platform has no share target", async () => {
    mocks.isAvailableAsync.mockResolvedValue(false);

    await expect(
      nativeTransferFileAdapter.shareExport("file:///backup.json"),
    ).rejects.toThrow("File sharing is unavailable on this device.");
    expect(mocks.shareAsync).not.toHaveBeenCalled();
  });

  it("propagates platform share errors after availability succeeds", async () => {
    mocks.isAvailableAsync.mockResolvedValue(true);
    mocks.shareAsync.mockRejectedValue(new Error("share dismissed"));

    await expect(
      nativeTransferFileAdapter.shareExport("file:///backup.json"),
    ).rejects.toThrow("share dismissed");
    expect(mocks.shareAsync).toHaveBeenCalledWith("file:///backup.json", {
      mimeType: "application/json",
      dialogTitle: "Export stop-tumpuk backup",
    });
  });
});
