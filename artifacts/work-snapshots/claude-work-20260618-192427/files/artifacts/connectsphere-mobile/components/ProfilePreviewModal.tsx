/**
 * ProfilePreviewModal — "See your profile as others see it"
 *
 * Opens a full-screen view of your own profile using the same SwipeCard
 * layout, so you see exactly what potential matches see.
 *
 * Usage:
 *   <ProfilePreviewModal
 *     visible={showPreview}
 *     profile={myProfile}
 *     onClose={() => setShowPreview(false)}
 *   />
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState } from "react";

import { BRAND, INTENT_THEME, NEUTRAL, RADIUS, SPACE, TYPE } from "@/constants/tokens";

type PreviewProfile = {
  displayName: string;
  age?: number | null;
  bio?: string | null;
  location?: string | null;
  country?: string | null;
  intent?: string;
  connectionSubtype?: string | null;
  interests?: string[] | null;
  photos?: string[] | null;
  isVerified?: boolean;
  isPremium?: boolean;
};

type Props = {
  visible: boolean;
  profile: PreviewProfile;
  onClose: () => void;
};

function PhotoDots({ total, active }: { total: number; active: number }) {
  if (total <= 1) return null;
  return (
    <View style={styles.photoDots}>
      {Array.from({ length: Math.min(total, 6) }, (_, i) => (
        <View
          key={i}
          style={[
            styles.photoDot,
            i === active && { backgroundColor: BRAND.pink },
          ]}
        />
      ))}
    </View>
  );
}

export function ProfilePreviewModal({ visible, profile, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [photoIndex, setPhotoIndex] = useState(0);

  const photos = profile.photos ?? [];
  const photoCount = photos.length;
  const currentPhoto = photoCount > 0 ? photos[Math.min(photoIndex, photoCount - 1)] : null;
  const theme = profile.intent === "friendship" ? INTENT_THEME.friendship : INTENT_THEME.dating;
  const nameStr = `${profile.displayName}${profile.age ? `, ${profile.age}` : ""}`;
  const locationText = [profile.location, profile.country].filter(Boolean).join(", ");

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View
        entering={FadeIn.duration(180)}
        exiting={FadeOut.duration(150)}
        style={styles.overlay}
      >
        <Animated.View
          entering={SlideInDown.springify().damping(22).stiffness(260)}
          exiting={SlideOutDown.duration(280)}
          style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}
        >
          {/* Header */}
          <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
            <View style={styles.previewBadge}>
              <Ionicons name="eye-outline" size={13} color={BRAND.pink} />
              <Text style={styles.previewBadgeText}>Preview — how others see you</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
              <Ionicons name="close" size={22} color={NEUTRAL.text} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Photo */}
            <View style={styles.photoCard}>
              {currentPhoto ? (
                <Image source={{ uri: currentPhoto }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <LinearGradient colors={["#111", "#3a0426", "#000"]} style={StyleSheet.absoluteFill}>
                  <View style={styles.initialsCenter}>
                    <Text style={styles.initialsText}>
                      {profile.displayName.slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                </LinearGradient>
              )}

              {/* Tap to flip photos */}
              {photoCount > 1 && (
                <View style={styles.tapRow} pointerEvents="box-none">
                  <Pressable
                    onPress={() => setPhotoIndex((c) => (c === 0 ? photoCount - 1 : c - 1))}
                    style={styles.tapZone}
                  />
                  <Pressable
                    onPress={() => setPhotoIndex((c) => (c + 1) % photoCount)}
                    style={styles.tapZone}
                  />
                </View>
              )}

              <PhotoDots total={photoCount} active={photoIndex} />

              {/* Dark gradient */}
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.85)"]}
                style={styles.photoGradient}
                pointerEvents="none"
              />

              {/* Name on photo */}
              <View style={styles.photoInfo} pointerEvents="none">
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{nameStr}</Text>
                  {profile.isVerified && (
                    <View style={[styles.verifiedBadge, { backgroundColor: theme.accent }]}>
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    </View>
                  )}
                </View>
                {!!locationText && (
                  <View style={styles.locRow}>
                    <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.75)" />
                    <Text style={styles.locText}>{locationText}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Info section */}
            <View style={styles.infoSection}>
              {/* Intent */}
              <View style={styles.intentRow}>
                <Ionicons name={theme.icon} size={15} color={theme.accent} />
                <Text style={[styles.intentText, { color: theme.accent }]}>
                  {profile.connectionSubtype
                    ? `Looking for: ${profile.connectionSubtype}`
                    : theme.label}
                </Text>
              </View>

              {/* Bio */}
              {!!profile.bio && (
                <View style={styles.bioSection}>
                  <Text style={styles.sectionLabel}>About</Text>
                  <Text style={styles.bio}>{profile.bio}</Text>
                </View>
              )}

              {/* Interests */}
              {(profile.interests?.length ?? 0) > 0 && (
                <View style={styles.interestsSection}>
                  <Text style={styles.sectionLabel}>Interests</Text>
                  <View style={styles.tags}>
                    {profile.interests!.map((tag) => (
                      <View key={tag} style={[styles.tag, { borderColor: theme.accentSoft }]}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Tips */}
              <View style={styles.tipsCard}>
                <Ionicons name="bulb-outline" size={16} color={BRAND.gold} />
                <Text style={styles.tipsText}>
                  Profiles with 3+ photos and a bio get up to 6× more matches.
                </Text>
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const PHOTO_HEIGHT = 480;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
  },
  sheet: {
    flex: 1,
    backgroundColor: "#050506",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACE.lg,
    paddingBottom: SPACE.sm,
  },
  previewBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,45,168,0.12)",
    borderRadius: RADIUS.pill,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255,45,168,0.22)",
  },
  previewBadgeText: {
    color: BRAND.pink,
    ...TYPE.captionBold,
  },
  closeBtn: {
    padding: SPACE.sm,
  },
  photoCard: {
    height: PHOTO_HEIGHT,
    marginHorizontal: SPACE.lg,
    borderRadius: RADIUS.card,
    overflow: "hidden",
    backgroundColor: "#111",
  },
  tapRow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "60%",
    flexDirection: "row",
    zIndex: 3,
  },
  tapZone: { flex: 1 },
  photoDots: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    flexDirection: "row",
    gap: 5,
    zIndex: 4,
  },
  photoDot: {
    flex: 1,
    height: 3,
    borderRadius: RADIUS.pill,
    backgroundColor: "rgba(255,255,255,0.32)",
  },
  photoGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 180,
    zIndex: 2,
  },
  photoInfo: {
    position: "absolute",
    bottom: SPACE.lg,
    left: SPACE.lg,
    right: SPACE.lg,
    zIndex: 5,
    gap: 5,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  name: {
    color: NEUTRAL.text,
    fontSize: 28,
    lineHeight: 32,
    fontFamily: "Inter_700Bold",
    flex: 1,
  },
  verifiedBadge: {
    width: 20,
    height: 20,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.8)",
  },
  locRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locText: {
    color: "rgba(255,255,255,0.75)",
    ...TYPE.label,
  },
  initialsCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  initialsText: {
    color: NEUTRAL.text,
    fontSize: 56,
    fontFamily: "Inter_700Bold",
  },
  infoSection: {
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.lg,
    gap: SPACE.lg,
  },
  intentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: RADIUS.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  intentText: {
    ...TYPE.labelBold,
  },
  bioSection: { gap: 5 },
  sectionLabel: {
    color: NEUTRAL.textMuted,
    ...TYPE.captionBold,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  bio: {
    color: NEUTRAL.text,
    ...TYPE.body,
    lineHeight: 22,
  },
  interestsSection: { gap: 8 },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  tag: {
    borderRadius: RADIUS.pill,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tagText: {
    color: NEUTRAL.text,
    ...TYPE.captionBold,
  },
  tipsCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACE.sm,
    backgroundColor: "rgba(251,191,36,0.08)",
    borderRadius: RADIUS.lg,
    padding: SPACE.md,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.18)",
    marginBottom: SPACE.lg,
  },
  tipsText: {
    color: "rgba(251,191,36,0.9)",
    ...TYPE.label,
    flex: 1,
    lineHeight: 19,
  },
});
