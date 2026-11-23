import { describe, expect, it } from "vitest";
import {
  actionGroupForStatus,
  actionLabel,
  materialFilters,
} from "./material-presenter";

describe("material action hierarchy", () => {
  it("keeps one direct action and puts secondary work in advanced actions", () => {
    expect(actionGroupForStatus("inbox")).toEqual({
      primary: "commit",
      advanced: ["edit", "archive", "delete"],
    });
    expect(actionGroupForStatus("in-progress").primary).toBe("finish");
    expect(actionGroupForStatus("completed").primary).toBe("open");
    expect(actionGroupForStatus("completed").advanced).toContain("reopen");
    expect(actionGroupForStatus("archived").advanced).not.toContain(
      "return-to-inbox",
    );
  });

  it("labels the Library filters and Later actions", () => {
    expect(materialFilters.map(({ label }) => label)).toEqual([
      "All",
      "Later",
      "Reading plan",
      "In Progress",
      "Finished",
      "Archived",
    ]);
    expect(actionLabel("commit")).toBe("Add to Reading plan");
    expect(actionLabel("return-to-inbox")).toBe("Move to Later");
  });
});
