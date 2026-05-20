import type { VenuesResponse } from "@workspace/api-client-react";

type Venue = VenuesResponse["venues"][number];

export default function VenueMapView(props: {
  venues: Venue[];
  lat: number;
  lng: number;
  onVenuePress: (venue: Venue) => void;
  selectedVenue: Venue | null;
}): JSX.Element;
