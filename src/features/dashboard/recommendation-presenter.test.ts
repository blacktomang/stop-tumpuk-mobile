import { describe, expect, it } from "vitest";
import {
  availableMinuteShortcuts,
  parseAvailableMinutes,
} from "./recommendation-presenter";

describe("recommendation dashboard input", () => {
  it("keeps the three available-minute shortcuts stable", () => {
    expect(availableMinuteShortcuts).toEqual([5, 15, 30]);
  });

  it("accepts whole non-negative custom values and rejects blank or fractional input", () => {
    expect(parseAvailableMinutes(" 45 ")).toBe(45);
    expect(parseAvailableMinutes("0")).toBe(0);
    expect(parseAvailableMinutes(" ")).toBeNull();
    expect(parseAvailableMinutes("12.5")).toBeNull();
    expect(parseAvailableMinutes("-5")).toBeNull();
  });
});
