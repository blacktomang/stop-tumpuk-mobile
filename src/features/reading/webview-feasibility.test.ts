import { describe, expect, it } from "vitest";
import {
  applyProbeEvidenceEvent,
  createProbeEvidence,
  decisionLabel,
  probeSources,
} from "./webview-feasibility";

describe("WebView feasibility source matrix", () => {
  it("contains the four representative sources with HTTP(S) URLs", () => {
    expect(probeSources.map((source) => source.kind)).toEqual([
      "public-article",
      "medium-style",
      "public-video",
      "login-paywall",
    ]);
    expect(
      probeSources.every((source) => /^https?:\/\//.test(source.url)),
    ).toBe(true);
    expect(
      probeSources.every(
        (source) =>
          source.expected.navigation &&
          source.expected.loading &&
          source.expected.media &&
          source.expected.access &&
          source.expected.fallback,
      ),
    ).toBe(true);
  });

  it("records loading, redirects, media, access, and final evidence deterministically", () => {
    let evidence = createProbeEvidence("public-video");
    evidence = applyProbeEvidenceEvent(evidence, { kind: "load-start" });
    evidence = applyProbeEvidenceEvent(evidence, {
      kind: "progress",
      value: 0.4,
    });
    evidence = applyProbeEvidenceEvent(evidence, {
      kind: "navigation",
      url: "https://www.youtube.com/watch?v=example",
    });
    evidence = applyProbeEvidenceEvent(evidence, { kind: "media-observed" });
    evidence = applyProbeEvidenceEvent(evidence, { kind: "login-observed" });
    evidence = applyProbeEvidenceEvent(evidence, {
      kind: "load-end",
      url: "https://www.youtube.com/watch?v=example",
    });

    expect(evidence).toMatchObject({
      status: "loaded",
      progress: 1,
      loadStarted: true,
      navigationCount: 1,
      mediaObserved: true,
      loginObserved: true,
      lastUrl: "https://www.youtube.com/watch?v=example",
    });
  });

  it("clamps progress and preserves recoverable errors and external actions", () => {
    let evidence = createProbeEvidence("login-paywall");
    evidence = applyProbeEvidenceEvent(evidence, {
      kind: "progress",
      value: 3,
    });
    evidence = applyProbeEvidenceEvent(evidence, {
      kind: "error",
      message: "Network request failed",
    });
    expect(evidence).toMatchObject({ progress: 1, status: "error" });

    evidence = applyProbeEvidenceEvent(evidence, {
      kind: "external-action",
      action: "Opened in browser",
    });
    expect(evidence).toMatchObject({
      status: "external",
      externalAction: "Opened in browser",
    });
  });

  it("labels policy decisions for the probe evidence view", () => {
    expect(decisionLabel({ kind: "allow", url: "https://example.com" })).toBe(
      "Stay in WebView",
    );
    expect(
      decisionLabel({
        kind: "external",
        url: "mailto:hello@example.com",
        scheme: "mailto",
      }),
    ).toBe("External mailto link");
    expect(
      decisionLabel({
        kind: "block",
        url: "javascript:alert(1)",
        reason: "unsafe-scheme",
      }),
    ).toBe("Blocked unsafe scheme");
    expect(
      decisionLabel({
        kind: "block",
        url: "ftp://example.com/file",
        reason: "unsupported-scheme",
      }),
    ).toBe("Blocked unsupported scheme");
  });
});
