import type { TimerSnapshotPhase } from "./timer-controller";

export function formatFocusTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

export function timerTitle(phase: TimerSnapshotPhase): string {
  switch (phase) {
    case "running":
      return "Focus timer";
    case "paused":
      return "Timer paused";
    case "expired":
      return "Time is up";
    case "error":
      return "Timer unavailable";
    case "loading":
      return "Focus timer";
    case "idle":
      return "25-minute focus timer";
  }
}

export function timerMessage(phase: TimerSnapshotPhase): string {
  switch (phase) {
    case "running":
      return "Stay with this source. You can pause or end the session any time.";
    case "paused":
      return "Your session is saved. Resume when you are ready.";
    case "expired":
      return "The timer ended while you were away. The material is still unfinished.";
    case "error":
      return "Your saved timer state could not be loaded.";
    case "loading":
      return "Loading saved timer state…";
    case "idle":
      return "Optional, fixed-length focus time. It never finishes the material for you.";
  }
}
