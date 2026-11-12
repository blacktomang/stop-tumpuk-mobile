import * as WebBrowser from "expo-web-browser";
import { router, Stack, useLocalSearchParams } from "expo-router";
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
import { WebView, type WebViewNavigation } from "react-native-webview";

import {
  decideWebViewNavigation,
  externalBrowserFallback,
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
    const fallback = externalBrowserFallback(url);
    if (!fallback) {
      setMessage("This source cannot be handed to the system browser.");
      return;
    }
    try {
      await WebBrowser.openBrowserAsync(fallback.url);
    } catch {
      setMessage("The system browser could not open this source.");
    }
  }

  function handleExternalNavigation(navigation: WebViewNavigation) {
    const decision = decideWebViewNavigation(navigation.url);
    if (decision.kind === "allow") return true;
    if (decision.kind === "block") {
      setMessage("This navigation was blocked by the reading policy.");
      return false;
    }
    void (async () => {
      try {
        const canOpen = await Linking.canOpenURL(decision.url);
        if (!canOpen) throw new Error("Unavailable");
        await Linking.openURL(decision.url);
        setMessage(`Opened the ${decision.scheme} link outside the reader.`);
      } catch {
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
                allowsInlineMediaPlayback
                javaScriptEnabled
                key={`${url}-${reloadToken}`}
                mediaPlaybackRequiresUserAction
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
                originWhitelist={["http://*", "https://*"]}
                renderLoading={() => (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator color={colors.accent} />
                    <Text style={styles.muted}>Loading source…</Text>
                  </View>
                )}
                source={{ uri: url }}
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
          <Text style={styles.placeholder}>
            Finish is explicit and remains available from the material actions.
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
  placeholder: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },
  pressed: { opacity: 0.75 },
});
