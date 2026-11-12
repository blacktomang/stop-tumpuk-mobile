import { describe, expect, it } from "vitest";
import {
  createReadingWebViewConfiguration,
  decideWebViewNavigation,
  externalBrowserFallback,
  openBrowserFallback,
  openExternalLink,
} from "./webview-policy";

describe("decideWebViewNavigation", () => {
  it.each(["http://example.com/article", "https://example.com/article"])(
    "allows %s in the WebView",
    (url) => {
      expect(decideWebViewNavigation(url)).toEqual({ kind: "allow", url });
    },
  );

  it("allows an HTTP(S) redirect using the redirected URL", () => {
    expect(
      decideWebViewNavigation("https://reader.example/redirected?from=source"),
    ).toEqual({
      kind: "allow",
      url: "https://reader.example/redirected?from=source",
    });
  });

  it.each([
    ["http://reader.example/redirected", "allow"],
    ["https://reader.example/redirected", "allow"],
    ["mailto:reader@example.com", "external"],
    ["javascript:alert(1)", "block"],
    ["data:text/html,unsafe", "block"],
  ])(
    "applies the same scheme boundary to a redirected URL: %s",
    (url, kind) => {
      expect(decideWebViewNavigation(url).kind).toBe(kind);
    },
  );

  it.each([
    ["mailto:hello@example.com", "mailto"],
    ["tel:+628123456789", "tel"],
    ["sms:+628123456789", "sms"],
    ["geo: Jakarta", "geo"],
  ])("hands %s to the external-scheme adapter", (url, scheme) => {
    expect(decideWebViewNavigation(url)).toMatchObject({
      kind: "external",
      url,
      scheme,
    });
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,unsafe",
    "file:///private/data",
    "blob:https://example.com/id",
    "about:blank",
  ])("blocks unsafe scheme %s", (url) => {
    expect(decideWebViewNavigation(url)).toMatchObject({
      kind: "block",
      reason: "unsafe-scheme",
    });
  });

  it.each([
    "intent://open/article#Intent;scheme=https;end",
    "stop-tumpuk://capture?url=https%3A%2F%2Fexample.com",
    "ftp://example.com/file",
  ])("blocks unsupported scheme %s", (url) => {
    expect(decideWebViewNavigation(url)).toMatchObject({
      kind: "block",
      reason: "unsupported-scheme",
    });
  });

  it("does not pass non-HTTP(S) redirects into the WebView", () => {
    expect(decideWebViewNavigation("mailto:reader@example.com")).toMatchObject({
      kind: "external",
    });
    expect(decideWebViewNavigation("javascript:alert(1)")).toMatchObject({
      kind: "block",
    });
  });

  it.each(["", "not a URL", "https://"])("blocks malformed URL %j", (url) => {
    expect(decideWebViewNavigation(url)).toEqual({
      kind: "block",
      url,
      reason: "malformed-url",
    });
  });
});

describe("externalBrowserFallback", () => {
  it("creates a browser intent for HTTP(S)", () => {
    expect(externalBrowserFallback("https://example.com/article")).toEqual({
      kind: "external-browser",
      url: "https://example.com/article",
    });
  });

  it.each([
    "mailto:hello@example.com",
    "tel:+628123456789",
    "javascript:alert(1)",
    "not a URL",
  ])("does not create a browser intent for %s", (url) => {
    expect(externalBrowserFallback(url)).toBeNull();
  });
});

describe("reading route boundary", () => {
  it("configures an HTTP(S)-only WebView without a bridge or app payload", () => {
    expect(
      createReadingWebViewConfiguration("https://example.com/article"),
    ).toEqual({
      allowsInlineMediaPlayback: true,
      javaScriptEnabled: true,
      mediaPlaybackRequiresUserAction: true,
      originWhitelist: ["http://*", "https://*"],
      source: { uri: "https://example.com/article" },
    });
  });

  it("reports unavailable and thrown external-link failures", async () => {
    const decision = decideWebViewNavigation("mailto:reader@example.com");
    if (decision.kind !== "external") throw new Error("expected external");

    await expect(
      openExternalLink(decision, {
        canOpenURL: async () => false,
        openURL: async () => undefined,
      }),
    ).resolves.toEqual({ status: "unavailable" });
    await expect(
      openExternalLink(decision, {
        canOpenURL: async () => true,
        openURL: async () => {
          throw new Error("link failed");
        },
      }),
    ).resolves.toEqual({ status: "failed" });
  });

  it("reports browser cancellation, failure, and invalid fallback", async () => {
    await expect(
      openBrowserFallback("https://example.com", {
        openBrowserAsync: async () => ({ type: "cancel" }),
      }),
    ).resolves.toEqual({ status: "cancelled" });
    await expect(
      openBrowserFallback("https://example.com", {
        openBrowserAsync: async () => {
          throw new Error("browser unavailable");
        },
      }),
    ).resolves.toEqual({ status: "failed" });
    await expect(
      openBrowserFallback("javascript:alert(1)", {
        openBrowserAsync: async () => undefined,
      }),
    ).resolves.toEqual({ status: "invalid-url" });
    await expect(
      openBrowserFallback("https://example.com", {
        openBrowserAsync: async () => ({ type: "dismiss" }),
      }),
    ).resolves.toEqual({ status: "cancelled" });
  });
});
