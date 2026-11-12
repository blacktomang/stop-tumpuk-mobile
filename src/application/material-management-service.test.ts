import { describe, expect, it } from "vitest";
import {
  matchesMaterialFilter,
  searchMaterials,
} from "./material-management-service";
import type { Material } from "../types";

const base: Material = {
  id: "one",
  originalUrl: "https://example.com/one",
  normalizedUrl: "https://example.com/one",
  domain: "example.com",
  title: "A useful article",
  thumbnailUrl: null,
  type: "article",
  status: "queued",
  sourceDurationSeconds: 600,
  sourceDurationProvenance: "publisher-estimate",
  sourceDurationCompleteness: "full",
  playbackSpeed: 1,
  manualEstimatedSeconds: null,
  createdAt: "2026-11-11T00:00:00.000Z",
  updatedAt: "2026-11-11T00:00:00.000Z",
};

describe("material management view queries", () => {
  it("maps user-facing filters to lifecycle statuses", () => {
    expect(matchesMaterialFilter(base, "reading-plan")).toBe(true);
    expect(
      matchesMaterialFilter({ ...base, status: "completed" }, "finished"),
    ).toBe(true);
  });

  it("searches title, domain, and source URL within a status", () => {
    const other: Material = {
      ...base,
      id: "two",
      title: "Video notes",
      status: "in-progress",
    };
    expect(searchMaterials([base, other], "reading-plan", "USEFUL")).toEqual([
      base,
    ]);
    expect(
      searchMaterials([base, other], "in-progress", "example.com"),
    ).toEqual([other]);
  });
});
