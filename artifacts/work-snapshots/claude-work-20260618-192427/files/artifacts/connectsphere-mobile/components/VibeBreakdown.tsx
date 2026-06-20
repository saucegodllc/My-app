/**
 * VibeBreakdown
 * ─────────────
 * Per-dimension compatibility display shown on:
 *   • SwipeCard (compact pill row)
 *   • DatingMatchModal (full animated reveal)
 *   • Chat header (mini strip)
 *
 * Each dimension is scored independently so users understand WHY
 * they match — not just a single opaque number.
 */
import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { VibeCheckAnswers } from "./VibeCheckQuiz";

// ─── Dimension scoring ────────────────────────────────────────────────────────

type DimensionScore = {
  key: string;
  label: string;
  emoji: string;
  score: number; // 0–100
  detail: string; // e.g. "Words of affirmation · Quality time"
};

const LOVE_MAP: Record<string, number> = { words: 1, touch: 2, acts: 3, gifts: 4, time: 5 };
const ENERGY_MAP: Record<string, number> = { homebody: 1, balanced: 2, adventurer: 3 };
const CONFLICT_MAP: Record<string, number> = { "talk-it-out": 1, "need-space": 2, "quick-fix": 3 };
const PACE_MAP: Record<string, number> = { "slow-burn": 1, medium: 2, "fast-sparks": 3 };

const LOVE_LABELS: Record<string, string> = {
  words: "Words ✨", touch: "Touch 🤗", acts: "Acts 🛠️", gifts: "Gifts 🎁", time: "Time ⏱️",
};
const ENERGY_LABELS: Record<string, string> = {
  homebody: "Homebody 🛋️", adventurer: "Adventurer 🌎", balanced: "Balanced ☯️",
};
const CONFLICT_LABELS: Record<string, string> = {
  "talk-it-out": "Talk it out 🗣️", "need-space": "Need space 🚶", "quick-fix": "Quick fix ⚡",
};
const PACE_LABELS: Record<string, string> = {
  "slow-burn": "Slow burn 🕯️", medium: "Natural pace 🌊", "fast-sparks": "Fast sparks ⚡",
};

function dimScore(a: number, b: number, maxDist: number): number {
  return Math.round((1 - Math.abs(a - b) / maxDist) * 100);
}

export function computeVibeBreakdown(
  mine: VibeCheckAnswers,
  theirs: VibeCheckAnswers,
): DimensionScore[] {
  return [
    {
      key: "love",
      label: "Love Language",
      emoji: "💛",
      score: dimScore(LOVE_MAP[mine.loveLanguage], LOVE_MAP[theirs.loveLanguage], 4),
      detail: `${LOVE_LABELS[mine.loveLanguage]} · ${LOVE_LABELS[theirs.loveLanguage]}`,
    },
    {
      key: "energy",
      label: "Weekend Energy",
      emoji: "⚡",
      score: dimScore(ENERGY_MAP[mine.energyType], ENERGY_MAP[theirs.energyType], 2),
      detail: `${ENERGY_LABELS[mine.energyType]} · ${ENERGY_LABELS[theirs.energyType]}`,
    },
    {
      key: "conflict",
      label: "Conflict Style",
      emoji: "🧩",
      score: dimScore(CONFLICT_MAP[mine.conflictStyle], CONFLICT_MAP[theirs.conflictStyle], 2),
      detail: `${CONFLICT_LABELS[mine.conflictStyle]} · ${CONFLICT_LABELS[theirs.conflictStyle]}`,
    },
    {
      key: "pace",
      label: "Dating Pace",
      emoji: "🕐",
      score: dimScore(PACE_MAP[mine.datePace], PACE_MAP[theirs.datePace], 2),
      detail: `${PACE_LABELS[mine.datePace]} · ${PACE_LABELS[theirs.datePace]}`,
    },
    {
      key: "adventure",
      label: "Adventure Level",
      emoji: "🧭",
      score: dimScore(mine.adventureLevel, theirs.adventureLevel, 4),
      detail: `You: ${mine.adventureLevel}/5 · Them: ${theirs.adventureLevel}/5`,
    },
  ];
}

// ─── Animated bar ─────────────────────────────────────────────────────────────

function AnimatedBar({
  score,
  delay,
  color,
}: {
  score: number;
  delay: number;
  color: string;
}) {
  const width = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(width, {
      toValue: score,
      duration: 520,
      delay,
      useNativeDriver: false,
    }).start();
  }, [score, delay]);

  const barColor =
    score >= 80 ? "#22C55E" : score >= 60 ? "#FBBF24" : "#F87171";

  return (
    <View style={styles.barBg}>
      <Animated.View
        style={[
          styles.barFill,
          {
            backgroundColor: color || barColor,
            width: width.interpolate({
              inputRange: [0, 100],
              outputRange: ["0%", "100%"],
              extrapolate: "clamp",
            }),
          },
        ]}
      />
    </View>
  );
}

// ─── Full breakdown (match modal / profile) ───────────────────────────────────

type FullProps = {
  mine: VibeCheckAnswers;
  theirs: VibeCheckAnswers;
  theirName: string;
  /** Animate bars in on mount (true for modal, false for static views) */
  animate?: boolean;
};

export function VibeBreakdownFull({ mine, theirs, theirName, animate = true }: FullProps) {
  const dims = computeVibeBreakdown(mine, theirs);
  const overall = Math.round(dims.reduce((s, d) => s + d.score, 0) / dims.length);
  const overallColor = overall >= 80 ? "#22C55E" : overall >= 60 ? "#FBBF24" : "#F87171";
  const containerOpacity = useRef(new Animated.Value(animate ? 0 : 1)).current;

  useEffect(() => {
    if (animate) {
      Animated.timing(containerOpacity, {
        toValue: 1,
        duration: 300,
        delay: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [animate]);

  return (
    <Animated.View style={[styles.fullWrap, { opacity: containerOpacity }]}>
      {/* Overall score headline */}
      <View style={styles.overallRow}>
        <Text style={styles.overallLabel}>Vibe Match with {theirName}</Text>
        <Text style={[styles.overallScore, { color: overallColor }]}>{overall}%</Text>
      </View>

      {/* Dimension bars */}
      {dims.map((dim, i) => (
        <View key={dim.key} style={styles.dimRow}>
          <View style={styles.dimHeader}>
            <Text style={styles.dimEmoji}>{dim.emoji}</Text>
            <Text style={styles.dimLabel}>{dim.label}</Text>
            <Text style={[
              styles.dimScore,
              { color: dim.score >= 80 ? "#22C55E" : dim.score >= 60 ? "#FBBF24" : "#F87171" }
            ]}>
              {dim.score}%
            </Text>
          </View>
          <AnimatedBar
            score={dim.score}
            delay={animate ? 300 + i * 80 : 0}
            color={dim.score >= 80 ? "#22C55E" : dim.score >= 60 ? "#FBBF24" : "#F87171"}
          />
          <Text style={styles.dimDetail}>{dim.detail}</Text>
        </View>
      ))}
    </Animated.View>
  );
}

// ─── Compact strip (SwipeCard overlay) ───────────────────────────────────────

type CompactProps = {
  mine: VibeCheckAnswers;
  theirs: VibeCheckAnswers;
  /** Overall score (pass-through from computeCompatibility to avoid double compute) */
  overall: number;
  onExpand?: () => void;
};

export function VibeBreakdownCompact({ mine, theirs, overall, onExpand }: CompactProps) {
  const dims = computeVibeBreakdown(mine, theirs);
  const top3 = [...dims].sort((a, b) => b.score - a.score).slice(0, 3);
  const overallColor = overall >= 80 ? "#22C55E" : overall >= 60 ? "#FBBF24" : "#F87171";

  return (
    <Pressable onPress={onExpand} style={styles.compactWrap}>
      <LinearGradient
        colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.72)"]}
        style={StyleSheet.absoluteFill}
      />
      {/* Score pill */}
      <View style={[styles.scorePill, { borderColor: overallColor + "80" }]}>
        <Text style={[styles.scorePillText, { color: overallColor }]}>
          {overall}% vibe match
        </Text>
      </View>
      {/* Top 3 dimension pills */}
      <View style={styles.pillRow}>
        {top3.map((dim) => (
          <View key={dim.key} style={styles.miniPill}>
            <Text style={styles.miniPillText}>
              {dim.emoji} {dim.score}%
            </Text>
          </View>
        ))}
        {onExpand && (
          <View style={styles.miniPill}>
            <Text style={styles.miniPillText}>↑ Why</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ─── Mini strip (chat header) ─────────────────────────────────────────────────

export function VibeBreakdownMini({
  mine,
  theirs,
  overall,
}: {
  mine: VibeCheckAnswers;
  theirs: VibeCheckAnswers;
  overall: number;
}) {
  const dims = computeVibeBreakdown(mine, theirs);
  const best = dims.reduce((a, b) => (a.score > b.score ? a : b));
  const overallColor = overall >= 80 ? "#22C55E" : overall >= 60 ? "#FBBF24" : "#F87171";

  return (
    <View style={styles.miniWrap}>
      <Text style={[styles.miniScore, { color: overallColor }]}>{overall}% vibe</Text>
      <Text style={styles.miniSep}>·</Text>
      <Text style={styles.miniBest}>{best.emoji} {best.label} {best.score}%</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Full
  fullWrap: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 14,
  },
  overallRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  overallLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.85)",
  },
  overallScore: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  dimRow: {
    gap: 4,
  },
  dimHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dimEmoji: {
    fontSize: 14,
  },
  dimLabel: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.65)",
  },
  dimScore: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  barBg: {
    height: 5,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: {
    height: 5,
    borderRadius: 3,
  },
  dimDetail: {
    fontSize: 10,
    color: "rgba(255,255,255,0.35)",
    fontFamily: "Inter_400Regular",
  },

  // Compact (SwipeCard overlay)
  compactWrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 32,
    gap: 8,
  },
  scorePill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  scorePillText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
  },
  miniPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  miniPillText: {
    fontSize: 10,
    color: "rgba(255,255,255,0.8)",
    fontFamily: "Inter_500Medium",
  },

  // Mini (chat header)
  miniWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  miniScore: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  miniSep: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 11,
  },
  miniBest: {
    fontSize: 11,
    color: "rgba(255,255,255,0.55)",
    fontFamily: "Inter_400Regular",
  },
});
