import { describe, expect, it } from "vitest";
import type { NativeRepositories } from "../storage/sqlite/repositories";
import type { CaptureIntake } from "../types";
import {
  createAndroidShareIntentRedirector,
  parseAndroidSharePayloads,
} from "./android-share-intent";

function repositories(intakes: CaptureIntake[] = []): NativeRepositories {
  return {
    materials: {} as NativeRepositories["materials"],
    notes: {} as NativeRepositories["notes"],
    settings: {} as NativeRepositories["settings"],
    sessions: {} as NativeRepositories["sessions"],
    events: {} as NativeRepositories["events"],
    captureIntake: {
      get: async (id) => intakes.find((intake) => intake.id === id) ?? null,
      stage: async (intake) => {
        intakes.push(intake);
      },
      consume: async () => undefined,
    },
    transaction: async (work) => work(repositories(intakes)),
  };
}

describe("Android share intent boundary", () => {
  it("accepts URL and text payloads without persisting the original text", () => {
    expect(
      parseAndroidSharePayloads([
        {
          value: "Read this https://example.com/lesson today",
          shareType: "text",
          mimeType: "text/plain",
        },
      ]),
    ).toEqual({
      text: "Read this https://example.com/lesson today",
    });
    expect(
      parseAndroidSharePayloads([
        { value: "https://example.com/lesson", shareType: "url" },
      ]),
    ).toEqual({ url: "https://example.com/lesson" });
  });

  it("rejects malformed and unsupported payloads", () => {
    expect(() => parseAndroidSharePayloads([])).toThrow();
    expect(() =>
      parseAndroidSharePayloads([
        {
          value: "content://private/file",
          shareType: "file",
          mimeType: "image/png",
        },
      ]),
    ).toThrow();
    expect(() =>
      parseAndroidSharePayloads([{ value: 42, shareType: "text" }]),
    ).toThrow();
  });

  it("stages the URL and redirects to the normal capture form", async () => {
    const intakes: CaptureIntake[] = [];
    let cleared = 0;
    const redirect = createAndroidShareIntentRedirector({
      getSharedPayloads: () => [
        {
          value: "Save this https://example.com/lesson",
          shareType: "text",
          mimeType: "text/plain",
        },
      ],
      clearSharedPayloads: () => {
        cleared += 1;
      },
      openRepositories: async () => repositories(intakes),
      generateId: () => "intake-1",
      now: () => "2026-11-12T00:00:00.000Z",
    });

    const path = await redirect({
      path: "stoptumpuk://expo-sharing",
      initial: true,
    });

    expect(path).toBe("/?intakeId=intake-1");
    expect(cleared).toBe(1);
    expect(intakes).toHaveLength(1);
    expect(intakes[0]).toMatchObject({
      id: "intake-1",
      url: "https://example.com/lesson",
      consumedAt: null,
    });
    expect("text" in (intakes[0] ?? {})).toBe(false);
  });

  it("returns a recoverable fallback and never leaks the payload", async () => {
    let cleared = 0;
    const redirect = createAndroidShareIntentRedirector({
      getSharedPayloads: () => [
        { value: "private note https://example.com/lesson", shareType: "text" },
      ],
      clearSharedPayloads: () => {
        cleared += 1;
      },
      openRepositories: async () => {
        throw new Error("database unavailable");
      },
      generateId: () => "unused",
      now: () => "2026-11-12T00:00:00.000Z",
    });

    await expect(
      redirect({ path: "stoptumpuk://expo-sharing", initial: false }),
    ).resolves.toBe("/?shareError=unavailable");
    expect(cleared).toBe(1);
  });

  it("passes ordinary paths through untouched", async () => {
    const redirect = createAndroidShareIntentRedirector({
      getSharedPayloads: () => [],
      clearSharedPayloads: () => undefined,
      openRepositories: async () => repositories(),
      generateId: () => "unused",
      now: () => "2026-11-12T00:00:00.000Z",
    });

    await expect(redirect({ path: "/settings", initial: false })).resolves.toBe(
      "/settings",
    );
  });
});
