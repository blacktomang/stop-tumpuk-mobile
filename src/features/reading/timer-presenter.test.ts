import { describe, expect, it } from "vitest";
import { formatFocusTime, timerMessage, timerTitle } from "./timer-presenter";

describe("timer presenter", () => {
  it("formats a stable countdown", () => {
    expect(formatFocusTime(0)).toBe("0:00");
    expect(formatFocusTime(1499)).toBe("24:59");
    expect(formatFocusTime(-1)).toBe("0:00");
  });

  it("explains expiry without implying completion", () => {
    expect(timerTitle("expired")).toBe("Time is up");
    expect(timerMessage("expired")).toContain("still unfinished");
  });
});
