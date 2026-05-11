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
import CreateFriendPlanSheet from "@/components/CreateFriendPlanSheet";
import { requestJoinFriendPlan, type PlanLocationOption } from "@/services/friendsApi";
import { getEventContexts, toggleEventInterest, type EventContext } from "@/services/eventsApi";
import { useGetEvents } from "@workspace/api-client-react";
import type { EventsResponse } from "@workspace/api-client-react";

const PINK = "#FF299B";
const POLL_INTERVAL = 60 * 1000;
const { height: SCREEN_HEIGHT } = Dimensions.get("window");

type Event = EventsResponse["events"][number];
type Timeframe = "all" | "week" | "weekend";
type Category = "All" | "Nightlife" | "Arts" | "Sports" | "Food" | "Music" | "Business" | "Community" | "Other";
type AreaFilter = "All" | "Near Me" | "Miami" | "Miami Beach" | "Wynwood" | "Brickell" | "Fort Lauderdale" | "Hollywood";

const CATEGORIES: Category[] = ["All", "Nightlife", "Arts", "Sports", "Food", "Music", "Business", "Community", "Other"];
const AREAS: AreaFilter[] = ["All", "Near Me", "Miami", "Miami Beach", "Wynwood", "Brickell", "Fort Lauderdale", "Hollywood"];

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

function eventSourceType(event: Event): "ticketmaster" | "eventbrite" | "posh" | "mock" {
  const source = String((event as any).source ?? "ticketmaster");
  return ["ticketmaster", "eventbrite", "posh", "mock"].includes(source) ? source as any : "ticketmaster";
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

function getProviderEmptyMessage(data: EventsResponse | undefined): string | null {
  const providers = ((data as any)?.providers ?? []) as Array<{
    label?: string;
    status?: string;
    configured?: boolean;
    message?: string;
  }>;

  const ticketmaster = providers.find((provider) => provider.label === "Ticketmaster");
  if (ticketmaster?.configured === false) {
    return "Ticketmaster is not connected yet. Add a Ticketmaster API key to unlock broad public events around Miami and Broward.";
  }

  if (ticketmaster?.message && ticketmaster.status === "error") {
    return ticketmaster.message;
  }

  return null;
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
}: {
  event: Event;
  context?: EventContext;
  onPress: () => void;
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
        {social ? (
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
      </View>
    </Pressable>
  );
}

function EventAreaChips({ value, onChange }: { value: AreaFilter; onChange: (value: AreaFilter) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
      {AREAS.map((area) => (
        <Pressable
          key={area}
          onPress={() => onChange(area)}
          style={[styles.areaChip, value === area && styles.areaChipActive]}
        >
          <Ionicons name={area === "Near Me" ? "navigate" : "location-outline"} size={13} color={value === area ? "#FFFFFF" : "#999"} />
          <Text style={[styles.chipText, value === area && styles.chipTextActive]}>{area}</Text>
        </Pressable>
      ))}
    </ScrollView>
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

  useFocusEffect(
    useCallback(() => {
      if (visible) {
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 18,
          stiffness: 180,
          useNativeDriver: true,
        }).start();
      } else {
        slideAnim.setValue(SCREEN_HEIGHT);
      }
    }, [visible, slideAnim])
  );

  if (!event) return null;

  const categoryColor = CATEGORY_COLORS[event.category as Category] ?? PINK;
  const sourceLabel = getEventSourceLabel(event);
  const hasJoinablePlans = (context?.joinablePlans?.length ?? 0) > 0;
  const primaryLabel = context?.myPlan?.chatId ? "Open Plan Chat" : hasJoinablePlans ? "View Plans" : "Start a Plan";
  const primaryIcon: keyof typeof Ionicons.glyphMap = context?.myPlan?.chatId ? "chatbubbles" : hasJoinablePlans ? "people" : "add-circle";

  const handleGetTickets = () => {
    if (event.url) {
      Linking.openURL(event.url);
    }
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
  const topInset = Platform.OS === "web" ? 67 : insets.top;

  const [timeframe, setTimeframe] = useState<Timeframe>("all");
  const [category, setCategory] = useState<Category>("All");
  const [freeOnly, setFreeOnly] = useState(false);
  const [area, setArea] = useState<AreaFilter>("All");
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [planSource, setPlanSource] = useState<PlanLocationOption | null>(null);
  const [eventContexts, setEventContexts] = useState<Record<string, EventContext>>({});
  const currentUserId = user?.id ?? "user_self";

  const queryParams = {
    page: 1,
    ...(timeframe !== "all" ? { timeframe: timeframe as "week" | "weekend" } : {}),
    ...(category !== "All" ? { category } : {}),
    ...(freeOnly ? { freeOnly: true } : {}),
    ...(area !== "All" ? { area } : {}),
    ...(currentUserId ? { userId: currentUserId } : {}),
  } as any;

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

  const events = useMemo(() => data?.events ?? [], [data?.events]);
  const isConfigured = data?.configured !== false;
  const providerEmptyMessage = getProviderEmptyMessage(data);
  const eventSourceIds = useMemo(() => events.map(eventSourceId), [events]);

  const loadEventContexts = useCallback(async () => {
    if (!eventSourceIds.length) {
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
    router.push(`/chat/${chatId}` as never);
  }, []);

  const shareEvent = useCallback(async (event: Event) => {
    const venue = event.venueName || event.neighborhood || "Miami";
    const message = `${event.name}\n${formatDate(event.startDate)}\n${venue}${event.url ? `\n${event.url}` : ""}`;
    await Share.share({ message });
  }, []);

  const handleToggleInterest = useCallback(async (event: Event) => {
    const sourceId = eventSourceId(event);
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
  }, [currentUserId, eventContexts, loadEventContexts]);

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
          <View>
            <Text style={styles.liveKicker}>TONIGHT'S MOVES</Text>
            <Text style={styles.liveTitle}>Find the energy. Build the plan.</Text>
            <Text style={styles.liveSubcopy}>Concerts, parties, games, pop-ups, and real reasons to get outside.</Text>
          </View>
        </View>
      </LinearGradient>

      <EventAreaChips value={area} onChange={setArea} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
      >
        <Pressable
          style={[styles.chip, timeframe === "all" && styles.chipActive]}
          onPress={() => setTimeframe("all")}
        >
          <Text style={[styles.chipText, timeframe === "all" && styles.chipTextActive]}>
            All Upcoming
          </Text>
        </Pressable>
        <Pressable
          style={[styles.chip, timeframe === "week" && styles.chipActive]}
          onPress={() => setTimeframe("week")}
        >
          <Text style={[styles.chipText, timeframe === "week" && styles.chipTextActive]}>
            This Week
          </Text>
        </Pressable>
        <Pressable
          style={[styles.chip, timeframe === "weekend" && styles.chipActive]}
          onPress={() => setTimeframe("weekend")}
        >
          <Text style={[styles.chipText, timeframe === "weekend" && styles.chipTextActive]}>
            This Weekend
          </Text>
        </Pressable>
        <Pressable
          style={[styles.chip, freeOnly && styles.chipActive]}
          onPress={() => setFreeOnly((v) => !v)}
        >
          <Ionicons
            name="pricetag-outline"
            size={13}
            color={freeOnly ? "#fff" : "#999"}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.chipText, freeOnly && styles.chipTextActive]}>Free Only</Text>
        </Pressable>
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
      >
        {CATEGORIES.map((cat) => {
          const isActive = category === cat;
          const color = CATEGORY_COLORS[cat];
          return (
            <Pressable
              key={cat}
              style={[
                styles.categoryChip,
                isActive && { backgroundColor: color, borderColor: color },
              ]}
              onPress={() => setCategory(cat)}
            >
              <Ionicons
                name={CATEGORY_ICONS[cat]}
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
                {cat}
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
          <Text style={styles.placeholderTitle}>Events coming soon</Text>
          <Text style={styles.placeholderText}>
            Ticketmaster is not connected on the API yet. Add the Ticketmaster key to unlock live Miami and Broward events.
          </Text>
        </View>
      ) : isLoading ? (
        <>
          {renderHeader()}
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={PINK} />
            <Text style={styles.loadingText}>Loading events…</Text>
          </View>
        </>
      ) : isError ? (
        <>
          {renderHeader()}
          <View style={styles.centered}>
            <Ionicons name="alert-circle-outline" size={48} color="#555" />
            <Text style={styles.errorText}>Couldn't load events</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
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
              <EventCard event={item} context={eventContexts[eventSourceId(item)]} onPress={() => openDetail(item)} />
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
                  name={providerEmptyMessage ? "key-outline" : "search-outline"}
                  size={48}
                  color="#555"
                />
                <Text style={styles.emptyTitle}>
                  {providerEmptyMessage ? "Connect a live event source" : "No events found"}
                </Text>
                <Text style={styles.emptyText}>
                  {providerEmptyMessage ?? "Try a different category or check back after the next refresh."}
                </Text>
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
            router.push({ pathname: "/(tabs)/matches", params: { openChatId: result.chat.id } } as never);
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
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 0,
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
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1,
  },
  liveTitle: {
    color: "#fff",
    flexShrink: 1,
    fontSize: 26,
    fontWeight: "900",
    lineHeight: 31,
    marginTop: 1,
  },
  liveSubcopy: {
    color: "#B7B7C2",
    fontSize: 12.5,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 2,
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
    fontWeight: "700",
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
    fontWeight: "700",
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
    fontWeight: "900",
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
