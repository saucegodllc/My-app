/**
 * SwipeCard — rebuilt on the UI thread.
 *
 * Stack:
 *   • react-native-gesture-handler  — GestureDetector / Gesture.Pan (UI thread)
 *   • react-native-reanimated v3    — useSharedValue / useAnimatedStyle (UI thread)
 *
 * Key upgrades vs old PanResponder version:
 *   ✓ All transforms run on the native/UI thread (no JS-thread jank)
 *   ✓ Velocity-aware throw — fast flick = instant; slow drag = smooth arc
 *   ✓ Spring wobble on snap-back (feels alive)
 *   ✓ stackIndex prop drives visual depth (scale + translateY) for cards 2 & 3
 *   ✓ Photo tap zones with white-flash micro-animation on change
 *   ✓ Stamp opacity driven by shared values (no interpolate on JS thread)
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { BRAND, INTENT_THEME, NEUTRAL, RADIUS, SHADOW, SPACE, SPRING, SWIPE, TYPE } from "@/constants/tokens";
import { useColors } from "@/hooks/useColors";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - SPACE.lg * 2;
// Fixed height matching the friends feedCard visual footprint (~400px image + info).
// Avoids the full-screen towering look and keeps dating + friends cards proportional.
const CARD_HEIGHT = Math.min(480, SCREEN_HEIGHT * 0.60);
const SWIPE_THRESHOLD = SCREEN_WIDTH * SWIPE.distanceThreshold;
const V_THRESHOLD = SWIPE.velocityThreshold;

// Stack visual offsets per z-level — card behind gets smaller and pushes down
const STACK_OFFSETS = [
  { scale: 1.0,  translateY: 0,  opacity: 1    }, // top
  { scale: 0.96, translateY: 10, opacity: 1    }, // 2nd
  { scale: 0.92, translateY: 18, opacity: 0.85 }, // 3rd
];

// ── Types ─────────────────────────────────────────────────────────────────────
export type Profile = {
  id: string;
  userId: string;
  displayName: string;
  bio?: string | null;
  age?: number | null;
  location?: string | null;
  country?: string | null;
  intent: string;
  connectionSubtype?: string | null;
  role?: string | null;
  profession?: string | null;
  interests?: string[] | null;
  photos?: string[] | null;
  isPremium: boolean;
  isVerified: boolean;
  isOnline?: boolean;
  /** Real compatibility score from API, 0-100 */
  compatibilityPct?: number | null;
};

type Props = {
  profile: Profile;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onSwipeUp: () => void;
  onOpenProfile: () => void;
  /** 0 = top card (interactive), 1 = second, 2 = third */
  stackIndex: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function getInitials(name = "User") {
  return name.split(" ").map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase();
}

/**
 * Returns a two-stop gradient pair for the Vibe score pill.
 * Pink  ≥ 80  — strong romantic / social match
 * Gold  ≥ 60  — solid compatibility
 * Grey  <  60 — low signal / show but de-emphasise
 */
function getVibeColors(score: number): [string, string] {
  if (score >= 80) return ["#F472B6", "#BE185D"];
  if (score >= 60) return ["#FBBF24", "#B45309"];
  return ["#71717A", "#52525B"];
}

// ── Component ─────────────────────────────────────────────────────────────────
export function SwipeCard({
  profile,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onOpenProfile,
  stackIndex,
}: Props) {
  const colors = useColors();
  const isTop = stackIndex === 0;
  const stackOffset = STACK_OFFSETS[Math.min(stackIndex, 2)];
  const theme = profile.intent === "friendship" ? INTENT_THEME.friendship : INTENT_THEME.dating;

  // Shared values live on UI thread — zero JS bridge overhead
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const photoFlash = useSharedValue(0);
  // Drives the spring-in animation of the Vibe pill on each new card
  const scoreAnim = useSharedValue(0);

  const [photoIndex, setPhotoIndex] = useState(0);
  useEffect(() => { setPhotoIndex(0); }, [profile.id]);
  useEffect(() => {
    // Reset then spring-in so the pill pops into view on every card change
    scoreAnim.value = 0;
    scoreAnim.value = withSpring(1, { damping: 14, stiffness: 180 });
  // scoreAnim is a stable SharedValue ref — safe to omit from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  // ── Gesture ────────────────────────────────────────────────────────────────
  const pan = Gesture.Pan()
    .enabled(isTop)
    .onUpdate((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY;
    })
    .onEnd((e) => {
      const swipedRight = e.translationX > SWIPE_THRESHOLD || e.velocityX > V_THRESHOLD;
      const swipedLeft  = e.translationX < -SWIPE_THRESHOLD || e.velocityX < -V_THRESHOLD;
      const swipedUp    = e.translationY < -SWIPE_THRESHOLD || e.velocityY < -V_THRESHOLD;

      if (swipedRight) {
        // Fast flick = shorter duration; velocity scales the exit speed
        const dur = Math.max(140, SWIPE.flyDuration - Math.abs(e.velocityX) * 0.1);
        tx.value = withTiming(SCREEN_WIDTH * 1.65, { duration: dur }, () => runOnJS(onSwipeRight)());
        ty.value = withTiming(e.translationY * 1.3, { duration: dur });
      } else if (swipedLeft) {
        const dur = Math.max(140, SWIPE.flyDuration - Math.abs(e.velocityX) * 0.1);
        tx.value = withTiming(-SCREEN_WIDTH * 1.65, { duration: dur }, () => runOnJS(onSwipeLeft)());
        ty.value = withTiming(e.translationY * 1.3, { duration: dur });
      } else if (swipedUp) {
        const dur = Math.max(140, SWIPE.flyDuration - Math.abs(e.velocityY) * 0.1);
        ty.value = withTiming(-SCREEN_HEIGHT * 1.3, { duration: dur }, () => runOnJS(onSwipeUp)());
      } else {
        // Personality wobble on snap-back — overshoot then settle
        tx.value = withSequence(
          withSpring(e.translationX * 0.25, { ...SPRING.bouncy, velocity: e.velocityX * 0.3 }),
          withSpring(0, SPRING.gentle)
        );
        ty.value = withSpring(0, SPRING.gentle);
      }
    });

  // ── Animated styles — all worklets, UI thread only ────────────────────────
  const cardStyle = useAnimatedStyle(() => {
    if (!isTop) {
      return {
        transform: [
          { scale: stackOffset.scale },
          { translateY: stackOffset.translateY },
        ],
        opacity: stackOffset.opacity,
      };
    }
    const rotate = interpolate(
      tx.value,
      [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
      [-SWIPE.rotationRange, 0, SWIPE.rotationRange],
      Extrapolation.CLAMP
    );
    return {
      transform: [
        { translateX: tx.value },
        { translateY: ty.value },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  const likeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [20, 100], [0, 1], Extrapolation.CLAMP),
  }));
  const nopeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [-100, -20], [1, 0], Extrapolation.CLAMP),
  }));
  const superStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ty.value, [-100, -40], [1, 0], Extrapolation.CLAMP),
  }));
  const flashStyle = useAnimatedStyle(() => ({
    opacity: photoFlash.value,
  }));
  // Vibe pill entrance — scale + opacity spring from 0 → 1
  const vibePillStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scoreAnim.value }],
    opacity: scoreAnim.value,
  }));

  // ── Photo tap ──────────────────────────────────────────────────────────────
  const photoCount = profile.photos?.length ?? 0;
  const photoUrl = photoCount > 0 ? profile.photos?.[Math.min(photoIndex, photoCount - 1)] : undefined;

  function flashAndSet(updater: (i: number) => number) {
    photoFlash.value = withSequence(
      withTiming(0.22, { duration: 55 }),
      withTiming(0, { duration: 90 })
    );
    setPhotoIndex(updater);
  }

  const tapLeft  = () => photoCount > 1 && flashAndSet((c) => (c === 0 ? photoCount - 1 : c - 1));
  const tapRight = () => photoCount > 1 && flashAndSet((c) => (c + 1) % photoCount);

  // ── Display values ─────────────────────────────────────────────────────────
  const locationText = [profile.location, profile.country].filter(Boolean).join(", ");
  const nameStr = `${profile.displayName}${profile.age ? `, ${profile.age}` : ""}`;
  const intentLine = profile.connectionSubtype
    ? `Looking for: ${profile.connectionSubtype}`
    : theme.label;

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          styles.card,
          { borderColor: theme.accentSoft },
          cardStyle,
        ]}
      >
        {/* Photo or initials placeholder */}
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <LinearGradient colors={["#111111", "#3a0426", "#000000"]} style={StyleSheet.absoluteFill}>
            <View style={styles.initCenter}>
              <View style={styles.initBubble}>
                <Text style={styles.initText}>{getInitials(profile.displayName)}</Text>
              </View>
            </View>
          </LinearGradient>
        )}

        {/* Tap flash overlay */}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.flashOverlay, flashStyle]}
        />

        {/* Dark gradient for text readability */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.12)", "rgba(0,0,0,0.97)"]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Photo progress bar */}
        {photoCount > 1 && (
          <View style={styles.progressRow} pointerEvents="none">
            {profile.photos!.slice(0, 6).map((_, i) => (
              <View
                key={`${profile.id}-p${i}`}
                style={[
                  styles.progressDot,
                  i === photoIndex && { backgroundColor: theme.accent },
                ]}
              />
            ))}
          </View>
        )}

        {/* Left / right photo tap zones */}
        <View style={styles.tapRow} pointerEvents="box-none">
          <Pressable onPress={tapLeft} style={styles.tapZone} />
          <Pressable onPress={tapRight} style={styles.tapZone} />
        </View>

        {/* Top meta pills */}
        <View style={styles.topMeta} pointerEvents="none">
          <View style={styles.pill}>
            <View style={[
              styles.onlineDot,
              { backgroundColor: profile.isOnline ? BRAND.green : "#71717A" }
            ]} />
            <Text style={styles.pillText}>
              {profile.isOnline ? "Online" : "Active today"}
            </Text>
          </View>
          {profile.compatibilityPct != null && (
            <Animated.View style={[styles.vibePill, vibePillStyle]}>
              <LinearGradient
                colors={getVibeColors(profile.compatibilityPct)}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.vibePillGrad}
              >
                <Text style={styles.vibeIcon}>⚡</Text>
                <Text style={styles.vibeScore}>{profile.compatibilityPct}%</Text>
                <Text style={styles.vibeLabel}>Vibe</Text>
              </LinearGradient>
            </Animated.View>
          )}
        </View>

        {/* Info section */}
        <Pressable onPress={onOpenProfile} style={styles.info}>
          <View style={styles.intentRow}>
            <Ionicons name={theme.icon} size={13} color={theme.accent} />
            <Text style={[styles.intentLabel, { color: theme.accent }]} numberOfLines={1}>
              {intentLine}
            </Text>
          </View>

          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {nameStr}
            </Text>
            {profile.isVerified && (
              <View style={[styles.verifiedBadge, { backgroundColor: theme.accent }]}>
                <Ionicons name="checkmark" size={13} color="#fff" />
              </View>
            )}
          </View>

          {!!locationText && (
            <View style={styles.locRow}>
              <Ionicons name="location-outline" size={13} color={NEUTRAL.textMuted} />
              <Text style={styles.locText}>{locationText}</Text>
            </View>
          )}

          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: theme.accentSoft }]}>
              <Text style={styles.badgeText}>{theme.label}</Text>
            </View>
            {!!profile.connectionSubtype && (
              <View style={[styles.badge, { backgroundColor: "rgba(255,255,255,0.12)" }]}>
                <Text style={styles.badgeText}>{profile.connectionSubtype}</Text>
              </View>
            )}
            {profile.isPremium && (
              <View style={[styles.badge, { backgroundColor: "rgba(251,191,36,0.16)" }]}>
                <Ionicons name="star" size={10} color="#FBBF24" />
                <Text style={[styles.badgeText, { color: "#FBBF24", marginLeft: 3 }]}>Premium</Text>
              </View>
            )}
          </View>

          {!!profile.bio && (
            <Text style={styles.bio} numberOfLines={2}>{profile.bio}</Text>
          )}

          {(profile.interests?.length ?? 0) > 0 && (
            <View style={styles.tags}>
              {profile.interests!.slice(0, 4).map((tag) => (
                <View key={tag} style={[styles.tag, { borderColor: theme.accentSoft }]}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </Pressable>

        {/* Swipe stamps — only rendered on top card */}
        {isTop && (
          <>
            <Animated.View style={[styles.stamp, styles.likeStamp, likeStyle]}>
              <Text style={[styles.stampText, { color: theme.accent, borderColor: theme.accent }]}>
                {theme.rightStamp}
              </Text>
            </Animated.View>
            <Animated.View style={[styles.stamp, styles.nopeStamp, nopeStyle]}>
              <Text style={[styles.stampText, { color: BRAND.red, borderColor: BRAND.red }]}>
                {theme.leftStamp}
              </Text>
            </Animated.View>
            <Animated.View style={[styles.stamp, styles.superStamp, superStyle]}>
              <Text style={[styles.stampText, { color: "#C084FC", borderColor: "#C084FC" }]}>
                {theme.upStamp}
              </Text>
            </Animated.View>
          </>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    position: "absolute",
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: RADIUS.card,
    overflow: "hidden",
    borderWidth: 1,
    ...SHADOW.card,
  },
  flashOverlay: {
    backgroundColor: "#ffffff",
    zIndex: 10,
  },
  progressRow: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    flexDirection: "row",
    gap: 5,
    zIndex: 5,
  },
  progressDot: {
    flex: 1,
    height: 3,
    borderRadius: RADIUS.pill,
    backgroundColor: "rgba(255,255,255,0.30)",
  },
  tapRow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "60%",
    flexDirection: "row",
    zIndex: 4,
  },
  tapZone: { flex: 1 },
  topMeta: {
    position: "absolute",
    top: 22,
    left: SPACE.lg,
    right: SPACE.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 6,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: RADIUS.pill,
  },
  pillText: {
    color: NEUTRAL.text,
    ...TYPE.captionBold,
  },
  info: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACE.xl,
    paddingBottom: SPACE.xl,
    paddingTop: 110,
    gap: 7,
    zIndex: 6,
  },
  intentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    borderRadius: RADIUS.pill,
    paddingHorizontal: 11,
    paddingVertical: 6,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  intentLabel: { ...TYPE.captionBold },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  name: {
    color: NEUTRAL.text,
    fontSize: 32,
    lineHeight: 36,
    fontFamily: "Inter_700Bold",
    flex: 1,
  },
  verifiedBadge: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.86)",
    flexShrink: 0,
  },
  locRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locText: {
    color: NEUTRAL.textMuted,
    ...TYPE.label,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 1,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADIUS.pill,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  badgeText: {
    color: "#F4F4F5",
    ...TYPE.captionBold,
  },
  bio: {
    color: "rgba(255,255,255,0.90)",
    ...TYPE.bodyMedium,
    marginTop: 1,
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 3,
  },
  tag: {
    borderRadius: RADIUS.pill,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  tagText: {
    color: NEUTRAL.text,
    ...TYPE.captionBold,
  },
  initCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  initBubble: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  initText: {
    color: NEUTRAL.text,
    fontSize: 44,
    fontFamily: "Inter_700Bold",
  },
  stamp: { position: "absolute", zIndex: 20 },
  likeStamp: { top: 92, left: 20, transform: [{ rotate: "-12deg" }] },
  nopeStamp: { top: 92, right: 20, transform: [{ rotate: "12deg" }] },
  superStamp: { top: 130, left: "50%", transform: [{ translateX: -52 }] },
  stampText: {
    borderWidth: 2.5,
    borderRadius: RADIUS.md,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 24,
    fontFamily: "Inter_700Bold",
  },
  // ── Vibe score pill ────────────────────────────────────────────────────────
  vibePill: {
    borderRadius: RADIUS.pill,
    overflow: "hidden",
    // Subtle drop-shadow so it pops off the photo
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 5,
  },
  vibePillGrad: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  vibeIcon: {
    fontSize: 16,
  },
  vibeScore: {
    color: "#FFFFFF",
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    lineHeight: 20,
  },
  vibeLabel: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 14,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
});
