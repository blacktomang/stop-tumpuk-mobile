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
  const normalized = path.trim();
  if (normalized === "expo-sharing") return true;

  // Expo Router delivers the synthetic handoff as a custom-scheme URI such
  // as `stoptumpuk://expo-sharing`. Match only that URI authority; ordinary
  // routes and query values containing the marker must pass through.
  return /^stoptumpuk:\/\/expo-sharing(?:[?#].*)?$/i.test(normalized);
}

export function createIosShareIntentRedirector() {
  return async function redirectSystemPath({
    path,
  }: NativeIntentPath): Promise<string> {
    if (!isExpoSharingPath(path)) return path;
    return "/?shareError=ios-unsupported";
  };
}
