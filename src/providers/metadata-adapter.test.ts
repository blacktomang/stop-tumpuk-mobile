import { describe, expect, it } from "vitest";
import {
  createMetadataAdapter,
  MetadataProviderError,
} from "./metadata-adapter";
import type { Material } from "../types";

const material: Material = {
  id: "m-1",
  originalUrl: "https://example.com/article",
  normalizedUrl: "https://example.com/article",
  domain: "example.com",
  title: "example.com article",
  thumbnailUrl: null,
  type: "article",
  status: "queued",
  sourceDurationSeconds: null,
  sourceDurationProvenance: "unknown",
  sourceDurationCompleteness: "unknown",
  playbackSpeed: 1,
  manualEstimatedSeconds: null,
  createdAt: "2026-11-11T00:00:00.000Z",
  updatedAt: "2026-11-11T00:00:00.000Z",
};

describe("metadata adapter", () => {
  it("validates typed provider output and preserves provenance/completeness", async () => {
    const adapter = createMetadataAdapter(async () => ({
      title: "Provider title",
      thumbnailUrl: "https://cdn.example.com/thumb.jpg",
      type: "article",
      sourceDurationSeconds: 600,
      sourceDurationProvenance: "publisher-estimate",
      sourceDurationCompleteness: "full",
    }));

    await expect(adapter(material)).resolves.toEqual({
      title: "Provider title",
      thumbnailUrl: "https://cdn.example.com/thumb.jpg",
      type: "article",
      sourceDurationSeconds: 600,
      sourceDurationProvenance: "publisher-estimate",
      sourceDurationCompleteness: "full",
    });
  });

  it("turns timeout, cancellation, and offline failures into retryable typed failures", async () => {
    const timeout = createMetadataAdapter(
      async (_material, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () => reject(new DOMException("aborted", "AbortError")),
            {
              once: true,
            },
          );
        }),
      { timeoutMs: 1 },
    );
    await expect(timeout(material)).rejects.toMatchObject({
      code: "timeout",
      retryable: true,
    });

    const offline = createMetadataAdapter(async () => {
      throw new TypeError("network down");
    });
    await expect(offline(material)).rejects.toMatchObject({
      code: "offline",
      retryable: true,
    });

    const controller = new AbortController();
    controller.abort();
    const cancelled = createMetadataAdapter(async () => ({}), {
      signal: controller.signal,
    });
    await expect(cancelled(material)).rejects.toMatchObject({
      code: "aborted",
      retryable: true,
    });
  });

  it("rejects malformed provider output before it can reach storage", async () => {
    const adapter = createMetadataAdapter(async () => ({
      title: 42,
      sourceDurationSeconds: 12,
    }));

    await expect(adapter(material)).rejects.toBeInstanceOf(
      MetadataProviderError,
    );
    await expect(adapter(material)).rejects.toMatchObject({
      code: "malformed",
      retryable: false,
    });
  });
});
