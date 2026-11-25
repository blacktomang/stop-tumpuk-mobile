import { createContext, useContext, useMemo } from "react";
import {
  StyleSheet,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useCSSVariable } from "uniwind";

export function useSystemColors() {
  const values = useCSSVariable([
    "--color-background",
    "--color-card",
    "--color-foreground",
    "--color-muted-foreground",
    "--color-border",
    "--color-input",
    "--color-primary",
    "--color-primary-foreground",
    "--color-accent",
    "--color-destructive-foreground",
    "--color-destructive-soft",
    "--color-warning-foreground",
  ]);

  return useMemo(() => {
    const [
      background,
      card,
      foreground,
      mutedForeground,
      border,
      input,
      primary,
      primaryForeground,
      accent,
      destructiveForeground,
      destructiveSoft,
      warningForeground,
    ] = values.map((value) => (typeof value === "string" ? value : undefined));

    return {
      background,
      card,
      foreground,
      mutedForeground,
      border,
      input,
      primary,
      primaryForeground,
      accent,
      destructiveForeground,
      destructiveSoft,
      warningForeground,
    };
  }, [values]);
}

type AppColors = ReturnType<typeof useSystemColors>;

export const AppColorsContext = createContext<AppColors | null>(null);

export function createThemedStyles<
  Styles extends Record<string, ViewStyle | TextStyle | ImageStyle>,
>(createStyles: (colors: AppColors) => Styles) {
  const stylesByPalette = new WeakMap<AppColors, Styles>();

  return function useThemedStyles() {
    const colors = useContext(AppColorsContext);
    if (!colors) throw new Error("Themed styles require AppColorsContext");

    let styles = stylesByPalette.get(colors);
    if (!styles) {
      styles = StyleSheet.create(createStyles(colors));
      stylesByPalette.set(colors, styles);
    }
    return { colors, styles };
  };
}
