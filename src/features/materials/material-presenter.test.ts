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
    expect(actionGroupForStatus("completed").advanced).toContain("reopen");
    expect(actionGroupForStatus("archived").advanced).not.toContain(
      "return-to-inbox",
    );
  });

  it("names all five material views with product copy", () => {
    expect(materialFilters.map(({ label }) => label)).toEqual([
      "Inbox",
      "Reading plan",
      "In Progress",
      "Finished",
      "Archived",
    ]);
    expect(actionLabel("return-to-inbox")).toBe("Return to Inbox");
  });
});
