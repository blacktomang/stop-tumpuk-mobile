import { NativeTabs } from "expo-router/native-tabs";

const colors = {
  accent: "#2E6B4D",
  ink: "#17211B",
  panel: "#FFFFFF",
};

export default function PrimaryTabsLayout() {
  return (
    <NativeTabs
      backgroundColor={colors.panel}
      iconColor={{ default: colors.ink, selected: colors.accent }}
      labelStyle={{ fontSize: 12, fontWeight: "700" }}
      tabBarRespectsIMEInsets
      tintColor={colors.accent}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon
          md={{ default: "add_circle", selected: "add_circle" }}
          sf={{ default: "plus.circle", selected: "plus.circle.fill" }}
        />
        <NativeTabs.Trigger.Label>Capture</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="dashboard">
        <NativeTabs.Trigger.Icon
          md={{ default: "insights", selected: "insights" }}
          sf={{ default: "chart.bar", selected: "chart.bar.fill" }}
        />
        <NativeTabs.Trigger.Label>Plan</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="materials">
        <NativeTabs.Trigger.Icon
          md={{ default: "library_books", selected: "library_books" }}
          sf={{ default: "books.vertical", selected: "books.vertical.fill" }}
        />
        <NativeTabs.Trigger.Label>Materials</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon
          md={{ default: "settings", selected: "settings" }}
          sf={{ default: "gearshape", selected: "gearshape.fill" }}
        />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
