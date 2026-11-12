import { classifyUrl, normalizeUrl } from "../domain";
import type { NativeRepositories } from "../storage/sqlite/repositories";
import type { Material, MaterialType } from "../types";

export type MaterialListFilter =
  "inbox" | "reading-plan" | "in-progress" | "finished" | "archived";

export interface MaterialEdit {
  title: string;
  originalUrl: string;
  estimatedMinutes: number | null;
  type: MaterialType;
  playbackSpeed: number;
}

export interface MaterialManagementDependencies {
  repositories: NativeRepositories;
  now: () => string;
}

export function matchesMaterialFilter(
  material: Material,
  filter: MaterialListFilter,
): boolean {
  switch (filter) {
    case "reading-plan":
      return material.status === "queued";
    case "finished":
      return material.status === "completed";
    default:
      return material.status === filter;
  }
}

export function searchMaterials(
  materials: readonly Material[],
  filter: MaterialListFilter,
  query: string,
): Material[] {
  const needle = query.trim().toLocaleLowerCase();
  return materials.filter(
    (material) =>
      matchesMaterialFilter(material, filter) &&
      (needle === "" ||
        [material.title, material.domain, material.originalUrl].some((value) =>
          value.toLocaleLowerCase().includes(needle),
        )),
  );
}

function validateEdit(edit: MaterialEdit): void {
  if (!edit.title.trim()) throw new Error("Title cannot be empty.");
  if (!Number.isFinite(edit.playbackSpeed) || edit.playbackSpeed <= 0) {
    throw new Error("Playback speed must be greater than zero.");
  }
  if (
    edit.estimatedMinutes !== null &&
    (!Number.isFinite(edit.estimatedMinutes) || edit.estimatedMinutes < 0)
  ) {
    throw new Error("Estimated minutes must be zero or more.");
  }
  classifyUrl(edit.originalUrl.trim());
}

export function createMaterialManagementService(
  dependencies: MaterialManagementDependencies,
) {
  async function list(): Promise<Material[]> {
    return dependencies.repositories.materials.list();
  }

  async function edit(
    materialId: string,
    draft: MaterialEdit,
  ): Promise<Material> {
    validateEdit(draft);
    const parsed = classifyUrl(draft.originalUrl.trim());
    const current = await dependencies.repositories.materials.get(materialId);
    if (!current) throw new Error("Material not found.");
    const updatedAt = dependencies.now();
    const patch: Partial<Material> = {
      title: draft.title.trim(),
      originalUrl: parsed.url.toString(),
      normalizedUrl: normalizeUrl(parsed.url),
      domain: parsed.url.hostname.replace(/^www\./, ""),
      type: draft.type,
      playbackSpeed: draft.playbackSpeed,
      manualEstimatedSeconds:
        draft.estimatedMinutes === null ? null : draft.estimatedMinutes * 60,
      updatedAt,
    };
    await dependencies.repositories.transaction(async (repositories) => {
      await repositories.materials.update(materialId, patch);
    });
    return { ...current, ...patch };
  }

  return { list, edit };
}
