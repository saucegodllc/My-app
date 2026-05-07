import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { DatingShot } from "@/contexts/DatingMatchContext";

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
  actions: { flexDirection: "row", gap: 8, marginTop: 14 },
  primaryBtn: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: PINK,
    alignItems: "center",
    paddingVertical: 10,
  },
  sparkBtn: {
    flex: 1.15,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.58)",
    backgroundColor: "rgba(168,85,247,0.18)",
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
