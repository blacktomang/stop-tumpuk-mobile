import { describe, expect, it } from "vitest";
import { createLifecycleService } from "./lifecycle-service";
import type { NativeRepositories } from "../storage/sqlite/repositories";
import type {
  LearningSession,
  Material,
  MaterialEvent,
  Note,
  Settings,
} from "../types";

const timestamp = "2026-11-11T00:00:00.000Z";

function material(status: Material["status"] = "inbox"): Material {
  return {
    id: "material-1",
    originalUrl: "https://example.com/article",
    normalizedUrl: "https://example.com/article",
    domain: "example.com",
    title: "Article",
    thumbnailUrl: null,
    type: "article",
    status,
    sourceDurationSeconds: 600,
    sourceDurationProvenance: "publisher-estimate",
    sourceDurationCompleteness: "full",
    playbackSpeed: 1,
    manualEstimatedSeconds: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function repositories(initial: Material): {
  repositories: NativeRepositories;
  materials: Material[];
  events: MaterialEvent[];
} {
  const materials = [initial];
  const events: MaterialEvent[] = [];
  const repositories = {} as NativeRepositories;
  repositories.materials = {
    get: async (id) => materials.find((item) => item.id === id) ?? null,
    list: async () => materials,
    findByNormalizedUrl: async () => null,
    insert: async (item) => {
      materials.push(item);
    },
    update: async (id, patch) => {
      const item = materials.find((candidate) => candidate.id === id);
      if (item) Object.assign(item, patch);
    },
    delete: async (id) => {
      const index = materials.findIndex((item) => item.id === id);
      if (index >= 0) {
        materials.splice(index, 1);
      }
    },
  };
  repositories.events = {
    list: async () => events,
    listForMaterial: async (id) =>
      events.filter((event) => event.materialId === id),
    append: async (event) => {
      events.push(event);
    },
  };
  repositories.notes = {
    list: async () => [] as Note[],
    listForMaterial: async () => [],
    get: async () => null,
    insert: async () => undefined,
    update: async () => undefined,
    delete: async () => undefined,
  };
  repositories.sessions = {
    list: async () => [] as LearningSession[],
    getActiveForMaterial: async () => null,
    listForMaterial: async () => [],
    insert: async () => undefined,
    update: async () => undefined,
  };
  repositories.settings = {
    get: async () => null,
    save: async (_settings: Settings) => undefined,
  };
  repositories.captureIntake = {
    get: async () => null,
    stage: async () => undefined,
    consume: async () => undefined,
  };
  repositories.transaction = async (work) => work(repositories);
  return { repositories, materials, events };
}

function serviceFor(state: ReturnType<typeof repositories>) {
  let nextId = 0;
  return createLifecycleService({
    repositories: state.repositories,
    generateId: () => `event-${++nextId}`,
    now: () => timestamp,
  });
}

describe("native lifecycle service", () => {
  it("records commitment, progress, and explicit completion transitions", async () => {
    const state = repositories(material());
    const service = serviceFor(state);

    await service.commit("material-1");
    await service.start("material-1");
    const finished = await service.finish("material-1");

    expect(finished.status).toBe("completed");
    expect(state.materials[0]?.status).toBe("completed");
    expect(state.events.map((event) => event.type)).toEqual([
      "queued",
      "in-progress",
      "completed",
    ]);
  });

  it("allows explicit finish without a timer or prior reading event", async () => {
    const state = repositories(material("queued"));
    const service = serviceFor(state);

    const finished = await service.finish("material-1");

    expect(finished.status).toBe("completed");
    expect(state.events).toEqual([
      {
        id: "event-1",
        materialId: "material-1",
        type: "completed",
        at: timestamp,
      },
    ]);
  });

  it("reopens and returns items without inferring completion from timer state", async () => {
    const state = repositories(material("completed"));
    const service = serviceFor(state);

    await service.reopen("material-1");
    const returned = await service.returnToInbox("material-1");

    expect(returned.status).toBe("inbox");
    expect(state.events.map((event) => event.type)).toEqual([
      "reopened",
      "returned-to-inbox",
    ]);
  });

  it("archives and deletes transactionally, while rejecting invalid transitions", async () => {
    const state = repositories(material());
    const service = serviceFor(state);

    await expect(service.finish("material-1")).rejects.toThrow(
      "Cannot finish a inbox material.",
    );
    const archived = await service.archive("material-1");
    expect(archived.status).toBe("archived");
    await service.delete("material-1");
    expect(state.materials).toHaveLength(0);
  });

  it("reports a failed explicit finish without changing material state", async () => {
    const state = repositories(material("in-progress"));
    state.repositories.transaction = async () => {
      throw new Error("database write failed");
    };
    const service = serviceFor(state);

    await expect(service.finish("material-1")).rejects.toThrow(
      "database write failed",
    );
    expect(state.materials[0]?.status).toBe("in-progress");
    expect(state.events).toHaveLength(0);
  });
});
