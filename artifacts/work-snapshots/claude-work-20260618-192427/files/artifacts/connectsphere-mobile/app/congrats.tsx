import { useAuth, useSignIn } from "@clerk/clerk-expo";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCongratsVideoPlayer } from "@/contexts/CongratsVideoContext";
import { consumePendingAutoSignIn } from "@/lib/pendingAuth";
import { VideoView } from "expo-video";

const PINK = "#FF299B";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function CongratsScreen() {
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const { signIn, setActive, isLoaded } = useSignIn();
  const { isSignedIn, isLoaded: isAuthLoaded } = useAuth();
  const autoSignInStartedRef = useRef(false);
  const routeStartedRef = useRef(false);
  const destinationRef = useRef<"/onboarding" | "/(tabs)" | "/(auth)/welcome">("/onboarding");
  const [welcomeDone, setWelcomeDone] = useState(false);
  const [handoffFailed, setHandoffFailed] = useState(false);

  const player = useCongratsVideoPlayer();

  useEffect(() => {
    if (!player) return;
    player.muted = true;
    player.play();
  }, [player]);

  useEffect(() => {
    if (!isLoaded || !signIn || !setActive || autoSignInStartedRef.current) return;
    const pending = consumePendingAutoSignIn();
    if (!pending) return;
    autoSignInStartedRef.current = true;
    destinationRef.current = pending.destination === "/(tabs)" ? "/(tabs)" : "/onboarding";
    if (isSignedIn) return;

    void (async () => {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        try {
          if (pending.ticket) {
            const ticketAttempt = await signIn.create({ strategy: "ticket", ticket: pending.ticket });
            if (ticketAttempt.status === "complete" && ticketAttempt.createdSessionId) {
              await setActive({ session: ticketAttempt.createdSessionId });
              return;
            }
          }
        } catch (err) {
          console.warn("[congrats] ticket session handoff:", err);
        }

        try {
          const passwordAttempt = await signIn.create({ identifier: pending.email, password: pending.password });
          if (passwordAttempt.status === "complete" && passwordAttempt.createdSessionId) {
            await setActive({ session: passwordAttempt.createdSessionId });
            return;
          }
          if (passwordAttempt.status === "needs_first_factor") {
            const factorAttempt = await signIn.attemptFirstFactor({ strategy: "password", password: pending.password });
            if (factorAttempt.status === "complete" && factorAttempt.createdSessionId) {
              await setActive({ session: factorAttempt.createdSessionId });
              return;
            }
          }
        } catch (err) {
          console.warn("[congrats] password session handoff:", err);
        }

        await wait(700 * (attempt + 1));
      }
      setHandoffFailed(true);
    })();
  }, [isLoaded, signIn, setActive, isSignedIn]);

  const screenFade = useRef(new Animated.Value(1)).current;
  const titleFade  = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(32)).current;
  const subFade    = useRef(new Animated.Value(0)).current;
  const subSlide   = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    // Text fades in on mount
    Animated.sequence([
      Animated.parallel([
        Animated.timing(titleFade,  { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(titleSlide, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.delay(150),
      Animated.parallel([
        Animated.timing(subFade,  { toValue: 1, duration: 450, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(subSlide, { toValue: 0, duration: 450, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]),
    ]).start();

    // Finish the welcome moment, then route only after auth is actually ready.
    const fadeTimer = setTimeout(() => {
      setWelcomeDone(true);
    }, 6500);

    return () => clearTimeout(fadeTimer);
  }, []);

  useEffect(() => {
    if (!welcomeDone || !isAuthLoaded || routeStartedRef.current) return;

    const destination = isSignedIn
      ? destinationRef.current
      : handoffFailed
      ? "/(auth)/welcome"
      : null;

    if (!destination) return;
    routeStartedRef.current = true;
    Animated.timing(screenFade, {
      toValue: 0,
      duration: 600,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      if (destination === "/(tabs)") router.replace("/(tabs)");
      else if (destination === "/(auth)/welcome") router.replace("/(auth)/welcome");
      else router.replace("/onboarding");
    });
  }, [welcomeDone, isAuthLoaded, isSignedIn, handoffFailed, screenFade]);

  return (
    <Animated.View style={[styles.container, { opacity: screenFade }]}>
      {player && (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
        />
      )}

      {/* Light gradient only at the bottom so text stays readable but video is bright */}
      <LinearGradient
        colors={[
          "transparent",
          "transparent",
          "rgba(0,0,0,0.3)",
          "rgba(0,0,0,0.78)",
        ]}
        locations={[0, 0.5, 0.72, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={[styles.textBlock, { bottom: "28%" }]}>
        <Animated.Text
          style={[
            styles.title,
            { opacity: titleFade, transform: [{ translateY: titleSlide }] },
          ]}
        >
          Welcome to{"\n"}
          <Text style={styles.titlePink}>ConnectSphere!</Text>
        </Animated.Text>

        <Animated.Text
          style={[
            styles.sub,
            { opacity: subFade, transform: [{ translateY: subSlide }] },
          ]}
        >
          Your next great connection is waiting 🔥
        </Animated.Text>

        {/* Spaces CTA — fades in alongside the subtitle */}
        <Animated.View
          style={[styles.playCtaWrap, { opacity: subFade, transform: [{ translateY: subSlide }] }]}
        >
          <Pressable
            onPress={() => router.replace("/(tabs)/communities" as any)}
            style={styles.playCtaBtn}
          >
            <LinearGradient
              colors={["rgba(168,85,247,0.85)", "rgba(236,72,153,0.85)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.playCtaGrad}
            >
              <Text style={styles.playCtaEmoji}>🪐</Text>
              <Text style={styles.playCtaText}>Explore Spaces</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  textBlock: {
    position: "absolute",
    left: 0,
    right: 0,
    paddingHorizontal: 28,
    gap: 12,
    alignItems: "flex-start",
  },
  title: {
    fontSize: 42,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    lineHeight: 52,
    letterSpacing: -1,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  titlePink: {
    color: PINK,
    textShadowColor: "rgba(255,41,155,0.35)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  sub: {
    fontSize: 17,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.88)",
    lineHeight: 26,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  playCtaWrap: { marginTop: 8 },
  playCtaBtn: { borderRadius: 20, overflow: "hidden" },
  playCtaGrad: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  playCtaEmoji: { fontSize: 18 },
  playCtaText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
});
