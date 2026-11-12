/**
 * The WebView is a reader for remote pages, not a general-purpose bridge into
 * the app. Keep navigation decisions pure so the native adapter can apply
 * them with WebView callbacks and Linking/browser APIs.
 */

export type WebViewNavigationDecision =
  | { kind: 'allow'; url: string }
  | { kind: 'external'; url: string; scheme: string }
  | {
      kind: 'block';
      url: string;
      reason: 'malformed-url' | 'unsafe-scheme';
    };

export interface ExternalBrowserFallback {
  kind: 'external-browser';
  url: string;
}

const allowedWebViewProtocols = new Set(['http:', 'https:']);

// These schemes can contain executable content or address local app/device
// resources. They must never be handed to an external app automatically.
const blockedProtocols = new Set([
  'about:',
  'blob:',
  'chrome-extension:',
  'chrome:',
  'data:',
  'file:',
  'javascript:',
  'view-source:',
]);

function parseUrl(rawUrl: string): URL | null {
  if (typeof rawUrl !== 'string' || rawUrl.trim() === '') return null;
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

/** Decide whether a navigation stays in the reader or leaves it. */
export function decideWebViewNavigation(rawUrl: string): WebViewNavigationDecision {
  const parsed = parseUrl(rawUrl);
  if (!parsed) {
    return { kind: 'block', url: rawUrl, reason: 'malformed-url' };
  }

  const url = parsed.toString();
  if (allowedWebViewProtocols.has(parsed.protocol)) {
    // HTTP(S) redirects are intentionally treated the same as initial loads.
    // The native adapter may still apply host/content-specific UI policy.
    return { kind: 'allow', url };
  }

  if (blockedProtocols.has(parsed.protocol)) {
    return { kind: 'block', url, reason: 'unsafe-scheme' };
  }

  // mailto:, tel:, intent:, and app-defined schemes are explicit hand-offs to
  // the operating system. The adapter must confirm availability and report
  // failures; this policy never invokes an external application itself.
  return { kind: 'external', url, scheme: parsed.protocol.slice(0, -1) };
}

/**
 * Build the intent used by an external-browser fallback. Only a valid HTTP(S)
 * URL can be opened in a browser; OS schemes use the external-scheme branch.
 */
export function externalBrowserFallback(rawUrl: string): ExternalBrowserFallback | null {
  const parsed = parseUrl(rawUrl);
  if (!parsed || !allowedWebViewProtocols.has(parsed.protocol)) return null;
  return { kind: 'external-browser', url: parsed.toString() };
}
