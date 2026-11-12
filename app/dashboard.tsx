import { Stack, router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { createPlanningService } from "../src/application/planning-service";
import type { CapacityViewModel } from "../src/domain";
import {
  capacityProjection,
  presentCapacity,
} from "../src/features/dashboard/capacity-presenter";
import { CapacityMeter } from "../src/features/dashboard/capacity-meter";
import { openNativeRepositories } from "../src/storage/sqlite/expo-sqlite-adapter";

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

  useEffect(() => {
    let mounted = true;
    openNativeRepositories()
      .then((repositories) =>
        createPlanningService({ repositories }).getCapacity(),
      )
      .then((nextCapacity) => {
        if (mounted) setCapacity(nextCapacity);
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

  const presentation = capacity ? presentCapacity(capacity) : null;

  return (
    <>
      <Stack.Screen
        options={{ title: "Dashboard", headerBackTitle: "Capture" }}
      />
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

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: true }}
              disabled
              style={styles.recommendation}
            >
              <View style={styles.recommendationCopy}>
                <Text style={styles.recommendationLabel}>
                  NEXT RECOMMENDATION
                </Text>
                <Text style={styles.recommendationText}>
                  One fitting item will live here next.
                </Text>
              </View>
              <Text style={styles.comingSoon}>COMING SOON</Text>
            </Pressable>
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
    flexDirection: "row",
    gap: 14,
    justifyContent: "space-between",
    padding: 16,
  },
  recommendationCopy: { flex: 1, gap: 5 },
  recommendationLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  recommendationText: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  comingSoon: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  loading: { alignItems: "center", gap: 10, padding: 28 },
  muted: { color: colors.muted, fontSize: 14 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  pressed: { opacity: 0.84, transform: [{ translateY: 1 }] },
});
