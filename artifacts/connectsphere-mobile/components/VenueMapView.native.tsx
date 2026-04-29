import MapView, { Marker } from "react-native-maps";
import { StyleSheet, Text, View } from "react-native";
import type { VenuesResponse } from "@workspace/api-client-react";

type Venue = VenuesResponse["venues"][number];

const PINK = "#FF299B";

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

interface Props {
  venues: Venue[];
  lat: number;
  lng: number;
  onVenuePress: (venue: Venue) => void;
  selectedVenue: Venue | null;
}

export default function VenueMapView({ venues, lat, lng, onVenuePress, selectedVenue }: Props) {
  return (
    <MapView
      style={StyleSheet.absoluteFill}
      initialRegion={{
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.15,
        longitudeDelta: 0.15,
      }}
      userInterfaceStyle="dark"
      showsUserLocation
    >
      {venues.map((venue) => (
        <Marker
          key={venue.id}
          coordinate={{ latitude: venue.latitude, longitude: venue.longitude }}
          onPress={() => onVenuePress(venue)}
        >
          <View
            style={[
              styles.markerContainer,
              {
                backgroundColor: CATEGORY_COLORS[venue.category] ?? PINK,
                borderColor: selectedVenue?.id === venue.id ? "#fff" : "transparent",
                borderWidth: selectedVenue?.id === venue.id ? 2 : 0,
              },
            ]}
          >
            <Text style={styles.markerEmoji}>{CATEGORY_ICONS[venue.category] ?? "📍"}</Text>
            <Text style={styles.markerPrice}>{venue.priceTier}</Text>
          </View>
        </Marker>
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  markerContainer: {
    borderRadius: 16,
    paddingHorizontal: 7,
    paddingVertical: 5,
    alignItems: "center",
    flexDirection: "row",
    gap: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 6,
  },
  markerEmoji: {
    fontSize: 12,
  },
  markerPrice: {
    fontSize: 10,
    color: "#fff",
    fontFamily: "Inter_700Bold",
  },
});
