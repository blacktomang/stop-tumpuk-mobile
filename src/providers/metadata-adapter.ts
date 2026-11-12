import type {
  DurationCompleteness,
  DurationProvenance,
  Material,
  MaterialType,
} from "../types";

const MAX_TITLE_LENGTH = 500;
const MAX_DURATION_SECONDS = 7 * 24 * 60 * 60;

export interface MetadataPatch {
  title?: string;
  thumbnailUrl?: string | null;
  type?: MaterialType;
  sourceDurationSeconds?: number | null;
  sourceDurationProvenance?: DurationProvenance;
  sourceDurationCompleteness?: DurationCompleteness;
}

/** Raw provider output is deliberately unknown at the native boundary. */
export type MetadataProvider = (
  material: Material,
  signal: AbortSignal,
) => Promise<unknown>;

export type MetadataFailureCode =
  "aborted" | "timeout" | "offline" | "http" | "malformed";

export class MetadataProviderError extends Error {
  readonly code: MetadataFailureCode;
  readonly retryable: boolean;

  constructor(code: MetadataFailureCode, message: string, retryable = true) {
    super(message);
    this.name = "MetadataProviderError";
    this.code = code;
    this.retryable = retryable;
  }
}

export interface MetadataAdapterOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function optionalString(
  value: unknown,
  field: string,
  maxLength?: number,
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string")
    throw new MetadataProviderError(
      "malformed",
      `${field} must be text.`,
      false,
    );
  const trimmed = value.trim();
  if (!trimmed)
    throw new MetadataProviderError(
      "malformed",
      `${field} must not be empty.`,
      false,
    );
  if (maxLength !== undefined && trimmed.length > maxLength) {
    throw new MetadataProviderError(
      "malformed",
      `${field} is too long.`,
      false,
    );
  }
  return trimmed;
}

function optionalThumbnail(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const thumbnail = optionalString(value, "thumbnailUrl");
  if (!thumbnail) return null;
  try {
    const url = new URL(thumbnail);
    if (url.protocol !== "https:") throw new Error("not HTTPS");
  } catch {
    throw new MetadataProviderError(
      "malformed",
      "thumbnailUrl must be an HTTPS URL.",
      false,
    );
  }
  return thumbnail;
}

function optionalDuration(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > MAX_DURATION_SECONDS
  ) {
    throw new MetadataProviderError(
      "malformed",
      "sourceDurationSeconds is invalid.",
      false,
    );
  }
  return value;
}

function validatePatch(value: unknown): MetadataPatch {
  if (!isRecord(value))
    throw new MetadataProviderError(
      "malformed",
      "Provider output must be an object.",
      false,
    );

  const patch: MetadataPatch = {
    title: optionalString(value.title, "title", MAX_TITLE_LENGTH),
    thumbnailUrl: optionalThumbnail(value.thumbnailUrl),
    type: value.type as MaterialType | undefined,
    sourceDurationSeconds: optionalDuration(value.sourceDurationSeconds),
    sourceDurationProvenance: value.sourceDurationProvenance as
      DurationProvenance | undefined,
    sourceDurationCompleteness: value.sourceDurationCompleteness as
      DurationCompleteness | undefined,
  };

  if (
    patch.type !== undefined &&
    !["article", "video", "unknown"].includes(patch.type)
  ) {
    throw new MetadataProviderError("malformed", "type is invalid.", false);
  }
  if (
    patch.sourceDurationProvenance !== undefined &&
    ![
      "api-runtime",
      "publisher-estimate",
      "word-count",
      "manual",
      "unknown",
    ].includes(patch.sourceDurationProvenance)
  ) {
    throw new MetadataProviderError(
      "malformed",
      "sourceDurationProvenance is invalid.",
      false,
    );
  }
  if (
    patch.sourceDurationCompleteness !== undefined &&
    !["full", "partial", "unknown"].includes(patch.sourceDurationCompleteness)
  ) {
    throw new MetadataProviderError(
      "malformed",
      "sourceDurationCompleteness is invalid.",
      false,
    );
  }
  const durationFieldsPresent =
    patch.sourceDurationSeconds !== undefined ||
    patch.sourceDurationProvenance !== undefined ||
    patch.sourceDurationCompleteness !== undefined;
  if (durationFieldsPresent) {
    if (
      patch.sourceDurationSeconds === undefined ||
      patch.sourceDurationProvenance === undefined ||
      patch.sourceDurationCompleteness === undefined
    ) {
      throw new MetadataProviderError(
        "malformed",
        "Duration output must include value, provenance, and completeness.",
        false,
      );
    }
    if (
      patch.sourceDurationSeconds === null &&
      patch.sourceDurationCompleteness !== "unknown"
    ) {
      throw new MetadataProviderError(
        "malformed",
        "Unknown duration must be marked unknown.",
        false,
      );
    }
    if (
      patch.sourceDurationSeconds !== null &&
      patch.sourceDurationProvenance === "unknown"
    ) {
      throw new MetadataProviderError(
        "malformed",
        "Known duration cannot have unknown provenance.",
        false,
      );
    }
  }
  return Object.fromEntries(
    Object.entries(patch).filter(([, item]) => item !== undefined),
  ) as MetadataPatch;
}

function isAbortError(error: unknown): boolean {
  return isRecord(error) && error.name === "AbortError";
}

function isNetworkError(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (isRecord(error) && error.name === "NetworkError")
  );
}

function createTimeoutSignal(
  timeoutMs: number,
  parent?: AbortSignal,
): {
  signal: AbortSignal;
  dispose: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  parent?.addEventListener("abort", abort, { once: true });
  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timer);
      parent?.removeEventListener("abort", abort);
    },
  };
}

/**
 * Turns an untrusted optional provider into the capture-service contract.
 * No provider SDK or server is required; callers can inject a native-safe fake
 * or a small fetch adapter at the boundary.
 */
export function createMetadataAdapter(
  provider: MetadataProvider,
  options: MetadataAdapterOptions = {},
): (material: Material) => Promise<MetadataPatch> {
  const timeoutMs = options.timeoutMs ?? 5_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("Metadata timeout must be a positive finite number.");
  }

  return async (material) => {
    if (options.signal?.aborted) {
      throw new MetadataProviderError(
        "aborted",
        "Metadata request was cancelled.",
      );
    }
    const timeout = createTimeoutSignal(timeoutMs, options.signal);
    let rejectOnAbort: (() => void) | undefined;
    const aborted = new Promise<never>((_, reject) => {
      rejectOnAbort = () =>
        reject(
          new MetadataProviderError(
            options.signal?.aborted ? "aborted" : "timeout",
            options.signal?.aborted
              ? "Metadata request was cancelled."
              : "Metadata request timed out.",
          ),
        );
      timeout.signal.addEventListener("abort", rejectOnAbort, { once: true });
    });
    try {
      const output = await Promise.race([
        provider(material, timeout.signal),
        aborted,
      ]);
      return validatePatch(output);
    } catch (error) {
      if (error instanceof MetadataProviderError) throw error;
      if (timeout.signal.aborted) {
        throw new MetadataProviderError(
          options.signal?.aborted ? "aborted" : "timeout",
          options.signal?.aborted
            ? "Metadata request was cancelled."
            : "Metadata request timed out.",
        );
      }
      if (isAbortError(error))
        throw new MetadataProviderError(
          "aborted",
          "Metadata request was cancelled.",
        );
      if (isNetworkError(error))
        throw new MetadataProviderError(
          "offline",
          "Metadata provider is unavailable.",
        );
      throw new MetadataProviderError("http", "Metadata provider failed.");
    } finally {
      if (rejectOnAbort) {
        timeout.signal.removeEventListener("abort", rejectOnAbort);
      }
      timeout.dispose();
    }
  };
}

export function createOEmbedMetadataProvider(
  fetcher: typeof fetch = fetch,
): MetadataProvider {
  return async (material, signal) => {
    const endpoint = new URL("https://www.youtube.com/oembed");
    endpoint.searchParams.set("url", material.originalUrl);
    endpoint.searchParams.set("format", "json");
    const response = await fetcher(endpoint, { signal });
    if (!response.ok)
      throw new MetadataProviderError(
        "http",
        `Metadata provider returned ${response.status}.`,
      );
    const body: unknown = await response.json();
    if (
      !isRecord(body) ||
      typeof body.title !== "string" ||
      !body.title.trim()
    ) {
      throw new MetadataProviderError(
        "malformed",
        "Provider title is missing.",
        false,
      );
    }
    return {
      title: body.title,
      thumbnailUrl: body.thumbnail_url ?? null,
      type: "video",
    };
  };
}
