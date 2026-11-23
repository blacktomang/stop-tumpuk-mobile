import {
  formatDuration,
  roundMinutes,
  type CapacityViewModel,
} from "../../domain";

type CapacityTone = "neutral" | "positive" | "warning" | "danger";

export function presentCapacity(model: CapacityViewModel) {
  const planned = formatDuration(model.plannedSeconds);
  const message =
    model.capacitySeconds === null
      ? `${planned} planned`
      : `${roundMinutes(model.plannedSeconds)} of ${formatDuration(model.capacitySeconds)} planned`;
  const unknown = model.unknownCount;
  const unestimated =
    unknown === 0
      ? null
      : `${unknown} ${unknown === 1 ? "item" : "items"} unestimated`;

  let status: string;
  let tone: CapacityTone;
  switch (model.state) {
    case "unset":
      status = "Weekly availability not set";
      tone = "neutral";
      break;
    case "zero":
      status = "No time available this week";
      tone = model.plannedSeconds > 0 ? "danger" : "neutral";
      break;
    case "overflow":
      status = `${formatDuration(model.overflowSeconds)} over capacity`;
      tone = "danger";
      break;
    case "full":
      status = "At capacity";
      tone = "warning";
      break;
    case "under":
    case "empty":
      status = `${formatDuration(model.headroomSeconds)} left`;
      tone = "positive";
      break;
  }

  return {
    message,
    detail: unestimated ? `${status} · ${unestimated}` : status,
    meterValue:
      model.visualFraction === null
        ? null
        : Math.round(model.visualFraction * 100),
    tone,
  };
}

export function capacityProjection(model: CapacityViewModel): string | null {
  const weeks = model.clearanceWeeks;
  if (weeks === null || weeks <= 1) return null;
  return `About ${weeks.toFixed(1)} weeks to clear the known plan.`;
}
