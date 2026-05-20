import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { VideoView } from "expo-video";

import { useColors } from "@/hooks/useColors";
import { useWelcomeVideoPlayer } from "@/contexts/WelcomeVideoContext";

const { width, height } = Dimensions.get("window");

const welcomePosterSource = require("@/assets/videos/welcome-loop-poster.jpg");

type OrbProps = {
  color: string;
  size: number;
  startX: number;
  startY: number;
  driftX: number;
  driftY: number;
  duration: number;
  delay: number;
  opacity?: number;
};

function FloatingOrb({
  color,
  size,
  startX,
  startY,
  driftX,
  driftY,
  duration,
  delay,
  opacity = 0.18,
}: OrbProps) {
  const animX = useRef(new Animated.Value(0)).current;
  const animY = useRef(new Animated.Value(0)).current;
  const animScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loopX = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(animX, {
          toValue: 1,
          duration: duration * 1.1,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(animX, {
          toValue: 0,
          duration: duration * 1.1,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    );

    const loopY = Animated.loop(
      Animated.sequence([
        Animated.delay(delay * 0.6),
        Animated.timing(animY, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(animY, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    );

    const loopScale = Animated.loop(
      Animated.sequence([
        Animated.timing(animScale, {
          toValue: 1.15,
          duration: duration * 0.75,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
          delay,
        }),
        Animated.timing(animScale, {
          toValue: 1,
          duration: duration * 0.75,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ])
    );

    loopX.start();
    loopY.start();
    loopScale.start();

    return () => {
      loopX.stop();
      loopY.stop();
      loopScale.stop();
    };
  }, [animX, animY, animScale, duration, delay]);

  const translateX = animX.interpolate({
    inputRange: [0, 1],
    outputRange: [0, driftX],
  });
  const translateY = animY.interpolate({
    inputRange: [0, 1],
    outputRange: [0, driftY],
  });

  return (
    <Animated.View
      style={[
        styles.orb,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          left: startX,
          top: startY,
          opacity,
          transform: [{ translateX }, { translateY }, { scale: animScale }],
        },
      ]}
    />
  );
}

export default function WelcomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const player = useWelcomeVideoPlayer();

  useEffect(() => {
    if (player) {
      player.muted = true;
      player.play();
    }
  }, [player]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        delay: 200,
        useNativeDriver: false,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        delay: 200,
        useNativeDriver: false,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Poster image — shows instantly, video covers it once playing */}
      <Image
        source={welcomePosterSource}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />

      {/* Looping video background — people networking, sharing drinks, dating */}
      {player ? (
        <VideoView
          player={player}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
        />
      ) : null}

      {/* Dark gradient overlay for text readability */}
      <LinearGradient
        colors={[
          "rgba(10,10,10,0.25)",
          "rgba(10,10,10,0.15)",
          "rgba(10,10,10,0.75)",
          "rgba(10,10,10,0.97)",
        ]}
        locations={[0, 0.4, 0.78, 1]}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />

      {/* Subtle pink accent orbs over the video */}
      <FloatingOrb
        color={colors.primary}
        size={280}
        startX={-90}
        startY={-60}
        driftX={50}
        driftY={40}
        duration={5000}
        delay={0}
        opacity={0.12}
      />
      <FloatingOrb
        color={colors.accent}
        size={220}
        startX={width - 120}
        startY={height * 0.55}
        driftX={-50}
        driftY={-60}
        duration={4400}
        delay={600}
        opacity={0.1}
      />

      <Animated.View
        style={[
          styles.content,
          {
            paddingTop: topInset + 20,
            paddingBottom: bottomInset + 40,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.logoSection}>
          <View style={[styles.logoIcon, { borderColor: colors.primary }]}>
            <Text style={styles.logoEmoji}>✦</Text>
          </View>
          <Text style={[styles.appName, { color: colors.primary }]}>
            ConnectSphere
          </Text>
          <Text style={[styles.tagline, { color: "#ffffff" }]}>
            Meet your next great connection
          </Text>
          <Text style={[styles.subtitle, { color: "#ffffff" }]}>
            Dating · Friendships
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={() => router.push("/(auth)/sign-up")}
            testID="get-started-btn"
          >
            {({ pressed }) => (
              <LinearGradient
                colors={[colors.primary, colors.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.primaryButton,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={styles.primaryButtonText}>Get Started</Text>
              </LinearGradient>
            )}
          </Pressable>

          <Pressable
            onPress={() => router.push("/(auth)/sign-in")}
            style={({ pressed }) => [
              styles.secondaryButton,
              {
                borderColor: "#ffffff",
                backgroundColor: pressed ? "#1a1a1a" : "#0a0a0a",
              },
            ]}
            testID="sign-in-btn"
          >
            <Text style={[styles.secondaryButtonText, { color: "#ffffff" }]}>
              Sign In
            </Text>
          </Pressable>

          <Text style={[styles.legal, { color: colors.mutedForeground }]}>
            By continuing, you agree to our Terms of Service{"\n"}and Privacy
            Policy. Must be 18+ to join.
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
  },
  orb: {
    position: "absolute",
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "space-between",
  },
  logoSection: {
    alignItems: "center",
    gap: 12,
  },
  logoIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  logoEmoji: {
    fontSize: 32,
    color: "#FF299B",
  },
  appName: {
    fontSize: 38,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  tagline: {
    fontSize: 23,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  subtitle: {
    fontSize: 19,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    lineHeight: 28,
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  secondaryButton: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  legal: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    marginTop: 4,
  },
});
