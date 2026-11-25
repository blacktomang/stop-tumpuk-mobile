import { Text, View } from "react-native";
import { createThemedStyles } from "../../ui/theme";

export function CapacityMeter({
  label,
  value,
  valueText,
  tone,
}: {
  label: string;
  value: number | null;
  valueText: string;
  tone: "neutral" | "positive" | "warning" | "danger";
}) {
  const { colors, styles } = useStyles();
  const fillColor =
    tone === "danger"
      ? colors.destructiveForeground
      : tone === "warning"
        ? colors.warningForeground
        : colors.primary;
  const accessibilityValue =
    value === null
      ? { text: valueText }
      : { min: 0, max: 100, now: value, text: valueText };

  return (
    <View
      accessibilityHint="This shows planned time against weekly capacity, not completion progress."
      accessibilityLabel={label}
      accessibilityRole="progressbar"
      accessibilityValue={accessibilityValue}
      style={styles.wrapper}
    >
      <View style={styles.track}>
        {value !== null ? (
          <View
            style={[
              styles.fill,
              {
                backgroundColor: fillColor,
                width: `${Math.max(0, Math.min(100, value))}%`,
              },
            ]}
          />
        ) : null}
      </View>
      <View style={styles.legend}>
        <Text style={styles.caption}>PLANNED TIME / WEEKLY CAPACITY</Text>
        <Text style={[styles.value, tone === "danger" && styles.danger]}>
          {valueText}
        </Text>
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  wrapper: { gap: 10 },
  track: {
    backgroundColor: colors.border,
    borderRadius: 8,
    height: 14,
    overflow: "hidden",
  },
  fill: { borderRadius: 8, height: "100%" },
  legend: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  caption: {
    color: colors.mutedForeground,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  value: { color: colors.foreground, fontSize: 13, fontWeight: "700" },
  danger: { color: colors.destructiveForeground },
}));
