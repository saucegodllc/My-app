import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { VideoView } from "expo-video";
import { useEffect, useRef } from "react";
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

import {
  SUCCESS_CLIP_S,
  useSuccessVideoPlayers,
} from "@/contexts/SuccessVideoContext";

const PINK = "#FF299B";

// Start dissolving this many seconds before the active player hits its loop point.
// Larger value = more buffer before the native loop gap.
const TRIGGER_S = 1.6;
// Length of the dissolve — sinusoidal so it's barely perceptible.
const DISSOLVE_MS = 1400;

function goToApp() {
  router.replace("/(tabs)");
}

export default function SuccessScreen() {
  const insets = useSafeAreaInsets();
  const topPad = (Platform.OS === "web" ? 60 : insets.top) + 36;
  const titleFade  = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(44)).current;
  const subFade    = useRef(new Animated.Value(0)).current;
  const dotScale   = useRef(new Animated.Value(0)).current;

  const opA = useRef(new Animated.Value(1)).current;
  const opB = useRef(new Animated.Value(0)).current;

  const aIsActive = useRef(true);
  const fading    = useRef(false);

  // Players are pre-warmed and already playing from the provider —
  // zero cold-start latency when the screen appears.
  const ctx = useSuccessVideoPlayers();

  useEffect(() => {
    if (!ctx) return;
    const { playerA, playerB } = ctx;

    // Ensure both are muted and looping; they should already be from the provider
    playerA.muted = true;
    playerB.muted = true;
    playerA.loop  = true;
    playerB.loop  = true;

    // Make sure both are playing (guard against the screen mounting before the
    // provider's useEffect has a chance to run on first load)
    playerA.currentTime = 0;
    playerB.currentTime = 0;
    playerA.play();
    playerB.play();

    function dissolve() {
      if (fading.current) return;
      fading.current = true;

      const inOp  = aIsActive.current ? opB : opA;
      const outOp = aIsActive.current ? opA : opB;
      const incomingPlayer = aIsActive.current ? playerB : playerA;
      const outgoingPlayer = aIsActive.current ? playerA : playerB;

      incomingPlayer.currentTime = 0;
      incomingPlayer.play();

      Animated.parallel([
        Animated.timing(inOp,  { toValue: 1, duration: DISSOLVE_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(outOp, { toValue: 0, duration: DISSOLVE_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]).start(() => {
        outgoingPlayer.currentTime = 0;
        aIsActive.current = !aIsActive.current;
        fading.current    = false;
      });
    }

    // Trigger when the ACTIVE player is 4 s from its loop point.
    // The dissolve takes 2.5 s, completing 1.5 s before the loop fires —
    // the native loop gap always hits while the player is invisible.
    const subA = playerA.addListener("timeUpdate", ({ currentTime }) => {
      if (aIsActive.current && currentTime >= SUCCESS_CLIP_S - TRIGGER_S) dissolve();
    });

    const subB = playerB.addListener("timeUpdate", ({ currentTime }) => {
      if (!aIsActive.current && currentTime >= SUCCESS_CLIP_S - TRIGGER_S) dissolve();
    });

    return () => {
      subA.remove();
      subB.remove();
    };
  }, [ctx]);

  // Entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.sequence([
        Animated.delay(200),
        Animated.spring(dotScale, { toValue: 1, friction: 6, tension: 180, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(380),
        Animated.parallel([
          Animated.timing(titleFade,  { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(titleSlide, { toValue: 0, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(740),
        Animated.timing(subFade, { toValue: 1, duration: 440, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <Pressable style={{ flex: 1 }} onPress={goToApp}>
      <View style={styles.container}>

        <Animated.View style={[StyleSheet.absoluteFill, { opacity: opB }]}>
          {ctx?.playerB ? (
            <VideoView
              player={ctx.playerB}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              nativeControls={false}
            />
          ) : null}
        </Animated.View>

        <Animated.View style={[StyleSheet.absoluteFill, { opacity: opA }]}>
          {ctx?.playerA ? (
            <VideoView
              player={ctx.playerA}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              nativeControls={false}
            />
          ) : null}
        </Animated.View>

        <LinearGradient
          colors={["rgba(0,0,0,0.70)", "rgba(0,0,0,0.18)", "rgba(0,0,0,0.08)", "rgba(0,0,0,0.78)"]}
          locations={[0, 0.25, 0.55, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <View style={[styles.glowOrb, { top: topPad - 30 }]} pointerEvents="none" />

        <View style={[styles.textBlock, { paddingTop: topPad }]}>
          <Animated.View style={[styles.dot, { transform: [{ scale: dotScale }] }]} />
          <Animated.Text style={[styles.title, { opacity: titleFade, transform: [{ translateY: titleSlide }] }]}>
            {"Success! 🎉"}
          </Animated.Text>
          <Animated.Text style={[styles.sub, { opacity: subFade }]}>
            Your profile is live. Your next great{"\n"}connection is already out there.
          </Animated.Text>
        </View>

      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: "#000" },
  glowOrb: {
    position: "absolute", left: "50%", marginLeft: -110,
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: "rgba(255,41,155,0.16)",
    shadowColor: "#FF299B", shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1, shadowRadius: 80,
  },
  textBlock: {
    position: "absolute", top: 0, left: 0, right: 0,
    paddingHorizontal: 28, gap: 10,
  },
  dot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: PINK, marginBottom: 4,
    shadowColor: PINK, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1, shadowRadius: 10,
  },
  title: {
    fontSize: 54, fontFamily: "Inter_700Bold", color: PINK,
    lineHeight: 64, letterSpacing: -1.5,
    textShadowColor: "rgba(255,41,155,0.4)",
    textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 20,
  },
  sub: {
    fontSize: 17, fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.84)", lineHeight: 26,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6, marginTop: 2,
  },
});
