import { describe, expect, it } from "vitest";
import { createNotesService } from "./notes-service";
import type { NativeRepositories } from "../storage/sqlite/repositories";
import type {
  LearningSession,
  Material,
  MaterialEvent,
  Note,
  Settings,
} from "../types";

const timestamp = "2026-11-11T00:00:00.000Z";

function repositories(seed: Note[] = []) {
  const notes = [...seed];
  const repos = {} as NativeRepositories;
  repos.notes = {
    list: async () => [...notes],
    listForMaterial: async (materialId) =>
      notes.filter((note) => note.materialId === materialId),
    get: async (id) => notes.find((note) => note.id === id) ?? null,
    insert: async (note) => {
      notes.push(note);
    },
    update: async (id, patch) => {
      const note = notes.find((item) => item.id === id);
      if (note) Object.assign(note, patch);
    },
    delete: async (id) => {
      const index = notes.findIndex((note) => note.id === id);
      if (index >= 0) {
        notes.splice(index, 1);
      }
    },
  };
  repos.materials = {
    get: async () => null,
    list: async () => [] as Material[],
    findByNormalizedUrl: async () => null,
    insert: async () => undefined,
    update: async () => undefined,
    delete: async () => undefined,
  };
  repos.sessions = {
    list: async () => [] as LearningSession[],
    getActiveForMaterial: async () => null,
    listForMaterial: async () => [],
    insert: async () => undefined,
    update: async () => undefined,
  };
  repos.events = {
    list: async () => [] as MaterialEvent[],
    listForMaterial: async () => [],
    append: async () => undefined,
  };
  repos.settings = {
    get: async () => null,
    save: async (_settings: Settings) => undefined,
  };
  repos.captureIntake = {
    get: async () => null,
    stage: async () => undefined,
    consume: async () => undefined,
  };
  repos.transaction = async (work) => work(repos);
  return { repos, notes };
}

function dependencies(repositories: NativeRepositories) {
  let sequence = 0;
  return {
    repositories,
    generateId: () => `note-${++sequence}`,
    now: () => timestamp,
  };
}

describe("native notes service", () => {
  it("creates and lists multiple notes without collapsing sibling notes", async () => {
    const state = repositories();
    const service = createNotesService(dependencies(state.repos));

    const first = await service.create("material-1", "First note");
    const second = await service.create("material-1", "Second note");

    expect(first.id).not.toBe(second.id);
    expect(await service.list("material-1")).toEqual([first, second]);
  });

  it("updates and deletes by note ID while preserving sibling notes", async () => {
    const state = repositories();
    const service = createNotesService(dependencies(state.repos));
    const first = await service.create("material-1", "Keep this sibling");
    const second = await service.create("material-1", "Change this note");

    const updated = await service.update(second.id, "Changed text");
    await service.delete(second.id);

    expect(updated).toMatchObject({ id: second.id, content: "Changed text" });
    expect(state.notes).toEqual([first]);
  });

  it("searches plain text case-insensitively and can scope by material", async () => {
    const state = repositories();
    const service = createNotesService(dependencies(state.repos));
    await service.create("material-1", "Remember the lighthouse");
    await service.create("material-1", "A different idea");
    await service.create("material-2", "Lighthouse in another material");

    expect(
      (await service.search("LIGHTHOUSE", "material-1")).map(
        (note) => note.content,
      ),
    ).toEqual(["Remember the lighthouse"]);
    expect(await service.search("idea", "material-2")).toEqual([]);
  });

  it("rejects empty content and missing note IDs", async () => {
    const service = createNotesService(dependencies(repositories().repos));

    await expect(service.create("material-1", "   ")).rejects.toThrow(
      "content must not be empty",
    );
    await expect(service.update("missing", "text")).rejects.toThrow(
      "Note not found: missing",
    );
    await expect(service.delete("missing")).rejects.toThrow(
      "Note not found: missing",
    );
  });
});
