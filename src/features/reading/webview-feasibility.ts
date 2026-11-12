import type { WebViewNavigationDecision } from "../../application/webview-policy";

export type ProbeSourceKind =
  "public-article" | "medium-style" | "public-video" | "login-paywall";

export type ProbeEvidenceStatus =
  "not-run" | "loading" | "loaded" | "error" | "external";

export interface ProbeExpectedObservation {
  navigation: string;
  loading: string;
  media: string;
  access: string;
  fallback: string;
}

export interface ProbeSource {
  id: string;
  kind: ProbeSourceKind;
  label: string;
  url: string;
  expected: ProbeExpectedObservation;
}

export interface ProbeEvidence {
  sourceId: string;
  status: ProbeEvidenceStatus;
  progress: number;
  loadStarted: boolean;
  navigationCount: number;
  lastUrl: string | null;
  mediaObserved: boolean;
  loginObserved: boolean;
  externalAction: string | null;
  errorMessage: string | null;
}

export type ProbeEvidenceEvent =
  | { kind: "load-start" }
  | { kind: "progress"; value: number }
  | { kind: "navigation"; url: string }
  | { kind: "load-end"; url: string }
  | { kind: "media-observed" }
  | { kind: "login-observed" }
  | { kind: "external-action"; action: string }
  | { kind: "error"; message: string };

export const probeSources: ProbeSource[] = [
  {
    id: "public-article",
    kind: "public-article",
    label: "Public article",
    url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
    expected: {
      navigation: "HTTP(S) page should remain inside the WebView.",
      loading: "Show progress while the document and its assets load.",
      media: "Text content should be readable; no video is required.",
      access: "No login is expected for this public reference page.",
      fallback: "Open in the system browser if loading fails.",
    },
  },
  {
    id: "medium-style",
    kind: "medium-style",
    label: "Medium-style article",
    url: "https://medium.com/",
    expected: {
      navigation:
        "Record redirects and keep HTTP(S) navigation in the WebView.",
      loading: "A redirect or script-heavy load must remain recoverable.",
      media: "Observe whether the article shell and images render on mobile.",
      access: "The host may show sign-in prompts or omit article content.",
      fallback:
        "Browser fallback must remain available for an incompatible page.",
    },
  },
  {
    id: "public-video",
    kind: "public-video",
    label: "Public YouTube video",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    expected: {
      navigation: "HTTP(S) video navigation should stay inside the WebView.",
      loading: "Show progress and recover from an embed or network error.",
      media: "Record whether the player shell loads and playback is available.",
      access: "A public video may still show consent, age, or region prompts.",
      fallback: "Use the system browser when the player cannot work in-app.",
    },
  },
  {
    id: "login-paywall",
    kind: "login-paywall",
    label: "Login / paywall example",
    url: "https://www.nytimes.com/",
    expected: {
      navigation: "HTTP(S) navigation is allowed but does not imply access.",
      loading:
        "A blocked, challenge, or partial load must show a recoverable state.",
      media: "Do not assume embeds or media work behind authentication.",
      access:
        "Record login, consent, paywall, or anti-bot UI without credentials.",
      fallback:
        "Browser fallback is the supported escape hatch for blocked access.",
    },
  },
];

export function createProbeEvidence(sourceId: string): ProbeEvidence {
  return {
    sourceId,
    status: "not-run",
    progress: 0,
    loadStarted: false,
    navigationCount: 0,
    lastUrl: null,
    mediaObserved: false,
    loginObserved: false,
    externalAction: null,
    errorMessage: null,
  };
}

export function applyProbeEvidenceEvent(
  evidence: ProbeEvidence,
  event: ProbeEvidenceEvent,
): ProbeEvidence {
  switch (event.kind) {
    case "load-start":
      return {
        ...evidence,
        status: "loading",
        loadStarted: true,
        errorMessage: null,
      };
    case "progress":
      return { ...evidence, progress: clampProgress(event.value) };
    case "navigation":
      return {
        ...evidence,
        status: "loading",
        navigationCount: evidence.navigationCount + 1,
        lastUrl: event.url,
      };
    case "load-end":
      return {
        ...evidence,
        status: "loaded",
        progress: 1,
        lastUrl: event.url,
        errorMessage: null,
      };
    case "media-observed":
      return { ...evidence, mediaObserved: true };
    case "login-observed":
      return { ...evidence, loginObserved: true };
    case "external-action":
      return { ...evidence, status: "external", externalAction: event.action };
    case "error":
      return { ...evidence, status: "error", errorMessage: event.message };
  }
}

export function decisionLabel(decision: WebViewNavigationDecision): string {
  switch (decision.kind) {
    case "allow":
      return "Stay in WebView";
    case "external":
      return `External ${decision.scheme} link`;
    case "block":
      if (decision.reason === "unsafe-scheme") return "Blocked unsafe scheme";
      if (decision.reason === "unsupported-scheme") {
        return "Blocked unsupported scheme";
      }
      return "Blocked malformed URL";
  }
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
