import { randomUUID } from "expo-crypto";
import { clearSharedPayloads, getSharedPayloads } from "expo-sharing";
import { Platform } from "react-native";
import { createAndroidShareIntentRedirector } from "../src/platform/android-share-intent";
import { createIosShareIntentRedirector } from "../src/platform/ios-share-intent";
import { openNativeRepositories } from "../src/storage/sqlite/expo-sqlite-adapter";

const androidRedirect = createAndroidShareIntentRedirector({
  getSharedPayloads,
  clearSharedPayloads,
  openRepositories: openNativeRepositories,
  generateId: randomUUID,
  now: () => new Date().toISOString(),
});

const iosRedirect = createIosShareIntentRedirector();

export const redirectSystemPath =
  Platform.OS === "ios" ? iosRedirect : androidRedirect;
