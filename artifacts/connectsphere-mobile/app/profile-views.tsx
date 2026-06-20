/**
 * Profile Views Screen
 * ──────────────────────
 * Shows who visited your profile in the last 30 days.
 *
 * Firestore:
 *   profileViews/{userId}/visitors/{viewerId}
 *     { viewerName, viewerPhoto, viewedAt }
 *
 * Free users: only the most recent visitor is shown unblurred.
 * Plus users: see every visitor with a "View profile" CTA.
 *
 * Route: /profile-views (pushed from Profile tab stats row)
 */
import { useAuth } from "@clerk/clerk-expo";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { hasPremiumAccess } from "@/lib/premiumAccess";
import { getPremiumEntitlement } from "@/services/launchReadyApi";

// ─── Types ────────────────────────────────────────────────────────────────────

type Visitor = {
  viewerId: string;
  viewerName: string;
  viewerPhoto: string | null;
  viewedAt: Date;
};

// ─── Firestore helpers ────────────────────────────────────────────────────────

async function loadVisitors(userId: string): Promise<Visitor[]> {
  try {
    const { getFirestore, collection, getDocs, query, orderBy, limit } =
      await import("firebase/firestore");
    const { getApp } = await import("firebase/app");
    const db = getFirestore(getApp());
    const q = query(
      collection(db, "profileViews", userId, "visitors"),
      orderBy("viewedAt", "desc"),
      limit(50),
    );
    const snap = await getDocs(q);
    return snap.docs.map((docSnap) => {
      const d = docSnap.data();
      return {
        viewerId: docSnap.id,
        viewerName: (d.viewerName as string | undefined) ?? "Someone",
        viewerPhoto: (d.viewerPhoto as string | null | undefined) ?? null,
        viewedAt: (d.viewedAt as { toDate?: () => Date } | undefined)?.toDate?.() ?? new Date(),
      };
    });
  } catch {
    return [];
  }
}

function timeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return "1w+ ago";
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProfileViewsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    setLoading(true);
    void Promise.all([
      loadVisitors(userId),
      getPremiumEntitlement().catch(() => null),
    ])
      .then(([nextVisitors, entitlement]) => {
        if (!mounted) return;
        setVisitors(nextVisitors);
        setIsPremium(hasPremiumAccess(entitlement));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [userId]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 8, borderBottomColor: colors.border },
        ]}
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Profile Views</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : visitors.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>👀</Text>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No views yet</Text>
          <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
            When someone checks out your profile, they'll appear here.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {/* Count header */}
          <Text style={[styles.countLine, { color: colors.mutedForeground }]}>
            {visitors.length} {visitors.length === 1 ? "person" : "people"} visited your profile
          </Text>

          {visitors.map((visitor, index) => {
            // Free users: blur everything except the first visitor
            const isBlurred = !isPremium && index >= 1;

            return (
              <View
                key={visitor.viewerId}
                style={[styles.row, { borderBottomColor: colors.border }]}
              >
                {isBlurred ? (
                  <View style={styles.blurRow}>
                    {/* Blurred avatar */}
                    <View style={styles.avatarBlurShell}>
                      <View style={[styles.avatar, { backgroundColor: colors.muted }]} />
                      <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
                    </View>
                    {/* Blurred name, but show timestamp */}
                    <View style={styles.rowInfo}>
                      <View style={[styles.nameBlurBox, { backgroundColor: colors.muted }]} />
                      <Text style={[styles.timeAgo, { color: colors.mutedForeground }]}>
                        {timeAgo(visitor.viewedAt)}
                      </Text>
                    </View>
                    <Ionicons name="lock-closed" size={16} color={colors.mutedForeground} />
                  </View>
                ) : (
                  <>
                    {visitor.viewerPhoto ? (
                      <Image
                        source={{ uri: visitor.viewerPhoto }}
                        style={styles.avatar}
                        contentFit="cover"
                      />
                    ) : (
                      <View
                        style={[
                          styles.avatar,
                          {
                            backgroundColor: colors.muted,
                            alignItems: "center",
                            justifyContent: "center",
                          },
                        ]}
                      >
                        <Ionicons name="person" size={22} color={colors.mutedForeground} />
                      </View>
                    )}
                    <View style={styles.rowInfo}>
                      <Text style={[styles.visitorName, { color: colors.foreground }]}>
                        {visitor.viewerName}
                      </Text>
                      <Text style={[styles.timeAgo, { color: colors.mutedForeground }]}>
                        {timeAgo(visitor.viewedAt)}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => router.push({ pathname: "/user/[userId]", params: { userId: visitor.viewerId } } as any)}
                      hitSlop={8}
                      style={styles.viewBtn}
                    >
                      <Text style={styles.viewBtnText}>View</Text>
                    </Pressable>
                  </>
                )}
              </View>
            );
          })}

          {/* Premium upsell when not Plus and there are hidden visitors */}
          {!isPremium && visitors.length > 1 && (
            <Pressable
              onPress={() => router.push("/premium" as any)}
              style={styles.upsellWrap}
            >
              <LinearGradient
                colors={["#EC4899", "#A855F7"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.upsellCard}
              >
                <Text style={styles.upsellEmoji}>👑</Text>
                <Text style={styles.upsellTitle}>
                  Unlock all {visitors.length} visitors
                </Text>
                <Text style={styles.upsellBody}>
                  Upgrade to ConnectSphere Plus to see everyone who checked out your profile.
                </Text>
                <View style={styles.upsellBtn}>
                  <Text style={styles.upsellBtnText}>Get Plus →</Text>
                </View>
              </LinearGradient>
            </Pressable>
          )}
        </ScrollView>
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
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 32,
  },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  emptyBody: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  list: { paddingBottom: 48 },
  countLine: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 14,
  },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  rowInfo: { flex: 1, gap: 3 },
  visitorName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  timeAgo: { fontSize: 12, fontFamily: "Inter_400Regular" },
  viewBtn: {
    backgroundColor: "rgba(236,72,153,0.15)",
    borderWidth: 1,
    borderColor: "rgba(236,72,153,0.4)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  viewBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#EC4899",
  },
  // Blurred row
  blurRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatarBlurShell: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: "hidden",
  },
  nameBlurBox: {
    width: 120,
    height: 14,
    borderRadius: 4,
    opacity: 0.35,
  },
  // Upsell card
  upsellWrap: { margin: 20, borderRadius: 20, overflow: "hidden" },
  upsellCard: { padding: 24, alignItems: "center", gap: 10 },
  upsellEmoji: { fontSize: 36 },
  upsellTitle: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  upsellBody: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 18,
  },
  upsellBtn: {
    backgroundColor: "rgba(0,0,0,0.28)",
    borderRadius: 20,
    paddingHorizontal: 28,
    paddingVertical: 10,
    marginTop: 4,
  },
  upsellBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});
