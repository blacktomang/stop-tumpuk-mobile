import { useContext } from "react";
import { describe, expect, it, vi } from "vitest";
import { useCSSVariable, useUniwind } from "uniwind";
import RootLayout from "../../app/_layout";
import { createThemedStyles } from "./theme";

vi.mock("expo-router", () => ({
  DarkTheme: { dark: true, colors: {} },
  DefaultTheme: { dark: false, colors: {} },
  Stack: Object.assign(() => null, { Screen: () => null }),
  ThemeProvider: "ThemeProvider",
}));
vi.mock("expo-status-bar", () => ({ StatusBar: "StatusBar" }));
vi.mock("panelui-native", () => ({ PanelUIProvider: "PanelUIProvider" }));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useContext: vi.fn(),
  useMemo: (compute: () => unknown) => compute(),
}));
vi.mock("react-native", () => ({
  StyleSheet: { create: (styles: unknown) => styles },
}));
vi.mock("uniwind", () => ({ useCSSVariable: vi.fn(), useUniwind: vi.fn() }));

describe("system appearance", () => {
  it("updates screen styles, navigation surfaces, and status bar contrast in both modes", () => {
    const readStyles = createThemedStyles((colors) => ({
      screen: { backgroundColor: colors.background },
      label: { color: colors.foreground },
    }));

    for (const { mode, background, card, foreground } of [
      {
        mode: "light",
        background: "#f6f7f2",
        card: "#ffffff",
        foreground: "#17211b",
      },
      {
        mode: "dark",
        background: "#131b16",
        card: "#1b2820",
        foreground: "#e7f0e9",
      },
    ] as const) {
      vi.mocked(useUniwind).mockReturnValue({
        theme: mode,
        hasAdaptiveThemes: true,
      });
      vi.mocked(useCSSVariable).mockImplementation((names) => {
        const values: Record<string, string> = {
          "--color-background": background,
          "--color-card": card,
          "--color-foreground": foreground,
        };
        return names.map((name) => values[name]);
      });

      const paletteProvider = RootLayout().props.children;
      const navigation = paletteProvider.props.children;
      vi.mocked(useContext).mockReturnValue(paletteProvider.props.value);

      expect(navigation.props.value).toMatchObject({
        dark: mode === "dark",
        colors: { background, card, text: foreground },
      });
      expect(navigation.props.children[0].props.style).toBe(
        mode === "dark" ? "light" : "dark",
      );
      expect(readStyles().styles).toEqual({
        screen: { backgroundColor: background },
        label: { color: foreground },
      });
    }
  });
});
