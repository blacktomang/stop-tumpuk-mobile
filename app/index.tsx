import { randomUUID } from "expo-crypto";
import { router, Stack } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { createCaptureService } from "../src/application/capture-service";
import type { CaptureDestination } from "../src/application/capture-service";
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

export default function HomeScreen() {
  const [repositories, setRepositories] = useState<NativeRepositories | null>(
    null,
  );
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [destination, setDestination] = useState<CaptureDestination>("queued");
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    openNativeRepositories()
      .then((nextRepositories) => {
        if (mounted) setRepositories(nextRepositories);
      })
      .catch(() => {
        if (mounted)
          setDatabaseError(
            "Local storage is unavailable. Try reopening the app before saving.",
          );
      });
    return () => {
      mounted = false;
    };
  }, []);

  const captureService = useMemo(
    () =>
      repositories
        ? createCaptureService({
            repositories,
            generateId: randomUUID,
            now: () => new Date().toISOString(),
          })
        : null,
    [repositories],
  );

  async function saveCapture() {
    if (!captureService || !url.trim()) {
      setStatus("Paste an HTTP(S) link to continue.");
      return;
    }
    setIsSaving(true);
    setStatus(null);
    try {
      const result = await captureService.captureUrl(url, destination);
      if (result.kind === "duplicate") {
        Alert.alert(
          "Already in your queue",
          `${result.existing.title} is already saved. Save another copy anyway?`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Save another",
              onPress: () => {
                void result.retry().then(() => {
                  setUrl("");
                  setStatus("Saved a second copy.");
                });
              },
            },
          ],
        );
      } else {
        setUrl("");
        setStatus(
          destination === "queued"
            ? "Added to Reading plan."
            : "Saved to Inbox.",
        );
      }
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "That link could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: "Capture", headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.screen}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <Text style={styles.eyebrow}>STOP-TUMPUK</Text>
              <View style={styles.headerActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push("/dashboard")}
                >
                  <Text style={styles.settingsLink}>Dashboard</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push("/settings")}
                >
                  <Text style={styles.settingsLink}>Settings</Text>
                </Pressable>
              </View>
            </View>
            <Text style={styles.title}>Make room to finish.</Text>
            <Text style={styles.intro}>
              Save something useful now. Decide whether it belongs in your
              Reading plan or Inbox.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>SOURCE LINK</Text>
            <TextInput
              accessibilityLabel="Source URL"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              onChangeText={setUrl}
              onSubmitEditing={() => void saveCapture()}
              placeholder="https://..."
              placeholderTextColor="#9AA59B"
              returnKeyType="done"
              style={styles.input}
              value={url}
            />

            <Text style={[styles.label, styles.destinationLabel]}>SAVE TO</Text>
            <View accessibilityRole="radiogroup" style={styles.destinationRow}>
              <DestinationButton
                active={destination === "queued"}
                description="Counts toward your time"
                label="Reading plan"
                onPress={() => setDestination("queued")}
              />
              <DestinationButton
                active={destination === "inbox"}
                description="Keep it for later"
                label="Inbox"
                onPress={() => setDestination("inbox")}
              />
            </View>

            <Pressable
              accessibilityLabel="Save source"
              accessibilityRole="button"
              disabled={isSaving || !repositories}
              onPress={() => void saveCapture()}
              style={({ pressed }) => [
                styles.saveButton,
                pressed && styles.pressed,
                (isSaving || !repositories) && styles.disabled,
              ]}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveText}>Save source</Text>
              )}
            </Pressable>
            {status ? <Text style={styles.status}>{status}</Text> : null}
            {databaseError ? (
              <Text style={styles.error}>{databaseError}</Text>
            ) : null}
          </View>

          <View style={styles.note}>
            <Text style={styles.noteMark}>i</Text>
            <Text style={styles.noteText}>
              Metadata and estimates are optional. Your capture is saved locally
              first, even when a source cannot be enriched.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

function DestinationButton({
  active,
  description,
  label,
  onPress,
}: {
  active: boolean;
  description: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.destination,
        active && styles.destinationActive,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.radio, active && styles.radioActive]}>
        {active ? <View style={styles.radioDot} /> : null}
      </View>
      <View style={styles.destinationCopy}>
        <Text
          style={[
            styles.destinationTitle,
            active && styles.destinationTitleActive,
          ]}
        >
          {label}
        </Text>
        <Text style={styles.destinationDescription}>{description}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { flexGrow: 1, padding: 24, paddingTop: 68, gap: 24 },
  header: { gap: 12, maxWidth: 480 },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerActions: { flexDirection: "row", gap: 16 },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
  },
  title: {
    color: colors.ink,
    fontSize: 36,
    fontWeight: "700",
    letterSpacing: -1.2,
    lineHeight: 42,
  },
  intro: { color: colors.muted, fontSize: 17, lineHeight: 25 },
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 10,
  },
  label: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  input: {
    borderColor: colors.line,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  destinationLabel: { marginTop: 12 },
  destinationRow: { gap: 10 },
  destination: {
    alignItems: "center",
    borderColor: colors.line,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 62,
    padding: 12,
  },
  destinationActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  radio: {
    alignItems: "center",
    borderColor: "#A7B2A9",
    borderRadius: 20,
    borderWidth: 1,
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  radioActive: { borderColor: colors.accent },
  radioDot: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    height: 10,
    width: 10,
  },
  destinationCopy: { gap: 2 },
  destinationTitle: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  destinationTitleActive: { color: colors.accent },
  destinationDescription: { color: colors.muted, fontSize: 13 },
  saveButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 10,
    justifyContent: "center",
    minHeight: 52,
    marginTop: 8,
  },
  saveText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  pressed: { opacity: 0.84, transform: [{ translateY: 1 }] },
  disabled: { opacity: 0.5 },
  status: { color: colors.accent, fontSize: 14, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  note: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 4,
  },
  noteMark: {
    alignItems: "center",
    borderColor: colors.muted,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    height: 20,
    lineHeight: 18,
    textAlign: "center",
    width: 20,
  },
  noteText: { color: colors.muted, flex: 1, fontSize: 13, lineHeight: 20 },
  settingsLink: { color: colors.accent, fontSize: 14, fontWeight: "700" },
});
