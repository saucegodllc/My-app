import { Ionicons } from "@expo/vector-icons";
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
const TRIGGER_S = 1.6;
const DISSOLVE_MS = 1400;

function goToDating() {
  router.replace({ pathname: "/(tabs)", params: { intent: "dating" } } as never);
}

function goToFriends() {
  router.replace({ pathname: "/(tabs)", params: { intent: "friends" } } as never);
}

function goToSpaces() {
  router.replace("/(tabs)/communities" as never);
}

export default function SuccessScreen() {
  const insets = useSafeAreaInsets();
  const topPad = (Platform.OS === "web" ? 60 : insets.top) + 36;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const titleFade = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(44)).current;
  const subFade = useRef(new Animated.Value(0)).current;
  const dotScale = useRef(new Animated.Value(0)).current;

  const opA = useRef(new Animated.Value(1)).current;
  const opB = useRef(new Animated.Value(0)).current;

  const aIsActive = useRef(true);
  const fading = useRef(false);
  const ctx = useSuccessVideoPlayers();

  useEffect(() => {
    if (!ctx) return;
    const { playerA, playerB } = ctx;

    playerA.muted = true;
    playerB.muted = true;
    playerA.loop = true;
    playerB.loop = true;
    playerA.currentTime = 0;
    playerB.currentTime = 0;
    playerA.play();
    playerB.play();

    function dissolve() {
      if (fading.current) return;
      fading.current = true;

      const inOp = aIsActive.current ? opB : opA;
      const outOp = aIsActive.current ? opA : opB;
      const incomingPlayer = aIsActive.current ? playerB : playerA;
      const outgoingPlayer = aIsActive.current ? playerA : playerB;

      incomingPlayer.currentTime = 0;
      incomingPlayer.play();

      Animated.parallel([
        Animated.timing(inOp, { toValue: 1, duration: DISSOLVE_MS, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(outOp, { toValue: 0, duration: DISSOLVE_MS, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]).start(() => {
        outgoingPlayer.currentTime = 0;
        aIsActive.current = !aIsActive.current;
        fading.current = false;
      });
    }

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
  }, [ctx, opA, opB]);

  useEffect(() => {
    Animated.parallel([
      Animated.sequence([
        Animated.delay(200),
        Animated.spring(dotScale, { toValue: 1, friction: 6, tension: 180, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(380),
        Animated.parallel([
          Animated.timing(titleFade, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(titleSlide, { toValue: 0, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(740),
        Animated.timing(subFade, { toValue: 1, duration: 440, useNativeDriver: true }),
      ]),
    ]).start();
  }, [dotScale, subFade, titleFade, titleSlide]);

  return (
    <View style={{ flex: 1 }}>
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
            You're in
          </Animated.Text>
          <Animated.Text style={[styles.sub, { opacity: subFade }]}>
            Your profile is live. Pick your first move and turn a connection into a plan.
          </Animated.Text>
        </View>

        <Animated.View style={[styles.pathPanel, { paddingBottom: bottomInset, opacity: subFade }]}>
          <Text style={styles.pathEyebrow}>Start here</Text>
          <View style={styles.pathGrid}>
            <Pressable style={styles.pathPrimary} onPress={goToDating}>
              <LinearGradient colors={[PINK, "#8B5CF6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.pathPrimaryGrad}>
                <Ionicons name="heart" size={18} color="#fff" />
                <Text style={styles.pathPrimaryText}>Find a date</Text>
              </LinearGradient>
            </Pressable>
            <Pressable style={styles.pathSecondary} onPress={goToFriends}>
              <Ionicons name="people" size={17} color="#fff" />
              <Text style={styles.pathSecondaryText}>Make friends</Text>
            </Pressable>
            <Pressable style={styles.pathSecondary} onPress={goToSpaces}>
              <Ionicons name="planet" size={17} color="#fff" />
              <Text style={styles.pathSecondaryText}>Find Spaces</Text>
            </Pressable>
          </View>
          <View style={styles.trustRow}>
            <Ionicons name="shield-checkmark" size={14} color="rgba(255,255,255,0.86)" />
            <Text style={styles.trustText}>Verified profiles, report/block tools, and friend-friendly plans are always within reach.</Text>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
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
  pathPanel: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    paddingHorizontal: 18, paddingTop: 18,
    backgroundColor: "rgba(0,0,0,0.34)",
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.12)",
  },
  pathEyebrow: {
    color: "rgba(255,255,255,0.68)", fontSize: 11,
    fontFamily: "Inter_700Bold", textTransform: "uppercase",
    letterSpacing: 0.8, marginBottom: 10,
  },
  pathGrid: { gap: 10 },
  pathPrimary: { borderRadius: 18, overflow: "hidden" },
  pathPrimaryGrad: {
    minHeight: 54, borderRadius: 18, flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 9,
  },
  pathPrimaryText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  pathSecondary: {
    minHeight: 48, borderRadius: 16, flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  pathSecondaryText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  trustRow: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingTop: 13, paddingBottom: 12,
  },
  trustText: {
    flex: 1, color: "rgba(255,255,255,0.78)",
    fontSize: 11, lineHeight: 15, fontFamily: "Inter_500Medium",
  },
});
