import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { createPlanningService } from "../../src/application/planning-service";
import type { CapacityViewModel, RecommendationResult } from "../../src/domain";
import {
  estimateLabel,
  estimatedSeconds,
  formatDuration,
} from "../../src/domain";
import type { ManualSelection } from "../../src/application/planning-service";
import {
  capacityProjection,
  presentCapacity,
} from "../../src/features/dashboard/capacity-presenter";
import { CapacityMeter } from "../../src/features/dashboard/capacity-meter";
import {
  availableMinuteShortcuts,
  parseAvailableMinutes,
} from "../../src/features/dashboard/recommendation-presenter";
import { openNativeRepositories } from "../../src/storage/sqlite/expo-sqlite-adapter";

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

export default function DashboardScreen() {
  const [capacity, setCapacity] = useState<CapacityViewModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recommendation, setRecommendation] =
    useState<RecommendationResult | null>(null);
  const [availableMinutes, setAvailableMinutes] = useState(15);
  const [customMinutes, setCustomMinutes] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [manualSelection, setManualSelection] =
    useState<ManualSelection | null>(null);

  const refreshDashboard = useCallback(() => {
    let mounted = true;
    setError(null);
    openNativeRepositories()
      .then(async (repositories) => {
        const service = createPlanningService({ repositories });
        const [nextCapacity, nextRecommendation] = await Promise.all([
          service.getCapacity(),
          service.recommend(15 * 60),
        ]);
        if (mounted) {
          setCapacity(nextCapacity);
          setRecommendation(nextRecommendation);
          setError(null);
        }
      })
      .catch(() => {
        if (mounted)
          setError(
            "The weekly plan could not be loaded. Try reopening the app.",
          );
      });
    return () => {
      mounted = false;
    };
  }, []);

  useFocusEffect(refreshDashboard);

  async function chooseAvailableMinutes(minutes: number) {
    setAvailableMinutes(minutes);
    setCustomError(null);
    setShowManual(false);
    setManualSelection(null);
    try {
      const repositories = await openNativeRepositories();
      const nextRecommendation = await createPlanningService({
        repositories,
      }).recommend(minutes * 60);
      setRecommendation(nextRecommendation);
      setError(null);
    } catch {
      setCustomError("The recommendation could not be refreshed.");
    }
  }

  async function applyCustomMinutes() {
    const minutes = parseAvailableMinutes(customMinutes);
    if (minutes === null) {
      setCustomError("Enter a whole number of minutes, or choose a shortcut.");
      return;
    }
    await chooseAvailableMinutes(minutes);
  }

  async function selectManual(materialId: string) {
    try {
      const repositories = await openNativeRepositories();
      const selection = await createPlanningService({
        repositories,
      }).selectManual(materialId);
      setManualSelection(selection);
      setShowManual(false);
    } catch {
      setCustomError("That item is no longer available.");
    }
  }

  const presentation = capacity ? presentCapacity(capacity) : null;

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
        <Text style={styles.eyebrow}>DASHBOARD</Text>
        <Text style={styles.title}>A week you can finish.</Text>
        <Text style={styles.intro}>
          Your Reading plan, translated into the time you actually have.
        </Text>

        {!capacity && !error ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.muted}>Reading your local plan…</Text>
          </View>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {capacity && presentation ? (
          <>
            <View style={styles.card}>
              <Text style={styles.eyebrow}>{presentation.eyebrow}</Text>
              <Text style={styles.message}>{presentation.message}</Text>
              <CapacityMeter
                label={presentation.meterLabel}
                tone={presentation.tone}
                value={presentation.meterValue}
                valueText={presentation.meterText}
              />
              <Text style={styles.detail}>{presentation.detail}</Text>
            </View>

            <View style={styles.stats}>
              <Stat label="KNOWN PLANNED" value={presentation.knownTime} />
              <Stat label="WEEKLY CAPACITY" value={presentation.capacityTime} />
              <Stat label="UNKNOWN TIME" value={presentation.unknownTime} />
            </View>

            <View style={styles.projection}>
              <Text style={styles.projectionLabel}>
                PLAIN-LANGUAGE PROJECTION
              </Text>
              <Text style={styles.projectionText}>
                {capacityProjection(capacity)}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/materials")}
              style={({ pressed }) => [
                styles.secondary,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.secondaryText}>Manage materials</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/settings")}
              style={({ pressed }) => [
                styles.secondary,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.secondaryText}>
                Adjust weekly availability
              </Text>
            </Pressable>

            <View style={styles.recommendation}>
              <Text style={styles.recommendationLabel}>READ NEXT</Text>
              <Text style={styles.recommendationText}>
                How much time do you have right now?
              </Text>
              <View style={styles.shortcuts}>
                {availableMinuteShortcuts.map((minutes) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{
                      selected: availableMinutes === minutes,
                    }}
                    key={minutes}
                    onPress={() => void chooseAvailableMinutes(minutes)}
                    style={({ pressed }) => [
                      styles.shortcut,
                      availableMinutes === minutes && styles.shortcutSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.shortcutText,
                        availableMinutes === minutes &&
                          styles.shortcutTextSelected,
                      ]}
                    >
                      {minutes} min
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.customRow}>
                <TextInput
                  accessibilityLabel="Custom available minutes"
                  keyboardType="number-pad"
                  onChangeText={setCustomMinutes}
                  placeholder="Custom"
                  placeholderTextColor={colors.muted}
                  style={styles.customInput}
                  value={customMinutes}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void applyCustomMinutes()}
                  style={({ pressed }) => [
                    styles.customButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.customButtonText}>Use time</Text>
                </Pressable>
              </View>
              {customError ? (
                <Text style={styles.error}>{customError}</Text>
              ) : null}
              {manualSelection ? (
                <View style={styles.selection}>
                  <Text style={styles.selectionLabel}>MANUALLY SELECTED</Text>
                  <Text style={styles.recommendationTitle}>
                    {manualSelection.material.title}
                  </Text>
                  <Text style={styles.recommendationText}>
                    {manualSelection.estimatedSeconds === null
                      ? "Time not estimated yet. This item was selected manually and is not claimed to fit."
                      : `${formatDuration(manualSelection.estimatedSeconds)} · ${estimateLabel(manualSelection.material)}`}
                  </Text>
                </View>
              ) : recommendation?.primary ? (
                <View style={styles.selection}>
                  <Text style={styles.selectionLabel}>FITS YOUR TIME</Text>
                  <Text style={styles.recommendationTitle}>
                    {recommendation.primary.title}
                  </Text>
                  <Text style={styles.recommendationText}>
                    {formatDuration(
                      estimatedSeconds(recommendation.primary) ?? 0,
                    )}{" "}
                    · Start with this one item.
                  </Text>
                </View>
              ) : (
                <View style={styles.selection}>
                  <Text style={styles.selectionLabel}>NO FITTING ITEM</Text>
                  <Text style={styles.recommendationText}>
                    Nothing fits in {availableMinutes} minutes.
                    {recommendation?.partial
                      ? ` You can still choose “${recommendation.partial.title}” for a partial session.`
                      : " Choose another to select an item manually."}
                  </Text>
                  {recommendation?.partial ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        void selectManual(recommendation.partial!.id)
                      }
                      style={({ pressed }) => [
                        styles.partialButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.secondaryText}>
                        Choose longer item
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              )}
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowManual((visible) => !visible)}
                style={({ pressed }) => [
                  styles.manualButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.secondaryText}>
                  {showManual ? "Hide choices" : "Choose another"}
                </Text>
              </Pressable>
              {showManual && recommendation ? (
                <View style={styles.manualList}>
                  {recommendation.manual.map((item) => (
                    <Pressable
                      accessibilityRole="button"
                      key={item.id}
                      onPress={() => void selectManual(item.id)}
                      style={({ pressed }) => [
                        styles.manualItem,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.manualTitle}>{item.title}</Text>
                      <Text style={styles.manualEstimate}>
                        {formatDuration(
                          item.manualEstimatedSeconds ??
                            item.sourceDurationSeconds,
                        )}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          </>
        ) : null}
      </ScrollView>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper },
  content: { gap: 18, padding: 24, paddingTop: 38 },
  eyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.6,
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
    gap: 16,
    padding: 18,
  },
  message: {
    color: colors.ink,
    fontSize: 23,
    fontWeight: "700",
    letterSpacing: -0.4,
    lineHeight: 29,
  },
  detail: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  stats: { flexDirection: "row", gap: 10 },
  stat: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    minHeight: 86,
    padding: 12,
  },
  statLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  statValue: { color: colors.ink, fontSize: 17, fontWeight: "700" },
  projection: {
    backgroundColor: colors.accentSoft,
    borderRadius: 14,
    gap: 7,
    padding: 16,
  },
  projectionLabel: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  projectionText: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  secondary: {
    alignItems: "center",
    borderColor: colors.line,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 50,
  },
  secondaryText: { color: colors.accent, fontSize: 15, fontWeight: "700" },
  recommendation: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 14,
    borderStyle: "dashed",
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  recommendationLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  recommendationText: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  recommendationTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 22,
  },
  shortcuts: { flexDirection: "row", gap: 8 },
  shortcut: {
    borderColor: colors.line,
    borderRadius: 9,
    borderWidth: 1,
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  shortcutSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  shortcutText: { color: colors.accent, fontSize: 14, fontWeight: "700" },
  shortcutTextSelected: { color: colors.panel },
  customRow: { flexDirection: "row", gap: 8 },
  customInput: {
    borderColor: colors.line,
    borderRadius: 9,
    borderWidth: 1,
    color: colors.ink,
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  customButton: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: 9,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 14,
  },
  customButtonText: { color: colors.accent, fontSize: 14, fontWeight: "700" },
  selection: {
    backgroundColor: colors.accentSoft,
    borderRadius: 10,
    gap: 5,
    padding: 12,
  },
  selectionLabel: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  partialButton: {
    alignSelf: "flex-start",
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  manualButton: {
    alignItems: "center",
    borderColor: colors.line,
    borderRadius: 9,
    borderWidth: 1,
    minHeight: 46,
    justifyContent: "center",
  },
  manualList: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    gap: 8,
    paddingTop: 8,
  },
  manualItem: {
    backgroundColor: colors.paper,
    borderRadius: 8,
    gap: 3,
    padding: 10,
  },
  manualTitle: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  manualEstimate: { color: colors.muted, fontSize: 13 },
  loading: { alignItems: "center", gap: 10, padding: 28 },
  muted: { color: colors.muted, fontSize: 14 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  pressed: { opacity: 0.84, transform: [{ translateY: 1 }] },
});
