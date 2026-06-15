import { useAuth, useUser } from "@clerk/clerk-expo";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

const { width, height } = Dimensions.get("window");

function Orb({
  color,
  size,
  x,
  y,
  driftX,
  driftY,
  duration,
  delay,
  opacity = 0.2,
}: {
  color: string;
  size: number;
  x: number;
  y: number;
  driftX: number;
  driftY: number;
  duration: number;
  delay: number;
  opacity?: number;
}) {
  const animX = useRef(new Animated.Value(0)).current;
  const animY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loopX = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(animX, { toValue: 1, duration: duration * 1.2, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(animX, { toValue: 0, duration: duration * 1.2, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])
    );
    const loopY = Animated.loop(
      Animated.sequence([
        Animated.delay(delay * 0.5),
        Animated.timing(animY, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(animY, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])
    );
    loopX.start();
    loopY.start();
    return () => { loopX.stop(); loopY.stop(); };
  }, [animX, animY, duration, delay]);

  return (
    <Animated.View
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        left: x,
        top: y,
        opacity,
        transform: [
          { translateX: animX.interpolate({ inputRange: [0, 1], outputRange: [0, driftX] }) },
          { translateY: animY.interpolate({ inputRange: [0, 1], outputRange: [0, driftY] }) },
        ],
      }}
    />
  );
}

export default function Index() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user, isLoaded: isUserLoaded } = useUser();
  const colors = useColors();

  const logoScale = useRef(new Animated.Value(0.5)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const glowScale = useRef(new Animated.Value(0.8)).current;

  const [animDone, setAnimDone] = useState(false);

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: false }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: false }),
      ]),
      Animated.timing(taglineOpacity, { toValue: 1, duration: 400, delay: 100, useNativeDriver: false }),
      Animated.delay(2000),
    ]).start(() => setAnimDone(true));

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowScale, { toValue: 1.15, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(glowScale, { toValue: 0.8, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (!animDone || !isLoaded) return;
    if (isSignedIn && !isUserLoaded) return; // wait for user metadata too

    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: 500,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start(() => {
      if (isSignedIn) {
        const onboardingComplete = user?.unsafeMetadata?.onboardingComplete === true;
        router.replace(onboardingComplete ? "/(tabs)" : "/onboarding");
      } else {
        router.replace("/(auth)/welcome");
      }
    });
  }, [animDone, isLoaded, isSignedIn, isUserLoaded, user]);

  return (
    <Animated.View style={[styles.container, { backgroundColor: colors.background, opacity: screenOpacity }]}>
      <Orb color={colors.primary} size={320} x={-80} y={-60} driftX={50} driftY={40} duration={4800} delay={0} opacity={0.2} />
      <Orb color={colors.accent} size={240} x={width - 120} y={height * 0.2} driftX={-45} driftY={60} duration={4200} delay={500} opacity={0.15} />
      <Orb color={colors.primary} size={200} x={width * 0.15} y={height * 0.65} driftX={55} driftY={-50} duration={3800} delay={300} opacity={0.14} />
      <Orb color={colors.accent} size={280} x={width - 100} y={height * 0.6} driftX={-40} driftY={-45} duration={5000} delay={800} opacity={0.12} />

      <View style={styles.center}>
        <View style={styles.logoWrapper}>
          <Animated.View
            style={[
              styles.glow,
              { backgroundColor: colors.primary, transform: [{ scale: glowScale }] },
            ]}
          />
          <Animated.View
            style={[
              styles.logoRing,
              { borderColor: colors.primary, transform: [{ scale: logoScale }], opacity: logoOpacity },
            ]}
          >
            <LinearGradient
              colors={[colors.primary, colors.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoGradient}
            >
              <Text style={styles.logoStar}>✦</Text>
            </LinearGradient>
          </Animated.View>
        </View>

        <Animated.Text
          style={[styles.appName, { color: colors.primary, opacity: logoOpacity, transform: [{ scale: logoScale }] }]}
        >
          ConnectSphere
        </Animated.Text>

        <Animated.Text
          style={[styles.tagline, { opacity: taglineOpacity }]}
        >
          Meet your next great connection
        </Animated.Text>
      </View>

    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingBottom: 120,
    paddingHorizontal: 24,
  },
  logoWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  glow: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    opacity: 0.2,
  },
  logoRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    overflow: "hidden",
  },
  logoGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoStar: {
    fontSize: 38,
    color: "#fff",
  },
  appName: {
    fontSize: 46,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.8,
    textAlign: "center",
    includeFontPadding: false,
  },
  tagline: {
    fontSize: 17,
    fontFamily: "Inter_400Regular",
    color: "#FFFFFF",
    letterSpacing: 0.3,
    textAlign: "center",
  },
});
