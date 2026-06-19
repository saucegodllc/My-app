import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

type Match = {
  id: string;
  matchedAt: string;
  otherProfile?: {
    displayName: string;
    photos?: string[] | null;
    isPremium: boolean;
    isVerified: boolean;
  } | null;
  lastMessage?: {
    content: string;
    senderId: string;
    createdAt: string;
  } | null;
  unreadCount?: number | null;
};

type Props = {
  match: Match;
  currentUserId: string;
  onPress: () => void;
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function MatchListItem({ match, currentUserId, onPress }: Props) {
  const colors = useColors();
  const profile = match.otherProfile;
  const photoUrl = profile?.photos?.[0];
  const hasUnread = (match.unreadCount ?? 0) > 0;
  const isMine = match.lastMessage?.senderId === currentUserId;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: pressed ? colors.muted : "transparent",
          borderBottomColor: colors.border,
        },
      ]}
      testID={`match-item-${match.id}`}
    >
      <View style={styles.avatarWrapper}>
        {photoUrl ? (
          <Image
            source={{ uri: photoUrl }}
            style={[styles.avatar, { backgroundColor: colors.muted }]}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.muted }]}>
            <Ionicons name="person" size={28} color={colors.mutedForeground} />
          </View>
        )}
        {hasUnread && (
          <View style={[styles.unreadDot, { backgroundColor: colors.primary }]}>
            {(match.unreadCount ?? 0) > 1 && (
              <Text style={styles.unreadCount}>{match.unreadCount}</Text>
            )}
          </View>
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.nameRow}>
          <Text
            style={[
              styles.name,
              { color: colors.foreground, fontFamily: hasUnread ? "Inter_700Bold" : "Inter_500Medium" },
            ]}
            numberOfLines={1}
          >
            {profile?.displayName ?? "Unknown"}
          </Text>
          {match.lastMessage && (
            <Text style={[styles.time, { color: colors.mutedForeground }]}>
              {timeAgo(match.lastMessage.createdAt)}
            </Text>
          )}
        </View>
        <Text
          style={[
            styles.preview,
            {
              color: hasUnread ? colors.foreground : colors.mutedForeground,
              fontFamily: hasUnread ? "Inter_500Medium" : "Inter_400Regular",
            },
          ]}
          numberOfLines={1}
        >
          {match.lastMessage
            ? `${isMine ? "You: " : ""}${match.lastMessage.content}`
            : "New match! Say hello 👋"}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  avatarWrapper: { position: "relative" },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  unreadDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#0a0a0a",
  },
  unreadCount: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
  content: { flex: 1, gap: 3 },
  nameRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontSize: 16, flex: 1 },
  time: { fontSize: 12, fontFamily: "Inter_400Regular" },
  preview: { fontSize: 14, lineHeight: 18 },
});
