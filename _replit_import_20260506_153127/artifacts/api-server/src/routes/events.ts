import { Router, type IRouter } from "express";

const router: IRouter = Router();

interface TicketmasterEvent {
  id: string;
  name: string;
  url: string;
  images?: Array<{ url: string; width: number; height: number; ratio?: string }>;
  dates?: {
    start?: { localDate?: string; localTime?: string; dateTime?: string };
    end?: { localDate?: string; localTime?: string };
  };
  priceRanges?: Array<{ min?: number; max?: number; currency?: string; type?: string }>;
  classifications?: Array<{
    segment?: { name?: string };
    genre?: { name?: string };
    subGenre?: { name?: string };
  }>;
  _embedded?: {
    venues?: Array<{
      name?: string;
      city?: { name?: string };
      state?: { name?: string; stateCode?: string };
      postalCode?: string;
      address?: { line1?: string };
      location?: { latitude?: string; longitude?: string };
    }>;
  };
  info?: string;
  pleaseNote?: string;
  description?: string;
}

export interface MappedEvent {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  url: string;
  imageUrl: string;
  venueName: string;
  venueAddress: string;
  neighborhood: string;
  latitude?: number;
  longitude?: number;
  isFree: boolean;
  price: string;
  category: string;
}

interface CachedData {
  events: MappedEvent[];
  total: number;
  hasMore: boolean;
  timestamp: number;
}

const cache = new Map<string, CachedData>();
const CACHE_TTL = 5 * 60 * 1000;

const MIAMI_DADE_CITIES = new Set([
  "Miami", "Miami Beach", "Coral Gables", "Hialeah", "Doral", "Homestead",
  "Miami Gardens", "Kendall", "North Miami", "North Miami Beach", "Aventura",
  "Brickell", "Wynwood", "Coconut Grove", "Little Havana", "Opa-locka",
  "South Miami", "Cutler Bay", "Palmetto Bay", "Pinecrest", "Key Biscayne",
  "Virginia Gardens", "Miami Lakes", "Medley", "Bay Harbor Islands",
  "Bal Harbour", "Sunny Isles Beach", "Golden Beach", "El Portal",
  "Miami Shores", "Biscayne Park", "North Bay Village", "Florida City",
  "Sweetwater", "West Miami", "Islandia", "Indian Creek",
]);

const BROWARD_CITIES = new Set([
  "Fort Lauderdale", "Hollywood", "Pompano Beach", "Miramar", "Coral Springs",
  "Pembroke Pines", "Sunrise", "Plantation", "Lauderhill", "Weston",
  "Davie", "Deerfield Beach", "Coconut Creek", "Margate", "Tamarac",
  "Oakland Park", "Hallandale Beach", "North Lauderdale", "Wilton Manors",
  "Lauderdale Lakes", "Lighthouse Point", "Parkland", "Cooper City",
  "Dania Beach", "Sea Ranch Lakes", "Lazy Lake",
]);

const MIAMI_DADE_ZIPS = new Set([
  "33010","33011","33012","33013","33014","33015","33016","33018","33030","33031","33032","33033",
  "33034","33035","33039","33054","33055","33056","33101","33109","33122","33125","33126","33127",
  "33128","33129","33130","33131","33132","33133","33134","33135","33136","33137","33138","33139",
  "33140","33141","33142","33143","33144","33145","33146","33147","33149","33150","33154","33155",
  "33156","33157","33158","33160","33161","33162","33165","33166","33167","33168","33169","33170",
  "33172","33173","33174","33175","33176","33177","33178","33179","33180","33181","33182","33183",
  "33184","33185","33186","33187","33189","33190","33193","33194","33196","33197","33199",
]);

const BROWARD_ZIPS = new Set([
  "33004","33019","33020","33021","33022","33023","33024","33025","33026","33027","33028","33029",
  "33060","33062","33063","33064","33065","33066","33067","33068","33069","33071","33073","33074",
  "33075","33076","33077","33083","33084","33093","33309","33310","33311","33312","33313","33314",
  "33315","33316","33317","33319","33321","33322","33323","33324","33325","33326","33327","33328",
  "33329","33330","33331","33332","33334","33388","33394",
]);

function isInSouthFlorida(city?: string, stateCode?: string, postalCode?: string): boolean {
  if (stateCode && stateCode !== "FL") return false;
  if (city && (MIAMI_DADE_CITIES.has(city) || BROWARD_CITIES.has(city))) return true;
  if (postalCode) {
    const zip = postalCode.slice(0, 5);
    if (MIAMI_DADE_ZIPS.has(zip) || BROWARD_ZIPS.has(zip)) return true;
  }
  return false;
}

function getNeighborhood(city?: string): string {
  if (!city) return "";
  return city;
}

function mapCategory(segment?: string, genre?: string): string {
  const s = (segment ?? "").toLowerCase();
  const g = (genre ?? "").toLowerCase();
  if (g.includes("nightlife") || g.includes("club") || g.includes("dj")) return "Nightlife";
  if (s.includes("music") || g.includes("music") || g.includes("concert")) return "Music";
  if (s.includes("sport") || g.includes("sport")) return "Sports";
  if (g.includes("art") || g.includes("film") || g.includes("theatre") || g.includes("comedy") || s.includes("art")) return "Arts";
  if (g.includes("food") || g.includes("drink") || g.includes("culinar")) return "Food";
  if (s.includes("music")) return "Music";
  if (s.includes("art")) return "Arts";
  return "Other";
}

function getBestImage(images?: TicketmasterEvent["images"]): string {
  if (!images || images.length === 0) return "";
  const sorted = [...images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  const preferred = sorted.find((i) => i.ratio === "16_9" && (i.width ?? 0) >= 640);
  return (preferred ?? sorted[0])?.url ?? "";
}

function toISONoMs(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function getDateRange(timeframe?: string): { startDateTime: string; endDateTime: string } {
  const now = new Date();
  const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  if (timeframe === "weekend") {
    const dayOfWeek = now.getDay();
    const daysToSat = dayOfWeek === 6 ? 0 : 6 - dayOfWeek;
    const saturday = new Date(now);
    saturday.setDate(now.getDate() + daysToSat);
    saturday.setHours(0, 0, 0, 0);
    const sunday = new Date(saturday);
    sunday.setDate(saturday.getDate() + 1);
    sunday.setHours(23, 59, 59, 999);
    return { startDateTime: toISONoMs(saturday), endDateTime: toISONoMs(sunday) };
  }

  if (timeframe === "week") {
    const endOfWeek = new Date(now);
    const daysToSun = (7 - now.getDay()) % 7 || 7;
    endOfWeek.setDate(now.getDate() + daysToSun);
    endOfWeek.setHours(23, 59, 59, 999);
    return { startDateTime: toISONoMs(now), endDateTime: toISONoMs(endOfWeek) };
  }

  return { startDateTime: toISONoMs(now), endDateTime: toISONoMs(twoWeeksFromNow) };
}

const MOCK_EVENTS: MappedEvent[] = [
  {
    id: "mock-1",
    name: "Neon Nights: Rooftop DJ Set",
    description: "Miami's hottest rooftop party with DJ sets, craft cocktails, and panoramic city views. Dress to impress.",
    startDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10) + "T21:00:00",
    endDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10) + "T02:00:00",
    url: "",
    imageUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&q=80",
    venueName: "E11EVEN Rooftop",
    venueAddress: "29 NE 11th St, Miami, FL",
    neighborhood: "Downtown Miami",
    latitude: 25.7838,
    longitude: -80.1925,
    isFree: false,
    price: "From $35",
    category: "Nightlife",
  },
  {
    id: "mock-2",
    name: "Wynwood Art Walk & Gallery Hop",
    description: "Explore the vibrant street art and galleries of Wynwood. Live painters, pop-up shops, and food trucks.",
    startDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10) + "T18:00:00",
    endDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10) + "T22:00:00",
    url: "",
    imageUrl: "https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=800&q=80",
    venueName: "Wynwood Walls",
    venueAddress: "2520 NW 2nd Ave, Miami, FL",
    neighborhood: "Wynwood",
    latitude: 25.8012,
    longitude: -80.1994,
    isFree: true,
    price: "Free",
    category: "Arts",
  },
  {
    id: "mock-3",
    name: "Sunset Yoga on the Beach",
    description: "Unwind with a guided vinyasa flow as the sun sets over the Atlantic. All levels welcome. Mats provided.",
    startDate: new Date(Date.now() + 1 * 86400000).toISOString().slice(0, 10) + "T17:30:00",
    endDate: new Date(Date.now() + 1 * 86400000).toISOString().slice(0, 10) + "T19:00:00",
    url: "",
    imageUrl: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&q=80",
    venueName: "South Pointe Park",
    venueAddress: "1 Washington Ave, Miami Beach, FL",
    neighborhood: "South Beach",
    latitude: 25.7649,
    longitude: -80.1328,
    isFree: true,
    price: "Free",
    category: "Sports",
  },
  {
    id: "mock-4",
    name: "Latin Beats: Salsa & Bachata Night",
    description: "Free salsa lesson at 8pm followed by open dancing all night. Latin DJs spinning the best reggaeton and salsa.",
    startDate: new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10) + "T20:00:00",
    endDate: new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10) + "T01:00:00",
    url: "",
    imageUrl: "https://images.unsplash.com/photo-1504609813442-a8924e83f76e?w=800&q=80",
    venueName: "Ball & Chain",
    venueAddress: "1513 SW 8th St, Miami, FL",
    neighborhood: "Little Havana",
    latitude: 25.7659,
    longitude: -80.2145,
    isFree: false,
    price: "From $15",
    category: "Music",
  },
  {
    id: "mock-5",
    name: "Seafood Festival on the Bay",
    description: "Fresh catches, live cooking demos, craft beer garden, and live music overlooking Biscayne Bay.",
    startDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10) + "T12:00:00",
    endDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10) + "T20:00:00",
    url: "",
    imageUrl: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80",
    venueName: "Bayfront Park",
    venueAddress: "301 Biscayne Blvd, Miami, FL",
    neighborhood: "Downtown Miami",
    latitude: 25.7743,
    longitude: -80.1862,
    isFree: false,
    price: "From $20",
    category: "Food",
  },
  {
    id: "mock-6",
    name: "Open Mic Comedy Night",
    description: "Up-and-coming comics take the stage. Two-drink minimum. Come laugh, or dare to perform!",
    startDate: new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10) + "T20:30:00",
    endDate: new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10) + "T23:00:00",
    url: "",
    imageUrl: "https://images.unsplash.com/photo-1585699324551-f6c309eedeca?w=800&q=80",
    venueName: "The Comedy Spot",
    venueAddress: "3460 Main Hwy, Coconut Grove, FL",
    neighborhood: "Coconut Grove",
    latitude: 25.7281,
    longitude: -80.2414,
    isFree: false,
    price: "From $10",
    category: "Arts",
  },
  {
    id: "mock-7",
    name: "Fort Lauderdale Boat Show After-Party",
    description: "Exclusive after-party on the waterfront with live DJ, bottle service, and yacht views.",
    startDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) + "T22:00:00",
    endDate: new Date(Date.now() + 8 * 86400000).toISOString().slice(0, 10) + "T03:00:00",
    url: "",
    imageUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80",
    venueName: "Las Olas Oceanside Park",
    venueAddress: "3000 E Las Olas Blvd, Fort Lauderdale, FL",
    neighborhood: "Fort Lauderdale",
    latitude: 26.1068,
    longitude: -80.1050,
    isFree: false,
    price: "From $50",
    category: "Nightlife",
  },
  {
    id: "mock-8",
    name: "Morning Run Club + Brunch",
    description: "5K run along the beach followed by group brunch at a local café. All paces welcome!",
    startDate: new Date(Date.now() + 1 * 86400000).toISOString().slice(0, 10) + "T07:00:00",
    endDate: new Date(Date.now() + 1 * 86400000).toISOString().slice(0, 10) + "T10:00:00",
    url: "",
    imageUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80",
    venueName: "Miami Beach Boardwalk",
    venueAddress: "Ocean Dr, Miami Beach, FL",
    neighborhood: "Miami Beach",
    latitude: 25.7907,
    longitude: -80.1300,
    isFree: true,
    price: "Free",
    category: "Sports",
  },
];

router.get("/events", async (req, res) => {
  const apiKey = process.env.TICKETMASTER_API_KEY;

  if (!apiKey) {
    const { category, freeOnly, timeframe } = req.query;
    let events = [...MOCK_EVENTS];
    if (typeof timeframe === "string" && (timeframe === "week" || timeframe === "weekend")) {
      const { startDateTime, endDateTime } = getDateRange(timeframe);
      const start = new Date(startDateTime).getTime();
      const end = new Date(endDateTime).getTime();
      events = events.filter((e) => {
        const eventTime = new Date(e.startDate).getTime();
        return eventTime >= start && eventTime <= end;
      });
    }
    if (category && category !== "All") {
      events = events.filter((e) => e.category === String(category));
    }
    if (freeOnly === "true") {
      events = events.filter((e) => e.isFree);
    }
    return res.json({ events, total: events.length, hasMore: false, configured: true });
  }

  const { page = "1", category, freeOnly, timeframe } = req.query;
  const cacheKey = `${page}-${category ?? ""}-${freeOnly ?? ""}-${timeframe ?? ""}`;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return res.json({ events: cached.events, total: cached.total, hasMore: cached.hasMore, configured: true });
  }

  try {
    const { startDateTime, endDateTime } = getDateRange(typeof timeframe === "string" ? timeframe : undefined);

    const params = new URLSearchParams({
      apikey: apiKey,
      geoPoint: "25.7617,-80.1918",
      radius: "60",
      unit: "miles",
      startDateTime,
      endDateTime,
      sort: "date,asc",
      size: "50",
      page: String(Number(page) - 1),
      countryCode: "US",
    });

    const categoryMap: Record<string, string> = {
      Music: "KZFzniwnSyZfZ7v7nJ",
      Sports: "KZFzniwnSyZfZ7v7nE",
      Arts: "KZFzniwnSyZfZ7v7na",
      Nightlife: "KZFzniwnSyZfZ7v7n1",
      Food: "KZFzniwnSyZfZ7v7nP",
    };

    if (category && category !== "All" && categoryMap[String(category)]) {
      params.set("segmentId", categoryMap[String(category)]);
    }

    const tmUrl = `https://app.ticketmaster.com/discovery/v2/events.json?${params.toString()}`;
    const response = await fetch(tmUrl);

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error("Ticketmaster error:", response.status, body.slice(0, 300));
      return res.status(502).json({ error: "Failed to fetch events", configured: true });
    }

    const data = await response.json() as {
      _embedded?: { events?: TicketmasterEvent[] };
      page?: { totalElements?: number; totalPages?: number; number?: number; size?: number };
    };

    const rawEvents: TicketmasterEvent[] = data._embedded?.events ?? [];

    let events: MappedEvent[] = rawEvents
      .filter((e) => {
        const venue = e._embedded?.venues?.[0];
        return isInSouthFlorida(
          venue?.city?.name,
          venue?.state?.stateCode,
          venue?.postalCode,
        );
      })
      .map((e) => {
        const venue = e._embedded?.venues?.[0];
        const classification = e.classifications?.[0];
        const segment = classification?.segment?.name;
        const genre = classification?.genre?.name;
        const priceRange = e.priceRanges?.[0];
        const isFree = !priceRange || (priceRange.min === 0 && priceRange.max === 0);
        const price = isFree
          ? "Free"
          : priceRange
          ? `From $${priceRange.min?.toFixed(0)}`
          : "Paid";

        const startLocal = e.dates?.start?.localDate
          ? `${e.dates.start.localDate}T${e.dates.start.localTime ?? "00:00:00"}`
          : e.dates?.start?.dateTime ?? "";

        const endLocal = e.dates?.end?.localDate
          ? `${e.dates.end.localDate}T${e.dates.end.localTime ?? "00:00:00"}`
          : "";

        const venueCity = venue?.city?.name ?? "";
        const venueAddr = [venue?.address?.line1, venueCity, "FL"].filter(Boolean).join(", ");
        const neighborhood = getNeighborhood(venueCity);

        return {
          id: e.id,
          name: e.name,
          description: e.description ?? e.info ?? e.pleaseNote ?? "",
          startDate: startLocal,
          endDate: endLocal,
          url: e.url,
          imageUrl: getBestImage(e.images),
          venueName: venue?.name ?? "",
          venueAddress: venueAddr,
          neighborhood,
          latitude: venue?.location?.latitude ? parseFloat(venue.location.latitude) : undefined,
          longitude: venue?.location?.longitude ? parseFloat(venue.location.longitude) : undefined,
          isFree,
          price,
          category: mapCategory(segment, genre),
        };
      });

    if (freeOnly === "true") {
      events = events.filter((e) => e.isFree);
    }

    if (category && category !== "All") {
      events = events.filter((e) => e.category === String(category));
    }

    const hasMore = (data.page?.number ?? 0) < (data.page?.totalPages ?? 1) - 1;
    const total = events.length;
    cache.set(cacheKey, { events, total, hasMore, timestamp: Date.now() });

    return res.json({ events, total, hasMore, configured: true });
  } catch (err) {
    console.error("Events API error:", err);
    return res.status(500).json({ error: "Failed to fetch events", configured: true });
  }
});

export default router;
