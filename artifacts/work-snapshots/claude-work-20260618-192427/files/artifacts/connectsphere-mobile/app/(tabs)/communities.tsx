/**
 * Communities Hub Tab
 * ─────────────────────────────────────────────────────────────────────────────
 * The main Communities entry point for Spaces.
 *
 * Layout:
 *   ┌─────────────────────────────────────┐
 *   │  Header: "Spaces"  [+]              │
 *   │  Search bar                         │
 *   │  Joined pills (horizontal scroll)   │
 *   │  ── Explore All ──                  │
 *   │  Community card × N                 │
 *   │  Create community card (dashed)     │
 *   └─────────────────────────────────────┘
 *
 * Real-time:
 *   - SEED_COMMUNITIES renders immediately (no blank flash)
 *   - API enriches in background (member counts, isJoined status)
 *   - useFocusEffect re-fetches every time the tab gains focus
 *   - Join/leave is optimistic with server sync
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";

import { BRAND, NEUTRAL, RADIUS, SPACE, SPRING, TYPE } from "@/constants/tokens";
import {
  Community,
  SEED_COMMUNITIES,
  formatCount,
  listCommunities,
  toggleMembership,
} from "@/services/communitiesApi";

// ── Local tokens ──────────────────────────────────────────────────────────────
const BG     = NEUTRAL.bg;
const CARD   = NEUTRAL.card;
const BORDER = "rgba(255,255,255,0.08)";
const MUTED  = NEUTRAL.textMuted;

// ── Avatar stack helper ───────────────────────────────────────────────────────
const AVATAR_COLORS = [BRAND.purple, BRAND.pink, BRAND.cyan, BRAND.amber, BRAND.green];

function AvatarStack({ count, accent }: { count: number; accent: string }) {
  const show = Math.min(3, Math.floor(count / 100));
  return (
    <View style={ss.avatarStack}>
      {Array.from({ length: show }).map((_, i) => (
        <View
          key={i}
          style={[
            ss.avatarDot,
            {
              backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
              marginLeft: i === 0 ? 0 : -5,
              zIndex: show - i,
            },
          ]}
        />
      ))}
    </View>
  );
}

// ── Community card ────────────────────────────────────────────────────────────
interface CommunityCardProps {
  item: Community;
  onPress: () => void;
  onJoinToggle: (id: string, currentlyJoined: boolean) => void;
}

function CommunityCard({ item, onPress, onJoinToggle }: CommunityCardProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.97, duration: 80, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
      Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
    ]).start();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const handleJoin = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onJoinToggle(item.id, item.isJoined);
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable style={ss.card} onPress={handlePress} accessibilityRole="button">
        {/* Icon block */}
        <View style={[ss.cardIcon, { backgroundColor: item.colorBg, borderColor: item.colorBorder }]}>
          <Ionicons name={item.iconName as any} size={22} color={item.colorAccent} />
        </View>

        {/* Text block */}
        <View style={ss.cardBody}>
          <View style={ss.cardTopRow}>
            <Text style={ss.cardName} numberOfLines={1}>{item.name}</Text>
            <Text style={ss.cardMeta}>{item.postCountToday} posts</Text>
          </View>
          <Text style={ss.cardDesc} numberOfLines={1}>{item.description}</Text>

          <View style={ss.cardBottom}>
            <AvatarStack count={item.memberCount} accent={item.colorAccent} />
            <Text style={ss.cardMembers}>{formatCount(item.memberCount)} members</Text>
            {item.activeNow > 0 && (
              <>
                <View style={[ss.liveDot, { backgroundColor: BRAND.green }]} />
                <Text style={[ss.cardMembers, { color: BRAND.green }]}>Live</Text>
              </>
            )}
            {/* Join/Joined pill — right-aligned */}
            <TouchableOpacity
              style={[
                ss.joinPill,
                item.isJoined
                  ? { backgroundColor: item.colorBg, borderColor: item.colorBorder }
                  : { backgroundColor: "transparent", borderColor: BORDER },
              ]}
              onPress={handleJoin}
              activeOpacity={0.75}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[ss.joinLabel, { color: item.isJoined ? item.colorAccent : MUTED }]}>
                {item.isJoined ? "Joined" : "Join"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ── Joined pill chip ──────────────────────────────────────────────────────────
function JoinedChip({ community, onPress }: { community: Community; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[ss.chip, { backgroundColor: community.colorBg, borderColor: community.colorBorder }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Ionicons name={community.iconName as any} size={12} color={community.colorAccent} />
      <Text style={[ss.chipLabel, { color: community.colorAccent }]}>{community.name}</Text>
    </TouchableOpacity>
  );
}

// ── Create community card ─────────────────────────────────────────────────────
function CreateCommunityCard({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={ss.createCard} onPress={onPress} activeOpacity={0.75}>
      <View style={ss.createIcon}>
        <Ionicons name="add" size={24} color="rgba(255,255,255,0.25)" />
      </View>
      <View>
        <Text style={ss.createTitle}>Create a community</Text>
        <Text style={ss.createSub}>Start your own space on ConnectSphere</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.2)" style={{ marginLeft: "auto" }} />
    </TouchableOpacity>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function CommunitiesScreen() {
  const insets = useSafeAreaInsets();
  const [communities, setCommunities] = useState<Community[]>(SEED_COMMUNITIES);
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const fetchCommunities = useCallback(async () => {
    try {
      const data = await listCommunities();
      setCommunities(data);
    } catch {
      // API not live yet — seeds remain; no crash.
    }
  }, []);

  // Re-fetch every time the tab gains focus
  useFocusEffect(
    useCallback(() => {
      void fetchCommunities();
    }, [fetchCommunities]),
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchCommunities();
    setIsRefreshing(false);
  }, [fetchCommunities]);

  const handleJoinToggle = useCallback(
    async (id: string, currentlyJoined: boolean) => {
      // Optimistic update
      setCommunities((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                isJoined: !currentlyJoined,
                memberCount: currentlyJoined ? c.memberCount - 1 : c.memberCount + 1,
              }
            : c,
        ),
      );
      try {
        await toggleMembership(id, !currentlyJoined);
      } catch {
        // Rollback on failure
        setCommunities((prev) =>
          prev.map((c) =>
            c.id === id
              ? {
                  ...c,
                  isJoined: currentlyJoined,
                  memberCount: currentlyJoined ? c.memberCount + 1 : c.memberCount - 1,
                }
              : c,
          ),
        );
      }
    },
    [],
  );

  const joinedCommunities = communities.filter((c) => c.isJoined);

  const filtered = communities.filter(
    (c) =>
      !searchQuery ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const openCommunity = (slug: string) => {
    router.push(`/communities/${encodeURIComponent(slug)}` as any);
  };

  const openCreateCommunity = () => {
    router.push("/communities/create" as any);
  };

  return (
    <View style={[ss.root, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={ss.header}>
        <Text style={ss.headerTitle}>Spaces</Text>
        <TouchableOpacity
          style={ss.headerBtn}
          onPress={openCreateCommunity}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="add" size={22} color={NEUTRAL.text} />
        </TouchableOpacity>
      </View>

      {/* ── Search ── */}
      <View style={ss.searchWrap}>
        <Ionicons name="search-outline" size={16} color="rgba(255,255,255,0.35)" />
        <TextInput
          style={ss.searchInput}
          placeholder="Search communities..."
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.3)" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[ss.scroll, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={BRAND.pink}
          />
        }
      >
        {/* ── Joined chips ── */}
        {joinedCommunities.length > 0 && !searchQuery && (
          <View style={ss.section}>
            <Text style={ss.sectionLabel}>Joined</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={ss.chipRow}
            >
              {joinedCommunities.map((c) => (
                <JoinedChip
                  key={c.id}
                  community={c}
                  onPress={() => openCommunity(c.slug)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Explore / search results ── */}
        <View style={ss.section}>
          <Text style={ss.sectionLabel}>
            {searchQuery ? `Results for "${searchQuery}"` : "Explore all"}
          </Text>

          {filtered.map((item) => (
            <CommunityCard
              key={item.id}
              item={item}
              onPress={() => openCommunity(item.slug)}
              onJoinToggle={handleJoinToggle}
            />
          ))}

          {filtered.length === 0 && searchQuery.length > 0 && (
            <View style={ss.emptyState}>
              <Ionicons name="planet-outline" size={40} color="rgba(255,255,255,0.15)" />
              <Text style={ss.emptyTitle}>No spaces found</Text>
              <Text style={ss.emptySub}>Try a different keyword or create one</Text>
            </View>
          )}

          {!searchQuery && <CreateCommunityCard onPress={openCreateCommunity} />}
        </View>
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE.xl,
    paddingTop: SPACE.md,
    paddingBottom: SPACE.sm,
  },
  headerTitle: {
    ...TYPE.h2,
    color: NEUTRAL.text,
    flex: 1,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    backgroundColor: NEUTRAL.card2,
    borderRadius: RADIUS.lg,
    marginHorizontal: SPACE.xl,
    marginBottom: SPACE.lg,
    paddingHorizontal: SPACE.md,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: BORDER,
  },
  searchInput: {
    flex: 1,
    ...TYPE.body,
    color: NEUTRAL.text,
    padding: 0,
  },
  scroll: {
    paddingTop: SPACE.xs,
  },
  section: {
    marginBottom: SPACE.xl,
  },
  sectionLabel: {
    ...TYPE.caption,
    color: "rgba(255,255,255,0.35)",
    textTransform: "uppercase",
    letterSpacing: 0.9,
    marginBottom: SPACE.md,
    marginHorizontal: SPACE.xl,
  },
  chipRow: {
    paddingHorizontal: SPACE.xl,
    gap: SPACE.sm,
    flexDirection: "row",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderWidth: 1,
  },
  chipLabel: {
    ...TYPE.caption,
    fontFamily: "Inter_600SemiBold",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    backgroundColor: CARD,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: BORDER,
    padding: SPACE.md,
    marginHorizontal: SPACE.xl,
    marginBottom: SPACE.sm,
  },
  cardIcon: {
    width: 50,
    height: 50,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    flexShrink: 0,
  },
  cardBody: {
    flex: 1,
    gap: 3,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardName: {
    ...TYPE.bodyMedium,
    color: NEUTRAL.text,
    flex: 1,
    marginRight: SPACE.sm,
  },
  cardMeta: {
    ...TYPE.caption,
    color: "rgba(255,255,255,0.3)",
    flexShrink: 0,
  },
  cardDesc: {
    ...TYPE.caption,
    color: MUTED,
  },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 4,
  },
  avatarStack: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarDot: {
    width: 16,
    height: 16,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    borderColor: CARD,
  },
  cardMembers: {
    ...TYPE.caption,
    color: "rgba(255,255,255,0.35)",
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: RADIUS.pill,
  },
  joinPill: {
    marginLeft: "auto" as any,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
  },
  joinLabel: {
    ...TYPE.caption,
    fontFamily: "Inter_600SemiBold",
  },
  createCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    backgroundColor: CARD,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    borderStyle: "dashed",
    padding: SPACE.md,
    marginHorizontal: SPACE.xl,
    marginTop: SPACE.xs,
  },
  createIcon: {
    width: 50,
    height: 50,
    borderRadius: RADIUS.lg,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    flexShrink: 0,
  },
  createTitle: {
    ...TYPE.bodyMedium,
    color: "rgba(255,255,255,0.4)",
  },
  createSub: {
    ...TYPE.caption,
    color: "rgba(255,255,255,0.2)",
    marginTop: 2,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: SPACE["4xl"],
    gap: SPACE.sm,
  },
  emptyTitle: {
    ...TYPE.title,
    color: "rgba(255,255,255,0.4)",
    marginTop: SPACE.sm,
  },
  emptySub: {
    ...TYPE.body,
    color: "rgba(255,255,255,0.2)",
  },
});
