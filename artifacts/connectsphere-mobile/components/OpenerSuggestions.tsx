/**
 * OpenerSuggestions
 * ──────────────────
 * Shows 3 AI-generated (or curated fallback) opener chips above the keyboard
 * on the first message of a new match. Tapping a chip auto-fills the text input.
 *
 * Backend: POST /api/opener-suggestions
 *   Body: { myName, theirName, theirBio, theirInterests, theirPrompt, theirPromptAnswer }
 *   Response: { openers: string[] }
 *
 * Falls back to curated openers when the API is unavailable or no key is set.
 *
 * Usage:
 *   <OpenerSuggestions
 *     visible={isFirstMessage && text === ""}
 *     myName="Ricky"
 *     theirName="Sofia"
 *     theirBio="..."
 *     theirInterests={["music", "hiking"]}
 *     theirPrompt="Two truths and a lie"
 *     theirPromptAnswer="I've skydived 3 times"
 *     onSelect={(opener) => setText(opener)}
 *   />
 */
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

// ─── Curated fallback openers ────────────────────────────────────────────────

const FALLBACK_OPENERS = [
  (name: string) => `Hey ${name}! What's been the highlight of your week so far?`,
  (name: string) => `Ok ${name}, hot take — best late night spot in Miami?`,
  (_: string) => `Be honest — are you actually interesting or just good at photos? 😄`,
  (name: string) => `${name}, I need your expert opinion on something important 👀`,
  (_: string) => `If we were at a party right now, what would you be doing?`,
  (_: string) => `Quick hypothetical: road trip or beach week?`,
];

function getRandomFallbacks(theirName: string): string[] {
  const shuffled = [...FALLBACK_OPENERS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3).map((fn) => fn(theirName));
}

// ─── API call ─────────────────────────────────────────────────────────────────

async function fetchOpenerSuggestions(params: {
  myName: string;
  theirName: string;
  theirBio?: string;
  theirInterests?: string[];
  theirPrompt?: string;
  theirPromptAnswer?: string;
}): Promise<string[]> {
  const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";
  if (!apiBase) return getRandomFallbacks(params.theirName);
  try {
    const resp = await fetch(`${apiBase}/api/opener-suggestions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return getRandomFallbacks(params.theirName);
    const data = (await resp.json()) as { openers?: string[] };
    if (Array.isArray(data.openers) && data.openers.length > 0) return data.openers.slice(0, 3);
    return getRandomFallbacks(params.theirName);
  } catch {
    return getRandomFallbacks(params.theirName);
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

interface OpenerSuggestionsProps {
  visible: boolean;
  myName: string;
  theirName: string;
  theirBio?: string;
  theirInterests?: string[];
  theirPrompt?: string;
  theirPromptAnswer?: string;
  onSelect: (opener: string) => void;
}

export default function OpenerSuggestions({
  visible,
  myName,
  theirName,
  theirBio,
  theirInterests,
  theirPrompt,
  theirPromptAnswer,
  onSelect,
}: OpenerSuggestionsProps) {
  const colors = useColors();
  const [openers, setOpeners] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const slideAnim = useRef(new Animated.Value(-60)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!visible) return;
    // Only fetch once per mount
    if (loadedRef.current) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 70, friction: 12 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      return;
    }
    loadedRef.current = true;
    setLoading(true);
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 70, friction: 12 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    void fetchOpenerSuggestions({ myName, theirName, theirBio, theirInterests, theirPrompt, theirPromptAnswer })
      .then(setOpeners)
      .finally(() => setLoading(false));
  }, [visible, myName, theirName, theirBio, theirInterests, theirPrompt, theirPromptAnswer, slideAnim, opacityAnim]);

  useEffect(() => {
    if (!visible) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -60, duration: 180, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, slideAnim, opacityAnim]);

  if (!visible && openers.length === 0) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { borderTopColor: colors.border, backgroundColor: colors.background },
        { transform: [{ translateY: slideAnim }], opacity: opacityAnim },
      ]}
    >
      <Text style={[styles.label, { color: colors.mutedForeground }]}>
        ✨ Try one of these
      </Text>
      {loading ? (
        <View style={styles.loadingRow}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={[styles.skeletonChip, { backgroundColor: colors.muted }]} />
          ))}
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {openers.map((opener, i) => (
            <Pressable
              key={i}
              onPress={() => {
                void Haptics.selectionAsync();
                onSelect(opener);
              }}
              style={({ pressed }) => [
                styles.chip,
                { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Text style={[styles.chipText, { color: colors.foreground }]} numberOfLines={2}>
                {opener}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    paddingBottom: 4,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    marginLeft: 12,
    marginBottom: 6,
  },
  chips: { paddingHorizontal: 12, gap: 8 },
  chip: {
    maxWidth: 220,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 17 },
  loadingRow: { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingBottom: 6 },
  skeletonChip: { width: 160, height: 38, borderRadius: 20, opacity: 0.4 },
});
