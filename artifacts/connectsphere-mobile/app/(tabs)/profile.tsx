import { useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";
// Wrap Circle so it accepts Animated values as props (JS-thread animation)
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
import { useColors } from "@/hooks/useColors";
import { useSessionState } from "@/hooks/useSessionState";
import { getInboxReactions } from "@/services/connectApi";
import { getFriendPeople } from "@/services/friendsApi";
import { getProfileCompletion, type ProfileCompletionStatus } from "@/services/launchReadyApi";
import { useGetMyProfile, useGetSavedVenues, useGetSubscriptionStatus } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";

const PINK = "#FF007F";
const HOT_PINK = "#FF4FB0";
const INK = "#050506";
const GLASS = "rgba(255,255,255,0.10)";

type ModeData = Record<string, unknown>;

// ── Animated SVG completion ring ─────────────────────────────────────────────
const RING_SIZE = 72;
const RING_STROKE = 6;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function CompletionRing({ percent, isReady }: { percent: number; isReady: boolean }) {
  const animatedValue = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: percent / 100,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [percent]);

  const strokeDashoffset = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [RING_CIRCUMFERENCE, 0],
  });

  const gradientId = "ringGrad";

  return (
    <View style={styles.ringWrap}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Defs>
          <SvgGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={isReady ? "#22C55E" : "#FF007F"} />
            <Stop offset="100%" stopColor={isReady ? "#86EFAC" : "#A855F7"} />
          </SvgGradient>
        </Defs>
        {/* Track */}
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={RING_STROKE}
          fill="none"
        />
        {/* Progress arc — AnimatedCircle lets the JS-thread Animated value
            drive strokeDashoffset, giving a smooth 900ms fill-in animation. */}
        <AnimatedCircle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke={`url(#${gradientId})`}
          strokeWidth={RING_STROKE}
          fill="none"
          strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={[styles.ringPct, isReady && { color: "#22C55E" }]}>
          {isReady ? "✓" : `${percent}%`}
        </Text>
      </View>
    </View>
  );
}

function modeDataOf(profile?: unknown) {
  const candidate = profile as { modeData?: ModeData } | undefined;
  return (candidate?.modeData ?? {}) as ModeData;
}

function normalizeIntent(intent?: string) {
  if (intent === "dating") return "dating";
  if (intent === "friendship" || intent === "networking") return "friendship";
  return "all";
}

function intentPills(profile?: { intent?: string; connectionSubtype?: string; modeData?: ModeData }) {
  if (!profile) return [];
  const modeData = modeDataOf(profile);
  const intent = normalizeIntent(profile.intent);
  const datingGoal = typeof modeData.datingGoal === "string" ? modeData.datingGoal : profile.connectionSubtype;
  const friendGoal =
    Array.isArray(modeData.friendshipTypes) && typeof modeData.friendshipTypes[0] === "string"
      ? modeData.friendshipTypes[0]
      : intent === "friendship"
        ? profile.connectionSubtype
        : undefined;

  if (intent === "all") {
    return [
      datingGoal ? { label: `Dating - ${datingGoal}`, icon: "flame" as const, color: PINK } : null,
      friendGoal ? { label: `Friends - ${friendGoal}`, icon: "people" as const, color: "#38BDF8" } : null,
    ].filter((item): item is { label: string; icon: "flame" | "people"; color: string } => Boolean(item));
  }

  if (intent === "dating") {
    return [{ label: `Dating${datingGoal ? ` - ${datingGoal}` : ""}`, icon: "flame" as const, color: PINK }];
  }

  return [{ label: `Friends${friendGoal ? ` - ${friendGoal}` : ""}`, icon: "people" as const, color: "#38BDF8" }];
}

function numberFromMode(modeData: ModeData, key: string) {
  return typeof modeData[key] === "number" ? (modeData[key] as number) : 0;
}

function formatCount(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  return String(value);
}

export default function ProfileScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { user, isSignedIn } = useUser();
  const { userId } = useSessionState();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [updatingPhoto, setUpdatingPhoto] = useState(false);

  const handleShareProfile = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const handle = profileExtras?.username ?? userId ?? user?.id ?? "";
    const url = `https://connectsphere.app/u/${handle}`;
    try {
      await Share.share({
        message: `Check out my ConnectSphere profile 🔗\n\n${url}`,
        url,
      });
    } catch {
      // User cancelled
    }
  };
  const [socialStats, setSocialStats] = useState({ likes: 0, friends: 0 });
  const [profileViewCount, setProfileViewCount] = useState<number | null>(null);
  const [completion, setCompletion] = useState<ProfileCompletionStatus | null>(null);
  const completionAnim = useMemo(() => new Animated.Value(0), []);

  const { data: profile, isLoading, refetch } = useGetMyProfile({ query: { enabled: !!isSignedIn, refetchOnMount: "always" } });
  const { data: subscription } = useGetSubscriptionStatus({ query: { enabled: !!isSignedIn } });
  const { data: savedVenuesData } = useGetSavedVenues({ query: { enabled: !!isSignedIn } });

  const savedVenueCount = savedVenuesData?.placeIds?.length ?? 0;
  const profileExtras = profile as (NonNullable<typeof profile> & { username?: string; modeData?: ModeData }) | undefined;
  const modeData = modeDataOf(profileExtras);
  const profileIntentPills = intentPills(profileExtras);
  const reactionCount = numberFromMode(modeData, "reactionCount");
  const username = profileExtras?.username ? `@${profileExtras.username}` : "@username";
  const county = typeof modeData.county === "string" ? modeData.county : undefined;
  const heroPhoto = profile?.photos?.[0] || (user?.hasImage ? user?.imageUrl : undefined);
  const displayName = profile?.displayName ?? user?.firstName ?? "Your Name";
  const displayNameWithAge = `${displayName}${profile?.age ? `, ${profile.age}` : ""}`;
  const locationLabel = profile?.location
    ? `${profile.location}${county ? `, ${county}` : profile.country ? `, ${profile.country}` : ""}`
    : "Set your location";
  const cardMinHeight = Math.max(650, height - insets.top - 92);
  const missingPhotos = Math.max(0, (completion?.requiredPhotoCount ?? 3) - (completion?.photoCount ?? profile?.photos?.length ?? 0));

  const statItems = useMemo(
    () => [
      { label: "Likes", value: formatCount(socialStats.likes) },
      { label: "Reactions", value: formatCount(reactionCount) },
      { label: "Friends", value: formatCount(socialStats.friends) },
    ],
    [reactionCount, socialStats.friends, socialStats.likes],
  );

  useEffect(() => {
    if (!isSignedIn) {
      setSocialStats({ likes: 0, friends: 0 });
      return;
    }

    let mounted = true;
    if (!userId) return;
    Promise.allSettled([getInboxReactions(userId), getFriendPeople(userId)]).then(([reactionResult, friendResult]) => {
      if (!mounted) return;
      const likes = reactionResult.status === "fulfilled" ? reactionResult.value.counts?.total ?? 0 : 0;
      const friends =
        friendResult.status === "fulfilled"
          ? (friendResult.value.people ?? []).filter((person) => person.relationshipStatus === "friends").length
          : 0;
      setSocialStats({ likes, friends });
    });

    // Load profile view count from Firestore
    void (async () => {
      try {
        const { getFirestore, collection, getCountFromServer } = await import("firebase/firestore");
        const { getApp } = await import("firebase/app");
        const db = getFirestore(getApp());
        const snap = await getCountFromServer(collection(db, "profileViews", userId, "visitors"));
        if (mounted) setProfileViewCount(snap.data().count);
      } catch {
        // Non-critical — silently ignore
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isSignedIn, userId]);

  useEffect(() => {
    if (!isSignedIn) return;
    let mounted = true;
    getProfileCompletion()
      .then((result) => {
        if (!mounted) return;
        setCompletion(result);
        Animated.spring(completionAnim, {
          toValue: result.percent / 100,
          stiffness: 90,
          damping: 16,
          useNativeDriver: false,
        }).start();
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [completionAnim, isSignedIn, profile?.updatedAt]);

  // If profile has no photos stored but Clerk has a real user-uploaded image,
  // silently patch photos[0] with the Clerk imageUrl.
  useEffect(() => {
    if (!profile || !user?.imageUrl || !user?.hasImage || !user?.id) return;
    if ((profile.photos as string[] | undefined)?.length) return;
    import("firebase/firestore").then(({ getFirestore, doc, setDoc, serverTimestamp }) =>
      import("firebase/app").then(({ getApp }) => {
        const db = getFirestore(getApp());
        return setDoc(doc(db, "profiles", user.id), { photos: [user.imageUrl], updatedAt: serverTimestamp() }, { merge: true });
      })
    ).then(() => refetch()).catch(() => {});
  }, [profile, refetch, user?.hasImage, user?.imageUrl, user?.id]);

  async function updateProfilePhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Please allow photo library access in your device Settings.");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
      base64: true,
    });
    if (picked.canceled || !picked.assets?.[0]) return;
    const uri = picked.assets[0].uri;
    const pickerBase64 = picked.assets[0].base64 ?? null;
    setUpdatingPhoto(true);
    try {
      let base64: string;
      if (pickerBase64) {
        base64 = pickerBase64;
      } else if (Platform.OS === "web") {
        const imgRes = await fetch(uri);
        const blob = await imgRes.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        base64 = btoa(binary);
      } else {
        base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
      }

      // Upload directly to Firebase Storage
      const { getStorage: _gs, ref: _ref, uploadBytes: _ub, getDownloadURL: _gdl } = await import("firebase/storage");
      const { getApp: _ga } = await import("firebase/app");
      const _storage = _gs(_ga());
      const _fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
      const _photoRef = _ref(_storage, `photos/${user?.id ?? "unknown"}/${_fileName}`);
      const _binary = atob(base64);
      const _bytes = new Uint8Array(_binary.length);
      for (let i = 0; i < _binary.length; i++) _bytes[i] = _binary.charCodeAt(i);
      await _ub(_photoRef, _bytes, { contentType: "image/jpeg" });
      const photoUrl = await _gdl(_photoRef);
      // Patch Firestore profile directly
      const { getFirestore: _fs, doc: _doc, getDoc: _gd, setDoc: _sd, serverTimestamp: _st } = await import("firebase/firestore");
      const _db = _fs(_ga());
      const _profileSnap = await _gd(_doc(_db, "profiles", user!.id));
      const _existingPhotos: string[] = (_profileSnap.data()?.photos as string[] | undefined) ?? [];
      const _newPhotos = [..._existingPhotos, photoUrl];
      await _sd(_doc(_db, "profiles", user!.id), { photos: _newPhotos, updatedAt: _st() }, { merge: true });
      try {
        try {
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const blob = new Blob([bytes], { type: "image/jpeg" });
          await user?.setProfileImage({ file: blob as File });
          await user?.reload();
        } catch (_) {}
        await refetch();
      } catch {
        Alert.alert("Error", "Photo uploaded but profile was not updated. Please try again.");
      }
    } catch (e) {
      Alert.alert("Error", "Something went wrong uploading your photo. Please try again.");
    } finally {
      setUpdatingPhoto(false);
    }
  }

  if (!isSignedIn) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Ionicons name="person-circle-outline" size={64} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t("profile.notSignedIn")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={PINK} size="large" />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 104 }]}
        >
          <View style={[styles.phoneCard, { minHeight: cardMinHeight }]}>
            <Pressable onPress={updateProfilePhoto} disabled={updatingPhoto} style={StyleSheet.absoluteFill}>
              {heroPhoto ? (
                <Image source={{ uri: heroPhoto }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <LinearGradient colors={["#1F1F24", "#09090B", "#000000"]} style={[StyleSheet.absoluteFill, styles.emptyHero]}>
                  {updatingPhoto ? (
                    <ActivityIndicator color="#fff" size="large" />
                  ) : (
                    <>
                      <Ionicons name="camera" size={42} color={PINK} />
                      <Text style={styles.emptyHeroText}>Add profile photo</Text>
                    </>
                  )}
                </LinearGradient>
              )}
              <LinearGradient
                colors={["rgba(0,0,0,0.10)", "rgba(0,0,0,0.25)", "rgba(0,0,0,0.94)"]}
                locations={[0, 0.48, 1]}
                style={StyleSheet.absoluteFill}
              />
            </Pressable>

            <View style={[styles.topControls, { top: 14 }]}>
              <Pressable onPress={updateProfilePhoto} disabled={updatingPhoto} style={styles.miniAvatarButton}>
                {heroPhoto ? (
                  <Image source={{ uri: heroPhoto }} style={styles.miniAvatar} contentFit="cover" />
                ) : (
                  <Ionicons name="camera" size={16} color="#fff" />
                )}
                {updatingPhoto ? <ActivityIndicator color="#fff" size={10} style={styles.miniLoader} /> : null}
              </Pressable>
              <View style={styles.topControlsRight}>
                <Pressable onPress={() => void handleShareProfile()} style={styles.shareIconBtn} hitSlop={8}>
                  <Ionicons name="share-outline" size={18} color="#fff" />
                </Pressable>
                <Pressable onPress={() => router.push("/settings" as any)} style={styles.editPill} testID="settings-btn">
                  <Text style={styles.editPillText}>Edit Profile</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.profileContent}>
              <View style={styles.nameRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.displayName} numberOfLines={2}>{displayNameWithAge}</Text>
                  <Text style={styles.usernameText} numberOfLines={1}>{username}</Text>
                </View>
                <View style={styles.sideBadges}>
                  {subscription?.isPremium ? (
                    <LinearGradient colors={[PINK, HOT_PINK]} style={styles.iconBadge}>
                      <Ionicons name="star" size={17} color="#fff" />
                    </LinearGradient>
                  ) : null}
                  <View style={styles.iconBadgeMuted}>
                    <Ionicons name={profile?.isVerified ? "shield-checkmark" : "shield-outline"} size={17} color="#fff" />
                  </View>
                </View>
              </View>

              {completion ? (
                <Pressable
                  onPress={() => router.push("/settings" as never)}
                  style={[styles.completionCard, completion.isLaunchReady ? styles.completionReady : styles.completionIncomplete]}
                >
                  {/* Animated SVG ring */}
                  <CompletionRing percent={completion.percent} isReady={completion.isLaunchReady} />

                  {/* Text + actions */}
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={styles.completionTitle}>
                      {completion.isLaunchReady ? "Profile complete 🎉" : `${completion.percent}% complete`}
                    </Text>
                    <Text style={styles.completionSub} numberOfLines={2}>
                      {completion.isLaunchReady
                        ? "Your card is live and showing in Discover."
                        : missingPhotos > 0
                          ? `Add ${missingPhotos} more ${missingPhotos === 1 ? "photo" : "photos"} to rank higher.`
                          : completion.softNudges[0] ?? "Finish your profile to get seen."}
                    </Text>
                    <View style={styles.completionActions}>
                      {missingPhotos > 0 ? (
                        <Pressable onPress={updateProfilePhoto} disabled={updatingPhoto} style={styles.completionPrimary}>
                          <Ionicons name="images" size={13} color="#111" />
                          <Text style={styles.completionPrimaryText}>Add photos</Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        disabled={!userId && !user?.id}
                        onPress={() => {
                          const uid = userId ?? user?.id;
                          if (!uid) return;
                          router.push({ pathname: "/user/[userId]", params: { userId: uid } } as never);
                        }}
                        style={[styles.completionGhost, !userId && !user?.id ? { opacity: 0.4 } : null]}
                      >
                        <Ionicons name="eye" size={13} color="#fff" />
                        <Text style={styles.completionGhostText}>Preview</Text>
                      </Pressable>
                    </View>
                  </View>
                </Pressable>
              ) : null}

              <Text style={styles.bio} numberOfLines={3}>
                {profile?.bio || "Design your profile, show your energy, and let the right people find you."}
              </Text>

              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.72)" />
                <Text style={styles.locationText} numberOfLines={1}>{locationLabel}</Text>
              </View>

              <View style={styles.statsRow}>
                {statItems.map((item) => (
                  <View key={item.label} style={styles.statBlock}>
                    <Text style={styles.statNumber}>{item.value}</Text>
                    <Text style={styles.statLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>

              {/* Profile views row — tappable, links to profile-views screen */}
              {profileViewCount !== null && profileViewCount > 0 ? (
                <Pressable
                  onPress={() => {
                    void Haptics.selectionAsync();
                    router.push("/profile-views" as any);
                  }}
                  style={({ pressed }) => [styles.viewsRow, { opacity: pressed ? 0.75 : 1 }]}
                >
                  <Ionicons name="eye-outline" size={16} color={PINK} />
                  <Text style={styles.viewsText}>
                    {profileViewCount} {profileViewCount === 1 ? "person" : "people"} viewed your profile
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.4)" />
                </Pressable>
              ) : null}

              <View style={styles.intentRow}>
                {profileIntentPills.map((pill) => (
                  <View key={pill.label} style={[styles.intentBadge, { borderColor: pill.color + "66", backgroundColor: pill.color + "22" }]}>
                    <Ionicons name={pill.icon} size={13} color={pill.color} />
                    <Text style={[styles.intentText, { color: pill.color }]} numberOfLines={1}>{pill.label}</Text>
                  </View>
                ))}
                {savedVenueCount > 0 ? (
                  <View style={[styles.intentBadge, { borderColor: HOT_PINK + "66", backgroundColor: HOT_PINK + "22" }]}>
                    <Ionicons name="bookmark" size={13} color={HOT_PINK} />
                    <Text style={[styles.intentText, { color: HOT_PINK }]} numberOfLines={1}>
                      {savedVenueCount} Saved {savedVenueCount === 1 ? "Spot" : "Spots"}
                    </Text>
                  </View>
                ) : null}
                {profile?.isVerified ? (
                  <View style={[styles.intentBadge, { borderColor: "#60A5FA66", backgroundColor: "#60A5FA22" }]}>
                    <Ionicons name="checkmark-circle" size={13} color="#60A5FA" />
                    <Text style={[styles.intentText, { color: "#60A5FA" }]}>{t("profile.verified", "Verified")}</Text>
                  </View>
                ) : null}
              </View>

              {(profile?.photos?.length ?? 0) > 1 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoStrip}>
                  {profile?.photos?.slice(1, 6).map((photo, index) => (
                    <Image key={`${photo}-${index}`} source={{ uri: photo }} style={styles.photoThumb} contentFit="cover" />
                  ))}
                </ScrollView>
              ) : null}

              <Pressable onPress={() => router.push("/settings" as any)} style={({ pressed }) => [styles.ctaOuter, { opacity: pressed ? 0.88 : 1 }]}>
                <LinearGradient colors={["#7DD3FC", "#FDE047", HOT_PINK, "#A855F7"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cta}>
                  <Text style={styles.ctaText}>Edit Profile</Text>
                  <Ionicons name="create" size={18} color="#111" />
                </LinearGradient>
              </Pressable>

              {/* Invite Friends row — links to Referral screen */}
              <Pressable
                onPress={() => router.push("/referral" as any)}
                style={({ pressed }) => [styles.referralRow, { opacity: pressed ? 0.82 : 1 }]}
              >
                <LinearGradient
                  colors={["rgba(236,72,153,0.18)", "rgba(168,85,247,0.18)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.referralGrad}
                >
                  <View style={styles.referralLeft}>
                    <Text style={styles.referralEmoji}>🎁</Text>
                    <View>
                      <Text style={styles.referralTitle}>Invite Friends</Text>
                      <Text style={styles.referralSub}>Get 7 days free Premium per 3 friends</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.5)" />
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: "#000" },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_600SemiBold" },
  scrollContent: { paddingHorizontal: 14 },
  phoneCard: {
    width: "100%",
    borderRadius: 34,
    overflow: "hidden",
    backgroundColor: INK,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  emptyHero: { alignItems: "center", justifyContent: "center", gap: 10 },
  emptyHeroText: { color: "#fff", fontSize: 14, fontFamily: "Inter_800ExtraBold", textTransform: "uppercase", letterSpacing: 0.8 },
  topControls: {
    position: "absolute",
    left: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 10,
  },
  miniAvatarButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.48)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    overflow: "hidden",
  },
  miniAvatar: { width: "100%", height: "100%" },
  miniLoader: { position: "absolute" },
  topControlsRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  shareIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.68)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
  },
  editPill: {
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.68)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
  },
  editPillText: { color: "#fff", fontSize: 11, fontFamily: "Inter_800ExtraBold" },
  viewsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(255,0,127,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,0,127,0.25)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  viewsText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#FF007F",
    flex: 1,
  },
  referralRow: { borderRadius: 18, overflow: "hidden" },
  referralGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(236,72,153,0.30)",
  },
  referralLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  referralEmoji: { fontSize: 26 },
  referralTitle: { color: "#fff", fontSize: 14, fontFamily: "Inter_800ExtraBold" },
  referralSub: { color: "rgba(255,255,255,0.6)", fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },
  profileContent: { marginTop: "auto", paddingHorizontal: 18, paddingBottom: 22, gap: 12 },
  nameRow: { flexDirection: "row", alignItems: "flex-end", gap: 12 },
  displayName: { color: "#fff", fontSize: 40, lineHeight: 42, fontFamily: "Inter_800ExtraBold", letterSpacing: 0 },
  usernameText: { color: "rgba(255,255,255,0.72)", fontSize: 13, fontFamily: "Inter_700Bold", marginTop: 3 },
  sideBadges: { flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 4 },
  iconBadge: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  iconBadgeMuted: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: GLASS, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  completionCard: {
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  completionIncomplete: { backgroundColor: "rgba(255,45,168,0.14)", borderColor: "rgba(255,45,168,0.35)" },
  completionReady: { backgroundColor: "rgba(52,211,153,0.14)", borderColor: "rgba(52,211,153,0.35)" },
  // ring
  ringWrap: { width: 72, height: 72, alignItems: "center", justifyContent: "center" },
  ringCenter: { position: "absolute", alignItems: "center", justifyContent: "center" },
  ringPct: { color: "#fff", fontSize: 14, fontFamily: "Inter_900Black", fontVariant: ["tabular-nums"] },
  // text side
  completionTitle: { color: "#fff", fontSize: 15, fontFamily: "Inter_900Black" },
  completionSub: { color: "rgba(255,255,255,0.75)", fontSize: 12, lineHeight: 17, fontFamily: "Inter_600SemiBold" },
  completionActions: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 2 },
  completionPrimary: {
    height: 34,
    borderRadius: 999,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#fff",
  },
  completionPrimaryText: { color: "#111", fontSize: 12, fontFamily: "Inter_900Black" },
  completionGhost: {
    height: 34,
    borderRadius: 999,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  completionGhostText: { color: "#fff", fontSize: 12, fontFamily: "Inter_900Black" },
  // legacy stubs — kept to avoid ref errors, visually inert
  completionTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  completionBadge: { width: 0, height: 0, overflow: "hidden" },
  completionBadgeText: { fontSize: 0 },
  completionBadgeSub: { fontSize: 0 },
  progressTrack: { height: 0, overflow: "hidden" },
  progressFill: { height: 0 },
  bio: { color: "rgba(255,255,255,0.80)", fontSize: 13, lineHeight: 18, fontFamily: "Inter_500Medium" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  locationText: { color: "rgba(255,255,255,0.68)", fontSize: 12, fontFamily: "Inter_700Bold", flex: 1 },
  statsRow: { flexDirection: "row", gap: 8 },
  statBlock: {
    flex: 1,
    minHeight: 58,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.36)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  statNumber: { color: "#fff", fontSize: 17, fontFamily: "Inter_800ExtraBold", fontVariant: ["tabular-nums"] },
  statLabel: { color: "rgba(255,255,255,0.58)", fontSize: 10, fontFamily: "Inter_800ExtraBold", textTransform: "uppercase", letterSpacing: 0.8 },
  intentRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  intentBadge: { maxWidth: "100%", flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  intentText: { fontSize: 11, fontFamily: "Inter_800ExtraBold" },
  photoStrip: { gap: 8, paddingVertical: 2 },
  photoThumb: { width: 70, height: 70, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" },
  ctaOuter: { marginTop: 2 },
  cta: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  ctaText: { color: "#111", fontSize: 15, fontFamily: "Inter_900Black" },
});
