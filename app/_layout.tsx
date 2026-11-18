import { Stack } from "expo-router";
import { PanelUIProvider } from "panelui-native";
import "../global.css";

export default function RootLayout() {
  return (
    <PanelUIProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="reading" options={{ headerShown: false }} />
        <Stack.Screen name="transfer" options={{ presentation: "modal" }} />
        <Stack.Screen
          name="webview-probe"
          options={{ presentation: "modal" }}
        />
      </Stack>
    </PanelUIProvider>
  );
}
