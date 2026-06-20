/**
 * DiscoveryFilters
 * ─────────────────
 * Age range (18–65+) and distance radius (1–100 mi) sliders for the
 * Discover feed. Persisted to AsyncStorage + Firestore so they survive
 * app restarts and sync across devices.
 *
 * Usage: render <DiscoveryFiltersSheet visible onClose /> from Settings.
 * Consumers import useDiscoveryFilters() to read the current prefs.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

// ─── Storage key ─────────────────────────────────────────────────────────────

const PREFS_KEY = "cs:discovery:filters";

export type DiscoveryFilterPrefs = {
  ageMin: number;
  ageMax: number;
  distanceMiles: number;
};

const DEFAULTS: DiscoveryFilterPrefs = { ageMin: 18, ageMax: 45, distanceMiles: 25 };

// ─── Persistence helpers ──────────────────────────────────────────────────────

export async function loadDiscoveryFilters(): Promise<DiscoveryFilterPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<DiscoveryFilterPrefs>) };
  } catch {
    return DEFAULTS;
  }
}

export async function saveDiscoveryFilters(prefs: DiscoveryFilterPrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    // Non-blocking Firestore sync
    const { getFirestore, doc, updateDoc } = await import("firebase/firestore");
    const { getApp } = await import("firebase/app");
    const db = getFirestore(getApp());
    // We don't have userId here; call site should pass userId and update separately
    void updateDoc(doc(db, "discoveryPrefs", "placeholder"), prefs).catch(() => undefined);
  } catch {
    // Non-critical
  }
}

// ─── Hook: useDiscoveryFilters ────────────────────────────────────────────────

export function useDiscoveryFilters() {
  const [prefs, setPrefs] = useState<DiscoveryFilterPrefs>(DEFAULTS);
  useEffect(() => {
    void loadDiscoveryFilters().then(setPrefs);
  }, []);
  return prefs;
}

// ─── Single-track slider ──────────────────────────────────────────────────────

function SliderTrack({
  value,
  min,
  max,
  step,
  onChange,
  accentColor,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  accentColor: string;
}) {
  const trackWidth = useRef(0);
  const pct = (value - min) / (max - min);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => void Haptics.selectionAsync(),
      onPanResponderMove: (_, g) => {
        if (trackWidth.current === 0) return;
        const rawPct = Math.max(0, Math.min(1, g.moveX / trackWidth.current));
        const rawVal = min + rawPct * (max - min);
        const stepped = Math.round(rawVal / step) * step;
        onChange(Math.max(min, Math.min(max, stepped)));
      },
    }),
  ).current;

  return (
    <View
      onLayout={(e) => { trackWidth.current = e.nativeEvent.layout.width; }}
      style={styles.track}
      {...pan.panHandlers}
    >
      <View style={[styles.trackFill, { width: `${pct * 100}%`, backgroundColor: accentColor }]} />
      <View style={[styles.thumb, { left: `${pct * 100}%`, borderColor: accentColor }]} />
    </View>
  );
}

// ─── Main sheet ───────────────────────────────────────────────────────────────

interface DiscoveryFiltersSheetProps {
  visible: boolean;
  userId?: string | null;
  onClose: () => void;
  onSaved?: (prefs: DiscoveryFilterPrefs) => void;
}

export default function DiscoveryFiltersSheet({
  visible,
  userId,
  onClose,
  onSaved,
}: DiscoveryFiltersSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(400)).current;

  const [ageMin, setAgeMin] = useState(DEFAULTS.ageMin);
  const [ageMax, setAgeMax] = useState(DEFAULTS.ageMax);
  const [distance, setDistance] = useState(DEFAULTS.distanceMiles);

  // Load saved prefs on open
  useEffect(() => {
    if (!visible) return;
    void loadDiscoveryFilters().then((p) => {
      setAgeMin(p.ageMin);
      setAgeMax(p.ageMax);
      setDistance(p.distanceMiles);
    });
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
  }, [visible, slideAnim]);

  const handleClose = useCallback(() => {
    Animated.timing(slideAnim, { toValue: 400, duration: 240, useNativeDriver: true }).start(onClose);
  }, [onClose, slideAnim]);

  const handleSave = useCallback(async () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const prefs: DiscoveryFilterPrefs = { ageMin, ageMax, distanceMiles: distance };
    await saveDiscoveryFilters(prefs);
    // Sync to Firestore with userId
    if (userId) {
      try {
        const { getFirestore, doc, updateDoc } = await import("firebase/firestore");
        const { getApp } = await import("firebase/app");
        const db = getFirestore(getApp());
        await updateDoc(doc(db, "users", userId), { discoveryPrefs: prefs });
      } catch {
        // Non-critical
      }
    }
    onSaved?.(prefs);
    handleClose();
  }, [ageMin, ageMax, distance, userId, onSaved, handleClose]);

  if (!visible) return null;

  const ageLabel = ageMax >= 65 ? `${ageMin}–65+` : `${ageMin}–${ageMax}`;
  const distLabel = distance >= 100 ? "100+ mi" : `${distance} mi`;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 },
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Handle */}
        <View style={styles.handle} />

        <Text style={[styles.title, { color: colors.foreground }]}>Discovery Filters</Text>

        {/* Age range */}
        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          Age Range <Text style={[styles.value, { color: colors.foreground }]}>{ageLabel}</Text>
        </Text>
        <View style={styles.dualSlider}>
          <Text style={[styles.minMax, { color: colors.mutedForeground }]}>18</Text>
          <View style={styles.sliderWrap}>
            <SliderTrack value={ageMin} min={18} max={ageMax - 1} step={1} onChange={(v) => setAgeMin(Math.min(v, ageMax - 1))} accentColor="#EC4899" />
            <SliderTrack value={ageMax} min={ageMin + 1} max={65} step={1} onChange={(v) => setAgeMax(Math.max(v, ageMin + 1))} accentColor="#A855F7" />
          </View>
          <Text style={[styles.minMax, { color: colors.mutedForeground }]}>65+</Text>
        </View>

        {/* Distance */}
        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          Max Distance <Text style={[styles.value, { color: colors.foreground }]}>{distLabel}</Text>
        </Text>
        <View style={styles.dualSlider}>
          <Ionicons name="navigate-outline" size={16} color={colors.mutedForeground} />
          <View style={styles.sliderWrap}>
            <SliderTrack value={distance} min={1} max={100} step={5} onChange={setDistance} accentColor="#38BDF8" />
          </View>
          <Text style={[styles.minMax, { color: colors.mutedForeground }]}>100</Text>
        </View>

        {/* Save button */}
        <Pressable onPress={() => void handleSave()} style={styles.saveBtn}>
          <LinearGradient
            colors={["#EC4899", "#A855F7"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveBtnGrad}
          >
            <Text style={styles.saveBtnText}>Save Filters</Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignSelf: "center",
    marginBottom: 20,
  },
  title: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 24 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 12, marginTop: 8 },
  value: { fontFamily: "Inter_700Bold" },
  dualSlider: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  sliderWrap: { flex: 1, gap: 16 },
  minMax: { fontSize: 11, fontFamily: "Inter_500Medium", width: 24, textAlign: "center" },
  track: {
    height: 36,
    justifyContent: "center",
    position: "relative",
  },
  trackFill: { height: 3, borderRadius: 2, position: "absolute", left: 0 },
  thumb: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#fff",
    borderWidth: 2.5,
    marginLeft: -11,
    top: 7,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  saveBtn: { borderRadius: 16, overflow: "hidden", marginTop: 8 },
  saveBtnGrad: { padding: 16, alignItems: "center" },
  saveBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
});
