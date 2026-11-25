import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { PanelUIProvider } from "panelui-native";
import { useMemo } from "react";
import { useUniwind } from "uniwind";
import { LaunchSplash } from "../src/components/launch-splash";
import { AppColorsContext, useSystemColors } from "../src/ui/theme";
import "../global.css";

export default function RootLayout() {
  const { theme } = useUniwind();
  const colors = useSystemColors();
  const navigationTheme = useMemo(() => {
    const base = theme === "dark" ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: colors.background ?? base.colors.background,
        card: colors.card ?? base.colors.card,
        text: colors.foreground ?? base.colors.text,
        border: colors.border ?? base.colors.border,
        primary: colors.primary ?? base.colors.primary,
      },
    };
  }, [colors, theme]);

  return (
    <PanelUIProvider>
      <AppColorsContext value={colors}>
        <ThemeProvider value={navigationTheme}>
          <StatusBar style={navigationTheme.dark ? "light" : "dark"} />
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="reading" options={{ headerShown: false }} />
            <Stack.Screen name="transfer" options={{ presentation: "modal" }} />
            <Stack.Screen
              name="webview-probe"
              options={{ presentation: "modal" }}
            />
          </Stack>
        </ThemeProvider>
      </AppColorsContext>
      <LaunchSplash />
    </PanelUIProvider>
  );
}
