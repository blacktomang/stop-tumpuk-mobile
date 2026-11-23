import { cn } from "panelui-native";
import { View } from "react-native";

const fillClasses = {
  neutral: "bg-primary",
  positive: "bg-primary",
  warning: "bg-warning-foreground",
  danger: "bg-destructive-foreground",
};

export function CapacityMeter({
  value,
  valueText,
  tone,
}: {
  value: number | null;
  valueText: string;
  tone: keyof typeof fillClasses;
}) {
  if (value === null) return null;

  const boundedValue = Math.max(0, Math.min(100, value));
  return (
    <View
      accessibilityLabel="Planned time against weekly capacity"
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 0,
        max: 100,
        now: boundedValue,
        text: valueText,
      }}
      className="h-3 overflow-hidden rounded-full bg-muted"
    >
      <View
        className={cn("h-full rounded-full", fillClasses[tone])}
        style={{ width: `${boundedValue}%` }}
      />
    </View>
  );
}
