import { customFetch } from "@workspace/api-client-react";
import type { FriendPerson, FriendPlan } from "@/services/friendsApi";

// ── Fallback events shown when Ticketmaster is unreachable ───────────────────
// 8 real Miami venues / recurring event types, photo-ready Unsplash covers.

export type FallbackEvent = {
  id: string;
  name: string;
  date: string;        // ISO-8601
  venue: string;
  neighborhood: string;
  city: string;
  imageUrl: string;
  category: "Music" | "Nightlife" | "Sports" | "Arts" | "Food & Drink" | "Outdoor";
  price?: string;
  url?: string;
  sourceType: "mock";
};

// Dates below are placeholders — normalized to the upcoming week at load time
// (see FALLBACK_EVENTS export). Hardcoded absolute dates go stale and would
// show users events that already happened.
const RAW_FALLBACK_EVENTS: FallbackEvent[] = [
  {
    id: "fallback-1",
    name: "Friday Night Live at Bayfront Park",
    date: "2026-06-06T21:00:00",
    venue: "Bayfront Park Amphitheater",
    neighborhood: "Downtown",
    city: "Miami",
    imageUrl: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=800&q=80",
    category: "Music",
    sourceType: "mock",
    price: "$25–$45",
  },
  {
    id: "fallback-2",
    name: "Wynwood Art Walk",
    date: "2026-06-07T18:00:00",
    venue: "Wynwood Walls",
    neighborhood: "Wynwood",
    city: "Miami",
    imageUrl: "https://images.unsplash.com/photo-1567359781514-3b964e2b04d6?auto=format&fit=crop&w=800&q=80",
    category: "Arts",
    sourceType: "mock",
    price: "Free",
  },
  {
    id: "fallback-3",
    name: "Inter Miami CF vs. Atlanta United",
    date: "2026-06-08T20:00:00",
    venue: "Chase Stadium",
    neighborhood: "Fort Lauderdale",
    city: "Miami",
    imageUrl: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=800&q=80",
    category: "Sports",
    sourceType: "mock",
    price: "$30–$120",
  },
  {
    id: "fallback-4",
    name: "Rooftop Sunset Sessions",
    date: "2026-06-13T19:00:00",
    venue: "East Hotel Miami Rooftop",
    neighborhood: "Brickell",
    city: "Miami",
    imageUrl: "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=800&q=80",
    category: "Nightlife",
    sourceType: "mock",
    price: "$15",
  },
  {
    id: "fallback-5",
    name: "Miami Food & Wine Festival",
    date: "2026-06-14T12:00:00",
    venue: "South Beach",
    neighborhood: "South Beach",
    city: "Miami",
    imageUrl: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&q=80",
    category: "Food & Drink",
    sourceType: "mock",
    price: "$65",
  },
  {
    id: "fallback-6",
    name: "Beach Volleyball Tournament",
    date: "2026-06-15T09:00:00",
    venue: "Lummus Park",
    neighborhood: "South Beach",
    city: "Miami",
    imageUrl: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?auto=format&fit=crop&w=800&q=80",
    category: "Outdoor",
    sourceType: "mock",
    price: "Free",
  },
  {
    id: "fallback-7",
    name: "Latin Night at E11EVEN",
    date: "2026-06-20T23:00:00",
    venue: "E11EVEN Miami",
    neighborhood: "Downtown",
    city: "Miami",
    imageUrl: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80",
    category: "Nightlife",
    sourceType: "mock",
    price: "$30",
  },
  {
    id: "fallback-8",
    name: "Comedy Night at the Adrienne",
    date: "2026-06-21T20:00:00",
    venue: "Adrienne Arsht Center",
    neighborhood: "Edgewater",
    city: "Miami",
    imageUrl: "https://images.unsplash.com/photo-1585699324551-f6c309eedeca?auto=format&fit=crop&w=800&q=80",
    category: "Arts",
    sourceType: "mock",
    price: "$20–$40",
  },
];

// Re-date each entry onto the next 8 days (keeping the original time of day)
// so fallback content is always upcoming, never expired.
export const FALLBACK_EVENTS: FallbackEvent[] = RAW_FALLBACK_EVENTS.map((event, index) => {
  const target = new Date();
  target.setDate(target.getDate() + index + 1);
  const time = event.date.slice(10); // "T21:00:00"
  const day = target.toISOString().slice(0, 10);
  return { ...event, date: `${day}${time}` };
});

export type EventContext = {
  sourceId: string;
  interestedCount: number;
  friendInterestedUsers: FriendPerson[];
  planCount: number;
  myPlan: FriendPlan | null;
  joinablePlans: FriendPlan[];
  myInterestStatus: "interested" | "saved" | null;
};

export function getEventContexts(userId: string, sourceIds: string[]) {
  const uniqueIds = [...new Set(sourceIds.filter(Boolean))];
  if (!uniqueIds.length) {
    return Promise.resolve({ contexts: [], bySourceId: {} as Record<string, EventContext> });
  }
  return customFetch<{ contexts: EventContext[]; bySourceId: Record<string, EventContext> }>(
    `/api/events/context/${userId}?sourceIds=${encodeURIComponent(uniqueIds.join(","))}`,
  );
}

export function toggleEventInterest(input: {
  userId: string;
  sourceId: string;
  sourceType?: "ticketmaster" | "eventbrite" | "posh" | "mlb" | "mock";
  eventName: string;
  eventStartDate: string;
  status?: "interested" | "saved";
}) {
  return customFetch<{ interest: unknown | null; status: "interested" | "saved" | null }>("/api/events/interest/toggle", {
    method: "POST",
    body: JSON.stringify({
      status: "interested",
      ...input,
    }),
  });
}
