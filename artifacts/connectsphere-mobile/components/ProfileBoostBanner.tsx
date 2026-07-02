/**
 * ProfileBoostBanner
 * ───────────────────
 * Shows an active boost countdown in the Discover header
 * or a "Boost your profile" CTA when inactive.
 *
 * Boost logic:
 *  - 30-min window stored as Firestore users/{id}.boostExpiresAt
 *  - ConnectSphere Plus entitlement required
 *  - During boost: discovery feed API returns this user 3× more frequently
 *
 * Usage: drop <ProfileBoostBanner userId={...} /> in the Discover tab header.
 */
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Analytics } from "@/lib/analytics";
import { useColors } from "@/hooks/useColors";
import { getBoostPressDecision } from "@/lib/retentionFeatures";
import { openPremium } from "@/lib/routes";
import { usePersistentBoost } from "@/hooks/usePersistentBoost";

// ─── Component ───────────────────────────────────────────────────────────────

interface ProfileBoostBannerProps {
  userId: string;
  isPremium: boolean;
}

export default function ProfileBoostBanner({ userId, isPremium }: ProfileBoostBannerProps) {
  const colors = useColors();
  const {
    expiresAt,
    lastActivatedDate,
    activating,
    activate,
  } = usePersistentBoost(userId);
  const [countdown, setCountdown] = useState("");
  const glowProgress = useSharedValue(0);

  const isActive = !!expiresAt && expiresAt > new Date();

  // Countdown tick
  useEffect(() => {
    if (!isActive || !expiresAt) return;
    const tick = () => {
      const ms = Math.max(0, expiresAt.getTime() - Date.now());
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setCountdown(`${m}:${String(s).padStart(2, "0")}`);
      // When ms hits 0 the usePersistentBoost hook fires its own setTimeout
      // expiry handler, clears AsyncStorage + Firestore cache, and calls
      // Analytics.boostExpired() — no action needed here.
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isActive, expiresAt]);

  // Glow animation when active
  useEffect(() => {
    if (!isActive) {
      cancelAnimation(glowProgress);
      glowProgress.value = 0;
      return;
    }
    glowProgress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200 }),
        withTiming(0, { duration: 1200 }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(glowProgress);
  }, [glowProgress, isActive]);

  const activeGlowStyle = useAnimatedStyle(() => ({
    opacity: 0.2 + glowProgress.value * 0.45,
    transform: [{ scale: 1 + glowProgress.value * 0.1 }],
  }));

  const handleBoostPress = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const decision = getBoostPressDecision({ isActive, isPremium, lastActivatedDate, today });
    if (decision.type === "active") {
      Alert.alert("Boost Active", `Your profile is boosted for ${countdown} more.`);
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (decision.type === "paywall") {
      Analytics.paywallSeen("boost");
      openPremium("boost");
      return;
    }
    if (decision.type === "used-today") {
      Alert.alert("Boost used today", "Plus includes one Boost per day. Come back tomorrow for the next one.");
      return;
    }

    // Delegate to usePersistentBoost — writes AsyncStorage + Firestore in parallel
    const result = await activate();
    if (result.success) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Alert.alert("Boost unavailable", "We could not activate your Boost. Try again.");
    }
  };

  if (isActive) {
    return (
      <Pressable onPress={handleBoostPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
        <View style={styles.activePill}>
          <Animated.View pointerEvents="none" style={[styles.activeGlow, activeGlowStyle]} />
          <LinearGradient colors={["#FF40A6", "#E83DFF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.activeGrad}>
            <Ionicons name="rocket" size={12} color="#fff" />
            <Text style={styles.activeText}>BOOSTED · {countdown}</Text>
          </LinearGradient>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handleBoostPress}
      disabled={activating}
      style={({ pressed }) => [
        styles.inactiveBtn,
        { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Ionicons name="rocket-outline" size={12} color={colors.mutedForeground} />
      <Text style={[styles.inactiveText, { color: colors.mutedForeground }]}>
        {activating ? "Activating..." : "Boost"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  activePill: {
    borderRadius: 999,
    overflow: "visible",
    shadowColor: "#FF40A6",
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 6,
  },
  activeGlow: {
    position: "absolute",
    top: -4,
    right: -4,
    bottom: -4,
    left: -4,
    borderRadius: 999,
    backgroundColor: "#FF40A6",
  },
  activeGrad: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  activeText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  inactiveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  inactiveText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
});
