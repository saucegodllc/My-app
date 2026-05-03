import { useAuth, useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DatingMatchesPreview } from "@/components/DatingMatchesPreview";
import { MatchListItem } from "@/components/MatchListItem";
import { useColors } from "@/hooks/useColors";
import { useGetMatches } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";

const PINK = "#FF299B";

export default function MatchesScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const botInset = Platform.OS === "web" ? 34 : insets.bottom;
  const { user } = useUser();
  const { isSignedIn } = useAuth();

  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useGetMatches(
    { page: 1, limit: 50 },
    {
      query: {
        enabled: !!isSignedIn,
        retry: 2,
        retryDelay: 1500,
        staleTime: 30_000,
      },
    }
  );

  const matches = data?.matches ?? [];
  const newMatches = matches.filter((m) => !m.lastMessage);
  const conversations = matches.filter((m) => !!m.lastMessage);

  if (!isSignedIn) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Ionicons name="lock-closed" size={48} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t("matches.empty")}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topInset + 12 }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("matches.title")}</Text>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={PINK} size="large" />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading your connections…</Text>
        </View>
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MatchListItem
              match={item as any}
              currentUserId={user?.id ?? ""}
              onPress={() => router.push(`/chat/${item.id}` as any)}
            />
          )}
          scrollEnabled={conversations.length > 0}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={PINK}
            />
          }
          ListHeaderComponent={
            <>
              <DatingMatchesPreview />
              {newMatches.length > 0 && (
                <View style={styles.newMatchesSection}>
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                    New Connections 🔥
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.newMatchesRow}>
                    {newMatches.map((match) => {
                      const photo = match.otherProfile?.photos?.[0];
                      return (
                        <Pressable
                          key={match.id}
                          onPress={() => router.push(`/chat/${match.id}` as any)}
                          style={styles.newMatchItem}
                        >
                          {photo ? (
                            <Image
                              source={{ uri: photo }}
                              style={[styles.newMatchAvatar, { backgroundColor: colors.muted }]}
                              contentFit="cover"
                            />
                          ) : (
                            <View style={[styles.newMatchAvatar, styles.avatarFallback, { backgroundColor: colors.muted }]}>
                              <Ionicons name="person" size={30} color={colors.mutedForeground} />
                            </View>
                          )}
                          <LinearGradient
                            colors={[PINK, "#8B00C9"]}
                            style={styles.newMatchDot}
                          />
                          <Text style={[styles.newMatchName, { color: colors.foreground }]} numberOfLines={1}>
                            {match.otherProfile?.displayName?.split(" ")[0] ?? "?"}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
              {conversations.length > 0 && (
                <Text style={[styles.sectionTitle, { color: colors.foreground, paddingHorizontal: 16, marginBottom: 4 }]}>
                  Messages
                </Text>
              )}
            </>
          }
          ListEmptyComponent={<EmptyState botInset={botInset} />}
          contentContainerStyle={{ paddingBottom: botInset + 80, flexGrow: 1 }}
        />
      )}
    </View>
  );
}

function EmptyState({ botInset }: { botInset: number }) {
  return (
    <View style={[styles.emptyState, { paddingBottom: botInset + 40 }]}>
      <View style={styles.emptyIconWrap}>
        <LinearGradient
          colors={["rgba(255,41,155,0.2)", "rgba(139,0,201,0.1)"]}
          style={styles.emptyIconGlow}
        />
        <Text style={styles.emptyEmoji}>💬</Text>
      </View>

      <Text style={styles.emptyTitle}>No connections yet 🔥</Text>
      <Text style={styles.emptySubtitle}>
        Start connecting to find your people.{"\n"}
        They'll show up right here.
      </Text>

      <Pressable
        style={({ pressed }) => [styles.emptyBtn, { opacity: pressed ? 0.85 : 1 }]}
        onPress={() => router.replace("/(tabs)/")}
      >
        <LinearGradient
          colors={[PINK, "#c4006e", "#8B00C9"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.emptyBtnGrad}
        >
          <Ionicons name="flame" size={18} color="#fff" />
          <Text style={styles.emptyBtnText}>Start Swiping</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Text style={styles.emptyEmoji}>😕</Text>
      </View>
      <Text style={styles.emptyTitle}>Couldn't load matches</Text>
      <Text style={styles.emptySubtitle}>
        Check your connection and try again.
      </Text>
      <Pressable
        style={({ pressed }) => [styles.emptyBtn, { opacity: pressed ? 0.85 : 1 }]}
        onPress={onRetry}
      >
        <LinearGradient
          colors={[PINK, "#c4006e"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.emptyBtnGrad}
        >
          <Ionicons name="refresh" size={18} color="#fff" />
          <Text style={styles.emptyBtnText}>Try Again</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },

  newMatchesSection: { paddingTop: 8, paddingBottom: 16, gap: 12 },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", paddingHorizontal: 16 },
  newMatchesRow: { paddingHorizontal: 16, gap: 16 },
  newMatchItem: { alignItems: "center", gap: 6, width: 72, position: "relative" },
  newMatchAvatar: { width: 68, height: 68, borderRadius: 34 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  newMatchDot: {
    position: "absolute", top: 2, right: 2,
    width: 14, height: 14, borderRadius: 7,
    borderWidth: 2, borderColor: "#0a0a0a",
  },
  newMatchName: { fontSize: 12, fontFamily: "Inter_500Medium", textAlign: "center" },

  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 40,
    paddingTop: 40,
  },
  emptyIconWrap: { position: "relative", alignItems: "center", justifyContent: "center", width: 110, height: 110 },
  emptyIconGlow: {
    position: "absolute",
    width: 110, height: 110,
    borderRadius: 55,
  },
  emptyEmoji: { fontSize: 52 },
  emptyTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff", textAlign: "center" },
  emptySubtitle: {
    fontSize: 14, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)", textAlign: "center", lineHeight: 22,
  },
  emptyBtn: { marginTop: 8, borderRadius: 20, overflow: "hidden" },
  emptyBtnGrad: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 14, paddingHorizontal: 28, borderRadius: 20,
  },
  emptyBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
});
