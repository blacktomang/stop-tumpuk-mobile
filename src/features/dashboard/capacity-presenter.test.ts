import { describe, expect, it } from "vitest";
import type { CapacityViewModel } from "../../domain";
import { capacityProjection, presentCapacity } from "./capacity-presenter";

const model = (overrides: Partial<CapacityViewModel>): CapacityViewModel => ({
  state: "under",
  activeCount: 2,
  plannedSeconds: 1_800,
  unknownCount: 1,
  capacitySeconds: 3_600,
  visualFraction: 0.5,
  headroomSeconds: 1_800,
  overflowSeconds: null,
  clearanceWeeks: 0.5,
  ...overrides,
});

describe("capacity presentation", () => {
  it("keeps the under-capacity message conversational and accessible", () => {
    expect(presentCapacity(model({}))).toMatchObject({
      message: "You have 30 min of room left this week.",
      detail: "30 min planned · 1 item without an estimate",
      meterValue: 50,
      meterText: "30 min available",
      tone: "positive",
    });
  });

  it("does not invent a fraction for unset or zero capacity", () => {
    expect(
      presentCapacity(
        model({
          state: "unset",
          capacitySeconds: null,
          visualFraction: null,
          headroomSeconds: null,
          overflowSeconds: null,
          clearanceWeeks: null,
        }),
      ).meterValue,
    ).toBeNull();
    expect(
      presentCapacity(
        model({
          state: "zero",
          capacitySeconds: 0,
          visualFraction: null,
          headroomSeconds: null,
          overflowSeconds: 1_800,
          clearanceWeeks: null,
        }),
      ).message,
    ).toContain("no available minutes");
  });

  it("keeps overflow visible instead of clipping it to a success state", () => {
    const presentation = presentCapacity(
      model({
        state: "overflow",
        plannedSeconds: 5_400,
        capacitySeconds: 3_600,
        visualFraction: 1,
        headroomSeconds: null,
        overflowSeconds: 1_800,
        clearanceWeeks: 1.5,
      }),
    );
    expect(presentation.message).toBe(
      "Your known plan is 30 min over this week’s capacity.",
    );
    expect(presentation.meterText).toBe("30 min over capacity");
    expect(capacityProjection(model({ clearanceWeeks: 1.5 }))).toContain(
      "1.5 weeks",
    );
  });
});
