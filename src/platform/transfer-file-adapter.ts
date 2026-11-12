import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

export interface PickedBackup {
  name: string;
  contents: string;
}

/** Native-only file boundary for backup transfer. No application data crosses it. */
export interface TransferFileAdapter {
  pickBackup(): Promise<PickedBackup | null>;
  writeExport(contents: string): Promise<string>;
  shareExport(uri: string): Promise<void>;
}

export const nativeTransferFileAdapter: TransferFileAdapter = {
  async pickBackup() {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/json",
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets[0]) return null;

    const asset = result.assets[0];
    return {
      name: asset.name,
      contents: await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      }),
    };
  },

  async writeExport(contents) {
    const directory = FileSystem.documentDirectory;
    if (!directory) throw new Error("Local file storage is unavailable.");
    const uri = `${directory}stop-tumpuk-export-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    await FileSystem.writeAsStringAsync(uri, contents, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return uri;
  },

  async shareExport(uri) {
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error("File sharing is unavailable on this device.");
    }
    await Sharing.shareAsync(uri, {
      mimeType: "application/json",
      dialogTitle: "Export stop-tumpuk backup",
    });
  },
};
