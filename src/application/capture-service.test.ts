import { describe, expect, it } from "vitest";
import { createCaptureService } from "./capture-service";
import { createLifecycleService } from "./lifecycle-service";
import { createMetadataAdapter } from "../providers/metadata-adapter";
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

  it("supports the complete capture-to-finish workflow through explicit lifecycle actions", async () => {
    const state = repositories();
    const capture = createCaptureService(dependencies(state.repos));
    const lifecycle = createLifecycleService({
      repositories: state.repos,
      generateId: (() => {
        let id = 100;
        return () => `event-${++id}`;
      })(),
      now: () => timestamp,
    });

    const captured = await capture.captureUrl(
      "https://example.com/finish-me",
      "queued",
    );
    expect(captured.kind).toBe("saved");
    if (captured.kind !== "saved") return;

    const started = await lifecycle.start(captured.material.id);
    const finished = await lifecycle.finish(started.id);

    expect(finished).toMatchObject({
      id: captured.material.id,
      status: "completed",
      originalUrl: "https://example.com/finish-me",
    });
    expect(state.materials[0]?.status).toBe("completed");
    expect(state.events.map((event) => event.type)).toEqual([
      "captured",
      "queued",
      "in-progress",
      "completed",
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

  it("rejects a consumed intake on a relaunch without creating another material", async () => {
    const intake: CaptureIntake = {
      id: "share-relaunch",
      url: "https://example.com/relaunch",
      title: null,
      receivedAt: timestamp,
      consumedAt: null,
    };
    const state = repositories({ intake });
    const firstService = createCaptureService(dependencies(state.repos));

    await expect(
      firstService.captureStagedIntake(intake.id, "queued"),
    ).resolves.toMatchObject({ kind: "saved" });

    const relaunchedService = createCaptureService(dependencies(state.repos));
    await expect(
      relaunchedService.captureStagedIntake(intake.id, "queued"),
    ).rejects.toThrow("no longer available");
    expect(state.materials).toHaveLength(1);
  });

  it("does not consume a staged intake until an explicit duplicate retry", async () => {
    const state = repositories();
    const service = createCaptureService(dependencies(state.repos));
    await service.captureUrl("https://example.com/already-saved", "inbox");

    const intake: CaptureIntake = {
      id: "share-duplicate",
      url: "https://example.com/already-saved",
      title: "Shared duplicate",
      receivedAt: timestamp,
      consumedAt: null,
    };
    await state.repos.captureIntake.stage(intake);

    const duplicate = await service.captureStagedIntake(intake.id, "queued");
    expect(duplicate.kind).toBe("duplicate");
    expect(state.intakes[0]?.consumedAt).toBeNull();
    if (duplicate.kind !== "duplicate") return;

    const retry = await duplicate.retry();
    expect(retry.kind).toBe("saved");
    expect(state.intakes[0]?.consumedAt).toBe(timestamp);
    expect(state.materials[1]?.status).toBe("queued");
  });

  it("keeps a changed title and manual estimate when provider enrichment finishes", async () => {
    let releaseProvider: ((value: unknown) => void) | undefined;
    const provider = createMetadataAdapter(
      () =>
        new Promise((resolve) => {
          releaseProvider = resolve;
        }),
    );
    const state = repositories();
    const service = createCaptureService({
      ...dependencies(state.repos),
      enrichMetadata: provider,
    });

    const result = await service.captureUrl(
      "https://example.com/article",
      "queued",
      { intakeTitle: "Shared title" },
    );
    expect(result.kind).toBe("saved");
    state.materials[0]!.title = "Edited title";
    state.materials[0]!.manualEstimatedSeconds = 0;
    releaseProvider?.({
      title: "Provider title",
      sourceDurationSeconds: 900,
      sourceDurationProvenance: "publisher-estimate",
      sourceDurationCompleteness: "full",
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(state.materials[0]).toMatchObject({
      title: "Edited title",
      manualEstimatedSeconds: 0,
      sourceDurationSeconds: null,
    });
  });

  it("keeps the saved capture durable when enrichment fails", async () => {
    const state = repositories();
    const enrichMetadata = async () => {
      throw new Error("provider unavailable");
    };
    const service = createCaptureService({
      ...dependencies(state.repos),
      enrichMetadata,
    });

    const result = await service.captureUrl(
      "https://example.com/provider-fails",
      "queued",
    );

    expect(result.kind).toBe("saved");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(state.materials).toHaveLength(1);
    expect(state.materials[0]).toMatchObject({
      originalUrl: "https://example.com/provider-fails",
      status: "queued",
      sourceDurationSeconds: null,
      sourceDurationProvenance: "unknown",
      sourceDurationCompleteness: "unknown",
    });
    expect(state.events.map((event) => event.type)).toEqual([
      "captured",
      "queued",
    ]);
  });

  it("does not apply late enrichment to a deleted capture", async () => {
    let releaseProvider: ((value: unknown) => void) | undefined;
    const provider = createMetadataAdapter(
      () =>
        new Promise((resolve) => {
          releaseProvider = resolve;
        }),
    );
    const state = repositories();
    const service = createCaptureService({
      ...dependencies(state.repos),
      enrichMetadata: provider,
    });

    const result = await service.captureUrl(
      "https://example.com/deleted-before-enrichment",
      "queued",
    );
    expect(result.kind).toBe("saved");
    const capturedId = state.materials[0]!.id;
    await state.repos.materials.delete(capturedId);
    state.materials.splice(0, 1);

    releaseProvider?.({
      title: "Provider title",
      sourceDurationSeconds: 900,
      sourceDurationProvenance: "publisher-estimate",
      sourceDurationCompleteness: "full",
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(state.materials).toEqual([]);
  });

  it("does not start enrichment when the save transaction fails", async () => {
    const state = repositories();
    let enrichmentStarted = false;
    state.repos.materials.insert = async () => {
      throw new Error("storage unavailable");
    };
    const service = createCaptureService({
      ...dependencies(state.repos),
      enrichMetadata: async () => {
        enrichmentStarted = true;
        return { title: "should not be written" };
      },
    });

    await expect(
      service.captureUrl("https://example.com/storage-fails", "inbox"),
    ).rejects.toThrow("storage unavailable");
    expect(enrichmentStarted).toBe(false);
    expect(state.materials).toEqual([]);
    expect(state.events).toEqual([]);
  });
});
