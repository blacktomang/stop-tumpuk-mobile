import * as WebBrowser from "expo-web-browser";
import { Stack } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";

import {
  decideWebViewNavigation,
  externalBrowserFallback,
} from "../src/application/webview-policy";
import {
  applyProbeEvidenceEvent,
  createProbeEvidence,
  decisionLabel,
  probeSources,
  type ProbeEvidence,
} from "../src/features/reading/webview-feasibility";

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

export default function WebViewProbeScreen() {
  const [selectedId, setSelectedId] = useState(probeSources[0].id);
  const [reloadToken, setReloadToken] = useState(0);
  const [evidenceBySource, setEvidenceBySource] = useState<
    Record<string, ProbeEvidence>
  >(() =>
    Object.fromEntries(
      probeSources.map((source) => [source.id, createProbeEvidence(source.id)]),
    ),
  );
  const [message, setMessage] = useState<string | null>(null);
  const source = probeSources.find((item) => item.id === selectedId)!;
  const evidence = evidenceBySource[selectedId];

  function record(event: Parameters<typeof applyProbeEvidenceEvent>[1]) {
    setEvidenceBySource((current) => ({
      ...current,
      [selectedId]: applyProbeEvidenceEvent(current[selectedId], event),
    }));
  }

  async function openBrowser() {
    const fallback = externalBrowserFallback(source.url);
    if (!fallback) {
      setMessage("Only an HTTP(S) source can be opened in the browser.");
      record({ kind: "error", message: "Invalid browser fallback URL" });
      return;
    }
    try {
      await WebBrowser.openBrowserAsync(fallback.url);
      record({ kind: "external-action", action: "Opened source in browser" });
      setMessage("The source was handed to the system browser.");
    } catch {
      setMessage("The system browser could not open this source.");
      record({ kind: "error", message: "Browser fallback failed" });
    }
  }

  async function handleExternalScheme(url: string, scheme: string) {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) throw new Error("Unavailable");
      await Linking.openURL(url);
      record({ kind: "external-action", action: `Opened ${scheme} link` });
      setMessage(`The ${scheme} link was handed to the operating system.`);
    } catch {
      setMessage(`The ${scheme} link could not be opened.`);
      record({ kind: "error", message: `External ${scheme} link failed` });
    }
  }

  const policy = useMemo(
    () => decideWebViewNavigation(source.url),
    [source.url],
  );

  return (
    <>
      <Stack.Screen options={{ title: "WebView probe" }} />
      <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
        <Text style={styles.eyebrow}>NATIVE-002 / FEASIBILITY</Text>
        <Text style={styles.title}>Test the reading boundary early.</Text>
        <Text style={styles.intro}>
          This probe records what representative remote sources do in a native
          WebView. It is evidence collection, not a reading experience.
        </Text>

        <View style={styles.matrix}>
          <Text style={styles.sectionLabel}>SOURCE MATRIX</Text>
          {probeSources.map((item) => {
            const itemEvidence = evidenceBySource[item.id];
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: item.id === selectedId }}
                key={item.id}
                onPress={() => {
                  setSelectedId(item.id);
                  setMessage(null);
                  setReloadToken((value) => value + 1);
                }}
                style={({ pressed }) => [
                  styles.sourceRow,
                  item.id === selectedId && styles.sourceRowSelected,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.sourceCopy}>
                  <Text style={styles.sourceLabel}>{item.label}</Text>
                  <Text numberOfLines={1} style={styles.sourceUrl}>
                    {item.url}
                  </Text>
                </View>
                <Text style={styles.status}>
                  {statusLabel(itemEvidence.status)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.sourceCopy}>
              <Text style={styles.sectionLabel}>ACTIVE SOURCE</Text>
              <Text style={styles.cardTitle}>{source.label}</Text>
            </View>
            <Text style={styles.policy}>{decisionLabel(policy)}</Text>
          </View>
          <Text style={styles.sourceUrl}>{source.url}</Text>
          <Text style={styles.expected}>{source.expected.navigation}</Text>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progress,
                { width: `${evidence.progress * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {Math.round(evidence.progress * 100)}% ·{" "}
            {statusLabel(evidence.status)}
          </Text>

          {evidence.status === "error" ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>The page did not load</Text>
              <Text style={styles.errorText}>{evidence.errorMessage}</Text>
              <View style={styles.actions}>
                <ProbeButton
                  label="Retry"
                  onPress={() => {
                    setMessage(null);
                    setReloadToken((value) => value + 1);
                  }}
                />
                <ProbeButton
                  label="Open in browser"
                  onPress={() => void openBrowser()}
                  secondary
                />
              </View>
            </View>
          ) : null}

          <View style={styles.webViewFrame}>
            <WebView
              allowsInlineMediaPlayback
              javaScriptEnabled
              key={`${source.id}-${reloadToken}`}
              mediaPlaybackRequiresUserAction
              onError={(event) =>
                record({
                  kind: "error",
                  message:
                    event.nativeEvent.description || "The page could not load.",
                })
              }
              onLoadEnd={(event) =>
                record({ kind: "load-end", url: event.nativeEvent.url })
              }
              onLoadProgress={(event) =>
                record({ kind: "progress", value: event.nativeEvent.progress })
              }
              onLoadStart={() => record({ kind: "load-start" })}
              onNavigationStateChange={(event) =>
                record({ kind: "navigation", url: event.url })
              }
              onShouldStartLoadWithRequest={(request) => {
                const decision = decideWebViewNavigation(request.url);
                if (decision.kind === "allow") return true;
                if (decision.kind === "external") {
                  void handleExternalScheme(decision.url, decision.scheme);
                } else {
                  record({ kind: "error", message: decisionLabel(decision) });
                  setMessage(
                    "This navigation was blocked by the WebView policy.",
                  );
                }
                return false;
              }}
              originWhitelist={["http://*", "https://*"]}
              renderLoading={() => (
                <View style={styles.loading}>
                  <ActivityIndicator color={colors.accent} />
                  <Text style={styles.muted}>Loading remote source…</Text>
                </View>
              )}
              source={{ uri: source.url }}
              startInLoadingState
              style={styles.webView}
            />
          </View>

          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.evidenceGrid}>
            <Evidence
              label="Navigations"
              value={String(evidence.navigationCount)}
            />
            <Evidence label="Last URL" value={evidence.lastUrl ?? "—"} />
            <Evidence
              label="Media"
              value={evidence.mediaObserved ? "Observed" : "Not observed"}
            />
            <Evidence
              label="Access UI"
              value={evidence.loginObserved ? "Observed" : "Not observed"}
            />
          </View>
          <Text style={styles.expected}>{source.expected.loading}</Text>
          <Text style={styles.expected}>{source.expected.media}</Text>
          <Text style={styles.expected}>{source.expected.access}</Text>
          <Text style={styles.expected}>{source.expected.fallback}</Text>
          <ProbeButton
            label="Open active source in browser"
            onPress={() => void openBrowser()}
            secondary
          />
        </View>
      </ScrollView>
    </>
  );
}

function Evidence({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.evidence}>
      <Text style={styles.evidenceLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.evidenceValue}>
        {value}
      </Text>
    </View>
  );
}

function ProbeButton({
  label,
  onPress,
  secondary = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        secondary ? styles.secondaryButton : styles.primaryButton,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={
          secondary ? styles.secondaryButtonText : styles.primaryButtonText
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}

function statusLabel(status: ProbeEvidence["status"]): string {
  return status === "not-run"
    ? "Not run"
    : status[0].toUpperCase() + status.slice(1);
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper },
  content: { padding: 20, gap: 16 },
  eyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  title: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  intro: { color: colors.muted, fontSize: 16, lineHeight: 23 },
  matrix: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  sectionLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  sourceRow: {
    alignItems: "center",
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    padding: 15,
  },
  sourceRowSelected: { backgroundColor: colors.accentSoft },
  sourceCopy: { flex: 1, gap: 4 },
  sourceLabel: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  sourceUrl: { color: colors.muted, fontSize: 12 },
  status: { color: colors.accent, fontSize: 11, fontWeight: "700" },
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  cardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  cardTitle: { color: colors.ink, fontSize: 21, fontWeight: "800" },
  policy: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "right",
  },
  expected: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  progressTrack: {
    backgroundColor: colors.line,
    borderRadius: 4,
    height: 6,
    overflow: "hidden",
  },
  progress: { backgroundColor: colors.accent, height: 6 },
  progressText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  webViewFrame: {
    backgroundColor: "#E9EDE8",
    borderColor: colors.line,
    borderRadius: 12,
    height: 360,
    overflow: "hidden",
  },
  webView: { flex: 1 },
  loading: {
    alignItems: "center",
    backgroundColor: colors.paper,
    flex: 1,
    gap: 10,
    justifyContent: "center",
  },
  muted: { color: colors.muted, fontSize: 13 },
  errorBox: {
    backgroundColor: "#FBEDEA",
    borderRadius: 12,
    gap: 8,
    padding: 12,
  },
  errorTitle: { color: colors.danger, fontSize: 15, fontWeight: "800" },
  errorText: { color: colors.ink, fontSize: 13 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 10,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  secondaryButton: {
    alignItems: "center",
    borderColor: colors.line,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  secondaryButtonText: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  pressed: { opacity: 0.72 },
  message: { color: colors.ink, fontSize: 13, lineHeight: 19 },
  evidenceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  evidence: {
    backgroundColor: colors.paper,
    borderRadius: 10,
    gap: 3,
    minWidth: "46%",
    padding: 10,
  },
  evidenceLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  evidenceValue: { color: colors.ink, fontSize: 12 },
});
