/**
 * User Profile Screen  /user/[userId]
 * ─────────────────────────────────────
 * Full-screen scrollable profile view opened when tapping any user card —
 * from Shots, Reactions, Likes You, Match list, or direct deep-link.
 *
 * Renders ALL onboarding data: photo carousel, intent badge, bio,
 * prompt/answer, dating goal, first-date style, date ideas, interests,
 * and info pills — so the screen is never a dead black void below the photo.
 */

import { useAuth, useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import ReportBlockSheet from "@/components/ReportBlockSheet";
import { useGetProfile } from "@workspace/api-client-react";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PHOTO_HEIGHT = SCREEN_WIDTH * 1.22;
const ACCENT_DATING = "#FF2DA8";
const ACCENT_FRIENDS = "#6366F1";

// ─── modeData helpers ─────────────────────────────────────────────────────────

function md(profile: any): Record<string, unknown> {
  return (profile?.modeData ?? {}) as Record<string, unknown>;
}
function mdStr(profile: any, key: string): string | undefined {
  const v = md(profile)[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}
function mdArr(profile: any, key: string): string[] {
  const v = md(profile)[key];
  return Array.isArray(v) ? (v as string[]).filter((s) => typeof s === "string" && s.trim()) : [];
}

function datingGoalLabel(goal?: string | null): string | undefined {
  if (!goal) return undefined;
  const map: Record<string, string> = {
    long_term: "Long-term",
    casual: "Something casual",
    hookup: "Hookup",
    curious: "Still figuring it out",
    friends_first: "Friends first",
    marriage: "Marriage-minded",
  };
  return map[goal.toLowerCase().replace(/ /g, "_")] ?? goal;
}

function intentLabel(intent?: string | null) {
  return (intent ?? "dating") === "friendship" ? "Friends" : "Dating";
}
function intentIcon(intent?: string | null): keyof typeof Ionicons.glyphMap {
  return (intent ?? "dating") === "friendship" ? "people" : "flame";
}
function intentAccent(intent?: string | null) {
  return (intent ?? "dating") === "friendship" ? ACCENT_FRIENDS : ACCENT_DATING;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Dot indicators below the photo carousel */
function PhotoDots({ total, active }: { total: number; active: number }) {
  if (total <= 1) return null;
  return (
    <View style={dots.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[dots.dot, i === active ? dots.dotActive : dots.dotInactive]}
        />
      ))}
    </View>
  );
}
const dots = StyleSheet.create({
  row: { flexDirection: "row", gap: 5, alignItems: "center", justifyContent: "center" },
  dot: { borderRadius: 99, height: 5 },
  dotActive: { width: 18, backgroundColor: "#fff" },
  dotInactive: { width: 5, backgroundColor: "rgba(255,255,255,0.40)" },
});

/** Single pill: icon + label */
function InfoPill({ icon, label, accent }: { icon: keyof typeof Ionicons.glyphMap; label: string; accent?: string }) {
  return (
    <View style={[pill.wrap, accent ? { borderColor: accent + "55", backgroundColor: accent + "18" } : {}]}>
      <Ionicons name={icon} size={13} color={accent ?? "rgba(255,255,255,0.55)"} />
      <Text style={[pill.text, accent ? { color: accent } : {}]}>{label}</Text>
    </View>
  );
}
const pill = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  text: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.72)" },
});

/** Prompt / answer card */
function PromptCard({ prompt, answer }: { prompt?: string; answer?: string }) {
  if (!answer) return null;
  return (
    <View style={pCard.wrap}>
      <LinearGradient
        colors={["rgba(236,72,153,0.14)", "rgba(99,102,241,0.08)", "rgba(0,0,0,0)"]}
        style={StyleSheet.absoluteFill}
      />
      {prompt ? (
        <Text style={pCard.prompt}>{prompt}</Text>
      ) : null}
      <Text style={pCard.answer}>{answer}</Text>
    </View>
  );
}
const pCard = StyleSheet.create({
  wrap: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(236,72,153,0.26)",
    backgroundColor: "rgba(255,255,255,0.045)",
    padding: 16,
    overflow: "hidden",
    gap: 6,
  },
  prompt: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#F9A8D4", letterSpacing: 0.4 },
  answer: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff", lineHeight: 22 },
});

/** Interests / date-ideas chips */
function ChipRow({ items, accent }: { items: string[]; accent?: string }) {
  if (!items.length) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {items.map((item) => (
        <View
          key={item}
          style={[
            chipStyle.wrap,
            accent ? { borderColor: accent + "44", backgroundColor: accent + "14" } : {},
          ]}
        >
          <Text style={[chipStyle.text, accent ? { color: accent } : {}]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}
const chipStyle = StyleSheet.create({
  wrap: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  text: { fontSize: 13, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.80)" },
});

/** Section heading */
function SectionHeading({ label }: { label: string }) {
  return (
    <Text style={sh.text}>{label}</Text>
  );
}
const sh = StyleSheet.create({
  text: {
    fontSize: 11,
    fontFamily: "Inter_800ExtraBold",
    color: "rgba(255,255,255,0.38)",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 4,
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function UserProfileScreen() {
  const {
    userId,
    from,
    fallbackName,
    fallbackPhoto,
    fallbackAge,
    fallbackNeighborhood,
  } = useLocalSearchParams<{
    userId: string;
    from?: string;
    fallbackName?: string;
    fallbackPhoto?: string;
    fallbackAge?: string;
    fallbackNeighborhood?: string;
  }>();

  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const { isSignedIn, userId: currentUserId } = useAuth();
  const { user: currentUser } = useUser();
  const [showReport, setShowReport] = useState(false);
  const [activePhoto, setActivePhoto] = useState(0);
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setActivePhoto(viewableItems[0].index);
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  // Track profile view in Firestore (fire-and-forget)
  useEffect(() => {
    if (!userId || !currentUserId || currentUserId === userId) return;
    void (async () => {
      try {
        const { getFirestore, doc, setDoc, serverTimestamp } = await import("firebase/firestore");
        const { getApp } = await import("firebase/app");
        const db = getFirestore(getApp());
        await setDoc(
          doc(db, "profileViews", userId, "visitors", currentUserId),
          {
            viewerName: currentUser?.firstName ?? currentUser?.fullName ?? "Someone",
            viewerPhoto: currentUser?.imageUrl ?? null,
            viewedAt: serverTimestamp(),
          },
          { merge: true },
        );
      } catch { /* non-critical */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, currentUserId]);

  const { data: profile, isLoading } = useGetProfile(userId ?? "", {
    query: { enabled: !!userId && !!isSignedIn },
  });

  const hasFallback = !!(fallbackName || fallbackPhoto);

  const handleShare = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const handle = (profile as any)?.username ?? userId ?? "";
    const url = `https://connectsphere.app/u/${handle}`;
    try {
      await Share.share({ message: `Check out this profile on ConnectSphere 🔗\n\n${url}`, url });
    } catch { /* cancelled */ }
  };

  // ── Spinner only when we have nothing at all to show ────────────────────────
  if (isLoading && !profile && !hasFallback) {
    return (
      <View style={[styles.centered, { backgroundColor: "#0a0a0f" }]}>
        <ActivityIndicator color={ACCENT_DATING} size="large" />
      </View>
    );
  }

  // ── Build resolved profile — real data wins, fallbacks fill any gaps ─────────
  const fallbackPhotos = fallbackPhoto ? [fallbackPhoto] : [];
  const resolvedProfile: any = profile
    ? {
        ...profile,
        displayName: profile.displayName || fallbackName || "Profile",
        photos: (profile as any).photos?.length ? (profile as any).photos : fallbackPhotos,
        age: (profile as any).age ?? (fallbackAge ? Number(fallbackAge) : undefined),
        location: (profile as any).location || fallbackNeighborhood || undefined,
      }
    : hasFallback
    ? {
        displayName: fallbackName ?? "Profile",
        photos: fallbackPhotos,
        age: fallbackAge ? Number(fallbackAge) : undefined,
        location: fallbackNeighborhood ?? undefined,
        bio: undefined,
        interests: [],
        isVerified: false,
        intent: "dating",
        modeData: {},
      }
    : null;

  if (!resolvedProfile) {
    return (
      <View style={[styles.centered, { backgroundColor: "#0a0a0f" }]}>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { top: 60 }]}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </Pressable>
        <Ionicons name="person-outline" size={48} color="rgba(255,255,255,0.25)" />
        <Text style={styles.emptyText}>Profile not available</Text>
      </View>
    );
  }

  // ── Extract all the good stuff ───────────────────────────────────────────────
  const allPhotos: string[] = resolvedProfile.photos?.length ? resolvedProfile.photos : [];
  const intent = resolvedProfile.intent ?? "dating";
  const accent = intentAccent(intent);

  // modeData fields
  const datingGoal   = datingGoalLabel(mdStr(resolvedProfile, "datingGoal") ?? resolvedProfile.connectionSubtype);
  const prompt       = mdStr(resolvedProfile, "prompt");
  const promptAnswer = mdStr(resolvedProfile, "promptAnswer");
  const firstDate    = mdStr(resolvedProfile, "firstDateStyle");
  const dateIdeas    = mdArr(resolvedProfile, "dateIdeas");
  const heightVal    = mdStr(resolvedProfile, "height");
  const occupation   = mdStr(resolvedProfile, "occupation") ?? resolvedProfile.profession;
  const lifestyle    = mdStr(resolvedProfile, "lifestyle");
  const intentions   = mdStr(resolvedProfile, "intentions");

  const interests: string[] = Array.isArray(resolvedProfile.interests)
    ? resolvedProfile.interests
    : [];

  const openedFromMatches = from === "matches";

  return (
    <View style={[styles.container, { backgroundColor: "#0a0a0f" }]}>
      {/* ── Back button ── */}
      <Pressable
        onPress={() => router.back()}
        style={[styles.backBtn, { top: topInset + 8 }]}
      >
        <Ionicons
          name={openedFromMatches ? "close" : "chevron-back"}
          size={openedFromMatches ? 24 : 26}
          color="#fff"
        />
      </Pressable>

      {/* ── Share + report ── */}
      {userId && (
        <View style={[styles.topRightCluster, { top: topInset + 8 }]}>
          <Pressable onPress={() => void handleShare()} hitSlop={8} style={styles.overlayBtn}>
            <Ionicons name="share-outline" size={20} color="#fff" />
          </Pressable>
          <Pressable onPress={() => setShowReport(true)} hitSlop={8} style={styles.overlayBtn}>
            <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
          </Pressable>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomInset + 120 }}>

        {/* ═══════════════════════════════════════════════════
            PHOTO CAROUSEL
        ═══════════════════════════════════════════════════ */}
        <Animated.View entering={FadeIn.duration(200)} style={{ height: PHOTO_HEIGHT }}>
          {allPhotos.length > 0 ? (
            <FlatList
              data={allPhotos}
              keyExtractor={(_, i) => String(i)}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              renderItem={({ item }) => (
                <Image
                  source={{ uri: item }}
                  style={{ width: SCREEN_WIDTH, height: PHOTO_HEIGHT }}
                  contentFit="cover"
                />
              )}
            />
          ) : (
            <View style={[styles.photoPlaceholder, { width: SCREEN_WIDTH, height: PHOTO_HEIGHT }]}>
              <Ionicons name="person" size={90} color="rgba(255,255,255,0.12)" />
            </View>
          )}

          {/* Gradient fade to background */}
          <LinearGradient
            colors={["transparent", "rgba(10,10,15,0.70)", "#0a0a0f"]}
            style={[styles.photoGradient, { height: PHOTO_HEIGHT * 0.55 }]}
          />

          {/* Photo dots */}
          {allPhotos.length > 1 && (
            <View style={styles.photoDotsWrap}>
              <PhotoDots total={allPhotos.length} active={activePhoto} />
            </View>
          )}

          {/* Name + age + verified — overlaid at photo bottom */}
          <View style={styles.photoNameOverlay}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>
                {resolvedProfile.displayName}
                {resolvedProfile.age ? `, ${resolvedProfile.age}` : ""}
              </Text>
              {resolvedProfile.isVerified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                </View>
              )}
            </View>

            {/* Intent badge */}
            <View style={[styles.intentBadge, { backgroundColor: accent + "22", borderColor: accent + "55" }]}>
              <Ionicons name={intentIcon(intent)} size={13} color={accent} />
              <Text style={[styles.intentText, { color: accent }]}>{intentLabel(intent)}</Text>
              {datingGoal ? (
                <>
                  <View style={[styles.intentDivider, { backgroundColor: accent + "55" }]} />
                  <Text style={[styles.intentSub, { color: accent }]} numberOfLines={1}>{datingGoal}</Text>
                </>
              ) : null}
            </View>
          </View>
        </Animated.View>

        {/* ═══════════════════════════════════════════════════
            INFO SECTION
        ═══════════════════════════════════════════════════ */}
        <Animated.View entering={FadeInDown.duration(260)} style={styles.infoSection}>

          {/* Location */}
          {resolvedProfile.location ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.45)" />
              <Text style={styles.location}>
                {resolvedProfile.location}
                {resolvedProfile.country ? `, ${resolvedProfile.country}` : ""}
              </Text>
            </View>
          ) : null}

          {/* Info pills row: occupation, height, lifestyle */}
          {(occupation || heightVal || lifestyle || firstDate) ? (
            <View style={styles.pillsRow}>
              {occupation ? <InfoPill icon="briefcase-outline" label={occupation} /> : null}
              {heightVal  ? <InfoPill icon="body-outline"     label={heightVal}  /> : null}
              {lifestyle  ? <InfoPill icon="sunny-outline"    label={lifestyle}  /> : null}
              {firstDate  ? <InfoPill icon="cafe-outline"     label={firstDate}  accent={accent} /> : null}
            </View>
          ) : null}

          {/* Bio */}
          {resolvedProfile.bio ? (
            <View style={styles.bioSection}>
              <Text style={styles.bio}>{resolvedProfile.bio}</Text>
            </View>
          ) : null}

          {/* Intentions blurb */}
          {intentions ? (
            <View style={styles.intentionsWrap}>
              <Ionicons name="sparkles" size={14} color={accent} style={{ marginTop: 1 }} />
              <Text style={[styles.intentionsText, { color: accent }]}>{intentions}</Text>
            </View>
          ) : null}

          {/* Prompt / Answer card */}
          {promptAnswer ? (
            <View style={styles.sectionBlock}>
              <PromptCard prompt={prompt} answer={promptAnswer} />
            </View>
          ) : null}

          {/* Date ideas */}
          {dateIdeas.length > 0 ? (
            <View style={styles.sectionBlock}>
              <SectionHeading label="Date ideas" />
              <ChipRow items={dateIdeas} accent={accent} />
            </View>
          ) : null}

          {/* Interests */}
          {interests.length > 0 ? (
            <View style={styles.sectionBlock}>
              <SectionHeading label="Interests" />
              <ChipRow items={interests} />
            </View>
          ) : null}

          {/* Additional photos grid (photos 2+) */}
          {allPhotos.length > 1 ? (
            <View style={styles.sectionBlock}>
              <SectionHeading label="More photos" />
              <View style={styles.extraPhotosGrid}>
                {allPhotos.slice(1).map((uri, i) => (
                  <Image
                    key={i}
                    source={{ uri }}
                    style={styles.extraPhoto}
                    contentFit="cover"
                  />
                ))}
              </View>
            </View>
          ) : null}

        </Animated.View>
      </ScrollView>

      <ReportBlockSheet
        visible={showReport}
        targetUserId={userId ?? ""}
        targetName={resolvedProfile.displayName}
        onClose={() => setShowReport(false)}
        onBlocked={() => router.back()}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14 },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.35)" },

  backBtn: {
    position: "absolute", left: 16, zIndex: 20,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.52)",
    alignItems: "center", justifyContent: "center",
  },
  topRightCluster: {
    position: "absolute", right: 16, zIndex: 20,
    flexDirection: "row", alignItems: "center", gap: 8,
  },
  overlayBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.52)",
    alignItems: "center", justifyContent: "center",
  },

  photoPlaceholder: {
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#16161e",
  },
  photoGradient: { position: "absolute", bottom: 0, left: 0, right: 0 },
  photoDotsWrap: {
    position: "absolute", bottom: 70, left: 0, right: 0,
    alignItems: "center",
  },

  photoNameOverlay: {
    position: "absolute", bottom: 16, left: 20, right: 20,
    gap: 8,
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: {
    fontSize: 30, fontFamily: "Inter_700Bold",
    color: "#fff", letterSpacing: -0.4, flex: 1,
    textShadowColor: "rgba(0,0,0,0.60)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  verifiedBadge: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
  },
  intentBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    alignSelf: "flex-start",
    borderRadius: 999, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  intentText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  intentDivider: { width: 1, height: 12 },
  intentSub: { fontSize: 12, fontFamily: "Inter_600SemiBold", maxWidth: 150 },

  infoSection: { paddingHorizontal: 20, paddingTop: 14, gap: 16 },

  locationRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  location: { fontSize: 13, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.45)" },

  pillsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },

  bioSection: { gap: 4 },
  bio: { fontSize: 15, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.78)", lineHeight: 22 },

  intentionsWrap: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 12,
  },
  intentionsText: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold", lineHeight: 18 },

  sectionBlock: { gap: 10 },

  extraPhotosGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  extraPhoto: {
    width: (SCREEN_WIDTH - 40 - 8) / 2,
    height: (SCREEN_WIDTH - 40 - 8) / 2,
    borderRadius: 16,
    backgroundColor: "#16161e",
  },
});
