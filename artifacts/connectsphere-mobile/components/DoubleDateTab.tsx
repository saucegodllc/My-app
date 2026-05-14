import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  createDoubleDatePair,
  getDoubleDateFeed,
  getDoubleDatePair,
  pauseDoubleDatePair,
  swipeDoubleDatePair,
  type DoubleDatePair,
  type DoubleDateUser,
  type SwipeResponse,
} from "@/services/doubleDateApi";

const CURRENT_USER_ID = "user_self";
const BG = "#060306";
const PANEL = "#111014";
const INK = "#ffffff";
const MUTED = "rgba(255,255,255,0.64)";
const SOFT = "rgba(255,255,255,0.10)";
const ROSE = "#ff4f8b";
const GREEN = "#34d399";
const BLUE = "#60a5fa";
const AMBER = "#f59e0b";

const fallbackBuddies: DoubleDateUser[] = [
  {
    id: "mock-buddy-ari",
    name: "Ari Kim",
    city: "Miami",
    neighborhood: "South Beach",
    photoUrl: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=800&q=85",
    interests: ["Brunch", "Beach", "Events"],
    energy: "Down for easy plans",
    activeTonight: true,
  },
  {
    id: "mock-buddy-jade",
    name: "Jade Rivera",
    city: "Miami",
    neighborhood: "Coral Gables",
    photoUrl: "https://images.unsplash.com/photo-1524250502761-1ac6f2e30d43?auto=format&fit=crop&w=800&q=85",
    interests: ["Dinner", "Dancing", "Rooftops"],
    energy: "Good wing-person energy",
    activeTonight: false,
  },
];

export default function DoubleDateTab() {
  const [myDoubleDatePair, setMyDoubleDatePair] = useState<DoubleDatePair | null>(null);
  const [connectedFriends, setConnectedFriends] = useState<DoubleDateUser[]>([]);
  const [discoverPairs, setDiscoverPairs] = useState<DoubleDatePair[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedLoading, setFeedLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isCreatingPair, setIsCreatingPair] = useState(false);
  const [isSwiping, setIsSwiping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<Extract<SwipeResponse, { matched: true }> | null>(null);

  const visiblePair = discoverPairs[0] ?? null;

  const loadMyPair = useCallback(async () => {
    const result = await getDoubleDatePair(CURRENT_USER_ID);
    setMyDoubleDatePair(result.pair);
    setConnectedFriends(result.connectedFriends);
    return result.pair;
  }, []);

  const loadFeed = useCallback(async (pairId: string) => {
    setFeedLoading(true);
    try {
      const result = await getDoubleDateFeed(pairId);
      setDiscoverPairs(result.pairs);
    } finally {
      setFeedLoading(false);
    }
  }, []);

  const reload = useCallback(async () => {
    setError(null);
    const pair = await loadMyPair();
    if (pair) {
      await loadFeed(pair.id);
    } else {
      setDiscoverPairs([]);
    }
  }, [loadFeed, loadMyPair]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    reload()
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Could not load Double Date.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [reload]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleCreatePair = async (friendId: string) => {
    if (isCreatingPair) return;
    if (friendId.startsWith("mock-buddy-")) {
      setError("Invite this friend first, then pair up when they join.");
      return;
    }
    setIsCreatingPair(true);
    setError(null);
    try {
      const result = await createDoubleDatePair(CURRENT_USER_ID, friendId);
      setMyDoubleDatePair(result.pair);
      setConnectedFriends(result.connectedFriends);
      if (result.pair) await loadFeed(result.pair.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create your pair.");
    } finally {
      setIsCreatingPair(false);
    }
  };

  const handleChangeBuddy = async () => {
    if (!myDoubleDatePair || isCreatingPair || isSwiping) return;
    setIsCreatingPair(true);
    setError(null);
    try {
      await pauseDoubleDatePair(myDoubleDatePair.id, CURRENT_USER_ID);
      setMyDoubleDatePair(null);
      setDiscoverPairs([]);
      await loadMyPair();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change buddy.");
    } finally {
      setIsCreatingPair(false);
    }
  };

  const handleInviteBuddy = () => {
    router.push("/(tabs)/matches" as never);
  };

  const removePairFromDiscover = (targetPairId: string) => {
    setDiscoverPairs((items) => items.filter((item) => item.id !== targetPairId));
  };

  const handleSwipe = async (targetPairId: string, direction: "like" | "pass") => {
    if (!myDoubleDatePair || isSwiping) return;
    try {
      setIsSwiping(true);
      setError(null);

      const result = await swipeDoubleDatePair({
        currentPairId: myDoubleDatePair.id,
        targetPairId,
        direction,
        currentUserId: CURRENT_USER_ID,
      });

      removePairFromDiscover(targetPairId);

      if (result.matched) {
        setMatchResult(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setIsSwiping(false);
    }
  };

  const openMatchedChat = () => {
    const chatId = matchResult?.chat?.id ?? matchResult?.match.chatId;
    setMatchResult(null);
    if (chatId) {
      router.push({ pathname: "/(tabs)/matches", params: { openChatId: chatId } } as never);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={ROSE} size="large" />
        <Text style={styles.centerTitle}>Loading Double Date</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(255,79,139,0.20)", "rgba(96,165,250,0.10)", "rgba(0,0,0,0)"]}
        style={styles.backdrop}
      />
      {!myDoubleDatePair ? (
        <PickBuddyScreen
          friends={connectedFriends}
          busy={isCreatingPair}
          error={error}
          onPick={handleCreatePair}
          onInvite={handleInviteBuddy}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      ) : (
        <View style={styles.discoveryRoot}>
          <PairStatusHeader pair={myDoubleDatePair} busy={isCreatingPair || isSwiping} onChangeBuddy={handleChangeBuddy} />
          {error ? <InlineError message={error} onRetry={onRefresh} /> : null}
          <DoubleDateDeck
            myPair={myDoubleDatePair}
            targetPair={visiblePair}
            loading={feedLoading}
            swiping={isSwiping}
            onSwipe={handleSwipe}
            onRefresh={onRefresh}
          />
        </View>
      )}
      <DoubleDateMatchModal
        visible={matchResult !== null}
        result={matchResult}
        onClose={() => setMatchResult(null)}
        onOpenChat={openMatchedChat}
      />
    </View>
  );
}

function PickBuddyScreen({
  friends,
  busy,
  error,
  refreshing,
  onPick,
  onInvite,
  onRefresh,
}: {
  friends: DoubleDateUser[];
  busy: boolean;
  error: string | null;
  refreshing: boolean;
  onPick: (friendId: string) => void;
  onInvite: () => void;
  onRefresh: () => void;
}) {
  const buddies = friends.length ? friends : fallbackBuddies;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.pickScroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ROSE} />}
    >
      <LinearGradient
        colors={["rgba(255,79,139,0.22)", "rgba(96,165,250,0.12)", "rgba(255,255,255,0.055)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.pickHero}
      >
        <View style={styles.heroIcon}>
          <Ionicons name="people" size={24} color="#fff" />
        </View>
        <Text style={styles.heroTitle}>Pick your plus-one</Text>
        <Text style={styles.heroText}>Choose one real friend you trust. You will browse duos together, and matches unlock one shared group chat.</Text>
        <View style={styles.heroStatusRow}>
          <HeroStatus icon="lock-closed" label="1 active pair max" />
          <HeroStatus icon="people-circle" label="Friends only" />
          <HeroStatus icon="chatbubbles" label="4-person chat" />
        </View>
      </LinearGradient>

      {error ? <InlineError message={error} /> : null}

      <View style={styles.sectionTitleRow}>
        <View>
          <Text style={styles.sectionTitle}>Best Picks</Text>
          <Text style={styles.sectionSubtitle}>{friends.length ? "Connected friends ready to pair" : "Preview buddies while you invite friends"}</Text>
        </View>
        <Text style={styles.sectionMeta}>{buddies.length} {friends.length ? "available" : "preview"}</Text>
      </View>

      {!friends.length ? (
        <View style={styles.previewNotice}>
          <Ionicons name="information-circle" size={16} color="#bfdbfe" />
          <Text style={styles.previewNoticeText}>These are mock buddy previews. Invite a friend in Connect to create a real duo.</Text>
        </View>
      ) : null}

      <View style={styles.buddyList}>
        {buddies.map((friend) => (
          <BuddyCard
            key={friend.id}
            friend={friend}
            busy={busy}
            fallback={friends.length === 0}
            onPick={() => onPick(friend.id)}
          />
        ))}
      </View>

      <Pressable onPress={onInvite} style={({ pressed }) => [styles.inviteButton, pressed && styles.pressed]}>
        <Ionicons name="person-add-outline" size={18} color={BLUE} />
        <Text style={styles.inviteButtonText}>Invite Buddy</Text>
      </Pressable>
    </ScrollView>
  );
}

function HeroStatus({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.heroStatusPill}>
      <Ionicons name={icon} size={13} color="#fce7f3" />
      <Text style={styles.heroStatusText}>{label}</Text>
    </View>
  );
}

function BuddyCard({
  friend,
  busy,
  fallback,
  onPick,
}: {
  friend: DoubleDateUser;
  busy: boolean;
  fallback: boolean;
  onPick: () => void;
}) {
  const badge = buddyBadge(friend, fallback);
  const location = friend.neighborhood ?? friend.city ?? "Miami";

  return (
    <View style={styles.buddyCard}>
      <View style={styles.buddyPhotoWrap}>
        <Avatar user={friend} size={76} />
        {friend.activeTonight ? <View style={styles.activeDot} /> : null}
      </View>
      <View style={styles.buddyCopy}>
        <View style={styles.buddyTopRow}>
          <Text style={styles.buddyName} numberOfLines={1}>{friend.name}</Text>
          <View style={[styles.buddyBadge, badge.tone === "green" ? styles.buddyBadgeGreen : styles.buddyBadgeBlue]}>
            <Text style={styles.buddyBadgeText}>{badge.label}</Text>
          </View>
        </View>
        <Text style={styles.buddyLocation} numberOfLines={1}>{location}</Text>
        <Text style={styles.buddyMeta} numberOfLines={2}>{friend.energy ?? "Ready for plans"}</Text>
        <View style={styles.miniTagRow}>
          {(friend.interests ?? ["Dinner", "Social"]).slice(0, 3).map((item) => (
            <View key={item} style={styles.miniTag}>
              <Text style={styles.miniTagText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>
      <Pressable disabled={busy} onPress={onPick} style={({ pressed }) => [styles.pickButton, (pressed || busy) && styles.pressed]}>
        {busy ? <ActivityIndicator color={BG} size="small" /> : <Text style={styles.pickButtonText}>{fallback ? "Invite" : "Pair Up"}</Text>}
      </Pressable>
    </View>
  );
}

function buddyBadge(friend: DoubleDateUser, fallback: boolean) {
  if (fallback) return { label: "Preview", tone: "blue" as const };
  if (friend.activeTonight) return { label: "Active tonight", tone: "green" as const };
  const traits = [...(friend.interests ?? []), ...(friend.activityStyle ?? [])].map((item) => item.toLowerCase());
  if (traits.some((item) => item.includes("planned") || item.includes("plans") || item.includes("event"))) {
    return { label: "Good planner", tone: "blue" as const };
  }
  return { label: "Shared vibe", tone: "blue" as const };
}

function PairStatusHeader({
  pair,
  busy,
  onChangeBuddy,
}: {
  pair: DoubleDatePair;
  busy: boolean;
  onChangeBuddy: () => void;
}) {
  const buddy = pair.users.find((user) => user.id !== CURRENT_USER_ID);

  return (
    <View style={styles.statusHeader}>
      <View style={styles.statusFaces}>
        {pair.users.slice(0, 2).map((user, index) => (
          <View key={user.id} style={[styles.statusAvatar, { left: index * 30 }]}>
            <Avatar user={user} size={48} />
          </View>
        ))}
      </View>
      <View style={styles.statusCopy}>
        <Text style={styles.statusEyebrow}>Your active duo</Text>
        <Text style={styles.statusTitle} numberOfLines={1}>
          You + {buddy?.name ?? "your buddy"}
        </Text>
        <Text style={styles.statusMeta} numberOfLines={1}>
          {pair.vibeTags.slice(0, 3).join(" - ")}
        </Text>
      </View>
      <Pressable disabled={busy} onPress={onChangeBuddy} style={({ pressed }) => [styles.changeButton, (pressed || busy) && styles.pressed]}>
        <Ionicons name="swap-horizontal" size={15} color={INK} />
        <Text style={styles.changeButtonText}>Change</Text>
      </Pressable>
    </View>
  );
}

function DoubleDateDeck({
  myPair,
  targetPair,
  loading,
  swiping,
  onSwipe,
  onRefresh,
}: {
  myPair: DoubleDatePair;
  targetPair: DoubleDatePair | null;
  loading: boolean;
  swiping: boolean;
  onSwipe: (targetPairId: string, direction: "like" | "pass") => Promise<void>;
  onRefresh: () => void;
}) {
  if (loading && !targetPair) {
    return (
      <View style={styles.deckCenter}>
        <ActivityIndicator color={ROSE} />
        <Text style={styles.centerTitle}>Finding active duos</Text>
      </View>
    );
  }

  if (!targetPair) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="sparkles" size={34} color={AMBER} />
        <Text style={styles.emptyTitle}>No more duos right now</Text>
        <Text style={styles.emptyText}>Already swiped pairs stay hidden. Refresh when new pairs go active.</Text>
        <Pressable onPress={onRefresh} style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}>
          <Ionicons name="refresh" size={16} color={INK} />
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.deckRoot}>
      <View pointerEvents="none" style={styles.deckShadowOne} />
      <View pointerEvents="none" style={styles.deckShadowTwo} />
      <DuoDiscoveryCard
        key={targetPair.id}
        myPair={myPair}
        pair={targetPair}
        disabled={swiping}
        onSwipe={(direction) => onSwipe(targetPair.id, direction)}
      />
    </View>
  );
}

function DuoDiscoveryCard({
  myPair,
  pair,
  disabled,
  onSwipe,
}: {
  myPair: DoubleDatePair;
  pair: DoubleDatePair;
  disabled: boolean;
  onSwipe: (direction: "like" | "pass") => Promise<void>;
}) {
  const tx = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const rotate = tx.interpolate({ inputRange: [-420, 0, 420], outputRange: ["-9deg", "0deg", "9deg"] });
  const compatibility = useMemo(() => pair.compatibilityHints?.slice(0, 3) ?? [], [pair.compatibilityHints]);

  const playSwipe = (direction: "like" | "pass") => {
    if (disabled) return;
    Animated.parallel([
      Animated.timing(tx, { toValue: direction === "like" ? 520 : -520, duration: 230, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 230, useNativeDriver: true }),
    ]).start(() => {
      onSwipe(direction).finally(() => {
        tx.setValue(0);
        opacity.setValue(1);
      });
    });
  };

  return (
    <View style={styles.cardStage}>
      <Animated.View style={[styles.discoveryCard, { opacity, transform: [{ translateX: tx }, { rotate }] }]}>
        <View style={styles.splitPhotos}>
          {pair.users.slice(0, 2).map((user) => (
            <View key={user.id} style={styles.photoPane}>
              {user.photoUrl ? (
                <Image source={{ uri: user.photoUrl }} style={styles.photo} contentFit="cover" />
              ) : (
                <View style={[styles.photo, styles.photoFallback]}>
                  <Ionicons name="person" size={42} color={INK} />
                </View>
              )}
            </View>
          ))}
          <View style={styles.photoDivider} />
          <LinearGradient
            pointerEvents="none"
            colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.40)", "rgba(0,0,0,0.96)"]}
            locations={[0, 0.52, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>

        <View style={styles.cardTop}>
          {pair.activeTonight ? <Pill label="Active tonight" tone="green" /> : null}
          <Pill label="Double Date" tone="rose" />
        </View>

        <View style={styles.cardBottom}>
          <Text style={styles.cardNames} numberOfLines={1}>
            {pair.names.join(" + ")}
          </Text>
          <Text style={styles.cardLocation} numberOfLines={1}>
            {pair.location ?? "Miami"} - {Math.max(62, Math.min(98, Math.round(pair.score ?? 78)))}% group fit
          </Text>
          <View style={styles.tagRow}>
            {(pair.sharedVibeTags?.length ? pair.sharedVibeTags : pair.vibeTags).slice(0, 4).map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
          <View style={styles.hintBox}>
            {compatibility.map((hint) => (
              <View key={hint} style={styles.hintRow}>
                <Ionicons name="checkmark-circle" size={14} color={GREEN} />
                <Text style={styles.hintText}>{hint}</Text>
              </View>
            ))}
            {compatibility.length === 0 ? (
              <View style={styles.hintRow}>
                <Ionicons name="people-circle" size={14} color={BLUE} />
                <Text style={styles.hintText}>Pairs well with {myPair.names.join(" + ")}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Animated.View>

      <SideRail disabled={disabled} onPass={() => playSwipe("pass")} onLike={() => playSwipe("like")} />
    </View>
  );
}

function SideRail({
  disabled,
  onPass,
  onLike,
}: {
  disabled: boolean;
  onPass: () => void;
  onLike: () => void;
}) {
  return (
    <View style={styles.rail} pointerEvents="box-none">
      <RailButton icon="close" label="Pass" tint="#fb7185" disabled={disabled} onPress={onPass} />
      <RailButton icon="heart" label="Like" tint={GREEN} disabled={disabled} onPress={onLike} />
    </View>
  );
}

function RailButton({
  icon,
  label,
  tint,
  disabled,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tint: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Pressable
      disabled={disabled}
      onPressIn={() => Animated.spring(scale, { toValue: 0.9, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start()}
      onPress={onPress}
      style={styles.railButton}
    >
      <Animated.View
        style={[
          styles.railCircle,
          {
            borderColor: tint,
            shadowColor: tint,
            opacity: disabled ? 0.55 : 1,
            transform: [{ scale }],
          },
        ]}
      >
        <Ionicons name={icon} size={28} color={tint} />
      </Animated.View>
      <Text style={styles.railLabel}>{label}</Text>
    </Pressable>
  );
}

function DoubleDateMatchModal({
  visible,
  result,
  onClose,
  onOpenChat,
}: {
  visible: boolean;
  result: Extract<SwipeResponse, { matched: true }> | null;
  onClose: () => void;
  onOpenChat: () => void;
}) {
  const users = result?.allUsers ?? [];
  const otherNames = result?.otherPair?.names.join(" + ") ?? "another duo";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <LinearGradient colors={["rgba(255,79,139,0.46)", "rgba(0,0,0,0.96)", "#000"]} style={StyleSheet.absoluteFill} />
        <Text style={styles.modalEyebrow}>Matched</Text>
        <Text style={styles.modalTitle}>It is a Double Date Match</Text>
        <Text style={styles.modalText}>A 4-person group chat with {otherNames} is ready in Connect.</Text>
        <View style={styles.modalAvatars}>
          {users.slice(0, 4).map((user, index) => (
            <View key={user.id} style={[styles.modalAvatar, { marginLeft: index === 0 ? 0 : -14 }]}>
              <Avatar user={user} size={64} />
            </View>
          ))}
        </View>
        <Pressable onPress={onOpenChat} style={({ pressed }) => [styles.modalPrimary, pressed && styles.pressed]}>
          <Ionicons name="chatbubbles" size={18} color={INK} />
          <Text style={styles.modalPrimaryText}>Open in Connect</Text>
        </Pressable>
        <Pressable onPress={onClose} style={({ pressed }) => [styles.modalSecondary, pressed && styles.pressed]}>
          <Text style={styles.modalSecondaryText}>Keep Browsing</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function Pill({ label, tone }: { label: string; tone: "green" | "rose" }) {
  return (
    <View style={[styles.pill, tone === "green" ? styles.pillGreen : styles.pillRose]}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.errorBox}>
      <Ionicons name="alert-circle" size={16} color="#fecdd3" />
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} style={styles.errorRetry}>
          <Text style={styles.errorRetryText}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Avatar({ user, size }: { user: DoubleDateUser; size: number }) {
  return user.photoUrl ? (
    <Image source={{ uri: user.photoUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />
  ) : (
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Ionicons name="person" size={Math.round(size * 0.42)} color={INK} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0, backgroundColor: BG },
  backdrop: { position: "absolute", left: -80, right: -80, top: -40, height: 240, borderRadius: 120 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  centerTitle: { color: INK, fontSize: 13, fontWeight: "800" },
  pressed: { opacity: 0.72 },

  pickScroll: { paddingBottom: 28, gap: 14 },
  pickHero: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    padding: 18,
    overflow: "hidden",
  },
  heroIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ROSE,
    shadowColor: ROSE,
    shadowOpacity: 0.48,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  heroTitle: { color: INK, fontSize: 30, fontWeight: "900", marginTop: 14 },
  heroText: { color: "rgba(255,255,255,0.78)", fontSize: 13, lineHeight: 20, fontWeight: "700", marginTop: 7, maxWidth: 330 },
  heroStatusRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 15 },
  heroStatusPill: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(0,0,0,0.24)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
  },
  heroStatusText: { color: "#fce7f3", fontSize: 10, fontWeight: "900" },
  sectionTitleRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 14 },
  sectionTitle: { color: INK, fontSize: 15, fontWeight: "900" },
  sectionSubtitle: { color: MUTED, fontSize: 11, fontWeight: "700", marginTop: 3 },
  sectionMeta: { color: MUTED, fontSize: 11, fontWeight: "900", textAlign: "right" },
  previewNotice: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.25)",
    backgroundColor: "rgba(96,165,250,0.10)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  previewNoticeText: { color: "#bfdbfe", fontSize: 11, fontWeight: "800", lineHeight: 16, flex: 1 },
  buddyList: { gap: 12 },
  buddyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.13)",
    backgroundColor: "rgba(17,16,20,0.94)",
    padding: 13,
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  buddyPhotoWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  activeDot: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 15,
    height: 15,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: PANEL,
    backgroundColor: GREEN,
  },
  buddyCopy: { flex: 1, minWidth: 0 },
  buddyTopRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  buddyName: { color: INK, fontSize: 17, fontWeight: "900", flex: 1, minWidth: 0 },
  buddyBadge: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4, maxWidth: 94 },
  buddyBadgeBlue: { backgroundColor: "rgba(96,165,250,0.18)" },
  buddyBadgeGreen: { backgroundColor: "rgba(52,211,153,0.17)" },
  buddyBadgeText: { color: "#e0f2fe", fontSize: 9, fontWeight: "900" },
  buddyLocation: { color: "rgba(255,255,255,0.78)", fontSize: 12, fontWeight: "900", marginTop: 4 },
  buddyMeta: { color: MUTED, fontSize: 12, fontWeight: "700", lineHeight: 16, marginTop: 3 },
  miniTagRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 9 },
  miniTag: { borderRadius: 999, backgroundColor: "rgba(96,165,250,0.16)", paddingHorizontal: 8, paddingVertical: 4, maxWidth: 88 },
  miniTagText: { color: "#bfdbfe", fontSize: 10, fontWeight: "900" },
  pickButton: { minWidth: 68, minHeight: 38, borderRadius: 999, backgroundColor: INK, paddingHorizontal: 14, paddingVertical: 10, alignItems: "center", justifyContent: "center" },
  pickButtonText: { color: BG, fontSize: 12, fontWeight: "900" },
  inviteButton: {
    minHeight: 48,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.34)",
    backgroundColor: "rgba(96,165,250,0.10)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  inviteButtonText: { color: "#bfdbfe", fontSize: 13, fontWeight: "900" },

  discoveryRoot: { flex: 1, minHeight: 0, gap: 10 },
  statusHeader: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: SOFT,
    backgroundColor: "rgba(255,255,255,0.055)",
    padding: 12,
  },
  statusFaces: { width: 84, height: 52, position: "relative" },
  statusAvatar: { position: "absolute", top: 2, borderWidth: 2, borderColor: BG, borderRadius: 26, overflow: "hidden" },
  statusCopy: { flex: 1, minWidth: 0 },
  statusEyebrow: { color: "#fda4af", fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.1 },
  statusTitle: { color: INK, fontSize: 16, fontWeight: "900", marginTop: 3 },
  statusMeta: { color: MUTED, fontSize: 11, fontWeight: "800", marginTop: 3 },
  changeButton: {
    minHeight: 36,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.10)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
  },
  changeButtonText: { color: INK, fontSize: 11, fontWeight: "900" },

  deckRoot: { flex: 1, minHeight: 0, position: "relative" },
  deckCenter: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  deckShadowOne: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 18,
    bottom: 8,
    borderRadius: 34,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: SOFT,
  },
  deckShadowTwo: {
    position: "absolute",
    left: 8,
    right: 8,
    top: 9,
    bottom: 17,
    borderRadius: 34,
    backgroundColor: "rgba(255,79,139,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,79,139,0.16)",
  },
  cardStage: { flex: 1, minHeight: 0, position: "relative" },
  discoveryCard: {
    flex: 1,
    minHeight: 430,
    borderRadius: 34,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "#050505",
  },
  splitPhotos: { ...StyleSheet.absoluteFillObject, flexDirection: "row" },
  photoPane: { flex: 1, overflow: "hidden" },
  photo: { width: "100%", height: "100%" },
  photoFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#20141d" },
  photoDivider: { position: "absolute", top: 0, bottom: 0, left: "50%", width: 1, backgroundColor: "rgba(255,255,255,0.18)" },
  cardTop: { position: "absolute", left: 14, right: 14, top: 14, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: "rgba(0,0,0,0.48)" },
  pillGreen: { borderColor: "rgba(52,211,153,0.62)" },
  pillRose: { borderColor: "rgba(255,79,139,0.62)" },
  pillText: { color: INK, fontSize: 10, fontWeight: "900" },
  cardBottom: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 18, paddingRight: 76 },
  cardNames: { color: INK, fontSize: 28, fontWeight: "900" },
  cardLocation: { color: "rgba(255,255,255,0.82)", fontSize: 12, fontWeight: "800", marginTop: 4 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 12 },
  tag: { borderRadius: 999, backgroundColor: "rgba(255,255,255,0.13)", paddingHorizontal: 9, paddingVertical: 5 },
  tagText: { color: INK, fontSize: 10, fontWeight: "900" },
  hintBox: { gap: 6, marginTop: 12 },
  hintRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  hintText: { color: "rgba(255,255,255,0.88)", fontSize: 12, fontWeight: "800", flex: 1 },
  rail: { position: "absolute", right: 10, top: 0, bottom: 0, width: 60, alignItems: "center", justifyContent: "center", gap: 18 },
  railButton: { alignItems: "center", gap: 7 },
  railCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.58)",
    shadowOpacity: 0.72,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  railLabel: { color: INK, fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.2 },

  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: SOFT,
    backgroundColor: "rgba(255,255,255,0.055)",
    padding: 22,
  },
  emptyTitle: { color: INK, fontSize: 20, fontWeight: "900", textAlign: "center" },
  emptyText: { color: MUTED, fontSize: 13, fontWeight: "700", lineHeight: 19, textAlign: "center" },
  refreshButton: {
    marginTop: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  refreshButtonText: { color: INK, fontSize: 12, fontWeight: "900" },
  errorBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(251,113,133,0.34)",
    backgroundColor: "rgba(244,63,94,0.13)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  errorText: { color: "#fecdd3", fontSize: 12, fontWeight: "800", flex: 1 },
  errorRetry: { borderRadius: 999, backgroundColor: "rgba(255,255,255,0.14)", paddingHorizontal: 10, paddingVertical: 6 },
  errorRetryText: { color: INK, fontSize: 11, fontWeight: "900" },

  modalRoot: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, backgroundColor: "#000" },
  modalEyebrow: { color: "#fecdd3", fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.4 },
  modalTitle: { color: INK, fontSize: 32, fontWeight: "900", textAlign: "center", marginTop: 8 },
  modalText: { color: "rgba(255,255,255,0.78)", fontSize: 15, fontWeight: "700", lineHeight: 21, textAlign: "center", marginTop: 8 },
  modalAvatars: { flexDirection: "row", alignItems: "center", marginVertical: 28 },
  modalAvatar: { borderWidth: 3, borderColor: "#000", borderRadius: 36, overflow: "hidden" },
  modalPrimary: {
    minWidth: 220,
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: ROSE,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 22,
  },
  modalPrimaryText: { color: INK, fontSize: 15, fontWeight: "900" },
  modalSecondary: { paddingHorizontal: 18, paddingVertical: 13, marginTop: 6 },
  modalSecondaryText: { color: MUTED, fontSize: 13, fontWeight: "900" },
  avatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#20141d" },
});
