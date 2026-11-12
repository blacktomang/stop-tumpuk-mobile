import {
  nextAvailabilityReminder,
  shouldPromptForAvailability,
} from "./availability-reminder";
import type { NativeRepositories } from "../storage/sqlite/repositories";
import type { Settings } from "../types";

export interface SettingsServiceDependencies {
  repositories: NativeRepositories;
  now?: () => Date;
}

const emptySettings = (): Settings => ({
  id: "settings",
  weekdayMinutes: null,
  weekendMinutes: null,
  onboardingDismissed: false,
  availabilityReminderAt: null,
});

function validateMinutes(value: number | null, label: string): void {
  if (value !== null && (!Number.isFinite(value) || value < 0)) {
    throw new Error(`${label} must be null or a non-negative finite number.`);
  }
}

/** Application boundary for the singleton settings row and availability prompt. */
export function createSettingsService(
  dependencies: SettingsServiceDependencies,
) {
  const now = dependencies.now ?? (() => new Date());

  async function get(): Promise<Settings> {
    return (await dependencies.repositories.settings.get()) ?? emptySettings();
  }

  async function saveAvailability(
    weekdayMinutes: number | null,
    weekendMinutes: number | null,
  ): Promise<Settings> {
    validateMinutes(weekdayMinutes, "Weekday availability");
    validateMinutes(weekendMinutes, "Weekend availability");

    return dependencies.repositories.transaction(async (repositories) => {
      const current = (await repositories.settings.get()) ?? emptySettings();
      const complete = weekdayMinutes !== null && weekendMinutes !== null;
      const updated: Settings = {
        ...current,
        weekdayMinutes,
        weekendMinutes,
        onboardingDismissed: complete,
        availabilityReminderAt: null,
      };
      await repositories.settings.save(updated);
      return updated;
    });
  }

  async function skipAvailabilityPrompt(): Promise<Settings> {
    return dependencies.repositories.transaction(async (repositories) => {
      const current = (await repositories.settings.get()) ?? emptySettings();
      const updated: Settings = {
        ...current,
        onboardingDismissed: true,
        availabilityReminderAt: nextAvailabilityReminder(now()),
      };
      await repositories.settings.save(updated);
      return updated;
    });
  }

  async function shouldPrompt(): Promise<boolean> {
    return shouldPromptForAvailability(await get(), now());
  }

  return { get, saveAvailability, skipAvailabilityPrompt, shouldPrompt };
}
