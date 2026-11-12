import { capacityViewModel, estimatedSeconds, recommendMaterials } from '../domain';
import type { NativeRepositories } from '../storage/sqlite/repositories';
import type { CapacityViewModel, RecommendationResult } from '../domain';
import type { Material } from '../types';

export interface PlanningServiceDependencies {
  repositories: NativeRepositories;
}

export interface ManualSelection {
  material: Material;
  estimatedSeconds: number | null;
}

function assertAvailableSeconds(value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('Available time must be a non-negative finite number.');
  }
}

/** Read-only application boundary for capacity and recommendation decisions. */
export function createPlanningService(dependencies: PlanningServiceDependencies) {
  async function getCapacity(): Promise<CapacityViewModel> {
    const [materials, settings] = await Promise.all([
      dependencies.repositories.materials.list(),
      dependencies.repositories.settings.get(),
    ]);
    return capacityViewModel(materials, settings?.weekdayMinutes ?? null, settings?.weekendMinutes ?? null);
  }

  async function recommend(availableSeconds: number): Promise<RecommendationResult> {
    assertAvailableSeconds(availableSeconds);
    return recommendMaterials(await dependencies.repositories.materials.list(), availableSeconds);
  }

  async function selectManual(materialId: string): Promise<ManualSelection> {
    const material = await dependencies.repositories.materials.get(materialId);
    if (!material) throw new Error('Material not found.');
    if (material.status !== 'queued' && material.status !== 'in-progress') {
      throw new Error('Only active materials can be selected for reading.');
    }
    return { material, estimatedSeconds: estimatedSeconds(material) };
  }

  return { getCapacity, recommend, selectManual };
}
