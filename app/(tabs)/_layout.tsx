import { SymbolView, type AndroidSymbol, type SFSymbol } from "expo-symbols";
import {
  Tabs as RouterTabs,
  type BottomTabBarProps,
} from "expo-router/js-tabs";
import { Text, cn } from "panelui-native";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

const [capture, plan, later, library, you] = [
  {
    name: "index",
    title: "Capture",
    androidIcon: "add",
    iosIcon: "plus",
    selectedIosIcon: "plus",
  },
  {
    name: "dashboard",
    title: "Plan",
    androidIcon: "insights",
    iosIcon: "chart.bar",
    selectedIosIcon: "chart.bar.fill",
  },
  {
    name: "later",
    title: "Later",
    androidIcon: "schedule",
    iosIcon: "clock",
    selectedIosIcon: "clock.fill",
  },
  {
    name: "materials",
    title: "Library",
    androidIcon: "library_books",
    iosIcon: "books.vertical",
    selectedIosIcon: "books.vertical.fill",
  },
  {
    name: "settings",
    title: "You",
    androidIcon: "person",
    iosIcon: "person.crop.circle",
    selectedIosIcon: "person.crop.circle.fill",
  },
] satisfies {
  name: string;
  title: string;
  androidIcon: AndroidSymbol;
  iosIcon: SFSymbol;
  selectedIosIcon: SFSymbol;
}[];

const destinations = [capture, plan, later, library, you];
type Destination = (typeof destinations)[number];

function PrimaryTabBar({
  state,
  emitter,
  navigateToTab,
  insets,
}: BottomTabBarProps) {
  const activeRoute = state.routes[state.index];
  const [captureTint, selectedTint, inactiveTint] = useCSSVariable([
    "--color-primary-foreground",
    "--color-accent-foreground",
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

  function renderTab(destination: Destination) {
    const selected = destination.name === activeRoute.name;
    const isCapture = destination.name === capture.name;
    const tint = isCapture
      ? captureTint
      : selected
        ? selectedTint
        : inactiveTint;
    const icon = (
      <SymbolView
        accessible={false}
        name={{
          ios: selected ? destination.selectedIosIcon : destination.iosIcon,
          android: destination.androidIcon,
          web: destination.androidIcon,
        }}
        size={isCapture ? 28 : 20}
        tintColor={typeof tint === "string" ? tint : undefined}
      />
    );

    return (
      <Pressable
        accessibilityLabel={destination.title}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        className={cn(
          "items-center justify-center gap-1 active:opacity-75",
          isCapture ? "min-w-16 px-1" : "min-h-12 flex-1 rounded-xl",
          selected && !isCapture && "bg-accent",
        )}
        onPress={() => selectTab(destination.name)}
      >
        {isCapture ? (
          <View className="size-14 items-center justify-center rounded-full border-2 border-card bg-primary shadow-lg">
            {icon}
          </View>
        ) : (
          icon
        )}
        <Text
          size="xs"
          weight={isCapture || selected ? "semibold" : "medium"}
          className={cn(
            "text-center text-muted-foreground",
            (isCapture || selected) && "text-accent-foreground",
          )}
        >
          {destination.title}
        </Text>
      </Pressable>
    );
  }

  return (
    <View
      accessibilityRole="tablist"
      className="flex-row items-end gap-1 bg-background px-2 pb-2"
      style={{
        paddingBottom: insets.bottom + 8,
        paddingHorizontal: Math.max(insets.left, insets.right) + 8,
      }}
    >
      <View
        pointerEvents="none"
        className="absolute inset-x-0 bottom-0 top-3 border-t border-border bg-card"
      />
      <View className="flex-1 flex-row gap-1">
        {renderTab(plan)}
        {renderTab(later)}
      </View>
      {renderTab(capture)}
      <View className="flex-1 flex-row gap-1">
        {renderTab(library)}
        {renderTab(you)}
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
