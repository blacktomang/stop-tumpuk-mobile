import { describe, expect, it } from "vitest";
import type { NativeRepositories } from "../../storage/sqlite/repositories";
import type { LearningSession } from "../../types";
import {
  createTimerController,
  type TimerAppStateAdapter,
  type TimerScheduler,
} from "./timer-controller";

const startTime = "2026-11-12T00:00:00.000Z";

function testRepositories(seed: LearningSession[] = []) {
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

function appStateFake() {
  let listener: ((state: string) => void) | null = null;
  let removed = 0;
  const appState: TimerAppStateAdapter = {
    addEventListener: (_event, nextListener) => {
      listener = nextListener;
      return { remove: () => (removed += 1) };
    },
  };
  return {
    appState,
    emit: (state: string) => listener?.(state),
    removed: () => removed,
  };
}

function schedulerFake() {
  let callback: (() => void) | null = null;
  let cleared = 0;
  const scheduler: TimerScheduler = {
    setInterval: (nextCallback) => {
      callback = nextCallback;
      return 1 as ReturnType<typeof setInterval>;
    },
    clearInterval: () => {
      cleared += 1;
    },
  };
  return {
    scheduler,
    tick: () => callback?.(),
    cleared: () => cleared,
  };
}

describe("native reading timer controller", () => {
  it("loads and recalculates a persisted running session on foreground", async () => {
    const session: LearningSession = {
      id: "session-1",
      materialId: "material-1",
      startedAt: startTime,
      elapsedSeconds: 10,
      state: "running",
      stateChangedAt: startTime,
      endedAt: null,
    };
    const state = testRepositories([session]);
    const appState = appStateFake();
    const scheduler = schedulerFake();
    let now = startTime;
    const controller = createTimerController({
      repositories: state.repositories,
      materialId: "material-1",
      generateId: () => "unused",
      now: () => now,
      appState: appState.appState,
      scheduler: scheduler.scheduler,
    });
    await controller.load();
    now = "2026-11-12T00:01:00.000Z";
    appState.emit("active");
    await Promise.resolve();
    const snapshots: string[] = [];
    const unsubscribe = controller.subscribe((next) =>
      snapshots.push(`${next.phase}:${next.elapsedSeconds}`),
    );
    scheduler.tick();
    await Promise.resolve();
    expect(snapshots.at(-1)).toBe("running:70");
    unsubscribe();
    controller.dispose();
    expect(appState.removed()).toBe(1);
    expect(scheduler.cleared()).toBe(1);
  });

  it("shows recovery state at expiry without completing the material", async () => {
    const state = testRepositories([
      {
        id: "session-1",
        materialId: "material-1",
        startedAt: startTime,
        elapsedSeconds: 25 * 60,
        state: "running",
        stateChangedAt: startTime,
        endedAt: null,
      },
    ]);
    const appState = appStateFake();
    const controller = createTimerController({
      repositories: state.repositories,
      materialId: "material-1",
      generateId: () => "unused",
      now: () => startTime,
      appState: appState.appState,
      scheduler: schedulerFake().scheduler,
    });
    const snapshots: string[] = [];
    controller.subscribe((next) => snapshots.push(next.phase));
    await controller.load();
    expect(snapshots.at(-1)).toBe("expired");
    expect(state.sessions[0]?.state).toBe("running");
    // The controller only owns session state; expiry has no completion command.
    expect(controller).not.toHaveProperty("finish");
    controller.dispose();
  });

  it("persists start, pause, resume, and explicit end through the controller", async () => {
    const state = testRepositories();
    const appState = appStateFake();
    let now = startTime;
    const controller = createTimerController({
      repositories: state.repositories,
      materialId: "material-1",
      generateId: () => "session-1",
      now: () => now,
      appState: appState.appState,
      scheduler: schedulerFake().scheduler,
    });
    await controller.load();
    await controller.start();
    now = "2026-11-12T00:00:30.000Z";
    await controller.pause();
    expect(state.sessions[0]).toMatchObject({
      state: "paused",
      elapsedSeconds: 30,
    });
    await controller.resume();
    now = "2026-11-12T00:00:45.000Z";
    await controller.end();
    expect(state.sessions[0]).toMatchObject({
      state: "ended",
      elapsedSeconds: 45,
    });
    controller.dispose();
  });
});
