import { randomUUID } from "expo-crypto";
import { clearSharedPayloads, getSharedPayloads } from "expo-sharing";
import { createAndroidShareIntentRedirector } from "../src/platform/android-share-intent";
import { openNativeRepositories } from "../src/storage/sqlite/expo-sqlite-adapter";

const redirect = createAndroidShareIntentRedirector({
  getSharedPayloads,
  clearSharedPayloads,
  openRepositories: openNativeRepositories,
  generateId: randomUUID,
  now: () => new Date().toISOString(),
});

export const redirectSystemPath = redirect;
