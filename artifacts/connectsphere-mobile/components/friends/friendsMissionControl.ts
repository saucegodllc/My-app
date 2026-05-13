import type { FriendPerson, FriendPlan, FriendRequest, FriendStory } from "@/services/friendsApi";
import { connectLabel, firstName, planVenue, planWhen } from "./friendsLabels";

export type TodayCommand =
  | { kind: "request"; label: string; title: string; reason: string; primaryLabel: string; request: FriendRequest }
  | { kind: "plan"; label: string; title: string; reason: string; primaryLabel: string; plan: FriendPlan }
  | { kind: "person"; label: string; title: string; reason: string; primaryLabel: string; person: FriendPerson }
  | { kind: "signal"; label: string; title: string; reason: string; primaryLabel: string; story: FriendStory }
  | { kind: "create_plan"; label: string; title: string; reason: string; primaryLabel: string };

function isPlanJoin(request: FriendRequest) {
  return request.requestType === "plan_join" || request.kind === "plan_join";
}

function incomingRequest(request: FriendRequest) {
  return request.direction === "incoming";
}

function isLiveishPlan(plan: FriendPlan) {
  const time = new Date(plan.scheduledAt ?? plan.createdAt).getTime();
  return Number.isFinite(time) && time >= Date.now() - 90 * 60 * 1000;
}

function isJoinablePlan(plan: FriendPlan) {
  return plan.joinRequestStatus == null && plan.isMember !== true && plan.isCreator !== true && isLiveishPlan(plan);
}

export function selectTodayCommand(input: {
  people: FriendPerson[];
  requests: FriendRequest[];
  plans: FriendPlan[];
  planFeed: FriendPlan[];
  stories: FriendStory[];
}): TodayCommand {
  const incoming = input.requests.find((request) => incomingRequest(request));
  if (incoming) {
    const actor = incoming.fromUser?.name ?? "Someone";
    return {
      kind: "request",
      label: isPlanJoin(incoming) ? "Plan request" : "Needs reply",
      title: isPlanJoin(incoming) ? `${firstName(actor)} wants to join` : `Accept ${firstName(actor)}?`,
      reason: incoming.plan?.title ?? incoming.message ?? "They want to connect with you.",
      primaryLabel: isPlanJoin(incoming) ? "Review" : "Accept",
      request: incoming,
    };
  }

  const upcomingPlan = input.plans.find((plan) => !!plan.chatId && isLiveishPlan(plan));
  if (upcomingPlan) {
    return {
      kind: "plan",
      label: "Upcoming plan",
      title: upcomingPlan.title,
      reason: `${planWhen(upcomingPlan)} at ${planVenue(upcomingPlan)}.`,
      primaryLabel: "Open Connect",
      plan: upcomingPlan,
    };
  }

  const smartPerson =
    input.people.find((person) => person.relationshipStatus === "incoming") ??
    input.people.find((person) => person.relationshipStatus === "none");
  if (smartPerson) {
    const reason =
      smartPerson.smartReason ??
      smartPerson.compatibility?.signals?.slice(0, 2).join(" • ") ??
      "Good local fit.";
    return {
      kind: "person",
      label: "Best next move",
      title: `${firstName(smartPerson.name)} looks like a fit`,
      reason,
      primaryLabel: connectLabel(smartPerson),
      person: smartPerson,
    };
  }

  const joinablePlan = input.planFeed.find((plan) => isJoinablePlan(plan));
  if (joinablePlan) {
    return {
      kind: "plan",
      label: "Plan nearby",
      title: joinablePlan.title,
      reason: `${planWhen(joinablePlan)} at ${planVenue(joinablePlan)}.`,
      primaryLabel: "Request Join",
      plan: joinablePlan,
    };
  }

  const story = input.stories.find((item) => !item.isOwn);
  if (story) {
    return {
      kind: "signal",
      label: "Live signal",
      title: story.text ?? "Someone is open to plans",
      reason: `${firstName(story.user?.name)} posted a lightweight friend signal.`,
      primaryLabel: "Reply",
      story,
    };
  }

  return {
    kind: "create_plan",
    label: "Start something",
    title: "Make a friend plan",
    reason: "Pick a place, time, and invite someone low-pressure.",
    primaryLabel: "Create Plan",
  };
}
