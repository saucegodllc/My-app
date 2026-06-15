/**
 * ActionFeedback — reusable micro-animation system for ConnectSphere.
 *
 * Provides:
 *   1. useActionFeedback()  hook  — drives button scale + haptic on tap
 *   2. <ParticleBurst />         — emoji/icon particles that fly outward
 *   3. <ToastFeedback />         — floating label that pops up and fades
 *   4. useFeedback()             — orchestrate both together with one call
 *
 * Usage example:
 *   const { trigger, animatedStyle, BurstOverlay } = useFeedback("shot");
 *   <Pressable style={animatedStyle} onPress={() => { sendShot(); trigger(); }}>
 *     <Text>Send Shot 🔥</Text>
 *   </Pressable>
 *   <BurstOverlay />
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";

// ── Types ─────────────────────────────────────────────────────────────────────

export type FeedbackPreset =
  | "shot"           // 🔥 Send Shot
  | "like"           // ❤️  Like / Vibe
  | "spark"          // ✨ Spark / Super-like
  | "connect"        // 🤝 Add / Connect
  | "accept"         // ✅ Accept request
  | "block"          // 🚫 Block user
  | "report"         // 🚩 Report user
  | "message"        // 💬 Send message
  | "plan"           // 📅 Create plan
  | "interest"       // ⭐ Mark event interest
  | "match"          // 💗 Match moment
  | "double_date"    // 👫 Double Date match
  | "invite"         // ✉️  Invite sent
  | "generic";       // ✓  Generic success

type PresetConfig = {
  particles: string[];
  label: string;
  haptic: "light" | "medium" | "heavy" | "success" | "warning" | "error" | "none";
  color: string;
  scaleTarget: number;
  /** Set false to skip the small toast pill (e.g. when a richer overlay like
   *  ShotToast already carries the moment — spec 4.2). */
  showToast?: boolean;
};

const PRESETS: Record<FeedbackPreset, PresetConfig> = {
  // No mini-toast for shots: the rich ShotToast modal IS the feedback. The
  // legacy "Shot sent!" pill stacked on top of it (spec 4.2).
  shot:        { particles: ["🔥","🔥","💥","⚡","🔥"], label: "", haptic: "medium", color: "#FF6B35", scaleTarget: 0.88, showToast: false },
  like:        { particles: ["❤️","💕","❤️","💖","✨"], label: "Liked!", haptic: "light", color: "#FF299B", scaleTarget: 0.90 },
  spark:       { particles: ["✨","⭐","💫","✨","🌟"], label: "Sparked!", haptic: "heavy", color: "#A855F7", scaleTarget: 0.85 },
  connect:     { particles: ["🤝","✨","🎉","💫","🤝"], label: "Connected!", haptic: "success", color: "#22C55E", scaleTarget: 0.88 },
  accept:      { particles: ["🎉","✅","💗","🎊","✨"], label: "Accepted!", haptic: "success", color: "#22C55E", scaleTarget: 0.88 },
  block:       { particles: ["🚫","⛔","🚫"], label: "Blocked", haptic: "error", color: "#EF4444", scaleTarget: 0.92 },
  report:      { particles: ["🚩","📋","🚩"], label: "Reported", haptic: "warning", color: "#F59E0B", scaleTarget: 0.92 },
  message:     { particles: ["💬","✉️","💬","📨"], label: "Sent!", haptic: "light", color: "#3B82F6", scaleTarget: 0.92 },
  plan:        { particles: ["📅","🎉","📅","✨","🎊"], label: "Plan created!", haptic: "success", color: "#8B5CF6", scaleTarget: 0.88 },
  interest:    { particles: ["⭐","✨","⭐","💫"], label: "Saved!", haptic: "light", color: "#FBBF24", scaleTarget: 0.90 },
  match:       { particles: ["💗","🎉","💗","✨","🎊","💕"], label: "It's a match!", haptic: "heavy", color: "#FF299B", scaleTarget: 0.82 },
  double_date: { particles: ["👫","🎉","💑","✨","🥂","🎊"], label: "Double Date match!", haptic: "heavy", color: "#A855F7", scaleTarget: 0.82 },
  invite:      { particles: ["✉️","📨","✉️","🚀"], label: "Invite sent!", haptic: "medium", color: "#06B6D4", scaleTarget: 0.90 },
  generic:     { particles: ["✓","✨","✓"], label: "Done!", haptic: "light", color: "#22C55E", scaleTarget: 0.92 },
};

// ── Haptic helper ─────────────────────────────────────────────────────────────

async function fireHaptic(type: PresetConfig["haptic"]) {
  if (Platform.OS === "web") return;
  try {
    if (type === "light")   await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (type === "medium")  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (type === "heavy")   await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (type === "success") await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (type === "warning") await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (type === "error")   await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch { /* Haptics not available on this device */ }
}

// ── Button press scale animation ─────────────────────────────────────────────

/**
 * Returns an Animated.Value that springs from scaleTarget back to 1
 * whenever trigger() is called. Wrap your button in an Animated.View
 * with { transform: [{ scale }] }.
 */
export function useActionFeedback(preset: FeedbackPreset = "generic") {
  const config = PRESETS[preset];
  const scale = useRef(new Animated.Value(1)).current;

  const trigger = useCallback(() => {
    void fireHaptic(config.haptic);
    Animated.sequence([
      Animated.timing(scale, {
        toValue: config.scaleTarget,
        duration: 80,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 4,
        tension: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale, config]);

  return { scale, trigger };
}

// ── Particle burst ────────────────────────────────────────────────────────────

type Particle = {
  id: number;
  emoji: string;
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
  angle: number;
};

function createParticle(id: number, emoji: string): Particle {
  return {
    id,
    emoji,
    x: new Animated.Value(0),
    y: new Animated.Value(0),
    opacity: new Animated.Value(1),
    scale: new Animated.Value(0.4),
    angle: (id / 5) * 2 * Math.PI + Math.random() * 0.5,
  };
}

function animateParticle(p: Particle) {
  const dist = 55 + Math.random() * 45;
  const tx = Math.cos(p.angle) * dist;
  const ty = Math.sin(p.angle) * dist - 20; // slight upward drift
  const duration = 550 + Math.random() * 200;

  return Animated.parallel([
    Animated.timing(p.x, { toValue: tx, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    Animated.timing(p.y, { toValue: ty, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    Animated.sequence([
      Animated.timing(p.scale, { toValue: 1.3, duration: 180, useNativeDriver: true }),
      Animated.timing(p.scale, { toValue: 0.6, duration: duration - 180, useNativeDriver: true }),
    ]),
    Animated.sequence([
      Animated.delay(duration * 0.5),
      Animated.timing(p.opacity, { toValue: 0, duration: duration * 0.5, useNativeDriver: true }),
    ]),
  ]);
}

/**
 * ParticleBurst — renders emoji particles that fly outward from a centre point.
 * Controlled by `visible` prop; fires animation on mount when visible.
 */
export function ParticleBurst({
  visible,
  preset = "generic",
  onDone,
}: {
  visible: boolean;
  preset?: FeedbackPreset;
  onDone?: () => void;
}) {
  const config = PRESETS[preset];
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!visible) return;
    const ps = config.particles.map((emoji, i) => createParticle(i, emoji));
    setParticles(ps);
    const anims = ps.map(animateParticle);
    Animated.parallel(anims).start(() => {
      setParticles([]);
      onDone?.();
    });
  }, [visible]);

  if (!visible && particles.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={styles.burstOrigin}>
        {particles.map((p) => (
          <Animated.View
            key={p.id}
            style={[
              styles.particleWrap,
              {
                transform: [
                  { translateX: p.x },
                  { translateY: p.y },
                  { scale: p.scale },
                ],
                opacity: p.opacity,
              },
            ]}
          >
            <Text style={styles.particleText}>{p.emoji}</Text>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

// ── Toast label ───────────────────────────────────────────────────────────────

/**
 * ToastFeedback — a floating label that slides up and fades out.
 */
export function ToastFeedback({
  visible,
  preset = "generic",
  onDone,
}: {
  visible: boolean;
  preset?: FeedbackPreset;
  onDone?: () => void;
}) {
  const config = PRESETS[preset];
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    opacity.setValue(0);
    translateY.setValue(0);
    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -28, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.delay(600),
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -52, duration: 250, useNativeDriver: true }),
      ]),
    ]).start(onDone);
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={styles.toastWrap} pointerEvents="none">
      <Animated.View style={[styles.toastPill, { backgroundColor: config.color, opacity, transform: [{ translateY }] }]}>
        <Text style={styles.toastText}>{config.label}</Text>
      </Animated.View>
    </View>
  );
}

// ── Combined hook ─────────────────────────────────────────────────────────────

/**
 * useFeedback — the single hook to use in components.
 *
 * Returns:
 *   - trigger()       → fires haptic + burst + toast + button scale
 *   - animatedStyle   → apply to your Pressable/TouchableOpacity wrapper
 *   - BurstOverlay    → render this as a sibling of your button (absolutely positioned)
 *
 * Example:
 *   const { trigger, animatedStyle, BurstOverlay } = useFeedback("shot");
 *   return (
 *     <View>
 *       <Animated.View style={animatedStyle}>
 *         <Pressable onPress={() => { doThing(); trigger(); }}>...</Pressable>
 *       </Animated.View>
 *       <BurstOverlay />
 *     </View>
 *   );
 */
export function useFeedback(preset: FeedbackPreset = "generic") {
  const { scale, trigger: pressScale } = useActionFeedback(preset);
  const [burstKey, setBurstKey] = useState(0);
  const [burstVisible, setBurstVisible] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  const trigger = useCallback(() => {
    pressScale();
    setBurstKey((k) => k + 1);
    setBurstVisible(true);
    setToastVisible(PRESETS[preset].showToast !== false);
  }, [preset, pressScale]);

  const animatedStyle = { transform: [{ scale }] };

  function BurstOverlay() {
    return (
      <>
        <ParticleBurst
          key={`burst-${burstKey}`}
          visible={burstVisible}
          preset={preset}
          onDone={() => setBurstVisible(false)}
        />
        <ToastFeedback
          key={`toast-${burstKey}`}
          visible={toastVisible}
          preset={preset}
          onDone={() => setToastVisible(false)}
        />
      </>
    );
  }

  return { trigger, animatedStyle, BurstOverlay };
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  burstOrigin: {
    position: "absolute",
    alignSelf: "center",
    top: "50%",
    left: "50%",
  },
  particleWrap: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  particleText: {
    fontSize: 20,
  },
  toastWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    bottom: "100%",
    marginBottom: 4,
  },
  toastPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  toastText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
});
