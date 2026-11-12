import { describe, expect, it } from "vitest";
import { createCaptureService } from "./capture-service";
import type { NativeRepositories } from "../storage/sqlite/repositories";
import type {
  CaptureIntake,
  Material,
  MaterialEvent,
  Note,
  LearningSession,
  Settings,
} from "../types";

const timestamp = "2026-11-11T00:00:00.000Z";

function repositories(
  seed: { materials?: Material[]; intake?: CaptureIntake } = {},
) {
  const materials = [...(seed.materials ?? [])];
  const events: MaterialEvent[] = [];
  const intakes = seed.intake ? [seed.intake] : [];
  const repos = {} as NativeRepositories;
  repos.materials = {
    get: async (id) => materials.find((item) => item.id === id) ?? null,
    list: async () => materials,
    findByNormalizedUrl: async (url) =>
      materials.find((item) => item.normalizedUrl === url) ?? null,
    insert: async (material) => {
      materials.push(material);
    },
    update: async (id, patch) => {
      const item = materials.find((material) => material.id === id);
      if (item) Object.assign(item, patch);
    },
    delete: async () => undefined,
  };
  repos.events = {
    list: async () => events,
    listForMaterial: async (materialId) =>
      events.filter((event) => event.materialId === materialId),
    append: async (event) => {
      events.push(event);
    },
  };
  repos.captureIntake = {
    get: async (id) => intakes.find((intake) => intake.id === id) ?? null,
    stage: async (intake) => {
      intakes.push(intake);
    },
    consume: async (id, consumedAt) => {
      const intake = intakes.find((item) => item.id === id);
      if (intake) intake.consumedAt = consumedAt;
    },
  };
  repos.notes = {
    list: async () => [] as Note[],
    listForMaterial: async () => [],
    get: async () => null,
    insert: async () => undefined,
    update: async () => undefined,
    delete: async () => undefined,
  };
  repos.sessions = {
    list: async () => [] as LearningSession[],
    getActiveForMaterial: async () => null,
    listForMaterial: async () => [],
    insert: async () => undefined,
    update: async () => undefined,
  };
  repos.settings = {
    get: async () => null,
    save: async (_settings: Settings) => undefined,
  };
  repos.transaction = async (work) => work(repos);
  return { repos, materials, events, intakes };
}

const dependencies = (repos: NativeRepositories) => {
  let id = 0;
  return {
    repositories: repos,
    generateId: () => `id-${++id}`,
    now: () => timestamp,
  };
};

describe("native capture service", () => {
  it("saves a queued capture and its capture/commitment events atomically", async () => {
    const state = repositories();
    const service = createCaptureService(dependencies(state.repos));

    const result = await service.captureUrl(
      "https://example.com/article",
      "queued",
    );

    expect(result.kind).toBe("saved");
    expect(state.materials[0]).toMatchObject({
      status: "queued",
      domain: "example.com",
    });
    expect(state.events.map((event) => event.type)).toEqual([
      "captured",
      "queued",
    ]);
  });

  it("warns on duplicates and preserves the destination for an explicit retry", async () => {
    const first = repositories();
    const service = createCaptureService(dependencies(first.repos));
    await service.captureUrl("https://example.com/article", "inbox");
    const duplicate = await service.captureUrl(
      "https://example.com/article?utm_source=test",
      "queued",
    );

    expect(duplicate.kind).toBe("duplicate");
    if (duplicate.kind !== "duplicate") return;
    const retry = await duplicate.retry();
    expect(retry.kind).toBe("saved");
    expect(first.materials).toHaveLength(2);
    expect(first.materials[1]?.status).toBe("queued");
  });

  it("consumes a staged share only after the material transaction saves", async () => {
    const intake: CaptureIntake = {
      id: "share-1",
      url: "https://example.com/shared",
      title: "Shared title",
      receivedAt: timestamp,
      consumedAt: null,
    };
    const state = repositories({ intake });
    const service = createCaptureService(dependencies(state.repos));

    const result = await service.captureStagedIntake("share-1", "inbox");

    expect(result.kind).toBe("saved");
    expect(state.intakes[0]?.consumedAt).toBe(timestamp);
    expect(state.materials[0]?.title).toBe("Shared title");
  });
});
