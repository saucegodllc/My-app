/**
 * DeckExhaustedState
 * ------------------
 * Shown when the swipe deck runs out of profiles.
 *
 * Behaviour:
 *  - Counts down to the next daily restock (midnight ET)
 *  - "Expand radius" CTA bumps the radius pref and calls onExpandRadius()
 *  - "View matches" shortcut jumps straight to the Connect tab
 *  - Ambient particle pulse keeps the screen alive
 */
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

// ─── helpers ────────────────────────────────────────────────────────────────

function msUntilMidnightET(): number {
  const now = new Date();
  // Offset for US Eastern (UTC-5 / UTC-4 DST)
  const etOffset = now.toLocaleString("en-US", { timeZone: "America/New_York", hour12: false }).includes("24") ? -4 : -5;
  const etNow = new Date(now.getTime() + etOffset * 3600000);
  const midnight = new Date(etNow);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - etNow.getTime();
}

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Particle ───────────────────────────────────────────────────────────────

function Particle({ delay, x, y, color }: { delay: number; x: number; y: number; color: string }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0.45, duration: 1800, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
          Animated.spring(scale, { toValue: 1, damping: 14, stiffness: 80, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 2200, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.4, duration: 2200, useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [delay, opacity, scale]);

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: color,
        opacity,
        transform: [{ scale }],
      }}
    />
  );
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface DeckExhaustedStateProps {
  intent: "dating" | "friends";
  profilesSeen: number;
  onExpandRadius?: () => void;
  onRefresh?: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function DeckExhaustedState({
  intent,
  profilesSeen,
  onExpandRadius,
  onRefresh,
}: DeckExhaustedStateProps) {
  const colors = useColors();
  const [countdown, setCountdown] = useState(() => formatCountdown(msUntilMidnightET()));

  // Countdown tick
  useEffect(() => {
    const id = setInterval(() => {
      setCountdown(formatCountdown(msUntilMidnightET()));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Heart pulse animation
  const heartScale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.spring(heartScale, { toValue: 1.14, damping: 8, stiffness: 160, useNativeDriver: true }),
        Animated.spring(heartScale, { toValue: 1, damping: 10, stiffness: 120, useNativeDriver: true }),
        Animated.delay(1800),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [heartScale]);

  const isDating = intent === "dating";
  const accentColor = isDating ? colors.primary : "#3B82F6";
  const accentAlt = isDating ? colors.accent : "#6366F1";

  const particles: Array<{ delay: number; x: number; y: number }> = [
    { delay: 0, x: 28, y: 72 },
    { delay: 600, x: 276, y: 56 },
    { delay: 300, x: 236, y: 288 },
    { delay: 900, x: 48, y: 304 },
    { delay: 450, x: 168, y: 32 },
    { delay: 1200, x: 310, y: 184 },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Ambient particles */}
      {particles.map((p, i) => (
        <Particle key={i} delay={p.delay} x={p.x} y={p.y} color={accentColor} />
      ))}

      {/* Glow halo */}
      <View style={[styles.halo, { backgroundColor: accentColor + "16" }]} />

      {/* Icon */}
      <Animated.View style={[styles.iconWrap, { transform: [{ scale: heartScale }] }]}>
        <LinearGradient colors={[accentColor, accentAlt]} style={styles.iconGradient}>
          <Ionicons
            name={isDating ? "heart" : "people"}
            size={44}
            color="#fff"
          />
        </LinearGradient>
      </Animated.View>

      {/* Headline */}
      <Text style={[styles.headline, { color: colors.foreground }]}>You&apos;re all caught up</Text>
      <Text style={[styles.sub, { color: colors.mutedForeground }]}>
        {isDating
          ? `You've seen everyone nearby in ${intent} mode.`
          : "You've browsed everyone in your area."}
        {"\n"}New profiles restock at midnight.
      </Text>

      {/* Stats pill */}
      <View style={[styles.statsPill, { backgroundColor: accentColor + "14", borderColor: accentColor + "30" }]}>
        <Ionicons name="people-circle" size={14} color={accentColor} />
        <Text style={[styles.statsText, { color: accentColor }]}>
          {profilesSeen} {isDating ? "dates" : "people"} explored today
        </Text>
      </View>

      {/* Countdown */}
      <View style={styles.countdownWrap}>
        <Text style={[styles.countdownLabel, { color: colors.mutedForeground }]}>Next restock in</Text>
        <Text style={[styles.countdownValue, { color: colors.foreground }]}>{countdown}</Text>
      </View>

      {/* CTAs */}
      <View style={styles.actions}>
        {onExpandRadius && (
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onExpandRadius();
            }}
            style={({ pressed }) => [
              styles.primaryCta,
              { opacity: pressed ? 0.82 : 1 },
            ]}
          >
            <LinearGradient colors={[accentColor, accentAlt]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryGrad}>
              <Ionicons name="location" size={18} color="#fff" />
              <Text style={styles.primaryCtaText}>Expand my radius</Text>
            </LinearGradient>
          </Pressable>
        )}

        {onRefresh && (
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onRefresh();
            }}
            style={({ pressed }) => [
              styles.secondaryCta,
              { borderColor: accentColor + "40", opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <Ionicons name="refresh" size={16} color={accentColor} />
            <Text style={[styles.secondaryCtaText, { color: accentColor }]}>Refresh deck</Text>
          </Pressable>
        )}

        <Pressable
          onPress={() => {
            void Haptics.selectionAsync();
            router.push("/(tabs)/matches");
          }}
          style={({ pressed }) => [styles.ghostCta, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="chatbubbles-outline" size={16} color={colors.mutedForeground} />
          <Text style={[styles.ghostCtaText, { color: colors.mutedForeground }]}>View my matches</Text>
        </Pressable>
        <View style={styles.quickActionRow}>
          <Pressable
            onPress={() => {
              void Haptics.selectionAsync();
              router.push("/(tabs)/moments");
            }}
            style={({ pressed }) => [styles.quickAction, { borderColor: accentColor + "30", opacity: pressed ? 0.75 : 1 }]}
          >
            <Ionicons name="sparkles-outline" size={15} color={accentColor} />
            <Text style={[styles.quickActionText, { color: accentColor }]}>Post a Moment</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              void Haptics.selectionAsync();
              router.push("/(tabs)/events");
            }}
            style={({ pressed }) => [styles.quickAction, { borderColor: accentColor + "30", opacity: pressed ? 0.75 : 1 }]}
          >
            <Ionicons name="calendar-outline" size={15} color={accentColor} />
            <Text style={[styles.quickActionText, { color: accentColor }]}>Find a plan</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 40,
    gap: 0,
    overflow: "hidden",
  },
  halo: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    top: "22%",
  },
  iconWrap: { marginBottom: 20 },
  iconGradient: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  headline: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  sub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 18,
  },
  statsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginBottom: 24,
  },
  statsText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  countdownWrap: { alignItems: "center", marginBottom: 32, gap: 4 },
  countdownLabel: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.8 },
  countdownValue: { fontSize: 30, fontFamily: "Inter_700Bold", letterSpacing: 2 },
  actions: { width: "100%", gap: 10 },
  primaryCta: { borderRadius: 16, overflow: "hidden" },
  primaryGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 16,
  },
  primaryCtaText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  secondaryCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
  },
  secondaryCtaText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  ghostCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
  },
  ghostCtaText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  quickActionRow: { flexDirection: "row", gap: 8 },
  quickAction: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
  },
  quickActionText: { fontSize: 12, fontFamily: "Inter_700Bold", textAlign: "center" },
});
