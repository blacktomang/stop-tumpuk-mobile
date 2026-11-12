import { createShareIntakeService } from "../application/share-intake-service";
import type { NativeRepositories } from "../storage/sqlite/repositories";
import type { SharedPayload } from "../application/share-intake-service";

export interface AndroidShareIntentDependencies {
  getSharedPayloads: () => readonly unknown[];
  clearSharedPayloads: () => void;
  openRepositories: () => Promise<NativeRepositories>;
  generateId: () => string;
  now: () => string;
}

export interface NativeIntentPath {
  path: string;
  initial: boolean;
}

function asOptionalText(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new Error(`${label} must be text.`);
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * Converts the raw payload shape exposed by expo-sharing into the small
 * application boundary. Shared text is deliberately returned only in memory;
 * the intake service extracts a URL and persists no copy of that text.
 */
export function parseAndroidSharePayloads(
  payloads: readonly unknown[],
): SharedPayload {
  if (!Array.isArray(payloads) || payloads.length === 0) {
    throw new Error("No supported shared URL or text was received.");
  }

  for (const rawPayload of payloads) {
    if (rawPayload === null || typeof rawPayload !== "object") continue;
    const payload = rawPayload as Record<string, unknown>;
    const value = asOptionalText(payload.value, "Shared value");
    if (!value) continue;

    const shareType = asOptionalText(payload.shareType, "Share type");
    const mimeType = asOptionalText(payload.mimeType, "MIME type");
    if (mimeType && mimeType !== "text/plain" && mimeType !== "text/uri-list") {
      continue;
    }

    if (shareType === "url") return { url: value };
    if (shareType === "text" || !shareType) return { text: value };
  }

  throw new Error("The shared payload is not a supported URL or text share.");
}

export function isExpoSharingPath(path: string): boolean {
  return path.includes("expo-sharing");
}

function fallbackPath(): string {
  return "/?shareError=unavailable";
}

/**
 * Handles only the synthetic path emitted by expo-sharing for SEND intents.
 * Returning a normal capture URL keeps Router responsible for navigation while
 * the staged row remains the durable handoff between the native boundary and
 * the capture form.
 */
export function createAndroidShareIntentRedirector(
  dependencies: AndroidShareIntentDependencies,
) {
  return async function redirectSystemPath({
    path,
  }: NativeIntentPath): Promise<string> {
    if (!isExpoSharingPath(path)) return path;

    try {
      const payload = parseAndroidSharePayloads(
        dependencies.getSharedPayloads(),
      );
      const repositories = await dependencies.openRepositories();
      const intake = await createShareIntakeService({
        repositories,
        generateId: dependencies.generateId,
        now: dependencies.now,
      }).stage(payload);
      dependencies.clearSharedPayloads();
      return `/?intakeId=${encodeURIComponent(intake.id)}`;
    } catch {
      // Never put raw shared text or a submitted URL in a Router path/log.
      try {
        dependencies.clearSharedPayloads();
      } catch {
        // The native module may be unavailable in Expo Go or a stale build.
      }
      return fallbackPath();
    }
  };
}
