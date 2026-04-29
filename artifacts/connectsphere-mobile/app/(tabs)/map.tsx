import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import VenueMapView from "@/components/VenueMapView";
import {
  useGetMyProfile,
  useGetVenues,
  useGetSavedVenues,
  useSaveVenue,
  useUnsaveVenue,
} from "@workspace/api-client-react";
import type { VenuesResponse } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetSavedVenuesQueryKey } from "@workspace/api-client-react";

const PINK = "#FF299B";
const MIAMI_LAT = 25.7617;
const MIAMI_LNG = -80.1918;

type Venue = VenuesResponse["venues"][number];

type PriceFilter = "All" | "$" | "$$" | "$$$";
type CategoryFilter =
  | "All"
  | "Food & Drinks"
  | "Nightlife"
  | "Outdoors"
  | "Arts & Culture"
  | "Activities";

const CATEGORY_COLORS: Record<string, string> = {
  "Food & Drinks": "#FF8C00",
  Nightlife: "#9B59B6",
  Outdoors: "#27AE60",
  "Arts & Culture": "#2980B9",
  Activities: "#E74C3C",
};

const CATEGORY_ICONS: Record<string, string> = {
  "Food & Drinks": "🍽",
  Nightlife: "🎶",
  Outdoors: "🌿",
  "Arts & Culture": "🎨",
  Activities: "🎳",
};

const PRICE_FILTERS: PriceFilter[] = ["All", "$", "$$", "$$$"];
const CATEGORY_FILTERS: CategoryFilter[] = [
  "All",
  "Food & Drinks",
  "Nightlife",
  "Outdoors",
  "Arts & Culture",
  "Activities",
];

export default function MapTab() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [priceFilter, setPriceFilter] = useState<PriceFilter>("All");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("All");
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [isListView, setIsListView] = useState(Platform.OS === "web");
  const cardAnim = useRef(new Animated.Value(0)).current;
  const [hasLoaded, setHasLoaded] = useState(false);
  const [deviceLat, setDeviceLat] = useState<number | null>(null);
  const [deviceLng, setDeviceLng] = useState<number | null>(null);

  // Optimistic saved IDs state
  const [optimisticSavedIds, setOptimisticSavedIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function requestLocation() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted" || cancelled) return;
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!cancelled) {
          setDeviceLat(pos.coords.latitude);
          setDeviceLng(pos.coords.longitude);
        }
      } catch {
      }
    }
    requestLocation();
    return () => { cancelled = true; };
  }, []);

  const { data: profileData } = useGetMyProfile();
  const userLat =
    deviceLat ?? (profileData?.latitude != null ? profileData.latitude : MIAMI_LAT);
  const userLng =
    deviceLng ?? (profileData?.longitude != null ? profileData.longitude : MIAMI_LNG);

  const params = {
    lat: userLat,
    lng: userLng,
    radius: 15000,
    ...(categoryFilter !== "All" ? { category: categoryFilter } : {}),
    ...(priceFilter !== "All" ? { priceFilter } : {}),
  };

  const { data, isLoading, refetch } = useGetVenues(params, {
    query: { enabled: true },
  });

  const { data: savedVenuesData } = useGetSavedVenues({
    query: { enabled: true },
  });

  // Sync optimistic state when server data arrives
  useEffect(() => {
    if (savedVenuesData?.placeIds) {
      setOptimisticSavedIds(new Set(savedVenuesData.placeIds));
    }
  }, [savedVenuesData]);

  const savedIds = optimisticSavedIds ?? new Set<string>(savedVenuesData?.placeIds ?? []);

  const { mutate: saveVenueMutate } = useSaveVenue();
  const { mutate: unsaveVenueMutate } = useUnsaveVenue();

  const toggleSave = useCallback((venue: Venue) => {
    const isSaved = savedIds.has(venue.id);

    if (isSaved) {
      // Optimistic remove
      setOptimisticSavedIds((prev) => {
        const next = new Set(prev ?? savedIds);
        next.delete(venue.id);
        return next;
      });
      unsaveVenueMutate(
        { placeId: venue.id },
        {
          onError: () => {
            // Revert
            setOptimisticSavedIds((prev) => {
              const next = new Set(prev ?? savedIds);
              next.add(venue.id);
              return next;
            });
          },
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetSavedVenuesQueryKey() });
          },
        }
      );
    } else {
      // Optimistic add
      setOptimisticSavedIds((prev) => {
        const next = new Set(prev ?? savedIds);
        next.add(venue.id);
        return next;
      });
      saveVenueMutate(
        {
          placeId: venue.id,
          data: {
            name: venue.name,
            category: venue.category,
            address: venue.address,
            photoUrl: venue.photoUrl ?? "",
            priceTier: venue.priceTier,
            latitude: venue.latitude,
            longitude: venue.longitude,
            rating: venue.rating,
          },
        },
        {
          onError: () => {
            // Revert
            setOptimisticSavedIds((prev) => {
              const next = new Set(prev ?? savedIds);
              next.delete(venue.id);
              return next;
            });
          },
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetSavedVenuesQueryKey() });
          },
        }
      );
    }
  }, [savedIds, saveVenueMutate, unsaveVenueMutate, queryClient]);

  const allVenues = data?.venues ?? [];
  const configured = data?.configured ?? true;

  // Apply saved-only filter on top of the server-side filters
  const venues = showSavedOnly
    ? allVenues.filter((v) => savedIds.has(v.id))
    : allVenues;

  useFocusEffect(
    useCallback(() => {
      if (!hasLoaded) {
        refetch();
        setHasLoaded(true);
      }
    }, [hasLoaded, refetch])
  );

  const openVenueCard = (venue: Venue) => {
    setSelectedVenue(venue);
    Animated.spring(cardAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
  };

  const closeVenueCard = () => {
    Animated.timing(cardAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setSelectedVenue(null));
  };

  const openDirections = (venue: Venue) => {
    const url = Platform.select({
      ios: `maps://app?daddr=${venue.latitude},${venue.longitude}`,
      android: `geo:${venue.latitude},${venue.longitude}?q=${encodeURIComponent(venue.name)}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${venue.latitude},${venue.longitude}`,
    });
    Linking.openURL(url ?? "");
  };

  const cardTranslateY = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

  if (!configured) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <Ionicons name="map-outline" size={64} color={colors.mutedForeground} />
        <Text style={[styles.placeholderTitle, { color: colors.foreground }]}>
          Map Unavailable
        </Text>
        <Text style={[styles.placeholderText, { color: colors.mutedForeground }]}>
          The Google Places API key is not configured. Please add GOOGLE_PLACES_API_KEY to enable
          venue discovery.
        </Text>
      </View>
    );
  }

  const savedCount = savedIds.size;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Explore</Text>
        <TouchableOpacity
          style={[styles.toggleBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => {
            setIsListView((v) => !v);
            setSelectedVenue(null);
          }}
        >
          <Ionicons
            name={isListView ? "map-outline" : "list-outline"}
            size={18}
            color={PINK}
          />
          <Text style={[styles.toggleText, { color: PINK }]}>
            {isListView ? "Map" : "List"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {PRICE_FILTERS.map((p) => (
            <TouchableOpacity
              key={p}
              style={[
                styles.filterChip,
                {
                  backgroundColor: priceFilter === p ? PINK : colors.card,
                  borderColor: priceFilter === p ? PINK : colors.border,
                },
              ]}
              onPress={() => setPriceFilter(p)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: priceFilter === p ? "#fff" : colors.mutedForeground },
                ]}
              >
                {p}
              </Text>
            </TouchableOpacity>
          ))}

          <View style={styles.filterDivider} />

          {CATEGORY_FILTERS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[
                styles.filterChip,
                {
                  backgroundColor:
                    !showSavedOnly && categoryFilter === c
                      ? c === "All"
                        ? PINK
                        : CATEGORY_COLORS[c] ?? PINK
                      : colors.card,
                  borderColor:
                    !showSavedOnly && categoryFilter === c
                      ? c === "All"
                        ? PINK
                        : CATEGORY_COLORS[c] ?? PINK
                      : colors.border,
                },
              ]}
              onPress={() => {
                setCategoryFilter(c);
                setShowSavedOnly(false);
              }}
            >
              {c !== "All" && (
                <Text style={styles.filterChipEmoji}>{CATEGORY_ICONS[c]}</Text>
              )}
              <Text
                style={[
                  styles.filterChipText,
                  {
                    color:
                      !showSavedOnly && categoryFilter === c
                        ? "#fff"
                        : colors.mutedForeground,
                  },
                ]}
              >
                {c}
              </Text>
            </TouchableOpacity>
          ))}

          <View style={styles.filterDivider} />

          <TouchableOpacity
            style={[
              styles.filterChip,
              {
                backgroundColor: showSavedOnly ? PINK : colors.card,
                borderColor: showSavedOnly ? PINK : colors.border,
              },
            ]}
            onPress={() => setShowSavedOnly((v) => !v)}
          >
            <Ionicons
              name={showSavedOnly ? "bookmark" : "bookmark-outline"}
              size={13}
              color={showSavedOnly ? "#fff" : colors.mutedForeground}
            />
            <Text
              style={[
                styles.filterChipText,
                { color: showSavedOnly ? "#fff" : colors.mutedForeground },
              ]}
            >
              {savedCount > 0 ? `Saved (${savedCount})` : "Saved"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {isLoading && venues.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PINK} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Finding venues nearby…
          </Text>
        </View>
      ) : showSavedOnly && venues.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="bookmark-outline" size={48} color={colors.mutedForeground} />
          <Text style={[styles.placeholderTitle, { color: colors.foreground }]}>No saved spots yet</Text>
          <Text style={[styles.placeholderText, { color: colors.mutedForeground }]}>
            Tap the bookmark icon on any venue to save it here.
          </Text>
        </View>
      ) : isListView ? (
        <FlatList
          data={venues}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 16 },
          ]}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="storefront-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.placeholderText, { color: colors.mutedForeground }]}>
                No venues found for your filters.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <VenueListCard
              venue={item}
              colors={colors}
              isSaved={savedIds.has(item.id)}
              onPress={() => openVenueCard(item)}
              onBookmark={() => toggleSave(item)}
            />
          )}
        />
      ) : (
        <VenueMapView
          key={`${userLat.toFixed(4)}-${userLng.toFixed(4)}`}
          venues={venues}
          lat={userLat}
          lng={userLng}
          onVenuePress={openVenueCard}
          selectedVenue={selectedVenue}
        />
      )}

      {selectedVenue && (
        <Animated.View
          style={[
            styles.bottomCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              paddingBottom: insets.bottom + 12,
              transform: [{ translateY: cardTranslateY }],
            },
          ]}
        >
          <TouchableOpacity style={styles.closeBtn} onPress={closeVenueCard}>
            <Ionicons name="close-circle" size={26} color={colors.mutedForeground} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.bookmarkBtn}
            onPress={() => toggleSave(selectedVenue)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={savedIds.has(selectedVenue.id) ? "bookmark" : "bookmark-outline"}
              size={22}
              color={savedIds.has(selectedVenue.id) ? PINK : colors.mutedForeground}
            />
          </TouchableOpacity>

          <View style={styles.cardInner}>
            {selectedVenue.photoUrl ? (
              <Image
                source={{ uri: selectedVenue.photoUrl }}
                style={styles.cardPhoto}
                contentFit="cover"
              />
            ) : (
              <View
                style={[
                  styles.cardPhoto,
                  styles.cardPhotoPlaceholder,
                  { backgroundColor: (CATEGORY_COLORS[selectedVenue.category] ?? "#888") + "33" },
                ]}
              >
                <Text style={styles.cardPhotoEmoji}>
                  {CATEGORY_ICONS[selectedVenue.category] ?? "📍"}
                </Text>
              </View>
            )}

            <View style={styles.cardInfo}>
              <View style={styles.cardTopRow}>
                <View
                  style={[
                    styles.categoryBadge,
                    { backgroundColor: (CATEGORY_COLORS[selectedVenue.category] ?? "#888") + "22" },
                  ]}
                >
                  <Text style={styles.categoryEmoji}>
                    {CATEGORY_ICONS[selectedVenue.category]}
                  </Text>
                  <Text
                    style={[
                      styles.categoryText,
                      { color: CATEGORY_COLORS[selectedVenue.category] ?? PINK },
                    ]}
                  >
                    {selectedVenue.category}
                  </Text>
                </View>
                <Text style={[styles.priceBadge, { color: PINK }]}>
                  {selectedVenue.priceTier}
                </Text>
              </View>

              <Text
                style={[styles.cardName, { color: colors.foreground }]}
                numberOfLines={1}
              >
                {selectedVenue.name}
              </Text>
              <Text
                style={[styles.cardAddress, { color: colors.mutedForeground }]}
                numberOfLines={1}
              >
                {selectedVenue.address}
              </Text>

              <View style={styles.cardMeta}>
                {selectedVenue.rating != null && (
                  <View style={styles.metaItem}>
                    <Ionicons name="star" size={13} color="#F1C40F" />
                    <Text style={[styles.metaText, { color: colors.foreground }]}>
                      {selectedVenue.rating.toFixed(1)}
                    </Text>
                  </View>
                )}
                {selectedVenue.distance != null && (
                  <View style={styles.metaItem}>
                    <Ionicons name="navigate-outline" size={13} color={colors.mutedForeground} />
                    <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                      {selectedVenue.distance} km
                    </Text>
                  </View>
                )}
                {selectedVenue.isOpen != null && (
                  <View style={styles.metaItem}>
                    <View
                      style={[
                        styles.openDot,
                        { backgroundColor: selectedVenue.isOpen ? "#27AE60" : "#E74C3C" },
                      ]}
                    />
                    <Text
                      style={[
                        styles.metaText,
                        { color: selectedVenue.isOpen ? "#27AE60" : "#E74C3C" },
                      ]}
                    >
                      {selectedVenue.isOpen ? "Open" : "Closed"}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.directionsBtn, { backgroundColor: PINK }]}
            onPress={() => openDirections(selectedVenue)}
          >
            <Ionicons name="navigate" size={16} color="#fff" />
            <Text style={styles.directionsBtnText}>Get Directions</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

function VenueListCard({
  venue,
  colors,
  isSaved,
  onPress,
  onBookmark,
}: {
  venue: Venue;
  colors: ReturnType<typeof useColors>;
  isSaved: boolean;
  onPress: () => void;
  onBookmark: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.listCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {venue.photoUrl ? (
        <Image source={{ uri: venue.photoUrl }} style={styles.listCardImage} contentFit="cover" />
      ) : (
        <View
          style={[
            styles.listCardImage,
            styles.cardPhotoPlaceholder,
            { backgroundColor: (CATEGORY_COLORS[venue.category] ?? "#888") + "33" },
          ]}
        >
          <Text style={{ fontSize: 28 }}>{CATEGORY_ICONS[venue.category] ?? "📍"}</Text>
        </View>
      )}
      <View style={styles.listCardBody}>
        <View style={styles.listCardTopRow}>
          <Text style={[styles.listCardName, { color: colors.foreground }]} numberOfLines={1}>
            {venue.name}
          </Text>
          <View style={styles.listCardRight}>
            <Text style={[styles.priceBadge, { color: PINK }]}>{venue.priceTier}</Text>
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); onBookmark(); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={isSaved ? "bookmark" : "bookmark-outline"}
                size={18}
                color={isSaved ? PINK : colors.mutedForeground}
              />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={[styles.listCardAddress, { color: colors.mutedForeground }]} numberOfLines={1}>
          {venue.address}
        </Text>
        <View style={styles.listCardMeta}>
          <View
            style={[
              styles.categoryBadge,
              { backgroundColor: (CATEGORY_COLORS[venue.category] ?? "#888") + "22" },
            ]}
          >
            <Text style={styles.categoryEmoji}>{CATEGORY_ICONS[venue.category]}</Text>
            <Text
              style={[styles.categoryText, { color: CATEGORY_COLORS[venue.category] ?? PINK }]}
            >
              {venue.category}
            </Text>
          </View>
          {venue.rating != null && (
            <View style={styles.metaItem}>
              <Ionicons name="star" size={12} color="#F1C40F" />
              <Text style={[styles.metaText, { color: colors.foreground }]}>
                {venue.rating.toFixed(1)}
              </Text>
            </View>
          )}
          {venue.distance != null && (
            <View style={styles.metaItem}>
              <Ionicons name="navigate-outline" size={12} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {venue.distance} km
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 8,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  toggleText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  filterSection: {
    zIndex: 10,
    paddingBottom: 8,
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    alignItems: "center",
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  filterChipEmoji: {
    fontSize: 13,
  },
  filterChipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  filterDivider: {
    width: 1,
    height: 20,
    backgroundColor: "#333",
    marginHorizontal: 4,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
  },
  listCard: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  listCardImage: {
    width: 90,
    height: 90,
  },
  listCardBody: {
    flex: 1,
    padding: 12,
    justifyContent: "center",
    gap: 4,
  },
  listCardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  listCardRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  listCardName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
    marginRight: 8,
  },
  listCardAddress: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  listCardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  bottomCard: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    paddingTop: 12,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 20,
    zIndex: 100,
  },
  closeBtn: {
    position: "absolute",
    top: 10,
    right: 14,
    zIndex: 10,
  },
  bookmarkBtn: {
    position: "absolute",
    top: 10,
    right: 46,
    zIndex: 10,
  },
  cardInner: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  cardPhoto: {
    width: 80,
    height: 80,
    borderRadius: 10,
  },
  cardPhotoPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  cardPhotoEmoji: {
    fontSize: 32,
  },
  cardInfo: {
    flex: 1,
    gap: 4,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 3,
  },
  categoryEmoji: {
    fontSize: 12,
  },
  categoryText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  priceBadge: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  cardName: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    marginTop: 2,
  },
  cardAddress: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  metaText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  openDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  directionsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  directionsBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  placeholderTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  placeholderText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
});
