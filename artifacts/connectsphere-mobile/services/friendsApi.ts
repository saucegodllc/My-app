import { customFetch } from "@workspace/api-client-react";

export type RelationshipStatus = "none" | "requested" | "incoming" | "friends" | "self";

export type FriendPerson = {
  id: string;
  name: string;
  age?: number;
  city?: string;
  neighborhood?: string;
  location?: string;
  photoUrl?: string;
  interests?: string[];
  activityStyle?: string[];
  energy?: string;
  activeTonight?: boolean;
  accessibility?: string[];
  safety?: string[];
  familyFriendly?: boolean;
  lgbtqFriendly?: boolean;
  mutualConnections?: string[];
  statusBadge?: string;
  relationshipStatus: RelationshipStatus;
  requestId?: string;
  chatId?: string;
  sharedInterests?: string[];
  compatibility?: {
    score: number;
    signals: string[];
    sharedInterests: string[];
    sharedActivity: string[];
  };
  planSuggestions?: Array<{ type: string; reason: string }>;
  smartReason?: string;
  suggestedPlanType?: string;
  suggestedPlanReason?: string;
  blocked?: boolean;
};

export type FriendRequest = {
  requestType?: "friend" | "plan_join";
  id: string;
  fromUserId: string;
  toUserId: string;
  direction?: "incoming" | "outgoing";
  status: "pending" | "accepted" | "ignored" | "declined" | "canceled";
  message?: string;
  kind?: "friend" | "story_reply" | "plan_invite" | "plan_join";
  planId?: string;
  storyId?: string;
  createdAt: string;
  fromUser: FriendPerson;
  toUser?: FriendPerson;
  plan?: FriendPlan | null;
  sharedInterests?: string[];
};

export type FriendPlan = {
  id: string;
  creatorId?: string;
  creatorUserId?: string;
  title: string;
  type: string;
  time?: string;
  timeLabel?: string;
  scheduledAt?: string;
  location?: string;
  visibility?: "friends_nearby";
  sourceType?: "map" | "event" | "custom";
  sourceId?: string;
  sourceName?: string;
  sourceImageUrl?: string;
  latitude?: number;
  longitude?: number;
  chatId?: string;
  createdAt: string;
  peopleGoing?: number;
  isCreator?: boolean;
  isMember?: boolean;
  joinRequestStatus?: "pending" | "accepted" | "declined" | "canceled" | null;
  joinRequestId?: string;
  creator?: FriendPerson;
  members?: Array<{ id: string; planId: string; userId: string; role: string; user?: FriendPerson }>;
  lastMessage?: { id: string; text: string; createdAt: string; system?: boolean };
};

export type PlanLocationOption = {
  id: string;
  sourceType: "map" | "event" | "custom";
  name: string;
  subtitle?: string;
  imageUrl?: string;
  latitude?: number;
  longitude?: number;
  startDate?: string;
};

export type FriendStory = {
  id: string;
  userId: string;
  type: "status" | "photo" | "plan_invite";
  text?: string;
  imageUrl?: string;
  planType?: string;
  planId?: string;
  expiresAt: string;
  createdAt: string;
  user: FriendPerson;
  relationshipStatus: RelationshipStatus;
  isOwn?: boolean;
  reactions?: Array<{ id: string; reaction: string; userId: string; createdAt: string }>;
};

export type FriendIcebreakerKind = "person" | "story" | "request" | "plan" | "chat";

export type FriendIcebreakerSuggestion = {
  id: string;
  text: string;
  reason: string;
};

export type FriendIcebreakerInput = {
  userId: string;
  kind: FriendIcebreakerKind;
  targetUserId?: string;
  storyId?: string;
  requestId?: string;
  planId?: string;
  chatId?: string;
};

export function getFriendPeople(userId: string, query?: string) {
  const suffix = query?.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
  return customFetch<{ people: FriendPerson[] }>(`/api/friends/people/${userId}${suffix}`);
}

export function sendFriendRequest(fromUserId: string, toUserId: string, extras?: { message?: string; kind?: string; planId?: string; storyId?: string }) {
  return customFetch<{ request: FriendRequest | null; relationshipStatus: RelationshipStatus; chat?: { id: string } }>("/api/friends/request", {
    method: "POST",
    body: JSON.stringify({ fromUserId, toUserId, ...extras }),
  });
}

export function respondFriendRequest(requestId: string, action: "accept" | "ignore") {
  return customFetch<{ request: FriendRequest; connection?: unknown; chat?: { id: string } }>("/api/friends/request/respond", {
    method: "POST",
    body: JSON.stringify({ requestId, action }),
  });
}

export function cancelFriendRequest(requestId: string, userId: string) {
  return customFetch<{ request: FriendRequest }>("/api/friends/request/cancel", {
    method: "POST",
    body: JSON.stringify({ requestId, userId }),
  });
}

export function getFriendRequests(userId: string) {
  return customFetch<{ requests: FriendRequest[] }>(`/api/friends/requests/${userId}`);
}

export function getFriendPlans(userId: string) {
  return customFetch<{ plans: FriendPlan[] }>(`/api/friends/plans/${userId}`);
}

export function getFriendPlansFeed(userId: string) {
  return customFetch<{ plans: FriendPlan[] }>(`/api/friends/plans/feed/${userId}`);
}

export function createFriendPlan(input: {
  creatorId: string;
  title: string;
  type: string;
  time?: string;
  timeLabel?: string;
  scheduledAt?: string;
  location?: string;
  sourceType?: "map" | "event" | "custom";
  sourceId?: string;
  sourceName?: string;
  sourceImageUrl?: string;
  latitude?: number;
  longitude?: number;
  invitedUserIds?: string[];
}) {
  return customFetch<{ plan: FriendPlan; chat: { id: string } }>("/api/friends/plans/create", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function joinFriendPlan(userId: string, planId: string) {
  return customFetch<{ plan: FriendPlan; chat: { id: string } }>("/api/friends/plans/join", {
    method: "POST",
    body: JSON.stringify({ userId, planId }),
  });
}

export function requestJoinFriendPlan(userId: string, planId: string) {
  return customFetch<{ plan: FriendPlan; request: unknown; status: "pending" | "joined"; chat?: { id: string } }>("/api/friends/plans/request-join", {
    method: "POST",
    body: JSON.stringify({ userId, planId }),
  });
}

export function sharePlanLink(planId: string, userId: string) {
  return customFetch<{
    token: string;
    planId: string;
    url: string;
    reused: boolean;
  }>("/api/friends/plans/share-link", {
    method: "POST",
    body: JSON.stringify({ planId, userId }),
  });
}

export function rsvpPlanViaLink(token: string, userId: string) {
  return customFetch<{
    plan: FriendPlan;
    chat: { id: string } | null;
    joinedViaLink: true;
    isFirstJoinForThisUser: boolean;
    alreadyMember?: boolean;
  }>("/api/friends/plans/rsvp-link", {
    method: "POST",
    body: JSON.stringify({ token, userId }),
  });
}

export function revokePlanShareLink(token: string, userId: string) {
  return customFetch<{ token: string; revokedAt: string }>("/api/friends/plans/share-link/revoke", {
    method: "POST",
    body: JSON.stringify({ token, userId }),
  });
}

export function respondPlanJoinRequest(requestId: string, creatorId: string, action: "accept" | "decline") {
  return customFetch<{ request: unknown; plan: FriendPlan; chat?: { id: string } }>("/api/friends/plans/respond-join", {
    method: "POST",
    body: JSON.stringify({ requestId, creatorId, action }),
  });
}

export function cancelPlanJoinRequest(requestId: string, userId: string) {
  return customFetch<{ request: unknown; plan: FriendPlan | null }>("/api/friends/plans/cancel-join", {
    method: "POST",
    body: JSON.stringify({ requestId, userId }),
  });
}

export function blockFriendUser(userId: string, blockedUserId: string) {
  return customFetch<{ block: unknown }>("/api/friends/block", {
    method: "POST",
    body: JSON.stringify({ userId, blockedUserId }),
  });
}

export function reportFriendUser(userId: string, reportedUserId: string, extras?: { reason?: string; context?: string }) {
  return customFetch<{ report: unknown }>("/api/friends/report", {
    method: "POST",
    body: JSON.stringify({ userId, reportedUserId, ...extras }),
  });
}

export async function getPlanLocationOptions() {
  const [venuesResult, eventsResult] = await Promise.allSettled([
    customFetch<{ venues: any[] }>("/api/venues?lat=25.7617&lng=-80.1918&radius=15000"),
    customFetch<{ events: any[] }>("/api/events?page=1"),
  ]);
  const venues =
    venuesResult.status === "fulfilled"
      ? (venuesResult.value.venues ?? []).slice(0, 12).map((venue: any) => ({
          id: String(venue.id),
          sourceType: "map" as const,
          name: String(venue.name ?? "Place"),
          subtitle: String(venue.address ?? venue.category ?? "Miami"),
          imageUrl: venue.photoUrl,
          latitude: typeof venue.latitude === "number" ? venue.latitude : undefined,
          longitude: typeof venue.longitude === "number" ? venue.longitude : undefined,
        }))
      : [];
  const events =
    eventsResult.status === "fulfilled"
      ? (eventsResult.value.events ?? []).slice(0, 80).map((event: any) => ({
          id: String(event.id),
          sourceType: "event" as const,
          name: String(event.name ?? "Event"),
          subtitle: String(event.venueName ?? event.neighborhood ?? "Miami"),
          imageUrl: event.imageUrl,
          latitude: typeof event.latitude === "number" ? event.latitude : undefined,
          longitude: typeof event.longitude === "number" ? event.longitude : undefined,
          startDate: event.startDate,
        }))
      : [];
  return { venues: venues as PlanLocationOption[], events: events as PlanLocationOption[] };
}

export function getFriendStories(userId: string) {
  return customFetch<{ stories: FriendStory[] }>(`/api/friends/stories/${userId}`);
}

export function createFriendStory(input: {
  userId: string;
  type: "status" | "photo" | "plan_invite";
  text?: string;
  imageUrl?: string;
  planType?: string;
  time?: string;
  location?: string;
}) {
  return customFetch<{ story: FriendStory }>("/api/friends/stories/create", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function reactToFriendStory(userId: string, storyId: string, reaction = "spark") {
  return customFetch<{ reaction: unknown }>("/api/friends/stories/react", {
    method: "POST",
    body: JSON.stringify({ userId, storyId, reaction }),
  });
}

export function replyToFriendStory(userId: string, storyId: string, text: string) {
  return customFetch<{ mode: "chat" | "request"; chat?: { id: string }; request?: FriendRequest; message?: unknown }>("/api/friends/stories/reply", {
    method: "POST",
    body: JSON.stringify({ userId, storyId, text }),
  });
}

export function generateFriendIcebreakers(input: FriendIcebreakerInput) {
  return customFetch<{ suggestions: FriendIcebreakerSuggestion[] }>("/api/friends/icebreakers/generate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function sendFriendIcebreaker(input: FriendIcebreakerInput & { text: string }) {
  return customFetch<{
    mode: "request" | "chat" | "plan";
    request?: FriendRequest;
    chat?: { id: string };
    message?: unknown;
    plan?: FriendPlan;
  }>("/api/friends/icebreakers/send", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
