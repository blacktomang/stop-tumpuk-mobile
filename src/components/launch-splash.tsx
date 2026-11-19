import { isRunningInExpoGo } from "expo";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { Animated, Easing, Platform, StyleSheet, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

const isNative = Platform.OS === "android" || Platform.OS === "ios";
const markSize = 144;
const paper = "#FAF0E1";

if (isNative) {
  // Hold the native screen until its React Native replacement has laid out.
  void SplashScreen.preventAutoHideAsync().catch(() => {});
  if (!isRunningInExpoGo()) {
    SplashScreen.setOptions({ duration: 0, fade: false });
  }
}

export function LaunchSplash() {
  return isNative ? <NativeLaunchSplash /> : null;
}

function NativeLaunchSplash() {
  const reducedMotion = useReducedMotion();
  const [laidOut, setLaidOut] = useState(false);
  const [visible, setVisible] = useState(true);
  const [lift] = useState(() => new Animated.Value(0));
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!laidOut) return;

    SplashScreen.hide();

    if (reducedMotion) {
      setVisible(false);
      return;
    }

    const animation = Animated.sequence([
      Animated.timing(lift, {
        toValue: 1,
        duration: 120,
        easing: Easing.out(Easing.sin),
        useNativeDriver: true,
      }),
      Animated.timing(lift, {
        toValue: 0,
        duration: 280,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    animation.start(({ finished }) => {
      if (finished) setVisible(false);
    });

    return () => animation.stop();
  }, [laidOut, lift, opacity, reducedMotion]);

  if (!visible) return null;

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={() => setLaidOut(true)}
      pointerEvents="box-only"
      style={[styles.overlay, { opacity }]}
    >
      <View style={styles.mark}>
        <Svg width={markSize} height={markSize} viewBox="0 0 256 256">
          <Path
            fill="#04314E"
            d="M74 140c0-15 10-24 23-25l30-45 68 26c9 4 14 11 14 21v80c-9 5-9 15-1 19 4 5-1 14-9 14H95c-12 0-21-8-21-20z"
          />
          <Path
            fill={paper}
            d="M98 192h101c-10 4-13 15-4 23H98a11.5 11.5 0 0 1 0-23z"
          />
        </Svg>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              transform: [
                {
                  translateX: lift.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -4],
                  }),
                },
                {
                  translateY: lift.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -6],
                  }),
                },
              ],
            },
          ]}
        >
          <Svg width={markSize} height={markSize} viewBox="0 0 256 256">
            <Path
              fill="none"
              stroke="#34799B"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={24}
              d="m76 112-21-21a30 30 0 0 1 43-43l34 34a30 30 0 0 1-28 51"
            />
          </Svg>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: paper,
    zIndex: 1,
  },
  mark: { width: markSize, height: markSize },
});
