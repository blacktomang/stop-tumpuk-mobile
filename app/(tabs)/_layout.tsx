import { SymbolView, type AndroidSymbol, type SFSymbol } from "expo-symbols";
import {
  Tabs as RouterTabs,
  type BottomTabBarProps,
} from "expo-router/js-tabs";
import { Tabs as PanelTabs } from "panelui-native";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

const destinations = [
  {
    name: "index",
    title: "Capture",
    androidIcon: "add_circle",
    iosIcon: "plus.circle",
    selectedIosIcon: "plus.circle.fill",
  },
  {
    name: "dashboard",
    title: "Plan",
    androidIcon: "insights",
    iosIcon: "chart.bar",
    selectedIosIcon: "chart.bar.fill",
  },
  {
    name: "materials",
    title: "Materials",
    androidIcon: "library_books",
    iosIcon: "books.vertical",
    selectedIosIcon: "books.vertical.fill",
  },
  {
    name: "settings",
    title: "Settings",
    androidIcon: "settings",
    iosIcon: "gearshape",
    selectedIosIcon: "gearshape.fill",
  },
] satisfies {
  name: string;
  title: string;
  androidIcon: AndroidSymbol;
  iosIcon: SFSymbol;
  selectedIosIcon: SFSymbol;
}[];

function PrimaryTabBar({
  state,
  emitter,
  navigateToTab,
  insets,
}: BottomTabBarProps) {
  const activeRoute = state.routes[state.index];
  const [selectedTint, inactiveTint] = useCSSVariable([
    "--color-primary-foreground",
    "--color-muted-foreground",
  ]);

  function selectTab(name: string) {
    const route = state.routes.find((candidate) => candidate.name === name);
    if (!route) return;

    const event = emitter.emit({
      type: "tabPress",
      target: route.key,
      canPreventDefault: true,
    });
    if (route.key !== activeRoute.key && !event.defaultPrevented) {
      navigateToTab(route.key);
    }
  }

  return (
    <View
      className="border-t border-border bg-card"
      style={{
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }}
    >
      <PanelTabs
        className="px-2 py-2"
        defaultValue="index"
        value={activeRoute.name}
        onValueChange={selectTab}
        variant="pill"
        size="xs"
      >
        <PanelTabs.List>
          {destinations.map((destination) => {
            const selected = destination.name === activeRoute.name;
            const tint = selected ? selectedTint : inactiveTint;

            return (
              <PanelTabs.Trigger
                key={destination.name}
                value={destination.name}
                className="min-h-12 flex-col gap-0.5"
                icon={
                  <SymbolView
                    accessible={false}
                    name={{
                      ios: selected
                        ? destination.selectedIosIcon
                        : destination.iosIcon,
                      android: destination.androidIcon,
                      web: destination.androidIcon,
                    }}
                    size={20}
                    tintColor={typeof tint === "string" ? tint : undefined}
                  />
                }
              >
                {destination.title}
              </PanelTabs.Trigger>
            );
          })}
        </PanelTabs.List>
      </PanelTabs>
    </View>
  );
}

export default function PrimaryTabsLayout() {
  const { top, left, right } = useSafeAreaInsets();

  return (
    <RouterTabs
      backBehavior="initialRoute"
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          paddingTop: top,
          paddingLeft: left,
          paddingRight: right,
        },
      }}
      tabBar={(props) => <PrimaryTabBar {...props} />}
    >
      {destinations.map(({ name, title }) => (
        <RouterTabs.Screen key={name} name={name} options={{ title }} />
      ))}
    </RouterTabs>
  );
}
