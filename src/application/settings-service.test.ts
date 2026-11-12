import { describe, expect, it } from "vitest";
import type { NativeRepositories } from "../storage/sqlite/repositories";
import type {
  LearningSession,
  Material,
  MaterialEvent,
  Note,
  Settings,
} from "../types";
import { createSettingsService } from "./settings-service";

function repositories(seed: Settings | null = null) {
  let settings = seed;
  let transactions = 0;
  const repos = {} as NativeRepositories;
  repos.settings = {
    get: async () => settings,
    save: async (value) => {
      settings = value;
    },
  };
  repos.materials = {
    get: async () => null,
    list: async () => [] as Material[],
    findByNormalizedUrl: async () => null,
    insert: async () => undefined,
    update: async () => undefined,
    delete: async () => undefined,
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
  repos.events = {
    list: async () => [] as MaterialEvent[],
    listForMaterial: async () => [],
    append: async () => undefined,
  };
  repos.captureIntake = {
    get: async () => null,
    stage: async () => undefined,
    consume: async () => undefined,
  };
  repos.transaction = async (work) => {
    transactions += 1;
    return work(repos);
  };
  return { repos, read: () => settings, transactions: () => transactions };
}

describe("native settings service", () => {
  it("reads an explicit default and preserves zero as distinct from unset", async () => {
    const state = repositories();
    const service = createSettingsService({ repositories: state.repos });

    expect(await service.get()).toEqual({
      id: "settings",
      weekdayMinutes: null,
      weekendMinutes: null,
      onboardingDismissed: false,
      availabilityReminderAt: null,
    });

    const saved = await service.saveAvailability(null, 0);
    expect(saved.weekdayMinutes).toBeNull();
    expect(saved.weekendMinutes).toBe(0);
    expect(await service.shouldPrompt()).toBe(true);
  });

  it("dismisses the prompt once both availability values are configured", async () => {
    const state = repositories();
    const service = createSettingsService({ repositories: state.repos });

    const saved = await service.saveAvailability(0, 45);

    expect(saved.onboardingDismissed).toBe(true);
    expect(saved.availabilityReminderAt).toBeNull();
    expect(await service.shouldPrompt()).toBe(false);
    expect(state.transactions()).toBe(1);
  });

  it("schedules a three-month reminder when availability is skipped", async () => {
    const state = repositories();
    const service = createSettingsService({
      repositories: state.repos,
      now: () => new Date("2026-11-11T00:00:00.000Z"),
    });

    const skipped = await service.skipAvailabilityPrompt();

    expect(skipped.availabilityReminderAt).toBe("2027-02-11T00:00:00.000Z");
    expect(await service.shouldPrompt()).toBe(false);

    const due = createSettingsService({
      repositories: state.repos,
      now: () => new Date("2027-02-11T00:00:00.000Z"),
    });
    expect(await due.shouldPrompt()).toBe(true);
  });

  it("clamps an end-of-month reminder and does not prompt before it is due", async () => {
    const state = repositories();
    const service = createSettingsService({
      repositories: state.repos,
      now: () => new Date("2026-01-31T00:00:00.000Z"),
    });

    const skipped = await service.skipAvailabilityPrompt();

    expect(skipped.availabilityReminderAt).toBe("2026-04-30T00:00:00.000Z");
    expect(
      await createSettingsService({
        repositories: state.repos,
        now: () => new Date("2026-04-29T23:59:59.999Z"),
      }).shouldPrompt(),
    ).toBe(false);
    expect(
      await createSettingsService({
        repositories: state.repos,
        now: () => new Date("2026-04-30T00:00:00.000Z"),
      }).shouldPrompt(),
    ).toBe(true);
  });

  it("clears a skipped reminder after saving zero-minute availability", async () => {
    const state = repositories();
    const service = createSettingsService({
      repositories: state.repos,
      now: () => new Date("2026-11-11T00:00:00.000Z"),
    });

    await service.skipAvailabilityPrompt();
    const saved = await service.saveAvailability(0, 0);

    expect(saved).toMatchObject({
      weekdayMinutes: 0,
      weekendMinutes: 0,
      onboardingDismissed: true,
      availabilityReminderAt: null,
    });
    expect(await service.shouldPrompt()).toBe(false);
  });

  it("prompts when a persisted reminder timestamp is invalid", async () => {
    const state = repositories({
      id: "settings",
      weekdayMinutes: null,
      weekendMinutes: 30,
      onboardingDismissed: true,
      availabilityReminderAt: "not-a-date",
    });
    const service = createSettingsService({ repositories: state.repos });

    await expect(service.shouldPrompt()).resolves.toBe(true);
  });

  it("rejects negative, infinite, and NaN minute values before persistence", async () => {
    const state = repositories();
    const service = createSettingsService({ repositories: state.repos });

    await expect(service.saveAvailability(-1, 10)).rejects.toThrow(
      "Weekday availability",
    );
    await expect(
      service.saveAvailability(Number.POSITIVE_INFINITY, 10),
    ).rejects.toThrow("Weekday availability");
    await expect(service.saveAvailability(10, Number.NaN)).rejects.toThrow(
      "Weekend availability",
    );
    expect(state.transactions()).toBe(0);
    expect(state.read()).toBeNull();
  });
});
