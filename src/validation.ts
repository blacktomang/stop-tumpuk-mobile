import type {
  CaptureIntake,
  DurationCompleteness,
  DurationProvenance,
  LearningSession,
  Material,
  MaterialEvent,
  MaterialStatus,
  MaterialType,
  Note,
  SessionState,
  Settings,
} from "./types";

type RecordValue = Record<string, unknown>;

const materialStatuses: readonly MaterialStatus[] = [
  "inbox",
  "queued",
  "in-progress",
  "completed",
  "archived",
];
const materialTypes: readonly MaterialType[] = ["article", "video", "unknown"];
const durationProvenances: readonly DurationProvenance[] = [
  "api-runtime",
  "publisher-estimate",
  "word-count",
  "manual",
  "unknown",
];
const durationCompleteness: readonly DurationCompleteness[] = [
  "full",
  "partial",
  "unknown",
];
const sessionStates: readonly SessionState[] = ["running", "paused", "ended"];
const eventTypes: readonly MaterialEvent["type"][] = [
  "captured",
  "queued",
  "in-progress",
  "completed",
  "reopened",
  "returned-to-inbox",
  "archived",
  "deleted",
];

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.trim().length > 0;
}

function isNullableHttpUrl(value: unknown): value is string | null {
  return value === null || isHttpUrl(value);
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isIsoTimestamp(value: unknown): value is string {
  return isString(value) && !Number.isNaN(Date.parse(value));
}

function isHttpUrl(value: unknown): value is string {
  if (!isString(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function hasValue<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return isString(value) && values.includes(value as T);
}

export function isMaterial(value: unknown): value is Material {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isHttpUrl(value.originalUrl) &&
    isHttpUrl(value.normalizedUrl) &&
    isNonEmptyString(value.domain) &&
    isNonEmptyString(value.title) &&
    isNullableHttpUrl(value.thumbnailUrl) &&
    hasValue(materialTypes, value.type) &&
    hasValue(materialStatuses, value.status) &&
    (value.sourceDurationSeconds === null ||
      isNonNegativeFiniteNumber(value.sourceDurationSeconds)) &&
    hasValue(durationProvenances, value.sourceDurationProvenance) &&
    hasValue(durationCompleteness, value.sourceDurationCompleteness) &&
    isPositiveFiniteNumber(value.playbackSpeed) &&
    (value.manualEstimatedSeconds === null ||
      isNonNegativeFiniteNumber(value.manualEstimatedSeconds)) &&
    isIsoTimestamp(value.createdAt) &&
    isIsoTimestamp(value.updatedAt)
  );
}

export function isSettings(value: unknown): value is Settings {
  if (!isRecord(value)) return false;
  return (
    value.id === "settings" &&
    (value.weekdayMinutes === null ||
      isNonNegativeFiniteNumber(value.weekdayMinutes)) &&
    (value.weekendMinutes === null ||
      isNonNegativeFiniteNumber(value.weekendMinutes)) &&
    typeof value.onboardingDismissed === "boolean" &&
    (value.availabilityReminderAt === null ||
      isIsoTimestamp(value.availabilityReminderAt))
  );
}

export function isMaterialEvent(value: unknown): value is MaterialEvent {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.materialId) &&
    hasValue(eventTypes, value.type) &&
    isIsoTimestamp(value.at)
  );
}

export function isNote(value: unknown): value is Note {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.materialId) &&
    isNonEmptyString(value.content) &&
    isIsoTimestamp(value.createdAt) &&
    isIsoTimestamp(value.updatedAt)
  );
}

export function isLearningSession(value: unknown): value is LearningSession {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.materialId) &&
    isIsoTimestamp(value.startedAt) &&
    isNonNegativeFiniteNumber(value.elapsedSeconds) &&
    hasValue(sessionStates, value.state) &&
    isIsoTimestamp(value.stateChangedAt) &&
    (value.endedAt === null || isIsoTimestamp(value.endedAt))
  );
}

export function isCaptureIntake(value: unknown): value is CaptureIntake {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isHttpUrl(value.url) &&
    (value.title === null || isString(value.title)) &&
    isIsoTimestamp(value.receivedAt) &&
    (value.consumedAt === null || isIsoTimestamp(value.consumedAt))
  );
}

export function parseMaterial(value: unknown): Material {
  if (!isMaterial(value)) throw new Error("Invalid material record.");
  return value;
}

export function parseSettings(value: unknown): Settings {
  if (!isSettings(value)) throw new Error("Invalid settings record.");
  return value;
}

export function parseNote(value: unknown): Note {
  if (!isNote(value)) throw new Error("Invalid note record.");
  return value;
}

export function parseLearningSession(value: unknown): LearningSession {
  if (!isLearningSession(value))
    throw new Error("Invalid learning session record.");
  return value;
}

export function parseMaterialEvent(value: unknown): MaterialEvent {
  if (!isMaterialEvent(value))
    throw new Error("Invalid material event record.");
  return value;
}

export function parseCaptureIntake(value: unknown): CaptureIntake {
  if (!isCaptureIntake(value))
    throw new Error("Invalid capture intake record.");
  return value;
}
