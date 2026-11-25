import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { createThemedStyles } from "../../src/ui/theme";

import { createSettingsService } from "../../src/application/settings-service";
import { openNativeRepositories } from "../../src/storage/sqlite/expo-sqlite-adapter";
import type { NativeRepositories } from "../../src/storage/sqlite/repositories";
import type { Settings } from "../../src/types";

export default function SettingsScreen() {
  const { colors, styles } = useStyles();
  const [repositories, setRepositories] = useState<NativeRepositories | null>(
    null,
  );
  const [settings, setSettings] = useState<Settings | null>(null);
  const [weekday, setWeekday] = useState("");
  const [weekend, setWeekend] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    openNativeRepositories()
      .then(async (nextRepositories) => {
        const nextSettings = await createSettingsService({
          repositories: nextRepositories,
        }).get();
        if (!mounted) return;
        setRepositories(nextRepositories);
        setSettings(nextSettings);
        setWeekday(formatMinutes(nextSettings.weekdayMinutes));
        setWeekend(formatMinutes(nextSettings.weekendMinutes));
      })
      .catch(() => {
        if (mounted)
          setMessage("Local storage is unavailable. Try reopening the app.");
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function save() {
    if (!repositories) return;
    setSaving(true);
    setMessage(null);
    try {
      const saved = await createSettingsService({
        repositories,
      }).saveAvailability(parseMinutes(weekday), parseMinutes(weekend));
      setSettings(saved);
      setMessage("Availability saved.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Availability could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function skip() {
    if (!repositories) return;
    setSaving(true);
    setMessage(null);
    try {
      const skipped = await createSettingsService({
        repositories,
      }).skipAvailabilityPrompt();
      setSettings(skipped);
      setMessage(
        `Skipped for now. We can ask again after ${formatReminder(skipped.availabilityReminderAt)}.`,
      );
    } catch {
      setMessage("The reminder could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
        <Text style={styles.eyebrow}>SETTINGS</Text>
        <Text style={styles.title}>Make the week visible.</Text>
        <Text style={styles.intro}>
          Tell stop-tumpuk how much time you usually have. Leave a field empty
          when it is not configured.
        </Text>
        <View style={styles.card}>
          <Field
            label="Weekday minutes"
            value={weekday}
            onChangeText={setWeekday}
          />
          <Field
            label="Weekend minutes"
            value={weekend}
            onChangeText={setWeekend}
          />
          <Text style={styles.hint}>
            Zero is valid. It means no available minutes, not an unset value.
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={!repositories || saving}
            onPress={() => void save()}
            style={({ pressed }) => [
              styles.primary,
              pressed && styles.pressed,
              (!repositories || saving) && styles.disabled,
            ]}
          >
            {saving ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={styles.primaryText}>Save availability</Text>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!repositories || saving}
            onPress={() => void skip()}
            style={({ pressed }) => [
              styles.secondary,
              pressed && styles.pressed,
              (!repositories || saving) && styles.disabled,
            ]}
          >
            <Text style={styles.secondaryText}>Skip for now</Text>
          </Pressable>
          {message ? (
            <Text
              style={
                message.includes("unavailable") || message.includes("could not")
                  ? styles.error
                  : styles.message
              }
            >
              {message}
            </Text>
          ) : null}
        </View>
        {settings ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateLabel}>CURRENT STATE</Text>
            <Text style={styles.stateValue}>
              {availabilitySummary(settings)}
            </Text>
            <Text style={styles.stateHint}>
              {settings.onboardingDismissed
                ? "You can change this any time."
                : "Availability is not configured yet."}
            </Text>
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/transfer")}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryText}>Import & export data</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

function Field({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  const { colors, styles } = useStyles();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        keyboardType="decimal-pad"
        onChangeText={onChangeText}
        placeholder="Unset"
        placeholderTextColor={colors.mutedForeground}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function parseMinutes(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0)
    throw new Error("Minutes must be zero or more.");
  return parsed;
}

function formatMinutes(value: number | null): string {
  return value === null ? "" : String(value);
}
function formatReminder(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : "later";
}
function availabilitySummary(settings: Settings): string {
  const weekday =
    settings.weekdayMinutes === null
      ? "unset"
      : `${settings.weekdayMinutes} min`;
  const weekend =
    settings.weekendMinutes === null
      ? "unset"
      : `${settings.weekendMinutes} min`;
  return `${weekday} weekdays · ${weekend} weekends`;
}

const useStyles = createThemedStyles((colors) => ({
  screen: { backgroundColor: colors.background },
  content: { gap: 18, padding: 24, paddingTop: 38 },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
  },
  title: {
    color: colors.foreground,
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: -1,
    lineHeight: 40,
  },
  intro: { color: colors.mutedForeground, fontSize: 16, lineHeight: 24 },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  field: { gap: 7 },
  label: { color: colors.foreground, fontSize: 14, fontWeight: "700" },
  input: {
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.foreground,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  hint: { color: colors.mutedForeground, fontSize: 13, lineHeight: 19 },
  primary: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 10,
    justifyContent: "center",
    minHeight: 50,
    marginTop: 4,
  },
  primaryText: {
    color: colors.primaryForeground,
    fontSize: 15,
    fontWeight: "700",
  },
  secondary: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
  },
  secondaryText: { color: colors.primary, fontSize: 15, fontWeight: "700" },
  pressed: { opacity: 0.84, transform: [{ translateY: 1 }] },
  disabled: { opacity: 0.5 },
  message: { color: colors.primary, fontSize: 14, lineHeight: 20 },
  error: { color: colors.destructiveForeground, fontSize: 14, lineHeight: 20 },
  stateCard: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    gap: 7,
    padding: 16,
  },
  stateLabel: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.3,
  },
  stateValue: { color: colors.foreground, fontSize: 16, fontWeight: "700" },
  stateHint: { color: colors.mutedForeground, fontSize: 13 },
}));
