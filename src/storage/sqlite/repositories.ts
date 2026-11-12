import type {
  CaptureIntake,
  LearningSession,
  Material,
  MaterialEvent,
  Note,
  Settings,
} from "../../types";

export interface MaterialRepository {
  get(id: string): Promise<Material | null>;
  list(): Promise<Material[]>;
  findByNormalizedUrl(normalizedUrl: string): Promise<Material | null>;
  insert(material: Material): Promise<void>;
  update(id: string, patch: Partial<Material>): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface NoteRepository {
  list(): Promise<Note[]>;
  listForMaterial(materialId: string): Promise<Note[]>;
  get(id: string): Promise<Note | null>;
  insert(note: Note): Promise<void>;
  update(id: string, patch: Pick<Note, "content" | "updatedAt">): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface SettingsRepository {
  get(): Promise<Settings | null>;
  save(settings: Settings): Promise<void>;
}

export interface SessionRepository {
  list(): Promise<LearningSession[]>;
  getActiveForMaterial(materialId: string): Promise<LearningSession | null>;
  listForMaterial(materialId: string): Promise<LearningSession[]>;
  insert(session: LearningSession): Promise<void>;
  update(id: string, patch: Partial<LearningSession>): Promise<void>;
}

export interface MaterialEventRepository {
  list(): Promise<MaterialEvent[]>;
  listForMaterial(materialId: string): Promise<MaterialEvent[]>;
  append(event: MaterialEvent): Promise<void>;
}

export interface CaptureIntakeRepository {
  get(id: string): Promise<CaptureIntake | null>;
  stage(intake: CaptureIntake): Promise<void>;
  consume(id: string, consumedAt: string): Promise<void>;
}

export interface NativeRepositories {
  materials: MaterialRepository;
  notes: NoteRepository;
  settings: SettingsRepository;
  sessions: SessionRepository;
  events: MaterialEventRepository;
  captureIntake: CaptureIntakeRepository;
  transaction<T>(
    work: (repositories: NativeRepositories) => Promise<T>,
  ): Promise<T>;
}
