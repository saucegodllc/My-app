/**
 * VibeCheckQuiz
 * ──────────────
 * 5-question personality micro-quiz surfaced on the profile / onboarding flow.
 * Results are stored on the user's Firestore doc and displayed on their swipe card.
 *
 * VibeCheckResult shows as a compact summary on cards.
 * VibeCheckCompatibility shows a match % breakdown post-swipe.
 *
 * Questions cover: love language, energy type, conflict style, date pace, adventure level.
 * Score is calculated as Euclidean closeness (0–100).
 *
 * Firestore path: users/{userId}.vibeCheck: VibeCheckAnswers
 */
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Analytics } from "@/lib/analytics";
import { useColors } from "@/hooks/useColors";

// ─── Types ───────────────────────────────────────────────────────────────────

export type VibeCheckAnswers = {
  loveLanguage: "words" | "touch" | "acts" | "gifts" | "time";
  energyType: "homebody" | "adventurer" | "balanced";
  conflictStyle: "talk-it-out" | "need-space" | "quick-fix";
  datePace: "slow-burn" | "medium" | "fast-sparks";
  adventureLevel: 1 | 2 | 3 | 4 | 5;
};

export type VibeCheckResult = {
  answers: VibeCheckAnswers;
  completedAt: string;
};

// ─── Questions ───────────────────────────────────────────────────────────────

type QuizQuestion = {
  id: keyof VibeCheckAnswers;
  question: string;
  icon: string;
  options: Array<{ value: string; label: string; emoji: string }>;
};

const QUESTIONS: QuizQuestion[] = [
  {
    id: "loveLanguage",
    question: "Your love language is…",
    icon: "💛",
    options: [
      { value: "words", label: "Words of affirmation", emoji: "💬" },
      { value: "touch", label: "Physical touch", emoji: "🤗" },
      { value: "acts", label: "Acts of service", emoji: "🛠️" },
      { value: "gifts", label: "Gift giving", emoji: "🎁" },
      { value: "time", label: "Quality time", emoji: "⏱️" },
    ],
  },
  {
    id: "energyType",
    question: "Your weekend energy is…",
    icon: "⚡",
    options: [
      { value: "homebody", label: "Cozy homebody", emoji: "🛋️" },
      { value: "adventurer", label: "Always out", emoji: "🌎" },
      { value: "balanced", label: "Depends on mood", emoji: "☯️" },
    ],
  },
  {
    id: "conflictStyle",
    question: "When something bothers you…",
    icon: "🧩",
    options: [
      { value: "talk-it-out", label: "I address it right away", emoji: "🗣️" },
      { value: "need-space", label: "I need space first", emoji: "🚶" },
      { value: "quick-fix", label: "I want it resolved fast", emoji: "⚡" },
    ],
  },
  {
    id: "datePace",
    question: "Your ideal dating pace…",
    icon: "🕐",
    options: [
      { value: "slow-burn", label: "Slow burn — take our time", emoji: "🕯️" },
      { value: "medium", label: "Natural pace, see where it goes", emoji: "🌊" },
      { value: "fast-sparks", label: "Fast sparks — I'll know quickly", emoji: "⚡" },
    ],
  },
  {
    id: "adventureLevel",
    question: "How adventurous are you? (1–5)",
    icon: "🧭",
    options: [
      { value: "1", label: "Comfort-seeking", emoji: "🏡" },
      { value: "2", label: "Mostly safe", emoji: "🛤️" },
      { value: "3", label: "Open to new things", emoji: "🌱" },
      { value: "4", label: "Thrill-curious", emoji: "🎢" },
      { value: "5", label: "Full adventurer", emoji: "🪂" },
    ],
  },
];

// ─── Compatibility score ─────────────────────────────────────────────────────

export function computeCompatibility(a: VibeCheckAnswers, b: VibeCheckAnswers): number {
  const loveMap: Record<string, number> = { words: 1, touch: 2, acts: 3, gifts: 4, time: 5 };
  const energyMap: Record<string, number> = { homebody: 1, balanced: 2, adventurer: 3 };
  const conflictMap: Record<string, number> = { "talk-it-out": 1, "need-space": 2, "quick-fix": 3 };
  const paceMap: Record<string, number> = { "slow-burn": 1, medium: 2, "fast-sparks": 3 };

  const dist = Math.sqrt(
    Math.pow(loveMap[a.loveLanguage] - loveMap[b.loveLanguage], 2) +
    Math.pow(energyMap[a.energyType] - energyMap[b.energyType], 2) +
    Math.pow(conflictMap[a.conflictStyle] - conflictMap[b.conflictStyle], 2) +
    Math.pow(paceMap[a.datePace] - paceMap[b.datePace], 2) +
    Math.pow(a.adventureLevel - b.adventureLevel, 2),
  );
  // Max distance possible ≈ sqrt(4^2+2^2+2^2+2^2+4^2) ≈ 7.0
  const MAX_DIST = 7.0;
  const score = Math.round((1 - Math.min(dist / MAX_DIST, 1)) * 100);
  return score;
}

// ─── Firestore save ──────────────────────────────────────────────────────────

export async function saveVibeCheck(userId: string, answers: VibeCheckAnswers): Promise<void> {
  try {
    const { getFirestore, doc, updateDoc } = await import("firebase/firestore");
    const { getApp } = await import("firebase/app");
    const db = getFirestore(getApp());
    await updateDoc(doc(db, "users", userId), {
      vibeCheck: { answers, completedAt: new Date().toISOString() },
    });
  } catch {
    // Non-critical
  }
}

// ─── VibeCheckResult display (on card / profile) ─────────────────────────────

const LOVE_LABELS: Record<string, string> = {
  words: "Words ✨",
  touch: "Touch 🤗",
  acts: "Acts 🛠️",
  gifts: "Gifts 🎁",
  time: "Time ⏱️",
};
const ENERGY_LABELS: Record<string, string> = {
  homebody: "Homebody 🛋️",
  adventurer: "Adventurer 🌎",
  balanced: "Balanced ☯️",
};
const PACE_LABELS: Record<string, string> = {
  "slow-burn": "Slow burn 🕯️",
  medium: "Natural pace 🌊",
  "fast-sparks": "Fast sparks ⚡",
};

export function VibeCheckCardBadge({ answers }: { answers: VibeCheckAnswers }) {
  const colors = useColors();
  return (
    <View style={[styles.cardBadge, { backgroundColor: colors.card + "CC", borderColor: colors.border }]}>
      <Text style={[styles.cardBadgeTitle, { color: colors.mutedForeground }]}>VIBE CHECK</Text>
      <View style={styles.cardBadgeRow}>
        <View style={[styles.pill, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "40" }]}>
          <Text style={[styles.pillText, { color: colors.primary }]}>{LOVE_LABELS[answers.loveLanguage]}</Text>
        </View>
        <View style={[styles.pill, { backgroundColor: "#3B82F620", borderColor: "#3B82F640" }]}>
          <Text style={[styles.pillText, { color: "#3B82F6" }]}>{ENERGY_LABELS[answers.energyType]}</Text>
        </View>
        <View style={[styles.pill, { backgroundColor: "#22C55E20", borderColor: "#22C55E40" }]}>
          <Text style={[styles.pillText, { color: "#22C55E" }]}>{PACE_LABELS[answers.datePace]}</Text>
        </View>
      </View>
    </View>
  );
}

export function VibeCompatibilityBanner({
  myAnswers,
  theirAnswers,
  theirName,
}: {
  myAnswers: VibeCheckAnswers;
  theirAnswers: VibeCheckAnswers;
  theirName: string;
}) {
  const score = computeCompatibility(myAnswers, theirAnswers);
  const color = score >= 80 ? "#22C55E" : score >= 60 ? "#FBBF24" : "#F87171";
  return (
    <View style={[styles.compatBanner, { borderColor: color + "40", backgroundColor: color + "10" }]}>
      <Text style={[styles.compatScore, { color }]}>{score}%</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.compatTitle, { color }]}>Vibe match with {theirName}</Text>
        <Text style={styles.compatSub}>Based on love language, energy, conflict style & pace</Text>
      </View>
    </View>
  );
}

// ─── Quiz Modal ───────────────────────────────────────────────────────────────

interface VibeCheckQuizProps {
  userId: string;
  onComplete: (answers: VibeCheckAnswers) => void;
  onSkip?: () => void;
}

export default function VibeCheckQuiz({ userId, onComplete, onSkip }: VibeCheckQuizProps) {
  const colors = useColors();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<VibeCheckAnswers>>({});
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  const question = QUESTIONS[step];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 1, duration: 280, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
      Animated.spring(scaleAnim, { toValue: 1, damping: 18, stiffness: 200, useNativeDriver: true }),
    ]).start();
    return () => {
      slideAnim.setValue(0);
      scaleAnim.setValue(0.92);
    };
  }, [step]);

  const handleAnswer = async (value: string) => {
    void Haptics.selectionAsync();
    const updated = { ...answers, [question.id]: value };
    setAnswers(updated);

    if (step < QUESTIONS.length - 1) {
      setStep((s) => s + 1);
    } else {
      const final = updated as VibeCheckAnswers;
      await saveVibeCheck(userId, final);
      Analytics.vibeCheckCompleted(0);
      onComplete(final);
    }
  };

  const progress = (step / QUESTIONS.length) * 100;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Progress bar */}
      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              backgroundColor: colors.primary,
              width: `${progress}%`,
            },
          ]}
        />
      </View>

      <Text style={[styles.stepLabel, { color: colors.mutedForeground }]}>
        {step + 1} of {QUESTIONS.length}
      </Text>

      <Animated.View
        style={{
          opacity: slideAnim,
          transform: [
            { scale: scaleAnim },
            { translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
          ],
        }}
      >
        <Text style={styles.questionEmoji}>{question.icon}</Text>
        <Text style={[styles.questionText, { color: colors.foreground }]}>{question.question}</Text>
      </Animated.View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 20 }} contentContainerStyle={{ gap: 10 }}>
        {question.options.map((opt) => (
          <Pressable
            key={opt.value}
            onPress={() => handleAnswer(opt.value)}
            style={({ pressed }) => [
              styles.optionCard,
              {
                backgroundColor: pressed ? colors.primary + "18" : colors.card,
                borderColor: pressed ? colors.primary : colors.border,
                opacity: pressed ? 0.88 : 1,
              },
            ]}
          >
            <Text style={styles.optionEmoji}>{opt.emoji}</Text>
            <Text style={[styles.optionLabel, { color: colors.foreground }]}>{opt.label}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </Pressable>
        ))}
      </ScrollView>

      {onSkip && (
        <Pressable onPress={onSkip} style={styles.skipBtn}>
          <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip for now</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  progressTrack: { height: 4, borderRadius: 2, marginBottom: 12, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 2 },
  stepLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 24 },
  questionEmoji: { fontSize: 36, marginBottom: 10, textAlign: "center" },
  questionText: { fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center", lineHeight: 30, marginBottom: 4 },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  optionEmoji: { fontSize: 22 },
  optionLabel: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium" },
  skipBtn: { alignItems: "center", marginTop: 16, paddingVertical: 12 },
  skipText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  // Card badge
  cardBadge: { borderRadius: 12, borderWidth: 1, padding: 10, gap: 6 },
  cardBadgeTitle: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 1, textTransform: "uppercase" },
  cardBadgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  pill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  // Compat banner
  compatBanner: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, borderWidth: 1, padding: 14 },
  compatScore: { fontSize: 26, fontFamily: "Inter_700Bold" },
  compatTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  compatSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#999", marginTop: 2 },
});
