import { describe, expect, it, vi } from "vitest";
import PrimaryTabsLayout from "../app/(tabs)/_layout";

vi.mock("expo-router/js-tabs", () => ({
  Tabs: Object.assign(() => null, { Screen: () => null }),
}));
vi.mock("expo-symbols", () => ({ SymbolView: "SymbolView" }));
vi.mock("react-native", () => ({
  Pressable: "Pressable",
  Text: "Text",
  View: "View",
}));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
vi.mock("uniwind", () => ({
  useCSSVariable: () => ["selected-icon", "inactive-icon"],
}));

function renderTabBar(index: number) {
  const routes = ["index", "dashboard", "materials", "settings"].map(
    (name) => ({
      key: name,
      name,
    }),
  );
  const emit = vi.fn(() => ({ defaultPrevented: false }));
  const navigateToTab = vi.fn();
  const bar = PrimaryTabsLayout().props.tabBar({
    state: { index, routes },
    emitter: { emit },
    navigateToTab,
    insets: { bottom: 0, left: 0, right: 0 },
  });
  const tabs = bar.type(bar.props).props.children.props.children;
  return { tabs, emit, navigateToTab };
}

describe("primary tab bar", () => {
  it.each([0, 1, 2, 3])(
    "centers each label below its icon and highlights only the selected icon at index %i",
    (activeIndex) => {
      const { tabs } = renderTabBar(activeIndex);

      for (const [index, title] of [
        "Capture",
        "Plan",
        "Materials",
        "Settings",
      ].entries()) {
        const selected = index === activeIndex;
        const tab = tabs[index].props;
        const [icon, label] = tab.children;

        expect(tab.accessibilityState.selected).toBe(selected);
        expect(tab.className).toContain("flex-1 items-center");
        expect(icon.props.className).toContain("rounded-full");
        expect(icon.props.className).toContain(
          selected ? "bg-primary" : "bg-transparent",
        );
        expect(icon.props.children.type).toBe("SymbolView");
        expect(label.props.children).toBe(title);
        expect(label.props.className).toBe(
          `text-center text-xs ${selected ? "text-primary" : "text-muted-foreground"}`,
        );
      }
    },
  );

  it("navigates from the full tab and honors a prevented tab press", () => {
    const { tabs, emit, navigateToTab } = renderTabBar(0);

    tabs[1].props.onPress();
    expect(emit).toHaveBeenCalledWith({
      type: "tabPress",
      target: "dashboard",
      canPreventDefault: true,
    });
    expect(navigateToTab).toHaveBeenCalledWith("dashboard");
    navigateToTab.mockClear();

    emit.mockReturnValueOnce({ defaultPrevented: true });
    tabs[2].props.onPress();
    tabs[0].props.onPress();
    expect(navigateToTab).not.toHaveBeenCalled();
  });
});
