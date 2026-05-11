import { customFetch } from "@workspace/api-client-react";
import type { FriendPerson, FriendPlan } from "@/services/friendsApi";

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
  sourceType?: "ticketmaster" | "eventbrite" | "posh" | "mock";
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
