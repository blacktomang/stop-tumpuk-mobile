export interface NativeIntentPath {
  path: string;
  initial: boolean;
}

/**
 * iOS does not have a configured Share Extension or App Group in this Expo
 * target. Keep the native-intent boundary defensive for stale or future
 * expo-sharing paths, but never pretend that their payload can be received.
 */
export function isExpoSharingPath(path: string): boolean {
  return path.includes("expo-sharing");
}

export function createIosShareIntentRedirector() {
  return async function redirectSystemPath({
    path,
  }: NativeIntentPath): Promise<string> {
    if (!isExpoSharingPath(path)) return path;
    return "/?shareError=ios-unsupported";
  };
}
