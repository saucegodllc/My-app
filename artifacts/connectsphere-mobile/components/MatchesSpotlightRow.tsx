/**
 * MatchesSpotlightRow
 *
 * Horizontal scrolling strip of new matches — the first thing users see
 * when they open the Connect tab. Tapping an avatar opens the profile.
 *
 * Shows a pink ring around avatars with unread messages.
 * The "New" label pulses on first render.
 *
 * Usage:
 *   <MatchesSpotlightRow matches={recentMatches} onPress={(match) => openProfile(match.peerId)} />
 */
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { BRAND, NEUTRAL, RADIUS, SPACE, TYPE } from "@/constants/tokens";

export type SpotlightMatch = {
  matchId: string;
  chatId?: string;
  peerId?: string;
  displayName: string;
  photo?: string | null;
  hasUnread: boolean;
  isNew?: boolean;
  intent: "dating" | "friendship";
};

type Props = {
  matches: SpotlightMatch[];
  onPress: (match: SpotlightMatch) => void;
};

function SpotlightAvatar({ match, onPress }: { match: SpotlightMatch; onPress: () => void }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (match.isNew) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.12, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      );
      loop.start();
      // Stop after 3 cycles (4.2s)
      const timeout = setTimeout(() => loop.stop(), 4200);
      return () => { loop.stop(); clearTimeout(timeout); };
    }
  }, [match.isNew]);

  const ringColor = match.intent === "friendship" ? BRAND.cyan : BRAND.pink;
  const initials = match.displayName
    .split(" ")
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.avatarWrap,
        pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] },
      ]}
    >
      {/* Ring glow for unread / new */}
      {(match.hasUnread || match.isNew) && (
        <Animated.View
          style={[
            styles.ring,
            { borderColor: ringColor, transform: [{ scale: pulseAnim }] },
          ]}
        />
      )}

      {/* Avatar */}
      <View style={styles.avatar}>
        {match.photo ? (
          <Image source={{ uri: match.photo }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <LinearGradient
            colors={match.intent === "friendship"
              ? ["#0e4a5a", "#22D3EE"]
              : ["#4a0020", BRAND.pink]}
            style={StyleSheet.absoluteFill}
          >
            <View style={styles.initCenter}>
              <Text style={styles.initText}>{initials}</Text>
            </View>
          </LinearGradient>
        )}
      </View>

      {/* Unread dot */}
      {match.hasUnread && (
        <View style={[styles.unreadDot, { backgroundColor: ringColor }]} />
      )}

      {/* Name */}
      <Text style={styles.name} numberOfLines={1}>
        {match.displayName.split(" ")[0]}
      </Text>

      {/* "New" badge */}
      {match.isNew && (
        <View style={[styles.newBadge, { backgroundColor: ringColor }]}>
          <Text style={styles.newBadgeText}>NEW</Text>
        </View>
      )}
    </Pressable>
  );
}

export function MatchesSpotlightRow({ matches, onPress }: Props) {
  if (matches.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>New Matches</Text>
        <Text style={styles.headerCount}>{matches.length}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        decelerationRate="fast"
      >
        {matches.map((match) => (
          <SpotlightAvatar
            key={match.matchId}
            match={match}
            onPress={() => onPress(match)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const AVATAR_SIZE = 64;
const RING_SIZE = AVATAR_SIZE + 6;

const styles = StyleSheet.create({
  container: {
    paddingBottom: SPACE.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.md,
    paddingBottom: SPACE.sm,
  },
  headerTitle: {
    color: NEUTRAL.text,
    ...TYPE.labelBold,
  },
  headerCount: {
    color: BRAND.pink,
    ...TYPE.captionBold,
    backgroundColor: "rgba(255,45,168,0.15)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
    overflow: "hidden",
  },
  scroll: {
    paddingHorizontal: SPACE.lg,
    paddingBottom: SPACE.xs,
    gap: SPACE.md,
    flexDirection: "row",
  },
  avatarWrap: {
    alignItems: "center",
    gap: 5,
    width: RING_SIZE + 4,
    position: "relative",
  },
  ring: {
    position: "absolute",
    top: 0,
    left: 0,
    width: RING_SIZE + 4,
    height: RING_SIZE + 4,
    borderRadius: (RING_SIZE + 4) / 2,
    borderWidth: 2.5,
    zIndex: 1,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow: "hidden",
    backgroundColor: "#1C1C1E",
    margin: 2 + 2, // center inside ring
    zIndex: 2,
  },
  initCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  initText: {
    color: NEUTRAL.text,
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  unreadDot: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#000",
    zIndex: 5,
  },
  name: {
    color: NEUTRAL.text,
    ...TYPE.captionBold,
    maxWidth: RING_SIZE + 4,
  },
  newBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
  },
  newBadgeText: {
    color: "#fff",
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
});
