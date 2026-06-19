/**
 * Referral Screen
 * ────────────────
 * Users earn 7 days free premium for every 3 friends who sign up via their link.
 *
 * Firestore:
 *   users/{userId}.referralCode     — e.g. "RICKY42"
 *   referrals/{code}/uses            — collection of accepted referral docs
 *
 * Deep link: connectsphere.app/invite/{code} → handled in app/_layout.tsx
 *
 * Route: /referral (push from Profile tab)
 */
import { useUser } from "@clerk/clerk-expo";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";

import { useColors } from "@/hooks/useColors";

const REWARD_THRESHOLD = 3; // friends needed for reward
const REWARD_DAYS = 7;

// ─── Firestore helpers ────────────────────────────────────────────────────────

async function getOrCreateReferralCode(userId: string, displayName: string): Promise<string> {
  try {
    const { getFirestore, doc, getDoc, updateDoc } = await import("firebase/firestore");
    const { getApp } = await import("firebase/app");
    const db = getFirestore(getApp());
    const userDoc = await getDoc(doc(db, "users", userId));
    if (userDoc.data()?.referralCode) return userDoc.data()!.referralCode as string;
    // Generate code: first 5 chars of name (uppercased) + last 4 of userId
    const code = `${displayName.replace(/[^a-zA-Z]/g, "").slice(0, 5).toUpperCase()}${userId.slice(-4).toUpperCase()}`;
    await updateDoc(doc(db, "users", userId), { referralCode: code });
    return code;
  } catch {
    return `CS${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }
}

async function getReferralCount(code: string): Promise<number> {
  try {
    const { getFirestore, collection, getDocs } = await import("firebase/firestore");
    const { getApp } = await import("firebase/app");
    const db = getFirestore(getApp());
    const snap = await getDocs(collection(db, "referrals", code, "uses"));
    return snap.size;
  } catch {
    return 0;
  }
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ReferralScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const [code, setCode] = useState("");
  const [useCount, setUseCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    const name = user.firstName ?? user.fullName ?? "User";
    void getOrCreateReferralCode(user.id, name).then(async (c) => {
      setCode(c);
      const count = await getReferralCount(c);
      setUseCount(count);
      setLoading(false);
    });
  }, [user?.id, user?.firstName, user?.fullName]);

  const shareLink = `https://connectsphere.app/invite/${code}`;
  const rewardsEarned = Math.floor(useCount / REWARD_THRESHOLD);
  const progressToNext = useCount % REWARD_THRESHOLD;

  const handleShare = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Share.share({
        message: `Join me on ConnectSphere — meet people worth meeting 🔗\n\n${shareLink}`,
        url: shareLink,
      });
    } catch {
      // User cancelled
    }
  };

  const handleCopy = async () => {
    void Haptics.selectionAsync();
    await Clipboard.setStringAsync(shareLink);
    Alert.alert("Copied!", "Your invite link is on the clipboard.");
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Invite Friends</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <View style={styles.content}>
          {/* Hero */}
          <LinearGradient
            colors={["#EC4899", "#A855F7"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <Text style={styles.heroEmoji}>🎁</Text>
            <Text style={styles.heroTitle}>Give friends ConnectSphere</Text>
            <Text style={styles.heroSub}>
              Invite {REWARD_THRESHOLD} friends → you both get {REWARD_DAYS} days Premium free
            </Text>
          </LinearGradient>

          {/* Progress */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>Your progress</Text>
            <View style={styles.progressRow}>
              {Array.from({ length: REWARD_THRESHOLD }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.progressDot,
                    i < progressToNext
                      ? { backgroundColor: "#EC4899" }
                      : { backgroundColor: colors.muted },
                  ]}
                />
              ))}
              <Text style={[styles.progressText, { color: colors.foreground }]}>
                {progressToNext}/{REWARD_THRESHOLD} friends joined
              </Text>
            </View>
            {rewardsEarned > 0 ? (
              <Text style={[styles.rewardEarned, { color: "#22C55E" }]}>
                ✓ You've earned {rewardsEarned * REWARD_DAYS} days of Premium!
              </Text>
            ) : null}
          </View>

          {/* Your code */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>Your invite code</Text>
            <Pressable onPress={handleCopy} style={styles.codeRow}>
              <Text style={[styles.code, { color: colors.foreground }]}>{code}</Text>
              <Ionicons name="copy-outline" size={18} color={colors.mutedForeground} />
            </Pressable>
            <Text style={[styles.linkText, { color: colors.mutedForeground }]} numberOfLines={1}>
              {shareLink}
            </Text>
          </View>

          {/* CTA */}
          <Pressable onPress={() => void handleShare()} style={styles.shareBtn}>
            <LinearGradient
              colors={["#EC4899", "#A855F7"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.shareBtnGrad}
            >
              <Ionicons name="share-social" size={20} color="#fff" />
              <Text style={styles.shareBtnText}>Share Your Invite</Text>
            </LinearGradient>
          </Pressable>

          <Text style={[styles.fine, { color: colors.mutedForeground }]}>
            Premium days are credited within 24h after each friend completes signup.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 17, fontFamily: "Inter_700Bold" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { flex: 1, padding: 16, gap: 14 },
  hero: {
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 6,
  },
  heroEmoji: { fontSize: 40 },
  heroTitle: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  heroSub: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 8,
  },
  cardLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, textTransform: "uppercase" },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  progressDot: { width: 14, height: 14, borderRadius: 7 },
  progressText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  rewardEarned: { fontSize: 13, fontFamily: "Inter_700Bold" },
  codeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  code: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: 2 },
  linkText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  shareBtn: { borderRadius: 16, overflow: "hidden" },
  shareBtnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, padding: 16 },
  shareBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
  fine: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },
});
