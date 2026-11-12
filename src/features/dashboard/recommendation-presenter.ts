export const availableMinuteShortcuts = [5, 15, 30] as const;

/** Parse the dashboard's custom input without turning an empty field into zero. */
export function parseAvailableMinutes(raw: string): number | null {
  const value = raw.trim();
  if (value === "") return null;
  const minutes = Number(value);
  return Number.isInteger(minutes) && minutes >= 0 ? minutes : null;
}
