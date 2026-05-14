import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
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
    status?: { code?: string };
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

interface EventbriteEvent {
  id: string;
  name?: { text?: string; html?: string };
  description?: { text?: string; html?: string };
  url?: string;
  start?: { local?: string; utc?: string };
  end?: { local?: string; utc?: string };
  logo?: { url?: string; original?: { url?: string } };
  is_free?: boolean;
  category_id?: string;
  status?: string;
  ticket_availability?: {
    has_available_tickets?: boolean;
    minimum_ticket_price?: { major_value?: string; currency?: string };
  };
  venue?: {
    name?: string;
    address?: {
      city?: string;
      region?: string;
      postal_code?: string;
      localized_address_display?: string;
      latitude?: string;
      longitude?: string;
    };
  };
}

interface EventbriteOrganization {
  id: string;
  name?: string;
}

interface MlbScheduleResponse {
  dates?: Array<{
    games?: Array<{
      gamePk?: number;
      gameDate?: string;
      officialDate?: string;
      link?: string;
      status?: { detailedState?: string; abstractGameState?: string; statusCode?: string };
      teams?: {
        away?: { team?: { id?: number; name?: string; teamName?: string } };
        home?: { team?: { id?: number; name?: string; teamName?: string } };
      };
      venue?: {
        id?: number;
        name?: string;
        location?: {
          address1?: string;
          city?: string;
          state?: string;
          stateAbbrev?: string;
          latitude?: string;
          longitude?: string;
        };
      };
    }>;
  }>;
}

type EventSource = "ticketmaster" | "eventbrite" | "posh" | "mlb" | "mock";

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
  source?: EventSource;
  sourceId?: string;
  sourceLabel?: string;
  status?: string;
  updatedAt?: string;
  lastSeenAt?: string;
}

interface EventProviderStatus {
  name: EventSource;
  label: string;
  configured: boolean;
  status: "live" | "disabled" | "error" | "stale";
  count: number;
  message?: string;
}

interface CachedData {
  events: MappedEvent[];
  total: number;
  hasMore: boolean;
  providers: EventProviderStatus[];
  configured: boolean;
  timestamp: number;
}

interface EventInterest {
  id: string;
  userId: string;
  sourceType: EventSource;
  sourceId: string;
  eventName: string;
  eventStartDate: string;
  status: "interested" | "saved";
  createdAt: string;
}

interface SocialDb {
  users?: Array<{ id: string; name?: string; photoUrl?: string; city?: string; neighborhood?: string }>;
  connections?: Array<{ id: string; userAId?: string; userBId?: string; userIds?: string[]; chatId?: string; createdAt: string }>;
  plans?: Array<{
    id: string;
    creatorId?: string;
    creatorUserId?: string;
    title: string;
    type?: string;
    time?: string;
    timeLabel?: string;
    scheduledAt?: string;
    location?: string;
    sourceType?: "map" | "event" | "custom";
    sourceId?: string;
    sourceName?: string;
    sourceImageUrl?: string;
    chatId?: string;
    createdAt: string;
  }>;
  planMembers?: Array<{ id: string; planId: string; userId: string; role: string }>;
  planJoinRequests?: Array<{ id: string; planId: string; fromUserId: string; creatorId: string; status: "pending" | "accepted" | "declined"; createdAt: string }>;
  messages?: Array<{ id: string; chatId: string; text: string; createdAt: string; system?: boolean }>;
  eventInterests?: EventInterest[];
}

const cache = new Map<string, CachedData>();
const CACHE_TTL = Number(process.env.EVENTS_CACHE_TTL_MS ?? 60 * 1000);
const DEFAULT_LOOKAHEAD_DAYS = Number(process.env.EVENTS_LOOKAHEAD_DAYS ?? 7);
const SOUTH_FLORIDA_LATLONG = "25.7617,-80.1918";
const SOUTH_FLORIDA_RADIUS_MILES = process.env.EVENTS_RADIUS_MILES ?? "60";
const MARLINS_TEAM_ID = 146;
const LOANDEPOT_PARK = {
  name: "loanDepot park",
  address: "501 Marlins Way, Miami, FL",
  latitude: 25.7781,
  longitude: -80.2196,
};
const workspaceRoot = process.cwd().endsWith(join("artifacts", "api-server"))
  ? join(process.cwd(), "..", "..")
  : process.cwd();
const dbPath = join(workspaceRoot, "artifacts", "api-server", "db.json");
const PROVIDER_TIMEOUT_MS = Number(process.env.EVENTS_PROVIDER_TIMEOUT_MS ?? 4500);

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

function stripHtml(value?: string): string {
  return (value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mapCategory(...values: Array<string | undefined>): string {
  const text = values.filter(Boolean).join(" ").toLowerCase();
  if (/(nightlife|club|dj|party|lounge|latin night|dance)/.test(text)) return "Nightlife";
  if (/(music|concert|festival|singer|band|hip-hop|rap|reggaeton|latin|jazz|edm)/.test(text)) return "Music";
  if (/(sport|basketball|baseball|football|soccer|hockey|boxing|mma|race|run|yoga|fitness|workout|pilates)/.test(text)) return "Sports";
  if (/(art|film|theatre|theater|comedy|museum|gallery|fashion|paint|poetry|performing)/.test(text)) return "Arts";
  if (/(food|drink|culinar|brunch|wine|beer|cocktail|restaurant|tasting|dinner)/.test(text)) return "Food";
  if (/(business|network|conference|startup|career|workshop|tech|entrepreneur)/.test(text)) return "Business";
  if (/(community|family|charity|fundraiser|market|meetup|wellness)/.test(text)) return "Community";
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

async function fetchWithTimeout(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function getDateRange(timeframe?: string): { startDateTime: string; endDateTime: string } {
  const now = new Date();
  const lookahead = new Date(now.getTime() + DEFAULT_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);

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

  return { startDateTime: toISONoMs(now), endDateTime: toISONoMs(lookahead) };
}

function safeNumber(value?: string | number): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readSocialDb(): SocialDb {
  if (!existsSync(dbPath)) return {};
  try {
    return JSON.parse(readFileSync(dbPath, "utf-8")) as SocialDb;
  } catch {
    return {};
  }
}

function writeSocialDb(db: SocialDb) {
  mkdirSync(dirname(dbPath), { recursive: true });
  writeFileSync(dbPath, `${JSON.stringify(db, null, 2)}\n`);
}

function userProfile(db: SocialDb, userId: string) {
  return db.users?.find((user) => user.id === userId) ?? { id: userId, name: "Someone" };
}

function friendIdsFor(db: SocialDb, userId: string) {
  return new Set(
    (db.connections ?? [])
      .map((connection) => connection.userIds ?? [connection.userAId, connection.userBId].filter(Boolean))
      .filter((ids): ids is string[] => Array.isArray(ids) && ids.includes(userId))
      .map((ids) => ids.find((id) => id !== userId))
      .filter((id): id is string => Boolean(id)),
  );
}

function lastMessageForChat(db: SocialDb, chatId?: string) {
  if (!chatId) return undefined;
  return (db.messages ?? [])
    .filter((message) => message.chatId === chatId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
}

function toLocalDateTime(local?: string, utc?: string): string {
  return local ?? utc ?? "";
}

function eventStartMs(event: MappedEvent): number {
  const value = new Date(event.startDate).getTime();
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function isFutureOrLiveEvent(event: MappedEvent): boolean {
  const start = eventStartMs(event);
  const end = event.endDate ? new Date(event.endDate).getTime() : Number.NaN;
  const now = Date.now();
  if (Number.isFinite(end)) return end >= now - 60 * 60 * 1000;
  return start >= now - 60 * 60 * 1000;
}

function applyRequestFilters(
  events: MappedEvent[],
  options: { category?: unknown; freeOnly?: unknown; timeframe?: unknown; q?: unknown; area?: unknown },
): MappedEvent[] {
  let filtered = events.filter(isFutureOrLiveEvent);

  if (typeof options.timeframe === "string" && (options.timeframe === "week" || options.timeframe === "weekend")) {
    const { startDateTime, endDateTime } = getDateRange(options.timeframe);
    const start = new Date(startDateTime).getTime();
    const end = new Date(endDateTime).getTime();
    filtered = filtered.filter((event) => {
      const eventTime = eventStartMs(event);
      return eventTime >= start && eventTime <= end;
    });
  }

  if (options.category && options.category !== "All") {
    filtered = filtered.filter((event) => event.category === String(options.category));
  }

  if (options.freeOnly === "true" || options.freeOnly === true) {
    filtered = filtered.filter((event) => event.isFree);
  }

  const query = typeof options.q === "string" ? options.q.trim().toLowerCase() : "";
  if (query) {
    filtered = filtered.filter((event) =>
      [event.name, event.venueName, event.venueAddress, event.neighborhood, event.category, event.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }

  const area = typeof options.area === "string" ? options.area.trim().toLowerCase() : "";
  if (area && area !== "all" && area !== "near me") {
    filtered = filtered.filter((event) =>
      [event.venueName, event.venueAddress, event.neighborhood]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(area)),
    );
  }

  return filtered.sort((a, b) => eventStartMs(a) - eventStartMs(b));
}

function dedupeEvents(events: MappedEvent[]): MappedEvent[] {
  const seen = new Map<string, MappedEvent>();
  const sourceRank: Record<EventSource, number> = {
    ticketmaster: 1,
    mlb: 2,
    eventbrite: 3,
    posh: 4,
    mock: 5,
  };

  for (const event of events) {
    const startDay = event.startDate.slice(0, 10);
    const key = [
      event.name.toLowerCase().replace(/[^a-z0-9]+/g, ""),
      (event.venueName || event.neighborhood).toLowerCase().replace(/[^a-z0-9]+/g, ""),
      startDay,
    ].join(":");

    const current = seen.get(key);
    if (!current) {
      seen.set(key, event);
      continue;
    }

    const currentRank = sourceRank[current.source ?? "mock"];
    const nextRank = sourceRank[event.source ?? "mock"];
    if (nextRank < currentRank || (!current.imageUrl && event.imageUrl)) {
      seen.set(key, event);
    }
  }

  return Array.from(seen.values());
}

function providerStatus(
  name: EventSource,
  label: string,
  configured: boolean,
  status: EventProviderStatus["status"],
  count = 0,
  message?: string,
): EventProviderStatus {
  return { name, label, configured, status, count, message };
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

async function fetchTicketmasterEvents(apiKey: string, page: number, timeframe?: string, q?: string): Promise<{
  events: MappedEvent[];
  hasMore: boolean;
}> {
  const { startDateTime, endDateTime } = getDateRange(timeframe);
  const params = new URLSearchParams({
    apikey: apiKey,
    latlong: SOUTH_FLORIDA_LATLONG,
    radius: SOUTH_FLORIDA_RADIUS_MILES,
    unit: "miles",
    startDateTime,
    endDateTime,
    sort: "date,asc",
    size: "100",
    page: String(Math.max(page - 1, 0)),
    countryCode: "US",
  });
  if (q?.trim()) params.set("keyword", q.trim());

  const response = await fetchWithTimeout(`https://app.ticketmaster.com/discovery/v2/events.json?${params.toString()}`);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Ticketmaster ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = await response.json() as {
    _embedded?: { events?: TicketmasterEvent[] };
    page?: { totalPages?: number; number?: number };
  };

  const rawEvents: TicketmasterEvent[] = data._embedded?.events ?? [];
  const now = new Date().toISOString();

  const events = rawEvents
    .filter((event) => {
      const status = event.dates?.status?.code?.toLowerCase();
      if (status === "cancelled" || status === "canceled" || status === "offsale") return false;
      const venue = event._embedded?.venues?.[0];
      return isInSouthFlorida(venue?.city?.name, venue?.state?.stateCode, venue?.postalCode);
    })
    .map((event) => {
      const venue = event._embedded?.venues?.[0];
      const classification = event.classifications?.[0];
      const segment = classification?.segment?.name;
      const genre = classification?.genre?.name;
      const subGenre = classification?.subGenre?.name;
      const priceRange = event.priceRanges?.[0];
      const isFree = priceRange ? priceRange.min === 0 && priceRange.max === 0 : false;
      const price = isFree
        ? "Free"
        : priceRange?.min !== undefined
          ? `From $${priceRange.min.toFixed(0)}`
          : "Check tickets";

      const startLocal = event.dates?.start?.localDate
        ? `${event.dates.start.localDate}T${event.dates.start.localTime ?? "00:00:00"}`
        : event.dates?.start?.dateTime ?? "";

      const endLocal = event.dates?.end?.localDate
        ? `${event.dates.end.localDate}T${event.dates.end.localTime ?? "00:00:00"}`
        : "";

      const venueCity = venue?.city?.name ?? "";
      const venueAddress = [venue?.address?.line1, venueCity, "FL"].filter(Boolean).join(", ");

      return {
        id: `ticketmaster-${event.id}`,
        sourceId: event.id,
        source: "ticketmaster" as const,
        sourceLabel: "Ticketmaster",
        name: event.name,
        description: stripHtml(event.description ?? event.info ?? event.pleaseNote ?? ""),
        startDate: startLocal,
        endDate: endLocal,
        url: event.url,
        imageUrl: getBestImage(event.images),
        venueName: venue?.name ?? "",
        venueAddress,
        neighborhood: getNeighborhood(venueCity),
        latitude: safeNumber(venue?.location?.latitude),
        longitude: safeNumber(venue?.location?.longitude),
        isFree,
        price,
        category: mapCategory(segment, genre, subGenre, event.name),
        status: event.dates?.status?.code ?? "scheduled",
        lastSeenAt: now,
      };
    });

  return {
    events,
    hasMore: (data.page?.number ?? 0) < (data.page?.totalPages ?? 1) - 1,
  };
}

async function fetchMarlinsEvents(timeframe?: string): Promise<MappedEvent[]> {
  const { startDateTime } = getDateRange(timeframe === "weekend" ? "weekend" : "week");
  const start = new Date(startDateTime);
  const end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
  const formatMlbDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const params = new URLSearchParams({
    sportId: "1",
    teamId: String(MARLINS_TEAM_ID),
    startDate: formatMlbDate(start),
    endDate: formatMlbDate(end),
    hydrate: "team,venue",
  });

  const response = await fetchWithTimeout(`https://statsapi.mlb.com/api/v1/schedule?${params.toString()}`);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`MLB schedule ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = await response.json() as MlbScheduleResponse;
  const now = new Date().toISOString();

  return (data.dates ?? [])
    .flatMap((date) => date.games ?? [])
    .filter((game) => {
      const state = game.status?.abstractGameState?.toLowerCase();
      const detailed = game.status?.detailedState?.toLowerCase();
      if (state === "final" || detailed === "final" || detailed === "game over") return false;
      return game.teams?.home?.team?.id === MARLINS_TEAM_ID || game.teams?.away?.team?.id === MARLINS_TEAM_ID;
    })
    .map((game) => {
      const away = game.teams?.away?.team?.teamName ?? game.teams?.away?.team?.name ?? "Opponent";
      const home = game.teams?.home?.team?.teamName ?? game.teams?.home?.team?.name ?? "Marlins";
      const isHome = game.teams?.home?.team?.id === MARLINS_TEAM_ID;
      const venue = game.venue;
      const city = venue?.location?.city ?? "Miami";
      const state = venue?.location?.stateAbbrev ?? venue?.location?.state ?? "FL";
      const venueAddress = [venue?.location?.address1, city, state].filter(Boolean).join(", ") || LOANDEPOT_PARK.address;
      const startDate = game.gameDate ?? `${game.officialDate ?? formatMlbDate(start)}T18:40:00`;
      const end = new Date(new Date(startDate).getTime() + 3.5 * 60 * 60 * 1000);
      const gamePk = String(game.gamePk ?? `${game.officialDate}-${away}`);

      return {
        id: `mlb-marlins-${gamePk}`,
        sourceId: `mlb-marlins-${gamePk}`,
        source: "mlb" as const,
        sourceLabel: "MLB",
        name: isHome ? `${away} at Miami Marlins` : `Miami Marlins at ${home}`,
        description: isHome
          ? `${home} home game at ${venue?.name ?? LOANDEPOT_PARK.name}. Pick this when the plan needs a real game-night anchor.`
          : `Real Marlins away game. Use it as a game-night watch plan with your group.`,
        startDate,
        endDate: end.toISOString(),
        url: isHome ? "https://www.mlb.com/marlins/tickets/single-game-tickets" : "https://www.mlb.com/marlins/schedule",
        imageUrl: "https://images.unsplash.com/photo-1508344928928-7165b67de128?w=900&q=80",
        venueName: isHome ? venue?.name ?? LOANDEPOT_PARK.name : "Marlins watch plan",
        venueAddress: isHome ? venueAddress : LOANDEPOT_PARK.address,
        neighborhood: "Miami",
        latitude: isHome ? safeNumber(venue?.location?.latitude) ?? LOANDEPOT_PARK.latitude : LOANDEPOT_PARK.latitude,
        longitude: isHome ? safeNumber(venue?.location?.longitude) ?? LOANDEPOT_PARK.longitude : LOANDEPOT_PARK.longitude,
        isFree: false,
        price: "Tickets available",
        category: "Sports",
        status: game.status?.detailedState ?? "scheduled",
        updatedAt: now,
        lastSeenAt: now,
      };
    });
}

function mapEventbriteEvents(rawEvents: EventbriteEvent[]): MappedEvent[] {
  const categoryMap: Record<string, string> = {
    "101": "Business",
    "103": "Music",
    "105": "Arts",
    "107": "Sports",
    "108": "Sports",
    "110": "Food",
    "113": "Community",
  };
  const now = new Date().toISOString();

  return rawEvents
    .filter((event) => {
      if (event.status && !["live", "started"].includes(event.status)) return false;
      const address = event.venue?.address;
      return isInSouthFlorida(address?.city, address?.region, address?.postal_code);
    })
    .map((event) => {
      const address = event.venue?.address;
      const ticketPrice = event.ticket_availability?.minimum_ticket_price?.major_value;
      const isFree = event.is_free === true || ticketPrice === "0.00";
      return {
        id: `eventbrite-${event.id}`,
        sourceId: event.id,
        source: "eventbrite" as const,
        sourceLabel: "Eventbrite",
        name: stripHtml(event.name?.text ?? event.name?.html ?? "Untitled Event"),
        description: stripHtml(event.description?.text ?? event.description?.html ?? ""),
        startDate: toLocalDateTime(event.start?.local, event.start?.utc),
        endDate: toLocalDateTime(event.end?.local, event.end?.utc),
        url: event.url ?? "",
        imageUrl: event.logo?.original?.url ?? event.logo?.url ?? "",
        venueName: event.venue?.name ?? "",
        venueAddress: address?.localized_address_display ?? "",
        neighborhood: getNeighborhood(address?.city),
        latitude: safeNumber(address?.latitude),
        longitude: safeNumber(address?.longitude),
        isFree,
        price: isFree ? "Free" : ticketPrice ? `From $${Number(ticketPrice).toFixed(0)}` : "Check tickets",
        category: categoryMap[event.category_id ?? ""] ?? mapCategory(event.name?.text, event.description?.text),
        status: event.status ?? "scheduled",
        lastSeenAt: now,
      };
    });
}

async function fetchEventbritePublicSearchEvents(token: string, page: number, timeframe?: string): Promise<{
  events: MappedEvent[];
  hasMore: boolean;
}> {
  const { startDateTime, endDateTime } = getDateRange(timeframe);
  const params = new URLSearchParams({
    expand: "venue,ticket_availability,logo",
    "location.latitude": SOUTH_FLORIDA_LATLONG.split(",")[0],
    "location.longitude": SOUTH_FLORIDA_LATLONG.split(",")[1],
    "location.within": `${SOUTH_FLORIDA_RADIUS_MILES}mi`,
    "start_date.range_start": startDateTime,
    "start_date.range_end": endDateTime,
    sort_by: "date",
    page: String(Math.max(page, 1)),
  });

  const response = await fetch(`https://www.eventbriteapi.com/v3/events/search/?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Eventbrite ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = await response.json() as {
    events?: EventbriteEvent[];
    pagination?: { has_more_items?: boolean };
  };

  const events = mapEventbriteEvents(data.events ?? []);

  return { events, hasMore: data.pagination?.has_more_items === true };
}

async function fetchEventbriteOrganizationEvents(token: string, page: number): Promise<{
  events: MappedEvent[];
  hasMore: boolean;
}> {
  const configuredOrgIds = (process.env.EVENTBRITE_ORGANIZATION_ID ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  let organizationIds = configuredOrgIds;

  if (organizationIds.length === 0) {
    const orgResponse = await fetch("https://www.eventbriteapi.com/v3/users/me/organizations/", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!orgResponse.ok) {
      const body = await orgResponse.text().catch(() => "");
      throw new Error(`Eventbrite organizations ${orgResponse.status}: ${body.slice(0, 200)}`);
    }

    const orgData = await orgResponse.json() as { organizations?: EventbriteOrganization[] };
    organizationIds = (orgData.organizations ?? []).map((org) => org.id).filter(Boolean);
  }

  if (organizationIds.length === 0) {
    throw new Error("Eventbrite token is valid, but no organizations were found for this private token.");
  }

  let events: MappedEvent[] = [];
  let hasMore = false;

  for (const organizationId of organizationIds.slice(0, 5)) {
    const params = new URLSearchParams({
      status: "live",
      expand: "venue,ticket_availability,logo",
      order_by: "start_asc",
      page: String(Math.max(page, 1)),
    });

    const response = await fetch(
      `https://www.eventbriteapi.com/v3/organizations/${encodeURIComponent(organizationId)}/events/?${params.toString()}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Eventbrite organization events ${response.status}: ${body.slice(0, 200)}`);
    }

    const data = await response.json() as {
      events?: EventbriteEvent[];
      pagination?: { has_more_items?: boolean };
    };

    events = events.concat(mapEventbriteEvents(data.events ?? []));
    hasMore = hasMore || data.pagination?.has_more_items === true;
  }

  return { events, hasMore };
}

async function fetchEventbriteEvents(token: string, page: number, timeframe?: string): Promise<{
  events: MappedEvent[];
  hasMore: boolean;
}> {
  if (process.env.EVENTBRITE_USE_PUBLIC_SEARCH === "true") {
    try {
      return await fetchEventbritePublicSearchEvents(token, page, timeframe);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (!message.includes("404")) throw err;
    }
  }

  return fetchEventbriteOrganizationEvents(token, page);
}

function readString(payload: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function readNumber(payload: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = payload[key];
    const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

async function fetchPoshEvents(feedUrl: string, apiKey?: string, timeframe?: string): Promise<{
  events: MappedEvent[];
  hasMore: boolean;
}> {
  const { startDateTime, endDateTime } = getDateRange(timeframe);
  const url = new URL(feedUrl);
  url.searchParams.set("latlong", SOUTH_FLORIDA_LATLONG);
  url.searchParams.set("radiusMiles", SOUTH_FLORIDA_RADIUS_MILES);
  url.searchParams.set("startDateTime", startDateTime);
  url.searchParams.set("endDateTime", endDateTime);

  const response = await fetch(url, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Posh feed ${response.status}: ${body.slice(0, 200)}`);
  }

  const payload = await response.json() as unknown;
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { events?: unknown[] }).events)
      ? (payload as { events: unknown[] }).events
      : [];

  const now = new Date().toISOString();
  const events = rows
    .filter((row): row is Record<string, unknown> => row !== null && typeof row === "object")
    .map((row) => {
      const city = readString(row, ["city", "neighborhood"]);
      const start = readString(row, ["startDate", "startDateTime", "startsAt", "start"]);
      const id = readString(row, ["id", "eventId", "slug"]) || `${readString(row, ["name", "title"])}-${start}`;
      const price = readString(row, ["price", "ticketPrice"]);
      const isFree = price.toLowerCase() === "free" || price === "$0";

      return {
        id: `posh-${id}`,
        sourceId: id,
        source: "posh" as const,
        sourceLabel: "Posh",
        name: readString(row, ["name", "title"]),
        description: stripHtml(readString(row, ["description", "summary"])),
        startDate: start,
        endDate: readString(row, ["endDate", "endDateTime", "endsAt", "end"]),
        url: readString(row, ["url", "ticketUrl", "link"]),
        imageUrl: readString(row, ["imageUrl", "image", "coverImageUrl", "posterUrl"]),
        venueName: readString(row, ["venueName", "venue", "locationName"]),
        venueAddress: readString(row, ["venueAddress", "address", "location"]),
        neighborhood: getNeighborhood(city),
        latitude: readNumber(row, ["latitude", "lat"]),
        longitude: readNumber(row, ["longitude", "lng", "lon"]),
        isFree,
        price: isFree ? "Free" : price || "Check tickets",
        category: mapCategory(readString(row, ["category", "type"]), readString(row, ["name", "title"])),
        status: readString(row, ["status"]) || "scheduled",
        lastSeenAt: now,
      };
    })
    .filter((event) => event.name && event.startDate);

  return { events, hasMore: false };
}

router.get("/events", async (req, res) => {
  const { page = "1", category, freeOnly, timeframe, q, area } = req.query;
  const pageNumber = Number(page) || 1;
  const cacheKey = `${pageNumber}-${category ?? ""}-${freeOnly ?? ""}-${timeframe ?? ""}-${q ?? ""}-${area ?? ""}`;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return res.json({
      events: cached.events,
      total: cached.total,
      hasMore: cached.hasMore,
      configured: cached.configured,
      providers: cached.providers,
      refreshedAt: new Date(cached.timestamp).toISOString(),
      cacheTtlMs: CACHE_TTL,
    });
  }

  const ticketmasterKey = process.env.TICKETMASTER_API_KEY;
  const providers: EventProviderStatus[] = [];
  let marlinsEvents: MappedEvent[] = [];
  try {
    marlinsEvents = await fetchMarlinsEvents(typeof timeframe === "string" ? timeframe : undefined);
    providers.push(providerStatus("mlb", "Marlins Games", true, "live", marlinsEvents.length));
  } catch (err) {
    const message = err instanceof Error ? err.message : "MLB schedule provider failed";
    console.error("MLB schedule provider error:", message);
    providers.push(providerStatus("mlb", "Marlins Games", true, "error", 0, message));
  }

  if (!ticketmasterKey) {
    const useMocks = process.env.EVENTS_USE_MOCKS === "true";
    const events = useMocks
      ? applyRequestFilters(
        [...marlinsEvents, ...MOCK_EVENTS.map((event) => ({ ...event, source: "mock" as const, sourceLabel: "Demo" }))],
        { category, freeOnly, timeframe, q, area },
      )
      : applyRequestFilters(marlinsEvents, { category, freeOnly, timeframe, q, area });
    providers.push(providerStatus("ticketmaster", "Ticketmaster", false, "disabled", events.length, "Missing TICKETMASTER_API_KEY"));

    return res.json({
      events,
      total: events.length,
      hasMore: false,
      configured: useMocks || marlinsEvents.length > 0,
      providers,
      refreshedAt: new Date().toISOString(),
      cacheTtlMs: CACHE_TTL,
    });
  }

  let ticketmasterResult: { events: MappedEvent[]; hasMore: boolean };
  try {
    ticketmasterResult = await fetchTicketmasterEvents(
      ticketmasterKey,
      pageNumber,
      typeof timeframe === "string" ? timeframe : undefined,
      typeof q === "string" ? q : undefined,
    );
    providers.push(providerStatus("ticketmaster", "Ticketmaster", true, "live", ticketmasterResult.events.length));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ticketmaster provider failed";
    console.error("Ticketmaster events provider error:", message);
    providers.push(providerStatus("ticketmaster", "Ticketmaster", true, "error", 0, message));

    if (cached && cached.events.length > 0) {
      return res.json({
        events: cached.events,
        total: cached.total,
        hasMore: cached.hasMore,
        configured: true,
        providers: providers.map((provider) => ({ ...provider, status: "stale" as const })),
        refreshedAt: new Date(cached.timestamp).toISOString(),
        cacheTtlMs: CACHE_TTL,
        stale: true,
      });
    }

    if (marlinsEvents.length > 0) {
      const events = applyRequestFilters(dedupeEvents(marlinsEvents), { category, freeOnly, timeframe, q, area });
      cache.set(cacheKey, { events, total: events.length, hasMore: false, providers, configured: true, timestamp: Date.now() });
      return res.json({
        events,
        total: events.length,
        hasMore: false,
        configured: true,
        providers,
        refreshedAt: new Date().toISOString(),
        cacheTtlMs: CACHE_TTL,
      });
    }

    return res.status(502).json({
      events: [],
      total: 0,
      hasMore: false,
      configured: true,
      providers,
      refreshedAt: new Date().toISOString(),
      cacheTtlMs: CACHE_TTL,
      error: "Failed to fetch Ticketmaster events",
    });
  }

  const events = applyRequestFilters(dedupeEvents([...marlinsEvents, ...ticketmasterResult.events]), { category, freeOnly, timeframe, q, area });

  if (events.length === 0 && cached && cached.events.length > 0) {
    return res.json({
      events: cached.events,
      total: cached.total,
      hasMore: cached.hasMore,
      configured: true,
      providers: providers.map((provider) =>
        provider.status === "live" ? provider : { ...provider, status: "stale" as const },
      ),
      refreshedAt: new Date(cached.timestamp).toISOString(),
      cacheTtlMs: CACHE_TTL,
      stale: true,
    });
  }

  const total = events.length;
  cache.set(cacheKey, { events, total, hasMore: ticketmasterResult.hasMore, providers, configured: true, timestamp: Date.now() });

  return res.json({
    events,
    total,
    hasMore: ticketmasterResult.hasMore,
    configured: true,
    providers,
    refreshedAt: new Date().toISOString(),
    cacheTtlMs: CACHE_TTL,
  });
});

router.post("/events/interest/toggle", (req, res) => {
  const db = readSocialDb();
  db.eventInterests = db.eventInterests ?? [];
  const userId = String(req.body.userId ?? "").trim();
  const sourceId = String(req.body.sourceId ?? "").trim();
  const eventName = String(req.body.eventName ?? "Event");
  const eventStartDate = String(req.body.eventStartDate ?? "");
  const sourceType = ["ticketmaster", "eventbrite", "posh", "mlb", "mock"].includes(String(req.body.sourceType))
    ? String(req.body.sourceType) as EventSource
    : "ticketmaster";
  const status = req.body.status === "saved" ? "saved" : "interested";
  if (!userId || !sourceId) return res.status(400).json({ error: "userId and sourceId are required" });

  const existing = db.eventInterests.find((interest) =>
    interest.userId === userId && interest.sourceType === sourceType && interest.sourceId === sourceId,
  );
  if (existing?.status === status) {
    db.eventInterests = db.eventInterests.filter((interest) => interest.id !== existing.id);
    writeSocialDb(db);
    return res.json({ interest: null, status: null });
  }

  const interest = existing ?? {
    id: randomUUID(),
    userId,
    sourceType,
    sourceId,
    eventName,
    eventStartDate,
    status,
    createdAt: new Date().toISOString(),
  };
  interest.status = status;
  interest.eventName = eventName;
  interest.eventStartDate = eventStartDate;
  if (!existing) db.eventInterests.push(interest);
  writeSocialDb(db);
  return res.json({ interest, status: interest.status });
});

router.get("/events/context/:userId", (req, res) => {
  const db = readSocialDb();
  const userId = req.params.userId;
  const sourceIds = String(req.query.sourceIds ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const friendIds = friendIdsFor(db, userId);
  const contexts = sourceIds.map((sourceId) => {
    const plans = (db.plans ?? []).filter((plan) => plan.sourceType === "event" && plan.sourceId === sourceId);
    const myPlan = plans.find((plan) => {
      const creatorId = plan.creatorId ?? plan.creatorUserId;
      return creatorId === userId || (db.planMembers ?? []).some((member) => member.planId === plan.id && member.userId === userId);
    });
    const joinablePlans = plans
      .filter((plan) => {
        const creatorId = plan.creatorId ?? plan.creatorUserId;
        if (!creatorId || creatorId === userId) return false;
        if ((db.planMembers ?? []).some((member) => member.planId === plan.id && member.userId === userId)) return false;
        return true;
      })
      .slice(0, 4)
      .map((plan) => {
        const members = (db.planMembers ?? []).filter((member) => member.planId === plan.id);
        const joinRequest = (db.planJoinRequests ?? []).find((request) =>
          request.planId === plan.id && request.fromUserId === userId,
        );
        return {
          ...plan,
          creatorId: plan.creatorId ?? plan.creatorUserId,
          creator: userProfile(db, plan.creatorId ?? plan.creatorUserId ?? ""),
          peopleGoing: members.length,
          members: members.map((member) => ({ ...member, user: userProfile(db, member.userId) })),
          joinRequestStatus: joinRequest?.status ?? null,
          joinRequestId: joinRequest?.id,
          lastMessage: lastMessageForChat(db, plan.chatId),
        };
      });
    const interests = (db.eventInterests ?? []).filter((interest) => interest.sourceId === sourceId);
    const myInterest = interests.find((interest) => interest.userId === userId);
    const friendInterestedUsers = interests
      .filter((interest) => friendIds.has(interest.userId))
      .slice(0, 4)
      .map((interest) => userProfile(db, interest.userId));
    return {
      sourceId,
      interestedCount: interests.length,
      friendInterestedUsers,
      planCount: plans.length,
      myPlan: myPlan ? {
        ...myPlan,
        creatorId: myPlan.creatorId ?? myPlan.creatorUserId,
        creator: userProfile(db, myPlan.creatorId ?? myPlan.creatorUserId ?? ""),
        peopleGoing: (db.planMembers ?? []).filter((member) => member.planId === myPlan.id).length,
        lastMessage: lastMessageForChat(db, myPlan.chatId),
      } : null,
      joinablePlans,
      myInterestStatus: myInterest?.status ?? null,
    };
  });

  return res.json({
    contexts,
    bySourceId: Object.fromEntries(contexts.map((context) => [context.sourceId, context])),
  });
});

export default router;
