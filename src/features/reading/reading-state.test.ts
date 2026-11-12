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
});
