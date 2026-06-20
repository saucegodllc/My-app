/**
 * FirstSessionGuide
 *
 * A 3-step coach-mark overlay shown exactly once to every new user immediately
 * after they land on the Discover tab for the first time.
 *
 * Steps:
 *  1. Swipe to Vibe   — explains the core swipe mechanic
 *  2. It's a Match!   — what happens when both people like each other
 *  3. Break the Ice   — suggests opening with a Moment, plan, or message
 *
 * Seen state persisted under AsyncStorage key "cs:guide:seen".
 * Safe to import anywhere — renders nothing when `visible` is false.
 */

import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ── Constants ─────────────────────────────────────────────────────────────────

export const GUIDE_SEEN_KEY = "cs:guide:seen";

const { width: SCREEN_W } = Dimensions.get("window");

// ── Step definitions ──────────────────────────────────────────────────────────

type Step = {
  icon: string;           // Ionicons name
  iconColor: string;
  gradientColors: [string, string];
  headline: string;
  body: string;
  cta: string;            // label for the primary button on this step
};

const STEPS: Step[] = [
  {
    icon: "heart",
    iconColor: "#FF2DA8",
    gradientColors: ["#1a0a14", "#2d0f20"],
    headline: "Swipe to Vibe",
    body: "Tap the Heart to like someone, or swipe right. Swipe left to pass. The people you like will never know unless they like you back.",
    cta: "Got it — next",
  },
  {
    icon: "flash",
    iconColor: "#FACC15",
    gradientColors: ["#14120a", "#251e0a"],
    headline: "It's a Match! ⚡",
    body: "When both of you like each other you'll get a match notification and a chat unlocks instantly. Say something — the first move is half the magic.",
    cta: "Makes sense — next",
  },
  {
    icon: "sparkles",
    iconColor: "#A78BFA",
    gradientColors: ["#0d0a1a", "#150d2e"],
    headline: "Break the Ice",
    body: "Not sure what to say? Reply to a Moment, suggest a plan, or use a profile detail as your opener.",
    cta: "Let's go!",
  },
];

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  visible: boolean;
  onDone: () => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function FirstSessionGuide({ visible, onDone }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const iconBounce = useRef(new Animated.Value(0)).current;

  const current = STEPS[step]!;
  const isLast = step === STEPS.length - 1;

  // Entrance animation whenever the guide becomes visible
  useEffect(() => {
    if (!visible) {
      // Reset for next time (shouldn't happen after seen, but defensive)
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.92);
      slideAnim.setValue(0);
      setStep(0);
      return;
    }
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        stiffness: 220,
        damping: 18,
        useNativeDriver: true,
      }),
    ]).start();
    bounceIcon();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Icon bounce on step change
  useEffect(() => {
    bounceIcon();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function bounceIcon() {
    iconBounce.setValue(0);
    Animated.spring(iconBounce, {
      toValue: 1,
      stiffness: 300,
      damping: 10,
      mass: 0.6,
      useNativeDriver: true,
    }).start();
  }

  const handleNext = () => {
    if (isLast) {
      // Fade out then close
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.94,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        void AsyncStorage.setItem(GUIDE_SEEN_KEY, "1").catch(() => {});
        onDone();
      });
    } else {
      // Slide current step out left, slide next in from right
      Animated.timing(slideAnim, {
        toValue: -SCREEN_W,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setStep((s) => s + 1);
        slideAnim.setValue(SCREEN_W * 0.35);
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });
    }
  };

  const handleSkip = () => {
    void AsyncStorage.setItem(GUIDE_SEEN_KEY, "1").catch(() => {});
    onDone();
  };

  const iconScale = iconBounce.interpolate({
    inputRange: [0, 0.5, 0.75, 1],
    outputRange: [0.4, 1.15, 0.95, 1],
  });

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleSkip}
    >
      {/* Backdrop — semi-opaque dark overlay */}
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        {/* Dismiss tap on backdrop */}
        <Pressable style={StyleSheet.absoluteFill} onPress={handleSkip} />

        {/* Card — slides + fades in, sits above the tab bar */}
        <Animated.View
          style={[
            styles.cardWrap,
            {
              paddingBottom: insets.bottom + (Platform.OS === "ios" ? 96 : 86),
              opacity: fadeAnim,
              transform: [
                { scale: scaleAnim },
                { translateX: slideAnim },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={current.gradientColors}
            style={styles.card}
          >
            {/* Step dots */}
            <View style={styles.dotsRow}>
              {STEPS.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i === step ? styles.dotActive : styles.dotInactive,
                  ]}
                />
              ))}
            </View>

            {/* Skip link */}
            <Pressable onPress={handleSkip} style={styles.skipBtn} hitSlop={12}>
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>

            {/* Animated icon */}
            <Animated.View
              style={[styles.iconWrap, { transform: [{ scale: iconScale }] }]}
            >
              <LinearGradient
                colors={["rgba(255,255,255,0.08)", "rgba(255,255,255,0.03)"]}
                style={styles.iconCircle}
              >
                <Ionicons
                  name={current.icon as never}
                  size={48}
                  color={current.iconColor}
                />
              </LinearGradient>
            </Animated.View>

            {/* Text */}
            <Text style={styles.headline}>{current.headline}</Text>
            <Text style={styles.body}>{current.body}</Text>

            {/* CTA button */}
            <Pressable onPress={handleNext} style={styles.ctaWrap}>
              <LinearGradient
                colors={["#EC4899", "#D946EF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.cta}
              >
                <Text style={styles.ctaText}>{current.cta}</Text>
                {!isLast && (
                  <Ionicons name="arrow-forward" size={16} color="#fff" style={{ marginLeft: 4 }} />
                )}
              </LinearGradient>
            </Pressable>

            {/* Step count hint */}
            <Text style={styles.stepHint}>{step + 1} of {STEPS.length}</Text>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    justifyContent: "flex-end",
  },
  cardWrap: {
    paddingHorizontal: 16,
  },
  card: {
    borderRadius: 28,
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    overflow: "hidden",
  },
  dotsRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 12,
  },
  dot: {
    height: 5,
    borderRadius: 3,
  },
  dotActive: {
    width: 20,
    backgroundColor: "#EC4899",
  },
  dotInactive: {
    width: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  skipBtn: {
    position: "absolute",
    top: 22,
    right: 22,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  skipText: {
    color: "rgba(255,255,255,0.38)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  iconWrap: {
    marginTop: 8,
    marginBottom: 20,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  headline: {
    fontSize: 26,
    fontFamily: "Sora_800ExtraBold",
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: -0.4,
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "rgba(228,228,231,0.80)",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 4,
  },
  ctaWrap: {
    width: "100%",
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 14,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
  },
  ctaText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.1,
  },
  stepHint: {
    color: "rgba(255,255,255,0.25)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
