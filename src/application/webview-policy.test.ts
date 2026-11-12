import { describe, expect, it } from "vitest";
import {
  decideWebViewNavigation,
  externalBrowserFallback,
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
    ["mailto:hello@example.com", "mailto"],
    ["tel:+628123456789", "tel"],
    ["intent://open/article#Intent;scheme=https;end", "intent"],
    ["stop-tumpuk://capture?url=https%3A%2F%2Fexample.com", "stop-tumpuk"],
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
  ])("blocks unsafe scheme %s", (url) => {
    expect(decideWebViewNavigation(url)).toMatchObject({
      kind: "block",
      reason: "unsafe-scheme",
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
