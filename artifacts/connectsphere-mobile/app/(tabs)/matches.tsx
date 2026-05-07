import { useAuth, useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IncomingShotsSection, SentShotsSection } from "@/components/ShotSections";
import { useDatingMatches, type DatingPlan } from "@/contexts/DatingMatchContext";
import { useGetMatches } from "@workspace/api-client-react";

const PINK = "#ff2da8";
const PURPLE = "#a100ff";
const ORANGE = "#ff8a00";
const BG = "#000000";
const SURFACE = "#0d0d0d";
const CARD = "#141414";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT = "#ffffff";
const MUTED = "rgba(255,255,255,0.55)";
const FAINT = "rgba(255,255,255,0.32)";

type IntentType = "dating" | "friends" | "networking";

type Conversation = {
  id: string;
  userId: string;
  name: string;
  photoUrl?: string;
  lastMessage: string;
  lastMessageAt: string;
  rawTime: number;
  unreadCount: number;
  intentType: IntentType;
  isOnline: boolean;
  isPinned: boolean;
  isMuted: boolean;
  source: "local" | "server";
};

type ConnectionMatch = {
  id: string;
  userId: string;
  name: string;
  photoUrl?: string;
  intentType: IntentType;
  isOnline: boolean;
  isNew: boolean;
  activeTonight: boolean;
  matchedAt: string;
  conversationId: string | null;
  source: "local" | "server";
};

type ConnectionRequest = {
  id: string;
  userId: string;
  name: string;
  photoUrl?: string;
  intentType: IntentType;
  reason: string;
  createdAt: string;
};

type InboxTab = "primary" | "requests" | "new";


const INITIAL_REQUESTS: ConnectionRequest[] = [
  {
    id: "req_1",
    userId: "u_camila",
    name: "Camila",
    photoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80",
    intentType: "dating",
    reason: "Wants to connect — Active Tonight",
    createdAt: new Date(Date.now() - 4 * 60_000).toISOString(),
  },
  {
    id: "req_2",
    userId: "u_diego",
    name: "Diego",
    photoUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80",
    intentType: "networking",
    reason: "Founder · Real Estate · Brickell",
    createdAt: new Date(Date.now() - 38 * 60_000).toISOString(),
  },
  {
    id: "req_3",
    userId: "u_zoe",
    name: "Zoe",
    photoUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80",
    intentType: "friends",
    reason: "Beach mornings + matcha runs",
    createdAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
  },
];

function timeAgo(input: string | number | undefined): string {
  if (!input) return "";
  const ts = typeof input === "number" ? input : new Date(input).getTime();
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

function intentColor(t: IntentType): string {
  return t === "dating" ? PINK : t === "networking" ? "#34D399" : "#60A5FA";
}

function intentLabel(t: IntentType): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function normalizeIntent(value: unknown): IntentType {
  if (value === "networking") return "networking";
  if (value === "friends" || value === "friendship") return "friends";
  return "dating";
}

export default function ConnectScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 18 : insets.top;
  const botInset = Platform.OS === "web" ? 96 : 78 + insets.bottom;
  const { user } = useUser();
  const { isSignedIn } = useAuth();

  const { data, isLoading, isError, refetch, isRefetching } = useGetMatches(
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


  const [tab, setTab] = useState<InboxTab>("primary");
  const [search, setSearch] = useState("");
  const [requestsState, setRequestsState] = useState<ConnectionRequest[]>(INITIAL_REQUESTS);
  const [pinned, setPinned] = useState<Record<string, boolean>>({});
  const [muted, setMuted] = useState<Record<string, boolean>>({});
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [storyFilter, setStoryFilter] = useState<string | null>(null);
  const [actionsFor, setActionsFor] = useState<Conversation | null>(null);


  const { conversations, matches } = useMemo(() => {
    const convs: Conversation[] = [];
    const ms: ConnectionMatch[] = [];
    const serverMatches = data?.matches ?? [];

    for (const m of serverMatches) {
      const other: any = (m as any).otherProfile;
      const photo: string | undefined = other?.photos?.[0];
      const lastMsg: any = (m as any).lastMessage;
      const intent = normalizeIntent(other?.intent);
      if (lastMsg) {
        convs.push({
          id: m.id,
          userId: other?.userId ?? other?.id ?? m.id,
          name: other?.displayName ?? "Unknown",
          photoUrl: photo,
          lastMessage:
            lastMsg.senderId === user?.id ? `You: ${lastMsg.content}` : lastMsg.content,
          lastMessageAt: timeAgo(lastMsg.createdAt),
          rawTime: new Date(lastMsg.createdAt).getTime(),
          unreadCount: (m as any).unreadCount ?? 0,
          intentType: intent,
          isOnline: false,
          isPinned: !!pinned[m.id],
          isMuted: !!muted[m.id],
          source: "server",
        });
      } else {
        ms.push({
          id: m.id,
          userId: other?.userId ?? other?.id ?? m.id,
          name: other?.displayName ?? "Unknown",
          photoUrl: photo,
          intentType: intent,
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
      const userMsgs = chat?.messages.filter((x) => x.senderId !== "system") ?? [];
      const photo = dm.profile.photos[0];
      const intent: IntentType = "dating";
      const localKey = `local:${dm.chatId}`;
      if (userMsgs.length > 0) {
        const last = userMsgs[userMsgs.length - 1]!;
        convs.push({
          id: localKey,
          userId: dm.profile.id,
          name: dm.profile.name,
          photoUrl: photo,
          lastMessage:
            last.senderId === dating.currentUserId ? `You: ${last.text}` : last.text,
          lastMessageAt: timeAgo(last.createdAt),
          rawTime: new Date(last.createdAt).getTime(),
          unreadCount: 0,
          intentType: intent,
          isOnline: true,
          isPinned: !!pinned[localKey],
          isMuted: !!muted[localKey],
          source: "local",
        });
      } else {
        ms.push({
          id: `local:${dm.id}`,
          userId: dm.profile.id,
          name: dm.profile.name,
          photoUrl: photo,
          intentType: intent,
          isOnline: true,
          isNew: true,
          activeTonight: true,
          matchedAt: dm.createdAt,
          conversationId: dm.chatId,
          source: "local",
        });
      }
    }

    return { conversations: convs, matches: ms };
  }, [data, dating.matches, dating.chats, dating.currentUserId, user?.id, pinned, muted]);

  const requests = requestsState;


  const visibleConversations = useMemo(() => {
    let list = conversations.filter((c) => !hidden[c.id]);
    if (storyFilter) {
      if (storyFilter === "active") list = list.filter((c) => c.isOnline);
      else if (storyFilter === "new") list = [];
      else list = list.filter((c) => c.intentType === storyFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.intentType.toLowerCase().includes(q) ||
          c.lastMessage.toLowerCase().includes(q),
      );
    }

    return [...list].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return b.rawTime - a.rawTime;
    });
  }, [conversations, hidden, storyFilter, search]);

  const visibleMatches = useMemo(() => {
    let list = matches;
    if (storyFilter) {
      if (storyFilter === "new") list = list.filter((m) => m.isNew);
      else if (storyFilter === "active") list = list.filter((m) => m.isOnline);
      else if (storyFilter === "double") list = []; // no mock data
      else list = list.filter((m) => m.intentType === storyFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (m) => m.name.toLowerCase().includes(q) || m.intentType.toLowerCase().includes(q),
      );
    }
    return list;
  }, [matches, storyFilter, search]);

  const visibleRequests = useMemo(() => {
    let list = requests;
    if (storyFilter) {
      if (storyFilter === "dating" || storyFilter === "friends" || storyFilter === "networking") {
        list = list.filter((r) => r.intentType === storyFilter);
      } else if (storyFilter === "new" || storyFilter === "active" || storyFilter === "double") {
        list = [];
      }
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.intentType.toLowerCase().includes(q) ||
          r.reason.toLowerCase().includes(q),
      );
    }
    return list;
  }, [requests, search, storyFilter]);


  const hasConnections =
    conversations.length > 0 ||
    matches.length > 0 ||
    requests.length > 0 ||
    dating.incomingShots.length > 0 ||
    dating.sentShots.length > 0;


  const openConversation = (id: string) => {
    if (id.startsWith("local:")) {
      router.push(`/chat/dating/${id.slice("local:".length)}` as never);
    } else {
      router.push(`/chat/${id}` as never);
    }
  };
  const openMatch = (m: ConnectionMatch) => {
    if (m.source === "local") router.push(`/chat/dating/${m.conversationId}` as never);
    else router.push(`/chat/${m.id}` as never);
  };

  const handleShotResponse = async (shotId: string, action: "accept" | "spark_back" | "ignore") => {
    const result = await dating.respondToShot(shotId, action);
    if (result.success && action !== "ignore") refetch();
  };

  const handleAcceptRequest = (req: ConnectionRequest) => {
    setRequestsState((prev) => prev.filter((r) => r.id !== req.id));

  };
  const handlePassRequest = (req: ConnectionRequest) => {
    setRequestsState((prev) => prev.filter((r) => r.id !== req.id));
  };

  const togglePin = (id: string) => setPinned((p) => ({ ...p, [id]: !p[id] }));
  const toggleMute = (id: string) => setMuted((p) => ({ ...p, [id]: !p[id] }));
  const deleteConv = (id: string) => setHidden((p) => ({ ...p, [id]: true }));

  return (
    <View style={[styles.root, { backgroundColor: BG }]}>
      <ConnectionsHeader topInset={topInset} />

      <ConnectionSearchBar value={search} onChange={setSearch} />

      {isLoading && !data && !hasConnections ? (
        <View style={styles.centered}>
          <ActivityIndicator color={PINK} size="large" />
        </View>
      ) : isError && !hasConnections ? (
        <ErrorState onRetry={refetch} />
      ) : !hasConnections ? (

        <ScrollView
          contentContainerStyle={{ paddingBottom: botInset, flexGrow: 1 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={PINK} />
          }
        >
          <GlobalEmptyState />
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: botInset }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={PINK} />
          }
        >
          <StoryConnectionRow
            matches={matches}
            conversations={conversations}
            activeFilter={storyFilter}
            onSelect={setStoryFilter}
            onTapMatch={openMatch}
          />

          <IncomingShotsSection
            shots={dating.incomingShots}
            onAccept={(shot) => handleShotResponse(shot.id, "accept")}
            onSparkBack={(shot) => handleShotResponse(shot.id, "spark_back")}
            onIgnore={(shot) => handleShotResponse(shot.id, "ignore")}
          />

          <SentShotsSection shots={dating.sentShots} />

          {dating.plans.length > 0 ? (
            <ActiveDatingPlans
              plans={dating.plans}
              onOpen={(plan) => {
                if (plan.source === "server") {
                  if (!plan.chatId.startsWith("pending:")) router.push(`/chat/${plan.chatId}` as never);
                } else {
                  router.push(`/chat/dating/${plan.chatId}` as never);
                }
              }}
            />
          ) : null}

          <InboxTabs
            tab={tab}
            onChange={setTab}
            primaryCount={visibleConversations.length}
            requestCount={requests.length}
            newMatchCount={matches.length}
          />

          {tab === "primary" ? (
            visibleConversations.length === 0 ? (
              <EmptyInboxState
                title="Your inbox is quiet"
                text="Start connecting and your chats will show here."
              />
            ) : (
              <View style={{ paddingTop: 4 }}>
                {visibleConversations.map((c, i) => (
                  <ConversationRow
                    key={c.id}
                    conv={c}
                    index={i}
                    onPress={() => openConversation(c.id)}
                    onLongPress={() => setActionsFor(c)}
                  />
                ))}
              </View>
            )
          ) : tab === "requests" ? (
            visibleRequests.length === 0 ? (
              <EmptyInboxState
                title="No requests right now"
                text="When someone wants to connect, they'll show up here."
              />
            ) : (
              <View style={{ paddingTop: 4 }}>
                {visibleRequests.map((r, i) => (
                  <RequestRow
                    key={r.id}
                    req={r}
                    index={i}
                    onAccept={() => handleAcceptRequest(r)}
                    onPass={() => handlePassRequest(r)}
                  />
                ))}
              </View>
            )
          ) : visibleMatches.length === 0 ? (
            <EmptyInboxState
              title="No new matches yet"
              text="Keep discovering — your next vibe is close."
            />
          ) : (
            <View style={{ paddingTop: 4 }}>
              {visibleMatches.map((m, i) => (
                <NewMatchRow
                  key={m.id}
                  match={m}
                  index={i}
                  onPress={() => openMatch(m)}
                />
              ))}
            </View>
          )}


          {tab === "primary" && hasConnections ? (
            <QuickActionRow />
          ) : null}
        </ScrollView>
      )}

      <RowActionsModal
        conv={actionsFor}
        onClose={() => setActionsFor(null)}
        onPin={(c) => {
          togglePin(c.id);
          setActionsFor(null);
        }}
        onMute={(c) => {
          toggleMute(c.id);
          setActionsFor(null);
        }}
        onDelete={(c) => {
          deleteConv(c.id);
          setActionsFor(null);
        }}
      />
    </View>
  );
}


function ConnectionsHeader({ topInset }: { topInset: number }) {
  return (
    <View style={[styles.header, { paddingTop: topInset + 10 }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>Connections</Text>
        <Text style={styles.headerSub}>Messages, matches, and requests</Text>
      </View>
      <View style={styles.headerBtns}>
        <Pressable style={styles.headerIconBtn} hitSlop={8}>
          <Ionicons name="search" size={18} color="#fff" />
        </Pressable>
        <Pressable style={styles.headerIconBtn} hitSlop={8}>
          <Ionicons name="create-outline" size={18} color="#fff" />
        </Pressable>
        <Pressable style={styles.headerIconBtn} hitSlop={8}>
          <Ionicons name="options-outline" size={18} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

function ConnectionSearchBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.searchWrap}>
      <View style={styles.searchPill}>
        <Ionicons name="search" size={16} color={MUTED} />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="Search connections"
          placeholderTextColor={MUTED}
          style={styles.searchInput}
        />
        {value.length > 0 ? (
          <Pressable onPress={() => onChange("")} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={FAINT} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}


function StoryConnectionRow({
  matches,
  conversations,
  activeFilter,
  onSelect,
  onTapMatch,
}: {
  matches: ConnectionMatch[];
  conversations: Conversation[];
  activeFilter: string | null;
  onSelect: (f: string | null) => void;
  onTapMatch: (m: ConnectionMatch) => void;
}) {
  const newMatches = matches.filter((m) => m.isNew);
  const activeNow = [
    ...conversations.filter((c) => c.isOnline),
    ...matches.filter((m) => m.isOnline),
  ];

  const filters: Array<{ key: string; label: string; emoji: string }> = [
    { key: "new", label: "New Matches", emoji: "🔥" },
    { key: "active", label: "Active Now", emoji: "⚡" },
    { key: "dating", label: "Dating", emoji: "💖" },
    { key: "friends", label: "Friends", emoji: "👯" },
    { key: "networking", label: "Opportunities", emoji: "💼" },
    { key: "double", label: "Double Date", emoji: "✨" },
  ];

  return (
    <View style={styles.storyWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storyRow}
      >
        {newMatches.slice(0, 6).map((m) => (
          <StoryBubble
            key={`m-${m.id}`}
            label={m.name.split(" ")[0]!}
            photoUrl={m.photoUrl}
            isOnline={m.isOnline}
            ringActive
            onPress={() => onTapMatch(m)}
          />
        ))}

        <View style={styles.storyDivider} />

        {filters.map((f) => {
          const active = activeFilter === f.key;
          return (
            <StoryBubble
              key={f.key}
              label={f.label}
              emoji={f.emoji}
              ringActive={active}
              dim={!active && activeFilter !== null}
              onPress={() => onSelect(active ? null : f.key)}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

function StoryBubble({
  label,
  photoUrl,
  emoji,
  isOnline,
  ringActive,
  dim,
  onPress,
}: {
  label: string;
  photoUrl?: string;
  emoji?: string;
  isOnline?: boolean;
  ringActive?: boolean;
  dim?: boolean;
  onPress: () => void;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!ringActive) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, ringActive]);
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });

  return (
    <Pressable onPress={onPress} style={[styles.storyItem, dim && { opacity: 0.5 }]}>
      <View style={styles.storyBubbleWrap}>
        {ringActive ? (
          <Animated.View style={[styles.storyGlow, { opacity: glowOpacity }]}>
            <LinearGradient colors={[PINK, PURPLE, ORANGE]} style={StyleSheet.absoluteFill as any} />
          </Animated.View>
        ) : null}
        <LinearGradient
          colors={ringActive ? [PINK, PURPLE, ORANGE] : ["#2a2a2a", "#1a1a1a"]}
          style={styles.storyRing}
        >
          <View style={styles.storyInner}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.storyPhoto} contentFit="cover" />
            ) : (
              <View style={[styles.storyPhoto, styles.storyEmojiWrap]}>
                <Text style={styles.storyEmojiText}>{emoji ?? "✦"}</Text>
              </View>
            )}
          </View>
        </LinearGradient>
        {isOnline ? <View style={styles.storyOnlineDot} /> : null}
      </View>
      <Text style={styles.storyLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function ActiveDatingPlans({
  plans,
  onOpen,
}: {
  plans: DatingPlan[];
  onOpen: (plan: DatingPlan) => void;
}) {
  return (
    <View style={styles.activePlansWrap}>
      <View style={styles.activePlansHeader}>
        <View>
          <Text style={styles.sectionEyebrow}>Active plans</Text>
          <Text style={styles.activePlansTitle}>Dates to follow up on</Text>
        </View>
        <Ionicons name="calendar" size={18} color={PINK} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activePlansList}>
        {plans.map((plan) => (
          <Pressable key={plan.id} onPress={() => onOpen(plan)} style={styles.activePlanCard}>
            <LinearGradient colors={[PINK, PURPLE]} style={styles.activePlanIcon}>
              <Ionicons name="sparkles" size={16} color="#FFF" />
            </LinearGradient>
            <Text style={styles.activePlanName} numberOfLines={1}>{plan.profile.name}</Text>
            <Text style={styles.activePlanTitle} numberOfLines={1}>{plan.title}</Text>
            <Text style={styles.activePlanMeta} numberOfLines={1}>{plan.time ?? "This week"} - {plan.place ?? "Nearby"}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}


function InboxTabs({
  tab,
  onChange,
  primaryCount,
  requestCount,
  newMatchCount,
}: {
  tab: InboxTab;
  onChange: (t: InboxTab) => void;
  primaryCount: number;
  requestCount: number;
  newMatchCount: number;
}) {
  const tabs: Array<{ key: InboxTab; label: string; count: number }> = [
    { key: "primary", label: "Primary", count: primaryCount },
    { key: "requests", label: "Requests", count: requestCount },
    { key: "new", label: "New Matches", count: newMatchCount },
  ];
  return (
    <View style={styles.tabBar}>
      {tabs.map((t) => {
        const active = tab === t.key;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            style={styles.tabBtn}
          >
            <View style={styles.tabLabelRow}>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {t.label}
              </Text>
              {t.count > 0 ? (
                <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, active && styles.tabBadgeTextActive]}>
                    {t.count}
                  </Text>
                </View>
              ) : null}
            </View>
            {active ? <View style={styles.tabUnderline} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}


function ConversationRow({
  conv,
  index,
  onPress,
  onLongPress,
}: {
  conv: Conversation;
  index: number;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const tx = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 280,
        delay: index * 40,
        useNativeDriver: true,
      }),
      Animated.timing(tx, {
        toValue: 0,
        duration: 280,
        delay: index * 40,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, tx, index]);

  const ic = intentColor(conv.intentType);
  const unread = conv.unreadCount > 0;

  return (
    <Animated.View style={{ opacity, transform: [{ translateX: tx }] }}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={250}
        style={({ pressed }) => [styles.dmRow, pressed && { backgroundColor: "rgba(255,255,255,0.04)" }]}
      >
        <View style={styles.dmAvatarWrap}>
          {conv.photoUrl ? (
            <Image source={{ uri: conv.photoUrl }} style={styles.dmAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.dmAvatar, styles.storyEmojiWrap]}>
              <Ionicons name="person" size={22} color="#fff" />
            </View>
          )}
          {conv.isOnline ? <View style={styles.dmOnlineDot} /> : null}
        </View>

        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.dmTopRow}>
            <Text
              style={[styles.dmName, unread && styles.dmNameUnread]}
              numberOfLines={1}
            >
              {conv.isPinned ? "📌 " : ""}
              {conv.name}
            </Text>
            <Text style={styles.dmTime}>{conv.lastMessageAt}</Text>
          </View>
          <View style={styles.dmBottomRow}>
            <Text
              style={[styles.dmPreview, unread && styles.dmPreviewUnread]}
              numberOfLines={1}
            >
              {conv.lastMessage}
            </Text>
            {conv.isMuted ? (
              <Ionicons name="notifications-off" size={12} color={FAINT} style={{ marginLeft: 6 }} />
            ) : null}
          </View>
          <View style={styles.dmIntentRow}>
            <View style={[styles.intentPill, { borderColor: ic + "55", backgroundColor: ic + "1A" }]}>
              <Text style={[styles.intentPillText, { color: ic }]}>
                {intentLabel(conv.intentType)}
              </Text>
            </View>
          </View>
        </View>

        {unread ? (
          <LinearGradient colors={[PINK, PURPLE]} style={styles.unreadPill}>
            <Text style={styles.unreadPillText}>{conv.unreadCount}</Text>
          </LinearGradient>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}


function RequestRow({
  req,
  index,
  onAccept,
  onPass,
}: {
  req: ConnectionRequest;
  index: number;
  onAccept: () => void;
  onPass: () => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 260,
      delay: index * 50,
      useNativeDriver: true,
    }).start();
  }, [opacity, index]);

  const ic = intentColor(req.intentType);
  return (
    <Animated.View style={{ opacity }}>
      <View style={styles.dmRow}>
        <View style={styles.dmAvatarWrap}>
          {req.photoUrl ? (
            <Image source={{ uri: req.photoUrl }} style={styles.dmAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.dmAvatar, styles.storyEmojiWrap]}>
              <Ionicons name="person" size={22} color="#fff" />
            </View>
          )}
        </View>

        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.dmTopRow}>
            <Text style={styles.dmName} numberOfLines={1}>
              {req.name}
            </Text>
            <Text style={styles.dmTime}>{timeAgo(req.createdAt)}</Text>
          </View>
          <Text style={styles.dmPreview} numberOfLines={1}>
            {req.reason}
          </Text>
          <View style={styles.dmIntentRow}>
            <View style={[styles.intentPill, { borderColor: ic + "55", backgroundColor: ic + "1A" }]}>
              <Text style={[styles.intentPillText, { color: ic }]}>
                {intentLabel(req.intentType)}
              </Text>
            </View>
          </View>
          <View style={styles.reqActions}>
            <Pressable onPress={onAccept} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
              <LinearGradient
                colors={[PINK, PURPLE]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.reqAcceptBtn}
              >
                <Text style={styles.reqAcceptText}>Accept</Text>
              </LinearGradient>
            </Pressable>
            <Pressable
              onPress={onPass}
              style={({ pressed }) => [
                styles.reqPassBtn,
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={styles.reqPassText}>Pass</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}


function NewMatchRow({
  match,
  index,
  onPress,
}: {
  match: ConnectionMatch;
  index: number;
  onPress: () => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const tx = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 280,
        delay: index * 50,
        useNativeDriver: true,
      }),
      Animated.timing(tx, {
        toValue: 0,
        duration: 280,
        delay: index * 50,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, tx, index]);

  const ic = intentColor(match.intentType);
  return (
    <Animated.View style={{ opacity, transform: [{ translateX: tx }] }}>
      <View style={styles.dmRow}>
        <View style={styles.dmAvatarWrap}>
          <LinearGradient colors={[PINK, PURPLE]} style={styles.matchRing}>
            <View style={styles.matchRingInner}>
              {match.photoUrl ? (
                <Image source={{ uri: match.photoUrl }} style={styles.dmAvatar} contentFit="cover" />
              ) : (
                <View style={[styles.dmAvatar, styles.storyEmojiWrap]}>
                  <Ionicons name="person" size={22} color="#fff" />
                </View>
              )}
            </View>
          </LinearGradient>
          {match.isOnline ? <View style={styles.dmOnlineDot} /> : null}
        </View>

        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.dmTopRow}>
            <Text style={[styles.dmName, styles.dmNameUnread]} numberOfLines={1}>
              {match.name}
            </Text>
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>NEW</Text>
            </View>
          </View>
          <Text style={[styles.dmPreview, { color: PINK }]} numberOfLines={1}>
            You matched — say hi 👀
          </Text>
          <View style={styles.dmIntentRow}>
            <View style={[styles.intentPill, { borderColor: ic + "55", backgroundColor: ic + "1A" }]}>
              <Text style={[styles.intentPillText, { color: ic }]}>
                {intentLabel(match.intentType)}
              </Text>
            </View>
            {match.activeTonight ? (
              <View
                style={[
                  styles.intentPill,
                  { borderColor: ORANGE + "55", backgroundColor: ORANGE + "1A" },
                ]}
              >
                <Text style={[styles.intentPillText, { color: ORANGE }]}>Active tonight</Text>
              </View>
            ) : null}
          </View>
        </View>

        <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
          <LinearGradient
            colors={[PINK, PURPLE]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.messageBtn}
          >
            <Text style={styles.messageBtnText}>Message</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </Animated.View>
  );
}


function QuickActionRow() {
  const cards: Array<{ title: string; sub: string; grad: [string, string]; icon: any }> = [
    { title: "Quick opener", sub: "Break the ice fast", grad: [PINK, PURPLE], icon: "flash" },
    { title: "Plan something", sub: "Suggest a hangout", grad: [PURPLE, "#5b3bff"], icon: "calendar" },
    { title: "Double date", sub: "Invite friends too", grad: ["#5b3bff", "#0099ff"], icon: "people" },
    { title: "Nearby tonight", sub: "See who's out now", grad: [ORANGE, PINK], icon: "location" },
  ];
  return (
    <View style={styles.quickWrap}>
      <Text style={styles.quickHead}>Move it forward</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
      >
        {cards.map((c) => (
          <Pressable key={c.title} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
            <LinearGradient
              colors={c.grad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.quickCard}
            >
              <Ionicons name={c.icon} size={18} color="#fff" />
              <Text style={styles.quickTitle}>{c.title}</Text>
              <Text style={styles.quickSub}>{c.sub}</Text>
            </LinearGradient>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}


function RowActionsModal({
  conv,
  onClose,
  onPin,
  onMute,
  onDelete,
}: {
  conv: Conversation | null;
  onClose: () => void;
  onPin: (c: Conversation) => void;
  onMute: (c: Conversation) => void;
  onDelete: (c: Conversation) => void;
}) {
  if (!conv) return null;
  return (
    <Modal visible={!!conv} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <View />
      </Pressable>
      <View style={styles.sheet}>
        <Text style={styles.sheetTitle} numberOfLines={1}>{conv.name}</Text>
        <Pressable onPress={() => onPin(conv)} style={styles.sheetItem}>
          <Ionicons name={conv.isPinned ? "pin" : "pin-outline"} size={18} color="#fff" />
          <Text style={styles.sheetItemText}>{conv.isPinned ? "Unpin" : "Pin"}</Text>
        </Pressable>
        <Pressable onPress={() => onMute(conv)} style={styles.sheetItem}>
          <Ionicons
            name={conv.isMuted ? "notifications" : "notifications-off-outline"}
            size={18}
            color="#fff"
          />
          <Text style={styles.sheetItemText}>{conv.isMuted ? "Unmute" : "Mute"}</Text>
        </Pressable>
        <Pressable onPress={() => onDelete(conv)} style={styles.sheetItem}>
          <Ionicons name="trash-outline" size={18} color="#ef4444" />
          <Text style={[styles.sheetItemText, { color: "#ef4444" }]}>Delete</Text>
        </Pressable>
        <Pressable onPress={onClose} style={[styles.sheetItem, { justifyContent: "center" }]}>
          <Text style={[styles.sheetItemText, { color: MUTED }]}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}


function EmptyInboxState({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={{ fontSize: 44, marginBottom: 4 }}>💬</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function GlobalEmptyState() {
  return (
    <View style={[styles.empty, { paddingTop: 80 }]}>
      <View style={styles.emptyGlowWrap}>
        <LinearGradient
          colors={["rgba(255,45,168,0.30)", "rgba(161,0,255,0.10)"]}
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
        <LinearGradient colors={[PINK, PURPLE]} style={styles.emptyBtn}>
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
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  headerTitle: { color: TEXT, fontSize: 26, fontFamily: "Sora_800ExtraBold", letterSpacing: -0.5 },
  headerSub: { color: MUTED, fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  headerBtns: { flexDirection: "row", gap: 6 },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
  },


  searchWrap: { paddingHorizontal: 16, paddingBottom: 6 },
  searchPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
    borderRadius: 999,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    paddingVertical: 0,
  },


  storyWrap: { paddingTop: 6, paddingBottom: 6 },
  storyRow: { paddingHorizontal: 12, gap: 14, alignItems: "center" },
  storyItem: { alignItems: "center", width: 72, gap: 6 },
  storyBubbleWrap: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  storyGlow: {
    position: "absolute",
    width: 76,
    height: 76,
    borderRadius: 38,
    overflow: "hidden",
  },
  storyRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  storyInner: {
    width: "100%",
    height: "100%",
    borderRadius: 30,
    backgroundColor: BG,
    padding: 1.5,
    overflow: "hidden",
  },
  storyPhoto: { width: "100%", height: "100%", borderRadius: 28 },
  storyEmojiWrap: { backgroundColor: "#1a1a1a", alignItems: "center", justifyContent: "center" },
  storyEmojiText: { fontSize: 24 },
  storyOnlineDot: {
    position: "absolute",
    bottom: 0,
    right: 4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#22c55e",
    borderWidth: 2,
    borderColor: BG,
  },
  storyLabel: { color: "#e5e5e5", fontSize: 11, fontFamily: "Inter_500Medium", textAlign: "center" },
  storyDivider: { width: 1, height: 50, backgroundColor: BORDER, marginHorizontal: 4 },

  activePlansWrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  activePlansHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sectionEyebrow: { color: PINK, fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1.5, textTransform: "uppercase" },
  activePlansTitle: { color: TEXT, fontSize: 16, fontFamily: "Inter_700Bold", marginTop: 2 },
  activePlansList: { gap: 10, paddingRight: 16 },
  activePlanCard: {
    width: 172,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,45,168,0.24)",
    backgroundColor: "rgba(255,255,255,0.055)",
    padding: 12,
  },
  activePlanIcon: { width: 34, height: 34, borderRadius: 13, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  activePlanName: { color: PINK, fontSize: 11, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 1 },
  activePlanTitle: { color: TEXT, fontSize: 15, fontFamily: "Inter_700Bold", marginTop: 4 },
  activePlanMeta: { color: MUTED, fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 4 },


  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
    marginTop: 4,
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 12,
    gap: 6,
  },
  tabLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  tabLabel: { color: MUTED, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  tabLabelActive: { color: TEXT, fontFamily: "Inter_700Bold" },
  tabBadge: {
    minWidth: 20,
    height: 18,
    paddingHorizontal: 6,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  tabBadgeActive: { backgroundColor: PINK },
  tabBadgeText: { color: MUTED, fontSize: 10, fontFamily: "Inter_700Bold" },
  tabBadgeTextActive: { color: "#fff" },
  tabUnderline: {
    position: "absolute",
    bottom: -StyleSheet.hairlineWidth,
    left: 24,
    right: 24,
    height: 2,
    backgroundColor: TEXT,
    borderRadius: 1,
  },


  dmRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  dmAvatarWrap: { position: "relative" },
  dmAvatar: { width: 54, height: 54, borderRadius: 27 },
  dmOnlineDot: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#22c55e",
    borderWidth: 2,
    borderColor: BG,
  },
  matchRing: { width: 58, height: 58, borderRadius: 29, padding: 2 },
  matchRingInner: { width: "100%", height: "100%", borderRadius: 27, backgroundColor: BG, padding: 1 },
  dmTopRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dmBottomRow: { flexDirection: "row", alignItems: "center" },
  dmName: { color: "#e5e5e5", fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },
  dmNameUnread: { color: TEXT, fontFamily: "Inter_700Bold" },
  dmTime: { color: FAINT, fontSize: 11, fontFamily: "Inter_500Medium" },
  dmPreview: { color: MUTED, fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  dmPreviewUnread: { color: TEXT, fontFamily: "Inter_500Medium" },
  dmIntentRow: { flexDirection: "row", gap: 6, marginTop: 4 },
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
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadPillText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },


  reqActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  reqAcceptBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 999 },
  reqAcceptText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  reqPassBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: BORDER,
  },
  reqPassText: { color: MUTED, fontSize: 12, fontFamily: "Inter_700Bold" },


  newBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: PINK + "22",
    borderWidth: 1,
    borderColor: PINK + "55",
  },
  newBadgeText: { color: PINK, fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.6 },
  messageBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  messageBtnText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },


  quickWrap: { paddingTop: 18, paddingBottom: 8, gap: 10 },
  quickHead: {
    color: TEXT,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    paddingHorizontal: 16,
  },
  quickCard: {
    width: 170,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    gap: 4,
  },
  quickTitle: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold", marginTop: 4 },
  quickSub: { color: "rgba(255,255,255,0.85)", fontSize: 11, fontFamily: "Inter_400Regular" },


  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 24,
    backgroundColor: CARD,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 8,
  },
  sheetTitle: {
    color: MUTED,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  sheetItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  sheetItemText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },


  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingTop: 50,
    paddingBottom: 30,
    gap: 10,
  },
  emptyGlowWrap: {
    width: 130,
    height: 130,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  emptyGlow: { position: "absolute", width: 130, height: 130, borderRadius: 65 },
  emptyTitle: { color: TEXT, fontSize: 18, fontFamily: "Inter_700Bold", textAlign: "center" },
  emptyText: {
    color: MUTED,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 19,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    marginTop: 8,
  },
  emptyBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
});
