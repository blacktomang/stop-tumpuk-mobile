import { describe, expect, it } from "vitest";
import {
  createMaterialManagementService,
  matchesMaterialFilter,
  searchMaterials,
} from "./material-management-service";
import type { NativeRepositories } from "../storage/sqlite/repositories";
import type { Material } from "../types";

const base: Material = {
  id: "one",
  originalUrl: "https://example.com/one",
  normalizedUrl: "https://example.com/one",
  domain: "example.com",
  title: "A useful article",
  thumbnailUrl: null,
  type: "article",
  status: "queued",
  sourceDurationSeconds: 600,
  sourceDurationProvenance: "publisher-estimate",
  sourceDurationCompleteness: "full",
  playbackSpeed: 1,
  manualEstimatedSeconds: null,
  createdAt: "2026-11-11T00:00:00.000Z",
  updatedAt: "2026-11-11T00:00:00.000Z",
};

function repositories(seed: Material | null = base) {
  let material = seed;
  const updates: Array<{ id: string; patch: Partial<Material> }> = [];
  let transactions = 0;
  const repositories = {} as NativeRepositories;
  repositories.materials = {
    get: async (id) => (material?.id === id ? material : null),
    list: async () => (material ? [material] : []),
    findByNormalizedUrl: async () => null,
    insert: async () => undefined,
    update: async (id, patch) => {
      updates.push({ id, patch });
      if (material?.id === id) material = { ...material, ...patch };
    },
    delete: async () => undefined,
  };
  repositories.notes = {
    list: async () => [],
    listForMaterial: async () => [],
    get: async () => null,
    insert: async () => undefined,
    update: async () => undefined,
    delete: async () => undefined,
  };
  repositories.settings = {
    get: async () => null,
    save: async () => undefined,
  };
  repositories.sessions = {
    list: async () => [],
    getActiveForMaterial: async () => null,
    listForMaterial: async () => [],
    insert: async () => undefined,
    update: async () => undefined,
  };
  repositories.events = {
    list: async () => [],
    listForMaterial: async () => [],
    append: async () => undefined,
  };
  repositories.captureIntake = {
    get: async () => null,
    stage: async () => undefined,
    consume: async () => undefined,
  };
  repositories.transaction = async (work) => {
    transactions += 1;
    return work(repositories);
  };
  return {
    repositories,
    material: () => material,
    updates,
    transactions: () => transactions,
  };
}

describe("material management view queries", () => {
  it("maps user-facing filters to lifecycle statuses", () => {
    expect(matchesMaterialFilter(base, "reading-plan")).toBe(true);
    expect(
      matchesMaterialFilter({ ...base, status: "completed" }, "finished"),
    ).toBe(true);
  });

  it("searches title, domain, and source URL within a status", () => {
    const other: Material = {
      ...base,
      id: "two",
      title: "Video notes",
      status: "in-progress",
    };
    expect(searchMaterials([base, other], "reading-plan", "USEFUL")).toEqual([
      base,
    ]);
    expect(
      searchMaterials([base, other], "in-progress", "example.com"),
    ).toEqual([other]);
  });

  it("keeps saved-for-later links separate and includes them in Library search", () => {
    const later: Material = { ...base, id: "later", status: "inbox" };
    const finished: Material = { ...base, id: "finished", status: "completed" };
    const library = [base, later, finished];

    expect(searchMaterials(library, "inbox", "")).toEqual([later]);
    expect(searchMaterials(library, "all", base.title)).toEqual(library);
    expect(searchMaterials(library, "all", "no match")).toEqual([]);
  });
});

describe("material management edits", () => {
  it("trims the title and persists normalized URL metadata and manual estimate", async () => {
    const state = repositories();
    const service = createMaterialManagementService({
      repositories: state.repositories,
      now: () => "2026-11-12T00:00:00.000Z",
    });

    const updated = await service.edit("one", {
      title: "  Updated video  ",
      originalUrl: " https://www.youtube.com/watch?v=abc&utm_source=test ",
      estimatedMinutes: 12.5,
      type: "video",
      playbackSpeed: 1.25,
    });

    expect(updated).toMatchObject({
      title: "Updated video",
      originalUrl: "https://www.youtube.com/watch?v=abc&utm_source=test",
      normalizedUrl: "https://www.youtube.com/watch?v=abc",
      domain: "youtube.com",
      type: "video",
      playbackSpeed: 1.25,
      manualEstimatedSeconds: 750,
      updatedAt: "2026-11-12T00:00:00.000Z",
    });
    expect(state.material()).toEqual(updated);
    expect(state.transactions()).toBe(1);
    expect(state.updates).toHaveLength(1);
  });

  it("persists zero and null manual estimates without confusing them", async () => {
    const state = repositories();
    const service = createMaterialManagementService({
      repositories: state.repositories,
      now: () => "2026-11-12T00:00:00.000Z",
    });

    await service.edit("one", {
      title: "Zero estimate",
      originalUrl: "https://example.com/zero",
      estimatedMinutes: 0,
      type: "article",
      playbackSpeed: 1,
    });
    expect(state.material()?.manualEstimatedSeconds).toBe(0);

    await service.edit("one", {
      title: "Unknown estimate",
      originalUrl: "https://example.com/unknown",
      estimatedMinutes: null,
      type: "article",
      playbackSpeed: 1,
    });
    expect(state.material()?.manualEstimatedSeconds).toBeNull();
    expect(state.transactions()).toBe(2);
  });

  it("rejects invalid edits without starting a transaction or writing", async () => {
    const cases = [
      {
        title: " ",
        originalUrl: "https://example.com/article",
        estimatedMinutes: 1,
        type: "article" as const,
        playbackSpeed: 1,
      },
      {
        title: "Valid",
        originalUrl: "not a URL",
        estimatedMinutes: 1,
        type: "article" as const,
        playbackSpeed: 1,
      },
      {
        title: "Valid",
        originalUrl: "mailto:test@example.com",
        estimatedMinutes: 1,
        type: "article" as const,
        playbackSpeed: 1,
      },
      {
        title: "Valid",
        originalUrl: "https://example.com/article",
        estimatedMinutes: -1,
        type: "article" as const,
        playbackSpeed: 1,
      },
      {
        title: "Valid",
        originalUrl: "https://example.com/article",
        estimatedMinutes: 1,
        type: "article" as const,
        playbackSpeed: 0,
      },
      {
        title: "Valid",
        originalUrl: "https://example.com/article",
        estimatedMinutes: 1,
        type: "article" as const,
        playbackSpeed: Number.NaN,
      },
    ];
    const state = repositories();
    const service = createMaterialManagementService({
      repositories: state.repositories,
      now: () => "2026-11-12T00:00:00.000Z",
    });

    for (const draft of cases) {
      await expect(service.edit("one", draft)).rejects.toThrow();
    }

    expect(state.transactions()).toBe(0);
    expect(state.updates).toHaveLength(0);
  });

  it("does not write or transact when the material is missing", async () => {
    const state = repositories(null);
    const service = createMaterialManagementService({
      repositories: state.repositories,
      now: () => "2026-11-12T00:00:00.000Z",
    });

    await expect(
      service.edit("missing", {
        title: "Valid",
        originalUrl: "https://example.com/article",
        estimatedMinutes: 1,
        type: "article",
        playbackSpeed: 1,
      }),
    ).rejects.toThrow("Material not found.");
    expect(state.transactions()).toBe(0);
    expect(state.updates).toHaveLength(0);
  });

  it("keeps the material update inside the repository transaction boundary", async () => {
    const state = repositories();
    const service = createMaterialManagementService({
      repositories: state.repositories,
      now: () => "2026-11-12T00:00:00.000Z",
    });
    const originalUpdate = state.repositories.materials.update;
    let updateInsideTransaction = false;
    state.repositories.transaction = async (work) => {
      state.transactions();
      updateInsideTransaction = true;
      try {
        return await work(state.repositories);
      } finally {
        updateInsideTransaction = false;
      }
    };
    state.repositories.materials.update = async (id, patch) => {
      expect(updateInsideTransaction).toBe(true);
      await originalUpdate(id, patch);
    };

    await service.edit("one", {
      title: "Transactional",
      originalUrl: "https://example.com/transactional",
      estimatedMinutes: null,
      type: "article",
      playbackSpeed: 1,
    });
    expect(state.updates).toHaveLength(1);
  });
});
