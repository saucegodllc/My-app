import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useGetEvents } from "@workspace/api-client-react";
import type { EventsResponse } from "@workspace/api-client-react";

const PINK = "#FF299B";
const POLL_INTERVAL = 5 * 60 * 1000;
const { height: SCREEN_HEIGHT } = Dimensions.get("window");

type Event = EventsResponse["events"][number];
type Timeframe = "all" | "week" | "weekend";
type Category = "All" | "Nightlife" | "Arts" | "Sports" | "Food" | "Music";

const CATEGORIES: Category[] = ["All", "Nightlife", "Arts", "Sports", "Food", "Music"];

const CATEGORY_ICONS: Record<Category, keyof typeof Ionicons.glyphMap> = {
  All: "apps-outline",
  Nightlife: "moon-outline",
  Arts: "color-palette-outline",
  Sports: "football-outline",
  Food: "restaurant-outline",
  Music: "musical-notes-outline",
};

const CATEGORY_COLORS: Record<Category, string> = {
  All: PINK,
  Nightlife: "#7B2FBE",
  Arts: "#E85D04",
  Sports: "#2196F3",
  Food: "#FF6B35",
  Music: "#1DB954",
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
  onPress,
}: {
  event: Event;
  onPress: () => void;
}) {
  const categoryColor = CATEGORY_COLORS[event.category as Category] ?? PINK;

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
        <View style={[styles.categoryBadge, { backgroundColor: categoryColor }]}>
          <Text style={styles.categoryBadgeText}>{event.category}</Text>
        </View>
        <View style={[styles.priceBadge, event.isFree ? styles.priceFree : styles.pricePaid]}>
          <Text style={styles.priceBadgeText}>{event.price}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {event.name}
        </Text>
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

function EventDetailSheet({
  event,
  visible,
  onClose,
}: {
  event: Event | null;
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

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
          <View style={styles.sheetHandle} />

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
            style={styles.sheetContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.sheetHeader}>
              <View style={[styles.categoryBadge, { backgroundColor: categoryColor }]}>
                <Text style={styles.categoryBadgeText}>{event.category}</Text>
              </View>
              <View style={[styles.priceBadge, event.isFree ? styles.priceFree : styles.pricePaid]}>
                <Text style={styles.priceBadgeText}>{event.price}</Text>
              </View>
            </View>

            <Text style={styles.sheetTitle}>{event.name}</Text>

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
                  {event.venueAddress && !event.venueAddress.startsWith(event.venueName)
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
          </ScrollView>

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
  const topInset = Platform.OS === "web" ? 67 : insets.top;

  const [timeframe, setTimeframe] = useState<Timeframe>("all");
  const [category, setCategory] = useState<Category>("All");
  const [freeOnly, setFreeOnly] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const queryParams = {
    page: 1,
    ...(timeframe !== "all" ? { timeframe: timeframe as "week" | "weekend" } : {}),
    ...(category !== "All" ? { category } : {}),
    ...(freeOnly ? { freeOnly: true } : {}),
  };

  const { data, isLoading, isError, refetch, isRefetching } = useGetEvents(queryParams, {
    query: {
      staleTime: POLL_INTERVAL,
      retry: 2,
      retryDelay: 2000,
    },
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

  const events = data?.events ?? [];
  const isConfigured = data?.configured !== false;

  const openDetail = (event: Event) => {
    setSelectedEvent(event);
    setDetailVisible(true);
  };

  const closeDetail = () => {
    setDetailVisible(false);
  };

  const renderHeader = () => (
    <View style={[styles.filterContainer, { backgroundColor: colors.background }]}>
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
        <Text style={styles.headerSubtitle}>Miami-Dade & Broward</Text>
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
            We're connecting to local event listings in Miami-Dade & Broward. Check back shortly!
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
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={[
            styles.listContent,
            events.length === 0 && styles.listContentEmpty,
          ]}
          renderItem={({ item }) => (
            <EventCard event={item} onPress={() => openDetail(item)} />
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
              <Ionicons name="search-outline" size={48} color="#555" />
              <Text style={styles.emptyTitle}>No events found</Text>
              <Text style={styles.emptyText}>
                Try changing the filters or check back later.
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      <EventDetailSheet
        event={selectedEvent}
        visible={detailVisible}
        onClose={closeDetail}
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
    paddingBottom: 8,
    backgroundColor: "#000",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#888",
    marginTop: 2,
  },
  filterContainer: {
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#222",
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
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
  listContent: {
    paddingBottom: 100,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  card: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: "#111",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#222",
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
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#444",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
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
    gap: 8,
    marginBottom: 10,
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
