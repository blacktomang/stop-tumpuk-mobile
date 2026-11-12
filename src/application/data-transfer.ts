import type {
  LearningSession,
  Material,
  MaterialEvent,
  Note,
  Settings,
} from "../types";
import type { NativeRepositories } from "../storage/sqlite/repositories";

/** This marker is independent from the native SQLite schema version. */
export const exportFormat = "stop-tumpuk-reading-plan";
export const exportVersion = 1;

export interface ExportEnvelope {
  format: typeof exportFormat;
  version: typeof exportVersion;
  exportedAt: string;
  materials: Material[];
  notes: Note[];
  settings: Settings | null;
  events: MaterialEvent[];
  sessions: LearningSession[];
}

export interface ExistingRecordIds {
  materialIds: ReadonlySet<string>;
  noteIds: ReadonlySet<string>;
  eventIds: ReadonlySet<string>;
  sessionIds: ReadonlySet<string>;
  hasSettings: boolean;
}

export interface ImportPreview {
  data: ExportEnvelope;
  conflicts: number;
  importable: number;
  additions: {
    materials: Material[];
    notes: Note[];
    events: MaterialEvent[];
    sessions: LearningSession[];
    settings: Settings | null;
  };
}

const statuses = new Set<Material["status"]>([
  "inbox",
  "queued",
  "in-progress",
  "completed",
  "archived",
]);
const materialTypes = new Set<Material["type"]>([
  "article",
  "video",
  "unknown",
]);
const provenances = new Set<Material["sourceDurationProvenance"]>([
  "api-runtime",
  "publisher-estimate",
  "word-count",
  "manual",
  "unknown",
]);
const completenessValues = new Set<Material["sourceDurationCompleteness"]>([
  "full",
  "partial",
  "unknown",
]);
const eventTypes = new Set<MaterialEvent["type"]>([
  "captured",
  "queued",
  "in-progress",
  "completed",
  "reopened",
  "returned-to-inbox",
  "archived",
  "deleted",
]);
const sessionStates = new Set<LearningSession["state"]>([
  "running",
  "paused",
  "ended",
]);

function record(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(message);
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, message: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(message);
  return value;
}

function nullableNumber(value: unknown, message: string): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    throw new Error(message);
  return value;
}

function positiveNumber(value: unknown, message: string): number {
  const number = nullableNumber(value, message);
  if (number === null || number === 0) throw new Error(message);
  return number;
}

function array(value: unknown, message: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(message);
  return value;
}

function validDate(value: unknown, message: string): string {
  const parsed = requiredString(value, message);
  if (Number.isNaN(Date.parse(parsed))) throw new Error(message);
  return parsed;
}

function validUrl(
  value: unknown,
  message = "Each material needs a URL.",
): string {
  const raw = requiredString(value, message);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(message);
  }
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("Each material needs an HTTP(S) URL.");
  return url.toString();
}

function material(value: unknown): Material {
  const input = record(value, "A material record is invalid.");
  const status = requiredString(input.status, "A material status is invalid.");
  const type = requiredString(input.type, "A material type is invalid.");
  const provenance = requiredString(
    input.sourceDurationProvenance,
    "A duration provenance is invalid.",
  );
  const completeness = requiredString(
    input.sourceDurationCompleteness,
    "A duration completeness value is invalid.",
  );
  if (
    !statuses.has(status as Material["status"]) ||
    !materialTypes.has(type as Material["type"]) ||
    !provenances.has(provenance as Material["sourceDurationProvenance"]) ||
    !completenessValues.has(
      completeness as Material["sourceDurationCompleteness"],
    )
  ) {
    throw new Error("A material record is invalid.");
  }
  return {
    id: requiredString(input.id, "A material ID is missing."),
    originalUrl: validUrl(input.originalUrl),
    normalizedUrl: validUrl(input.normalizedUrl),
    domain: requiredString(input.domain, "A material domain is missing."),
    title: requiredString(input.title, "A material title is missing."),
    thumbnailUrl:
      input.thumbnailUrl === null
        ? null
        : validUrl(input.thumbnailUrl, "A thumbnail URL is invalid."),
    type: type as Material["type"],
    status: status as Material["status"],
    sourceDurationSeconds: nullableNumber(
      input.sourceDurationSeconds,
      "A source duration is invalid.",
    ),
    sourceDurationProvenance:
      provenance as Material["sourceDurationProvenance"],
    sourceDurationCompleteness:
      completeness as Material["sourceDurationCompleteness"],
    playbackSpeed: positiveNumber(
      input.playbackSpeed,
      "A playback speed is invalid.",
    ),
    manualEstimatedSeconds: nullableNumber(
      input.manualEstimatedSeconds,
      "A manual estimate is invalid.",
    ),
    createdAt: validDate(input.createdAt, "A material date is invalid."),
    updatedAt: validDate(input.updatedAt, "A material date is invalid."),
  };
}

function note(value: unknown): Note {
  const input = record(value, "A note record is invalid.");
  return {
    id: requiredString(input.id, "A note ID is missing."),
    materialId: requiredString(
      input.materialId,
      "A note material ID is missing.",
    ),
    content: requiredString(input.content, "A note cannot be empty."),
    createdAt: validDate(input.createdAt, "A note date is invalid."),
    updatedAt: validDate(input.updatedAt, "A note date is invalid."),
  };
}

function settings(value: unknown): Settings | null {
  if (value === null) return null;
  const input = record(value, "Settings are invalid.");
  if (input.id !== "settings" || typeof input.onboardingDismissed !== "boolean")
    throw new Error("Settings are invalid.");
  return {
    id: "settings",
    weekdayMinutes: nullableNumber(
      input.weekdayMinutes,
      "Weekday availability is invalid.",
    ),
    weekendMinutes: nullableNumber(
      input.weekendMinutes,
      "Weekend availability is invalid.",
    ),
    onboardingDismissed: input.onboardingDismissed,
    availabilityReminderAt:
      input.availabilityReminderAt === null
        ? null
        : validDate(
            input.availabilityReminderAt,
            "Availability reminder is invalid.",
          ),
  };
}

function event(value: unknown): MaterialEvent {
  const input = record(value, "An event record is invalid.");
  const type = requiredString(input.type, "An event type is invalid.");
  if (!eventTypes.has(type as MaterialEvent["type"]))
    throw new Error("An event type is invalid.");
  return {
    id: requiredString(input.id, "An event ID is missing."),
    materialId: requiredString(
      input.materialId,
      "An event material ID is missing.",
    ),
    type: type as MaterialEvent["type"],
    at: validDate(input.at, "An event date is invalid."),
  };
}

function session(value: unknown): LearningSession {
  const input = record(value, "A session record is invalid.");
  const state = requiredString(input.state, "A session state is invalid.");
  if (!sessionStates.has(state as LearningSession["state"]))
    throw new Error("A session state is invalid.");
  return {
    id: requiredString(input.id, "A session ID is missing."),
    materialId: requiredString(
      input.materialId,
      "A session material ID is missing.",
    ),
    startedAt: validDate(input.startedAt, "A session date is invalid."),
    elapsedSeconds:
      nullableNumber(input.elapsedSeconds, "Elapsed time is invalid.") ?? 0,
    state: state as LearningSession["state"],
    stateChangedAt: validDate(
      input.stateChangedAt,
      "A session date is invalid.",
    ),
    endedAt:
      input.endedAt === null
        ? null
        : validDate(input.endedAt, "A session date is invalid."),
  };
}

function ensureUnique(records: Array<{ id: string }>, message: string): void {
  if (new Set(records.map((item) => item.id)).size !== records.length)
    throw new Error(message);
}

/** Validates and normalizes an untrusted current-format backup without touching storage. */
export function validateEnvelope(value: unknown): ExportEnvelope {
  const input = record(value, "Choose a valid stop-tumpuk export file.");
  if (input.format !== exportFormat || input.version !== exportVersion)
    throw new Error("This export format is not supported.");
  const data: ExportEnvelope = {
    format: exportFormat,
    version: exportVersion,
    exportedAt: validDate(input.exportedAt, "The export date is invalid."),
    materials: array(input.materials, "Materials are invalid.").map(material),
    notes: array(input.notes, "Notes are invalid.").map(note),
    settings: settings(input.settings),
    events: array(input.events, "Events are invalid.").map(event),
    sessions: array(input.sessions, "Sessions are invalid.").map(session),
  };
  ensureUnique(data.materials, "Material IDs must be unique.");
  ensureUnique(data.notes, "Note IDs must be unique.");
  ensureUnique(data.events, "Event IDs must be unique.");
  ensureUnique(data.sessions, "Session IDs must be unique.");
  const materialIds = new Set(data.materials.map((item) => item.id));
  for (const item of [...data.notes, ...data.events, ...data.sessions]) {
    if (!materialIds.has(item.materialId))
      throw new Error(
        "Every imported note, event, and session must reference an imported material.",
      );
  }
  return data;
}

export function parseExport(value: string): ExportEnvelope {
  try {
    return validateEnvelope(JSON.parse(value) as unknown);
  } catch (error) {
    if (error instanceof SyntaxError)
      throw new Error("Choose a valid stop-tumpuk export file.");
    throw error;
  }
}

export function serializeExport(data: ExportEnvelope): string {
  return JSON.stringify(validateEnvelope(data));
}

function additions<T extends { id: string }>(
  records: T[],
  existing: ReadonlySet<string>,
): T[] {
  return records.filter((record) => !existing.has(record.id));
}

/** Builds an additive import plan; a repository applies `additions` in one transaction. */
export function previewImport(
  value: string | ExportEnvelope,
  existing: ExistingRecordIds,
): ImportPreview {
  const data =
    typeof value === "string" ? parseExport(value) : validateEnvelope(value);
  const materials = additions(data.materials, existing.materialIds);
  const notes = additions(data.notes, existing.noteIds);
  const events = additions(data.events, existing.eventIds);
  const sessions = additions(data.sessions, existing.sessionIds);
  const settingsConflict =
    data.settings !== null && existing.hasSettings ? 1 : 0;
  const conflicts =
    data.materials.length -
    materials.length +
    (data.notes.length - notes.length) +
    (data.events.length - events.length) +
    (data.sessions.length - sessions.length) +
    settingsConflict;
  return {
    data,
    conflicts,
    importable:
      materials.length +
      notes.length +
      events.length +
      sessions.length +
      (data.settings && !settingsConflict ? 1 : 0),
    additions: {
      materials,
      notes,
      events,
      sessions,
      settings: data.settings && !settingsConflict ? data.settings : null,
    },
  };
}

/** Validates and applies an additive import through repository transaction boundaries. */
export async function importData(
  value: string | ExportEnvelope,
  repositories: NativeRepositories,
): Promise<ImportPreview> {
  const data =
    typeof value === "string" ? parseExport(value) : validateEnvelope(value);
  return repositories.transaction(async (transactionRepositories) => {
    const [materials, notes, events, sessions, settings] = await Promise.all([
      transactionRepositories.materials.list(),
      transactionRepositories.notes.list(),
      transactionRepositories.events.list(),
      transactionRepositories.sessions.list(),
      transactionRepositories.settings.get(),
    ]);
    const preview = previewImport(data, {
      materialIds: new Set(materials.map((item) => item.id)),
      noteIds: new Set(notes.map((item) => item.id)),
      eventIds: new Set(events.map((item) => item.id)),
      sessionIds: new Set(sessions.map((item) => item.id)),
      hasSettings: settings !== null,
    });
    for (const material of preview.additions.materials)
      await transactionRepositories.materials.insert(material);
    for (const note of preview.additions.notes)
      await transactionRepositories.notes.insert(note);
    for (const event of preview.additions.events)
      await transactionRepositories.events.append(event);
    for (const session of preview.additions.sessions)
      await transactionRepositories.sessions.insert(session);
    if (preview.additions.settings)
      await transactionRepositories.settings.save(preview.additions.settings);
    return preview;
  });
}
