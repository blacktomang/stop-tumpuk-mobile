import { describe, expect, it } from "vitest";
import { createIosShareIntentRedirector } from "./ios-share-intent";

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
});
