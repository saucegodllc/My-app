import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { savedVenuesTable } from "@workspace/db";

const router: IRouter = Router();

interface PlaceResult {
  place_id: string;
  name: string;
  geometry: { location: { lat: number; lng: number } };
  vicinity?: string;
  rating?: number;
  price_level?: number;
  photos?: Array<{ photo_reference: string; height: number; width: number }>;
  types?: string[];
  opening_hours?: { open_now?: boolean };
  business_status?: string;
}

interface CachedVenue {
  id: string;
  name: string;
  category: VenueCategory;
  priceLevel: number;
  priceTier: string;
  latitude: number;
  longitude: number;
  address: string;
  rating?: number;
  photoRef: string;
  isOpen?: boolean;
  distance?: number;
}

export interface MappedVenue extends Omit<CachedVenue, "photoRef"> {
  photoUrl: string;
}

export type VenueCategory = "Food & Drinks" | "Nightlife" | "Outdoors" | "Arts & Culture" | "Activities";

interface CachedData {
  venues: CachedVenue[];
  timestamp: number;
}

const cache = new Map<string, CachedData>();
const CACHE_TTL = 10 * 60 * 1000;

const PLACE_TYPE_CATEGORY: Record<string, VenueCategory> = {
  restaurant: "Food & Drinks",
  cafe: "Food & Drinks",
  bar: "Nightlife",
  night_club: "Nightlife",
  food: "Food & Drinks",
  meal_takeaway: "Food & Drinks",
  meal_delivery: "Food & Drinks",
  bakery: "Food & Drinks",
  park: "Outdoors",
  campground: "Outdoors",
  natural_feature: "Outdoors",
  beach: "Outdoors",
  zoo: "Outdoors",
  museum: "Arts & Culture",
  art_gallery: "Arts & Culture",
  movie_theater: "Arts & Culture",
  library: "Arts & Culture",
  amusement_park: "Activities",
  bowling_alley: "Activities",
  gym: "Activities",
  spa: "Activities",
  stadium: "Activities",
  shopping_mall: "Activities",
};

// Fixed neighborhood hub centers covering Miami-Dade + Broward
const NEIGHBORHOOD_HUBS: Array<{ name: string; lat: number; lng: number; radius: number }> = [
  // Miami-Dade
  { name: "Downtown Miami / Brickell",  lat: 25.7617, lng: -80.1918, radius: 4000 },
  { name: "South Beach / Miami Beach",  lat: 25.7907, lng: -80.1300, radius: 4000 },
  { name: "Wynwood / Design District",  lat: 25.8028, lng: -80.2000, radius: 3500 },
  { name: "Coral Gables / Coconut Grove", lat: 25.7215, lng: -80.2684, radius: 4000 },
  { name: "Kendall",                    lat: 25.6753, lng: -80.3566, radius: 4500 },
  { name: "West Kendall / Doral",       lat: 25.7500, lng: -80.4300, radius: 5000 },
  { name: "Hialeah",                    lat: 25.8576, lng: -80.2781, radius: 4000 },
  { name: "North Miami / Aventura",     lat: 25.9565, lng: -80.1392, radius: 5000 },
  { name: "Homestead / South Dade",     lat: 25.4687, lng: -80.4776, radius: 5000 },
  // Broward
  { name: "Fort Lauderdale",            lat: 26.1224, lng: -80.1373, radius: 4500 },
  { name: "Hollywood / Hallandale",     lat: 26.0112, lng: -80.1495, radius: 4000 },
  { name: "Pembroke Pines / Miramar",   lat: 26.0076, lng: -80.2963, radius: 4500 },
];

function mapCategory(types: string[]): VenueCategory {
  for (const t of types) {
    if (PLACE_TYPE_CATEGORY[t]) return PLACE_TYPE_CATEGORY[t];
  }
  return "Activities";
}

function mapPriceTier(level?: number): string {
  if (level === undefined || level === null) return "$$";
  if (level <= 1) return "$";
  if (level === 2) return "$$";
  return "$$$";
}

function getPriceLevelNumber(level?: number): number {
  if (level === undefined || level === null) return 2;
  return Math.min(level, 3);
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toMappedVenue(v: CachedVenue, baseUrl: string): MappedVenue {
  const { photoRef, ...rest } = v;
  return {
    ...rest,
    photoUrl: photoRef
      ? `${baseUrl}/api/venues/photo?ref=${encodeURIComponent(photoRef)}&maxwidth=400`
      : "",
  };
}

async function fetchPlacesByType(
  apiKey: string,
  lat: number,
  lng: number,
  type: string,
  radius: number
): Promise<PlaceResult[]> {
  const params = new URLSearchParams({
    location: `${lat},${lng}`,
    radius: String(radius),
    type,
    key: apiKey,
  });
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: PlaceResult[]; status?: string };
    return data.results ?? [];
  } catch {
    return [];
  }
}

async function fetchHubVenues(
  apiKey: string,
  hub: { name: string; lat: number; lng: number; radius: number }
): Promise<PlaceResult[]> {
  const cacheKey = `hub-${hub.lat.toFixed(4)}-${hub.lng.toFixed(4)}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.venues.map((v) => ({
      place_id: v.id,
      name: v.name,
      geometry: { location: { lat: v.latitude, lng: v.longitude } },
      vicinity: v.address,
      rating: v.rating,
      price_level: v.priceLevel,
      photos: v.photoRef ? [{ photo_reference: v.photoRef, height: 400, width: 400 }] : undefined,
      types: [],
      opening_hours: v.isOpen !== undefined ? { open_now: v.isOpen } : undefined,
      business_status: "OPERATIONAL",
    }));
  }

  const typesToFetch = [
    "restaurant", "bar", "park", "museum", "amusement_park",
    "night_club", "cafe", "gym", "art_gallery", "bowling_alley",
    "shopping_mall", "movie_theater",
  ];

  const seenIds = new Set<string>();
  const results: PlaceResult[] = [];

  await Promise.all(
    typesToFetch.map(async (type) => {
      const typeResults = await fetchPlacesByType(apiKey, hub.lat, hub.lng, type, hub.radius);
      for (const r of typeResults) {
        if (!seenIds.has(r.place_id) && r.business_status !== "CLOSED_PERMANENTLY") {
          seenIds.add(r.place_id);
          results.push(r);
        }
      }
    })
  );

  // Cache mapped venues for this hub
  const hubVenues: CachedVenue[] = results.map((p) => ({
    id: p.place_id,
    name: p.name,
    category: mapCategory(p.types ?? []),
    priceLevel: getPriceLevelNumber(p.price_level),
    priceTier: mapPriceTier(p.price_level),
    latitude: p.geometry.location.lat,
    longitude: p.geometry.location.lng,
    address: p.vicinity ?? "",
    rating: p.rating,
    photoRef: p.photos?.[0]?.photo_reference ?? "",
    isOpen: p.opening_hours?.open_now,
    distance: 0,
  }));
  cache.set(cacheKey, { venues: hubVenues, timestamp: Date.now() });

  return results;
}

router.get("/venues/photo", async (req, res) => {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return res.status(404).end();

  const { ref, maxwidth = "400" } = req.query;
  if (!ref || typeof ref !== "string") return res.status(400).json({ error: "ref required" });

  try {
    const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxwidth}&photo_reference=${encodeURIComponent(ref)}&key=${apiKey}`;
    const upstream = await fetch(url);
    if (!upstream.ok) return res.status(upstream.status).end();
    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    const buffer = await upstream.arrayBuffer();
    return res.send(Buffer.from(buffer));
  } catch (err) {
    console.error("Photo proxy error:", err);
    return res.status(500).end();
  }
});

router.get("/venues", async (req, res) => {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    return res.json({ venues: [], configured: false });
  }

  const {
    lat = "25.7617",
    lng = "-80.1918",
    category,
    priceFilter,
  } = req.query;

  const userLat = parseFloat(String(lat));
  const userLng = parseFloat(String(lng));

  if (
    isNaN(userLat) || isNaN(userLng) ||
    userLat < -90 || userLat > 90 ||
    userLng < -180 || userLng > 180
  ) {
    return res.status(400).json({ error: "Invalid lat/lng coordinates" });
  }

  const baseUrl = `${req.protocol}://${req.get("host")}`;

  // Check aggregated South Florida cache
  const globalCacheKey = "south-florida-all";
  const globalCached = cache.get(globalCacheKey);
  if (globalCached && Date.now() - globalCached.timestamp < CACHE_TTL) {
    let venues = globalCached.venues.map((v) => ({
      ...v,
      distance: Math.round(haversineKm(userLat, userLng, v.latitude, v.longitude) * 10) / 10,
    }));
    venues.sort((a, b) => (a.distance ?? 99) - (b.distance ?? 99));

    if (category && category !== "All") {
      venues = venues.filter((v) => v.category === String(category));
    }
    if (priceFilter && priceFilter !== "All") {
      venues = venues.filter((v) => v.priceTier === String(priceFilter));
    }
    return res.json({ venues: venues.map((v) => toMappedVenue(v, baseUrl)), configured: true });
  }

  try {
    // Fan out to all neighborhood hubs in parallel
    const hubResultArrays = await Promise.all(
      NEIGHBORHOOD_HUBS.map((hub) => fetchHubVenues(apiKey, hub))
    );

    const seenIds = new Set<string>();
    const allResults: PlaceResult[] = [];

    for (const hubResults of hubResultArrays) {
      for (const r of hubResults) {
        if (!seenIds.has(r.place_id)) {
          seenIds.add(r.place_id);
          allResults.push(r);
        }
      }
    }

    const venues: CachedVenue[] = allResults.map((p) => ({
      id: p.place_id,
      name: p.name,
      category: mapCategory(p.types ?? []),
      priceLevel: getPriceLevelNumber(p.price_level),
      priceTier: mapPriceTier(p.price_level),
      latitude: p.geometry.location.lat,
      longitude: p.geometry.location.lng,
      address: p.vicinity ?? "",
      rating: p.rating,
      photoRef: p.photos?.[0]?.photo_reference ?? "",
      isOpen: p.opening_hours?.open_now,
      distance: 0,
    }));

    // Cache the aggregated South Florida dataset
    cache.set(globalCacheKey, { venues, timestamp: Date.now() });

    // Compute distances from user, sort, and filter
    let withDistances = venues.map((v) => ({
      ...v,
      distance: Math.round(haversineKm(userLat, userLng, v.latitude, v.longitude) * 10) / 10,
    }));
    withDistances.sort((a, b) => (a.distance ?? 99) - (b.distance ?? 99));

    if (category && category !== "All") {
      withDistances = withDistances.filter((v) => v.category === String(category));
    }
    if (priceFilter && priceFilter !== "All") {
      withDistances = withDistances.filter((v) => v.priceTier === String(priceFilter));
    }

    return res.json({ venues: withDistances.map((v) => toMappedVenue(v, baseUrl)), configured: true });
  } catch (err) {
    console.error("Google Places API error:", err);
    return res.status(500).json({ error: "Failed to fetch venues", configured: true });
  }
});

router.get("/venues/saved", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const rows = await db
      .select({ placeId: savedVenuesTable.placeId })
      .from(savedVenuesTable)
      .where(eq(savedVenuesTable.userId, userId));
    return res.json({ placeIds: rows.map((r) => r.placeId) });
  } catch (err) {
    console.error("getSavedVenues error:", err);
    return res.status(500).json({ error: "Failed to fetch saved venues" });
  }
});

router.post("/venues/:placeId/save", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const placeId = decodeURIComponent(req.params.placeId);
  const { name, category, address, photoUrl, priceTier, latitude, longitude, rating } = req.body as {
    name: string;
    category: string;
    address: string;
    photoUrl: string;
    priceTier: string;
    latitude: number;
    longitude: number;
    rating?: number;
  };

  if (!name || !placeId) return res.status(400).json({ error: "name and placeId required" });

  const id = `${userId}_${placeId}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 255);

  try {
    await db
      .insert(savedVenuesTable)
      .values({
        id,
        userId,
        placeId,
        name,
        category: category ?? "Activities",
        address: address ?? "",
        photoUrl: photoUrl ?? "",
        priceTier: priceTier ?? "$$",
        latitude: latitude ?? 0,
        longitude: longitude ?? 0,
        rating: rating ?? null,
      })
      .onConflictDoNothing();
    return res.json({ saved: true });
  } catch (err) {
    console.error("saveVenue error:", err);
    return res.status(500).json({ error: "Failed to save venue" });
  }
});

router.delete("/venues/:placeId/save", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const placeId = decodeURIComponent(req.params.placeId);

  try {
    await db
      .delete(savedVenuesTable)
      .where(and(eq(savedVenuesTable.userId, userId), eq(savedVenuesTable.placeId, placeId)));
    return res.json({ saved: false });
  } catch (err) {
    console.error("unsaveVenue error:", err);
    return res.status(500).json({ error: "Failed to unsave venue" });
  }
});

export default router;
