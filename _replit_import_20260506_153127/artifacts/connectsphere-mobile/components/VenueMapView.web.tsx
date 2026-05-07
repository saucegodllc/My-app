import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import type { VenuesResponse } from "@workspace/api-client-react";

type Venue = VenuesResponse["venues"][number];

const PINK = "#FF299B";

interface Props {
  venues: Venue[];
  lat: number;
  lng: number;
  onVenuePress: (venue: Venue) => void;
  selectedVenue: Venue | null;
}

export default function VenueMapView(_props: Props) {
  return (
    <View style={styles.container}>
      <Ionicons name="map-outline" size={48} color={PINK} />
      <Text style={styles.title}>Map View</Text>
      <Text style={styles.subtitle}>
        Interactive map is available on iOS and Android devices.{"\n"}
        Use the List toggle above to browse venues.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#888",
    textAlign: "center",
    lineHeight: 20,
  },
});
