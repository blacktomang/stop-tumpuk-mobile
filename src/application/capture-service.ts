import { classifyUrl, inferredTitle, normalizeUrl } from "../domain";
import type { MetadataPatch } from "../providers/metadata-adapter";
import type { NativeRepositories } from "../storage/sqlite/repositories";
import type { Material, MaterialStatus } from "../types";

export type CaptureDestination = Extract<MaterialStatus, "inbox" | "queued">;

export interface CaptureOptions {
  allowDuplicate?: boolean;
  intakeId?: string;
  intakeTitle?: string | null;
}

export interface CaptureDependencies {
  repositories: NativeRepositories;
  generateId: () => string;
  now: () => string;
  enrichMetadata?: (material: Material) => Promise<MetadataPatch>;
}

export type CaptureResult =
  | { kind: "saved"; material: Material }
  | {
      kind: "duplicate";
      existing: Material;
      retry: () => Promise<CaptureResult>;
    };

function createMaterial(
  rawUrl: string,
  destination: CaptureDestination,
  options: CaptureOptions,
  generateId: () => string,
  timestamp: string,
): Material {
  const { url, type, source } = classifyUrl(rawUrl.trim());
  return {
    id: generateId(),
    originalUrl: url.toString(),
    normalizedUrl: normalizeUrl(url),
    domain: url.hostname.replace(/^www\./, ""),
    title: options.intakeTitle?.trim() || inferredTitle(url),
    thumbnailUrl: null,
    type,
    status: destination,
    sourceDurationSeconds: null,
    sourceDurationProvenance: source,
    sourceDurationCompleteness: "unknown",
    playbackSpeed: 1,
    manualEstimatedSeconds: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

async function saveMaterial(
  repositories: NativeRepositories,
  material: Material,
  intakeId: string | undefined,
  generateId: () => string,
): Promise<void> {
  await repositories.transaction(async (transactionRepositories) => {
    if (intakeId) {
      const intake = await transactionRepositories.captureIntake.get(intakeId);
      if (!intake || intake.consumedAt !== null)
        throw new Error(
          "This shared link is no longer available. Please paste it again.",
        );
    }
    await transactionRepositories.materials.insert(material);
    await transactionRepositories.events.append({
      id: generateId(),
      materialId: material.id,
      type: "captured",
      at: material.createdAt,
    });
    if (material.status === "queued") {
      await transactionRepositories.events.append({
        id: generateId(),
        materialId: material.id,
        type: "queued",
        at: material.createdAt,
      });
    }
    if (intakeId)
      await transactionRepositories.captureIntake.consume(
        intakeId,
        material.createdAt,
      );
  });
}

async function enrichSavedMaterial(
  dependencies: CaptureDependencies,
  material: Material,
): Promise<void> {
  if (!dependencies.enrichMetadata) return;
  try {
    const patch = await dependencies.enrichMetadata(material);
    const current = await dependencies.repositories.materials.get(material.id);
    if (!current || current.originalUrl !== material.originalUrl) return;
    const inferred = inferredTitle(new URL(material.originalUrl));
    const candidate: MetadataPatch = {
      ...patch,
      ...(current.title === inferred ? {} : { title: undefined }),
    };
    const safePatch = Object.fromEntries(
      Object.entries(candidate).filter(([, value]) => value !== undefined),
    ) as MetadataPatch;
    if (current.manualEstimatedSeconds !== null) {
      delete safePatch.sourceDurationSeconds;
      delete safePatch.sourceDurationProvenance;
      delete safePatch.sourceDurationCompleteness;
    }
    if (Object.keys(safePatch).length === 0) return;
    await dependencies.repositories.transaction(async (repositories) => {
      const latest = await repositories.materials.get(material.id);
      if (!latest || latest.originalUrl !== material.originalUrl) return;
      await repositories.materials.update(material.id, {
        ...safePatch,
        updatedAt: dependencies.now(),
      });
    });
  } catch {
    // Metadata is optional. Capture remains successful when a provider fails.
  }
}

export function createCaptureService(dependencies: CaptureDependencies) {
  async function captureUrl(
    rawUrl: string,
    destination: CaptureDestination,
    options: CaptureOptions = {},
  ): Promise<CaptureResult> {
    const material = createMaterial(
      rawUrl,
      destination,
      options,
      dependencies.generateId,
      dependencies.now(),
    );
    const existing =
      await dependencies.repositories.materials.findByNormalizedUrl(
        material.normalizedUrl,
      );
    if (existing && !options.allowDuplicate) {
      return {
        kind: "duplicate",
        existing,
        retry: () =>
          captureUrl(rawUrl, destination, { ...options, allowDuplicate: true }),
      };
    }
    await saveMaterial(
      dependencies.repositories,
      material,
      options.intakeId,
      dependencies.generateId,
    );
    void enrichSavedMaterial(dependencies, material);
    return { kind: "saved", material };
  }

  async function captureStagedIntake(
    intakeId: string,
    destination: CaptureDestination,
  ): Promise<CaptureResult> {
    const intake = await dependencies.repositories.captureIntake.get(intakeId);
    if (!intake || intake.consumedAt !== null)
      throw new Error(
        "This shared link is no longer available. Please paste it again.",
      );
    return captureUrl(intake.url, destination, {
      intakeId,
      intakeTitle: intake.title,
    });
  }

  return { captureUrl, captureStagedIntake };
}
