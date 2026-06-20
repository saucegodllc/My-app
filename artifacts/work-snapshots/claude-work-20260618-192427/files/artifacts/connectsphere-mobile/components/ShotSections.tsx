import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRef, type ReactNode } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { DatingReaction, DatingShot } from "@/contexts/DatingMatchContext";
import type { FriendReaction } from "@/services/friendsApi";

const PINK = "#ff2da8";

function timeAgo(input: string) {
  const diff = Date.now() - new Date(input).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function IncomingShotsSection({
  shots,
  onAccept,
  onSparkBack,
  onIgnore,
}: {
  shots: DatingShot[];
  onAccept: (shot: DatingShot) => void;
  onSparkBack: (shot: DatingShot) => void;
  onIgnore: (shot: DatingShot) => void;
}) {
  if (shots.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Incoming Shots</Text>
          <Text style={styles.title}>Pre-match openers</Text>
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{shots.length}</Text>
        </View>
      </View>
      <View style={styles.stack}>
        {shots.map((shot) => (
          <ShotCard
            key={shot.id}
            shot={shot}
            mode="incoming"
            onAccept={() => onAccept(shot)}
            onSparkBack={() => onSparkBack(shot)}
            onIgnore={() => onIgnore(shot)}
          />
        ))}
      </View>
    </View>
  );
}

export function SentShotsSection({ shots }: { shots: DatingShot[] }) {
  if (shots.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Sent Shots</Text>
          <Text style={styles.title}>Waiting to be caught</Text>
        </View>
        <Ionicons name="send" size={17} color={PINK} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sentList}>
        {shots.slice(0, 8).map((shot) => (
          <ShotCard key={shot.id} shot={shot} mode="sent" />
        ))}
      </ScrollView>
    </View>
  );
}

export function ReactionsSection({
  reactions,
  onRevealLocked,
  onLikeBack,
  onSparkBack,
  onShootBack,
  onPass,
}: {
  reactions: ReactionItem[];
  onRevealLocked: () => void;
  onLikeBack: (reaction: ReactionItem) => void;
  onSparkBack: (reaction: ReactionItem) => void;
  onShootBack: (reaction: ReactionItem) => void;
  onPass: (reaction: ReactionItem) => void;
}) {
  if (reactions.length === 0) {
    return (
      <View style={styles.emptyReactions}>
        <LinearGradient colors={["rgba(236,72,153,0.14)", "rgba(168,85,247,0.08)"]} style={StyleSheet.absoluteFill} />
        <View style={styles.emptyIcon}>
          <Ionicons name="sparkles" size={20} color="#F9A8D4" />
        </View>
        <Text style={styles.emptyTitle}>No reactions yet</Text>
        <Text style={styles.emptyText}>Likes, Sparks, Shots, and Best Friend badges people send you will land here first.</Text>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Reactions</Text>
          <Text style={styles.title}>Who is into you</Text>
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{reactions.length}</Text>
        </View>
      </View>
      <View style={styles.stack}>
        {reactions.map((reaction) =>
          reaction.locked ? (
            <LockedReactionCard key={reaction.id} reaction={reaction} onPress={onRevealLocked} />
          ) : (
            <ReactionCard
              key={reaction.id}
              reaction={reaction}
              onLikeBack={() => onLikeBack(reaction)}
              onSparkBack={() => onSparkBack(reaction)}
              onShootBack={() => onShootBack(reaction)}
              onPass={() => onPass(reaction)}
            />
          ),
        )}
      </View>
    </View>
  );
}

type ReactionItem = DatingReaction | FriendReaction;

function isFriendReaction(reaction: ReactionItem): reaction is FriendReaction {
  return reaction.type === "friend_like" || reaction.type === "best_friend";
}

function LockedReactionCard({ reaction, onPress }: { reaction: ReactionItem; onPress: () => void }) {
  const icon =
    reaction.type === "shot"
      ? "send"
      : reaction.type === "spark"
      ? "sparkles"
      : reaction.type === "best_friend"
      ? "people-circle"
      : isFriendReaction(reaction)
      ? "people"
      : "heart";
  return (
    <AnimatedTap onPress={onPress} style={styles.lockedCard} pressScale={0.97}>
      <LinearGradient colors={["rgba(236,72,153,0.24)", "rgba(168,85,247,0.14)", "rgba(0,0,0,0)"]} style={StyleSheet.absoluteFill} />
      <View style={styles.lockedAvatar}>
        <LinearGradient colors={["rgba(255,255,255,0.18)", "rgba(236,72,153,0.30)", "rgba(0,0,0,0.18)"]} style={StyleSheet.absoluteFill} />
        <Ionicons name="lock-closed" size={20} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.lockedTitle}>{reaction.displayText}</Text>
        <Text style={styles.lockedSub}>Tap to reveal with ConnectSphere Plus.</Text>
      </View>
      <View style={styles.shotIcon}>
        <Ionicons name={icon as any} size={14} color="#F9A8D4" />
      </View>
    </AnimatedTap>
  );
}

function ReactionCard({
  reaction,
  onLikeBack,
  onSparkBack,
  onShootBack,
  onPass,
}: {
  reaction: ReactionItem;
  onLikeBack: () => void;
  onSparkBack: () => void;
  onShootBack: () => void;
  onPass: () => void;
}) {
  const profile = reaction.senderProfile;
  const photo = profile?.photos?.[0];
  const name = profile?.name ?? "Someone";
  const friend = isFriendReaction(reaction);
  const badge = reaction.type === "shot" ? "Shot" : reaction.type === "spark" ? "Spark" : reaction.type === "best_friend" ? "Best Friend" : friend ? "Friend Like" : "Like";
  const icon = reaction.type === "shot" ? "send" : reaction.type === "spark" ? "sparkles" : reaction.type === "best_friend" ? "people-circle" : friend ? "people" : "heart";
  const message = "message" in reaction ? reaction.message : undefined;

  return (
    <View style={styles.card}>
      <LinearGradient colors={["rgba(236,72,153,0.16)", "rgba(168,85,247,0.08)", "rgba(0,0,0,0)"]} style={StyleSheet.absoluteFill} />
      <View style={styles.topRow}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Ionicons name="person" size={18} color="#fff" />
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <Text style={styles.meta}>{timeAgo(reaction.createdAt)} · {badge}</Text>
        </View>
        <View style={styles.shotIcon}>
          <Ionicons name={icon as any} size={14} color="#F9A8D4" />
        </View>
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}
      {profile?.datingGoal ? <Text style={styles.reactionIntent}>Dating · {profile.datingGoal}</Text> : null}

      <View style={styles.reactionActions}>
        <AnimatedTap onPress={onLikeBack} style={styles.primaryBtn} wrapperStyle={styles.primaryBtnShell} pressScale={0.94}>
          <Text style={styles.primaryText}>{friend ? "Add Back" : "Like Back"}</Text>
        </AnimatedTap>
        <AnimatedTap onPress={onSparkBack} style={styles.sparkBtn} wrapperStyle={styles.sparkBtnShell} pressScale={0.94}>
          <Text style={styles.sparkText}>{friend ? "Best Friend" : "Spark"}</Text>
        </AnimatedTap>
        {!friend ? (
          <AnimatedTap onPress={onShootBack} style={styles.shootBtn} wrapperStyle={styles.shootBtnShell} pressScale={0.94}>
            <Text style={styles.sparkText}>Shot</Text>
          </AnimatedTap>
        ) : null}
        <AnimatedTap onPress={onPass} style={styles.ignoreBtn} pressScale={0.94}>
          <Text style={styles.ignoreText}>Pass</Text>
        </AnimatedTap>
      </View>
    </View>
  );
}

function AnimatedTap({
  children,
  onPress,
  pressScale = 0.96,
  style,
  wrapperStyle,
}: {
  children: ReactNode;
  onPress?: () => void;
  pressScale?: number;
  style?: any;
  wrapperStyle?: any;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const animateTo = (toValue: number) => {
    Animated.spring(scale, {
      toValue,
      friction: 7,
      tension: 220,
      useNativeDriver: true,
    }).start();
  };
  return (
    <Animated.View style={[wrapperStyle, { transform: [{ scale }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => animateTo(pressScale)}
        onPressOut={() => animateTo(1)}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

function ShotCard({
  shot,
  mode,
  onAccept,
  onSparkBack,
  onIgnore,
}: {
  shot: DatingShot;
  mode: "incoming" | "sent";
  onAccept?: () => void;
  onSparkBack?: () => void;
  onIgnore?: () => void;
}) {
  const profile = mode === "incoming" ? shot.senderProfile : shot.receiverProfile;
  const photo = profile?.photos?.[0];
  const name = profile?.name ?? (mode === "incoming" ? "Someone" : "Pending");
  const statusLabel =
    shot.status === "sparked_back" ? "Sparked back" :
    shot.status === "accepted" ? "Accepted" :
    shot.status === "ignored" ? "Ignored" :
    "Pending";

  return (
    <View style={[styles.card, mode === "sent" && styles.sentCard]}>
      <LinearGradient colors={["rgba(236,72,153,0.14)", "rgba(168,85,247,0.08)", "rgba(0,0,0,0)"]} style={StyleSheet.absoluteFill} />
      <View style={styles.topRow}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Ionicons name="person" size={18} color="#fff" />
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <Text style={styles.meta}>{timeAgo(shot.createdAt)} · {statusLabel}</Text>
        </View>
        <View style={styles.shotIcon}>
          <Ionicons name="chatbubble-ellipses" size={14} color="#F9A8D4" />
        </View>
      </View>

      <Text style={styles.message}>{shot.message}</Text>

      {mode === "incoming" ? (
        <View style={styles.actions}>
          <Pressable onPress={onAccept} style={styles.primaryBtn}>
            <Text style={styles.primaryText}>Accept</Text>
          </Pressable>
          <Pressable onPress={onSparkBack} style={styles.sparkBtn}>
            <Text style={styles.sparkText}>Spark Back</Text>
          </Pressable>
          <Pressable onPress={onIgnore} style={styles.ignoreBtn}>
            <Text style={styles.ignoreText}>Ignore</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 16, marginTop: 14 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  eyebrow: {
    color: "#F9A8D4",
    fontSize: 11,
    fontFamily: "Inter_800ExtraBold",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  title: { color: "#fff", fontSize: 18, fontFamily: "Sora_800ExtraBold", marginTop: 2 },
  countPill: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(236,72,153,0.18)",
    borderWidth: 1,
    borderColor: "rgba(236,72,153,0.36)",
  },
  countText: { color: "#F9A8D4", fontSize: 12, fontFamily: "Inter_800ExtraBold" },
  stack: { gap: 10 },
  sentList: { gap: 10, paddingRight: 18 },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(236,72,153,0.22)",
    backgroundColor: "rgba(255,255,255,0.055)",
    padding: 12,
    overflow: "hidden",
  },
  lockedCard: {
    minHeight: 94,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(236,72,153,0.34)",
    backgroundColor: "rgba(255,255,255,0.055)",
    padding: 12,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  lockedAvatar: {
    width: 54,
    height: 54,
    borderRadius: 18,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  lockedTitle: { color: "#fff", fontSize: 15, fontFamily: "Inter_800ExtraBold" },
  lockedSub: { color: "rgba(255,255,255,0.56)", fontSize: 12, fontFamily: "Inter_600SemiBold", marginTop: 3 },
  emptyReactions: {
    marginHorizontal: 16,
    marginTop: 14,
    minHeight: 180,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(236,72,153,0.22)",
    backgroundColor: "rgba(255,255,255,0.045)",
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
    overflow: "hidden",
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(236,72,153,0.16)",
    borderWidth: 1,
    borderColor: "rgba(236,72,153,0.30)",
    marginBottom: 12,
  },
  emptyTitle: { color: "#fff", fontSize: 17, fontFamily: "Sora_800ExtraBold" },
  emptyText: {
    color: "rgba(255,255,255,0.56)",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    fontFamily: "Inter_600SemiBold",
    marginTop: 6,
  },
  sentCard: { width: 260 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 42, height: 42, borderRadius: 15 },
  avatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(236,72,153,0.20)" },
  name: { color: "#fff", fontSize: 14, fontFamily: "Inter_800ExtraBold" },
  meta: { color: "rgba(255,255,255,0.46)", fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  shotIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(236,72,153,0.14)",
    borderWidth: 1,
    borderColor: "rgba(236,72,153,0.24)",
  },
  message: { color: "#FCE7F3", fontSize: 15, lineHeight: 21, fontFamily: "Inter_700Bold", marginTop: 12 },
  reactionIntent: { color: "#F9A8D4", fontSize: 12, fontFamily: "Inter_800ExtraBold", marginTop: 10 },
  actions: { flexDirection: "row", gap: 8, marginTop: 14 },
  reactionActions: { flexDirection: "row", gap: 7, marginTop: 14 },
  primaryBtnShell: { flex: 1 },
  sparkBtnShell: { flex: 1.15 },
  shootBtnShell: { flex: 0.9 },
  primaryBtn: {
    borderRadius: 999,
    backgroundColor: PINK,
    alignItems: "center",
    paddingVertical: 10,
  },
  sparkBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.58)",
    backgroundColor: "rgba(168,85,247,0.18)",
    alignItems: "center",
    paddingVertical: 10,
  },
  shootBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(236,72,153,0.44)",
    backgroundColor: "rgba(236,72,153,0.16)",
    alignItems: "center",
    paddingVertical: 10,
  },
  ignoreBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: "#fff", fontSize: 12, fontFamily: "Inter_800ExtraBold" },
  sparkText: { color: "#E9D5FF", fontSize: 12, fontFamily: "Inter_800ExtraBold" },
  ignoreText: { color: "rgba(255,255,255,0.62)", fontSize: 12, fontFamily: "Inter_800ExtraBold" },
});
