import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import {
  Inter_500Medium,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Sora_700Bold, Sora_800ExtraBold, useFonts as useSoraFonts } from "@expo-google-fonts/sora";
import { Ionicons } from "@expo/vector-icons";
import { useFeedback } from "@/components/ActionFeedback";
import { useSessionState } from "@/hooks/useSessionState";
import { openChat } from "@/lib/routes";
import {
  createDoubleDatePair,
  getDoubleDateFeed,
  getDoubleDatePair,
  getPendingLikes,
  likeDoubleDatePair,
  passDoubleDatePair,
  pauseDoubleDatePair,
  undoDoubleDateSwipe,
  type DoubleDateMatch,
  type DoubleDatePair,
  type DoubleDateUser,
} from "../services/doubleDateApi";

// ─── Constants ────────────────────────────────────────────────────────────────
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const CARD_W = SCREEN_WIDTH - 32;
const CARD_H = SCREEN_HEIGHT * 0.62;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.32;
const SWIPE_UP_THRESHOLD = 80;
const FLY_DURATION = 280;
const UNDO_DURATION = 3500;

const PINK = "#FF299B";
const PURPLE = "#A855F7";
const BG = "#060306";
const CARD_BG = "#100715";
const LIKE_COLOR = "#00C864";
const NOPE_COLOR = "#FF4444";
const SPARK_COLOR = "#FFD700";
const MUTED = "#ffffff44";

const VIBE_TAGS = [
  "Dinner 🍽️",
  "Nightlife 🎉",
  "Brunch 🥂",
  "Rooftops 🌆",
  "Beach 🏖️",
  "Sports 🏀",
  "Live Music 🎶",
  "Sushi 🍣",
  "Hiking ⛰️",
  "Art & Culture 🎨",
  "Coffee ☕",
  "Dancing 💃",
  "Travel ✈️",
  "Chill Vibes 😌",
  "Weekend Plans 📅",
  "Active Tonight ⚡",
];

type ScreenState =
  | "loading"
  | "setup_step1"
  | "setup_step2"
  | "discover"
  | "empty";

type ActiveTab = "discover" | "pending";

type UndoEntry = {
  pairId: string;
  targetPairId: string;
  direction: "like" | "pass" | "spark";
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function avatarUri(user: DoubleDateUser | undefined) {
  return (
    user?.photoUrl ??
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name ?? "?")}&background=1a0f2e&color=fff&size=400`
  );
}

function stripEmoji(tag: string) {
  return tag.replace(/\s*[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").trim();
}

// ─── SwipeCard ────────────────────────────────────────────────────────────────
type SwipeCardProps = {
  pair: DoubleDatePair;
  onLike: () => void;
  onPass: () => void;
  onSpark: () => void;
  onExpand: () => void;
  isTop: boolean;
  ghostOffset: number;
};

function SwipeCard({ pair, onLike, onPass, onSpark, onExpand, isTop, ghostOffset }: SwipeCardProps) {
  const pan = useRef(new Animated.ValueXY()).current;
  const likeOpacity = useRef(new Animated.Value(0)).current;
  const nopeOpacity = useRef(new Animated.Value(0)).current;
  const sparkOpacity = useRef(new Animated.Value(0)).current;

  const rotate = pan.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
    outputRange: ["-18deg", "0deg", "18deg"],
    extrapolate: "clamp",
  });

  const cardScale = ghostOffset === 0 ? 1 : 0.93 - ghostOffset * 0.04;
  const cardTranslateY = ghostOffset === 0 ? 0 : ghostOffset * 12;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => isTop,
        onMoveShouldSetPanResponder: (_, gs) => isTop && (Math.abs(gs.dx) > 4 || Math.abs(gs.dy) > 4),
        onPanResponderMove: (_, gs) => {
          pan.setValue({ x: gs.dx, y: gs.dy });
          if (gs.dy < -30) {
            likeOpacity.setValue(0);
            nopeOpacity.setValue(0);
            sparkOpacity.setValue(Math.min(1, Math.abs(gs.dy) / SWIPE_UP_THRESHOLD));
          } else if (gs.dx > 20) {
            likeOpacity.setValue(Math.min(1, gs.dx / SWIPE_THRESHOLD));
            nopeOpacity.setValue(0);
            sparkOpacity.setValue(0);
          } else if (gs.dx < -20) {
            nopeOpacity.setValue(Math.min(1, Math.abs(gs.dx) / SWIPE_THRESHOLD));
            likeOpacity.setValue(0);
            sparkOpacity.setValue(0);
          } else {
            likeOpacity.setValue(0);
            nopeOpacity.setValue(0);
            sparkOpacity.setValue(0);
          }
        },
        onPanResponderRelease: (_, gs) => {
          if (gs.dy < -SWIPE_UP_THRESHOLD) {
            flyOff(0, -SCREEN_HEIGHT, onSpark);
          } else if (gs.dx > SWIPE_THRESHOLD) {
            flyOff(SCREEN_WIDTH * 1.5, gs.dy, onLike);
          } else if (gs.dx < -SWIPE_THRESHOLD) {
            flyOff(-SCREEN_WIDTH * 1.5, gs.dy, onPass);
          } else {
            Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
            likeOpacity.setValue(0);
            nopeOpacity.setValue(0);
            sparkOpacity.setValue(0);
          }
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isTop],
  );

  const flyOff = (x: number, y: number, callback: () => void) => {
    Animated.timing(pan, {
      toValue: { x, y },
      duration: FLY_DURATION,
      useNativeDriver: true,
    }).start(() => {
      pan.setValue({ x: 0, y: 0 });
      likeOpacity.setValue(0);
      nopeOpacity.setValue(0);
      sparkOpacity.setValue(0);
      callback();
    });
  };

  const user0 = pair.users?.[0];
  const user1 = pair.users?.[1];

  return (
    <Animated.View
      {...(isTop ? panResponder.panHandlers : {})}
      style={[
        styles.cardWrapper,
        {
          transform: isTop
            ? [{ translateX: pan.x }, { translateY: pan.y }, { rotate }]
            : [{ scale: cardScale }, { translateY: cardTranslateY }],
          zIndex: 10 - ghostOffset,
        },
      ]}
    >
      <Pressable onPress={isTop ? onExpand : undefined} style={styles.card}>
        {/* Duo photos */}
        <View style={styles.cardPhotoRow}>
          <Image
            source={{ uri: avatarUri(user0) }}
            style={[styles.cardPhoto, { borderTopLeftRadius: 20 }]}
            contentFit="cover"
            transition={200}
          />
          <View style={styles.cardPhotoDivider} />
          <Image
            source={{ uri: avatarUri(user1) }}
            style={[styles.cardPhoto, { borderTopRightRadius: 20 }]}
            contentFit="cover"
            transition={200}
          />
        </View>

        {/* Gradient footer */}
        <LinearGradient
          colors={["transparent", "rgba(6,3,6,0.92)", "#060306"]}
          style={styles.cardGradient}
        >
          <View style={styles.cardInfo}>
            <Text style={styles.cardNames} numberOfLines={1}>
              {pair.names?.join(" & ") ?? "Duo"}
            </Text>
            <Text style={styles.cardLocation}>{pair.location ?? "Miami"}</Text>
            <View style={styles.cardTagRow}>
              {(pair.vibeTags ?? []).slice(0, 4).map((tag) => (
                <View key={tag} style={styles.cardTag}>
                  <Text style={styles.cardTagText}>{stripEmoji(tag)}</Text>
                </View>
              ))}
            </View>
            {pair.compatibilityHints?.[0] ? (
              <Text style={styles.cardHint}>✦ {pair.compatibilityHints[0]}</Text>
            ) : null}
          </View>
        </LinearGradient>

        {/* Overlays — circular glow badges, no boxy rectangles */}
        <Animated.View style={[styles.overlayBadge, styles.overlayBadgeLike, { opacity: likeOpacity }]}>
          <Ionicons name="heart" size={36} color={LIKE_COLOR} />
        </Animated.View>
        <Animated.View style={[styles.overlayBadge, styles.overlayBadgeNope, { opacity: nopeOpacity }]}>
          <Ionicons name="close" size={40} color={NOPE_COLOR} />
        </Animated.View>
        <Animated.View style={[styles.overlayBadge, styles.overlayBadgeSpark, { opacity: sparkOpacity }]}>
          <Ionicons name="flash" size={36} color={SPARK_COLOR} />
        </Animated.View>

        {/* Active tonight pill */}
        {pair.activeTonight && (
          <View style={styles.activePill}>
            <Text style={styles.activePillText}>Active Tonight</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ─── ActionRail ───────────────────────────────────────────────────────────────
function ActionRail({ onPass, onSpark, onLike }: { onPass: () => void; onSpark: () => void; onLike: () => void }) {
  return (
    <View style={styles.actionRail}>
      <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPass]} onPress={onPass} activeOpacity={0.75}>
        <Ionicons name="close" size={30} color={NOPE_COLOR} />
      </TouchableOpacity>
      <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSpark]} onPress={onSpark} activeOpacity={0.75}>
        <Ionicons name="flash" size={28} color={SPARK_COLOR} />
      </TouchableOpacity>
      <TouchableOpacity style={[styles.actionBtn, styles.actionBtnLike]} onPress={onLike} activeOpacity={0.75}>
        <Ionicons name="heart" size={28} color={LIKE_COLOR} />
      </TouchableOpacity>
    </View>
  );
}

// ─── PickBuddyScreen ──────────────────────────────────────────────────────────
function PickBuddyScreen({
  friends,
  onSelect,
  currentUserId = "",
}: {
  friends: DoubleDateUser[];
  onSelect: (f: DoubleDateUser) => void;
  currentUserId?: string;
}) {
  const insets = useSafeAreaInsets();
  const { trigger: triggerInviteFeedback } = useFeedback("invite");

  const handleInvite = async () => {
    const deepLink = `https://connectsphere.app/doubledate/invite?ref=${currentUserId}`;
    try {
      const result = await Share.share({
        message: `🔥 Come be my wingman on ConnectSphere Double Date! Tap to join: ${deepLink}`,
        url: deepLink, // iOS only
        title: "Join me on Double Date",
      });
      if (result.action === Share.sharedAction) triggerInviteFeedback();
    } catch (e: unknown) {
      if (e instanceof Error && e.message !== "User did not share") {
        Alert.alert("Couldn't share", "Try again.");
      }
    }
  };

  return (
    <View style={[styles.setupScreen, { paddingTop: insets.top + 20 }]}>
      <Text style={styles.setupEyebrow}>Double Date</Text>
      <Text style={styles.setupTitle}>Pick your wingman</Text>
      <Text style={styles.setupSub}>You'll swipe on couples together.</Text>

      {/* Invite row — shows if no friends yet or always visible as an option */}
      <TouchableOpacity style={styles.inviteRow} onPress={handleInvite} activeOpacity={0.8}>
        <View style={styles.inviteIcon}>
          <Text style={{ fontSize: 22 }}>✉️</Text>
        </View>
        <View style={styles.buddyInfo}>
          <Text style={styles.buddyName}>Invite a friend</Text>
          <Text style={styles.buddyMeta}>Share your invite link</Text>
        </View>
        <Text style={{ color: PINK, fontSize: 20 }}>›</Text>
      </TouchableOpacity>

      {friends.length > 0 && (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.buddyList}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.buddyRow} onPress={() => onSelect(item)} activeOpacity={0.8}>
              <Image source={{ uri: avatarUri(item) }} style={styles.buddyAvatar} contentFit="cover" />
              <View style={styles.buddyInfo}>
                <Text style={styles.buddyName}>{item.name}</Text>
                <Text style={styles.buddyMeta}>{item.neighborhood ?? item.city ?? "Miami"}</Text>
              </View>
              <Text style={{ color: PINK, fontSize: 20 }}>›</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {friends.length === 0 && (
        <View style={styles.noFriendsBox}>
          <Text style={styles.noFriendsText}>No friends on Double Date yet.</Text>
          <Text style={styles.noFriendsSubText}>Invite a wingman above to get started!</Text>
        </View>
      )}
    </View>
  );
}

// ─── VibeTagScreen ────────────────────────────────────────────────────────────
function VibeTagScreen({ buddy, onConfirm, loading }: { buddy: DoubleDateUser; onConfirm: (tags: string[]) => void; loading: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const insets = useSafeAreaInsets();

  const toggle = (tag: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.setupScreen, { paddingTop: insets.top + 20, paddingBottom: 40 }]}>
      <Text style={styles.setupEyebrow}>Almost there</Text>
      <Text style={styles.setupTitle}>What's your vibe?</Text>
      <Text style={styles.setupSub}>You & {buddy.name} — pick what you're down for.</Text>
      <View style={styles.vibeGrid}>
        {VIBE_TAGS.map((tag) => {
          const active = selected.has(tag);
          return (
            <TouchableOpacity
              key={tag}
              style={[styles.vibeTag, active && styles.vibeTagActive]}
              onPress={() => toggle(tag)}
              activeOpacity={0.8}
            >
              <Text style={[styles.vibeTagText, active && styles.vibeTagTextActive]}>{tag}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity
        style={[styles.confirmBtn, (selected.size === 0 || loading) && { opacity: 0.5 }]}
        onPress={() => selected.size > 0 && onConfirm(Array.from(selected))}
        disabled={selected.size === 0 || loading}
        activeOpacity={0.8}
      >
        <LinearGradient colors={[PINK, PURPLE]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.confirmBtnGrad}>
          <Text style={styles.confirmBtnText}>{loading ? "Creating pair…" : "Start Swiping →"}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── PairHeader ───────────────────────────────────────────────────────────────
function PairHeader({ pair, onPause }: { pair: DoubleDatePair; onPause: () => void }) {
  const user0 = pair.users?.[0];
  const user1 = pair.users?.[1];
  return (
    <View style={styles.pairHeader}>
      <View style={styles.pairAvatarStack}>
        <Image source={{ uri: avatarUri(user0) }} style={styles.pairAvatar} contentFit="cover" />
        <Image source={{ uri: avatarUri(user1) }} style={[styles.pairAvatar, { marginLeft: -10 }]} contentFit="cover" />
      </View>
      <View style={styles.pairHeaderBody}>
        <Text style={styles.pairHeaderNames} numberOfLines={1}>
          {pair.names?.join(" & ") ?? "Your Duo"}
        </Text>
        <View style={styles.pairTagRow}>
          {(pair.vibeTags ?? []).slice(0, 3).map((tag) => (
            <Text key={tag} style={styles.pairTagText}>{stripEmoji(tag)}</Text>
          ))}
        </View>
      </View>
      <TouchableOpacity onPress={onPause} style={styles.pairPauseBtn} activeOpacity={0.8}>
        <Text style={styles.pairPauseText}>Pause</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── DuoModal ─────────────────────────────────────────────────────────────────
function DuoModal({ pair, visible, onClose, onLike, onPass }: { pair: DoubleDatePair | null; visible: boolean; onClose: () => void; onLike: () => void; onPass: () => void }) {
  const insets = useSafeAreaInsets();
  if (!pair) return null;
  return (
    <Modal visible={visible} animationType="slide" transparent={false} statusBarTranslucent onRequestClose={onClose}>
      <LinearGradient colors={[CARD_BG, BG, BG]} style={{ flex: 1, paddingTop: insets.top }}>
        <ScrollView contentContainerStyle={styles.duoScrollContent} showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.duoClose} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.duoCloseText}>✕</Text>
          </TouchableOpacity>
          <View style={styles.duoPhotoRow}>
            {pair.users?.map((user) => (
              <View key={user.id} style={styles.duoProfileCard}>
                <Image source={{ uri: avatarUri(user) }} style={styles.duoProfilePhoto} contentFit="cover" />
                <Text style={styles.duoProfileName}>{user.name}</Text>
                <Text style={styles.duoProfileMeta}>
                  {[user.age, user.neighborhood].filter(Boolean).join(" · ")}
                </Text>
                {user.energy ? <Text style={styles.duoProfileEnergy}>"{user.energy}"</Text> : null}
              </View>
            ))}
          </View>
          <Text style={styles.duoSectionLabel}>Their Vibe</Text>
          <View style={styles.duoTagRow}>
            {(pair.vibeTags ?? []).map((tag) => (
              <View key={tag} style={styles.duoTagPill}>
                <Text style={styles.duoTagPillText}>{tag}</Text>
              </View>
            ))}
          </View>
          {pair.compatibilityHints?.length ? (
            <>
              <Text style={styles.duoSectionLabel}>Why You Match</Text>
              {pair.compatibilityHints.map((hint) => (
                <Text key={hint} style={styles.duoHint}>✦ {hint}</Text>
              ))}
            </>
          ) : null}
          {pair.users?.map((user) =>
            user.interests?.length ? (
              <View key={user.id}>
                <Text style={styles.duoSectionLabel}>{user.name}'s Interests</Text>
                <Text style={styles.duoInterests}>{user.interests.join("  ·  ")}</Text>
              </View>
            ) : null,
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
        <View style={[styles.duoActions, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity style={[styles.duoActionBtn, styles.duoActionPass]} onPress={onPass} activeOpacity={0.8}>
            <Text style={styles.duoActionText}>✗  Pass</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.duoActionBtn, styles.duoActionLike]} onPress={onLike} activeOpacity={0.8}>
            <LinearGradient colors={[PINK, PURPLE]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.duoActionGrad}>
              <Text style={styles.duoActionText}>❤️  Like</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </Modal>
  );
}

// ─── MatchModal ───────────────────────────────────────────────────────────────
function MatchModal({ visible, match, myPair, otherPair, onClose, onGoToChat }: { visible: boolean; match: DoubleDateMatch | null; myPair: DoubleDatePair | null; otherPair: DoubleDatePair | null; onClose: () => void; onGoToChat?: (chatId: string) => void }) {
  const insets = useSafeAreaInsets();
  const scale = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scale.setValue(0.7);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, tension: 60, friction: 6, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const allUsers = [...(myPair?.users ?? []), ...(otherPair?.users ?? [])].slice(0, 4);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={[styles.matchBackdrop, { paddingTop: insets.top }]}>
        <Animated.View style={[styles.matchCard, { opacity, transform: [{ scale }] }]}>
          <LinearGradient colors={["#1a003a", "#2d0050", "#0d0020"]} style={styles.matchCardInner}>
            <View style={styles.matchGlow} />
            <Text style={styles.matchEyebrow}>It's a</Text>
            <Text style={styles.matchTitle}>Double Match! 🎉</Text>
            <Text style={styles.matchSub}>
              {myPair?.names?.join(" & ")} × {otherPair?.names?.join(" & ")}
            </Text>
            <View style={styles.matchAvatarRow}>
              {allUsers.map((user, i) => (
                <View key={user.id} style={[styles.matchAvatarWrap, i > 0 && { marginLeft: -12 }]}>
                  <Image source={{ uri: avatarUri(user) }} style={styles.matchAvatar} contentFit="cover" />
                </View>
              ))}
            </View>
            <Text style={styles.matchCaption}>A 4-person group chat is ready for you.</Text>
            <TouchableOpacity
              style={styles.matchBtn}
              onPress={() => { onClose(); if (match?.chatId && onGoToChat) onGoToChat(match.chatId); }}
              activeOpacity={0.8}
            >
              <LinearGradient colors={[PINK, PURPLE]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.matchBtnGrad}>
                <Text style={styles.matchBtnText}>Open Group Chat →</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.matchKeepSwiping}>Keep Swiping</Text>
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── UndoToast ────────────────────────────────────────────────────────────────
function UndoToast({ visible, direction, onUndo }: { visible: boolean; direction: "like" | "pass" | "spark" | null; onUndo: () => void }) {
  const translateY = useRef(new Animated.Value(80)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 80, duration: 200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const label = direction === "like" ? "❤️ Liked" : direction === "spark" ? "⚡ Sparked" : "✗ Passed";

  return (
    <Animated.View style={[styles.undoToast, { opacity, transform: [{ translateY }] }]}>
      <Text style={styles.undoToastLabel}>{label}</Text>
      <TouchableOpacity onPress={onUndo} activeOpacity={0.8} style={styles.undoToastBtn}>
        <Text style={styles.undoToastBtnText}>Undo</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── PendingCard ──────────────────────────────────────────────────────────────
function PendingCard({ pair, onExpand }: { pair: DoubleDatePair; onExpand: () => void }) {
  const user0 = pair.users?.[0];
  const user1 = pair.users?.[1];
  return (
    <TouchableOpacity style={styles.pendingCard} onPress={onExpand} activeOpacity={0.85}>
      <View style={styles.pendingPhotoStack}>
        <Image source={{ uri: avatarUri(user0) }} style={styles.pendingPhoto} contentFit="cover" />
        <Image source={{ uri: avatarUri(user1) }} style={[styles.pendingPhoto, { marginLeft: -14 }]} contentFit="cover" />
      </View>
      <View style={styles.pendingBody}>
        <Text style={styles.pendingNames}>{pair.names?.join(" & ") ?? "Duo"}</Text>
        <Text style={styles.pendingLocation}>{pair.location ?? "Miami"}</Text>
        <Text style={styles.pendingWaiting}>Waiting for them to like you back</Text>
      </View>
      <View style={styles.pendingHeart}>
        <LinearGradient colors={[PINK, PURPLE]} style={styles.pendingHeartGrad}>
          <Text style={{ fontSize: 16 }}>❤️</Text>
        </LinearGradient>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DoubleDateTab() {
  const { userId } = useSessionState();
  const currentUserId = userId ?? "";
  useFonts({ Inter_500Medium, Inter_700Bold, Inter_800ExtraBold });
  useSoraFonts({ Sora_700Bold, Sora_800ExtraBold });

  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [screen, setScreen] = useState<ScreenState>("loading");
  const [activeTab, setActiveTab] = useState<ActiveTab>("discover");
  const [myPair, setMyPair] = useState<DoubleDatePair | null>(null);
  const [friends, setFriends] = useState<DoubleDateUser[]>([]);
  const [selectedBuddy, setSelectedBuddy] = useState<DoubleDateUser | null>(null);
  const [feed, setFeed] = useState<DoubleDatePair[]>([]);
  const [pending, setPending] = useState<DoubleDatePair[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [expandedPair, setExpandedPair] = useState<DoubleDatePair | null>(null);
  const [matchData, setMatchData] = useState<{ match: DoubleDateMatch; otherPair: DoubleDatePair } | null>(null);
  const [showMatch, setShowMatch] = useState(false);
  const [undoEntry, setUndoEntry] = useState<UndoEntry | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Micro-animation feedback ──────────────────────────────────────────────
  const { trigger: triggerLike } = useFeedback("like");
  const { trigger: triggerSpark } = useFeedback("spark");
  const { trigger: triggerDoubleDate } = useFeedback("double_date");

  const loadFeed = useCallback(async (pairId: string) => {
    try {
      const res = await getDoubleDateFeed(pairId);
      setFeed(res.pairs ?? []);
      setCardIndex(0);
    } catch {
      setFeed([]);
    }
  }, []);

  const loadPair = useCallback(async () => {
    try {
      if (!currentUserId) {
        setScreen("setup_step1");
        return;
      }
      setScreen("loading");
      const res = await getDoubleDatePair(currentUserId);
      if (res.pair) {
        setMyPair(res.pair);
        await loadFeed(res.pair.id);
        setScreen("discover");
      } else {
        setFriends(res.connectedFriends ?? []);
        setScreen("setup_step1");
      }
    } catch {
      setScreen("setup_step1");
    }
  }, [currentUserId, loadFeed]);

  useEffect(() => {
    loadPair();
  }, [loadPair]);

  const loadPending = async (pairId: string) => {
    try {
      const res = await getPendingLikes(pairId);
      setPending(res.pairs ?? []);
    } catch {
      setPending([]);
    }
  };

  const handlePickBuddy = (friend: DoubleDateUser) => {
    setSelectedBuddy(friend);
    setScreen("setup_step2");
  };

  const handleConfirmVibeTags = async (tags: string[]) => {
    if (!selectedBuddy || !currentUserId) return;
    setLoadingCreate(true);
    try {
      const res = await createDoubleDatePair(currentUserId, selectedBuddy.id, tags);
      if (res.pair) {
        setMyPair(res.pair);
        await loadFeed(res.pair.id);
        setScreen("discover");
      }
    } catch {}
    setLoadingCreate(false);
  };

  const handlePause = async () => {
    if (!myPair || !currentUserId) return;
    try {
      await pauseDoubleDatePair(myPair.id, currentUserId);
    } catch {}
    setMyPair(null);
    setFeed([]);
    await loadPair();
  };

  const handleTabSwitch = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab === "pending" && myPair) loadPending(myPair.id);
  };

  const currentCard = feed[cardIndex] ?? null;

  const triggerUndo = (pairId: string, targetPairId: string, direction: UndoEntry["direction"]) => {
    setUndoEntry({ pairId, targetPairId, direction });
    setShowUndo(true);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => {
      setShowUndo(false);
      setUndoEntry(null);
    }, UNDO_DURATION);
  };

  const handleLike = useCallback(async () => {
    if (!myPair || !currentCard || !currentUserId) return;
    const targetId = currentCard.id;
    triggerLike();
    setCardIndex((prev) => prev + 1);
    triggerUndo(myPair.id, targetId, "like");
    try {
      const res = await likeDoubleDatePair(myPair.id, targetId, "like", currentUserId);
      if (res.matched) {
        triggerDoubleDate();
        setMatchData({ match: res.match, otherPair: (res as any).otherPair ?? currentCard });
        setShowMatch(true);
      }
    } catch {}
  }, [currentUserId, myPair, currentCard, triggerLike, triggerDoubleDate]);

  const handlePass = useCallback(async () => {
    if (!myPair || !currentCard || !currentUserId) return;
    const targetId = currentCard.id;
    setCardIndex((prev) => prev + 1);
    triggerUndo(myPair.id, targetId, "pass");
    try {
      await passDoubleDatePair(myPair.id, targetId, currentUserId);
    } catch {}
  }, [currentUserId, myPair, currentCard]);

  const handleSpark = useCallback(async () => {
    if (!myPair || !currentCard || !currentUserId) return;
    const targetId = currentCard.id;
    triggerSpark();
    setCardIndex((prev) => prev + 1);
    triggerUndo(myPair.id, targetId, "spark");
    try {
      const res = await likeDoubleDatePair(myPair.id, targetId, "spark", currentUserId);
      if (res.matched) {
        triggerDoubleDate();
        setMatchData({ match: res.match, otherPair: (res as any).otherPair ?? currentCard });
        setShowMatch(true);
      }
    } catch {}
  }, [currentUserId, myPair, currentCard, triggerSpark, triggerDoubleDate]);

  const handleUndo = async () => {
    if (!undoEntry || !myPair) return;
    setShowUndo(false);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    try {
      await undoDoubleDateSwipe(myPair.id);
      setCardIndex((prev) => Math.max(0, prev - 1));
    } catch {}
    setUndoEntry(null);
  };

  const expandedLike = async () => { closeExpanded(); await handleLike(); };
  const expandedPass = async () => { closeExpanded(); await handlePass(); };
  const openExpanded = (pair: DoubleDatePair) => setExpandedPair(pair);
  const closeExpanded = () => setExpandedPair(null);

  const deckDone = cardIndex >= feed.length;

  // ── Render ────────────────────────────────────────────────────────────────
  if (screen === "loading") {
    return (
      <View style={[styles.center, { flex: 1, backgroundColor: BG }]}>
        <Text style={{ color: PINK, fontFamily: "Sora_700Bold", fontSize: 17 }}>Loading…</Text>
      </View>
    );
  }

  if (screen === "setup_step1") {
    return (
      <View style={{ flex: 1, backgroundColor: BG }}>
        <PickBuddyScreen friends={friends} onSelect={handlePickBuddy} currentUserId={currentUserId} />
      </View>
    );
  }

  if (screen === "setup_step2" && selectedBuddy) {
    return (
      <View style={{ flex: 1, backgroundColor: BG }}>
        <VibeTagScreen buddy={selectedBuddy} onConfirm={handleConfirmVibeTags} loading={loadingCreate} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Double Date</Text>
        <Text style={styles.headerSub}>Swipe as a duo</Text>
      </View>

      {/* Pair banner */}
      {myPair && <PairHeader pair={myPair} onPause={handlePause} />}

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBarItem, activeTab === "discover" && styles.tabBarItemActive]}
          onPress={() => handleTabSwitch("discover")}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabBarText, activeTab === "discover" && styles.tabBarTextActive]}>
            Discover
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBarItem, activeTab === "pending" && styles.tabBarItemActive]}
          onPress={() => handleTabSwitch("pending")}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={[styles.tabBarText, activeTab === "pending" && styles.tabBarTextActive]}>
              Liked You
            </Text>
            {pending.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{pending.length}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Discover ── */}
      {activeTab === "discover" && (
        <View style={styles.discoverContainer}>
          {deckDone ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🎴</Text>
              <Text style={styles.emptyTitle}>You've seen everyone</Text>
              <Text style={styles.emptySub}>Check back soon for new duos.</Text>
              <TouchableOpacity
                style={styles.refreshBtn}
                onPress={() => myPair && loadFeed(myPair.id)}
                activeOpacity={0.8}
              >
                <LinearGradient colors={[PINK, PURPLE]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.refreshBtnGrad}>
                  <Text style={styles.refreshBtnText}>Refresh Feed</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.cardStack}>
                {/* Ghost card (next) */}
                {feed[cardIndex + 1] && (
                  <SwipeCard
                    key={feed[cardIndex + 1].id + "_ghost"}
                    pair={feed[cardIndex + 1]}
                    isTop={false}
                    ghostOffset={1}
                    onLike={handleLike}
                    onPass={handlePass}
                    onSpark={handleSpark}
                    onExpand={() => {}}
                  />
                )}
                {/* Top card */}
                {feed[cardIndex] && (
                  <SwipeCard
                    key={feed[cardIndex].id}
                    pair={feed[cardIndex]}
                    isTop={true}
                    ghostOffset={0}
                    onLike={handleLike}
                    onPass={handlePass}
                    onSpark={handleSpark}
                    onExpand={() => openExpanded(feed[cardIndex])}
                  />
                )}
              </View>
              <Text style={styles.tapHint}>Tap card to see their full profiles</Text>
              <ActionRail onPass={handlePass} onSpark={handleSpark} onLike={handleLike} />
            </>
          )}
        </View>
      )}

      {/* ── Pending ── */}
      {activeTab === "pending" && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.pendingList} showsVerticalScrollIndicator={false}>
          {pending.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>💌</Text>
              <Text style={styles.emptyTitle}>No pending likes yet</Text>
              <Text style={styles.emptySub}>Duos you've liked will appear here while you wait.</Text>
            </View>
          ) : (
            pending.map((pair) => (
              <PendingCard key={pair.id} pair={pair} onExpand={() => openExpanded(pair)} />
            ))
          )}
        </ScrollView>
      )}

      {/* Undo toast */}
      <UndoToast visible={showUndo} direction={undoEntry?.direction ?? null} onUndo={handleUndo} />

      {/* Duo expanded modal */}
      <DuoModal pair={expandedPair} visible={!!expandedPair} onClose={closeExpanded} onLike={expandedLike} onPass={expandedPass} />

      {/* Match modal */}
      <MatchModal
        visible={showMatch}
        match={matchData?.match ?? null}
        myPair={myPair}
        otherPair={matchData?.otherPair ?? null}
        onClose={() => setShowMatch(false)}
        onGoToChat={(chatId) => {
          setShowMatch(false);
          openChat(chatId);
        }}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  headerTitle: {
    fontFamily: "Sora_800ExtraBold",
    fontSize: 26,
    color: "#fff",
    letterSpacing: -0.5,
  },
  headerSub: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: MUTED,
    marginTop: 1,
  },

  // Pair header
  pairHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    backgroundColor: "#1a0a2e",
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: "#ffffff12",
  },
  pairAvatarStack: { flexDirection: "row" },
  pairAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: BG,
  },
  pairHeaderBody: { flex: 1, marginLeft: 8 },
  pairHeaderNames: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#fff" },
  pairTagRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 2 },
  pairTagText: { fontFamily: "Inter_500Medium", fontSize: 11, color: PINK },
  pairPauseBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#ffffff10",
  },
  pairPauseText: { fontFamily: "Inter_500Medium", fontSize: 12, color: "#ffffff88" },

  // Tab bar
  tabBar: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: "#100a1e",
    borderRadius: 12,
    padding: 3,
  },
  tabBarItem: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center" },
  tabBarItemActive: { backgroundColor: "#2a0845" },
  tabBarText: { fontFamily: "Inter_500Medium", fontSize: 13, color: "#ffffff55" },
  tabBarTextActive: { color: PINK, fontFamily: "Inter_700Bold" },

  // Discover
  discoverContainer: { flex: 1, alignItems: "center" },
  cardStack: {
    width: CARD_W,
    height: CARD_H,
    marginTop: 12,
  },
  cardWrapper: {
    position: "absolute",
    width: CARD_W,
    height: CARD_H,
  },
  card: {
    flex: 1,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: CARD_BG,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  cardPhotoRow: { flexDirection: "row", height: "70%" },
  cardPhoto: { flex: 1, height: "100%" },
  cardPhotoDivider: { width: 2, backgroundColor: BG },
  cardGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "55%",
    justifyContent: "flex-end",
    padding: 16,
  },
  cardInfo: { gap: 4 },
  cardNames: { fontFamily: "Sora_800ExtraBold", fontSize: 22, color: "#fff", letterSpacing: -0.3 },
  cardLocation: { fontFamily: "Inter_500Medium", fontSize: 13, color: "#ffffff88" },
  cardTagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  cardTag: { backgroundColor: "#ffffff1a", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  cardTagText: { fontFamily: "Inter_500Medium", fontSize: 11, color: "#ffffffcc" },
  cardHint: { fontFamily: "Inter_500Medium", fontSize: 12, color: PINK, marginTop: 2 },
  activePill: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: PINK + "cc",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  activePillText: { fontFamily: "Inter_700Bold", fontSize: 11, color: "#fff" },

  // Overlays
  // Circular glow badge overlays (no boxy rectangles)
  overlayBadge: {
    position: "absolute",
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    top: "38%",
  },
  overlayBadgeLike: {
    right: 24,
    backgroundColor: LIKE_COLOR + "22",
    borderWidth: 3,
    borderColor: LIKE_COLOR,
    shadowColor: LIKE_COLOR,
    shadowOpacity: 0.7,
    shadowRadius: 14,
    elevation: 10,
  },
  overlayBadgeNope: {
    left: 24,
    backgroundColor: NOPE_COLOR + "22",
    borderWidth: 3,
    borderColor: NOPE_COLOR,
    shadowColor: NOPE_COLOR,
    shadowOpacity: 0.7,
    shadowRadius: 14,
    elevation: 10,
  },
  overlayBadgeSpark: {
    alignSelf: "center",
    left: "38%",
    top: 20,
    backgroundColor: SPARK_COLOR + "22",
    borderWidth: 3,
    borderColor: SPARK_COLOR,
    shadowColor: SPARK_COLOR,
    shadowOpacity: 0.8,
    shadowRadius: 14,
    elevation: 10,
  },
  // Tab badge
  tabBadge: {
    backgroundColor: PINK,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  tabBadgeText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },
  tapHint: { fontFamily: "Inter_500Medium", fontSize: 12, color: "#ffffff33", marginTop: 10 },

  // Action rail
  actionRail: {
    flexDirection: "row",
    gap: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    marginBottom: 12,
  },
  actionBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  actionBtnPass: { backgroundColor: "#1e0030", borderWidth: 2, borderColor: NOPE_COLOR + "66" },
  actionBtnSpark: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#1e1400",
    borderWidth: 2,
    borderColor: SPARK_COLOR + "88",
  },
  actionBtnLike: { backgroundColor: "#001e10", borderWidth: 2, borderColor: LIKE_COLOR + "66" },
  actionBtnIcon: { fontSize: 24 },

  // Empty / deck done
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyIcon: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { fontFamily: "Sora_700Bold", fontSize: 20, color: "#fff", textAlign: "center", marginBottom: 8 },
  emptySub: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: MUTED,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 20,
    marginBottom: 28,
  },
  refreshBtn: { borderRadius: 14, overflow: "hidden" },
  refreshBtnGrad: { paddingHorizontal: 28, paddingVertical: 14 },
  refreshBtnText: { fontFamily: "Inter_800ExtraBold", fontSize: 15, color: "#fff" },

  // Setup
  setupScreen: { flex: 1, paddingHorizontal: 20, backgroundColor: BG },
  setupEyebrow: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: PINK,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  setupTitle: { fontFamily: "Sora_800ExtraBold", fontSize: 30, color: "#fff", letterSpacing: -0.5, marginBottom: 6 },
  setupSub: { fontFamily: "Inter_500Medium", fontSize: 14, color: MUTED, marginBottom: 24 },

  // Buddy list
  buddyList: { gap: 10, marginTop: 4 },
  inviteRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: PINK + "18",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1.5,
    borderColor: PINK + "44",
    marginBottom: 14,
  },
  inviteIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: PINK + "22",
    alignItems: "center",
    justifyContent: "center",
  },
  noFriendsBox: {
    alignItems: "center",
    paddingTop: 40,
    gap: 8,
  },
  noFriendsText: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
  noFriendsSubText: { fontFamily: "Inter_500Medium", fontSize: 13, color: MUTED, textAlign: "center" },
  buddyRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a0a2e",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#ffffff0a",
  },
  buddyAvatar: { width: 52, height: 52, borderRadius: 26 },
  buddyInfo: { flex: 1, marginLeft: 12 },
  buddyName: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
  buddyMeta: { fontFamily: "Inter_500Medium", fontSize: 13, color: MUTED, marginTop: 2 },

  // Vibe tags
  vibeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 32 },
  vibeTag: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: "#1a0a2e",
    borderWidth: 1.5,
    borderColor: "#ffffff15",
  },
  vibeTagActive: { backgroundColor: PINK + "22", borderColor: PINK },
  vibeTagText: { fontFamily: "Inter_500Medium", fontSize: 13, color: "#ffffff88" },
  vibeTagTextActive: { color: PINK, fontFamily: "Inter_700Bold" },
  confirmBtn: { borderRadius: 16, overflow: "hidden", marginBottom: 32 },
  confirmBtnGrad: { paddingVertical: 16, alignItems: "center" },
  confirmBtnText: { fontFamily: "Inter_800ExtraBold", fontSize: 16, color: "#fff", letterSpacing: 0.3 },

  // Duo modal
  duoScrollContent: { padding: 20, paddingTop: 12 },
  duoClose: { alignSelf: "flex-end", padding: 10, marginBottom: 4 },
  duoCloseText: { fontSize: 18, color: "#ffffff66" },
  duoPhotoRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  duoProfileCard: { flex: 1, alignItems: "center" },
  duoProfilePhoto: { width: "100%", aspectRatio: 0.9, borderRadius: 16 },
  duoProfileName: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff", marginTop: 8 },
  duoProfileMeta: { fontFamily: "Inter_500Medium", fontSize: 12, color: MUTED, marginTop: 2 },
  duoProfileEnergy: { fontFamily: "Inter_500Medium", fontSize: 12, color: PINK, marginTop: 4, fontStyle: "italic", textAlign: "center" },
  duoSectionLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: "#ffffff55",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 12,
  },
  duoTagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  duoTagPill: { backgroundColor: "#ffffff10", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  duoTagPillText: { fontFamily: "Inter_500Medium", fontSize: 13, color: "#ffffffcc" },
  duoHint: { fontFamily: "Inter_500Medium", fontSize: 14, color: PINK, marginBottom: 4 },
  duoInterests: { fontFamily: "Inter_500Medium", fontSize: 13, color: "#ffffffaa", lineHeight: 20 },
  duoActions: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: BG,
    borderTopWidth: 1,
    borderTopColor: "#ffffff10",
  },
  duoActionBtn: { flex: 1, borderRadius: 16, overflow: "hidden", height: 52, alignItems: "center", justifyContent: "center" },
  duoActionPass: { backgroundColor: "#1e0030", borderWidth: 1.5, borderColor: NOPE_COLOR + "44" },
  duoActionLike: { overflow: "hidden" },
  duoActionGrad: { flex: 1, width: "100%", alignItems: "center", justifyContent: "center" },
  duoActionText: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff" },

  // Match modal
  matchBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.88)", alignItems: "center", justifyContent: "center", padding: 24 },
  matchCard: { width: "100%", borderRadius: 28, overflow: "hidden" },
  matchCardInner: { padding: 32, alignItems: "center" },
  matchGlow: {
    position: "absolute",
    top: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: PINK + "22",
  },
  matchEyebrow: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#ffffff66", textTransform: "uppercase", letterSpacing: 2, marginBottom: 4 },
  matchTitle: { fontFamily: "Sora_800ExtraBold", fontSize: 36, color: "#fff", marginBottom: 8, textAlign: "center" },
  matchSub: { fontFamily: "Inter_500Medium", fontSize: 15, color: PINK, textAlign: "center", marginBottom: 24 },
  matchAvatarRow: { flexDirection: "row", marginBottom: 16 },
  matchAvatarWrap: { borderWidth: 3, borderColor: BG, borderRadius: 36, overflow: "hidden" },
  matchAvatar: { width: 66, height: 66 },
  matchCaption: { fontFamily: "Inter_500Medium", fontSize: 14, color: "#ffffff66", textAlign: "center", marginBottom: 28 },
  matchBtn: { width: "100%", borderRadius: 16, overflow: "hidden", marginBottom: 14 },
  matchBtnGrad: { paddingVertical: 16, alignItems: "center" },
  matchBtnText: { fontFamily: "Inter_800ExtraBold", fontSize: 16, color: "#fff", letterSpacing: 0.3 },
  matchKeepSwiping: { fontFamily: "Inter_500Medium", fontSize: 14, color: "#ffffff44" },

  // Undo toast
  undoToast: {
    position: "absolute",
    bottom: 100,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e0835",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 14,
    borderWidth: 1,
    borderColor: PINK + "44",
    shadowColor: PINK,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  undoToastLabel: { fontFamily: "Inter_500Medium", fontSize: 13, color: "#fff" },
  undoToastBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: PINK + "22",
    borderWidth: 1,
    borderColor: PINK + "66",
  },
  undoToastBtnText: { fontFamily: "Inter_700Bold", fontSize: 13, color: PINK },

  // Pending tab
  pendingList: { padding: 16, gap: 12 },
  pendingCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#100a1e",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#ffffff0d",
    gap: 12,
  },
  pendingPhotoStack: { flexDirection: "row" },
  pendingPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: BG,
  },
  pendingBody: { flex: 1, gap: 2 },
  pendingNames: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff" },
  pendingLocation: { fontFamily: "Inter_500Medium", fontSize: 12, color: "#ffffff55" },
  pendingWaiting: { fontFamily: "Inter_500Medium", fontSize: 11, color: PINK + "aa" },
  pendingHeart: { borderRadius: 20, overflow: "hidden" },
  pendingHeartGrad: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18 },

});
