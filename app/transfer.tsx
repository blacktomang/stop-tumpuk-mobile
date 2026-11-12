import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { exportData, importData } from "../src/application/data-transfer";
import { nativeTransferFileAdapter } from "../src/platform/transfer-file-adapter";
import {
  previewDescription,
  previewTransfer,
  type TransferScreenState,
} from "../src/features/transfer/transfer-presenter";
import { openNativeRepositories } from "../src/storage/sqlite/expo-sqlite-adapter";
import type { NativeRepositories } from "../src/storage/sqlite/repositories";

const colors = {
  ink: "#17211B",
  muted: "#647067",
  paper: "#F6F7F2",
  panel: "#FFFFFF",
  line: "#DDE4DC",
  accent: "#2E6B4D",
  accentSoft: "#E5F0E7",
  danger: "#A53D32",
};

export default function TransferScreen() {
  const [repositories, setRepositories] = useState<NativeRepositories | null>(
    null,
  );
  const [state, setState] = useState<TransferScreenState>({ kind: "idle" });
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    openNativeRepositories()
      .then((nextRepositories) => {
        if (mounted) setRepositories(nextRepositories);
      })
      .catch(() => {
        if (mounted)
          setMessage("Local storage is unavailable. Try reopening the app.");
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function importBackup() {
    if (!repositories) return;
    setBusy(true);
    setMessage(null);
    try {
      const picked = await nativeTransferFileAdapter.pickBackup();
      if (!picked) return;
      const existing = await existingRecordIds(repositories);
      const nextState = previewTransfer(picked.contents, existing);
      setState(nextState);
      if (nextState.kind === "error")
        setMessage(`Could not import ${picked.name}: ${nextState.message}`);
    } catch (error) {
      setState({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "The backup file could not be read.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!repositories || state.kind !== "preview") return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await importData(state.preview.data, repositories);
      setState({ kind: "idle" });
      setMessage(
        result.importable === 0
          ? "Nothing new was imported. Existing local records were kept."
          : `Imported ${result.importable} new record${result.importable === 1 ? "" : "s"}. Existing records were kept.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The backup could not be imported. No local data was changed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function exportBackup() {
    if (!repositories) return;
    setBusy(true);
    setMessage(null);
    try {
      const contents = await exportData(repositories);
      const uri = await nativeTransferFileAdapter.writeExport(contents);
      await nativeTransferFileAdapter.shareExport(uri);
      setMessage("Backup exported. Keep a copy somewhere safe.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The backup could not be exported.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: "Import & export" }} />
      <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
        <Text style={styles.eyebrow}>LOCAL DATA</Text>
        <Text style={styles.title}>Keep your plan portable.</Text>
        <Text style={styles.intro}>
          Backups stay on your device until you choose where to save or share
          them. stop-tumpuk does not sync data between devices.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Export a backup</Text>
          <Text style={styles.body}>
            Export your materials, notes, settings, timer sessions, and history
            as a current-format JSON backup. Disposable share intake is not
            included.
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={!repositories || busy}
            onPress={() => void exportBackup()}
            style={({ pressed }) => [
              styles.primary,
              pressed && styles.pressed,
              (!repositories || busy) && styles.disabled,
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryText}>Export backup</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Import a backup</Text>
          <Text style={styles.body}>
            Choose a stop-tumpuk JSON backup. It is validated before any write;
            matching IDs are shown as conflicts and skipped, never overwritten.
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={!repositories || busy}
            onPress={() => void importBackup()}
            style={({ pressed }) => [
              styles.secondary,
              pressed && styles.pressed,
              (!repositories || busy) && styles.disabled,
            ]}
          >
            <Text style={styles.secondaryText}>Choose backup file</Text>
          </Pressable>

          {state.kind === "preview" ? (
            <View style={styles.preview}>
              <Text style={styles.previewTitle}>Review before importing</Text>
              <Text style={styles.body}>
                {previewDescription(state.preview)}
              </Text>
              <Text style={styles.previewHint}>
                Import is additive and atomic. Cancel leaves local data
                unchanged.
              </Text>
              <View style={styles.actionRow}>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => setState({ kind: "idle" })}
                  style={({ pressed }) => [
                    styles.cancel,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.secondaryText}>Cancel</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy || state.preview.importable === 0}
                  onPress={() => void confirmImport()}
                  style={({ pressed }) => [
                    styles.primary,
                    pressed && styles.pressed,
                    (busy || state.preview.importable === 0) && styles.disabled,
                  ]}
                >
                  <Text style={styles.primaryText}>Import</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          {state.kind === "error" ? (
            <Text style={styles.error}>{state.message}</Text>
          ) : null}
        </View>

        {message ? <Text style={styles.message}>{message}</Text> : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryText}>Back</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

async function existingRecordIds(repositories: NativeRepositories) {
  const [materials, notes, events, sessions, settings] = await Promise.all([
    repositories.materials.list(),
    repositories.notes.list(),
    repositories.events.list(),
    repositories.sessions.list(),
    repositories.settings.get(),
  ]);
  return {
    materialIds: new Set(materials.map((item) => item.id)),
    noteIds: new Set(notes.map((item) => item.id)),
    eventIds: new Set(events.map((item) => item.id)),
    sessionIds: new Set(sessions.map((item) => item.id)),
    hasSettings: settings !== null,
  };
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper },
  content: { gap: 18, padding: 24, paddingTop: 38 },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
  },
  title: {
    color: colors.ink,
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: -1,
    lineHeight: 40,
  },
  intro: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  cardTitle: { color: colors.ink, fontSize: 19, fontWeight: "700" },
  body: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  primary: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 10,
    flex: 1,
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: 14,
  },
  primaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  secondary: {
    alignItems: "center",
    borderColor: colors.line,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: 14,
  },
  secondaryText: { color: colors.accent, fontSize: 15, fontWeight: "700" },
  preview: {
    backgroundColor: colors.accentSoft,
    borderRadius: 12,
    gap: 9,
    padding: 14,
  },
  previewTitle: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  previewHint: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancel: {
    alignItems: "center",
    borderColor: colors.line,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: 14,
  },
  back: {
    alignItems: "center",
    borderColor: colors.line,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
  },
  pressed: { opacity: 0.84, transform: [{ translateY: 1 }] },
  disabled: { opacity: 0.5 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  message: { color: colors.accent, fontSize: 14, lineHeight: 20 },
});
