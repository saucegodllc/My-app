import { useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useSessionState } from "@/hooks/useSessionState";
import CreateFriendPlanSheet from "@/components/CreateFriendPlanSheet";
import { useFeedback } from "@/components/ActionFeedback";
import { eventContextIdsChanged, getEventsForScreen } from "@/lib/eventsScreenState";
import { openChat as openChatRoute } from "@/lib/routes";
import { requestJoinFriendPlan, type PlanLocationOption } from "@/services/friendsApi";
import { getEventContexts, toggleEventInterest, type EventContext } from "@/services/eventsApi";
import { useGetEvents } from "@workspace/api-client-react";
import type { EventsResponse } from "@workspace/api-client-react";

const PINK = "#FF299B";
const POLL_INTERVAL = 60 * 1000;
const { height: SCREEN_HEIGHT } = Dimensions.get("window");

type Event = EventsResponse["events"][number];
type EventsPayload = EventsResponse & {
  stale?: boolean;
  refreshedAt?: string;
  cacheTtlMs?: number;
};
type Timeframe = "all" | "week" | "weekend";
type Category = "All" | "Nightlife" | "Arts" | "Sports" | "Food" | "Music" | "Business" | "Community" | "Other";
type AreaFilter = "All" | "Near Me" | "Miami" | "Broward";
type EventQuickFilter = "All" | "Near Me" | "Miami" | "Broward" | "This Week" | "Sports" | "Nightlife" | "Arts" | "Community";

const EVENT_FILTERS: Array<{ value: EventQuickFilter; icon: keyof typeof Ionicons.glyphMap }> = [
  { value: "All", icon: "apps-outline" },
  { value: "Near Me", icon: "navigate-outline" },
  { value: "Miami", icon: "location-outline" },
  { value: "Broward", icon: "map-outline" },
  { value: "This Week", icon: "calendar-outline" },
  { value: "Sports", icon: "football-outline" },
  { value: "Nightlife", icon: "moon-outline" },
  { value: "Arts", icon: "color-palette-outline" },
  { value: "Community", icon: "people-outline" },
];

const CATEGORY_ICONS: Record<Category, keyof typeof Ionicons.glyphMap> = {
  All: "apps-outline",
  Nightlife: "moon-outline",
  Arts: "color-palette-outline",
  Sports: "football-outline",
  Food: "restaurant-outline",
  Music: "musical-notes-outline",
  Business: "briefcase-outline",
  Community: "people-outline",
  Other: "sparkles-outline",
};

const CATEGORY_COLORS: Record<Category, string> = {
  All: PINK,
  Nightlife: "#7B2FBE",
  Arts: "#E85D04",
  Sports: "#2196F3",
  Food: "#FF6B35",
  Music: "#1DB954",
  Business: "#9B5CFF",
  Community: "#00C2A8",
  Other: "#8E8E93",
};

// ── No local seed events ─────────────────────────────────────────────────────
// Events tab uses live Ticketmaster data only (EVENTS_USE_MOCKS=false in production).
// On cold start the server signals stale=true; the client shows "Loading live events...".
// Local seed arrays have been removed. Do not re-add them.


function filterSettings(filter: EventQuickFilter): { timeframe: Timeframe; category: Category; freeOnly: boolean; area: AreaFilter } {
  if (filter === "Near Me") return { timeframe: "week", category: "All", freeOnly: false, area: "Near Me" };
  if (filter === "Miami") return { timeframe: "week", category: "All", freeOnly: false, area: "Miami" };
  if (filter === "Broward") return { timeframe: "week", category: "All", freeOnly: false, area: "Broward" };
  if (filter === "This Week") return { timeframe: "week", category: "All", freeOnly: false, area: "All" };
  if (filter === "Sports" || filter === "Nightlife" || filter === "Arts" || filter === "Community") {
    return { timeframe: filter === "Sports" ? "all" : "week", category: filter, freeOnly: false, area: "All" };
  }
  return { timeframe: "all", category: "All", freeOnly: false, area: "All" };
}

function ticketUrlForEvent(event: Event) {
  const directUrl = String((event as any).url ?? "").trim();
  if (/^https?:\/\//i.test(directUrl)) return directUrl;
  const query = encodeURIComponent(`${event.name} ${event.venueName ?? ""} tickets`);
  return `https://www.google.com/search?q=${query}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function formatShortDate(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function getEventSourceLabel(event: Event): string {
  return String((event as any).sourceLabel ?? "Live");
}

function eventSourceId(event: Event): string {
  return String((event as any).sourceId ?? event.id);
}

function eventSourceType(event: Event): "ticketmaster" | "eventbrite" | "posh" | "mlb" | "mock" {
  const source = String((event as any).source ?? "ticketmaster");
  return ["ticketmaster", "eventbrite", "posh", "mlb", "mock"].includes(source) ? source as any : "ticketmaster";
}

function eventTimingLabel(event: Event): string {
  const start = new Date(event.startDate).getTime();
  if (!Number.isFinite(start)) return "";
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const today = new Date();
  const eventDay = new Date(start);
  const sameDate = today.toDateString() === eventDay.toDateString();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (start <= now) return "Live now";
  if (sameDate) return "Tonight";
  if (tomorrow.toDateString() === eventDay.toDateString()) return "Tomorrow";
  if (start - now <= 3 * day) return "Soon";
  return "";
}

function socialLine(context?: EventContext) {
  if (!context) return "";
  if (context.planCount > 0 && context.interestedCount > 0) {
    return `${context.planCount} plan${context.planCount === 1 ? "" : "s"} forming · ${context.interestedCount} interested`;
  }
  if (context.planCount > 0) return `${context.planCount} plan${context.planCount === 1 ? "" : "s"} forming`;
  if (context.friendInterestedUsers.length > 0) return `${context.friendInterestedUsers[0]?.name ?? "A friend"} is interested`;
  if (context.interestedCount > 0) return `${context.interestedCount} interested`;
  return "";
}

// ── Who's Going avatar strip ──────────────────────────────────────────────────
// Shows up to 4 photo bubbles of friends/matches going to this event.
function WhoGoingAvatars({ users, totalCount }: { users: { name: string; photoUrl?: string }[]; totalCount: number }) {
  const MAX_SHOWN = 4;
  const shown = users.slice(0, MAX_SHOWN);
  const overflow = totalCount - shown.length;

  if (shown.length === 0 && totalCount === 0) return null;

  return (
    <View style={whoGoingStyles.row}>
      <View style={whoGoingStyles.bubbles}>
        {shown.map((u, i) => (
          <View
            key={u.name + i}
            style={[whoGoingStyles.bubble, { marginLeft: i === 0 ? 0 : -10, zIndex: MAX_SHOWN - i }]}
          >
            {u.photoUrl ? (
              <Image source={{ uri: u.photoUrl }} style={whoGoingStyles.bubbleImg} contentFit="cover" />
            ) : (
              <View style={[whoGoingStyles.bubbleImg, whoGoingStyles.bubbleFallback]}>
                <Text style={whoGoingStyles.bubbleInitial}>{u.name[0]?.toUpperCase() ?? "?"}</Text>
              </View>
            )}
          </View>
        ))}
        {overflow > 0 && (
          <View style={[whoGoingStyles.bubble, whoGoingStyles.overflowBubble, { marginLeft: -10 }]}>
            <Text style={whoGoingStyles.overflowText}>+{overflow}</Text>
          </View>
        )}
      </View>
      <Text style={whoGoingStyles.label}>
        {shown.length === 1
          ? `${shown[0]!.name} is going`
          : totalCount === 1
          ? `${shown[0]!.name} is going`
          : `${totalCount} going`}
      </Text>
    </View>
  );
}

const whoGoingStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6, marginBottom: 2 },
  bubbles: { flexDirection: "row", alignItems: "center" },
  bubble: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: "#0a0a0a", overflow: "hidden" },
  bubbleImg: { width: 26, height: 26, borderRadius: 13 },
  bubbleFallback: { backgroundColor: "#FF299B33", alignItems: "center", justifyContent: "center" },
  bubbleInitial: { fontSize: 11, fontFamily: "Inter_700Bold", color: PINK },
  overflowBubble: { backgroundColor: "#222", alignItems: "center", justifyContent: "center" },
  overflowText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#aaa" },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#ccc", flex: 1 },
});

function getProviderEmptyMessage(data: EventsResponse | undefined): string | null {
  const providers = ((data as any)?.providers ?? []) as Array<{
    label?: string;
    status?: string;
    configured?: boolean;
    message?: string;
  }>;

  const ticketmaster = providers.find((provider) => provider.label === "Ticketmaster");
  // In production, never expose provider configuration details to users — show generic copy only
  if (ticketmaster?.configured === false || (ticketmaster?.message && ticketmaster.status === "error")) {
    return null; // Fall through to the normal empty state; no user-visible config errors
  }

  return null;
}

function getProvider(data: EventsResponse | undefined, label: string) {
  const providers = ((data as any)?.providers ?? []) as Array<{
    label?: string;
    status?: string;
    configured?: boolean;
    count?: number;
    message?: string;
  }>;
  return providers.find((provider) => provider.label === label);
}

function MapThumbnail({ latitude, longitude }: { latitude: number; longitude: number }) {
  const [errored, setErrored] = useState(false);
  const zoom = 15;
  const tileUrl = `https://static-maps.yandex.ru/1.x/?ll=${longitude},${latitude}&z=${zoom}&size=450,120&l=map&pt=${longitude},${latitude},pm2rdm`;

  if (errored) {
    return (
      <View style={[styles.mapImage, { backgroundColor: "#1a1a2e", alignItems: "center", justifyContent: "center" }]}>
        <Ionicons name="map-outline" size={32} color="#444" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: tileUrl }}
      style={styles.mapImage}
      contentFit="cover"
      onError={() => setErrored(true)}
    />
  );
}

function EventCard({
  event,
  context,
  onPress,
  onCreatePlan,
}: {
  event: Event;
  context?: EventContext;
  onPress: () => void;
  onCreatePlan?: (event: Event) => void;
}) {
  const categoryColor = CATEGORY_COLORS[event.category as Category] ?? PINK;
  const sourceLabel = getEventSourceLabel(event);
  const timing = eventTimingLabel(event);
  const social = socialLine(context);

  return (
    <Pressable style={styles.card} onPress={onPress} android_ripple={{ color: "#333" }}>
      <View style={styles.cardImageContainer}>
        {event.imageUrl ? (
          <Image
            source={{ uri: event.imageUrl }}
            style={styles.cardImage}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <LinearGradient
            colors={["#1a1a1a", "#2a2a2a"]}
            style={styles.cardImagePlaceholder}
          >
            <Ionicons name="calendar" size={40} color="#444" />
          </LinearGradient>
        )}
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.82)"]}
          style={styles.cardImageOverlay}
        />
        <View style={[styles.categoryBadge, { backgroundColor: categoryColor }]}>
          <Text style={styles.categoryBadgeText}>{event.category}</Text>
        </View>
        <View style={[styles.priceBadge, event.isFree ? styles.priceFree : styles.pricePaid]}>
          <Text style={styles.priceBadgeText}>{event.price}</Text>
        </View>
        <View style={styles.sourceBadge}>
          <View style={styles.sourceDot} />
          <Text style={styles.sourceBadgeText}>{sourceLabel}</Text>
        </View>
        <View style={styles.dateBadge}>
          <Text style={styles.dateBadgeText}>{formatShortDate(event.startDate)}</Text>
        </View>
        {timing ? (
          <View style={styles.timingBadge}>
            <Text style={styles.timingBadgeText}>{timing}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {event.name}
        </Text>
        {/* Who's going — avatar bubbles when friends/matches are attending */}
        {context && (context.friendInterestedUsers.length > 0 || context.interestedCount > 0) ? (
          <WhoGoingAvatars
            users={context.friendInterestedUsers}
            totalCount={context.interestedCount}
          />
        ) : social ? (
          <View style={styles.eventSocialStrip}>
            <Ionicons name="people" size={13} color={PINK} />
            <Text style={styles.eventSocialText} numberOfLines={1}>{social}</Text>
          </View>
        ) : null}
        <View style={styles.cardMeta}>
          <Ionicons name="calendar-outline" size={13} color="#999" />
          <Text style={styles.cardMetaText}>{formatDate(event.startDate)}</Text>
        </View>
        {(event.venueName || event.neighborhood) ? (
          <View style={styles.cardMeta}>
            <Ionicons name="location-outline" size={13} color="#999" />
            <Text style={styles.cardMetaText} numberOfLines={1}>
              {event.venueName ? event.venueName : ""}
              {event.neighborhood ? ` · ${event.neighborhood}` : ""}
            </Text>
          </View>
        ) : null}
        <View style={styles.cardFooterRow}>
          <Pressable
            onPress={(e) => { e?.stopPropagation?.(); onCreatePlan ? onCreatePlan(event) : onPress(); }}
            style={styles.cardPlanPill}
            hitSlop={6}
          >
            <Ionicons name="add-circle" size={13} color={PINK} />
            <Text style={styles.cardPlanPillText}>Start a Plan</Text>
          </Pressable>
          <Pressable onPress={onPress} style={styles.cardDetailLink} hitSlop={6}>
            <Text style={styles.cardDetailLinkText}>Details</Text>
            <Ionicons name="chevron-forward" size={12} color="#666" />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

function EventInviteActions({
  event,
  context,
  onToggleInterest,
  onShare,
}: {
  event: Event;
  context?: EventContext;
  onToggleInterest: (event: Event) => void;
  onShare: (event: Event) => void;
}) {
  const interested = context?.myInterestStatus === "interested" || context?.myInterestStatus === "saved";
  return (
    <View style={styles.quickActions}>
      <Pressable onPress={() => onToggleInterest(event)} style={[styles.quickAction, interested && styles.quickActionActive]}>
        <Ionicons name={interested ? "heart" : "heart-outline"} size={17} color={interested ? "#FFFFFF" : PINK} />
        <Text style={[styles.quickActionText, interested && styles.quickActionTextActive]}>
          {interested ? "Interested" : "I'm Interested"}
        </Text>
      </Pressable>
      <Pressable onPress={() => onShare(event)} style={styles.quickAction}>
        <Ionicons name="share-social-outline" size={17} color={PINK} />
        <Text style={styles.quickActionText}>Invite</Text>
      </Pressable>
    </View>
  );
}

function EventPlansSection({
  context,
  onRequestJoin,
  onOpenChat,
}: {
  context?: EventContext;
  onRequestJoin: (planId: string) => void;
  onOpenChat: (chatId: string) => void;
}) {
  const myPlan = context?.myPlan;
  const plans = context?.joinablePlans ?? [];
  if (!myPlan && plans.length === 0) {
    return (
      <View style={styles.eventPlansBox}>
        <Text style={styles.sheetDescriptionLabel}>Plans for this event</Text>
        <Text style={styles.eventPlansEmpty}>No plans yet. Start one and invite your people.</Text>
      </View>
    );
  }
  return (
    <View style={styles.eventPlansBox}>
      <Text style={styles.sheetDescriptionLabel}>Plans for this event</Text>
      {myPlan ? (
        <Pressable
          onPress={() => myPlan.chatId && onOpenChat(myPlan.chatId)}
          style={styles.eventPlanCard}
          disabled={!myPlan.chatId}
        >
          <View style={styles.eventPlanIcon}>
            <Ionicons name="chatbubbles" size={17} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.eventPlanTitle} numberOfLines={1}>{myPlan.title}</Text>
            <Text style={styles.eventPlanMeta} numberOfLines={1}>
              Your plan · {myPlan.peopleGoing ?? 1} going
            </Text>
          </View>
          <Text style={styles.eventPlanAction}>Open</Text>
        </Pressable>
      ) : null}
      {plans.map((plan) => {
        const pending = plan.joinRequestStatus === "pending";
        return (
          <View key={plan.id} style={styles.eventPlanCard}>
            <View style={styles.eventPlanIcon}>
              <Ionicons name="people" size={17} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.eventPlanTitle} numberOfLines={1}>{plan.title}</Text>
              <Text style={styles.eventPlanMeta} numberOfLines={1}>
                {plan.timeLabel ?? plan.time ?? "Soon"} · {plan.peopleGoing ?? 1} going
              </Text>
              <Text style={styles.eventPlanMeta} numberOfLines={1}>Hosted by {plan.creator?.name ?? "Someone"}</Text>
            </View>
            <Pressable onPress={() => onRequestJoin(plan.id)} disabled={pending} style={[styles.eventPlanJoin, pending && styles.eventPlanJoinDisabled]}>
              <Text style={styles.eventPlanJoinText}>{pending ? "Requested" : "Join"}</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

function EventDetailSheet({
  event,
  visible,
  context,
  onClose,
  onCreatePlan,
  onToggleInterest,
  onShare,
  onRequestJoinPlan,
  onOpenChat,
}: {
  event: Event | null;
  visible: boolean;
  context?: EventContext;
  onClose: () => void;
  onCreatePlan: (event: Event) => void;
  onToggleInterest: (event: Event) => void;
  onShare: (event: Event) => void;
  onRequestJoinPlan: (planId: string) => void;
  onOpenChat: (chatId: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const contentRef = useRef<ScrollView>(null);

  const closeWithSlide = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 180,
      useNativeDriver: true,
    }).start(() => onClose());
  }, [onClose, slideAnim]);

  const handlePanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_, gesture) => {
          if (gesture.dy > 0) {
            slideAnim.setValue(gesture.dy);
          }
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 76 || gesture.vy > 0.75) {
            closeWithSlide();
            return;
          }
          Animated.spring(slideAnim, {
            toValue: 0,
            damping: 18,
            stiffness: 180,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(slideAnim, {
            toValue: 0,
            damping: 18,
            stiffness: 180,
            useNativeDriver: true,
          }).start();
        },
      }),
    [closeWithSlide, slideAnim]
  );

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(SCREEN_HEIGHT);
      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 18,
        stiffness: 180,
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(SCREEN_HEIGHT);
    }
  }, [visible, slideAnim]);

  if (!event) return null;

  const categoryColor = CATEGORY_COLORS[event.category as Category] ?? PINK;
  const sourceLabel = getEventSourceLabel(event);
  const hasJoinablePlans = (context?.joinablePlans?.length ?? 0) > 0;
  const primaryLabel = context?.myPlan?.chatId ? "Open Plan Chat" : hasJoinablePlans ? "View Plans" : "Start a Plan";
  const primaryIcon: keyof typeof Ionicons.glyphMap = context?.myPlan?.chatId ? "chatbubbles" : hasJoinablePlans ? "people" : "add-circle";

  const handleGetTickets = () => {
    const url = ticketUrlForEvent(event);
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    Linking.openURL(url).catch(() => {});
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.sheetOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + 24, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <Animated.View style={styles.sheetHandleArea} {...handlePanResponder.panHandlers}>
            <View style={styles.sheetHandle} />
          </Animated.View>

          {event.imageUrl ? (
            <Image
              source={{ uri: event.imageUrl }}
              style={styles.sheetImage}
              contentFit="cover"
            />
          ) : (
            <LinearGradient
              colors={["#1a1a1a", "#2d2d2d"]}
              style={styles.sheetImagePlaceholder}
            >
              <Ionicons name="calendar" size={60} color="#555" />
            </LinearGradient>
          )}

          <ScrollView
            ref={contentRef}
            style={styles.sheetContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.sheetHeader}>
              <View style={[styles.sheetPill, { backgroundColor: categoryColor }]}>
                <Text style={styles.categoryBadgeText}>{event.category}</Text>
              </View>
              <View style={styles.sheetSourceBadge}>
                <View style={styles.sourceDot} />
                <Text style={styles.sourceBadgeText}>{sourceLabel}</Text>
              </View>
              <View style={[styles.sheetPill, event.isFree ? styles.priceFree : styles.pricePaid]}>
                <Text style={styles.priceBadgeText}>{event.price}</Text>
              </View>
            </View>

            <Text style={styles.sheetTitle}>{event.name}</Text>
            <EventInviteActions event={event} context={context} onToggleInterest={onToggleInterest} onShare={onShare} />

            <View style={styles.sheetMetaRow}>
              <Ionicons name="calendar" size={16} color={PINK} />
              <Text style={styles.sheetMetaText}>{formatDate(event.startDate)}</Text>
            </View>

            {(event.venueName || event.neighborhood) ? (
              <View style={styles.sheetMetaRow}>
                <Ionicons name="location" size={16} color={PINK} />
                <Text style={styles.sheetMetaText}>
                  {event.venueName}
                  {event.neighborhood ? `\n${event.neighborhood}` : ""}
                  {event.venueAddress && (!event.venueName || !event.venueAddress.startsWith(event.venueName))
                    ? `\n${event.venueAddress}`
                    : ""}
                </Text>
              </View>
            ) : null}

            {event.latitude && event.longitude ? (
              <Pressable
                style={styles.mapThumbnail}
                onPress={() => {
                  const label = encodeURIComponent(event.venueName || event.neighborhood || "Venue");
                  const mapsUrl = Platform.OS === "ios"
                    ? `maps://?q=${label}&ll=${event.latitude},${event.longitude}`
                    : `geo:${event.latitude},${event.longitude}?q=${label}`;
                  Linking.openURL(mapsUrl).catch(() => {
                    Linking.openURL(
                      `https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`
                    );
                  });
                }}
              >
                <MapThumbnail latitude={event.latitude} longitude={event.longitude} />
                <View style={styles.mapOverlay}>
                  <View style={styles.mapPin}>
                    <Ionicons name="location" size={16} color="#fff" />
                  </View>
                  <Text style={styles.mapLabel}>
                    {event.neighborhood || event.venueName || "View on Map"}
                  </Text>
                  <Ionicons name="open-outline" size={14} color="rgba(255,255,255,0.7)" />
                </View>
              </Pressable>
            ) : null}

            {event.description ? (
              <View style={styles.sheetDescriptionContainer}>
                <Text style={styles.sheetDescriptionLabel}>About this event</Text>
                <Text style={styles.sheetDescription}>{event.description}</Text>
              </View>
            ) : null}
            <EventPlansSection context={context} onRequestJoin={onRequestJoinPlan} onOpenChat={onOpenChat} />
          </ScrollView>

          <TouchableOpacity
            style={styles.planButton}
            onPress={() => {
              if (context?.myPlan?.chatId) {
                onOpenChat(context.myPlan.chatId);
                return;
              }
              if (hasJoinablePlans) {
                contentRef.current?.scrollToEnd({ animated: true });
                return;
              }
              onCreatePlan(event);
            }}
            activeOpacity={0.85}
          >
            <Ionicons name={primaryIcon} size={18} color="#FFFFFF" />
            <Text style={styles.planButtonText}>{primaryLabel}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.ticketButton}
            onPress={handleGetTickets}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[PINK, "#c4007a"]}
              style={styles.ticketButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="ticket-outline" size={18} color="#fff" />
              <Text style={styles.ticketButtonText}>Get Tickets</Text>
              <Ionicons name="open-outline" size={16} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

export default function EventsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { userId } = useSessionState();
  const topInset = Platform.OS === "web" ? 67 : insets.top;

  const [activeFilter, setActiveFilter] = useState<EventQuickFilter>("This Week");
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [planSource, setPlanSource] = useState<PlanLocationOption | null>(null);
  const [eventContexts, setEventContexts] = useState<Record<string, EventContext>>({});
  const currentUserId = userId ?? user?.id ?? "";

  const { trigger: triggerInterest } = useFeedback("interest");

  const { timeframe, category, freeOnly, area } = filterSettings(activeFilter);

  const queryParams = useMemo(() => ({
    page: 1,
    ...(timeframe !== "all" ? { timeframe: timeframe as "week" | "weekend" } : {}),
    ...(category !== "All" ? { category } : {}),
    ...(freeOnly ? { freeOnly: true } : {}),
    ...(area !== "All" ? { area } : {}),
    ...(currentUserId ? { userId: currentUserId } : {}),
  }) as any, [area, category, currentUserId, freeOnly, timeframe]);

  const { data, isLoading, isError, refetch, isRefetching } = useGetEvents(queryParams, {
    query: {
      staleTime: POLL_INTERVAL,
      refetchInterval: POLL_INTERVAL,
      retry: 2,
      retryDelay: 2000,
    } as any,
  });

  useFocusEffect(
    useCallback(() => {
      refetch();
      const interval = setInterval(() => {
        refetch();
      }, POLL_INTERVAL);
      return () => clearInterval(interval);
    }, [refetch])
  );

  const eventsData = data as EventsPayload | undefined;
  const apiEvents = getEventsForScreen(eventsData) as Event[];
  // Always live Ticketmaster data — no client-side mock fallback
  const events = apiEvents;
  const usingLocalEvents = false; // local seeds removed; empty state handles no-data case

  // `isConfigured` — show the feed as long as we have ANY events to display or the server
  // says TM is configured. Only show the "not set up" placeholder when there's truly nothing.
  const isConfigured = events.length > 0 || eventsData?.configured !== false;

  // Server-side stale flag: true while first TM refresh is still running after cold boot
  const isServerStale = eventsData?.stale === true;

  // Server-side loading flag: true only on the very first cold-start before any events
  // have been fetched (distinct from stale, which means we have data but it may be old).
  const isServerLoading = (eventsData as any)?.loading === true;

  const providerEmptyMessage = getProviderEmptyMessage(eventsData);
  const ticketmasterProvider = getProvider(eventsData, "Ticketmaster");
  const marlinsProvider = getProvider(eventsData, "Marlins Games");

  // Build a human-readable "last refreshed" label
  const refreshedAt = eventsData?.refreshedAt;
  const refreshedLabel = useMemo(() => {
    if (!refreshedAt) return null;
    const ms = Date.now() - new Date(refreshedAt).getTime();
    if (ms < 60_000) return "just now";
    if (ms < 3600_000) return `${Math.floor(ms / 60_000)}m ago`;
    if (ms < 86400_000) return `${Math.floor(ms / 3600_000)}h ago`;
    return `${Math.floor(ms / 86400_000)}d ago`;
  }, [refreshedAt]);

  const tmCount = ticketmasterProvider?.count ?? 0;
  const marlinsCount = marlinsProvider?.count ?? 0;
  const feedSourceTitle = isError
    ? "Reconnecting…"
    : (isServerLoading || isServerStale)
      ? "Loading live events..."
      : tmCount > 0
        ? `${tmCount} Ticketmaster events`
        : "Live events";
  const feedSourceDetail = isError
    ? "Couldn't reach the server — tap retry to reload live Miami & Broward events."
    : (isServerLoading || isServerStale)
      ? "Fetching Ticketmaster events — live Miami & Broward events will appear shortly."
      : `${tmCount} Ticketmaster · ${marlinsCount} Marlins games · Miami & Broward${refreshedLabel ? ` · refreshed ${refreshedLabel}` : ""}`;
  const eventSourceIds = useMemo(() => events.map(eventSourceId), [events]);
  const loadedEventContextUserRef = useRef("");
  const loadedEventSourceIdsRef = useRef<string[]>([]);

  const loadEventContexts = useCallback(async () => {
    if (
      loadedEventContextUserRef.current === currentUserId &&
      !eventContextIdsChanged(loadedEventSourceIdsRef.current, eventSourceIds)
    ) {
      return;
    }
    loadedEventContextUserRef.current = currentUserId;
    loadedEventSourceIdsRef.current = eventSourceIds;
    if (!currentUserId || !eventSourceIds.length) {
      setEventContexts({});
      return;
    }
    try {
      const result = await getEventContexts(currentUserId, eventSourceIds);
      setEventContexts(result.bySourceId ?? {});
    } catch {
      setEventContexts({});
    }
  }, [currentUserId, eventSourceIds]);

  useEffect(() => {
    loadEventContexts();
  }, [loadEventContexts]);

  const openDetail = (event: Event) => {
    setSelectedEvent(event);
    setDetailVisible(true);
  };

  const closeDetail = () => {
    setDetailVisible(false);
  };

  const openPlanFromEvent = (event: Event) => {
    setPlanSource({
      id: eventSourceId(event),
      sourceType: "event",
      name: event.name,
      subtitle: event.venueName || event.neighborhood || "Miami",
      imageUrl: event.imageUrl,
      latitude: typeof (event as any).latitude === "number" ? (event as any).latitude : undefined,
      longitude: typeof (event as any).longitude === "number" ? (event as any).longitude : undefined,
      startDate: event.startDate,
    });
    setDetailVisible(false);
  };

  const openChat = useCallback((chatId: string) => {
    setDetailVisible(false);
    openChatRoute(chatId);
  }, []);

  const shareEvent = useCallback(async (event: Event) => {
    const venue = event.venueName || event.neighborhood || "Miami";
    const message = `${event.name}\n${formatDate(event.startDate)}\n${venue}${event.url ? `\n${event.url}` : ""}`;
    await Share.share({ message });
  }, []);

  const handleToggleInterest = useCallback(async (event: Event) => {
    const sourceId = eventSourceId(event);
    const wasInterested = !!eventContexts[sourceId]?.myInterestStatus;
    if (!wasInterested) triggerInterest(); // burst only when marking interested
    setEventContexts((current) => ({
      ...current,
      [sourceId]: {
        sourceId,
        interestedCount: Math.max(0, (current[sourceId]?.interestedCount ?? 0) + (current[sourceId]?.myInterestStatus ? -1 : 1)),
        friendInterestedUsers: current[sourceId]?.friendInterestedUsers ?? [],
        planCount: current[sourceId]?.planCount ?? 0,
        myPlan: current[sourceId]?.myPlan ?? null,
        joinablePlans: current[sourceId]?.joinablePlans ?? [],
        myInterestStatus: current[sourceId]?.myInterestStatus ? null : "interested",
      },
    }));
    try {
      if (!currentUserId) return;
      await toggleEventInterest({
        userId: currentUserId,
        sourceId,
        sourceType: eventSourceType(event),
        eventName: event.name,
        eventStartDate: event.startDate,
        status: "interested",
      });
      loadEventContexts();
    } catch {
      loadEventContexts();
    }
  }, [currentUserId, eventContexts, loadEventContexts, triggerInterest]);

  const handleRequestJoinPlan = useCallback(async (planId: string) => {
    setEventContexts((current) => {
      const next = { ...current };
      Object.keys(next).forEach((sourceId) => {
        const context = next[sourceId];
        next[sourceId] = {
          ...context,
          joinablePlans: context.joinablePlans.map((plan) =>
            plan.id === planId ? { ...plan, joinRequestStatus: "pending" } : plan,
          ),
        };
      });
      return next;
    });
    try {
      if (!currentUserId) return;
      await requestJoinFriendPlan(currentUserId, planId);
      loadEventContexts();
    } catch {
      loadEventContexts();
    }
  }, [currentUserId, loadEventContexts]);

  const renderHeader = () => (
    <View style={[styles.filterContainer, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["rgba(255,41,155,0.22)", "rgba(255,255,255,0.045)", "rgba(0,0,0,0)"]}
        style={styles.livePanel}
      >
        <View style={styles.livePanelTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.liveKicker}>TONIGHT'S MOVES</Text>
            <Text style={styles.liveTitle}>Find the energy. Build the plan.</Text>
            <Text style={styles.liveSubcopy}>Concerts, games, pop-ups — tap any event to start a plan with your crew.</Text>

            {/* Source status pill + detail */}
            <View style={styles.feedStatusRow}>
              <View style={[
                styles.feedSourcePill,
                isError ? styles.feedSourcePillError : isServerStale ? styles.feedSourcePillStale : styles.feedSourcePillLive,
              ]}>
                {isRefetching || isServerStale || isError ? (
                  <ActivityIndicator size="small" color={isError ? "#FF6B6B" : isServerStale ? "#FFA940" : "#1DB954"} style={{ marginRight: 2 }} />
                ) : (
                  <View style={[
                    styles.feedSourceDot,
                    isServerStale ? styles.feedSourceDotStale : styles.feedSourceDotLive,
                  ]} />
                )}
                <Text style={styles.feedSourceText}>{feedSourceTitle}</Text>
              </View>
              {/* Manual refresh button */}
              {!isRefetching ? (
                <TouchableOpacity
                  onPress={() => refetch()}
                  style={styles.refreshBtn}
                  hitSlop={8}
                >
                  <Ionicons name="refresh" size={14} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              ) : null}
            </View>

            <Text style={styles.feedSourceDetail}>{feedSourceDetail}</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
      >
        {EVENT_FILTERS.map((filter) => {
          const isActive = activeFilter === filter.value;
          const color = filter.value === "All" || filter.value === "This Week" || filter.value === "Near Me" || filter.value === "Miami" || filter.value === "Broward"
            ? PINK
            : CATEGORY_COLORS[filter.value as Category] ?? PINK;
          return (
            <Pressable
              key={filter.value}
              testID={`event-filter-${filter.value.toLowerCase().replace(/\s+/g, "-")}`}
              style={[
                styles.chip,
                isActive && { backgroundColor: color, borderColor: color },
              ]}
              onPress={() => setActiveFilter(filter.value)}
            >
              <Ionicons
                name={filter.icon}
                size={13}
                color={isActive ? "#fff" : "#999"}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.chipText,
                isActive && styles.chipTextActive,
              ]}
              >
                {filter.value}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <Text style={styles.headerTitle}>Events</Text>
      </View>

      {!isConfigured ? (
        <View style={styles.placeholder}>
          <LinearGradient
            colors={["#1a1a1a", "#2a2a2a"]}
            style={styles.placeholderIcon}
          >
            <Ionicons name="calendar-outline" size={48} color="#555" />
          </LinearGradient>
          <Text style={styles.placeholderTitle}>Events loading</Text>
          <Text style={styles.placeholderText}>
            Connecting to Ticketmaster. Live Miami & Broward events will appear in a moment.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : isLoading ? (
        <>
          {renderHeader()}
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={PINK} />
            <Text style={styles.loadingText}>Loading events…</Text>
          </View>
        </>
      ) : (
        <>
          {renderHeader()}
          <FlatList
            data={events}
            keyExtractor={(item) => item.id}
            style={styles.eventsList}
            contentContainerStyle={[
              styles.listContent,
              events.length === 0 && styles.listContentEmpty,
            ]}
            renderItem={({ item }) => (
              <EventCard
                event={item}
                context={eventContexts[eventSourceId(item)]}
                onPress={() => openDetail(item)}
                onCreatePlan={openPlanFromEvent}
              />
            )}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                tintColor={PINK}
                colors={[PINK]}
              />
            }
            ListEmptyComponent={
              <View style={styles.centered}>
                <Ionicons
                  name={isError ? "wifi-outline" : providerEmptyMessage ? "key-outline" : "search-outline"}
                  size={48}
                  color="#444"
                />
                <Text style={styles.emptyTitle}>
                  {isError ? "Couldn't reach the server" : providerEmptyMessage ? "Events are warming up" : "No events found"}
                </Text>
                <Text style={styles.emptyText}>
                  {isError
                    ? "Check your connection or tap below — the server may be waking up."
                    : providerEmptyMessage
                      ? "Try refresh, widen your area, or create a plan with friends while local listings sync."
                      : "Try a different category, widen your area, or check back after the next refresh."}
                </Text>
                <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
                  <Text style={styles.retryButtonText}>{isError ? "Try Again" : "Refresh"}</Text>
                </TouchableOpacity>
              </View>
            }
            showsVerticalScrollIndicator={false}
          />
        </>
      )}

      <EventDetailSheet
        event={selectedEvent}
        visible={detailVisible}
        context={selectedEvent ? eventContexts[eventSourceId(selectedEvent)] : undefined}
        onClose={closeDetail}
        onCreatePlan={openPlanFromEvent}
        onToggleInterest={handleToggleInterest}
        onShare={shareEvent}
        onRequestJoinPlan={handleRequestJoinPlan}
        onOpenChat={openChat}
      />
      <CreateFriendPlanSheet
        visible={!!planSource}
        userId={currentUserId}
        initialSource={planSource}
        initialTitle={planSource ? `${planSource.name} plan` : undefined}
        onClose={() => setPlanSource(null)}
        onCreated={(result) => {
          setPlanSource(null);
          loadEventContexts();
          if (result.chat?.id) {
            openChat(result.chat.id);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 4,
    backgroundColor: "#000",
  },
  headerTitle: {
    fontSize: 30,
    fontFamily: "Sora_800ExtraBold",
    color: "#fff",
    letterSpacing: -0.5,
  },
  filterContainer: {
    paddingTop: 4,
    paddingBottom: 10,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#222",
  },
  livePanel: {
    marginHorizontal: 8,
    marginBottom: 4,
    minHeight: 136,
    paddingHorizontal: 20,
    paddingVertical: 22,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,41,155,0.26)",
    overflow: "hidden",
  },
  livePanelTop: {
    flex: 1,
    gap: 8,
    justifyContent: "space-between",
  },
  liveKicker: {
    color: PINK,
    fontSize: 11,
    fontFamily: "Inter_800ExtraBold",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  liveTitle: {
    color: "#fff",
    flexShrink: 1,
    fontSize: 24,
    fontFamily: "Sora_800ExtraBold",
    lineHeight: 30,
    marginTop: 3,
  },
  liveSubcopy: {
    color: "#B7B7C2",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    lineHeight: 18,
    marginTop: 4,
  },
  feedStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 8,
  },
  feedSourcePill: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  feedSourcePillLive: {
    backgroundColor: "rgba(29,185,84,0.12)",
    borderColor: "rgba(29,185,84,0.38)",
  },
  feedSourcePillBackup: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.18)",
  },
  feedSourcePillStale: {
    backgroundColor: "rgba(255,169,64,0.12)",
    borderColor: "rgba(255,169,64,0.38)",
  },
  feedSourcePillError: {
    backgroundColor: "rgba(255,107,107,0.12)",
    borderColor: "rgba(255,107,107,0.38)",
  },
  feedSourceDotError: {
    backgroundColor: "#FF6B6B",
  },
  feedSourceDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  feedSourceDotLive: {
    backgroundColor: "#1DB954",
  },
  feedSourceDotBackup: {
    backgroundColor: "#FFB4D9",
  },
  feedSourceDotStale: {
    backgroundColor: "#FFA940",
  },
  feedSourceText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0,
  },
  feedSourceDetail: {
    color: "#D7D7DF",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15,
    marginTop: 6,
  },
  refreshBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  areaChip: {
    alignItems: "center",
    backgroundColor: "#151518",
    borderColor: "#303036",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  areaChipActive: {
    backgroundColor: "rgba(255,41,155,0.22)",
    borderColor: PINK,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#333",
  },
  chipActive: {
    backgroundColor: PINK,
    borderColor: PINK,
  },
  chipText: {
    fontSize: 13,
    color: "#999",
    fontWeight: "500",
  },
  chipTextActive: {
    color: "#fff",
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#333",
  },
  eventsList: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 118,
    paddingTop: 2,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  card: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: "#0B0B0D",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,41,155,0.2)",
    shadowColor: PINK,
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  cardImageContainer: {
    position: "relative",
  },
  cardImage: {
    width: "100%",
    height: 180,
  },
  cardImagePlaceholder: {
    width: "100%",
    height: 180,
    alignItems: "center",
    justifyContent: "center",
  },
  cardImageOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  categoryBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  priceBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priceFree: {
    backgroundColor: "#1DB954",
  },
  pricePaid: {
    backgroundColor: "rgba(0,0,0,0.7)",
    borderWidth: 1,
    borderColor: "#444",
  },
  priceBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  sourceBadge: {
    position: "absolute",
    bottom: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.72)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.25)",
  },
  sourceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: PINK,
  },
  sourceBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },
  dateBadge: {
    position: "absolute",
    right: 10,
    bottom: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(255,41,155,0.92)",
  },
  dateBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "900",
  },
  timingBadge: {
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 12,
    left: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
    position: "absolute",
    top: 42,
  },
  timingBadgeText: {
    color: "#0B0B0D",
    fontSize: 11,
    fontWeight: "900",
  },
  cardBody: {
    padding: 14,
    gap: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: "Inter_800ExtraBold",
    color: "#fff",
    lineHeight: 22,
  },
  eventSocialStrip: {
    alignItems: "center",
    backgroundColor: "rgba(255,41,155,0.11)",
    borderColor: "rgba(255,41,155,0.24)",
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  eventSocialText: {
    color: "#FFB4D9",
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  cardMetaText: {
    fontSize: 12,
    color: "#999",
    flex: 1,
  },
  cardFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  cardPlanPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,41,155,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,41,155,0.28)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  cardPlanPillText: {
    color: PINK,
    fontSize: 12,
    fontWeight: "800",
  },
  cardDetailLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  cardDetailLinkText: {
    color: "#666",
    fontSize: 12,
    fontWeight: "600",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    paddingHorizontal: 32,
    gap: 12,
  },
  loadingText: {
    color: "#888",
    fontSize: 14,
    marginTop: 8,
  },
  errorText: {
    color: "#888",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: PINK,
    borderRadius: 20,
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  emptyTitle: {
    color: "#888",
    fontSize: 18,
    fontWeight: "600",
  },
  emptyText: {
    color: "#666",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 16,
  },
  placeholderIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  placeholderText: {
    color: "#888",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#111",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.88,
    overflow: "hidden",
  },
  sheetHandleArea: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 10,
    paddingBottom: 8,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#444",
    borderRadius: 2,
  },
  sheetImage: {
    width: "100%",
    height: 200,
  },
  sheetImagePlaceholder: {
    width: "100%",
    height: 160,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  sheetPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sheetSourceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#1c1c1f",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#333",
  },
  sheetTitle: {
    color: "#fff",
    fontSize: 22,
    fontFamily: "Sora_800ExtraBold",
    lineHeight: 28,
    marginBottom: 14,
  },
  sheetMetaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 10,
  },
  sheetMetaText: {
    color: "#ccc",
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  sheetDescriptionContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#333",
    marginBottom: 24,
  },
  sheetDescriptionLabel: {
    color: PINK,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  sheetDescription: {
    color: "#aaa",
    fontSize: 14,
    lineHeight: 22,
  },
  quickActions: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  quickAction: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 10,
  },
  quickActionActive: {
    backgroundColor: PINK,
    borderColor: PINK,
  },
  quickActionText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  quickActionTextActive: {
    color: "#FFFFFF",
  },
  eventPlansBox: {
    borderTopColor: "#333",
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
    marginBottom: 10,
    marginTop: 4,
    paddingTop: 16,
  },
  eventPlansEmpty: {
    color: "#A1A1AA",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  eventPlanCard: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.09)",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  eventPlanIcon: {
    alignItems: "center",
    backgroundColor: PINK,
    borderRadius: 15,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  eventPlanTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  eventPlanMeta: {
    color: "#A1A1AA",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  eventPlanAction: {
    color: "#FFB4D9",
    fontSize: 12,
    fontWeight: "900",
  },
  eventPlanJoin: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  eventPlanJoinDisabled: {
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  eventPlanJoinText: {
    color: "#0B0B0D",
    fontSize: 12,
    fontWeight: "900",
  },
  mapThumbnail: {
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 12,
    overflow: "hidden",
    height: 120,
    backgroundColor: "#1a1a2e",
  },
  mapImage: {
    ...StyleSheet.absoluteFillObject,
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(0,0,0,0.45)",
    gap: 8,
  },
  mapPin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PINK,
    alignItems: "center",
    justifyContent: "center",
  },
  mapLabel: {
    flex: 1,
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  planButton: {
    alignItems: "center",
    backgroundColor: PINK,
    borderRadius: 16,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 15,
  },
  planButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Inter_800ExtraBold",
  },
  ticketButton: {
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 16,
    overflow: "hidden",
  },
  ticketButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  ticketButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
});
