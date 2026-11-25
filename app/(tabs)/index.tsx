import { randomUUID } from "expo-crypto";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { createThemedStyles } from "../../src/ui/theme";

import { createCaptureService } from "../../src/application/capture-service";
import type { CaptureDestination } from "../../src/application/capture-service";
import { openNativeRepositories } from "../../src/storage/sqlite/expo-sqlite-adapter";
import type { NativeRepositories } from "../../src/storage/sqlite/repositories";

export default function HomeScreen() {
  const { colors, styles } = useStyles();
  const { intakeId, shareError } = useLocalSearchParams<{
    intakeId?: string | string[];
    shareError?: string | string[];
  }>();
  const [repositories, setRepositories] = useState<NativeRepositories | null>(
    null,
  );
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [destination, setDestination] = useState<CaptureDestination>("queued");
  const [stagedIntakeId, setStagedIntakeId] = useState<string | null>(null);
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

  useEffect(() => {
    const nextIntakeId = Array.isArray(intakeId) ? intakeId[0] : intakeId;
    const nextShareError = Array.isArray(shareError)
      ? shareError[0]
      : shareError;
    if (
      nextShareError === "unavailable" ||
      nextShareError === "ios-unsupported"
    ) {
      setStatus(
        nextShareError === "ios-unsupported"
          ? "iOS sharing is not available in this build. Paste the link below to continue."
          : "That share could not be opened. Paste the link below to continue.",
      );
    }
    if (!repositories || !nextIntakeId) return;

    let mounted = true;
    repositories.captureIntake
      .get(nextIntakeId)
      .then((intake) => {
        if (!mounted) return;
        if (!intake || intake.consumedAt !== null) {
          setStatus(
            "That shared link is no longer available. Paste it below to continue.",
          );
          return;
        }
        setUrl(intake.url);
        setStagedIntakeId(intake.id);
        setStatus("Shared link staged. Choose a destination, then save it.");
      })
      .catch(() => {
        if (mounted)
          setStatus(
            "The shared link could not be loaded. Paste it below to continue.",
          );
      });
    return () => {
      mounted = false;
    };
  }, [intakeId, repositories, shareError]);

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
      const result = stagedIntakeId
        ? await captureService.captureStagedIntake(stagedIntakeId, destination)
        : await captureService.captureUrl(url, destination);
      if (result.kind === "duplicate") {
        Alert.alert(
          "Already in your queue",
          `${result.existing.title} is already saved. Save another copy anyway?`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Save another",
              onPress: () => {
                setIsSaving(true);
                setStatus(null);
                void result
                  .retry()
                  .then((retryResult) => {
                    if (retryResult.kind !== "saved") {
                      setStatus("That link could not be saved again.");
                      return;
                    }
                    setUrl("");
                    setStagedIntakeId(null);
                    setStatus("Saved a second copy.");
                  })
                  .catch((retryError) => {
                    setStatus(
                      retryError instanceof Error
                        ? retryError.message
                        : "That link could not be saved again.",
                    );
                  })
                  .finally(() => setIsSaving(false));
              },
            },
          ],
        );
      } else {
        setUrl("");
        setStagedIntakeId(null);
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
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>STOP-TUMPUK</Text>
          <Text style={styles.title}>Make room to finish.</Text>
          <Text style={styles.intro}>
            Save something useful now. Decide whether it belongs in your Reading
            plan or Inbox.
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
            placeholderTextColor={colors.mutedForeground}
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
              <ActivityIndicator color={colors.primaryForeground} />
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
  const { styles } = useStyles();
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

const useStyles = createThemedStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, padding: 24, paddingTop: 68, gap: 24 },
  header: { gap: 12, maxWidth: 480 },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
  },
  title: {
    color: colors.foreground,
    fontSize: 36,
    fontWeight: "700",
    letterSpacing: -1.2,
    lineHeight: 42,
  },
  intro: { color: colors.mutedForeground, fontSize: 17, lineHeight: 25 },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 10,
  },
  label: {
    color: colors.mutedForeground,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  input: {
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.foreground,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  destinationLabel: { marginTop: 12 },
  destinationRow: { gap: 10 },
  destination: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 62,
    padding: 12,
  },
  destinationActive: {
    backgroundColor: colors.accent,
    borderColor: colors.primary,
  },
  radio: {
    alignItems: "center",
    borderColor: colors.input,
    borderRadius: 20,
    borderWidth: 1,
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  radioActive: { borderColor: colors.primary },
  radioDot: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    height: 10,
    width: 10,
  },
  destinationCopy: { gap: 2 },
  destinationTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "700",
  },
  destinationTitleActive: { color: colors.primary },
  destinationDescription: { color: colors.mutedForeground, fontSize: 13 },
  saveButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 10,
    justifyContent: "center",
    minHeight: 52,
    marginTop: 8,
  },
  saveText: {
    color: colors.primaryForeground,
    fontSize: 16,
    fontWeight: "700",
  },
  pressed: { opacity: 0.84, transform: [{ translateY: 1 }] },
  disabled: { opacity: 0.5 },
  status: { color: colors.primary, fontSize: 14, lineHeight: 20 },
  error: { color: colors.destructiveForeground, fontSize: 14, lineHeight: 20 },
  note: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 4,
  },
  noteMark: {
    alignItems: "center",
    borderColor: colors.mutedForeground,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: "700",
    height: 20,
    lineHeight: 18,
    textAlign: "center",
    width: 20,
  },
  noteText: {
    color: colors.mutedForeground,
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
}));
