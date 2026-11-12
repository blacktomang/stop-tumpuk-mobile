import type { NativeRepositories } from "../storage/sqlite/repositories";
import type { Note } from "../types";

export interface NotesServiceDependencies {
  repositories: NativeRepositories;
  generateId: () => string;
  now: () => string;
}

export interface NotesService {
  create(materialId: string, content: string): Promise<Note>;
  update(noteId: string, content: string): Promise<Note>;
  delete(noteId: string): Promise<void>;
  list(materialId?: string): Promise<Note[]>;
  search(query: string, materialId?: string): Promise<Note[]>;
}

function requireText(value: string, field: string): void {
  if (!value.trim()) {
    throw new Error(`${field} must not be empty`);
  }
}

function matchesQuery(note: Note, query: string): boolean {
  return note.content.toLocaleLowerCase().includes(query.toLocaleLowerCase());
}

export function createNotesService(
  dependencies: NotesServiceDependencies,
): NotesService {
  const { repositories, generateId, now } = dependencies;

  return {
    async create(materialId, content) {
      requireText(materialId, "materialId");
      requireText(content, "content");
      const timestamp = now();
      const note: Note = {
        id: generateId(),
        materialId,
        content,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await repositories.transaction(async (transactionRepositories) => {
        await transactionRepositories.notes.insert(note);
      });
      return note;
    },

    async update(noteId, content) {
      requireText(noteId, "noteId");
      requireText(content, "content");
      return repositories.transaction(async (transactionRepositories) => {
        const existing = await transactionRepositories.notes.get(noteId);
        if (!existing) throw new Error(`Note not found: ${noteId}`);
        const updatedAt = now();
        await transactionRepositories.notes.update(noteId, {
          content,
          updatedAt,
        });
        return { ...existing, content, updatedAt };
      });
    },

    async delete(noteId) {
      requireText(noteId, "noteId");
      await repositories.transaction(async (transactionRepositories) => {
        const existing = await transactionRepositories.notes.get(noteId);
        if (!existing) throw new Error(`Note not found: ${noteId}`);
        await transactionRepositories.notes.delete(noteId);
      });
    },

    async list(materialId) {
      if (materialId !== undefined) {
        requireText(materialId, "materialId");
        return repositories.notes.listForMaterial(materialId);
      }
      return repositories.notes.list();
    },

    async search(query, materialId) {
      const notes = await this.list(materialId);
      const normalizedQuery = query.trim();
      if (!normalizedQuery) return notes;
      return notes.filter((note) => matchesQuery(note, normalizedQuery));
    },
  };
}
