/**
 * VibeRevealScreen — full-screen "Sorting Hat" moment shown once after the user
 * completes the Vibe Check Quiz for the first time.
 *
 * Derives a personality archetype from the 5 quiz dimensions, shows a
 * dramatic reveal animation, then calls onContinue to hand back control
 * to the Discover tab.
 */
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { VibeCheckAnswers } from "./VibeCheckQuiz";

// ─── Archetype map ─────────────────────────────────────────────────────────────
//
// Each archetype is chosen by scoring the answers. The most expressive combo
// of energy + loveLanguage + adventureLevel decides the label.

type VibeArchetype = {
  title: string;
  tagline: string;
  emoji: string;
  gradientColors: [string, string, string];
  description: string;
};

function deriveArchetype(answers: VibeCheckAnswers): VibeArchetype {
  const { energyType, loveLanguage, adventureLevel, conflictStyle, datePace } = answers;

  // Adventurous extrovert — high energy + acts of service or quality time + bold
  if (energyType === "adventurer" && adventureLevel >= 4) {
    return {
      title: "The Spark Chaser",
      tagline: "You turn ordinary moments into stories worth telling.",
      emoji: "⚡️",
      gradientColors: ["#F59E0B", "#EF4444", "#7C3AED"],
      description:
        "You're drawn to people who match your energy. Slow burns aren't your thing — you want to feel something real, fast. Your ideal match is someone who says yes first and plans later.",
    };
  }

  // Words of affirmation + slow pace = thoughtful romantic
  if (loveLanguage === "words" && datePace === "slow-burn") {
    return {
      title: "The Deep Diver",
      tagline: "You read between the lines — and you write good ones too.",
      emoji: "🌊",
      gradientColors: ["#3B82F6", "#6366F1", "#1E1B4B"],
      description:
        "You're not interested in small talk. You want to know someone's 3 AM thoughts. Your match will appreciate that you actually remember what they said last Tuesday.",
    };
  }

  // Physical touch + adventurer = spontaneous and warm
  if (loveLanguage === "touch" && energyType !== "homebody") {
    return {
      title: "The Warm Pulse",
      tagline: "Your presence alone changes the vibe in a room.",
      emoji: "🔥",
      gradientColors: ["#EC4899", "#F97316", "#7C3AED"],
      description:
        "You communicate love through presence — showing up, staying close, little gestures that say 'I see you.' Your match will feel safe and lit up at the same time.",
    };
  }

  // Homebody + quality time + slow = cozy nester
  if (energyType === "homebody" && loveLanguage === "time") {
    return {
      title: "The Cozy Architect",
      tagline: "You build something real — and it lasts.",
      emoji: "🏡",
      gradientColors: ["#10B981", "#059669", "#064E3B"],
      description:
        "Netflix is better with you. You create safe spaces for people to be themselves. Your match is someone who knows that staying in can be the most romantic thing.",
    };
  }

  // Quick-fix conflict style + fast pace + high adventure = pragmatic trailblazer
  if (conflictStyle === "quick-fix" && datePace === "fast-sparks") {
    return {
      title: "The Trailblazer",
      tagline: "You move fast, fix fast, and feel fast.",
      emoji: "🚀",
      gradientColors: ["#8B5CF6", "#EC4899", "#F43F5E"],
      description:
        "You don't do ambiguous. You'd rather clear the air and get back to the good stuff. Your match keeps up with you and respects that you know what you want.",
    };
  }

  // Balanced catch-all — the connector
  return {
    title: "The Connector",
    tagline: "You're the rare kind who actually makes people feel seen.",
    emoji: "✨",
    gradientColors: ["#A78BFA", "#EC4899", "#F97316"],
    description:
      "You're adaptable, perceptive, and genuinely curious about people. You can vibe with almost anyone, but you're waiting for the one who vibes back just as hard.",
  };
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function VibeRevealScreen({
  answers,
  onContinue,
}: {
  answers: VibeCheckAnswers;
  onContinue: () => void;
}) {
  const { top, bottom } = useSafeAreaInsets();
  const archetype = deriveArchetype(answers);

  // Staggered entrance animations
  const emojiScale = useRef(new Animated.Value(0)).current;
  const emojiOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslate = useRef(new Animated.Value(24)).current;
  const btnOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      // 1. Emoji pops in
      Animated.parallel([
        Animated.spring(emojiScale, { toValue: 1, useNativeDriver: true, tension: 50, friction: 7 }),
        Animated.timing(emojiOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
      // 2. Text slides up after 300ms
      Animated.delay(300),
      Animated.parallel([
        Animated.timing(textOpacity, { toValue: 1, duration: 400, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
        Animated.timing(textTranslate, { toValue: 0, duration: 400, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
      ]),
      // 3. CTA fades in after 500ms
      Animated.delay(500),
      Animated.timing(btnOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={archetype.gradientColors}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={[styles.container, { paddingTop: top + 24, paddingBottom: bottom + 24 }]}
      >
        {/* Emoji reveal */}
        <Animated.Text
          style={[
            styles.emoji,
            { opacity: emojiOpacity, transform: [{ scale: emojiScale }] },
          ]}
        >
          {archetype.emoji}
        </Animated.Text>

        {/* Type label + copy */}
        <Animated.View
          style={[
            styles.textBlock,
            { opacity: textOpacity, transform: [{ translateY: textTranslate }] },
          ]}
        >
          <Text style={styles.typeLabel}>You're</Text>
          <Text style={styles.typeTitle}>{archetype.title}</Text>
          <Text style={styles.tagline}>{archetype.tagline}</Text>
          <View style={styles.divider} />
          <Text style={styles.description}>{archetype.description}</Text>
        </Animated.View>

        {/* CTA */}
        <Animated.View style={[styles.btnWrap, { opacity: btnOpacity }]}>
          <Pressable
            onPress={onContinue}
            style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.btnText}>See who matches your vibe →</Text>
          </Pressable>
          <Text style={styles.hint}>Based on your Vibe Check answers</Text>
        </Animated.View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  emoji: {
    fontSize: 80,
    marginBottom: 24,
  },
  textBlock: {
    alignItems: "center",
    marginBottom: 40,
  },
  typeLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 18,
    fontWeight: "500",
    marginBottom: 4,
  },
  typeTitle: {
    color: "#fff",
    fontSize: 38,
    fontWeight: "800",
    letterSpacing: -0.5,
    textAlign: "center",
    marginBottom: 10,
  },
  tagline: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 16,
    fontStyle: "italic",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  divider: {
    width: 48,
    height: 2,
    backgroundColor: "rgba(255,255,255,0.35)",
    borderRadius: 1,
    marginBottom: 20,
  },
  description: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  btnWrap: {
    width: "100%",
    alignItems: "center",
  },
  btn: {
    backgroundColor: "#fff",
    borderRadius: 28,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: "100%",
    alignItems: "center",
    marginBottom: 12,
  },
  btnText: {
    color: "#0D0D0D",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  hint: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
  },
});
