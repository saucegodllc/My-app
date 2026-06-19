/**
 * Connect tab
 * Matches: incoming non-pass actions.
 * Chats: new matches and active conversations.
 */
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  LinearTransition,
  SlideInDown,
  SlideOutLeft,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DatingMatchModal, type DopamineMatch } from "@/components/DatingMatchModal";
import { useDatingMatches, type DatingShot } from "@/contexts/DatingMatchContext";
import { useFeedback } from "@/components/ActionFeedback";
import { MatchesSpotlightRow, type SpotlightMatch } from "@/components/MatchesSpotlightRow";
import { useSessionState } from "@/hooks/useSessionState";
import * as Clipboard from "expo-clipboard";
import { openChat, openPremium, openProfile as navigateProfile } from "@/lib/routes";
import { formatChatPreview, isPendingPlanPayload } from "@/lib/chatPayload";
import { shouldShowConnectMatchMoment } from "@/lib/connectMatchMomentPolicy";
import { parsePlanEnvelope } from "@/lib/planRequestEnvelope";
import { buildLocalConvs } from "@/lib/buildLocalConvs";
import {
  acceptRequest,
  declineRequest,
  getInboxReactions,
  getInboxRequests,
  getMutualMatchChats,
  ignoreReaction,
  likeBackReaction,
  type CsConversation,
  type CsReaction,
  type CsRequest,
  type ReactionCounts,
} from "@/services/connectApi";
import {
  buildIncomingActionCards,
  type IncomingActionCard,
} from "@/services/connectIncoming";
import { getPremiumEntitlement } from "@/services/launchReadyApi";

const PINK = "#FF2DA8";
const ROSE = "#FB3D8E";
const PURPLE = "#A855F7";
const BG = "#000000";
const CARD = "#101014";
const CARD2 = "#18181B";
const BORDER = "rgba(255,255,255,0.10)";
const TEXT = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.58)";
const FAINT = "rgba(255,255,255,0.32)";
const GREEN = "#22C55E";

type ConnectSegment = "matches" | "chats" | "moments";

function timeAgo(input: string | number | undefined): string {
  if (!input) return "";
  const ms = typeof input === "number" ? input : new Date(input).getTime();
  const diff = Date.now() - ms;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

async function haptic(kind: "light" | "medium" | "success" | "warning") {
  try {
    if (kind === "light") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (kind === "medium") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (kind === "success") await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (kind === "warning") await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {
    // Haptics are best-effort in Expo Go and simulators.
  }
}

function SegmentControl({
  value,
  pendingCount,
  chatCount,
  onChange,
}: {
  value: ConnectSegment;
  pendingCount: number;
  chatCount: number;
  onChange: (next: ConnectSegment) => void;
}) {
  const items: Array<{ key: ConnectSegment; label: string; count: number }> = [
    { key: "chats", label: "Chats", count: chatCount },
    { key: "matches", label: "Matches", count: pendingCount },
    { key: "moments", label: "Moments", count: 0 },
  ];

  return (
    <View style={styles.segmentWrap}>
      {items.map((item) => {
        const active = value === item.key;
        return (
          <Pressable
            key={item.key}
            onPress={() => {
              if (value !== item.key) void haptic("light");
              onChange(item.key);
            }}
            style={styles.segmentHit}
          >
            <View style={styles.segmentTab}>
              <View style={styles.segmentLabelRow}>
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{item.label}</Text>
                {item.count > 0 ? (
                  <View style={[styles.segmentBadge, active && styles.segmentBadgeActive]}>
                    <Text style={[styles.segmentBadgeText, active && styles.segmentBadgeTextActive]}>
                      {item.count > 99 ? "99+" : item.count}
                    </Text>
                  </View>
                ) : null}
              </View>
              {active ? (
                <Animated.View
                  entering={FadeIn.duration(160)}
                  style={styles.segmentUnderline}
                />
              ) : (
                <View style={styles.segmentUnderlineFaint} />
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function InviteModal({ visible, onClose, userId }: { visible: boolean; onClose: () => void; userId: string }) {
  const inviteLink = `https://connectsphere.app/invite/${userId}`;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Let's match on ConnectSphere 🔗 Join me and we'll connect instantly!\n${inviteLink}`,
        url: inviteLink,
        title: "Let's match on ConnectSphere",
      });
    } catch {
      // Share dismissed
    }
  };

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(inviteLink);
      await haptic("success");
    } catch {
      // Clipboard not available on this device
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.inviteOverlay} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()} style={styles.inviteSheet}>
          <LinearGradient
            colors={["#1A0A14", "#0D0D12"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.inviteHandle} />

          <View style={styles.inviteIconWrap}>
            <LinearGradient colors={[PINK, PURPLE]} style={styles.inviteIconGrad}>
              <Text style={{ fontSize: 26 }}>🔗</Text>
            </LinearGradient>
          </View>

          <Text style={styles.inviteTitle}>Invite to ConnectSphere</Text>
          <Text style={styles.inviteSub}>
            Share your personal link. When they sign up, you'll instantly match and land in each other's chats.
          </Text>

          <View style={styles.inviteLinkBox}>
            <Ionicons name="link" size={15} color={PINK} />
            <Text style={styles.inviteLinkText} numberOfLines={1}>{inviteLink}</Text>
          </View>

          <Pressable style={styles.inviteShareBtn} onPress={handleShare}>
            <LinearGradient colors={[PINK, ROSE]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.inviteShareGrad}>
              <Ionicons name="share-social" size={18} color="#fff" />
              <Text style={styles.inviteShareText}>Share Invite Link</Text>
            </LinearGradient>
          </Pressable>

          <View style={styles.inviteOptionsRow}>
            {[
              { icon: "logo-instagram" as const, label: "Instagram" },
              { icon: "chatbubble-ellipses" as const, label: "Message" },
              { icon: "copy" as const, label: "Copy Link" },
              { icon: "qr-code" as const, label: "QR Code" },
            ].map((opt) => (
              <Pressable key={opt.label} style={styles.inviteOption} onPress={opt.label === "Copy Link" ? handleCopy : handleShare}>
                <View style={styles.inviteOptionIcon}>
                  <Ionicons name={opt.icon} size={20} color={TEXT} />
                </View>
                <Text style={styles.inviteOptionLabel}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.inviteNote}>
            ✨ Instant match — no swiping needed
          </Text>

          <Pressable onPress={onClose} style={styles.inviteDismiss}>
            <Text style={styles.inviteDismissText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function IncomingActionCardView({
  card,
  index,
  onOpenProfile,
  onReveal,
  onLikeBack,
  onIgnore,
  onAccept,
  onDecline,
  actingId,
  isFreeMatch,
}: {
  card: IncomingActionCard;
  index: number;
  onOpenProfile: (card: IncomingActionCard) => void;
  onReveal: () => void;
  onLikeBack: (reaction: CsReaction) => void;
  onIgnore: (reaction: CsReaction) => void;
  onAccept: (request: CsRequest) => void;
  onDecline: (request: CsRequest) => void;
  actingId: string | null;
  isFreeMatch?: boolean;
}) {
  const scale = useSharedValue(1);
  const shake = useSharedValue(0);
  const ring = useSharedValue(0);
  const isActing = actingId === card.rawItem.id;
  const displayName = card.senderName
    ? `${card.senderName}${card.senderAge ? `, ${card.senderAge}` : ""}`
    : "Someone";
  const meta = card.senderNeighborhood ? card.senderNeighborhood : card.subtitle;
  const canOpenProfile = !card.isLocked && !!card.senderId;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: shake.value },
      { scale: scale.value },
    ],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.value,
    transform: [{ scale: 1 + ring.value * 0.18 }],
  }));
  const pixelTiles = useMemo(
    () =>
      Array.from({ length: 48 }, (_, tileIndex) => {
        const row = Math.floor(tileIndex / 6);
        const col = tileIndex % 6;
        const hot = (tileIndex + index) % 5 === 0;
        return {
          key: `${card.id}:pixel:${tileIndex}`,
          left: `${col * 16.67}%` as `${number}%`,
          top: `${row * 12.5}%` as `${number}%`,
          opacity: 0.14 + ((tileIndex + index) % 4) * 0.07,
          color: hot ? `${card.color}55` : tileIndex % 2 === 0 ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.20)",
        };
      }),
    [card.color, card.id, index],
  );

  const pressIn = () => {
    void haptic("light");
    scale.value = withSpring(0.97, { damping: 17, stiffness: 280 });
  };

  const pressOut = () => {
    scale.value = withSpring(1, { damping: 16, stiffness: 220 });
  };

  const handleCardPress = () => {
    if (card.isLocked) {
      void haptic("warning");
      scale.value = withSequence(
        withSpring(1.05, { damping: 10, stiffness: 260 }),
        withSpring(1, { damping: 14, stiffness: 220 }),
      );
      ring.value = withSequence(withTiming(1, { duration: 90 }), withTiming(0, { duration: 220 }));
      shake.value = withSequence(
        withTiming(-5, { duration: 45 }),
        withTiming(5, { duration: 45 }),
        withTiming(-3, { duration: 45 }),
        withTiming(0, { duration: 65 }),
      );
      setTimeout(onReveal, 230);
      return;
    }
    if (canOpenProfile) onOpenProfile(card);
  };

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 42).springify().damping(18).stiffness(140)}
      exiting={SlideOutLeft.duration(180)}
      layout={LinearTransition.springify().damping(18).stiffness(170)}
      style={styles.incomingCell}
    >
      <Animated.View style={[styles.incomingCard, animatedStyle]}>
        <Animated.View pointerEvents="none" style={[styles.lockPulse, { borderColor: card.color }, ringStyle]} />
        <Pressable
          onPress={handleCardPress}
          onPressIn={pressIn}
          onPressOut={pressOut}
          style={styles.cardPress}
        >
          {card.senderPhotoUrl ? (
            <Image
              source={{ uri: card.senderPhotoUrl }}
              style={styles.incomingPhoto}
              contentFit="cover"
              blurRadius={card.isLocked ? 18 : 0}
            />
          ) : (
            <LinearGradient colors={["#27212f", "#111111"]} style={styles.incomingPhotoFallback}>
              <Ionicons name="person" size={38} color={card.isLocked ? "rgba(255,255,255,0.18)" : MUTED} />
            </LinearGradient>
          )}
          {card.isLocked ? <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} /> : null}
          {card.isLocked ? (
            <View pointerEvents="none" style={styles.pixelVeil}>
              {pixelTiles.map((tile) => (
                <View
                  key={tile.key}
                  style={[
                    styles.pixelTile,
                    {
                      left: tile.left,
                      top: tile.top,
                      backgroundColor: tile.color,
                      opacity: tile.opacity,
                    },
                  ]}
                />
              ))}
            </View>
          ) : null}
          <LinearGradient
            colors={card.isLocked ? ["rgba(0,0,0,0.25)", "rgba(0,0,0,0.88)"] : ["transparent", "rgba(0,0,0,0.88)"]}
            style={StyleSheet.absoluteFill}
          />
          {card.isLocked ? <View style={styles.lockedVeil} /> : null}
          <View style={[styles.actionBadge, { borderColor: `${card.color}66`, backgroundColor: `${card.color}24` }]}>
            <Ionicons name={card.icon as keyof typeof Ionicons.glyphMap} size={11} color={card.color} />
            <Text style={[styles.actionBadgeText, { color: card.color }]}>{card.label}</Text>
          </View>
          {isFreeMatch ? (
            <View style={styles.freeMatchTag}>
              <Ionicons name="flash" size={10} color="#fff" />
              <Text style={styles.freeMatchText}>Free Match</Text>
            </View>
          ) : null}
          {!card.isLocked ? (
          <View style={styles.cardBottom}>
              <>
                <Text style={styles.cardName} numberOfLines={1}>{displayName}</Text>
                <Text style={styles.cardMeta} numberOfLines={1}>{meta}</Text>
              </>
          </View>
          ) : null}
        </Pressable>

        {!card.isLocked ? (
          <View style={styles.cardActions}>
            {card.sourceType === "reaction" ? (
              <>
                <Pressable
                  style={styles.ghostCircle}
                  onPress={() => {
                    void haptic("light");
                    onIgnore(card.rawItem);
                  }}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={17} color={MUTED} />
                </Pressable>
                <Pressable
                  style={[styles.primaryMiniBtn, { backgroundColor: card.color }, isActing && styles.disabled]}
                  onPress={() => {
                    void haptic("success");
                    onLikeBack(card.rawItem);
                  }}
                  disabled={isActing}
                >
                  {isActing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="heart" size={15} color="#fff" />
                  )}
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  style={styles.ghostCircle}
                  onPress={() => {
                    void haptic("light");
                    onDecline(card.rawItem);
                  }}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={17} color={MUTED} />
                </Pressable>
                <Pressable
                  style={[styles.primaryMiniBtn, { backgroundColor: card.color }, isActing && styles.disabled]}
                  onPress={() => {
                    void haptic("success");
                    onAccept(card.rawItem);
                  }}
                  disabled={isActing}
                >
                  {isActing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="checkmark" size={17} color="#fff" />
                  )}
                </Pressable>
              </>
            )}
          </View>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

function MessageRow({ conv, index, onPress }: { conv: CsConversation; index: number; onPress: () => void }) {
  const hasPendingPlan = isPendingPlanPayload(conv.lastMessageText);
  const typeColor = hasPendingPlan ? PURPLE : conv.type === "plan" ? "#34D399" : conv.type === "match" ? PINK : "#60A5FA";
  const typeIcon = hasPendingPlan ? "calendar" : conv.type === "plan" ? "calendar" : conv.type === "match" ? "heart" : "chatbubble-ellipses";
  return (
    <Animated.View entering={FadeInUp.delay(index * 38).duration(220)} layout={LinearTransition.springify()}>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.msgRow, pressed && styles.rowPressed]}>
        {/* Avatar is a separate pressable — opens profile; row opens chat */}
        <Pressable
          style={styles.msgAvatarWrap}
          onPress={(e) => {
            e.stopPropagation();
            if (conv.peerId) navigateProfile(conv.peerId, "matches", { name: conv.peerName, photoUrl: conv.peerPhotoUrl });
          }}
          hitSlop={4}
        >
          {conv.peerPhotoUrl ? (
            <Image source={{ uri: conv.peerPhotoUrl }} style={styles.msgAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.msgAvatar, styles.avatarFallback]}>
              <Ionicons name="person" size={24} color={MUTED} />
            </View>
          )}
          <View style={styles.onlineDot} />
        </Pressable>
        <View style={styles.msgBody}>
          <View style={styles.msgTopRow}>
            <Text style={styles.msgName} numberOfLines={1}>{conv.peerName ?? "Someone"}</Text>
            <Text style={styles.msgTime}>{timeAgo(conv.lastMessageAt ?? conv.createdAt)}</Text>
          </View>
          {/* Match expiry nudge — 7-day window.
               ≤1 day left (no messages): urgent red
               ≤3 days left (no messages): warm amber
               fresh match (no messages, plenty of time): default copy */}
          {(() => {
            if (!conv.lastMessageText && conv.createdAt) {
              const ageMs = Date.now() - new Date(conv.createdAt).getTime();
              const EXPIRY_MS = 7 * 24 * 3600 * 1000;
              const remainingDays = Math.max(0, Math.ceil((EXPIRY_MS - ageMs) / 864e5));
              if (remainingDays <= 1) {
                return (
                  <Text style={[styles.msgPreview, { color: "#F87171" }]} numberOfLines={1}>
                    ⏳ Last chance — expires today!
                  </Text>
                );
              }
              if (remainingDays <= 3) {
                return (
                  <Text style={[styles.msgPreview, { color: "#FBBF24" }]} numberOfLines={1}>
                    🕯️ {remainingDays} days left — say something!
                  </Text>
                );
              }
            }
            return (
              <Text style={styles.msgPreview} numberOfLines={1}>
                {conv.lastMessageText
                  ? `${conv.lastMessageIsMe ? "You: " : ""}${friendlyPreview(conv.lastMessageText)}`
                  : "New match — say something good."}
              </Text>
            );
          })()}
        </View>
        <View style={[styles.msgType, { borderColor: `${typeColor}55`, backgroundColor: `${typeColor}18` }]}>
          <Ionicons name={typeIcon as keyof typeof Ionicons.glyphMap} size={13} color={typeColor} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

// Plan request/response messages travel as machine-readable envelopes — show a
// friendly label in chat-list previews instead of the raw payload (spec 2.2).
function friendlyPreview(text: string): string {
  return formatChatPreview(text);
  const env = parsePlanEnvelope(text) as any;
  if (!env) return text;
  if (env?.kind === "request") return `📅 Plan request: ${env.request.title}`;
  if (env.kind === "response") {
    return env.response.status === "accepted" ? "✅ Plan accepted" : "Plan declined";
  }
  return text;
}

function FloatingHeart({ delay, x }: { delay: number; x: number }) {
  const ty = useSharedValue(0);
  const op = useSharedValue(0);

  useEffect(() => {
    const id = setTimeout(() => {
      ty.value = withRepeat(withTiming(-220, { duration: 2400 }), -1, false);
      op.value = withRepeat(
        withSequence(withTiming(1, { duration: 340 }), withTiming(0, { duration: 2060 })),
        -1, false,
      );
    }, delay);
    return () => clearTimeout(id);
  }, [delay, op, ty]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }], opacity: op.value }));
  return (
    <Animated.Text style={[{ position: "absolute", bottom: 40, fontSize: 18 }, { left: x }, style]}>
      💕
    </Animated.Text>
  );
}

// Starburst particle — tiny dot that flies outward on mount
function StarParticle({ angle, distance, delay }: { angle: number; distance: number; delay: number }) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const op = useSharedValue(0);
  const sc = useSharedValue(0);

  useEffect(() => {
    const id = setTimeout(() => {
      const rad = (angle * Math.PI) / 180;
      tx.value = withTiming(Math.cos(rad) * distance, { duration: 700 });
      ty.value = withTiming(Math.sin(rad) * distance, { duration: 700 });
      op.value = withSequence(withTiming(1, { duration: 120 }), withTiming(0, { duration: 580 }));
      sc.value = withSequence(withTiming(1.4, { duration: 200 }), withTiming(0.6, { duration: 500 }));
    }, delay);
    return () => clearTimeout(id);
  }, [angle, delay, distance, op, sc, tx, ty]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: sc.value }],
    opacity: op.value,
  }));
  return <Animated.View style={[styles.starParticle, style]} />;
}

function MatchMomentOverlay({
  name,
  photoUrl,
  onDismiss,
  onMessage,
  onMakePlan,
}: {
  name: string;
  photoUrl?: string;
  onDismiss: () => void;
  onMessage: () => void;
  onMakePlan?: () => void;
}) {
  const glow = useSharedValue(0.45);
  const ring = useSharedValue(0.6);
  const photoScale = useSharedValue(0.6);
  const [showParticles, setShowParticles] = useState(false);

  useEffect(() => {
    // Photo pops in with spring, then glow pulses
    photoScale.value = withSpring(1, { damping: 12, stiffness: 90 });
    // Trigger particles after the photo lands
    const id = setTimeout(() => setShowParticles(true), 420);
    glow.value = withRepeat(
      withSequence(withTiming(1, { duration: 1100 }), withTiming(0.45, { duration: 1100 })),
      -1, false,
    );
    ring.value = withRepeat(
      withSequence(withTiming(1, { duration: 1400 }), withTiming(0.6, { duration: 1400 })),
      -1, false,
    );
    return () => clearTimeout(id);
  }, [glow, photoScale, ring]);

  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: glow.value,
    shadowColor: PINK,
    shadowRadius: 48,
    shadowOffset: { width: 0, height: 0 },
    elevation: 22,
  }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: ring.value }));
  const photoStyle = useAnimatedStyle(() => ({ transform: [{ scale: photoScale.value }] }));

  // 8 particles at 45° increments, random distances
  const PARTICLES = [0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => ({
    angle,
    distance: 60 + (i % 3) * 22,
    delay: i * 28,
  }));

  const HEART_X = [18, 62, 112, 170, 228, 284];
  const HEART_D = [0, 520, 180, 760, 110, 600];

  return (
    <Animated.View
      entering={SlideInDown.springify().damping(18).stiffness(65)}
      exiting={FadeOut.duration(280)}
      style={styles.matchOverlay}
    >
      {/* Deep void backdrop — layered gradients for depth */}
      <LinearGradient
        colors={["#020008", "#0A0018", "#120030"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Ambient glow bloom behind the photo */}
      <View style={styles.matchBloom} pointerEvents="none" />

      {/* Floating hearts */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {HEART_X.map((x, i) => (
          <FloatingHeart key={i} delay={HEART_D[i]} x={x} />
        ))}
      </View>

      {/* Headline — enters from top */}
      <Animated.View entering={FadeInDown.delay(80).duration(380)} style={styles.matchHeaderBlock}>
        <Text style={styles.matchItS}>IT'S</Text>
        <Text style={styles.matchHeadline}>A MATCH</Text>
        <View style={styles.matchDivider} />
      </Animated.View>

      {/* Photo ring with starburst */}
      <Animated.View style={[styles.matchGlowRing, glowStyle]}>
        {showParticles && PARTICLES.map((p, i) => (
          <StarParticle key={i} angle={p.angle} distance={p.distance} delay={p.delay} />
        ))}
        <Animated.View style={[styles.matchRingOuter, ringStyle]}>
          <View style={styles.matchRingInner}>
            <Animated.View style={[{ flex: 1 }, photoStyle]}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.matchPhoto} contentFit="cover" />
              ) : (
                <View style={[styles.matchPhoto, styles.avatarFallback]}>
                  <Ionicons name="person" size={52} color="#fff" />
                </View>
              )}
            </Animated.View>
          </View>
        </Animated.View>
      </Animated.View>

      {/* Name + subhead — enters from bottom */}
      <Animated.View entering={FadeInUp.delay(260).springify().damping(14).stiffness(80)} style={styles.matchNameBlock}>
        <Text style={styles.cinematicMatchName}>{name}</Text>
        <Text style={styles.matchSubhead}>You two liked each other ✨</Text>
      </Animated.View>

      {/* CTAs — enter last */}
      <Animated.View entering={FadeInUp.delay(440).duration(320)} style={styles.matchCtaBlock}>
        <Pressable onPress={onMessage} style={styles.matchMessageBtn}>
          <LinearGradient
            colors={[PINK, "#C026D3", PURPLE]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.matchMessageGrad}
          >
            <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
            <Text style={styles.matchMessageText}>Send a Message</Text>
          </LinearGradient>
        </Pressable>

        {/* Make a plan — the differentiator shows up at the match moment */}
        {onMakePlan ? (
          <Pressable onPress={onMakePlan} style={styles.matchPlanBtn}>
            <Ionicons name="calendar" size={16} color={PINK} />
            <Text style={styles.matchPlanText}>Make a Plan</Text>
          </Pressable>
        ) : null}

        <Pressable onPress={onDismiss} style={styles.keepBtn}>
          <Text style={styles.keepText}>Keep Exploring →</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

// ── Incoming Shot card ────────────────────────────────────────────────────────
// Layout: stacked card — sender row on top, message as hero, action buttons below.
// Message is NEVER hidden or squished — it's what hooks the receiver.

function ShotCard({
  shot,
  isActing,
  onAccept,
  onDecline,
  onAvatarPress,
}: {
  shot: DatingShot;
  isActing: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onAvatarPress: () => void;
}) {
  const senderName = shot.senderProfile?.name ?? "Someone";
  const senderAge = shot.senderProfile?.age;
  const senderPhoto = shot.senderProfile?.photos?.[0];
  const displayName = senderAge ? `${senderName}, ${senderAge}` : senderName;
  const sentAt = timeAgo(shot.createdAt);
  const message = shot.message?.trim() || "Sent you a shot 🔥";

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(16).stiffness(100)}
      exiting={SlideOutLeft.duration(260)}
      style={styles.shotCard}
    >
      {/* Subtle pink glow overlay */}
      <LinearGradient
        colors={["rgba(255,45,168,0.10)", "rgba(168,85,247,0.06)", "rgba(0,0,0,0)"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* ── Sender row ── */}
      <Pressable style={styles.shotSenderRow} onPress={onAvatarPress} hitSlop={4}>
        <View style={styles.shotAvatarWrap}>
          {senderPhoto ? (
            <Image source={{ uri: senderPhoto }} style={styles.shotAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.shotAvatar, styles.avatarFallback]}>
              <Ionicons name="person" size={20} color={MUTED} />
            </View>
          )}
          <LinearGradient colors={[PINK, PURPLE]} style={styles.shotFlameBadge}>
            <Text style={{ fontSize: 9 }}>🔥</Text>
          </LinearGradient>
        </View>
        <View style={styles.shotSenderInfo}>
          <Text style={styles.shotName}>{displayName}</Text>
          <Text style={styles.shotTime}>{sentAt} · shot their shot</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.22)" />
      </Pressable>

      {/* ── THE MESSAGE — this is the hook ── */}
      <View style={styles.shotMsgBubble}>
        {/* Left accent bar */}
        <LinearGradient
          colors={[PINK, PURPLE]}
          style={styles.shotMsgAccentBar}
        />
        <Text style={styles.shotMsg}>{message}</Text>
      </View>

      {/* ── Action buttons ── */}
      <View style={styles.shotActions}>
        <Pressable
          style={[styles.shotDeclineBtn, isActing && styles.disabled]}
          onPress={onDecline}
          disabled={isActing}
          hitSlop={6}
        >
          <Ionicons name="close" size={14} color={MUTED} />
          <Text style={styles.shotDeclineText}>Pass</Text>
        </Pressable>
        <Pressable
          style={[styles.shotAcceptBtn, isActing && styles.disabled]}
          onPress={onAccept}
          disabled={isActing}
        >
          <LinearGradient
            colors={[PINK, PURPLE]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.shotBtnGrad}
          >
            {isActing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="flame" size={14} color="#fff" />
                <Text style={styles.shotAcceptText}>Accept</Text>
              </>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    </Animated.View>
  );
}

function PlusPaywallSheet({
  visible,
  intentLabel,
  onClose,
}: {
  visible: boolean;
  intentLabel: string;
  onClose: () => void;
}) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (!visible) return;
    pulse.value = withRepeat(withSequence(
      withTiming(1.04, { duration: 520 }),
      withTiming(1, { duration: 520 }),
    ), -1, false);
  }, [pulse, visible]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  if (!visible) return null;

  return (
    <Animated.View entering={SlideInDown.springify().damping(18).stiffness(120)} exiting={SlideOutDown.duration(220)} style={styles.paywallOverlay}>
      <LinearGradient colors={["#000000", "#110318", "#1B0B2A"]} style={StyleSheet.absoluteFill} />
      <Pressable onPress={onClose} style={styles.paywallClose} hitSlop={10}>
        <Ionicons name="close" size={22} color="rgba(255,255,255,0.72)" />
      </Pressable>

      <View style={styles.paywallLogo}>
        <LinearGradient colors={[PINK, PURPLE]} style={styles.paywallLogoMark}>
          <Text style={styles.paywallLogoGlyph}>CS</Text>
        </LinearGradient>
        <Text style={styles.paywallBrand}>Connect Sphere</Text>
      </View>

      <View style={styles.paywallHeroIcon}>
        <Ionicons name="lock-open" size={38} color={PINK} />
      </View>
      <Text style={styles.paywallTitle}>
        Unlock Your <Text style={styles.paywallAccent}>Admirers</Text>
      </Text>
      <Text style={styles.paywallCopy}>
        Someone just sent you a {intentLabel}! Upgrade to Connect Sphere Plus to instantly unblur all profiles and start chatting right now.
      </Text>

      <View style={styles.paywallBenefits}>
        {["Unblur every profile", "Reply while intent is hot", "See Sparks, Likes, and Besties first"].map((item) => (
          <View key={item} style={styles.paywallBenefit}>
            <Ionicons name="checkmark-circle" size={18} color={PINK} />
            <Text style={styles.paywallBenefitText}>{item}</Text>
          </View>
        ))}
      </View>

      <Animated.View style={[styles.paywallCtaWrap, pulseStyle]}>
        <Pressable onPress={() => openPremium("connect")} style={styles.paywallCta}>
          <LinearGradient colors={[PINK, ROSE]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.paywallCtaGrad}>
            <Text style={styles.paywallCtaText}>Unlock All Matches for $9.99/mo</Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

// ── Session-level Connect cache (spec 1.5) ───────────────────────────────────
// Holds the last successful inbox payload so re-entering the tab renders
// instantly while loadAll refreshes in the background. Keyed by userId so a
// sign-out/sign-in never shows another account's data.
let connectCache: {
  userId: string;
  primaryConvs: CsConversation[];
  requests: CsRequest[];
  reactions: CsReaction[];
  reactionCounts: ReactionCounts;
} | null = null;

// ─────────────────────────────────────────────────────────────────────────────
// MomentsConnectSection — Moment Requests + Moment Likes
// ─────────────────────────────────────────────────────────────────────────────

interface MomentRequest {
  id: string;
  momentId: string;
  momentText: string;
  momentLocation?: string;
  fromUserId: string;
  fromDisplayName: string;
  fromPhotoUrl?: string;
  message: string;
  createdAt: number;
  status: "pending" | "accepted" | "declined";
}

interface MomentLike {
  id: string;
  momentId: string;
  momentText: string;
  fromUserId: string;
  fromDisplayName: string;
  fromPhotoUrl?: string;
  createdAt: number;
}

const MOCK_MOMENT_REQUESTS: MomentRequest[] = [
  {
    id: "mreq-1",
    momentId: "m1",
    momentText: "Sunday reset hits different at Crandon 🧘‍♀️",
    momentLocation: "Crandon Park · Key Biscayne",
    fromUserId: "demo-carlos",
    fromDisplayName: "Carlos",
    message: "I love Crandon! Do you go every weekend?",
    createdAt: Date.now() - 12 * 60_000,
    status: "pending",
  },
  {
    id: "mreq-2",
    momentId: "m1",
    momentText: "Sunday reset hits different at Crandon 🧘‍♀️",
    momentLocation: "Crandon Park · Key Biscayne",
    fromUserId: "demo-andre",
    fromDisplayName: "Andre",
    message: "same vibes honestly, I'm usually at Matheson Hammock",
    createdAt: Date.now() - 34 * 60_000,
    status: "pending",
  },
];

const MOCK_MOMENT_LIKES: MomentLike[] = [
  {
    id: "mlike-1",
    momentId: "m1",
    momentText: "Sunday reset hits different at Crandon 🧘‍♀️",
    fromUserId: "demo-sofia",
    fromDisplayName: "Sofia",
    createdAt: Date.now() - 8 * 60_000,
  },
  {
    id: "mlike-2",
    momentId: "m1",
    momentText: "Sunday reset hits different at Crandon 🧘‍♀️",
    fromUserId: "demo-nia",
    fromDisplayName: "Nia",
    createdAt: Date.now() - 22 * 60_000,
  },
  {
    id: "mlike-3",
    momentId: "m2",
    momentText: "new ramen spot in wynwood actually slaps 👀",
    fromUserId: "demo-javier",
    fromDisplayName: "Javier",
    createdAt: Date.now() - 45 * 60_000,
  },
];

function timeAgoMs(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function MomentInitialAv({ name, size = 38 }: { name: string; size?: number }) {
  return (
    <LinearGradient
      colors={[PINK, PURPLE]}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center" }}
    >
      <Text style={{ fontSize: size * 0.38, fontWeight: "800", color: "#fff" }}>
        {name.charAt(0).toUpperCase()}
      </Text>
    </LinearGradient>
  );
}

function MomentsConnectSection() {
  const [requests, setRequests] = useState<MomentRequest[]>(MOCK_MOMENT_REQUESTS);
  const [likes]                 = useState<MomentLike[]>(MOCK_MOMENT_LIKES);
  const [acceptedFlash, setAcceptedFlash] = useState<string | null>(null);

  const openMomentSenderProfile = (person: {
    fromUserId: string;
    fromDisplayName: string;
    fromPhotoUrl?: string;
  }) => {
    navigateProfile(person.fromUserId, "moments", {
      name: person.fromDisplayName,
      photoUrl: person.fromPhotoUrl,
    });
  };

  const accept = (rid: string) => {
    const req = requests.find(r => r.id === rid);
    if (!req) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setRequests(prev => prev.filter(r => r.id !== rid));
    setAcceptedFlash(`Accepted ${req.fromDisplayName}'s request!`);
    // Navigate to their profile so the user can start a conversation
    setTimeout(() => {
      setAcceptedFlash(null);
      navigateProfile(req.fromUserId, "moments", {
        name: req.fromDisplayName,
        photoUrl: req.fromPhotoUrl,
      });
    }, 800);
  };

  const decline = (rid: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRequests(prev => prev.filter(r => r.id !== rid));
    // TODO: DELETE /api/moments/requests/:rid
  };

  return (
    <View>
      {acceptedFlash && (
        <View style={mStyles.flash}>
          <Text style={mStyles.flashText}>{acceptedFlash}</Text>
        </View>
      )}

      {/* ── Moment Requests ─────────────────────────────────────── */}
      <View style={mStyles.sectionHeader}>
        <Ionicons name="paper-plane-outline" size={13} color={PINK} />
        <Text style={mStyles.sectionTitle}>Moment Requests</Text>
        {requests.length > 0 && (
          <View style={mStyles.badge}>
            <Text style={mStyles.badgeText}>{requests.length}</Text>
          </View>
        )}
      </View>

      {requests.length === 0 ? (
        <View style={mStyles.emptyBlock}>
          <Text style={mStyles.emptyBlockText}>No pending requests</Text>
        </View>
      ) : (
        requests.map(req => (
          <View key={req.id} style={mStyles.requestCard}>
            <Pressable
              onPress={() => openMomentSenderProfile(req)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${req.fromDisplayName}'s profile`}
            >
              <MomentInitialAv name={req.fromDisplayName} />
            </Pressable>
            <Pressable
              style={mStyles.requestBody}
              onPress={() => openMomentSenderProfile(req)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${req.fromDisplayName}'s profile`}
            >
              <Text style={mStyles.requestName}>{req.fromDisplayName}</Text>
              <Text style={mStyles.requestMessage} numberOfLines={2}>"{req.message}"</Text>
              <Text style={mStyles.requestMomentRef} numberOfLines={1}>
                on your Moment: {req.momentText}
              </Text>
              {req.momentLocation && (
                <Text style={mStyles.requestLoc}>📍 {req.momentLocation}</Text>
              )}
              <Text style={mStyles.requestTime}>{timeAgoMs(req.createdAt)}</Text>
            </Pressable>
            <View style={mStyles.requestActions}>
              <Pressable style={mStyles.acceptBtn} onPress={() => accept(req.id)}>
                <Ionicons name="checkmark" size={15} color="#fff" />
              </Pressable>
              <Pressable style={mStyles.declineBtn} onPress={() => decline(req.id)}>
                <Ionicons name="close" size={15} color="rgba(255,255,255,0.5)" />
              </Pressable>
            </View>
          </View>
        ))
      )}

      {/* ── Moment Likes ────────────────────────────────────────── */}
      <View style={[mStyles.sectionHeader, { marginTop: 24 }]}>
        <Text style={{ fontSize: 13 }}>🔥</Text>
        <Text style={mStyles.sectionTitle}>Moment Likes</Text>
        {likes.length > 0 && (
          <View style={mStyles.badge}>
            <Text style={mStyles.badgeText}>{likes.length}</Text>
          </View>
        )}
      </View>

      {likes.length === 0 ? (
        <View style={mStyles.emptyBlock}>
          <Text style={mStyles.emptyBlockText}>No likes yet</Text>
        </View>
      ) : (
        likes.map(like => (
          <Pressable
            key={like.id}
            style={mStyles.likeRow}
            onPress={() => openMomentSenderProfile(like)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${like.fromDisplayName}'s profile`}
          >
            <MomentInitialAv name={like.fromDisplayName} size={34} />
            <View style={mStyles.likeBody}>
              <Text style={mStyles.likeName}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>{like.fromDisplayName}</Text>
                {" reacted to your Moment"}
              </Text>
              <Text style={mStyles.likeMoment} numberOfLines={1}>"{like.momentText}"</Text>
              <Text style={mStyles.likeTime}>{timeAgoMs(like.createdAt)}</Text>
            </View>
            <Text style={{ fontSize: 20 }}>🔥</Text>
          </Pressable>
        ))
      )}

      {/* Upgrade teaser */}
      <Pressable style={mStyles.upgradeCard}>
        <LinearGradient
          colors={["rgba(255,45,168,0.12)","rgba(168,85,247,0.10)"]}
          style={StyleSheet.absoluteFill}
          start={{ x:0,y:0 }} end={{ x:1,y:0 }}
        />
        <Text style={{ fontSize: 20 }}>👑</Text>
        <View style={{ flex: 1 }}>
          <Text style={mStyles.upgradeTitle}>See who viewed your Moments</Text>
          <Text style={mStyles.upgradeSub}>Upgrade to unlock the full viewer list</Text>
        </View>
        <View style={mStyles.upgradeBtn}>
          <Text style={mStyles.upgradeBtnText}>Upgrade</Text>
        </View>
      </Pressable>
    </View>
  );
}

const mStyles = StyleSheet.create({
  flash: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: "rgba(255,45,168,0.9)",
    borderRadius: 16,
    padding: 10,
    alignItems: "center",
  },
  flashText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "rgba(255,255,255,0.6)",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    flex: 1,
  },
  badge: {
    backgroundColor: PINK,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: "center",
  },
  badgeText: { fontSize: 10, fontWeight: "800", color: "#fff" },
  emptyBlock: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
  },
  emptyBlockText: { fontSize: 13, color: "rgba(255,255,255,0.3)" },
  requestCard: {
    marginHorizontal: 14,
    marginBottom: 10,
    borderRadius: 18,
    backgroundColor: "rgba(255,45,168,0.06)",
    borderWidth: 0.5,
    borderColor: "rgba(255,45,168,0.18)",
    padding: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  requestBody: { flex: 1, gap: 2 },
  requestName: { fontSize: 13, fontWeight: "800", color: "#fff" },
  requestMessage: { fontSize: 13, color: "rgba(255,255,255,0.75)", fontStyle: "italic", lineHeight: 18 },
  requestMomentRef: { fontSize: 10, color: "rgba(255,45,168,0.7)", marginTop: 3 },
  requestLoc: { fontSize: 9, color: "rgba(255,255,255,0.35)" },
  requestTime: { fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 2 },
  requestActions: { gap: 6, alignItems: "center" },
  acceptBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: PINK,
    alignItems: "center",
    justifyContent: "center",
  },
  declineBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  likeRow: {
    marginHorizontal: 14,
    marginBottom: 8,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  likeBody: { flex: 1, gap: 1 },
  likeName: { fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 17 },
  likeMoment: { fontSize: 11, color: "rgba(255,255,255,0.35)", fontStyle: "italic" },
  likeTime: { fontSize: 9, color: "rgba(255,255,255,0.25)", marginTop: 2 },
  upgradeCard: {
    marginHorizontal: 14,
    marginTop: 20,
    marginBottom: 8,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: "rgba(255,45,168,0.25)",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  upgradeTitle: { fontSize: 13, fontWeight: "700", color: "#fff" },
  upgradeSub: { fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 1 },
  upgradeBtn: {
    backgroundColor: PINK,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  upgradeBtnText: { fontSize: 11, fontWeight: "800", color: "#fff" },
});

// ─────────────────────────────────────────────────────────────────────────────

export default function ConnectScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 16 : insets.top;
  const bottomInset = Platform.OS === "web" ? 96 : 78 + insets.bottom;
  const { openChatId, segment: segmentParam } = useLocalSearchParams<{ openChatId?: string; segment?: ConnectSegment }>();
  const consumedRef = useRef<string | null>(null);
  const lastLoadedAtRef = useRef<number>(0);
  const { trigger: triggerAccept } = useFeedback("accept");
  const { userId, isSignedIn } = useSessionState();

  const [segment, setSegment] = useState<ConnectSegment>("chats");
  const [showInviteModal, setShowInviteModal] = useState(false);
  // Seed from the session cache so re-entering Connect renders instantly while
  // the background refresh runs (spec 1.5). Cache only counts for this user.
  const seededCache = connectCache && connectCache.userId === userId ? connectCache : null;
  const [loading, setLoading] = useState(!seededCache);
  const [primaryConvs, setPrimaryConvs] = useState<CsConversation[]>(seededCache?.primaryConvs ?? []);
  const [requests, setRequests] = useState<CsRequest[]>(seededCache?.requests ?? []);
  const [reactions, setReactions] = useState<CsReaction[]>(seededCache?.reactions ?? []);
  const [reactionCounts, setReactionCounts] = useState<ReactionCounts>(seededCache?.reactionCounts ?? { spark: 0, like: 0, shot_reaction: 0, plan_like: 0, vibe_reaction: 0, total: 0 });
  const [isPremium, setIsPremium] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [likingBackId, setLikingBackId] = useState<string | null>(null);
  const [matchMoment, setMatchMoment] = useState<DopamineMatch | null>(null);
  const [paywallIntent, setPaywallIntent] = useState<string | null>(null);
  const [shotActionId, setShotActionId] = useState<string | null>(null);
  const [shotMatchMoment, setShotMatchMoment] = useState<{ name: string; photoUrl?: string; chatId: string } | null>(null);

  // Dating context — inbox + incoming shots
  const {
    incomingShots,
    respondToShot,
    matches: localMatches,
    chats: localChats,
    currentUserId: matchesUserId,
  } = useDatingMatches();

  const pendingShots = incomingShots.filter((s) => s.status === "pending");

  // Map local dating matches → CsConversation-compatible shape for the inbox.
  // A local match is skipped if the server already has a conv for that peerId
  // (server data wins after the API catches up).
  // isLocal: false for server-sourced matches (no local chat) → routes via openChat().
  const localConvs = useMemo(() => {
    const serverPeerIds = new Set(primaryConvs.map((c) => c.peerId).filter(Boolean) as string[]);
    return buildLocalConvs(localMatches, localChats, serverPeerIds, matchesUserId);
  }, [localMatches, localChats, primaryConvs, matchesUserId]);

  // Unified list: server + local, newest activity first
  const allConvs = useMemo(() => {
    const merged = [
      ...primaryConvs,
      ...(localConvs as unknown as CsConversation[]),
    ];
    return merged.sort((a, b) => {
      const getTime = (c: CsConversation) => {
        const t = (c as any).lastMessageAt || c.createdAt;
        return t ? new Date(t as string).getTime() : 0;
      };
      return getTime(b) - getTime(a);
    });
  }, [primaryConvs, localConvs]);

  // Navigate to the right chat screen — local chats use the dating chat route
  const routeToChat = useCallback((conv: CsConversation) => {
    if ((conv as any).isLocal) {
      router.push({
        pathname: "/chat/dating/[id]",
        params: { id: (conv as any).localChatId as string },
      } as never);
    } else {
      openChat(conv.id);
    }
  }, []);

  const loadAll = useCallback(async (showLoader = false) => {
    if (!isSignedIn || !userId) {
      setPrimaryConvs([]);
      setRequests([]);
      setReactions([]);
      setReactionCounts({ spark: 0, like: 0, shot_reaction: 0, plan_like: 0, vibe_reaction: 0, total: 0 });
      setLoading(false);
      return;
    }
    // Hydrate from the session cache before fetching — covers the case where
    // auth hydrated after first render so the useState seed missed it. With
    // cached data on screen, never show the loader (spec 1.5).
    const cached = connectCache && connectCache.userId === userId ? connectCache : null;
    if (cached) {
      setPrimaryConvs((prev) => (prev.length ? prev : cached.primaryConvs));
      setRequests((prev) => (prev.length ? prev : cached.requests));
      setReactions((prev) => (prev.length ? prev : cached.reactions));
      setReactionCounts((prev) => (prev.total ? prev : cached.reactionCounts));
      setLoading(false);
    } else if (showLoader) {
      setLoading(true);
    }

    // Safety timeout — if the API hangs (dev env, no backend), dismiss the
    // skeleton after 5 s so the user sees the empty-state CTAs instead of
    // a permanent spinner.
    const timeoutId = setTimeout(() => setLoading(false), 5000);

    try {
      const [primaryResult, requestResult, reactionResult] = await Promise.allSettled([
        getMutualMatchChats(userId),
        getInboxRequests(userId),
        getInboxReactions(userId),
      ]);

      const nextConvs = primaryResult.status === "fulfilled"
        ? primaryResult.value.conversations ?? []
        : null;
      const nextRequests = requestResult.status === "fulfilled"
        ? requestResult.value.requests ?? []
        : null;
      const nextReactions = reactionResult.status === "fulfilled"
        ? reactionResult.value.reactions ?? []
        : null;
      const nextCounts = reactionResult.status === "fulfilled"
        ? reactionResult.value.counts ?? { spark: 0, like: 0, shot_reaction: 0, plan_like: 0, vibe_reaction: 0, total: 0 }
        : null;

      if (nextConvs) {
        setPrimaryConvs(nextConvs);
        // Only suppress future focus-refetches when we got real data back.
        // If the API timed out, leave lastLoadedAtRef at 0 so the next focus retries.
        lastLoadedAtRef.current = Date.now();
      }
      if (nextRequests) setRequests(nextRequests);
      if (nextReactions) setReactions(nextReactions);
      if (nextCounts) setReactionCounts(nextCounts);
      if (reactionResult.status === "fulfilled") {
        setIsPremium((prev) => prev || reactionResult.value.isPremium);
      }

      // Persist the freshest known payload for instant re-entry (spec 1.5).
      // Fall back to the previous cache per-field on partial failures.
      connectCache = {
        userId,
        primaryConvs: nextConvs ?? cached?.primaryConvs ?? [],
        requests: nextRequests ?? cached?.requests ?? [],
        reactions: nextReactions ?? cached?.reactions ?? [],
        reactionCounts: nextCounts ?? cached?.reactionCounts ?? { spark: 0, like: 0, shot_reaction: 0, plan_like: 0, vibe_reaction: 0, total: 0 },
      };
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [isSignedIn, userId]);

  useEffect(() => { void loadAll(true); }, [loadAll]);
  useEffect(() => {
    let mounted = true;
    getPremiumEntitlement()
      .then((entitlement) => {
        if (mounted) setIsPremium(entitlement.isPremium);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);
  useFocusEffect(useCallback(() => {
    // Only re-fetch if data is more than 30 seconds old — prevents hammering
    // the API on every tab switch while still picking up new messages quickly.
    if (Date.now() - lastLoadedAtRef.current < 30_000) return;
    lastLoadedAtRef.current = Date.now();
    void loadAll();
  }, [loadAll]));

  useEffect(() => {
    const target = Array.isArray(openChatId) ? openChatId[0] : openChatId;
    if (!target || consumedRef.current === target) return;
    consumedRef.current = target;
    openChat(target);
  }, [openChatId]);

  useEffect(() => {
    const target = Array.isArray(segmentParam) ? segmentParam[0] : segmentParam;
    if (target === "matches" || target === "chats" || target === "moments") setSegment(target);
  }, [segmentParam]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  const incomingCards = useMemo(
    () => buildIncomingActionCards({ reactions, requests, isPremium }),
    [isPremium, reactions, requests],
  );
  const newMatches = useMemo(() => allConvs.filter((conv) => !conv.hasMessages), [allConvs]);
  const messages = useMemo(() => allConvs.filter((conv) => Boolean(conv.hasMessages)), [allConvs]);
  const filteredMessages = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((conv) => (conv.peerName ?? "").toLowerCase().includes(q));
  }, [messages, search]);
  const totalChats = newMatches.length + messages.length;
  const actingId = acceptingId ?? likingBackId;

  // Stale-while-revalidate: show skeleton only on a truly cold start (no data in
  // memory at all). If any local or server data already exists, render it
  // immediately and let the background fetch silently update state.
  const hasAnyData =
    primaryConvs.length > 0 ||
    requests.length > 0 ||
    reactions.length > 0 ||
    incomingShots.length > 0 ||
    localConvs.length > 0;

  const openProfile = useCallback((card: IncomingActionCard) => {
    if (!card.senderId) return;
    navigateProfile(card.senderId, "matches", {
      name: card.senderName,
      photoUrl: card.senderPhotoUrl,
      age: card.senderAge,
      neighborhood: card.senderNeighborhood,
    });
  }, []);

  const handleAcceptRequest = useCallback(async (req: CsRequest) => {
    setAcceptingId(req.id);
    try {
      const res = await acceptRequest(req.id);
      triggerAccept();
      await haptic("success");
      setRequests((prev) => prev.filter((item) => item.id !== req.id));
      if (res.conversation) {
        const conv: CsConversation = { ...res.conversation, peerName: req.senderName, peerPhotoUrl: req.senderPhotoUrl };
        setPrimaryConvs((prev) => prev.some((item) => item.id === conv.id) ? prev : [conv, ...prev]);
        if (shouldShowConnectMatchMoment("accept_request")) {
          setMatchMoment({
            chatId: res.conversation.id,
            serverMatchId: res.conversation.id,
            source: "server",
            profile: {
              id: req.senderId,
              name: req.senderName ?? "Someone",
              intent: "friendship",
              photos: req.senderPhotoUrl ? [req.senderPhotoUrl] : [],
            },
          });
        }
      }
    } finally {
      setAcceptingId(null);
    }
  }, [triggerAccept]);

  const handleDeclineRequest = useCallback(async (req: CsRequest) => {
    await declineRequest(req.id).catch(() => {});
    setRequests((prev) => prev.filter((item) => item.id !== req.id));
  }, []);

  const handleLikeBack = useCallback(async (reaction: CsReaction) => {
    setLikingBackId(reaction.id);
    try {
      const res = await likeBackReaction(reaction.id);
      await haptic("success");
      setReactions((prev) => prev.filter((item) => item.id !== reaction.id));
      setReactionCounts((prev) => ({
        ...prev,
        total: Math.max(0, prev.total - 1),
        [reaction.type]: Math.max(0, (prev[reaction.type] ?? 0) - 1),
      }));
      if (res.conversation) {
        const conv: CsConversation = { ...res.conversation, peerName: reaction.senderName, peerPhotoUrl: reaction.senderPhotoUrl };
        setPrimaryConvs((prev) => prev.some((item) => item.id === conv.id) ? prev : [conv, ...prev]);
        if (shouldShowConnectMatchMoment("like_back_reaction")) {
          setMatchMoment({
            chatId: res.conversation.id,
            serverMatchId: res.conversation.id,
            source: "server",
            profile: {
              id: reaction.senderId,
              name: reaction.senderName ?? "Someone",
              intent: "dating",
              photos: reaction.senderPhotoUrl ? [reaction.senderPhotoUrl] : [],
            },
          });
        }
      }
    } finally {
      setLikingBackId(null);
    }
  }, []);

  const handleIgnoreReaction = useCallback(async (reaction: CsReaction) => {
    await ignoreReaction(reaction.id).catch(() => {});
    setReactions((prev) => prev.filter((item) => item.id !== reaction.id));
    setReactionCounts((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }));
  }, []);

  // ── Workflow B: Shot accept / decline ──────────────────────────────────────
  const handleAcceptShot = useCallback(async (shot: DatingShot) => {
    setShotActionId(shot.id);
    try {
      const result = await respondToShot(shot.id, "accept");
      if (result.success) {
        await haptic("success");
        const rawChatId = result.chatId ?? result.match?.chatId;
        if (rawChatId) {
          // Local shots produce a local chatId — prefix so routing knows to use /chat/dating/[id]
          const chatId = shot.source === "local" ? `local:${rawChatId}` : rawChatId;
          setShotMatchMoment({
            name: shot.senderProfile?.name ?? "Your match",
            photoUrl: shot.senderProfile?.photos?.[0],
            chatId,
          });
          void loadAll();
        }
      } else {
        await haptic("warning");
      }
    } catch {
      await haptic("warning");
    } finally {
      setShotActionId(null);
    }
  }, [loadAll, respondToShot]);

  const handleDeclineShot = useCallback(async (shot: DatingShot) => {
    setShotActionId(shot.id);
    try {
      await respondToShot(shot.id, "ignore");
      await haptic("light");
    } finally {
      setShotActionId(null);
    }
  }, [respondToShot]);

  return (
    <View style={[styles.root, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Connect 🔗</Text>
          <Text style={styles.headerSub}>Matches, sparks, plans, and texts.</Text>
        </View>
        <Pressable style={styles.iconBtn} onPress={() => setShowInviteModal(true)} hitSlop={8}>
          <Ionicons name="person-add-outline" size={22} color={TEXT} />
        </Pressable>
      </View>

      <SegmentControl
        value={segment}
        pendingCount={incomingCards.length + pendingShots.length}
        chatCount={newMatches.length + messages.length}
        onChange={setSegment}
      />

      {loading && !hasAnyData ? (
        <View style={styles.skeletonWrap}>
          {[0, 1, 2].map((item) => (
            <View key={item} style={styles.skeletonRow}>
              <View style={styles.skeletonAvatar} />
              <View style={styles.skeletonText}>
                <View style={[styles.skeletonLine, { width: "58%" }]} />
                <View style={[styles.skeletonLine, { width: "82%", opacity: 0.55 }]} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: bottomInset + 18 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PINK} />}
        >
          {segment === "matches" ? (
            <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={styles.segmentContent}>
              {/* ── Shots Fired 🔥 ── */}
              {pendingShots.length > 0 && (
                <View style={styles.shotSection}>
                  <View style={styles.sectionHeader}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={styles.sectionEyebrow}>🔥 Shots Fired</Text>
                    </View>
                    <Text style={styles.sectionCount}>{pendingShots.length}</Text>
                  </View>
                  {pendingShots.map((shot) => (
                    <ShotCard
                      key={shot.id}
                      shot={shot}
                      isActing={shotActionId === shot.id}
                      onAccept={() => void handleAcceptShot(shot)}
                      onDecline={() => void handleDeclineShot(shot)}
                      onAvatarPress={() =>
                        navigateProfile(shot.fromUserId, "matches", {
                          name: shot.senderProfile?.name,
                          photoUrl: shot.senderProfile?.photos?.[0],
                          age: shot.senderProfile?.age ?? undefined,
                        })
                      }
                    />
                  ))}
                </View>
              )}

              {/* ── Incoming Actions (reactions + requests) ── */}
              {incomingCards.length > 0 ? (
                <>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionEyebrow}>Incoming Actions</Text>
                    <Text style={styles.sectionCount}>{incomingCards.length} live</Text>
                  </View>
                  <View style={styles.incomingGrid}>
                    {incomingCards.map((card, index) => {
                      const isFreeLocked = !isPremium && index > 0;
                      const displayCard = !isPremium && index === 0 ? { ...card, isLocked: false } : isFreeLocked ? { ...card, isLocked: true } : card;
                      return (
                        <IncomingActionCardView
                          key={card.id}
                          card={displayCard}
                          index={index}
                          isFreeMatch={!isPremium && index === 0}
                          onOpenProfile={openProfile}
                          onReveal={() => setPaywallIntent(card.label)}
                          onLikeBack={(reaction) => void handleLikeBack(reaction)}
                          onIgnore={(reaction) => void handleIgnoreReaction(reaction)}
                          onAccept={(request) => void handleAcceptRequest(request)}
                          onDecline={(request) => void handleDeclineRequest(request)}
                          actingId={actingId}
                        />
                      );
                    })}
                  </View>
                  {!isPremium && incomingCards.length > 1 ? (
                    <Animated.View entering={FadeInDown.delay(180).springify()} style={styles.upgradePrompt}>
                      <LinearGradient
                        colors={["rgba(255,45,168,0.12)", "rgba(168,85,247,0.12)"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.upgradeGradBg}
                      />
                      <View style={styles.upgradeLockRow}>
                        <Ionicons name="lock-closed" size={16} color={PINK} />
                        <Text style={styles.upgradeCount}>
                          {incomingCards.length - 1} more {incomingCards.length - 1 === 1 ? "match" : "matches"} waiting
                        </Text>
                      </View>
                      <Text style={styles.upgradeSub}>Upgrade to see who else wants to connect with you</Text>
                      <Pressable style={styles.upgradeBtn} onPress={() => openPremium("connect")}>
                        <LinearGradient colors={[PINK, PURPLE]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.upgradeGrad}>
                          <Ionicons name="flash" size={15} color="#fff" />
                          <Text style={styles.upgradeBtnText}>Unlock All Matches</Text>
                        </LinearGradient>
                      </Pressable>
                    </Animated.View>
                  ) : null}
                </>
              ) : pendingShots.length === 0 ? (
                // No shots or incoming actions — show full empty state
                <View style={styles.emptyFull}>
                  <View style={styles.emptyIcon}>
                    <Ionicons name="flash-outline" size={38} color={PINK} />
                  </View>
                  <Text style={styles.emptyTitle}>No incoming actions yet</Text>
                  <Text style={styles.emptySub}>When someone Sparks, sends a Shot, replies to a Moment, or asks to make a Plan, they will land here.</Text>
                  <Pressable style={styles.discoverBtn} onPress={() => router.push("/(tabs)" as never)}>
                    <LinearGradient colors={[PINK, PURPLE]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.discoverGrad}>
                      <Ionicons name="compass" size={16} color="#fff" />
                      <Text style={styles.discoverText}>Discover People</Text>
                    </LinearGradient>
                  </Pressable>
                  <View style={styles.emptyActionRow}>
                    <Pressable style={styles.emptySecondaryBtn} onPress={() => router.push("/(tabs)/communities" as never)}>
                      <Ionicons name="planet-outline" size={15} color={PINK} />
                      <Text style={styles.emptySecondaryText}>Open Spaces</Text>
                    </Pressable>
                    <Pressable style={styles.emptySecondaryBtn} onPress={() => router.push("/(tabs)/events" as never)}>
                      <Ionicons name="calendar-outline" size={15} color={PINK} />
                      <Text style={styles.emptySecondaryText}>Find Events</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInUp.duration(190)} exiting={FadeOut.duration(120)} style={styles.segmentContent}>
              {/* ── New matches bubble row (Tinder-style) ── */}
              {newMatches.length > 0 && (
                <MatchesSpotlightRow
                  matches={newMatches.map((conv): SpotlightMatch => ({
                    matchId: conv.id,
                    chatId: (conv as any).isLocal
                      ? `local:${(conv as any).localChatId as string}`
                      : conv.id,
                    peerId: conv.peerId,
                    displayName: conv.peerName ?? "Match",
                    photo: conv.peerPhotoUrl ?? null,
                    hasUnread: !(conv as any).isRead,
                    isNew: true,
                    intent: (conv.type === "match" ? "dating" : "friendship") as "dating" | "friendship",
                  }))}
                  onPress={(match) => {
                    // Open chat first — that's the primary action for a new match.
                    // Local dating chats use /chat/dating/[id]; server chats use openChat.
                    if (match.chatId) {
                      if (match.chatId.startsWith("local:")) {
                        router.push({
                          pathname: "/chat/dating/[id]",
                          params: { id: match.chatId.slice(6) },
                        } as never);
                      } else {
                        openChat(match.chatId);
                      }
                      return;
                    }
                    // Fallback: no chat yet — open the profile so they can message from there.
                    if (match.peerId) {
                      navigateProfile(match.peerId, "matches", {
                        name: match.displayName,
                        photoUrl: match.photo ?? undefined,
                      });
                    }
                  }}
                />
              )}

              {/* ── Chats: search bar ── */}
              {messages.length > 0 ? (
                <View style={[styles.searchWrap, searchFocused && styles.searchWrapFocused]}>
                  <Ionicons name="search" size={15} color={searchFocused ? PINK : MUTED} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search messages..."
                    placeholderTextColor={FAINT}
                    value={search}
                    onChangeText={setSearch}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                    returnKeyType="search"
                  />
                  {search.length > 0 ? (
                    <Pressable onPress={() => setSearch("")} hitSlop={6}>
                      <Ionicons name="close-circle" size={15} color={MUTED} />
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              {/* ── Chats: conversation list ── */}
              {filteredMessages.length > 0 ? (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionEyebrow}>Conversations</Text>
                    <Text style={styles.sectionCount}>{filteredMessages.length}</Text>
                  </View>
                  {filteredMessages.map((conv, index) => (
                    <MessageRow key={conv.id} conv={conv} index={index} onPress={() => routeToChat(conv)} />
                  ))}
                </View>
              ) : messages.length === 0 && newMatches.length === 0 ? (
                <View style={styles.emptyFull}>
                  <View style={styles.emptyIcon}>
                    <Ionicons name="chatbubble-ellipses-outline" size={38} color={PINK} />
                  </View>
                  <Text style={styles.emptyTitle}>No chats yet</Text>
                  <Text style={styles.emptySub}>Match someone in Matches, accept a request, or find an event to make plans with someone.</Text>
                  <View style={styles.emptyActionRow}>
                    <Pressable style={styles.emptySecondaryBtn} onPress={() => setSegment("matches")}>
                      <Ionicons name="flash-outline" size={15} color={PINK} />
                      <Text style={styles.emptySecondaryText}>Go to Matches</Text>
                    </Pressable>
                    <Pressable style={styles.emptySecondaryBtn} onPress={() => router.push("/(tabs)" as never)}>
                      <Ionicons name="compass-outline" size={15} color={PINK} />
                      <Text style={styles.emptySecondaryText}>Discover</Text>
                    </Pressable>
                    <Pressable style={styles.emptySecondaryBtn} onPress={() => router.push("/(tabs)/events" as never)}>
                      <Ionicons name="calendar-outline" size={15} color={PINK} />
                      <Text style={styles.emptySecondaryText}>Events</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={styles.emptyMessages}>
                  <Text style={styles.emptyText}>No conversations match your search.</Text>
                </View>
              )}

              {/* ── AI Dating Coach entry card ── */}
              <Pressable
                style={styles.aiCoachCard}
                onPress={() => router.push({ pathname: "/chat/ai-bot", params: { mode: "dating" } } as never)}
              >
                <LinearGradient
                  colors={["rgba(255,45,168,0.14)", "rgba(168,85,247,0.10)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.aiCoachIconWrap}>
                  <LinearGradient colors={[PINK, PURPLE]} style={styles.aiCoachIconGrad}>
                    <Text style={{ fontSize: 18 }}>✨</Text>
                  </LinearGradient>
                </View>
                <View style={styles.aiCoachBody}>
                  <Text style={styles.aiCoachTitle}>Ask Spark — AI Dating Coach</Text>
                  <Text style={styles.aiCoachSub}>Get opening lines, date ideas, and honest advice</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={PINK} />
              </Pressable>
            </Animated.View>
          )}

          {/* ─────────────────────────────────────────────────────────────
              MOMENTS SEGMENT — Requests + Likes from the Moments tab
          ───────────────────────────────────────────────────────────── */}
          {segment === "moments" && (
            <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={styles.segmentContent}>
              <MomentsConnectSection />
            </Animated.View>
          )}
        </ScrollView>
      )}

      <DatingMatchModal
        match={matchMoment}
        onClose={() => setMatchMoment(null)}
        onKeepExploring={() => {
          setMatchMoment(null);
          setSegment("matches");
        }}
      />

      {shotMatchMoment && (
        <MatchMomentOverlay
          name={shotMatchMoment.name}
          photoUrl={shotMatchMoment.photoUrl}
          onDismiss={() => setShotMatchMoment(null)}
          onMessage={() => {
            const chatId = shotMatchMoment.chatId;
            setShotMatchMoment(null);
            if (chatId.startsWith("local:")) {
              router.push({ pathname: "/chat/dating/[id]", params: { id: chatId.slice(6) } } as never);
            } else {
              openChat(chatId);
            }
          }}
          onMakePlan={() => {
            const chatId = shotMatchMoment.chatId;
            setShotMatchMoment(null);
            if (chatId.startsWith("local:")) {
              router.push({
                pathname: "/chat/dating/[id]",
                params: { id: chatId.slice(6), openPlan: "1" },
              } as never);
            } else {
              openChat(chatId, { openPlan: true });
            }
          }}
        />
      )}

      <InviteModal
        visible={showInviteModal && !!userId}
        onClose={() => setShowInviteModal(false)}
        userId={userId ?? ""}
      />
      <PlusPaywallSheet
        visible={!!paywallIntent}
        intentLabel={paywallIntent ?? "Spark"}
        onClose={() => setPaywallIntent(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingBottom: 12 },
  headerTitle: { color: TEXT, fontSize: 30, fontWeight: "900", letterSpacing: -0.6 },
  headerSub: { color: MUTED, fontSize: 12, fontWeight: "700", marginTop: 2 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: CARD, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: BORDER },
  segmentWrap: { flexDirection: "row", marginHorizontal: 0, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: BORDER, marginBottom: 4 },
  segmentHit: { flex: 1 },
  segmentTab: { alignItems: "center", paddingTop: 4 },
  segmentLabelRow: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 10 },
  segmentText: { color: MUTED, fontSize: 14, fontWeight: "800", letterSpacing: 0.1 },
  segmentTextActive: { color: TEXT },
  segmentUnderline: { height: 2.5, width: "80%", borderRadius: 2, backgroundColor: PINK, marginBottom: -1 },
  segmentUnderlineFaint: { height: 2.5, borderRadius: 2, backgroundColor: "transparent", marginBottom: -1 },
  segmentBadge: { minWidth: 19, height: 19, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 5, backgroundColor: "rgba(255,255,255,0.08)" },
  segmentBadgeActive: { backgroundColor: "rgba(255,45,168,0.20)" },
  segmentBadgeText: { color: MUTED, fontSize: 10, fontWeight: "900" },
  segmentBadgeTextActive: { color: PINK },
  scroll: { flex: 1 },
  segmentContent: { minHeight: 460 },
  skeletonWrap: { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  skeletonRow: { flexDirection: "row", alignItems: "center", gap: 14, padding: 12, borderRadius: 20, backgroundColor: CARD },
  skeletonAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: CARD2 },
  skeletonText: { flex: 1, gap: 9 },
  skeletonLine: { height: 12, borderRadius: 6, backgroundColor: CARD2 },
  section: { marginBottom: 10 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  sectionEyebrow: { color: "#A1A1AA", fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.1 },
  sectionCount: { color: PINK, fontSize: 11, fontWeight: "900", backgroundColor: "rgba(255,45,168,0.12)", borderWidth: 1, borderColor: "rgba(255,45,168,0.30)", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, overflow: "hidden" },
  incomingGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 16 },
  incomingCell: { width: "48%", minWidth: 0 },
  incomingCard: { aspectRatio: 0.72, borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, position: "relative" },
  cardPress: { flex: 1 },
  lockPulse: { ...StyleSheet.absoluteFillObject, zIndex: 3, borderRadius: 24, borderWidth: 2 },
  incomingPhoto: { width: "100%", height: "100%", opacity: 0.96 },
  incomingPhotoFallback: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  pixelVeil: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  pixelTile: { position: "absolute", width: "18%", height: "14%" },
  cardOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 2, padding: 14, justifyContent: "space-between" },
  cardTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  intentPill: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  intentPillText: { fontSize: 11, fontWeight: "700" },
  lockIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  cardBottomRow: { gap: 5 },
  cardName: { color: TEXT, fontSize: 18, fontWeight: "800", letterSpacing: -0.2, textShadowColor: "rgba(0,0,0,0.8)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  cardDetail: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: "600", textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  cardActionRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  cardAcceptBtn: { flex: 1, borderRadius: 14, overflow: "hidden", height: 38 },
  cardDeclineBtn: { width: 38, height: 38, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.10)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" },
  cardBtnGrad: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  cardBtnText: { color: TEXT, fontSize: 13, fontWeight: "800" },
  upgradePrompt: { marginHorizontal: 16, marginTop: 12, borderRadius: 20, overflow: "hidden", padding: 18, borderWidth: 1, borderColor: "rgba(255,45,168,0.22)", gap: 8 },
  upgradeGradBg: { ...StyleSheet.absoluteFillObject },
  upgradeLockRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  upgradeCount: { color: PINK, fontSize: 15, fontWeight: "800" },
  upgradeSub: { color: MUTED, fontSize: 13, fontWeight: "500", lineHeight: 19 },
  upgradeBtn: { borderRadius: 14, overflow: "hidden", marginTop: 4 },
  upgradeGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 13 },
  upgradeBtnText: { color: TEXT, fontSize: 14, fontWeight: "800" },
  msgRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: "transparent", marginBottom: 2 },
  msgAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: CARD2 },
  msgAvatarFallback: { width: 56, height: 56, borderRadius: 28, backgroundColor: CARD, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: BORDER },
  msgAvatarLetter: { color: TEXT, fontSize: 22, fontWeight: "800" },
  msgBody: { flex: 1, gap: 3 },
  msgTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  msgName: { color: TEXT, fontSize: 15, fontWeight: "700", flex: 1 },
  msgTime: { color: FAINT, fontSize: 11, fontWeight: "600" },
  msgPreview: { color: MUTED, fontSize: 13, fontWeight: "400", lineHeight: 18 },
  msgPreviewMe: { color: FAINT },
  // Conversation-type icon badge — colors are injected inline per type.
  msgType: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginLeft: 8,
  },
  msgUnreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: PINK, marginTop: 4 },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginTop: 6, marginBottom: 4, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER },
  searchWrapFocused: { borderColor: "rgba(255,45,168,0.50)" },
  searchInput: { flex: 1, color: TEXT, fontSize: 14, fontWeight: "500", paddingVertical: 0 },
  emptyFull: { alignItems: "center", paddingTop: 48, paddingHorizontal: 32, gap: 12 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(255,45,168,0.12)", alignItems: "center", justifyContent: "center", marginBottom: 4, borderWidth: 1, borderColor: "rgba(255,45,168,0.22)" },
  emptyTitle: { color: TEXT, fontSize: 19, fontWeight: "800", textAlign: "center" },
  emptySub: { color: MUTED, fontSize: 14, fontWeight: "400", textAlign: "center", lineHeight: 21 },
  emptyActionRow: { flexDirection: "row", gap: 10, marginTop: 6, flexWrap: "wrap", justifyContent: "center" },
  emptySecondaryBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,45,168,0.30)", paddingHorizontal: 14, paddingVertical: 9, backgroundColor: "rgba(255,45,168,0.08)" },
  emptySecondaryText: { color: PINK, fontSize: 13, fontWeight: "700" },
  emptyMessages: { paddingTop: 24, alignItems: "center" },
  emptyText: { color: MUTED, fontSize: 13, fontWeight: "500" },
  discoverBtn: { borderRadius: 16, overflow: "hidden", marginTop: 6 },
  discoverGrad: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 22, paddingVertical: 13 },
  discoverText: { color: TEXT, fontSize: 15, fontWeight: "800" },
  aiCoachCard: { flexDirection: "row", alignItems: "center", gap: 13, marginHorizontal: 16, marginTop: 16, marginBottom: 6, borderRadius: 20, overflow: "hidden", padding: 14, borderWidth: 1, borderColor: "rgba(255,45,168,0.22)" },
  aiCoachIconWrap: { width: 42, height: 42, borderRadius: 21, overflow: "hidden" },
  aiCoachIconGrad: { flex: 1, alignItems: "center", justifyContent: "center" },
  aiCoachBody: { flex: 1, gap: 3 },
  aiCoachTitle: { color: TEXT, fontSize: 14, fontWeight: "700" },
  aiCoachSub: { color: MUTED, fontSize: 12, fontWeight: "400" },
  shotSection: { marginBottom: 6 },
  // ── Shot card — stacked layout so message is never hidden ──────────────────
  shotCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,45,168,0.28)",
    backgroundColor: CARD,
    padding: 14,
    gap: 12,
  },
  // Sender row: avatar | name+subtitle | chevron
  shotSenderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  shotAvatarWrap: { position: "relative" },
  shotAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: CARD2 },
  shotFlameBadge: {
    position: "absolute", bottom: -2, right: -2,
    width: 20, height: 20, borderRadius: 10,
    overflow: "hidden", alignItems: "center", justifyContent: "center",
  },
  shotSenderInfo: { flex: 1 },
  shotName: { color: TEXT, fontSize: 15, fontFamily: "Inter_700Bold" },
  shotTime: { color: MUTED, fontSize: 11, fontWeight: "500", marginTop: 1 },
  // Message bubble — the hook
  shotMsgBubble: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.055)",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,45,168,0.14)",
  },
  shotMsgAccentBar: {
    width: 3,
    borderRadius: 2,
    alignSelf: "stretch",
    minHeight: 20,
  },
  shotMsg: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 23,
    letterSpacing: 0.1,
  },
  // Actions row
  shotActions: { flexDirection: "row", gap: 10, alignItems: "center" },
  shotDeclineBtn: {
    height: 46,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: "row",
    gap: 5,
  },
  shotDeclineText: { color: MUTED, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  shotAcceptBtn: { flex: 1, borderRadius: 14, overflow: "hidden", height: 46 },
  shotBtnGrad: { width: "100%", height: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  shotAcceptText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  momentOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 100, alignItems: "center", justifyContent: "center", padding: 24 },
  momentBlur: { ...StyleSheet.absoluteFillObject },
  momentCard: { width: "100%", borderRadius: 28, overflow: "hidden", alignItems: "center", padding: 28, gap: 14, borderWidth: 1, borderColor: "rgba(255,45,168,0.30)" },
  momentPhotoWrap: { position: "relative" },
  momentPhoto: { width: 110, height: 110, borderRadius: 55 },
  momentPhotoFallback: { width: 110, height: 110, borderRadius: 55, backgroundColor: CARD2, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: PINK },
  momentGlow: { position: "absolute", top: -8, left: -8, right: -8, bottom: -8, borderRadius: 63, borderWidth: 2.5, borderColor: "rgba(255,45,168,0.50)" },
  momentTitle: { color: TEXT, fontSize: 22, fontWeight: "900", textAlign: "center", letterSpacing: -0.3 },
  momentSub: { color: MUTED, fontSize: 14, fontWeight: "500", textAlign: "center" },
  momentActions: { width: "100%", gap: 10, marginTop: 4 },
  momentMsgBtn: { borderRadius: 16, overflow: "hidden" },
  momentMsgGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14 },
  momentMsgText: { color: TEXT, fontSize: 15, fontWeight: "800" },
  momentDismissBtn: { alignItems: "center", paddingVertical: 10 },
  momentDismissText: { color: MUTED, fontSize: 14, fontWeight: "600" },
  senderSheet: { flex: 1, backgroundColor: "#050508" },
  senderSheetScroll: { flex: 1 },
  senderPhotoCard: { height: 460, marginHorizontal: 16, borderRadius: 22, overflow: "hidden", backgroundColor: "#111" },
  senderPhotoFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  senderGradient: { position: "absolute", bottom: 0, left: 0, right: 0, height: 200 },
  senderInfo: { position: "absolute", bottom: 20, left: 20, right: 20, gap: 4 },
  senderName: { color: TEXT, fontSize: 28, fontWeight: "800", letterSpacing: -0.4 },
  senderDetail: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: "500" },
  senderBody: { paddingHorizontal: 18, paddingTop: 18, gap: 14 },
  senderMessage: { backgroundColor: "rgba(255,45,168,0.10)", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "rgba(255,45,168,0.20)", gap: 6 },
  senderMessageLabel: { color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 },
  senderMessageText: { color: TEXT, fontSize: 15, fontWeight: "400", lineHeight: 22, fontStyle: "italic" },
  senderActions: { flexDirection: "row", gap: 10 },
  senderAcceptBtn: { flex: 1, borderRadius: 16, overflow: "hidden" },
  senderAcceptGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15 },
  senderAcceptText: { color: TEXT, fontSize: 15, fontWeight: "800" },
  senderDeclineBtn: { width: 50, height: 50, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: BORDER },
  inviteOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "flex-end" },
  inviteSheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: "hidden", paddingBottom: 36, paddingHorizontal: 24, paddingTop: 18 },
  inviteHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.18)", alignSelf: "center", marginBottom: 18 },
  inviteIconWrap: { alignItems: "center", marginBottom: 12 },
  inviteTitle: { color: TEXT, fontSize: 22, fontWeight: "900", textAlign: "center", marginBottom: 6 },
  inviteSub: { color: MUTED, fontSize: 14, fontWeight: "400", textAlign: "center", lineHeight: 20, marginBottom: 18 },
  inviteLinkBox: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: CARD, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: BORDER, marginBottom: 14 },
  inviteLinkText: { flex: 1, color: MUTED, fontSize: 12, fontWeight: "500" },
  inviteCopyBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: "rgba(255,45,168,0.14)", borderWidth: 1, borderColor: "rgba(255,45,168,0.28)" },
  inviteCopyText: { color: PINK, fontSize: 12, fontWeight: "700" },
  inviteShareBtn: { borderRadius: 16, overflow: "hidden" },
  inviteShareGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14 },
  inviteShareText: { color: TEXT, fontSize: 15, fontWeight: "800" },
  paywallOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 200, paddingHorizontal: 28, paddingTop: 56, paddingBottom: 36, alignItems: "center" },
  paywallClose: { position: "absolute", top: 52, right: 20 },
  paywallLogo: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 },
  paywallLogoMark: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  paywallLogoGlyph: { color: TEXT, fontSize: 13, fontWeight: "900" },
  paywallBrand: { color: TEXT, fontSize: 16, fontWeight: "800" },
  paywallHeroIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(255,45,168,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 12, borderWidth: 1, borderColor: "rgba(255,45,168,0.30)" },
  paywallTitle: { color: TEXT, fontSize: 26, fontWeight: "900", textAlign: "center", marginBottom: 10, letterSpacing: -0.4 },
  paywallAccent: { color: PINK },
  paywallCopy: { color: MUTED, fontSize: 14, fontWeight: "400", textAlign: "center", lineHeight: 21, marginBottom: 18 },
  paywallBenefits: { width: "100%", gap: 10, marginBottom: 24 },
  paywallBenefit: { flexDirection: "row", alignItems: "center", gap: 10 },
  paywallBenefitText: { color: TEXT, fontSize: 14, fontWeight: "500" },
  paywallCtaWrap: { width: "100%" },
  paywallCta: { borderRadius: 18, overflow: "hidden" },
  paywallCtaGrad: { paddingVertical: 16, alignItems: "center" },
  paywallCtaText: { color: TEXT, fontSize: 16, fontWeight: "900" },

  // ── Shared ──────────────────────────────────────────────────────────────────
  avatarFallback: {
    backgroundColor: CARD,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderWidth: 1,
    borderColor: BORDER,
  },

  // ── IncomingActionCardView ───────────────────────────────────────────────────
  cardBottom: {
    position: "absolute" as const,
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    paddingBottom: 14,
  },
  cardMeta: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 11,
    fontWeight: "500" as const,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  actionBadge: {
    position: "absolute" as const,
    top: 10,
    left: 10,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
  },
  actionBadgeText: {
    fontSize: 10,
    fontWeight: "800" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.4,
  },
  freeMatchTag: {
    position: "absolute" as const,
    top: 10,
    right: 10,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 3,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
    backgroundColor: "rgba(34,197,94,0.22)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.40)",
  },
  freeMatchText: {
    color: GREEN,
    fontSize: 9,
    fontWeight: "900" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.4,
  },
  lockedVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.28)",
    zIndex: 2,
  },
  disabled: { opacity: 0.52 },
  ghostCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  primaryMiniBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  cardActions: {
    flexDirection: "row" as const,
    gap: 6,
    justifyContent: "flex-end" as const,
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingTop: 6,
  },

  // ── MessageRow ───────────────────────────────────────────────────────────────
  msgAvatarWrap: { position: "relative" as const },
  rowPressed: { backgroundColor: "rgba(255,255,255,0.04)" },
  onlineDot: {
    position: "absolute" as const,
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: GREEN,
    borderWidth: 2,
    borderColor: BG,
  },

  // ── MatchMomentOverlay ───────────────────────────────────────────────────────
  matchOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 22,
  },
  matchBloom: {
    position: "absolute" as const,
    top: "28%" as any,
    left: "50%" as any,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(255,45,168,0.22)",
    marginLeft: -120,
    shadowColor: PINK,
    shadowRadius: 80,
    shadowOpacity: 0.6,
    shadowOffset: { width: 0, height: 0 },
  },
  matchHeaderBlock: { alignItems: "center" as const, gap: 2, marginTop: 40 },
  matchItS: {
    color: "rgba(255,255,255,0.60)",
    fontSize: 16,
    fontWeight: "900" as const,
    letterSpacing: 6,
    textTransform: "uppercase" as const,
  },
  matchHeadline: {
    color: TEXT,
    fontSize: 46,
    fontWeight: "900" as const,
    letterSpacing: -1.5,
    lineHeight: 50,
  },
  matchDivider: {
    width: 40,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: PINK,
    marginTop: 8,
  },
  matchGlowRing: {
    width: 148,
    height: 148,
    borderRadius: 74,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  matchRingOuter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2.5,
    borderColor: PINK,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    overflow: "hidden" as const,
  },
  matchRingInner: {
    width: 130,
    height: 130,
    borderRadius: 65,
    overflow: "hidden" as const,
    backgroundColor: CARD,
  },
  matchPhoto: { width: "100%" as any, height: "100%" as any },
  matchNameBlock: { alignItems: "center" as const, gap: 6 },
  cinematicMatchName: {
    color: TEXT,
    fontSize: 30,
    fontWeight: "900" as const,
    letterSpacing: -0.8,
  },
  matchSubhead: { color: MUTED, fontSize: 14, fontWeight: "500" as const },
  matchCtaBlock: { width: "100%" as any, gap: 10, marginTop: 4 },
  matchMessageBtn: { borderRadius: 18, overflow: "hidden" as const },
  matchMessageGrad: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 8,
    paddingVertical: 15,
  },
  matchMessageText: { color: TEXT, fontSize: 16, fontWeight: "800" as const },
  matchPlanBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 8,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: PINK,
    backgroundColor: "rgba(255,45,168,0.10)",
    paddingVertical: 14,
  },
  matchPlanText: { color: PINK, fontSize: 15, fontWeight: "800" as const },
  keepBtn: { alignItems: "center" as const, paddingVertical: 12 },
  keepText: { color: MUTED, fontSize: 14, fontWeight: "600" as const },

  // ── StarParticle ─────────────────────────────────────────────────────────────
  starParticle: {
    position: "absolute" as const,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: PINK,
  },

  // ── InviteModal extras ───────────────────────────────────────────────────────
  inviteIconGrad: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  inviteOptionsRow: {
    flexDirection: "row" as const,
    justifyContent: "space-around" as const,
    marginTop: 8,
    marginBottom: 12,
  },
  inviteOption: { alignItems: "center" as const, gap: 6, minWidth: 56 },
  inviteOptionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: CARD,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderWidth: 1,
    borderColor: BORDER,
  },
  inviteOptionLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: "600" as const,
    textAlign: "center" as const,
  },
  inviteNote: {
    color: MUTED,
    fontSize: 13,
    fontWeight: "400" as const,
    textAlign: "center" as const,
    marginTop: 8,
  },
  inviteDismiss: { alignItems: "center" as const, paddingVertical: 14, marginTop: 4 },
  inviteDismissText: { color: MUTED, fontSize: 15, fontWeight: "600" as const },
});
