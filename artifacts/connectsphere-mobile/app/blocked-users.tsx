/**
 * Blocked Users Screen
 * ─────────────────────
 * Lists all users the current user has blocked.
 * Allows unblocking via trash icon.
 * Required for App Store compliance.
 *
 * Backend: reports block routes backed by the canonical blocks table.
 *
 * Route: /blocked-users (push from Settings)
 */
import { useUser } from "@clerk/clerk-expo";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { fetchBlockedUsers, unblockUser, type BlockedUser } from "@/services/blockedUsersApi";

export default function BlockedUsersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    void fetchBlockedUsers()
      .then(setUsers)
      .catch(() => {
        Alert.alert("Couldn't load blocked users", "Please try again.");
        setUsers([]);
      })
      .finally(() => setLoading(false));
  }, [user?.id]);

  const handleUnblock = (blocked: BlockedUser) => {
    if (!user?.id) return;
    Alert.alert(
      `Unblock ${blocked.name}?`,
      "They'll be able to see your profile and contact you again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unblock",
          style: "destructive",
          onPress: async () => {
            try {
              await unblockUser(blocked.id);
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setUsers((prev) => prev.filter((u) => u.id !== blocked.id));
            } catch {
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert("Couldn't unblock", "Please try again.");
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Blocked Users</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : users.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="shield-checkmark-outline" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No blocked users</Text>
          <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
            People you block will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          renderItem={({ item }) => (
            <View style={[styles.row, { borderBottomColor: colors.border }]}>
              <Image
                source={item.photoUrl ? { uri: item.photoUrl } : undefined}
                style={styles.avatar}
                contentFit="cover"
              />
              <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Pressable
                onPress={() => handleUnblock(item)}
                hitSlop={8}
                style={[styles.unblockBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.unblockText, { color: colors.primary }]}>Unblock</Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 17, fontFamily: "Inter_700Bold" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  emptyBody: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 32 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#222" },
  name: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  unblockBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  unblockText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
