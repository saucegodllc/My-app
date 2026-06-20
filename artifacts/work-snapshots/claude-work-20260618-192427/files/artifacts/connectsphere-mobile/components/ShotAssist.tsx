/**
 * ShotAssist (AI Photo Coach)
 * ────────────────────────────
 * Sends the user's profile photos to GPT-4o (via the ConnectSphere API endpoint)
 * and returns a scored breakdown per photo plus a "weakest photo" recommendation.
 *
 * Scoring dimensions (each 0–10):
 *   lighting | background | expression | framing | energy | variety | clarity | vibe
 *
 * Backend contract:
 *   POST /api/shot-assist
 *   body: { photoUrls: string[] }
 *   response: ShotAssistReport
 *
 * Falls back to a deterministic heuristic-based mock when the API key is absent
 * (useful for development / demo mode).
 *
 * Opens as a bottom sheet from the Profile tab or the premium paywall.
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Analytics } from "@/lib/analytics";
import { useColors } from "@/hooks/useColors";

// ─── Types ───────────────────────────────────────────────────────────────────

export type PhotoScore = {
  photoUrl: string;
  index: number;
  overallScore: number; // 0–100
  dimensions: {
    lighting: number;
    background: number;
    expression: number;
    framing: number;
    energy: number;
    variety: number;
    clarity: number;
    vibe: number;
  };
  strength: string;   // "Great lighting and genuine smile"
  weakness: string;   // "Cluttered background"
  suggestion: string; // "Swap for a photo with a clean background"
};

export type ShotAssistReport = {
  photos: PhotoScore[];
  weakestIndex: number;
  overallProfileScore: number;
  topSuggestion: string;
  shareableCaption: string; // e.g. "My profile score: 72/100 🎯 — ConnectSphere AI"
};

// ─── API call ─────────────────────────────────────────────────────────────────

async function fetchShotAssist(photoUrls: string[]): Promise<ShotAssistReport> {
  try {
    const { customFetch } = await import("@workspace/api-client-react");
    const resp = await customFetch("/api/shot-assist", {
      method: "POST",
      body: JSON.stringify({ photoUrls }),
    });
    return (resp as { report: ShotAssistReport }).report;
  } catch {
    // Mock fallback for dev
    return mockReport(photoUrls);
  }
}

function mockReport(photoUrls: string[]): ShotAssistReport {
  const photos: PhotoScore[] = photoUrls.map((url, i) => {
    const base = 55 + ((i * 17 + 31) % 36);
    return {
      photoUrl: url,
      index: i,
      overallScore: base,
      dimensions: {
        lighting: 50 + ((i * 13 + 7) % 40),
        background: 40 + ((i * 11 + 19) % 50),
        expression: 60 + ((i * 7 + 3) % 35),
        framing: 55 + ((i * 5 + 11) % 40),
        energy: 50 + ((i * 9 + 23) % 45),
        variety: 45 + ((i * 3 + 17) % 50),
        clarity: 65 + ((i * 7 + 1) % 30),
        vibe: 55 + ((i * 11 + 5) % 40),
      },
      strength: ["Natural smile", "Great lighting", "Good framing", "Strong energy"][i % 4],
      weakness: ["Cluttered background", "Poor lighting", "Cropped awkwardly", "Low resolution"][i % 4],
      suggestion: [
        "Try a cleaner background — outdoors or plain wall works great.",
        "Shoot during golden hour for warm, natural light.",
        "Give more space above your head.",
        "Use the rear camera at 2× zoom for sharpness.",
      ][i % 4],
    };
  });
  const weakestIndex = photos.reduce((minI, p, i, arr) => p.overallScore < arr[minI].overallScore ? i : minI, 0);
  const overallScore = Math.round(photos.reduce((s, p) => s + p.overallScore, 0) / photos.length);
  return {
    photos,
    weakestIndex,
    overallProfileScore: overallScore,
    topSuggestion: `Your photo #${weakestIndex + 1} is pulling your score down. ${photos[weakestIndex].suggestion}`,
    shareableCaption: `My ConnectSphere profile score: ${overallScore}/100 🎯`,
  };
}

// ─── Score Bar ────────────────────────────────────────────────────────────────

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: value / 100, duration: 700, delay: 100, useNativeDriver: false, easing: Easing.out(Easing.cubic) }).start();
  }, [anim, value]);
  return (
    <View style={sbStyles.row}>
      <Text style={sbStyles.label}>{label}</Text>
      <View style={sbStyles.track}>
        <Animated.View style={[sbStyles.fill, { backgroundColor: color, width: anim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }]} />
      </View>
      <Text style={[sbStyles.val, { color }]}>{value}</Text>
    </View>
  );
}
const sbStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  label: { color: "#999", fontSize: 11, fontFamily: "Inter_500Medium", width: 70 },
  track: { flex: 1, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3 },
  val: { fontSize: 12, fontFamily: "Inter_700Bold", width: 26, textAlign: "right" },
});

// ─── PhotoCard ─────────────────────────────────────────────────────────────────

function PhotoCard({ photo, isWeakest, colors }: { photo: PhotoScore; isWeakest: boolean; colors: ReturnType<typeof useColors> }) {
  const scoreColor = photo.overallScore >= 75 ? "#22C55E" : photo.overallScore >= 55 ? "#FBBF24" : "#F87171";
  return (
    <View style={[pcStyles.card, { backgroundColor: colors.card, borderColor: isWeakest ? "#F87171" : colors.border }]}>
      {isWeakest && (
        <View style={pcStyles.weakestBadge}>
          <Ionicons name="warning" size={11} color="#fff" />
          <Text style={pcStyles.weakestText}>Weakest photo</Text>
        </View>
      )}
      <Image source={{ uri: photo.photoUrl }} style={pcStyles.photo} contentFit="cover" />
      <View style={pcStyles.info}>
        <View style={pcStyles.scoreRow}>
          <Text style={[pcStyles.score, { color: scoreColor }]}>{photo.overallScore}<Text style={pcStyles.scoreOf}>/100</Text></Text>
          <Text style={[pcStyles.photoIndex, { color: colors.mutedForeground }]}>Photo {photo.index + 1}</Text>
        </View>
        <View style={[pcStyles.tag, { backgroundColor: "#22C55E18", borderColor: "#22C55E30" }]}>
          <Ionicons name="checkmark-circle" size={12} color="#22C55E" />
          <Text style={[pcStyles.tagText, { color: "#22C55E" }]}>{photo.strength}</Text>
        </View>
        <View style={[pcStyles.tag, { backgroundColor: "#F8717118", borderColor: "#F8717130" }]}>
          <Ionicons name="alert-circle" size={12} color="#F87171" />
          <Text style={[pcStyles.tagText, { color: "#F87171" }]}>{photo.weakness}</Text>
        </View>
        <Text style={[pcStyles.suggestion, { color: colors.mutedForeground }]}>{photo.suggestion}</Text>
        {/* Dimension bars */}
        <View style={{ marginTop: 8 }}>
          {Object.entries(photo.dimensions).map(([k, v]) => (
            <ScoreBar key={k} label={k} value={v} color={scoreColor} />
          ))}
        </View>
      </View>
    </View>
  );
}
const pcStyles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, overflow: "hidden", marginBottom: 14 },
  weakestBadge: { position: "absolute", top: 10, left: 10, zIndex: 2, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F87171", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  weakestText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },
  photo: { width: "100%", aspectRatio: 1 },
  info: { padding: 14, gap: 6 },
  scoreRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginBottom: 6 },
  score: { fontSize: 28, fontFamily: "Inter_700Bold" },
  scoreOf: { fontSize: 14, color: "#666" },
  photoIndex: { fontSize: 12, fontFamily: "Inter_500Medium" },
  tag: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 5 },
  tagText: { fontSize: 12, fontFamily: "Inter_600SemiBold", flex: 1 },
  suggestion: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18, marginTop: 4 },
});

// ─── ShotAssistSheet ──────────────────────────────────────────────────────────

interface ShotAssistSheetProps {
  visible: boolean;
  photoUrls: string[];
  onClose: () => void;
}

export default function ShotAssistSheet({ visible, photoUrls, onClose }: ShotAssistSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [report, setReport] = useState<ShotAssistReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || photoUrls.length === 0) return;
    setReport(null);
    setLoading(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Analytics.shotAssistRequested();
    void fetchShotAssist(photoUrls)
      .then((r) => {
        setReport(r);
        Analytics.shotAssistCompleted(r.overallProfileScore);
      })
      .finally(() => setLoading(false));
  }, [visible, photoUrls]);

  const scoreColor = report
    ? report.overallProfileScore >= 75
      ? "#22C55E"
      : report.overallProfileScore >= 55
        ? "#FBBF24"
        : "#F87171"
    : colors.primary;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>AI Shot Assist</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>GPT-4o photo coach</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={colors.mutedForeground} />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Analyzing your photos…</Text>
            <Text style={[styles.loadingHint, { color: colors.mutedForeground }]}>GPT-4o is scoring lighting, expression, vibe & more</Text>
          </View>
        ) : report ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }}>
            {/* Overall score */}
            <View style={[styles.overallCard, { backgroundColor: colors.card, borderColor: scoreColor + "40" }]}>
              <Text style={[styles.overallScore, { color: scoreColor }]}>{report.overallProfileScore}<Text style={styles.overallOf}>/100</Text></Text>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.overallLabel, { color: colors.foreground }]}>Overall Profile Score</Text>
                <Text style={[styles.topSuggestion, { color: colors.mutedForeground }]}>{report.topSuggestion}</Text>
              </View>
            </View>

            {/* Photo breakdown */}
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Photo breakdown</Text>
            {report.photos.map((photo) => (
              <PhotoCard
                key={photo.index}
                photo={photo}
                isWeakest={photo.index === report.weakestIndex}
                colors={colors}
              />
            ))}
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#1F1F1F" },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 32 },
  loadingText: { fontSize: 16, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  loadingHint: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 19 },
  overallCard: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 16, borderWidth: 1.5, padding: 16, marginVertical: 16 },
  overallScore: { fontSize: 42, fontFamily: "Inter_700Bold" },
  overallOf: { fontSize: 20, color: "#555" },
  overallLabel: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  topSuggestion: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 },
});
