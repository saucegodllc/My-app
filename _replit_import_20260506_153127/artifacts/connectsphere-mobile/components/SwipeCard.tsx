import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - 32;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.78;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.28;
const ROTATION_RANGE = 12;

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
};

type Props = {
  profile: Profile;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onSwipeUp: () => void;
  onOpenProfile: () => void;
  isTop: boolean;
};

function deterministicPct(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (((hash << 5) - hash) + id.charCodeAt(index)) | 0;
  }
  return 70 + (Math.abs(hash) % 30);
}

function getInitials(name = "User") {
  return name
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getIntentTheme(intent: string) {
  if (intent === "friendship") {
    return {
      accent: "#22D3EE",
      accentSoft: "rgba(34,211,238,0.18)",
      label: "Friends",
      fitLabel: "Friend Fit",
      rightStamp: "ADD",
      upStamp: "INVITE",
      leftStamp: "SKIP",
      headlinePrefix: "Looking for",
    };
  }

  if (intent === "networking") {
    return {
      accent: "#A855F7",
      accentSoft: "rgba(168,85,247,0.18)",
      label: "Networking",
      fitLabel: "Network Fit",
      rightStamp: "CONNECT",
      upStamp: "VIEW",
      leftStamp: "NOT NOW",
      headlinePrefix: "Open to",
    };
  }

  return {
    accent: "#FF299B",
    accentSoft: "rgba(255,41,155,0.18)",
    label: "Dating",
    fitLabel: "Match",
    rightStamp: "LIKE",
    upStamp: "SUPER",
    leftStamp: "PASS",
    headlinePrefix: "Looking for",
  };
}

export function SwipeCard({
  profile,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onOpenProfile,
  isTop,
}: Props) {
  const colors = useColors();
  const position = useRef(new Animated.ValueXY()).current;
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    setPhotoIndex(0);
  }, [profile.id]);

  const theme = getIntentTheme(profile.intent);

  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: [`-${ROTATION_RANGE}deg`, "0deg", `${ROTATION_RANGE}deg`],
    extrapolate: "clamp",
  });

  const likeOpacity = position.x.interpolate({
    inputRange: [20, 100],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const nopeOpacity = position.x.interpolate({
    inputRange: [-100, -20],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  const superOpacity = position.y.interpolate({
    inputRange: [-100, -40],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isTop,
      onMoveShouldSetPanResponder: () => isTop,
      onPanResponderMove: (_, gestureState) => {
        position.setValue({ x: gestureState.dx, y: gestureState.dy });
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > SWIPE_THRESHOLD) {
          Animated.timing(position, {
            toValue: { x: SCREEN_WIDTH * 1.5, y: gestureState.dy },
            duration: 240,
            useNativeDriver: false,
          }).start(onSwipeRight);
        } else if (gestureState.dx < -SWIPE_THRESHOLD) {
          Animated.timing(position, {
            toValue: { x: -SCREEN_WIDTH * 1.5, y: gestureState.dy },
            duration: 240,
            useNativeDriver: false,
          }).start(onSwipeLeft);
        } else if (gestureState.dy < -SWIPE_THRESHOLD) {
          Animated.timing(position, {
            toValue: { x: gestureState.dx, y: -SCREEN_HEIGHT },
            duration: 240,
            useNativeDriver: false,
          }).start(onSwipeUp);
        } else {
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            friction: 6,
            tension: 70,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  const cardStyle = isTop
    ? {
        transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }],
      }
    : {};

  const photoCount = profile.photos?.length ?? 0;
  const photoUrl = photoCount > 0 ? profile.photos?.[Math.min(photoIndex, photoCount - 1)] : undefined;
  const compatibility = deterministicPct(profile.userId);
  const isOnline = deterministicPct(profile.userId + "-online") % 2 === 0;
  const locationText = [profile.location, profile.country].filter(Boolean).join(", ");
  const isNetworking = profile.intent === "networking";
  const primaryTitle = isNetworking && profile.profession ? profile.profession : profile.displayName;
  const secondaryTitle = isNetworking
    ? profile.displayName
    : profile.age
      ? `${profile.age}`
      : "";
  const intentLine = profile.connectionSubtype
    ? `${theme.headlinePrefix}: ${profile.connectionSubtype}`
    : theme.label;

  return (
    <Animated.View
      style={[
        styles.card,
        cardStyle,
        { backgroundColor: colors.card, borderColor: theme.accentSoft },
      ]}
      {...(isTop ? panResponder.panHandlers : {})}
    >
      <View style={styles.tapLayer}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.photo} contentFit="cover" />
        ) : (
          <LinearGradient colors={["#111111", "#3a0426", "#000000"]} style={styles.photoPlaceholder}>
            <View style={styles.initialsBubble}>
              <Text style={styles.initialsText}>{getInitials(profile.displayName)}</Text>
            </View>
          </LinearGradient>
        )}

        <LinearGradient colors={["transparent", "rgba(0,0,0,0.18)", "rgba(0,0,0,0.98)"]} style={styles.gradient} />

        {photoCount > 1 ? (
          <View style={styles.photoProgress}>
            {profile.photos?.slice(0, 5).map((_, index) => (
              <View
                key={`${profile.id}-photo-${index}`}
                style={[
                  styles.photoProgressDot,
                  index === photoIndex ? [styles.photoProgressDotActive, { backgroundColor: theme.accent }] : null,
                ]}
              />
            ))}
          </View>
        ) : null}

        <View style={styles.photoTapRow}>
          <Pressable
            onPress={() => {
              if (photoCount > 1) {
                setPhotoIndex((current) => (current === 0 ? photoCount - 1 : current - 1));
              }
            }}
            style={styles.photoTapZone}
          />
          <Pressable
            onPress={() => {
              if (photoCount > 1) {
                setPhotoIndex((current) => (current + 1) % photoCount);
              }
            }}
            style={styles.photoTapZone}
          />
        </View>

        <View style={styles.topMeta}>
          <View style={styles.statusPill}>
            <View style={[styles.statusDot, { backgroundColor: isOnline ? "#4ADE80" : "#71717A" }]} />
            <Text style={styles.statusText}>{isOnline ? "Online" : "Recently active"}</Text>
          </View>
          <View style={[styles.matchPill, { borderColor: theme.accentSoft }]}> 
            <Text style={styles.matchText}>{compatibility}% {theme.fitLabel}</Text>
          </View>
        </View>

        <Pressable onPress={onOpenProfile} style={styles.info}>
          <View style={styles.intentHeadline}>
            <Ionicons
              name={profile.intent === "friendship" ? "people" : profile.intent === "networking" ? "briefcase" : "flame"}
              size={14}
              color={theme.accent}
            />
            <Text style={[styles.intentHeadlineText, { color: theme.accent }]} numberOfLines={1}>
              {intentLine}
            </Text>
          </View>

          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {primaryTitle}{secondaryTitle ? `, ${secondaryTitle}` : ""}
            </Text>
            {profile.isVerified ? (
              <View style={[styles.verifiedBadge, { backgroundColor: theme.accent, shadowColor: theme.accent }]}>
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
              </View>
            ) : null}
          </View>

          {isNetworking && profile.displayName ? (
            <Text style={styles.professionalName} numberOfLines={1}>{profile.displayName}</Text>
          ) : null}

          {locationText ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.72)" />
              <Text style={styles.location}>{locationText}</Text>
            </View>
          ) : null}

          <View style={styles.badgeRow}>
            <View style={[styles.intentBadge, { backgroundColor: theme.accentSoft }]}>
              <Text style={styles.intentText}>{theme.label}</Text>
            </View>
            {profile.connectionSubtype ? (
              <View style={[styles.intentBadge, { backgroundColor: "rgba(255,255,255,0.12)" }]}>
                <Text style={styles.intentText}>{profile.connectionSubtype}</Text>
              </View>
            ) : null}
          </View>

          {profile.bio ? (
            <Text style={styles.bio} numberOfLines={profile.intent === "friendship" ? 3 : 2}>
              {profile.bio}
            </Text>
          ) : null}

          {profile.interests && profile.interests.length > 0 ? (
            <View style={styles.interests}>
              {profile.interests.slice(0, 4).map((interest) => (
                <View key={interest} style={[styles.interestTag, { borderColor: theme.accentSoft }]}> 
                  <Text style={styles.interestTagText}>{interest}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </Pressable>
      </View>

      {isTop ? (
        <>
          <Animated.View style={[styles.likeStamp, { opacity: likeOpacity }]}>
            <Text style={[styles.stampText, { color: theme.accent, borderColor: theme.accent }]}>{theme.rightStamp}</Text>
          </Animated.View>
          <Animated.View style={[styles.nopeStamp, { opacity: nopeOpacity }]}>
            <Text style={[styles.stampText, { color: "#F87171", borderColor: "#F87171" }]}>{theme.leftStamp}</Text>
          </Animated.View>
          <Animated.View style={[styles.superStamp, { opacity: superOpacity }]}>
            <Text style={[styles.stampText, { color: "#C084FC", borderColor: "#C084FC" }]}>{theme.upStamp}</Text>
          </Animated.View>
        </>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 30,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  photo: { width: "100%", height: "100%" },
  tapLayer: {
    flex: 1,
  },
  photoPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  initialsBubble: {
    width: 132,
    height: 132,
    borderRadius: 66,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  initialsText: {
    color: "#fff",
    fontSize: 44,
    fontFamily: "Inter_700Bold",
  },
  gradient: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  photoProgress: {
    position: "absolute",
    top: 12,
    left: 14,
    right: 14,
    flexDirection: "row",
    gap: 6,
  },
  photoProgressDot: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  photoProgressDotActive: {
    backgroundColor: "#FFFFFF",
  },
  photoTapRow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "62%",
    flexDirection: "row",
  },
  photoTapZone: {
    flex: 1,
  },
  topMeta: {
    position: "absolute",
    top: 18,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.42)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  statusText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  matchPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.42)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  matchText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  info: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 130,
    gap: 8,
  },
  intentHeadline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    maxWidth: "100%",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "rgba(0,0,0,0.42)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  intentHeadlineText: {
    fontSize: 12,
    fontFamily: "Inter_800ExtraBold",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  name: {
    color: "#fff",
    fontSize: 32,
    lineHeight: 36,
    fontFamily: "Inter_700Bold",
    flex: 1,
  },
  professionalName: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  location: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  verifiedBadge: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF299B",
    shadowColor: "#FF299B",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
    marginLeft: -2,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
  },
  intentBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  intentText: {
    color: "#F4F4F5",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  bio: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  interests: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  interestTag: {
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  interestTagText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  likeStamp: {
    position: "absolute",
    top: 92,
    left: 20,
    transform: [{ rotate: "-12deg" }],
  },
  nopeStamp: {
    position: "absolute",
    top: 92,
    right: 20,
    transform: [{ rotate: "12deg" }],
  },
  superStamp: {
    position: "absolute",
    top: 132,
    alignSelf: "center",
  },
  stampText: {
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    overflow: "hidden",
  },
});
