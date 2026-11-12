import {
  createTimerService,
  elapsedSecondsAt,
  isExpiredAt,
  remainingSecondsAt,
} from "../../application/timer-service";
import type { NativeRepositories } from "../../storage/sqlite/repositories";
import type { LearningSession } from "../../types";

export type TimerSnapshotPhase =
  "loading" | "idle" | "running" | "paused" | "expired" | "error";

export interface TimerSnapshot {
  phase: TimerSnapshotPhase;
  session: LearningSession | null;
  elapsedSeconds: number;
  remainingSeconds: number;
  errorMessage: string | null;
}

export interface TimerAppStateAdapter {
  addEventListener(
    event: "change",
    listener: (state: string) => void,
  ): { remove: () => void };
}

export interface TimerScheduler {
  setInterval(
    callback: () => void,
    delay: number,
  ): ReturnType<typeof setInterval>;
  clearInterval(handle: ReturnType<typeof setInterval>): void;
}

export interface TimerControllerDependencies {
  repositories: NativeRepositories;
  materialId: string;
  generateId: () => string;
  now: () => string;
  appState: TimerAppStateAdapter;
  scheduler?: TimerScheduler;
  tickMilliseconds?: number;
}

const defaultScheduler: TimerScheduler = {
  setInterval: (callback, delay) => setInterval(callback, delay),
  clearInterval: (handle) => clearInterval(handle),
};

export const initialTimerSnapshot: TimerSnapshot = {
  phase: "loading",
  session: null,
  elapsedSeconds: 0,
  remainingSeconds: 0,
  errorMessage: null,
};

function snapshotFor(
  session: LearningSession | null,
  now: string,
): TimerSnapshot {
  if (!session) {
    return {
      ...initialTimerSnapshot,
      phase: "idle",
      errorMessage: null,
    };
  }
  const elapsedSeconds = elapsedSecondsAt(session, now);
  const remainingSeconds = remainingSecondsAt(session, now);
  return {
    phase:
      session.state === "running" && isExpiredAt(session, now)
        ? "expired"
        : session.state === "ended"
          ? "idle"
          : session.state,
    session,
    elapsedSeconds,
    remainingSeconds,
    errorMessage: null,
  };
}

export function createTimerController(
  dependencies: TimerControllerDependencies,
) {
  const scheduler = dependencies.scheduler ?? defaultScheduler;
  const tickMilliseconds = dependencies.tickMilliseconds ?? 1000;
  const timerService = createTimerService(dependencies);
  const listeners = new Set<(snapshot: TimerSnapshot) => void>();
  let snapshot: TimerSnapshot = initialTimerSnapshot;
  let disposed = false;
  let intervalHandle: ReturnType<typeof setInterval> | null = null;

  const publish = (nextSnapshot: TimerSnapshot) => {
    if (disposed) return;
    snapshot = nextSnapshot;
    listeners.forEach((listener) => listener(snapshot));
  };

  const refresh = async (): Promise<TimerSnapshot> => {
    if (disposed) return snapshot;
    try {
      const session =
        await dependencies.repositories.sessions.getActiveForMaterial(
          dependencies.materialId,
        );
      const nextSnapshot = snapshotFor(session, dependencies.now());
      publish(nextSnapshot);
      return nextSnapshot;
    } catch (error) {
      const nextSnapshot: TimerSnapshot = {
        ...snapshot,
        phase: "error",
        errorMessage:
          error instanceof Error
            ? error.message
            : "The focus timer could not be loaded.",
      };
      publish(nextSnapshot);
      return nextSnapshot;
    }
  };

  const onAppStateChange = (state: string) => {
    if (state === "active") void refresh();
  };
  const subscription = dependencies.appState.addEventListener(
    "change",
    onAppStateChange,
  );

  const startTicker = () => {
    if (intervalHandle !== null) return;
    intervalHandle = scheduler.setInterval(
      () => void refresh(),
      tickMilliseconds,
    );
  };
  startTicker();

  async function load(): Promise<TimerSnapshot> {
    publish({ ...initialTimerSnapshot });
    return refresh();
  }

  async function start(): Promise<TimerSnapshot> {
    await timerService.start(dependencies.materialId);
    return refresh();
  }

  async function pause(): Promise<TimerSnapshot> {
    if (snapshot.phase !== "running" || !snapshot.session) {
      throw new Error("Only a running focus timer can be paused.");
    }
    await timerService.pause(snapshot.session);
    return refresh();
  }

  async function resume(): Promise<TimerSnapshot> {
    if (snapshot.phase !== "paused" || !snapshot.session) {
      throw new Error("Only a paused focus timer can be resumed.");
    }
    if (snapshot.remainingSeconds === 0) {
      throw new Error(
        "This focus timer has expired. End it before starting another.",
      );
    }
    await timerService.resume(snapshot.session);
    return refresh();
  }

  async function end(): Promise<TimerSnapshot> {
    if (
      !snapshot.session ||
      !["running", "paused", "expired"].includes(snapshot.phase)
    ) {
      throw new Error("There is no active focus timer to end.");
    }
    await timerService.end(snapshot.session);
    return refresh();
  }

  function subscribe(listener: (nextSnapshot: TimerSnapshot) => void) {
    listeners.add(listener);
    listener(snapshot);
    return () => listeners.delete(listener);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    subscription.remove();
    if (intervalHandle !== null) scheduler.clearInterval(intervalHandle);
    intervalHandle = null;
    listeners.clear();
  }

  return {
    end,
    load,
    pause,
    refresh,
    resume,
    start,
    subscribe,
    dispose,
  };
}
