/**
 * Likes You Screen
 * ─────────────────
 * Grid of profiles who liked/sparked you.
 * Premium: full unblurred photos + name.
 * Free: blurred photos + count only.
 *
 * Firestore: reactions/{userId}/received — collection of
 *   { fromUserId, fromName, fromPhotoUrl, fromAge, fromLocation, action, createdAt }
 *
 * Route: /likes-you  (push from Matches tab header)
 */
import { useUser } from "@clerk/clerk-expo";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { getPremiumEntitlement } from "@/services/launchReadyApi";
import { hasPremiumAccess } from "@/lib/premiumAccess";
import { openPremium } from "@/lib/routes";

// ─── Types ───────────────────────────────────────────────────────────────────

type Liker = {
  fromUserId: string;
  fromName: string;
  fromAge?: number;
  fromPhotoUrl: string;
  fromLocation?: string;
  action: "vibe" | "spark" | "like";
  createdAt: string;
};

// ─── Firestore fetch ──────────────────────────────────────────────────────────

async function fetchLikers(userId: string): Promise<Liker[]> {
  try {
    const { getFirestore, collection, query, orderBy, limit, getDocs } = await import("firebase/firestore");
    const { getApp } = await import("firebase/app");
    const db = getFirestore(getApp());
    const q = query(
      collection(db, "reactions", userId, "received"),
      orderBy("createdAt", "desc"),
      limit(50),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as Liker);
  } catch {
    // Return mock data for demo
    return Array.from({ length: 8 }, (_, i) => ({
      fromUserId: `mock_${i}`,
      fromName: ["Sofia", "Camila", "Isabella", "Valentina", "Natalia", "Lucia", "Gabriela", "Maria"][i] ?? "Someone",
      fromAge: 20 + i,
      fromPhotoUrl: `https://images.unsplash.com/photo-${1500000000 + i * 10000}?w=400&q=80`,
      fromLocation: "Miami, FL",
      action: i % 3 === 0 ? "spark" : "vibe",
      createdAt: new Date(Date.now() - i * 3600000).toISOString(),
    }));
  }
}

// ─── Liker Card ───────────────────────────────────────────────────────────────

function LikerCard({ liker, isPremium, onPress }: { liker: Liker; isPremium: boolean; onPress: () => void }) {
  const isSpark = liker.action === "spark";
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, { opacity: pressed ? 0.88 : 1 }]}
    >
      <View style={styles.cardInner}>
        <Image source={{ uri: liker.fromPhotoUrl }} style={styles.photo} contentFit="cover" />

        {/* Blur overlay for free users */}
        {!isPremium ? (
          <BlurView intensity={55} style={StyleSheet.absoluteFill} tint="dark" />
        ) : null}

        {/* Gradient bottom */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.85)"]}
          style={styles.gradient}
        />

        {/* Action badge */}
        <View style={[styles.actionBadge, isSpark ? styles.sparkBadge : styles.vibeBadge]}>
          <Ionicons name={isSpark ? "flash" : "heart"} size={12} color="#fff" />
        </View>

        {/* Name — blurred/hidden for free */}
        {isPremium ? (
          <View style={styles.nameRow}>
            <Text style={styles.nameText} numberOfLines={1}>
              {liker.fromName}{liker.fromAge ? `, ${liker.fromAge}` : ""}
            </Text>
          </View>
        ) : (
          <View style={styles.nameRow}>
            <View style={styles.blurredName} />
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LikesYouScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const [likers, setLikers] = useState<Liker[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let mounted = true;
    const userId = user.id;
    setLoading(true);
    void Promise.all([
      fetchLikers(userId),
      getPremiumEntitlement().catch(() => null),
    ])
      .then(([nextLikers, entitlement]) => {
        if (!mounted) return;
        setLikers(nextLikers);
        setIsPremium(hasPremiumAccess(entitlement));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const handleCardPress = (liker: Liker) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!isPremium) {
      openPremium("reactions");
      return;
    }
    router.push({ pathname: "/user/[userId]", params: { userId: liker.fromUserId } } as never);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Likes You {likers.length > 0 ? `· ${likers.length}` : ""}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      {/* Premium upsell banner */}
      {!isPremium && likers.length > 0 ? (
        <Pressable onPress={() => openPremium("reactions")} style={styles.upsellBanner}>
          <LinearGradient
            colors={["#EC4899", "#A855F7"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.upsellGrad}
          >
            <Ionicons name="eye" size={18} color="#fff" />
            <Text style={styles.upsellText}>
              Unlock {likers.length} {likers.length === 1 ? "profile" : "profiles"} — upgrade to Premium
            </Text>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
          </LinearGradient>
        </Pressable>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : likers.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="heart-outline" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No likes yet</Text>
          <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
            Keep swiping — your likes will show up here!
          </Text>
        </View>
      ) : (
        <FlatList
          data={likers}
          keyExtractor={(item) => item.fromUserId}
          numColumns={2}
          contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 20 }]}
          columnWrapperStyle={{ gap: 10 }}
          renderItem={({ item }) => (
            <LikerCard
              liker={item}
              isPremium={isPremium}
              onPress={() => handleCardPress(item)}
            />
          )}
        />
      )}
    </View>
  );
}

const CARD_SIZE = 170;

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
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  upsellBanner: { marginHorizontal: 16, marginTop: 12, borderRadius: 14, overflow: "hidden" },
  upsellGrad: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  upsellText: { flex: 1, color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  grid: { padding: 16, gap: 10 },
  card: { flex: 1 },
  cardInner: {
    width: "100%",
    height: CARD_SIZE,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#111",
  },
  photo: { ...StyleSheet.absoluteFillObject },
  gradient: { position: "absolute", bottom: 0, left: 0, right: 0, height: 70 },
  actionBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  sparkBadge: { backgroundColor: "#A855F7" },
  vibeBadge: { backgroundColor: "#EC4899" },
  nameRow: { position: "absolute", bottom: 10, left: 10, right: 10 },
  nameText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13 },
  blurredName: {
    height: 14,
    width: 80,
    borderRadius: 7,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  emptyBody: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 32 },
});
