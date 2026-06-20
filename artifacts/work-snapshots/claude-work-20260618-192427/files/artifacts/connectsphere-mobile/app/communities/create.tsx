/**
 * Create Community screen
 * Route: /communities/create
 * Opened from the [+] button in the Spaces tab.
 */
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { createCommunity } from "@/services/communitiesApi";

// Category → icon + colors
const CATEGORY_META: Record<string, { icon: string; accent: string; bg: string; border: string }> = {
  nightlife: { icon: "moon",          accent: "#A855F7", bg: "rgba(168,85,247,0.12)",  border: "rgba(168,85,247,0.30)" },
  food:      { icon: "restaurant",    accent: "#F97316", bg: "rgba(249,115,22,0.12)",  border: "rgba(249,115,22,0.30)" },
  fitness:   { icon: "fitness",       accent: "#22C55E", bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.30)"  },
  arts:      { icon: "color-palette", accent: "#F59E0B", bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.30)" },
  music:     { icon: "musical-notes", accent: "#10B981", bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.30)" },
  sports:    { icon: "football",      accent: "#3B82F6", bg: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.30)" },
  dating:    { icon: "flame",         accent: "#FF2DA8", bg: "rgba(255,45,168,0.12)",  border: "rgba(255,45,168,0.30)" },
  social:    { icon: "people",        accent: "#06B6D4", bg: "rgba(6,182,212,0.12)",   border: "rgba(6,182,212,0.30)"  },
  hobbies:   { icon: "sparkles",        accent: "#8B5CF6", bg: "rgba(139,92,246,0.12)", border: "rgba(139,92,246,0.30)" },
  other:     { icon: "sparkles",      accent: "#A855F7", bg: "rgba(168,85,247,0.12)",  border: "rgba(168,85,247,0.30)" },
};

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const PINK = "#FF2DA8";
const PURPLE = "#A855F7";
const BG = "#050008";
const CARD = "#0F0A1A";
const BORDER = "rgba(255,255,255,0.10)";
const MUTED = "rgba(255,255,255,0.5)";

const CATEGORY_OPTIONS = [
  { id: "nightlife",  label: "Nightlife 🌙" },
  { id: "food",       label: "Food & Drinks 🍜" },
  { id: "fitness",    label: "Fitness 💪" },
  { id: "arts",       label: "Arts & Culture 🎨" },
  { id: "music",      label: "Music 🎵" },
  { id: "sports",     label: "Sports ⚽" },
  { id: "dating",     label: "Dating 🔥" },
  { id: "social",     label: "Social 👥" },
  { id: "hobbies",    label: "Hobbies ✨" },
  { id: "other",      label: "Other ✨" },
];

export default function CreateCommunityScreen() {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canSubmit = name.trim().length >= 3 && category !== null && !saving;

  const handleCreate = async () => {
    if (!canSubmit) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);
    try {
      const meta = CATEGORY_META[category!] ?? CATEGORY_META.other;
      await createCommunity({
        name: name.trim(),
        description: description.trim(),
        slug: slugify(name.trim()),
        iconName: meta.icon,
        colorAccent: meta.accent,
        colorBg: meta.bg,
        colorBorder: meta.border,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Alert.alert("Couldn't create space", "Something went wrong. Try again in a moment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: BG }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>Create a Space</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Name */}
        <Text style={styles.label}>Space Name <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Wynwood Nights, Miami Foodies…"
          placeholderTextColor={MUTED}
          value={name}
          onChangeText={setName}
          maxLength={40}
          returnKeyType="next"
        />
        <Text style={styles.hint}>{name.length}/40</Text>

        {/* Description */}
        <Text style={styles.label}>What's it about?</Text>
        <TextInput
          style={[styles.input, styles.inputMulti]}
          placeholder="Describe your space in a sentence or two…"
          placeholderTextColor={MUTED}
          value={description}
          onChangeText={setDescription}
          maxLength={160}
          multiline
          returnKeyType="done"
        />
        <Text style={styles.hint}>{description.length}/160</Text>

        {/* Category */}
        <Text style={styles.label}>Category <Text style={styles.required}>*</Text></Text>
        <View style={styles.categoryGrid}>
          {CATEGORY_OPTIONS.map((opt) => {
            const selected = category === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setCategory(selected ? null : opt.id);
                }}
                style={[styles.categoryPill, selected && styles.categoryPillSelected]}
              >
                <Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* CTA */}
        <Pressable
          onPress={handleCreate}
          disabled={!canSubmit}
          style={({ pressed }) => [styles.ctaOuter, !canSubmit && { opacity: 0.4 }, pressed && { opacity: 0.85 }]}
        >
          <LinearGradient
            colors={[PINK, PURPLE]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.cta}
          >
            <Ionicons name="planet" size={18} color="#fff" />
            <Text style={styles.ctaText}>{saving ? "Creating…" : "Create Space"}</Text>
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 18, gap: 4 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.85)",
    marginTop: 16,
    marginBottom: 8,
  },
  required: { color: PINK },
  input: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  inputMulti: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  hint: {
    fontSize: 11,
    color: MUTED,
    marginTop: 4,
    alignSelf: "flex-end",
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  categoryPillSelected: {
    backgroundColor: "rgba(255,45,168,0.18)",
    borderColor: PINK + "88",
  },
  categoryText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: MUTED,
  },
  categoryTextSelected: {
    color: PINK,
  },
  ctaOuter: {
    marginTop: 32,
    borderRadius: 16,
    overflow: "hidden",
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
  },
  ctaText: {
    fontSize: 16,
    fontFamily: "Inter_800ExtraBold",
    color: "#fff",
  },
});
