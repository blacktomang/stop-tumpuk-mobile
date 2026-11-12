import { describe, expect, it } from "vitest";
import {
  createTimerService,
  elapsedSecondsAt,
  focusDurationSeconds,
  isExpiredAt,
  remainingSecondsAt,
} from "./timer-service";
import type { NativeRepositories } from "../storage/sqlite/repositories";
import type { LearningSession } from "../types";

const startTime = "2026-11-11T00:00:00.000Z";

function repositories(seed: LearningSession[] = []) {
  const sessions = [...seed];
  const repositories = {} as NativeRepositories;
  repositories.sessions = {
    list: async () => sessions,
    getActiveForMaterial: async (materialId) =>
      sessions.find(
        (session) =>
          session.materialId === materialId && session.state !== "ended",
      ) ?? null,
    listForMaterial: async (materialId) =>
      sessions.filter((session) => session.materialId === materialId),
    insert: async (session) => {
      sessions.push(session);
    },
    update: async (id, patch) => {
      const session = sessions.find((item) => item.id === id);
      if (session) Object.assign(session, patch);
    },
  };
  repositories.transaction = async (work) => work(repositories);
  return { repositories, sessions };
}

function dependencies(repositories: NativeRepositories, now = startTime) {
  let id = 0;
  return { repositories, generateId: () => `session-${++id}`, now: () => now };
}

describe("native timer service", () => {
  it("starts one persisted session and rejects a second active timer", async () => {
    const state = repositories();
    const service = createTimerService(dependencies(state.repositories));
    const session = await service.start("material-1");
    expect(session.state).toBe("running");
    await expect(service.start("material-1")).rejects.toThrow(
      "active focus timer",
    );
  });

  it("recalculates running elapsed time without mutating persisted state", () => {
    const session: LearningSession = {
      id: "session-1",
      materialId: "material-1",
      startedAt: startTime,
      elapsedSeconds: 10,
      state: "running",
      stateChangedAt: startTime,
      endedAt: null,
    };
    const now = "2026-11-11T00:01:05.000Z";
    expect(elapsedSecondsAt(session, now)).toBe(75);
    expect(session.elapsedSeconds).toBe(10);
    expect(remainingSecondsAt(session, now)).toBe(focusDurationSeconds - 75);
  });

  it("marks expiry as display state only and never completes the material", () => {
    const session: LearningSession = {
      id: "session-1",
      materialId: "material-1",
      startedAt: startTime,
      elapsedSeconds: focusDurationSeconds,
      state: "running",
      stateChangedAt: startTime,
      endedAt: null,
    };
    expect(isExpiredAt(session, startTime)).toBe(true);
    expect(session.state).toBe("running");
  });

  it("persists pause, resume, and end transitions with elapsed timestamps", async () => {
    const state = repositories();
    let now = startTime;
    const service = createTimerService({
      ...dependencies(state.repositories),
      now: () => now,
    });
    const session = await service.start("material-1");
    now = "2026-11-11T00:00:30.000Z";
    await service.pause(session);
    expect(state.sessions[0]).toMatchObject({
      state: "paused",
      elapsedSeconds: 30,
    });
    now = "2026-11-11T00:00:40.000Z";
    await service.resume(state.sessions[0]!);
    now = "2026-11-11T00:01:00.000Z";
    await service.end({
      ...state.sessions[0]!,
      state: "running",
      stateChangedAt: "2026-11-11T00:00:40.000Z",
    });
    expect(state.sessions[0]).toMatchObject({
      state: "ended",
      elapsedSeconds: 50,
      endedAt: now,
    });
  });

  it("rejects invalid pause and resume transitions", async () => {
    const state = repositories();
    const service = createTimerService(dependencies(state.repositories));
    const session = await service.start("material-1");

    await expect(service.resume(session)).rejects.toThrow(
      "Only a paused focus timer",
    );
    await service.pause(session);
    await expect(service.pause(state.sessions[0]!)).rejects.toThrow(
      "Only a running focus timer",
    );
    await service.end({ ...state.sessions[0]! });
    await expect(service.resume(state.sessions[0]!)).rejects.toThrow(
      "Only a paused focus timer",
    );
  });
});
