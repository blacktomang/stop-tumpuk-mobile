/**
 * The WebView is a reader for remote pages, not a general-purpose bridge into
 * the app. Keep navigation decisions pure so the native adapter can apply
 * them with WebView callbacks and Linking/browser APIs.
 */

export type WebViewNavigationDecision =
  | { kind: "allow"; url: string }
  | { kind: "external"; url: string; scheme: string }
  | {
      kind: "block";
      url: string;
      reason: "malformed-url" | "unsafe-scheme" | "unsupported-scheme";
    };

export interface ExternalBrowserFallback {
  kind: "external-browser";
  url: string;
}

const allowedWebViewProtocols = new Set(["http:", "https:"]);

// These schemes can contain executable content or address local app/device
// resources. They must never be handed to an external app automatically.
const blockedProtocols = new Set([
  "about:",
  "blob:",
  "chrome-extension:",
  "chrome:",
  "data:",
  "file:",
  "javascript:",
  "view-source:",
]);

// Only schemes whose destination is an ordinary user-facing OS action are
// handed to Linking. Unknown schemes are blocked at the WebView boundary;
// they may be app links, intent payloads, or executable/deep-link content.
const externalProtocols = new Set(["geo:", "mailto:", "sms:", "tel:"]);

export const readingWebViewOriginWhitelist: ["http://*", "https://*"] = [
  "http://*",
  "https://*",
];

export interface ReadingWebViewConfiguration {
  allowsInlineMediaPlayback: true;
  javaScriptEnabled: true;
  mediaPlaybackRequiresUserAction: true;
  originWhitelist: ["http://*", "https://*"];
  source: { uri: string };
}

/**
 * Keep the WebView configuration deliberately data-only. In particular, this
 * does not provide injected JavaScript, an onMessage bridge, or app data.
 */
export function createReadingWebViewConfiguration(
  url: string,
): ReadingWebViewConfiguration {
  return {
    allowsInlineMediaPlayback: true,
    javaScriptEnabled: true,
    mediaPlaybackRequiresUserAction: true,
    originWhitelist: readingWebViewOriginWhitelist,
    source: { uri: url },
  };
}

function parseUrl(rawUrl: unknown): URL | null {
  if (typeof rawUrl !== "string" || rawUrl.trim() === "") return null;
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

/** Decide whether a navigation stays in the reader or leaves it. */
export function decideWebViewNavigation(
  rawUrl: unknown,
): WebViewNavigationDecision {
  const parsed = parseUrl(rawUrl);
  const originalUrl = typeof rawUrl === "string" ? rawUrl : "";
  if (!parsed) {
    return { kind: "block", url: originalUrl, reason: "malformed-url" };
  }

  const url = parsed.toString();
  if (allowedWebViewProtocols.has(parsed.protocol)) {
    // HTTP(S) redirects are intentionally treated the same as initial loads.
    // The native adapter may still apply host/content-specific UI policy.
    return { kind: "allow", url };
  }

  if (blockedProtocols.has(parsed.protocol)) {
    return { kind: "block", url, reason: "unsafe-scheme" };
  }

  if (externalProtocols.has(parsed.protocol)) {
    // The adapter must confirm availability and report failures; this policy
    // never invokes an external application itself.
    return { kind: "external", url, scheme: parsed.protocol.slice(0, -1) };
  }

  return { kind: "block", url, reason: "unsupported-scheme" };
}

/**
 * Build the intent used by an external-browser fallback. Only a valid HTTP(S)
 * URL can be opened in a browser; OS schemes use the external-scheme branch.
 */
export function externalBrowserFallback(
  rawUrl: unknown,
): ExternalBrowserFallback | null {
  const parsed = parseUrl(rawUrl);
  if (!parsed || !allowedWebViewProtocols.has(parsed.protocol)) return null;
  return { kind: "external-browser", url: parsed.toString() };
}

export interface ExternalLinkingAdapter {
  canOpenURL(url: string): Promise<boolean>;
  openURL(url: string): Promise<unknown>;
}

export type ExternalLinkResult =
  { status: "opened" } | { status: "unavailable" } | { status: "failed" };

export async function openExternalLink(
  decision: Extract<WebViewNavigationDecision, { kind: "external" }>,
  linking: ExternalLinkingAdapter,
): Promise<ExternalLinkResult> {
  try {
    if (!(await linking.canOpenURL(decision.url))) {
      return { status: "unavailable" };
    }
    await linking.openURL(decision.url);
    return { status: "opened" };
  } catch {
    return { status: "failed" };
  }
}

export interface ExternalBrowserAdapter {
  openBrowserAsync(url: string): Promise<unknown>;
}

export type BrowserFallbackResult =
  | { status: "opened" }
  | { status: "cancelled" }
  | { status: "invalid-url" }
  | { status: "failed" };

export async function openBrowserFallback(
  rawUrl: unknown,
  browser: ExternalBrowserAdapter,
): Promise<BrowserFallbackResult> {
  const fallback = externalBrowserFallback(rawUrl);
  if (!fallback) return { status: "invalid-url" };

  try {
    const result = await browser.openBrowserAsync(fallback.url);
    const resultType =
      typeof result === "object" && result !== null && "type" in result
        ? result.type
        : undefined;
    if (resultType === "cancel" || resultType === "dismiss") {
      return { status: "cancelled" };
    }
    return { status: "opened" };
  } catch {
    return { status: "failed" };
  }
}
