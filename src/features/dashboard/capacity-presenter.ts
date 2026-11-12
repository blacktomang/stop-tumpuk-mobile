import type { CapacityViewModel } from "../../domain";

export interface CapacityPresentation {
  eyebrow: string;
  message: string;
  detail: string;
  knownTime: string;
  capacityTime: string;
  unknownTime: string;
  meterLabel: string;
  meterValue: number | null;
  meterText: string;
  tone: "neutral" | "positive" | "warning" | "danger";
}

function minutes(seconds: number): string {
  return `${Math.ceil(seconds / 60)} min`;
}

function itemCount(count: number): string {
  return `${count} ${count === 1 ? "item" : "items"}`;
}

function projection(weeks: number | null): string {
  if (weeks === null)
    return "There is no clearance estimate until capacity is configured.";
  if (weeks === 0) return "Your Reading plan is clear.";
  if (weeks <= 1)
    return "At this pace, you can clear the known plan in about a week.";
  return `At this pace, the known plan takes about ${weeks.toFixed(1)} weeks.`;
}

export function presentCapacity(
  model: CapacityViewModel,
): CapacityPresentation {
  const knownTime = minutes(model.plannedSeconds);
  const capacityTime =
    model.capacitySeconds === null ? "Unset" : minutes(model.capacitySeconds);
  const unknownTime = itemCount(model.unknownCount);

  switch (model.state) {
    case "unset":
      return {
        eyebrow: "WEEKLY CAPACITY",
        message: "Tell us how much time you have before we measure the week.",
        detail: `${knownTime} of known planned time · ${unknownTime} without an estimate`,
        knownTime,
        capacityTime,
        unknownTime,
        meterLabel: "Weekly capacity is not set",
        meterValue: null,
        meterText: "Capacity unset",
        tone: "neutral",
      };
    case "zero":
      return {
        eyebrow: "WEEKLY CAPACITY",
        message: "You have no available minutes set for this week.",
        detail: `${knownTime} of known planned time · ${unknownTime} without an estimate`,
        knownTime,
        capacityTime,
        unknownTime,
        meterLabel: "Weekly capacity is zero",
        meterValue: null,
        meterText: "0 min available",
        tone: model.plannedSeconds > 0 ? "danger" : "neutral",
      };
    case "empty":
      return {
        eyebrow: "WEEKLY CAPACITY",
        message: "You have room for a fresh commitment this week.",
        detail: `${capacityTime} available · ${unknownTime} without an estimate`,
        knownTime,
        capacityTime,
        unknownTime,
        meterLabel: "Weekly capacity, empty",
        meterValue: 0,
        meterText: `${capacityTime} available`,
        tone: "positive",
      };
    case "full":
      return {
        eyebrow: "WEEKLY CAPACITY",
        message: "Your known plan fills this week exactly.",
        detail: `${knownTime} planned · ${unknownTime} without an estimate`,
        knownTime,
        capacityTime,
        unknownTime,
        meterLabel: "Weekly capacity, full",
        meterValue: 100,
        meterText: "At capacity",
        tone: "warning",
      };
    case "overflow":
      return {
        eyebrow: "WEEKLY CAPACITY",
        message: `Your known plan is ${minutes(model.overflowSeconds ?? 0)} over this week’s capacity.`,
        detail: `${knownTime} planned · ${unknownTime} without an estimate`,
        knownTime,
        capacityTime,
        unknownTime,
        meterLabel: "Weekly capacity, overflow",
        meterValue: 100,
        meterText: `${minutes(model.overflowSeconds ?? 0)} over capacity`,
        tone: "danger",
      };
    case "under":
      return {
        eyebrow: "WEEKLY CAPACITY",
        message: `You have ${minutes(model.headroomSeconds ?? 0)} of room left this week.`,
        detail: `${knownTime} planned · ${unknownTime} without an estimate`,
        knownTime,
        capacityTime,
        unknownTime,
        meterLabel: "Weekly capacity, under capacity",
        meterValue: Math.round((model.visualFraction ?? 0) * 100),
        meterText: `${minutes(model.headroomSeconds ?? 0)} available`,
        tone: "positive",
      };
  }
}

export function capacityProjection(model: CapacityViewModel): string {
  return projection(model.clearanceWeeks);
}
