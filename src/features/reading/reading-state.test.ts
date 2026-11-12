import { describe, expect, it } from "vitest";
import {
  initialReadingState,
  readingLoadFailed,
  readingLoadFinished,
  readingLoadStarted,
  readingProgressChanged,
  validateReadingUrl,
} from "./reading-state";

describe("reading screen state", () => {
  it("starts loading and clamps progress to a usable range", () => {
    const initial = initialReadingState();
    expect(initial).toEqual({
      phase: "loading",
      progress: 0,
      errorMessage: null,
    });
    expect(readingProgressChanged(initial, 1.4).progress).toBe(1);
    expect(readingProgressChanged(initial, -0.2).progress).toBe(0);
  });

  it("keeps a failure recoverable through a fresh loading state", () => {
    const failed = readingLoadFailed(initialReadingState(), "Network error");
    expect(failed).toMatchObject({
      phase: "error",
      errorMessage: "Network error",
    });
    expect(readingLoadStarted()).toEqual(initialReadingState());
    expect(readingLoadFinished(failed)).toMatchObject({
      phase: "ready",
      progress: 1,
      errorMessage: null,
    });
  });
});

describe("reading route URL boundary", () => {
  it("accepts only normalized HTTP(S) URLs", () => {
    expect(validateReadingUrl("https://example.com/article")).toBe(
      "https://example.com/article",
    );
    expect(validateReadingUrl("javascript:alert(1)")).toBeNull();
    expect(validateReadingUrl("not a URL")).toBeNull();
  });

  it.each([
    "mailto:reader@example.com",
    "tel:+628123456789",
    "data:text/html,unsafe",
    "file:///private/data",
    "intent://open/article#Intent;scheme=https;end",
    "ftp://example.com/article",
  ])("rejects a non-HTTP(S) source URL: %s", (url) => {
    expect(validateReadingUrl(url)).toBeNull();
  });

  it("keeps loading and error transitions independent of completion", () => {
    const loading = readingProgressChanged(initialReadingState(), 0.5);
    const failed = readingLoadFailed(loading, "The page failed.");
    const recovered = readingLoadFinished(readingLoadStarted());

    expect(loading.phase).toBe("loading");
    expect(failed.phase).toBe("error");
    expect(recovered).toMatchObject({ phase: "ready", progress: 1 });
    expect([loading.phase, failed.phase, recovered.phase]).not.toContain(
      "completed",
    );
  });
});
