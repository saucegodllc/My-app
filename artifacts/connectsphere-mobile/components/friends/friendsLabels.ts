import type { FriendPerson, FriendPlan, FriendRequest, FriendStory } from "@/services/friendsApi";

export function firstName(name?: string) {
  return (name ?? "Someone").split(" ")[0] || "Someone";
}

export function titleTag(value?: string) {
  return (value ?? "")
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function personLocation(person: Pick<FriendPerson, "location" | "neighborhood" | "city">) {
  return person.location ?? person.neighborhood ?? person.city ?? "Miami";
}

export function connectLabel(person: Pick<FriendPerson, "relationshipStatus">) {
  if (person.relationshipStatus === "friends") return "Message";
  if (person.relationshipStatus === "requested") return "Requested";
  if (person.relationshipStatus === "incoming") return "Accept";
  return "Connect";
}

export function requestKindLabel(request: FriendRequest) {
  if (request.requestType === "plan_join" || request.kind === "plan_join") return "Plan join";
  if (request.kind === "plan_invite") return "Plan invite";
  if (request.kind === "story_reply") return "Moment reply";
  return "Friend request";
}

export function planVenue(plan: FriendPlan) {
  return plan.sourceName ?? plan.location ?? "Miami";
}

export function planWhen(plan: FriendPlan) {
  return plan.timeLabel ?? plan.time ?? "Soon";
}

export function signalTitle(story: FriendStory) {
  if (story.type === "plan_invite") return story.planType ? `${story.planType} plan` : "Open plan";
  if (story.type === "photo") return "Out now";
  return "Friend signal";
}
