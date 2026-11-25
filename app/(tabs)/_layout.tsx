import { SymbolView, type AndroidSymbol, type SFSymbol } from "expo-symbols";
import {
  Tabs as RouterTabs,
  type BottomTabBarProps,
} from "expo-router/js-tabs";
import { Pressable, Text, View } from "react-native";
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
      <View accessibilityRole="tablist" className="flex-row px-2 py-2">
        {destinations.map((destination) => {
          const selected = destination.name === activeRoute.name;
          const tint = selected ? selectedTint : inactiveTint;

          return (
            <Pressable
              key={destination.name}
              accessibilityRole="tab"
              accessibilityLabel={destination.title}
              accessibilityState={{ selected }}
              className="min-h-14 min-w-0 flex-1 items-center justify-center gap-0.5 px-1 py-1"
              onPress={() => selectTab(destination.name)}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <View
                className={`h-8 w-14 max-w-full items-center justify-center rounded-full ${selected ? "bg-primary" : "bg-transparent"}`}
              >
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
              </View>
              <Text
                className={`text-center text-xs ${selected ? "text-primary" : "text-muted-foreground"}`}
              >
                {destination.title}
              </Text>
            </Pressable>
          );
        })}
      </View>
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
