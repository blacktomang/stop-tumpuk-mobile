import * as WebBrowser from "expo-web-browser";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { AppState } from "react-native";
import { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView, type WebViewNavigation } from "react-native-webview";

import {
  createReadingWebViewConfiguration,
  decideWebViewNavigation,
  openBrowserFallback,
  openExternalLink,
} from "../src/application/webview-policy";
import {
  initialReadingState,
  readingLoadFailed,
  readingLoadFinished,
  readingLoadStarted,
  readingProgressChanged,
  validateReadingUrl,
  type ReadingState,
} from "../src/features/reading/reading-state";
import {
  createTimerController,
  initialTimerSnapshot,
  type TimerSnapshot,
} from "../src/features/reading/timer-controller";
import {
  formatFocusTime,
  timerMessage,
  timerTitle,
} from "../src/features/reading/timer-presenter";
import { createLifecycleService } from "../src/application/lifecycle-service";
import { openNativeRepositories } from "../src/storage/sqlite/expo-sqlite-adapter";
import { randomUUID } from "expo-crypto";
import type { NativeRepositories } from "../src/storage/sqlite/repositories";
import type { MaterialStatus } from "../src/types";

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

function textParam(value: string | string[] | undefined, fallback: string) {
  return typeof value === "string" && value.trim() !== "" ? value : fallback;
}

export default function ReadingScreen() {
  const params = useLocalSearchParams<{
    materialId?: string;
    url?: string;
    title?: string;
    estimate?: string;
    domain?: string;
  }>();
  const url = useMemo(() => validateReadingUrl(params.url), [params.url]);
  const title = textParam(params.title, "Reading");
  const estimate = textParam(params.estimate, "Time not estimated yet");
  const domain = textParam(params.domain, url ? new URL(url).hostname : "");
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState<ReadingState>(initialReadingState);
  const [message, setMessage] = useState<string | null>(null);
  const [materialStatus, setMaterialStatus] = useState<MaterialStatus | null>(
    null,
  );
  const [isFinishing, setIsFinishing] = useState(false);
  const [repositories, setRepositories] = useState<NativeRepositories | null>(
    null,
  );
  const [timerSnapshot, setTimerSnapshot] =
    useState<TimerSnapshot>(initialTimerSnapshot);
  const timerControllerRef = useRef<ReturnType<
    typeof createTimerController
  > | null>(null);

  useEffect(() => {
    let mounted = true;
    openNativeRepositories()
      .then((nextRepositories) => {
        if (!mounted) return;
        setRepositories(nextRepositories);
        if (typeof params.materialId === "string") {
          void nextRepositories.materials
            .get(params.materialId)
            .then((material) => {
              if (mounted) setMaterialStatus(material?.status ?? null);
            });
        }
      })
      .catch(() => {
        if (mounted)
          setMessage(
            "Local storage is unavailable. Timer state cannot be loaded.",
          );
      });
    return () => {
      mounted = false;
    };
  }, [params.materialId]);

  useEffect(() => {
    if (!repositories || typeof params.materialId !== "string") return;
    const controller = createTimerController({
      repositories,
      materialId: params.materialId,
      generateId: randomUUID,
      now: () => new Date().toISOString(),
      appState: AppState,
    });
    timerControllerRef.current = controller;
    const unsubscribe = controller.subscribe(setTimerSnapshot);
    void controller.load();
    return () => {
      unsubscribe();
      controller.dispose();
      timerControllerRef.current = null;
    };
  }, [params.materialId, repositories]);

  async function runTimerAction(action: "start" | "pause" | "resume" | "end") {
    const controller = timerControllerRef.current;
    if (!controller) return;
    setMessage(null);
    try {
      await controller[action]();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The timer action failed.",
      );
    }
  }

  function retry() {
    setMessage(null);
    setState(readingLoadStarted());
    setReloadToken((current) => current + 1);
  }

  async function openBrowser() {
    if (!url) {
      setMessage("Only a saved HTTP(S) source can be opened in a browser.");
      return;
    }
    const result = await openBrowserFallback(url, WebBrowser);
    if (result.status === "invalid-url") {
      setMessage("This source cannot be handed to the system browser.");
    } else if (result.status === "cancelled") {
      setMessage("Opening the system browser was cancelled.");
    } else if (result.status === "failed") {
      setMessage("The system browser could not open this source.");
    }
  }

  async function finishMaterial() {
    if (!repositories || typeof params.materialId !== "string") {
      setMessage("This material cannot be finished from the reader.");
      return;
    }
    if (materialStatus !== "queued" && materialStatus !== "in-progress") {
      setMessage("Only an active Reading plan item can be finished.");
      return;
    }
    setIsFinishing(true);
    setMessage(null);
    try {
      await createLifecycleService({
        repositories,
        generateId: randomUUID,
        now: () => new Date().toISOString(),
      }).finish(params.materialId);
      router.back();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The material could not be finished. Try again.",
      );
    } finally {
      setIsFinishing(false);
    }
  }

  function handleExternalNavigation(navigation: WebViewNavigation) {
    const decision = decideWebViewNavigation(navigation.url);
    if (decision.kind === "allow") return true;
    if (decision.kind === "block") {
      setMessage(
        decision.reason === "unsafe-scheme"
          ? "This unsafe navigation was blocked by the reading policy."
          : decision.reason === "unsupported-scheme"
            ? "This unsupported link was blocked by the reading policy."
            : "This malformed navigation was blocked by the reading policy.",
      );
      return false;
    }
    void (async () => {
      const result = await openExternalLink(decision, Linking);
      if (result.status === "opened") {
        setMessage(`Opened the ${decision.scheme} link outside the reader.`);
      } else if (result.status === "unavailable") {
        setMessage(`No app is available to open the ${decision.scheme} link.`);
      } else {
        setMessage(`The ${decision.scheme} link could not be opened.`);
      }
    })();
    return false;
  }

  return (
    <>
      <Stack.Screen
        options={{ title: "Reading", headerBackTitle: "Materials" }}
      />
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text numberOfLines={2} style={styles.title}>
            {title}
          </Text>
          <Text style={styles.estimate}>{estimate}</Text>
          {domain ? <Text style={styles.domain}>{domain}</Text> : null}
          {url ? (
            <Text numberOfLines={1} style={styles.url}>
              {url}
            </Text>
          ) : null}
        </View>

        <TimerPanel
          snapshot={timerSnapshot}
          onEnd={() => void runTimerAction("end")}
          onPause={() => void runTimerAction("pause")}
          onResume={() => void runTimerAction("resume")}
          onStart={() => void runTimerAction("start")}
        />

        {!url ? (
          <StatePanel
            message="This reading link is missing or is not an HTTP(S) URL. Return to Materials and open a saved source."
            onBack={() => router.back()}
            title="Source unavailable"
          />
        ) : (
          <View style={styles.reader}>
            {state.phase === "loading" ? (
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progress,
                    { width: `${state.progress * 100}%` },
                  ]}
                />
              </View>
            ) : null}
            {state.phase === "error" ? (
              <StatePanel
                message={
                  state.errorMessage ?? "The source could not be loaded."
                }
                onBack={() => router.back()}
                onBrowser={() => void openBrowser()}
                onRetry={retry}
                title="This page did not load"
              />
            ) : (
              <WebView
                {...createReadingWebViewConfiguration(url)}
                key={`${url}-${reloadToken}`}
                onError={(event) =>
                  setState((current) =>
                    readingLoadFailed(
                      current,
                      event.nativeEvent.description ||
                        "The source could not be loaded in the reader.",
                    ),
                  )
                }
                onLoadEnd={() => setState(readingLoadFinished)}
                onLoadProgress={(event) =>
                  setState((current) =>
                    readingProgressChanged(current, event.nativeEvent.progress),
                  )
                }
                onLoadStart={() => setState(readingLoadStarted())}
                onShouldStartLoadWithRequest={handleExternalNavigation}
                renderLoading={() => (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator color={colors.accent} />
                    <Text style={styles.muted}>Loading source…</Text>
                  </View>
                )}
                startInLoadingState
                style={styles.webView}
              />
            )}
            {message ? (
              <Text accessibilityRole="alert" style={styles.message}>
                {message}
              </Text>
            ) : null}
          </View>
        )}
        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.secondary,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.secondaryText}>Back to Materials</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => void openBrowser()}
            style={({ pressed }) => [
              styles.secondary,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.secondaryText}>Open in browser</Text>
          </Pressable>
          {materialStatus === "queued" || materialStatus === "in-progress" ? (
            <Pressable
              accessibilityRole="button"
              disabled={isFinishing}
              onPress={() => void finishMaterial()}
              style={({ pressed }) => [
                styles.primary,
                pressed && styles.pressed,
                isFinishing && styles.disabled,
              ]}
            >
              {isFinishing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryText}>Finish</Text>
              )}
            </Pressable>
          ) : null}
          <Text style={styles.placeholder}>
            Opening, browsing, scrolling, playback, errors, and timer expiry
            never finish a material.
          </Text>
        </View>
      </View>
    </>
  );
}

function StatePanel({
  message,
  onBack,
  onBrowser,
  onRetry,
  title,
}: {
  message: string;
  onBack: () => void;
  onBrowser?: () => void;
  onRetry?: () => void;
  title: string;
}) {
  return (
    <View style={styles.statePanel}>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateMessage}>{message}</Text>
      <View style={styles.stateActions}>
        {onRetry ? (
          <Pressable
            accessibilityRole="button"
            onPress={onRetry}
            style={styles.primary}
          >
            <Text style={styles.primaryText}>Retry</Text>
          </Pressable>
        ) : null}
        {onBrowser ? (
          <Pressable
            accessibilityRole="button"
            onPress={onBrowser}
            style={styles.secondary}
          >
            <Text style={styles.secondaryText}>Open in browser</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          style={styles.secondary}
        >
          <Text style={styles.secondaryText}>Back</Text>
        </Pressable>
      </View>
    </View>
  );
}

function TimerPanel({
  snapshot,
  onEnd,
  onPause,
  onResume,
  onStart,
}: {
  snapshot: TimerSnapshot;
  onEnd: () => void;
  onPause: () => void;
  onResume: () => void;
  onStart: () => void;
}) {
  const hasSession = snapshot.session !== null;
  const action = snapshot.phase === "running" ? onPause : onResume;
  const actionLabel = snapshot.phase === "running" ? "Pause" : "Resume";
  return (
    <View style={styles.timerPanel} accessibilityRole="summary">
      <View style={styles.timerCopy}>
        <Text style={styles.timerEyebrow}>OPTIONAL FOCUS</Text>
        <Text style={styles.timerTitle}>{timerTitle(snapshot.phase)}</Text>
        <Text style={styles.timerMessage}>{timerMessage(snapshot.phase)}</Text>
      </View>
      {snapshot.phase === "loading" ? (
        <ActivityIndicator color={colors.accent} />
      ) : snapshot.phase === "error" ? null : (
        <View style={styles.timerActions}>
          {hasSession && snapshot.phase !== "idle" ? (
            <Text accessibilityLiveRegion="polite" style={styles.timerValue}>
              {formatFocusTime(snapshot.remainingSeconds)}
            </Text>
          ) : null}
          {!hasSession || snapshot.phase === "idle" ? (
            <Pressable
              accessibilityRole="button"
              onPress={onStart}
              style={({ pressed }) => [
                styles.primary,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.primaryText}>Start 25 minutes</Text>
            </Pressable>
          ) : snapshot.phase === "expired" ? (
            <Pressable
              accessibilityRole="button"
              onPress={onEnd}
              style={({ pressed }) => [
                styles.secondary,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.secondaryText}>End timer</Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                accessibilityRole="button"
                onPress={action}
                style={({ pressed }) => [
                  styles.primary,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.primaryText}>{actionLabel}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={onEnd}
                style={({ pressed }) => [
                  styles.secondary,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.secondaryText}>End</Text>
              </Pressable>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, flex: 1 },
  header: {
    backgroundColor: colors.panel,
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    gap: 5,
    padding: 18,
  },
  title: { color: colors.ink, fontSize: 20, fontWeight: "800" },
  estimate: { color: colors.accent, fontSize: 14, fontWeight: "700" },
  domain: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  url: { color: colors.muted, fontSize: 12 },
  reader: { backgroundColor: colors.panel, flex: 1, minHeight: 300 },
  webView: { flex: 1 },
  progressTrack: { backgroundColor: colors.line, height: 3, width: "100%" },
  progress: { backgroundColor: colors.accent, height: 3 },
  loadingOverlay: {
    alignItems: "center",
    backgroundColor: colors.panel,
    flex: 1,
    gap: 10,
    justifyContent: "center",
  },
  muted: { color: colors.muted },
  statePanel: {
    alignItems: "center",
    backgroundColor: colors.panel,
    flex: 1,
    gap: 14,
    justifyContent: "center",
    padding: 28,
  },
  stateTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  stateMessage: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  stateActions: { alignItems: "stretch", gap: 10, width: "100%" },
  footer: { backgroundColor: colors.paper, gap: 10, padding: 18 },
  primary: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 10,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryText: { color: "#FFFFFF", fontWeight: "800" },
  secondary: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: 10,
    minHeight: 46,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  secondaryText: { color: colors.accent, fontWeight: "800" },
  message: {
    backgroundColor: colors.accentSoft,
    color: colors.ink,
    padding: 10,
  },
  timerPanel: {
    alignItems: "center",
    backgroundColor: colors.ink,
    flexDirection: "row",
    gap: 14,
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  timerCopy: { flex: 1, gap: 3 },
  timerEyebrow: {
    color: "#AFC7B4",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  timerTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  timerMessage: { color: "#D8E4D9", fontSize: 12, lineHeight: 17 },
  timerActions: { alignItems: "flex-end", gap: 8, minWidth: 116 },
  timerValue: {
    color: "#FFFFFF",
    fontSize: 28,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  placeholder: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.55 },
});
