import type { NativeRepositories } from "../storage/sqlite/repositories";
import type { Material, MaterialEvent, MaterialStatus } from "../types";

export interface LifecycleDependencies {
  repositories: NativeRepositories;
  generateId: () => string;
  now: () => string;
}

export interface LifecycleService {
  commit(materialId: string): Promise<Material>;
  start(materialId: string): Promise<Material>;
  finish(materialId: string): Promise<Material>;
  reopen(materialId: string): Promise<Material>;
  returnToInbox(materialId: string): Promise<Material>;
  archive(materialId: string): Promise<Material>;
  delete(materialId: string): Promise<void>;
}

type Transition = {
  from: readonly MaterialStatus[];
  to: MaterialStatus;
  event: MaterialEvent["type"];
};

const transitions: Record<
  Exclude<keyof LifecycleService, "delete">,
  Transition
> = {
  commit: { from: ["inbox"], to: "queued", event: "queued" },
  start: { from: ["queued"], to: "in-progress", event: "in-progress" },
  finish: {
    from: ["queued", "in-progress"],
    to: "completed",
    event: "completed",
  },
  reopen: { from: ["completed"], to: "queued", event: "reopened" },
  returnToInbox: {
    from: ["queued", "in-progress", "completed"],
    to: "inbox",
    event: "returned-to-inbox",
  },
  archive: {
    from: ["inbox", "queued", "in-progress", "completed"],
    to: "archived",
    event: "archived",
  },
};

function requireTransition(
  material: Material,
  operation: keyof typeof transitions,
): Transition {
  const transition = transitions[operation];
  if (!transition.from.includes(material.status)) {
    throw new Error(`Cannot ${operation} a ${material.status} material.`);
  }
  return transition;
}

export function createLifecycleService(
  dependencies: LifecycleDependencies,
): LifecycleService {
  async function transition(
    materialId: string,
    operation: Exclude<keyof LifecycleService, "delete">,
  ): Promise<Material> {
    return dependencies.repositories.transaction(async (repositories) => {
      const current = await repositories.materials.get(materialId);
      if (!current) throw new Error("Material not found.");
      const next = requireTransition(current, operation);
      const timestamp = dependencies.now();
      const updated: Material = {
        ...current,
        status: next.to,
        updatedAt: timestamp,
      };
      await repositories.materials.update(materialId, {
        status: next.to,
        updatedAt: timestamp,
      });
      await repositories.events.append({
        id: dependencies.generateId(),
        materialId,
        type: next.event,
        at: timestamp,
      });
      return updated;
    });
  }

  return {
    commit: (materialId) => transition(materialId, "commit"),
    start: (materialId) => transition(materialId, "start"),
    finish: (materialId) => transition(materialId, "finish"),
    reopen: (materialId) => transition(materialId, "reopen"),
    returnToInbox: (materialId) => transition(materialId, "returnToInbox"),
    archive: (materialId) => transition(materialId, "archive"),
    delete: async (materialId) => {
      await dependencies.repositories.transaction(async (repositories) => {
        const current = await repositories.materials.get(materialId);
        if (!current) throw new Error("Material not found.");
        await repositories.materials.delete(materialId);
      });
    },
  };
}
