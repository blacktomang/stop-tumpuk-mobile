import { describe, expect, it } from "vitest";
import {
  createIosShareIntentRedirector,
  isExpoSharingPath,
} from "./ios-share-intent";

describe("iOS share intent boundary", () => {
  it("routes an unsupported share handoff to URL-paste guidance", async () => {
    const redirect = createIosShareIntentRedirector();

    await expect(
      redirect({ path: "stoptumpuk://expo-sharing", initial: true }),
    ).resolves.toBe("/?shareError=ios-unsupported");
  });

  it("does not consume or stage payloads because no iOS extension is configured", async () => {
    const redirect = createIosShareIntentRedirector();

    await expect(redirect({ path: "/", initial: false })).resolves.toBe("/");
  });

  it.each([
    "/settings",
    "/settings?next=expo-sharing",
    "",
    "not a URI",
    "stoptumpuk://expo-sharing/other",
  ])(
    "passes ordinary or malformed route %j through unchanged",
    async (path) => {
      const redirect = createIosShareIntentRedirector();

      await expect(redirect({ path, initial: false })).resolves.toBe(path);
      expect(isExpoSharingPath(path)).toBe(false);
    },
  );

  it("recognizes only the synthetic expo-sharing handoff", () => {
    expect(isExpoSharingPath("expo-sharing")).toBe(true);
    expect(isExpoSharingPath("stoptumpuk://expo-sharing?source=safari")).toBe(
      true,
    );
    expect(isExpoSharingPath("https://expo-sharing")).toBe(false);
    expect(isExpoSharingPath("https://expo-sharing.example/article")).toBe(
      false,
    );
    expect(isExpoSharingPath("other-app://expo-sharing")).toBe(false);
  });
});
