import { useAuth, useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDatingMatches, type DatingMatch } from "@/contexts/DatingMatchContext";
import { useGetMatches } from "@workspace/api-client-react";

const PINK = "#ff2da8";
const PURPLE = "#a100ff";
const ORANGE = "#ff8a00";
const BG = "#050505";
const CARD = "#111111";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT = "#ffffff";
const MUTED = "rgba(255,255,255,0.55)";

type IntentType = "dating" | "friends" | "networking";

type ConnectMatch = {
  id: string;
  name: string;
  photoUrl?: string;
  intentType: IntentType;
  status: "New" | "Online" | "Active tonight";
  isOnline: boolean;
  isNew: boolean;
  activeTonight: boolean;
  matchedAt: string;
  conversationId: string | null;
  
  source: "local" | "server";
};

type ConnectConversation = {
  id: string;
  name: string;
  photoUrl?: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  intentType: IntentType;
  isOnline: boolean;
  source: "local" | "server";
};

function timeAgo(dateStr: string | undefined): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function MatchesScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 18 : insets.top;
  const botInset = Platform.OS === "web" ? 96 : 78 + insets.bottom;
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
    },
  );

  const dating = useDatingMatches();

  
  
  const { matches, conversations } = useMemo(() => {
    const serverMatches = data?.matches ?? [];

    const matchesArr: ConnectMatch[] = [];
    const convArr: ConnectConversation[] = [];

    
    for (const m of serverMatches) {
      const other = (m as any).otherProfile;
      const photo = other?.photos?.[0];
      const lastMsg = (m as any).lastMessage;
      if (lastMsg) {
        convArr.push({
          id: m.id,
          name: other?.displayName ?? "Unknown",
          photoUrl: photo,
          lastMessage:
            lastMsg.senderId === user?.id
              ? `You: ${lastMsg.content}`
              : lastMsg.content,
          lastMessageAt: timeAgo(lastMsg.createdAt),
          unreadCount: (m as any).unreadCount ?? 0,
          intentType: (other?.intent as IntentType) ?? "dating",
          isOnline: false,
          source: "server",
        });
      } else {
        matchesArr.push({
          id: m.id,
          name: other?.displayName ?? "Unknown",
          photoUrl: photo,
          intentType: (other?.intent as IntentType) ?? "dating",
          status: "New",
          isOnline: false,
          isNew: true,
          activeTonight: false,
          matchedAt: (m as any).matchedAt ?? new Date().toISOString(),
          conversationId: m.id,
          source: "server",
        });
      }
    }

    
    for (const dm of dating.matches) {
      const chat = dating.chats.find((c) => c.id === dm.chatId);
      const userMessages = chat?.messages.filter((msg) => msg.senderId !== "system") ?? [];
      const photo = dm.profile.photos[0];

      if (userMessages.length > 0) {
        const last = userMessages[userMessages.length - 1]!;
        convArr.push({
          id: `local:${dm.chatId}`,
          name: dm.profile.name,
          photoUrl: photo,
          lastMessage:
            last.senderId === dating.currentUserId
              ? `You: ${last.text}`
              : last.text,
          lastMessageAt: timeAgo(last.createdAt),
          unreadCount: 0,
          intentType: "dating",
          isOnline: true,
          source: "local",
        });
      } else {
        matchesArr.push({
          id: `local:${dm.id}`,
          name: dm.profile.name,
          photoUrl: photo,
          intentType: "dating",
          status: "New",
          isOnline: true,
          isNew: true,
          activeTonight: false,
          matchedAt: dm.createdAt,
          conversationId: dm.chatId,
          source: "local",
        });
      }
    }

    return { matches: matchesArr, conversations: convArr };
  }, [data, dating.matches, dating.chats, dating.currentUserId, user?.id]);

  
  const hasMatches = (matches?.length ?? 0) > 0;
  const hasConversations = (conversations?.length ?? 0) > 0;
  const shouldShowEmptyState = !hasMatches && !hasConversations;

  
  const openConversation = (id: string) => {
    if (id.startsWith("local:")) {
      router.push(`/chat/dating/${id.slice("local:".length)}` as never);
    } else {
      router.push(`/chat/${id}` as never);
    }
  };

  const openMatch = (m: ConnectMatch) => {
    if (m.source === "local") {
      router.push(`/chat/dating/${m.conversationId}` as never);
    } else {
      router.push(`/chat/${m.id}` as never);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: BG }]}>
      <Header topInset={topInset} />

      {isLoading && !data && !hasMatches && !hasConversations ? (
        <View style={styles.centered}>
          <ActivityIndicator color={PINK} size="large" />
        </View>
      ) : isError && !hasMatches && !hasConversations ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: botInset, gap: 4 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={PINK}
            />
          }
        >
          {shouldShowEmptyState ? (
            <EmptyConnectState />
          ) : (
            <ConnectContent
              matches={matches}
              conversations={conversations}
              openConversation={openConversation}
              openMatch={openMatch}
            />
          )}
        </ScrollView>
      )}
    </View>
  );
}


function Header({ topInset }: { topInset: number }) {
  return (
    <View style={[styles.header, { paddingTop: topInset + 12 }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>Connections</Text>
        <Text style={styles.headerSub}>Matches, chats, and plans start here.</Text>
      </View>
      <View style={styles.headerBtns}>
        <Pressable style={styles.headerIconBtn} hitSlop={8}>
          <Ionicons name="search" size={18} color="#fff" />
        </Pressable>
        <Pressable style={styles.headerIconBtn} hitSlop={8}>
          <Ionicons name="options-outline" size={18} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}


function ConnectContent({
  matches,
  conversations,
  openConversation,
  openMatch,
}: {
  matches: ConnectMatch[];
  conversations: ConnectConversation[];
  openConversation: (id: string) => void;
  openMatch: (m: ConnectMatch) => void;
}) {
  const hasMatches = matches.length > 0;
  return (
    <>
      {hasMatches ? <VibeSection matches={matches} openMatch={openMatch} /> : null}
      {hasMatches ? (
        <HypeCard
          firstMatch={matches[0]!}
          onPress={() => openMatch(matches[0]!)}
        />
      ) : null}
      <ChatsSection conversations={conversations} openConversation={openConversation} />
      <MoveItForward />
    </>
  );
}


function VibeSection({
  matches,
  openMatch,
}: {
  matches: ConnectMatch[];
  openMatch: (m: ConnectMatch) => void;
}) {
  return (
    <View style={styles.sectionWrap}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>🔥 It's a Vibe</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{matches.length}</Text>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.vibeRow}
      >
        {matches.map((m, i) => (
          <VibeCard key={m.id} match={m} index={i} onPress={() => openMatch(m)} />
        ))}
      </ScrollView>
    </View>
  );
}

function VibeCard({
  match,
  index,
  onPress,
}: {
  match: ConnectMatch;
  index: number;
  onPress: () => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        delay: index * 60,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        stiffness: 220,
        damping: 18,
        mass: 1,
        delay: index * 60,
        useNativeDriver: true,
      }),
    ]).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, scale, pulse, index]);

  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.85] });
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.06] });

  return (
    <Animated.View style={[styles.vibeCard, { opacity, transform: [{ scale }] }]}>
      <View style={styles.vibeAvatarWrap}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.vibeGlow,
            { opacity: glowOpacity, transform: [{ scale: glowScale }] },
          ]}
        >
          <LinearGradient
            colors={[PINK, PURPLE]}
            style={StyleSheet.absoluteFill as any}
          />
        </Animated.View>
        <LinearGradient colors={[PINK, PURPLE]} style={styles.vibeRing}>
          <View style={styles.vibeRingInner}>
            {match.photoUrl ? (
              <Image
                source={{ uri: match.photoUrl }}
                style={styles.vibePhoto}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.vibePhoto, styles.vibePhotoFallback]}>
                <Ionicons name="person" size={28} color="#fff" />
              </View>
            )}
          </View>
        </LinearGradient>
        {match.isOnline ? <View style={styles.onlineDot} /> : null}
      </View>

      <Text style={styles.vibeName} numberOfLines={1}>
        {match.name}
      </Text>

      <View style={styles.statusBadge}>
        <Text style={styles.statusBadgeText}>{match.status}</Text>
      </View>

      <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
        <LinearGradient colors={[PINK, PURPLE]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.sayHiBtn}>
          <Text style={styles.sayHiText}>Say Hi ⚡</Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}


function HypeCard({
  firstMatch,
  onPress,
}: {
  firstMatch: ConnectMatch;
  onPress: () => void;
}) {
  return (
    <View style={styles.hypeOuter}>
      <LinearGradient
        colors={["rgba(255,45,168,0.18)", "rgba(161,0,255,0.10)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hypeCard}
      >
        <Text style={styles.hypeTitle}>You've got people waiting 👀</Text>
        <Text style={styles.hypeText}>Say hi before the vibe cools off.</Text>
        <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
          <LinearGradient
            colors={[PINK, PURPLE]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.hypeBtn}
          >
            <Ionicons name="chatbubble-ellipses" size={14} color="#fff" />
            <Text style={styles.hypeBtnText}>Start a chat with {firstMatch.name}</Text>
          </LinearGradient>
        </Pressable>
      </LinearGradient>
    </View>
  );
}


function ChatsSection({
  conversations,
  openConversation,
}: {
  conversations: ConnectConversation[];
  openConversation: (id: string) => void;
}) {
  return (
    <View style={styles.sectionWrap}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Chats</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{conversations.length}</Text>
        </View>
      </View>
      {conversations.length === 0 ? (
        <View style={styles.chatsEmpty}>
          <Text style={styles.chatsEmptyText}>
            Your chats will appear here after you message a match.
          </Text>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 16, gap: 8 }}>
          {conversations.map((c, i) => (
            <ChatRow
              key={c.id}
              conv={c}
              index={i}
              onPress={() => openConversation(c.id)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function ChatRow({
  conv,
  index,
  onPress,
}: {
  conv: ConnectConversation;
  index: number;
  onPress: () => void;
}) {
  const translateX = useRef(new Animated.Value(20)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: 0,
        duration: 320,
        delay: index * 50,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        delay: index * 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateX, opacity, index]);

  const intentColor =
    conv.intentType === "dating"
      ? PINK
      : conv.intentType === "networking"
        ? "#34D399"
        : "#60A5FA";

  return (
    <Animated.View style={{ opacity, transform: [{ translateX }] }}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.chatRow,
          { backgroundColor: pressed ? "rgba(255,255,255,0.04)" : CARD },
        ]}
      >
        <View style={styles.chatAvatarWrap}>
          {conv.photoUrl ? (
            <Image source={{ uri: conv.photoUrl }} style={styles.chatAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.chatAvatar, styles.vibePhotoFallback]}>
              <Ionicons name="person" size={22} color="#fff" />
            </View>
          )}
          {conv.isOnline ? <View style={styles.chatOnlineDot} /> : null}
        </View>

        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.chatTopRow}>
            <Text style={styles.chatName} numberOfLines={1}>
              {conv.name}
            </Text>
            <Text style={styles.chatTime}>{conv.lastMessageAt}</Text>
          </View>
          <Text style={styles.chatPreview} numberOfLines={1}>
            {conv.lastMessage}
          </Text>
          <View style={styles.chatIntentRow}>
            <View style={[styles.intentPill, { borderColor: intentColor + "55", backgroundColor: intentColor + "1A" }]}>
              <Text style={[styles.intentPillText, { color: intentColor }]}>
                {conv.intentType.charAt(0).toUpperCase() + conv.intentType.slice(1)}
              </Text>
            </View>
          </View>
        </View>

        {conv.unreadCount > 0 ? (
          <LinearGradient colors={[PINK, PURPLE]} style={styles.unreadPill}>
            <Text style={styles.unreadPillText}>{conv.unreadCount}</Text>
          </LinearGradient>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}


function MoveItForward() {
  const cards = [
    { title: "Ask them out 🍸", sub: "Plan the perfect vibe", grad: [PINK, PURPLE] as [string, string] },
    { title: "Plan a double date 👯", sub: "Invite + match friends", grad: [PURPLE, "#5b3bff"] as [string, string] },
    { title: "Find active tonight ⚡", sub: "See who's out now", grad: [ORANGE, PINK] as [string, string] },
  ];
  return (
    <View style={styles.sectionWrap}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Move it forward</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
      >
        {cards.map((c) => (
          <Pressable key={c.title} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
            <LinearGradient
              colors={c.grad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.movePill}
            >
              <Text style={styles.moveTitle}>{c.title}</Text>
              <Text style={styles.moveSub}>{c.sub}</Text>
            </LinearGradient>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}


function EmptyConnectState() {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyGlowWrap}>
        <LinearGradient
          colors={["rgba(255,45,168,0.25)", "rgba(161,0,255,0.10)"]}
          style={styles.emptyGlow}
        />
        <Text style={{ fontSize: 56 }}>👀</Text>
      </View>
      <Text style={styles.emptyTitle}>Your people are out there 👀</Text>
      <Text style={styles.emptyText}>
        Start discovering and your best matches will show up here.
      </Text>
      <Pressable
        onPress={() => router.replace("/(tabs)/" as never)}
        style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
      >
        <LinearGradient
          colors={[PINK, PURPLE]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.emptyBtn}
        >
          <Ionicons name="flame" size={16} color="#fff" />
          <Text style={styles.emptyBtnText}>Start Discovering</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.empty}>
      <Text style={{ fontSize: 50 }}>😕</Text>
      <Text style={styles.emptyTitle}>Couldn't load matches</Text>
      <Text style={styles.emptyText}>Check your connection and try again.</Text>
      <Pressable onPress={onRetry} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
        <LinearGradient colors={[PINK, PURPLE]} style={styles.emptyBtn}>
          <Ionicons name="refresh" size={16} color="#fff" />
          <Text style={styles.emptyBtnText}>Try Again</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}


const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },

  
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  headerTitle: {
    color: TEXT,
    fontSize: 28,
    fontFamily: "Sora_800ExtraBold",
    letterSpacing: -0.5,
  },
  headerSub: {
    color: MUTED,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  headerBtns: { flexDirection: "row", gap: 8 },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
  },

  
  sectionWrap: { paddingTop: 14, paddingBottom: 6, gap: 10 },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    color: TEXT,
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },
  countBadge: {
    minWidth: 22,
    height: 20,
    paddingHorizontal: 7,
    borderRadius: 10,
    backgroundColor: "rgba(255,45,168,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,45,168,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  countBadgeText: { color: "#FBCFE8", fontSize: 11, fontFamily: "Inter_700Bold" },

  
  vibeRow: { paddingHorizontal: 16, gap: 12, paddingVertical: 4 },
  vibeCard: {
    width: 140,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 22,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    gap: 8,
  },
  vibeAvatarWrap: {
    width: 76,
    height: 76,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  vibeGlow: {
    position: "absolute",
    width: 92,
    height: 92,
    borderRadius: 46,
    overflow: "hidden",
  },
  vibeRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    padding: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  vibeRingInner: {
    width: "100%",
    height: "100%",
    borderRadius: 35,
    backgroundColor: BG,
    padding: 2,
    overflow: "hidden",
  },
  vibePhoto: { width: "100%", height: "100%", borderRadius: 33 },
  vibePhotoFallback: {
    backgroundColor: "#1f1029",
    alignItems: "center",
    justifyContent: "center",
  },
  onlineDot: {
    position: "absolute",
    bottom: 4,
    right: 6,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#22c55e",
    borderWidth: 2,
    borderColor: BG,
  },
  vibeName: {
    color: TEXT,
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    maxWidth: 120,
    textAlign: "center",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255,138,0,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,138,0,0.45)",
  },
  statusBadgeText: {
    color: ORANGE,
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  sayHiBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    marginTop: 2,
  },
  sayHiText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },

  
  hypeOuter: { paddingHorizontal: 16, paddingTop: 14 },
  hypeCard: {
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,45,168,0.30)",
    gap: 6,
  },
  hypeTitle: { color: TEXT, fontSize: 16, fontFamily: "Inter_700Bold" },
  hypeText: { color: MUTED, fontSize: 13, fontFamily: "Inter_400Regular" },
  hypeBtn: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 999,
  },
  hypeBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },

  
  chatsEmpty: { paddingHorizontal: 16, paddingVertical: 12 },
  chatsEmptyText: { color: MUTED, fontSize: 13, fontFamily: "Inter_400Regular" },
  chatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
  },
  chatAvatarWrap: { position: "relative" },
  chatAvatar: { width: 52, height: 52, borderRadius: 26 },
  chatOnlineDot: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: "#22c55e",
    borderWidth: 2,
    borderColor: CARD,
  },
  chatTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  chatName: { color: TEXT, fontSize: 15, fontFamily: "Inter_700Bold", flex: 1 },
  chatTime: { color: MUTED, fontSize: 11, fontFamily: "Inter_500Medium" },
  chatPreview: { color: MUTED, fontSize: 13, fontFamily: "Inter_400Regular" },
  chatIntentRow: { flexDirection: "row", gap: 6, marginTop: 2 },
  intentPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  intentPillText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  unreadPill: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadPillText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },

  
  movePill: {
    width: 200,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    gap: 4,
  },
  moveTitle: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  moveSub: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontFamily: "Inter_400Regular" },

  
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: 60,
    gap: 14,
  },
  emptyGlowWrap: {
    width: 130,
    height: 130,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  emptyGlow: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
  },
  emptyTitle: { color: TEXT, fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  emptyText: { color: MUTED, fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 999,
    marginTop: 6,
  },
  emptyBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
});
