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
  it("summarizes known time, capacity, headroom, and unestimated items", () => {
    expect(presentCapacity(model({}))).toMatchObject({
      message: "30 of 60 min planned",
      detail: "30 min left · 1 item unestimated",
      meterValue: 50,
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
      ),
    ).toMatchObject({
      message: "30 min planned",
      detail: "Weekly availability not set · 1 item unestimated",
      meterValue: null,
    });
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
      ),
    ).toMatchObject({
      message: "30 of 0 min planned",
      detail: "No time available this week · 1 item unestimated",
      meterValue: null,
    });
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
    expect(presentation.message).toBe("90 of 60 min planned");
    expect(presentation).toMatchObject({
      detail: "30 min over capacity · 1 item unestimated",
      meterValue: 100,
      tone: "danger",
    });
    expect(capacityProjection(model({ clearanceWeeks: 1.5 }))).toContain(
      "1.5 weeks",
    );
  });

  it("keeps empty, full, and unknown capacity states explicit", () => {
    expect(
      presentCapacity(
        model({
          state: "empty",
          activeCount: 0,
          plannedSeconds: 0,
          unknownCount: 0,
          capacitySeconds: 3_600,
          visualFraction: 0,
          headroomSeconds: 3_600,
          clearanceWeeks: 0,
        }),
      ),
    ).toMatchObject({
      message: "0 of 60 min planned",
      meterValue: 0,
      detail: "60 min left",
    });

    expect(
      presentCapacity(
        model({
          state: "full",
          plannedSeconds: 3_600,
          capacitySeconds: 3_600,
          visualFraction: 1,
          headroomSeconds: 0,
          clearanceWeeks: 1,
        }),
      ),
    ).toMatchObject({
      message: "60 of 60 min planned",
      meterValue: 100,
      detail: "At capacity · 1 item unestimated",
    });

    expect(
      presentCapacity(
        model({
          state: "under",
          plannedSeconds: 0,
          unknownCount: 2,
          visualFraction: 0,
          headroomSeconds: 3_600,
          clearanceWeeks: 0,
        }),
      ).detail,
    ).toBe("60 min left · 2 items unestimated");
  });

  it("does not invent a clearance projection for zero capacity", () => {
    expect(
      capacityProjection(
        model({
          state: "zero",
          capacitySeconds: 0,
          visualFraction: null,
          headroomSeconds: null,
          overflowSeconds: 1_800,
          clearanceWeeks: null,
        }),
      ),
    ).toBeNull();
  });
});
