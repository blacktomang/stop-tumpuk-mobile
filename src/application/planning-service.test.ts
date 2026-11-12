import { describe, expect, it } from "vitest";
import { createPlanningService } from "./planning-service";
import type { NativeRepositories } from "../storage/sqlite/repositories";
import type { Material, Settings } from "../types";

const material = (overrides: Partial<Material> = {}): Material => ({
  id: "material-1",
  originalUrl: "https://example.com/article",
  normalizedUrl: "https://example.com/article",
  domain: "example.com",
  title: "Article",
  thumbnailUrl: null,
  type: "article",
  status: "queued",
  sourceDurationSeconds: 600,
  sourceDurationProvenance: "publisher-estimate",
  sourceDurationCompleteness: "full",
  playbackSpeed: 1,
  manualEstimatedSeconds: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const settings = (overrides: Partial<Settings> = {}): Settings => ({
  id: "settings",
  weekdayMinutes: 30,
  weekendMinutes: 60,
  onboardingDismissed: true,
  availabilityReminderAt: null,
  ...overrides,
});

function repositories(
  materials: Material[],
  currentSettings: Settings | null,
): NativeRepositories {
  return {
    materials: {
      get: async (id) => materials.find((item) => item.id === id) ?? null,
      list: async () => materials,
      findByNormalizedUrl: async () => null,
      insert: async () => undefined,
      update: async () => undefined,
      delete: async () => undefined,
    },
    settings: {
      get: async () => currentSettings,
      save: async () => undefined,
    },
    notes: {} as NativeRepositories["notes"],
    sessions: {} as NativeRepositories["sessions"],
    events: {} as NativeRepositories["events"],
    captureIntake: {} as NativeRepositories["captureIntake"],
    transaction: async (work) => work(repositories(materials, currentSettings)),
  };
}

describe("planning application service", () => {
  it("reads settings and materials to produce the capacity view", async () => {
    const service = createPlanningService({
      repositories: repositories([material()], settings()),
    });
    await expect(service.getCapacity()).resolves.toMatchObject({
      state: "under",
      activeCount: 1,
      plannedSeconds: 600,
      capacitySeconds: 16_200,
    });
  });

  it("returns one fitting recommendation and keeps manual options ordered", async () => {
    const service = createPlanningService({
      repositories: repositories(
        [
          material({ id: "long", sourceDurationSeconds: 1_200 }),
          material({ id: "short", sourceDurationSeconds: 300 }),
          material({ id: "unknown", sourceDurationSeconds: null }),
        ],
        settings(),
      ),
    });
    await expect(service.recommend(600)).resolves.toMatchObject({
      primary: { id: "short" },
      partial: null,
      manual: [{ id: "short" }, { id: "long" }, { id: "unknown" }],
    });
  });

  it("breaks equal-estimate ties by creation time and then stable ID", async () => {
    const service = createPlanningService({
      repositories: repositories(
        [
          material({
            id: "later",
            createdAt: "2026-01-02T00:00:00.000Z",
            sourceDurationSeconds: 600,
          }),
          material({
            id: "earlier",
            createdAt: "2026-01-01T00:00:00.000Z",
            sourceDurationSeconds: 600,
          }),
          material({
            id: "stable-b",
            createdAt: "2026-01-03T00:00:00.000Z",
            sourceDurationSeconds: 600,
          }),
          material({
            id: "stable-a",
            createdAt: "2026-01-03T00:00:00.000Z",
            sourceDurationSeconds: 600,
          }),
        ],
        settings(),
      ),
    });

    await expect(service.recommend(600)).resolves.toMatchObject({
      primary: { id: "earlier" },
      manual: [
        { id: "earlier" },
        { id: "later" },
        { id: "stable-a" },
        { id: "stable-b" },
      ],
    });
  });

  it("reports no fitting item and exposes the shortest longer item for a partial session", async () => {
    const service = createPlanningService({
      repositories: repositories(
        [
          material({ id: "longer", sourceDurationSeconds: 1_800 }),
          material({ id: "shorter", sourceDurationSeconds: 1_200 }),
        ],
        settings(),
      ),
    });

    await expect(service.recommend(600)).resolves.toMatchObject({
      primary: null,
      partial: { id: "shorter" },
    });
  });

  it("never treats an unknown estimate as fitting, but allows manual selection", async () => {
    const service = createPlanningService({
      repositories: repositories(
        [material({ id: "unknown", sourceDurationSeconds: null })],
        settings(),
      ),
    });

    await expect(service.recommend(600)).resolves.toMatchObject({
      primary: null,
      partial: null,
      manual: [{ id: "unknown" }],
    });
    await expect(service.selectManual("unknown")).resolves.toMatchObject({
      material: { id: "unknown" },
      estimatedSeconds: null,
    });
  });

  it("allows explicit active-item selection and rejects invalid choices", async () => {
    const service = createPlanningService({
      repositories: repositories(
        [
          material({ id: "active" }),
          material({ id: "done", status: "completed" }),
        ],
        settings(),
      ),
    });
    await expect(service.selectManual("active")).resolves.toMatchObject({
      material: { id: "active" },
      estimatedSeconds: 600,
    });
    await expect(service.selectManual("done")).rejects.toThrow(
      "Only active materials",
    );
    await expect(service.recommend(Number.NaN)).rejects.toThrow(
      "non-negative finite",
    );
  });
});
