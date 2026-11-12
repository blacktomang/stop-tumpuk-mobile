import { decideWebViewNavigation } from "../../application/webview-policy";

export type ReadingLoadPhase = "loading" | "ready" | "error";

export interface ReadingState {
  phase: ReadingLoadPhase;
  progress: number;
  errorMessage: string | null;
}

export function initialReadingState(): ReadingState {
  return { phase: "loading", progress: 0, errorMessage: null };
}

export function readingLoadStarted(): ReadingState {
  return initialReadingState();
}

export function readingProgressChanged(
  state: ReadingState,
  progress: number,
): ReadingState {
  return {
    ...state,
    phase: state.phase === "error" ? "error" : "loading",
    progress: Math.max(
      0,
      Math.min(1, Number.isFinite(progress) ? progress : 0),
    ),
  };
}

export function readingLoadFinished(state: ReadingState): ReadingState {
  return { ...state, phase: "ready", progress: 1, errorMessage: null };
}

export function readingLoadFailed(
  state: ReadingState,
  message = "The source could not be loaded in the reader.",
): ReadingState {
  return { ...state, phase: "error", errorMessage: message };
}

export function validateReadingUrl(rawUrl: unknown): string | null {
  if (typeof rawUrl !== "string") return null;
  const decision = decideWebViewNavigation(rawUrl);
  return decision.kind === "allow" ? decision.url : null;
}
