import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { getAuth } from "@clerk/express";
import { Router } from "express";
import { generateFriendIcebreakers, type FriendIcebreakerContext } from "../lib/friendsIcebreakers";

type FriendUser = {
  id: string;
  name: string;
  city: string;
  neighborhood: string;
  age?: number;
  photoUrl?: string;
  interests: string[];
  activityStyle: string[];
  energy: string;
  activeTonight?: boolean;
  accessibility: string[];
  safety: string[];
  familyFriendly: boolean;
  lgbtqFriendly: boolean;
  mutualConnections: string[];
};

type FriendPost = {
  id: string;
  userId: string;
  text: string;
  tag: string;
  imageUrl?: string;
  createdAt: string;
};

type ConnectionRequest = {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: "pending" | "accepted" | "ignored" | "canceled";
  message?: string;
  storyId?: string;
  planId?: string;
  kind?: "friend" | "story_reply" | "plan_invite" | "plan_join";
  createdAt: string;
};

type Plan = {
  id: string;
  creatorUserId?: string;
  creatorId?: string;
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
  invitedUserIds?: string[];
  chatId?: string;
  createdAt: string;
};

type Chat = {
  id: string;
  type?: "double_date" | "opportunity" | "plan" | "dating_match" | "friend_direct" | "friend_plan";
  participantIds?: string[];
  title?: string;
  planId?: string;
  createdAt: string;
  isGroup?: boolean;
  groupPromotedAt?: string;
};

type Message = {
  id: string;
  chatId: string;
  senderId?: string;
  senderUserId: string;
  text: string;
  createdAt: string;
  system?: boolean;
};

type UserBehavior = {
  userId: string;
  searches: string[];
  likedTags: string[];
  clickedTags: string[];
  interactedUserIds: string[];
};

type FriendStory = {
  id: string;
  userId: string;
  type: "status" | "photo" | "plan_invite";
  text?: string;
  imageUrl?: string;
  planType?: string;
  planId?: string;
  expiresAt: string;
  createdAt: string;
};

type PlanJoinRequest = {
  id: string;
  planId: string;
  fromUserId: string;
  creatorId: string;
  status: "pending" | "accepted" | "declined" | "canceled";
  createdAt: string;
};

type FriendReport = {
  id: string;
  userId: string;
  reportedUserId: string;
  reason?: string;
  context?: string;
  createdAt: string;
};

type FriendsDb = {
  users: FriendUser[];
  friendPosts: FriendPost[];
  postComments: Array<{ id: string; postId: string; userId: string; text: string; createdAt: string }>;
  postLikes: Array<{ id: string; postId: string; userId: string; createdAt: string }>;
  connectionRequests: ConnectionRequest[];
  connections: Array<{ id: string; userAId: string; userBId: string; userIds?: [string, string]; chatId?: string; createdAt: string }>;
  plans: Plan[];
  planMembers: Array<{ id: string; planId: string; userId: string; role: string }>;
  chats: Chat[];
  chatMembers: Array<{ id: string; chatId: string; userId: string }>;
  messages: Message[];
  userBehavior: UserBehavior[];
  friendStories?: FriendStory[];
  friendStoryReactions?: Array<{ id: string; storyId: string; userId: string; reaction: string; createdAt: string }>;
  planJoinRequests?: PlanJoinRequest[];
  userReports?: FriendReport[];
  datingMatches?: Array<{ id: string; userAId: string; userBId: string; createdAt: string; shotId?: string }>;
  doubleDatePairs?: Array<{ id: string; userIds: [string, string]; createdBy: string; status: "active" | "paused"; vibeTags: string[]; createdAt: string }>;
  doubleDateLikes?: Array<{ id: string; fromPairId: string; toPairId: string; type: "like" | "spark" | "shot"; createdAt: string }>;
  doubleDatePasses?: Array<{ id: string; fromPairId: string; toPairId: string; createdAt: string }>;
  doubleDateMatches?: Array<{ id: string; pairIds: [string, string]; userIds: [string, string, string, string]; chatId: string; createdAt: string }>;
  blockedUsers?: Array<{ id: string; userId: string; blockedUserId: string; createdAt: string }>;
  planShareLinks?: Array<{
    id: string;
    planId: string;
    token: string;
    createdByUserId: string;
    createdAt: string;
    revokedAt?: string;
  }>;
  planShareLinkRedemptions?: Array<{
    id: string;
    token: string;
    planId: string;
    userId: string;
    createdAt: string;
  }>;
};

const router = Router();
const workspaceRoot = process.cwd().endsWith(join("artifacts", "api-server"))
  ? join(process.cwd(), "..", "..")
  : process.cwd();
const dbPath = join(workspaceRoot, "artifacts", "api-server", "db.json");

const seedUsers: FriendUser[] = [
  {
    id: "user-maya",
    name: "Maya Johnson",
    city: "Miami",
    neighborhood: "Brickell",
    interests: ["coffee", "design", "brunch", "walks"],
    activityStyle: ["low-pressure", "after-work", "small-group"],
    energy: "Exploring Miami",
    accessibility: ["accessible seating", "low-noise"],
    safety: ["public places", "group-friendly"],
    familyFriendly: false,
    lgbtqFriendly: true,
    mutualConnections: ["Ari", "Dev"],
  },
  {
    id: "user-omar",
    name: "Omar Ellis",
    city: "Miami",
    neighborhood: "Wynwood",
    interests: ["gym", "food", "music", "nightlife"],
    activityStyle: ["active", "evening", "group"],
    energy: "Looking for Plans",
    accessibility: ["step-free venues"],
    safety: ["public places"],
    familyFriendly: false,
    lgbtqFriendly: true,
    mutualConnections: ["Maya"],
  },
  {
    id: "user-nina",
    name: "Nina Patel",
    city: "Miami",
    neighborhood: "Coral Gables",
    interests: ["family plans", "parks", "learning", "food"],
    activityStyle: ["daytime", "calm", "planned"],
    energy: "Chill Mode",
    accessibility: ["accessible seating", "low-noise", "shade"],
    safety: ["family-friendly", "public places"],
    familyFriendly: true,
    lgbtqFriendly: true,
    mutualConnections: [],
  },
];

function emptyDb(): FriendsDb {
  return {
    users: seedUsers,
    friendPosts: [
      {
        id: "post-seed-coffee",
        userId: "user-maya",
        text: "Down for an iced latte and a walk by the water around 6.",
        tag: "Coffee",
        createdAt: new Date().toISOString(),
      },
      {
        id: "post-seed-gym",
        userId: "user-omar",
        text: "Looking for a gym-to-food crew this weekend.",
        tag: "Gym",
        createdAt: new Date().toISOString(),
      },
    ],
    postComments: [],
    postLikes: [],
    connectionRequests: [],
    connections: [],
    plans: [],
    planMembers: [],
    chats: [],
    chatMembers: [],
    messages: [],
    userBehavior: [],
    friendStories: [],
    friendStoryReactions: [],
    planJoinRequests: [],
    userReports: [],
  };
}

function readDb(): FriendsDb {
  if (!existsSync(dbPath)) {
    const initial = emptyDb();
    writeDb(initial);
    return initial;
  }

  const parsed = JSON.parse(readFileSync(dbPath, "utf8")) as Partial<FriendsDb>;
  const base = emptyDb();
  return {
    ...base,
    ...parsed,
    users: parsed.users ?? base.users,
    friendPosts: parsed.friendPosts ?? [],
    postComments: parsed.postComments ?? [],
    postLikes: parsed.postLikes ?? [],
    connectionRequests: parsed.connectionRequests ?? [],
    connections: parsed.connections ?? [],
    plans: parsed.plans ?? [],
    planMembers: parsed.planMembers ?? [],
    chats: parsed.chats ?? [],
    chatMembers: parsed.chatMembers ?? [],
    messages: parsed.messages ?? [],
    userBehavior: parsed.userBehavior ?? [],
    friendStories: parsed.friendStories ?? [],
    friendStoryReactions: parsed.friendStoryReactions ?? [],
    planJoinRequests: parsed.planJoinRequests ?? [],
    userReports: parsed.userReports ?? [],
    datingMatches: parsed.datingMatches ?? [],
    doubleDatePairs: parsed.doubleDatePairs ?? [],
    doubleDateLikes: parsed.doubleDateLikes ?? [],
    doubleDatePasses: parsed.doubleDatePasses ?? [],
    doubleDateMatches: parsed.doubleDateMatches ?? [],
    blockedUsers: parsed.blockedUsers ?? [],
    planShareLinks: parsed.planShareLinks ?? [],
    planShareLinkRedemptions: parsed.planShareLinkRedemptions ?? [],
  };
}

function writeDb(db: FriendsDb) {
  mkdirSync(dirname(dbPath), { recursive: true });
  writeFileSync(dbPath, `${JSON.stringify(db, null, 2)}\n`);
}

function arrayOverlap(a: string[], b: string[]) {
  const normalized = new Set(a.map((item) => item.toLowerCase()));
  return b.filter((item) => normalized.has(item.toLowerCase()));
}

export function calculateCompatibility(viewer: FriendUser, candidate: FriendUser, behavior?: UserBehavior) {
  const sharedInterests = arrayOverlap(viewer.interests, candidate.interests);
  const sharedActivity = arrayOverlap(viewer.activityStyle, candidate.activityStyle);
  const sharedAccess = arrayOverlap(viewer.accessibility, candidate.accessibility);
  const sameNeighborhood = viewer.neighborhood === candidate.neighborhood;
  const safetyOverlap = arrayOverlap(viewer.safety, candidate.safety);
  const behaviorLift = behavior?.likedTags.some((tag) => candidate.interests.includes(tag.toLowerCase())) ? 12 : 0;

  const score =
    sharedInterests.length * 14 +
    sharedActivity.length * 10 +
    sharedAccess.length * 10 +
    safetyOverlap.length * 8 +
    candidate.mutualConnections.length * 7 +
    (sameNeighborhood ? 18 : 0) +
    (viewer.lgbtqFriendly && candidate.lgbtqFriendly ? 6 : 0) +
    (viewer.familyFriendly === candidate.familyFriendly ? 5 : 0) +
    behaviorLift;

  const signals = [
    sharedInterests.length ? "Similar interests" : "You'd probably get along",
    sharedActivity.length ? "Same energy" : "Easy plan style",
    sameNeighborhood ? `Also active around ${candidate.neighborhood}` : "Your kind of people",
    sharedAccess.length ? "Similar accessibility preferences" : "Plan-friendly",
  ];

  return { score, signals, sharedInterests, sharedActivity };
}

export function getPlanSuggestions(viewer: FriendUser, candidate: FriendUser) {
  const overlap = arrayOverlap(viewer.interests, candidate.interests);
  const quiet = candidate.accessibility.includes("low-noise") || viewer.accessibility.includes("low-noise");
  const active = candidate.activityStyle.includes("active") || viewer.activityStyle.includes("active");

  return [
    { type: "Coffee", reason: overlap.includes("coffee") ? "Coffee fits both of you." : "Easy first plan." },
    { type: "Gym", reason: active ? "Both show active energy." : "Good for a structured meetup." },
    { type: "Walk", reason: quiet ? "Low-noise and flexible." : "Simple neighborhood plan." },
    { type: "Brunch", reason: overlap.includes("food") ? "Both enjoy food plans." : "Weekend friendly." },
    { type: "Study", reason: quiet ? "Low-noise environment preferred." : "Useful shared focus time." },
  ];
}

export function getFriendActions(viewerId: string, candidateId: string, db: FriendsDb) {
  if (isBlocked(db, viewerId, candidateId)) {
    return {
      connect: "blocked",
      plan: "blocked",
    };
  }
  const request = db.connectionRequests.find(
    (item) =>
      ((item.fromUserId === viewerId && item.toUserId === candidateId) ||
        (item.fromUserId === candidateId && item.toUserId === viewerId)) &&
      item.status === "pending",
  );
  const connected = db.connections.some(
    (item) =>
      (item.userAId === viewerId && item.userBId === candidateId) ||
      (item.userAId === candidateId && item.userBId === viewerId),
  );

  return {
    connect: connected ? "message" : request ? "requested" : "connect",
    plan: connected ? "create" : "request-first",
  };
}

export function buildFriendsFeed(userId: string, db: FriendsDb) {
  const viewer = userProfile(db, userId);
  const behavior = db.userBehavior.find((item) => item.userId === userId);

  return db.friendPosts
    .filter((post) => post.userId === userId || !isBlocked(db, userId, post.userId))
    .map((post) => {
      const author = userProfile(db, post.userId);
      const compatibility = calculateCompatibility(viewer, author, behavior);
      return {
        ...post,
        author,
        compatibility,
        actions: getFriendActions(userId, author.id, db),
        planSuggestions: getPlanSuggestions(viewer, author),
      };
    })
    .sort((a, b) => b.compatibility.score - a.compatibility.score);
}

function authUserId(req: Parameters<typeof getAuth>[0], fallback?: string) {
  const { userId } = getAuth(req);
  return userId ?? fallback ?? "demo-user";
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function userProfile(db: FriendsDb, id: string) {
  const raw = db.users.find((user) => user.id === id);
  return {
    id,
    name: raw?.name ?? "Someone",
    city: raw?.city ?? "Miami",
    neighborhood: raw?.neighborhood ?? raw?.city ?? "Miami",
    age: raw?.age,
    photoUrl: raw?.photoUrl,
    interests: raw?.interests ?? [],
    activityStyle: raw?.activityStyle ?? [],
    energy: raw?.energy ?? "Ready for plans",
    activeTonight: raw?.activeTonight ?? false,
    accessibility: raw?.accessibility ?? [],
    safety: raw?.safety ?? [],
    familyFriendly: raw?.familyFriendly ?? false,
    lgbtqFriendly: raw?.lgbtqFriendly ?? true,
    mutualConnections: raw?.mutualConnections ?? [],
  };
}

function isBlocked(db: FriendsDb, userAId: string, userBId: string) {
  return (db.blockedUsers ?? []).some(
    (block) =>
      (block.userId === userAId && block.blockedUserId === userBId) ||
      (block.userId === userBId && block.blockedUserId === userAId),
  );
}

function areFriends(db: FriendsDb, userAId: string, userBId: string) {
  return db.connections.some((connection) => {
    const ids = connection.userIds ?? [connection.userAId, connection.userBId];
    return ids.includes(userAId) && ids.includes(userBId);
  });
}

function pendingRequestBetween(db: FriendsDb, userAId: string, userBId: string) {
  return db.connectionRequests.find(
    (request) =>
      request.status === "pending" &&
      ((request.fromUserId === userAId && request.toUserId === userBId) ||
        (request.fromUserId === userBId && request.toUserId === userAId)),
  );
}

function relationshipStatus(db: FriendsDb, viewerId: string, candidateId: string) {
  if (areFriends(db, viewerId, candidateId)) return "friends" as const;
  const pending = pendingRequestBetween(db, viewerId, candidateId);
  if (!pending) return "none" as const;
  return pending.fromUserId === viewerId ? ("requested" as const) : ("incoming" as const);
}

function ensureChatMember(db: FriendsDb, chatId: string, userId: string) {
  if (!db.chatMembers.some((member) => member.chatId === chatId && member.userId === userId)) {
    db.chatMembers.push({ id: randomUUID(), chatId, userId });
  }
}

// When chat membership crosses 3, flip the `isGroup` flag and post a one-time
// hype system message so the Connect tab can render a "group chat hype on"
// ribbon. Safe to call after every member add; runs at most once per chat.
function ensureGroupPromotion(db: FriendsDb, chatId: string) {
  const chat = db.chats.find((item) => item.id === chatId);
  if (!chat) return;
  const memberCount = db.chatMembers.filter((member) => member.chatId === chatId).length;
  if (memberCount < 3 || chat.isGroup) return;
  chat.isGroup = true;
  chat.groupPromotedAt = new Date().toISOString();
  db.messages.push({
    id: randomUUID(),
    chatId,
    senderUserId: "system",
    text: "🎉 group chat hype on",
    createdAt: chat.groupPromotedAt,
    system: true,
  });
}

function findDirectChat(db: FriendsDb, userAId: string, userBId: string) {
  return db.chats.find((chat) => {
    const participantIds =
      chat.participantIds ??
      db.chatMembers.filter((member) => member.chatId === chat.id).map((member) => member.userId);
    return chat.type === "friend_direct" && participantIds.length === 2 && participantIds.includes(userAId) && participantIds.includes(userBId);
  });
}

function ensureDirectChat(db: FriendsDb, userAId: string, userBId: string) {
  const existing = findDirectChat(db, userAId, userBId);
  if (existing) {
    ensureChatMember(db, existing.id, userAId);
    ensureChatMember(db, existing.id, userBId);
    existing.participantIds = unique([...(existing.participantIds ?? []), userAId, userBId]);
    return existing;
  }

  const chat: Chat = {
    id: randomUUID(),
    type: "friend_direct",
    participantIds: unique([userAId, userBId]),
    title: `${userProfile(db, userAId).name} + ${userProfile(db, userBId).name}`,
    createdAt: new Date().toISOString(),
  };
  db.chats.push(chat);
  ensureChatMember(db, chat.id, userAId);
  ensureChatMember(db, chat.id, userBId);
  return chat;
}

function ensureConnection(db: FriendsDb, userAId: string, userBId: string) {
  const chat = ensureDirectChat(db, userAId, userBId);
  const existing = db.connections.find((connection) => {
    const ids = connection.userIds ?? [connection.userAId, connection.userBId];
    return ids.includes(userAId) && ids.includes(userBId);
  });
  if (existing) {
    existing.chatId = chat.id;
    existing.userIds = [userAId, userBId];
    return { connection: existing, chat };
  }

  const connection = {
    id: randomUUID(),
    userAId,
    userBId,
    userIds: [userAId, userBId] as [string, string],
    chatId: chat.id,
    createdAt: new Date().toISOString(),
  };
  db.connections.push(connection);
  return { connection, chat };
}

function ensurePendingRequest(db: FriendsDb, fromUserId: string, toUserId: string, extras?: Partial<ConnectionRequest>) {
  if (isBlocked(db, fromUserId, toUserId)) return null;
  const existing = pendingRequestBetween(db, fromUserId, toUserId);
  if (existing) {
    if (extras?.message) existing.message = extras.message;
    if (extras?.storyId) existing.storyId = extras.storyId;
    if (extras?.planId) existing.planId = extras.planId;
    if (extras?.kind) existing.kind = extras.kind;
    return existing;
  }

  const request: ConnectionRequest = {
    id: randomUUID(),
    fromUserId,
    toUserId,
    status: "pending",
    kind: extras?.kind ?? "friend",
    message: extras?.message,
    storyId: extras?.storyId,
    planId: extras?.planId,
    createdAt: new Date().toISOString(),
  };
  db.connectionRequests.push(request);
  return request;
}

function statusBadgeFor(user: ReturnType<typeof userProfile>) {
  const energy = user.energy.toLowerCase();
  if (user.activeTonight || energy.includes("active")) return "Active Now";
  if (energy.includes("miami") || energy.includes("exploring")) return "New to Miami";
  return "Looking for Plans";
}

function peopleCard(db: FriendsDb, viewerId: string, candidateId: string) {
  const viewer = userProfile(db, viewerId);
  const candidate = userProfile(db, candidateId);
  const pending = pendingRequestBetween(db, viewerId, candidateId);
  const chat = areFriends(db, viewerId, candidateId) ? ensureDirectChat(db, viewerId, candidateId) : undefined;
  const sharedInterests = arrayOverlap(viewer.interests, candidate.interests);
  const compatibility = calculateCompatibility(viewer, candidate, db.userBehavior.find((item) => item.userId === viewerId));
  const planSuggestions = getPlanSuggestions(viewer, candidate);
  const suggestedPlan = planSuggestions[0];
  return {
    ...candidate,
    location: candidate.neighborhood || candidate.city,
    statusBadge: statusBadgeFor(candidate),
    relationshipStatus: relationshipStatus(db, viewerId, candidateId),
    requestId: pending?.id,
    chatId: chat?.id,
    sharedInterests,
    compatibility,
    planSuggestions,
    smartReason: compatibility.signals.slice(0, 2).join(" • "),
    suggestedPlanType: suggestedPlan?.type,
    suggestedPlanReason: suggestedPlan?.reason,
    blocked: isBlocked(db, viewerId, candidateId),
  };
}

function lastMessageForChat(db: FriendsDb, chatId: string) {
  return db.messages
    .filter((message) => message.chatId === chatId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
}

function addChatMessage(db: FriendsDb, chatId: string, senderUserId: string, text: string, system = false) {
  const message: Message = {
    id: randomUUID(),
    chatId,
    senderId: senderUserId,
    senderUserId,
    text,
    createdAt: new Date().toISOString(),
    system,
  };
  db.messages.push(message);
  return message;
}

function icebreakerContextFromBody(db: FriendsDb, body: Record<string, unknown>, userId: string): FriendIcebreakerContext {
  const kind = String(body.kind ?? "person") as FriendIcebreakerContext["kind"];
  const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId : undefined;
  const storyId = typeof body.storyId === "string" ? body.storyId : undefined;
  const planId = typeof body.planId === "string" ? body.planId : undefined;
  const chatId = typeof body.chatId === "string" ? body.chatId : undefined;
  const target = targetUserId ? userProfile(db, targetUserId) : undefined;
  const story = storyId ? (db.friendStories ?? []).find((item) => item.id === storyId) : undefined;
  const storyUser = story ? userProfile(db, story.userId) : undefined;
  const plan = planId ? db.plans.find((item) => item.id === planId) : undefined;
  const chat = chatId ? db.chats.find((item) => item.id === chatId) : undefined;
  const otherChatUserId = chat?.participantIds?.find((id) => id !== userId);
  const otherChatUser = otherChatUserId ? userProfile(db, otherChatUserId) : undefined;
  const lastMessage = chatId ? lastMessageForChat(db, chatId)?.text : undefined;
  const person = target ?? storyUser ?? otherChatUser;
  return {
    kind,
    currentUserName: userProfile(db, userId).name,
    targetName: person?.name,
    interests: person?.interests,
    energy: person?.energy,
    location: person?.neighborhood ?? person?.city ?? plan?.location,
    storyText: story?.text,
    planTitle: plan?.title,
    planType: plan?.type,
    planLocation: plan?.sourceName ?? plan?.location,
    lastMessage,
  };
}

function createFriendPlanWithChat(
  db: FriendsDb,
  input: {
    creatorId: string;
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
    invitedUserIds?: string[];
  },
) {
  const createdAt = new Date().toISOString();
  const invitedUserIds = unique(input.invitedUserIds ?? []).filter((userId) => userId !== input.creatorId);
  const visibleInviteIds = invitedUserIds.filter((userId) => !isBlocked(db, input.creatorId, userId));
  const instantInviteIds = visibleInviteIds.filter((userId) => areFriends(db, input.creatorId, userId));
  const pendingInviteIds = visibleInviteIds.filter((userId) => !areFriends(db, input.creatorId, userId));
  const participantIds = unique([input.creatorId, ...instantInviteIds]);
  const plan: Plan = {
    id: randomUUID(),
    creatorId: input.creatorId,
    creatorUserId: input.creatorId,
    title: input.title || `${input.type} plan`,
    type: input.type || "Coffee",
    time: input.time,
    timeLabel: input.timeLabel ?? input.time,
    scheduledAt: input.scheduledAt,
    location: input.location,
    visibility: input.visibility ?? "friends_nearby",
    sourceType: input.sourceType ?? "custom",
    sourceId: input.sourceId,
    sourceName: input.sourceName,
    sourceImageUrl: input.sourceImageUrl,
    latitude: input.latitude,
    longitude: input.longitude,
    invitedUserIds: visibleInviteIds,
    createdAt,
  };
  const chat: Chat = {
    id: randomUUID(),
    type: "friend_plan",
    participantIds,
    title: plan.title,
    planId: plan.id,
    createdAt,
  };
  plan.chatId = chat.id;
  db.plans.push(plan);
  db.chats.push(chat);
  participantIds.forEach((userId) => {
    db.planMembers.push({ id: randomUUID(), planId: plan.id, userId, role: userId === input.creatorId ? "host" : "guest" });
    ensureChatMember(db, chat.id, userId);
  });
  ensureGroupPromotion(db, chat.id);
  const whenLabel = plan.timeLabel ?? plan.time ?? "soon";
  const sourceLabel = plan.sourceName ?? plan.location ?? plan.title;
  const sourceIcon =
    plan.sourceType === "event" ? "🎟" : plan.sourceType === "map" ? "📍" : "✨";
  const sourcePrefix =
    plan.sourceType === "event" ? "plan from" : plan.sourceType === "map" ? "plan at" : "plan";
  db.messages.push({
    id: randomUUID(),
    chatId: chat.id,
    senderUserId: input.creatorId,
    text: `${sourceIcon} ${sourcePrefix} ${sourceLabel} · ${whenLabel}`,
    createdAt,
    system: true,
  });
  pendingInviteIds.forEach((toUserId) => {
    ensurePendingRequest(db, input.creatorId, toUserId, {
      kind: "plan_invite",
      planId: plan.id,
      message: `Plan invite: ${plan.title}`,
    });
  });
  return { plan, chat };
}

function ensureMockPeopleStories(db: FriendsDb, viewerId: string) {
  const now = Date.now();
  db.friendStories = (db.friendStories ?? []).filter((story) => new Date(story.expiresAt).getTime() > now);
  const hasPeopleStories = db.friendStories.some((story) => story.userId !== viewerId);
  if (hasPeopleStories) return;

  const candidates = db.users.filter((user) => user.id !== viewerId && !isBlocked(db, viewerId, user.id)).slice(0, 4);
  const storySet: Array<{
    type: FriendStory["type"];
    text: string;
    planType?: string;
    location?: string;
  }> = [
    { type: "status", text: "Coffee later? Looking for one or two people to join.", planType: "Coffee", location: "Brickell" },
    { type: "photo", text: "Out in Wynwood tonight. Who wants to come?", planType: "Night Out", location: "Wynwood" },
    { type: "plan_invite", text: "Who wants to join a plan tonight?", planType: "Dinner", location: "Miami" },
    { type: "status", text: "Gym at 6, then smoothies.", planType: "Gym", location: "Downtown Miami" },
  ];

  candidates.forEach((user, index) => {
    const config = storySet[index % storySet.length]!;
    let planId: string | undefined;
    if (config.type === "plan_invite") {
      const { plan } = createFriendPlanWithChat(db, {
        creatorId: user.id,
        title: `${config.planType ?? "Plan"} with ${user.name.split(" ")[0]}`,
        type: config.planType ?? "Plan",
        time: "Tonight at 8:00 PM",
        timeLabel: "Tonight at 8:00 PM",
        scheduledAt: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
        location: config.location,
        visibility: "friends_nearby",
        sourceType: "map",
        sourceName: config.location,
        sourceImageUrl: user.photoUrl,
        invitedUserIds: [],
      });
      planId = plan.id;
    }
    db.friendStories!.push({
      id: randomUUID(),
      userId: user.id,
      type: config.type,
      text: config.text,
      imageUrl: user.photoUrl,
      planType: config.planType,
      planId,
      createdAt: new Date(Date.now() - index * 9 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
  });
}

function planSummary(db: FriendsDb, plan: Plan) {
  const members = db.planMembers.filter((member) => member.planId === plan.id);
  const chatId = plan.chatId ?? db.chats.find((chat) => chat.planId === plan.id)?.id;
  return {
    ...plan,
    creatorId: plan.creatorId ?? plan.creatorUserId,
    chatId,
    creator: userProfile(db, plan.creatorId ?? plan.creatorUserId ?? ""),
    members: members.map((member) => ({ ...member, user: userProfile(db, member.userId) })),
    peopleGoing: members.length,
    lastMessage: chatId ? lastMessageForChat(db, chatId) : undefined,
  };
}

function planFeedCard(db: FriendsDb, plan: Plan, viewerId: string) {
  const creatorId = plan.creatorId ?? plan.creatorUserId ?? "";
  const joinRequest = (db.planJoinRequests ?? []).find(
    (request) => request.planId === plan.id && request.fromUserId === viewerId && request.status === "pending",
  );
  const isMember = db.planMembers.some((member) => member.planId === plan.id && member.userId === viewerId);
  return {
    ...planSummary(db, plan),
    isCreator: creatorId === viewerId,
    isMember,
    joinRequestStatus: joinRequest?.status ?? null,
    joinRequestId: joinRequest?.id,
  };
}

function joinPlanAsMember(db: FriendsDb, plan: Plan, userId: string) {
  const creatorId = plan.creatorId ?? plan.creatorUserId ?? "";
  let chat = db.chats.find((item) => item.id === plan.chatId || item.planId === plan.id);
  if (!chat) {
    chat = {
      id: randomUUID(),
      type: "friend_plan",
      participantIds: unique([creatorId, userId]),
      title: plan.title,
      planId: plan.id,
      createdAt: new Date().toISOString(),
    };
    plan.chatId = chat.id;
    db.chats.push(chat);
  }
  if (!db.planMembers.some((member) => member.planId === plan.id && member.userId === userId)) {
    db.planMembers.push({ id: randomUUID(), planId: plan.id, userId, role: "guest" });
  }
  chat.participantIds = unique([...(chat.participantIds ?? []), creatorId, userId]);
  ensureChatMember(db, chat.id, creatorId);
  ensureChatMember(db, chat.id, userId);
  ensureGroupPromotion(db, chat.id);
  return chat;
}

function requestSummary(db: FriendsDb, viewerId: string, request: ConnectionRequest) {
  const fromUser = userProfile(db, request.fromUserId);
  const toUser = userProfile(db, request.toUserId);
  const otherUser = request.fromUserId === viewerId ? toUser : fromUser;
  const viewer = userProfile(db, viewerId);
  const plan = request.planId ? db.plans.find((item) => item.id === request.planId) : undefined;
  return {
    requestType: "friend",
    ...request,
    direction: request.fromUserId === viewerId ? "outgoing" : "incoming",
    fromUser,
    toUser,
    plan: plan ? planSummary(db, plan) : null,
    sharedInterests: arrayOverlap(viewer.interests, otherUser.interests),
  };
}

function requestVisibleToViewer(db: FriendsDb, viewerId: string, request: ConnectionRequest) {
  const otherUserId = request.fromUserId === viewerId ? request.toUserId : request.fromUserId;
  return !isBlocked(db, viewerId, otherUserId);
}

function planJoinRequestVisibleToViewer(db: FriendsDb, viewerId: string, request: PlanJoinRequest) {
  const otherUserId = request.fromUserId === viewerId ? request.creatorId : request.fromUserId;
  return !isBlocked(db, viewerId, otherUserId);
}

function planJoinRequestSummary(db: FriendsDb, viewerId: string, request: PlanJoinRequest) {
  const plan = db.plans.find((item) => item.id === request.planId);
  return {
    requestType: "plan_join",
    id: request.id,
    fromUserId: request.fromUserId,
    toUserId: request.creatorId,
    status: request.status,
    kind: "plan_join",
    direction: request.fromUserId === viewerId ? "outgoing" : "incoming",
    createdAt: request.createdAt,
    fromUser: userProfile(db, request.fromUserId),
    toUser: userProfile(db, request.creatorId),
    plan: plan ? planSummary(db, plan) : null,
  };
}

router.get("/friends/people/:userId", (req, res) => {
  const db = readDb();
  const userId = req.params.userId;
  const query = String(req.query.q ?? "").trim().toLowerCase();
  const people = db.users
    .filter((user) => user.id !== userId)
    .filter((user) => !isBlocked(db, userId, user.id))
    .map((user) => peopleCard(db, userId, user.id))
    .filter((person) => {
      if (!query) return true;
      return [person.name, person.city, person.neighborhood, person.energy, ...(person.interests ?? [])]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    })
    .sort((a, b) => {
      const statusBoost = (status: string) => (status === "incoming" ? 300 : status === "friends" ? 120 : status === "none" ? 80 : 20);
      const activeBoost = (person: ReturnType<typeof peopleCard>) => (person.activeTonight ? 30 : 0);
      return statusBoost(b.relationshipStatus) + activeBoost(b) + b.compatibility.score - (statusBoost(a.relationshipStatus) + activeBoost(a) + a.compatibility.score);
    });
  writeDb(db);
  res.json({ people });
});

router.post("/friends/request", (req, res) => {
  const db = readDb();
  const fromUserId = authUserId(req, req.body.fromUserId);
  const toUserId = String(req.body.toUserId ?? "");
  if (!toUserId) return res.status(400).json({ error: "toUserId is required" });
  if (fromUserId === toUserId) return res.status(400).json({ error: "Cannot send a request to yourself" });
  if (isBlocked(db, fromUserId, toUserId)) return res.status(403).json({ error: "This connection is blocked" });
  if (areFriends(db, fromUserId, toUserId)) {
    const chat = ensureDirectChat(db, fromUserId, toUserId);
    writeDb(db);
    return res.json({ request: null, relationshipStatus: "friends", chat, alreadyFriends: true });
  }

  // Mutual match: the other side already has a pending request to me. Auto-accept it.
  const existing = pendingRequestBetween(db, fromUserId, toUserId);
  if (existing && existing.fromUserId === toUserId && existing.toUserId === fromUserId) {
    existing.status = "accepted";
    const { connection, chat } = ensureConnection(db, existing.fromUserId, existing.toUserId);
    writeDb(db);
    return res.json({
      request: existing,
      relationshipStatus: "friends",
      connection,
      chat,
      mutual: true,
    });
  }

  // Idempotent: if a same-direction pending request already exists, return 200.
  const reused = !!existing;
  const request = ensurePendingRequest(db, fromUserId, toUserId, {
    kind: req.body.kind ?? "friend",
    message: typeof req.body.message === "string" ? req.body.message : undefined,
    planId: typeof req.body.planId === "string" ? req.body.planId : undefined,
    storyId: typeof req.body.storyId === "string" ? req.body.storyId : undefined,
  });
  if (!request) return res.status(403).json({ error: "This connection is blocked" });
  writeDb(db);
  return res.status(reused ? 200 : 201).json({
    request,
    relationshipStatus: relationshipStatus(db, fromUserId, toUserId),
    reused,
  });
});

router.post("/friends/request/cancel", (req, res) => {
  const db = readDb();
  const requestId = String(req.body.requestId ?? "");
  const userId = authUserId(req, req.body.userId);
  const request = db.connectionRequests.find((item) => item.id === requestId);
  if (!request) return res.status(404).json({ error: "Request not found" });
  if (request.fromUserId !== userId) return res.status(403).json({ error: "Only the sender can cancel this request" });
  if (request.status !== "pending") return res.status(409).json({ error: "Request is no longer pending" });
  request.status = "canceled";
  writeDb(db);
  return res.json({ request });
});

router.post("/friends/request/respond", (req, res) => {
  const db = readDb();
  const requestId = String(req.body.requestId ?? "");
  const action = String(req.body.action ?? "");
  const request = db.connectionRequests.find((item) => item.id === requestId);
  if (!request) return res.status(404).json({ error: "Request not found" });
  if (action === "ignore") {
    request.status = "ignored";
    writeDb(db);
    return res.json({ request });
  }
  if (action !== "accept") return res.status(400).json({ error: "action must be accept or ignore" });

  request.status = "accepted";
  const { connection, chat } = ensureConnection(db, request.fromUserId, request.toUserId);
  if (request.planId) {
    const plan = db.plans.find((item) => item.id === request.planId);
    if (plan) {
      const { chat: planChat } = { chat: db.chats.find((item) => item.id === plan.chatId || item.planId === plan.id) };
      if (!db.planMembers.some((member) => member.planId === plan.id && member.userId === request.toUserId)) {
        db.planMembers.push({ id: randomUUID(), planId: plan.id, userId: request.toUserId, role: "guest" });
      }
      if (planChat) {
        ensureChatMember(db, planChat.id, request.toUserId);
        ensureGroupPromotion(db, planChat.id);
      }
    }
  }
  writeDb(db);
  return res.json({ request, connection, chat });
});

router.get("/friends/requests/:userId", (req, res) => {
  const db = readDb();
  const userId = req.params.userId;
  const friendRequests = db.connectionRequests
    .filter((request) => request.status === "pending" && (request.toUserId === userId || request.fromUserId === userId))
    .filter((request) => requestVisibleToViewer(db, userId, request))
    .map((request) => requestSummary(db, userId, request));
  const planRequests = (db.planJoinRequests ?? [])
    .filter((request) => request.status === "pending" && (request.creatorId === userId || request.fromUserId === userId))
    .filter((request) => planJoinRequestVisibleToViewer(db, userId, request))
    .map((request) => planJoinRequestSummary(db, userId, request));
  const requests = [...planRequests, ...friendRequests].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ requests });
});

router.get("/friends/plans/:userId", (req, res) => {
  const db = readDb();
  const userId = req.params.userId;
  const plans = db.plans
    .filter((plan) => {
      const creatorId = plan.creatorId ?? plan.creatorUserId;
      if (creatorId && creatorId !== userId && isBlocked(db, userId, creatorId)) return false;
      return (
        creatorId === userId ||
        (plan.invitedUserIds ?? []).includes(userId) ||
        db.planMembers.some((member) => member.planId === plan.id && member.userId === userId)
      );
    })
    .map((plan) => planSummary(db, plan));
  res.json({ plans });
});

router.get("/friends/plans/feed/:userId", (req, res) => {
  const db = readDb();
  const userId = req.params.userId;
  const viewer = userProfile(db, userId);
  const plans = db.plans
    .filter((plan) => {
      const creatorId = plan.creatorId ?? plan.creatorUserId;
      if (!creatorId || creatorId === userId) return false;
      if (isBlocked(db, userId, creatorId)) return false;
      if (db.planMembers.some((member) => member.planId === plan.id && member.userId === userId)) return false;
      const creator = userProfile(db, creatorId);
      return plan.visibility === "friends_nearby" || areFriends(db, userId, creatorId) || creator.city === viewer.city;
    })
    .map((plan) => planFeedCard(db, plan, userId))
    .sort((a, b) => new Date(a.scheduledAt ?? a.createdAt).getTime() - new Date(b.scheduledAt ?? b.createdAt).getTime());
  res.json({ plans });
});

router.post("/friends/plans/create", (req, res) => {
  const db = readDb();
  const creatorId = authUserId(req, req.body.creatorId ?? req.body.creatorUserId);
  const invitedUserIds = unique([
    ...(Array.isArray(req.body.invitedUserIds) ? req.body.invitedUserIds.map(String) : []),
    typeof req.body.invitedUserId === "string" ? req.body.invitedUserId : "",
  ]);

  // Dedupe: if this creator already made a plan from the same source within the
  // last 6 hours, return the existing plan + chat instead of spawning a duplicate.
  const dedupeSourceType = String(req.body.sourceType ?? "");
  const dedupeSourceId = typeof req.body.sourceId === "string" ? req.body.sourceId : "";
  if (dedupeSourceId && (dedupeSourceType === "event" || dedupeSourceType === "map")) {
    const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
    const existing = db.plans.find((plan) => {
      const planCreator = plan.creatorId ?? plan.creatorUserId;
      const createdAtMs = plan.createdAt ? new Date(plan.createdAt).getTime() : 0;
      return (
        planCreator === creatorId &&
        plan.sourceType === dedupeSourceType &&
        plan.sourceId === dedupeSourceId &&
        createdAtMs >= sixHoursAgo
      );
    });
    if (existing) {
      const existingChat = db.chats.find(
        (chat) => chat.id === existing.chatId || chat.planId === existing.id,
      );
      if (existingChat) {
        return res.status(200).json({ plan: planSummary(db, existing), chat: existingChat, deduped: true });
      }
    }
  }

  const result = createFriendPlanWithChat(db, {
    creatorId,
    title: String(req.body.title ?? "New plan"),
    type: String(req.body.type ?? "Coffee"),
    time: typeof req.body.time === "string" ? req.body.time : undefined,
    timeLabel: typeof req.body.timeLabel === "string" ? req.body.timeLabel : undefined,
    scheduledAt: typeof req.body.scheduledAt === "string" ? req.body.scheduledAt : undefined,
    location: typeof req.body.location === "string" ? req.body.location : undefined,
    visibility: "friends_nearby",
    sourceType: ["map", "event", "custom"].includes(String(req.body.sourceType)) ? req.body.sourceType : "custom",
    sourceId: typeof req.body.sourceId === "string" ? req.body.sourceId : undefined,
    sourceName: typeof req.body.sourceName === "string" ? req.body.sourceName : undefined,
    sourceImageUrl: typeof req.body.sourceImageUrl === "string" ? req.body.sourceImageUrl : undefined,
    latitude: typeof req.body.latitude === "number" ? req.body.latitude : undefined,
    longitude: typeof req.body.longitude === "number" ? req.body.longitude : undefined,
    invitedUserIds,
  });
  writeDb(db);
  return res.status(201).json(result);
});

// Mint a tokenized share link for a plan. Anyone with the link can RSVP (Phase 4).
router.post("/friends/plans/share-link", (req, res) => {
  const db = readDb();
  const userId = authUserId(req, req.body.userId);
  const planId = String(req.body.planId ?? "");
  const plan = db.plans.find((item) => item.id === planId);
  if (!plan) return res.status(404).json({ error: "Plan not found" });
  const creatorId = plan.creatorId ?? plan.creatorUserId ?? "";
  // Only the creator or an existing plan member can mint a share link.
  const isMember = db.planMembers.some((member) => member.planId === planId && member.userId === userId);
  if (creatorId !== userId && !isMember) {
    return res.status(403).json({ error: "Only plan members can share this plan" });
  }
  db.planShareLinks = db.planShareLinks ?? [];
  // Reuse an existing non-revoked link if the user already minted one.
  const existing = db.planShareLinks.find(
    (link) => link.planId === planId && link.createdByUserId === userId && !link.revokedAt,
  );
  const token = existing?.token ?? randomUUID();
  if (!existing) {
    db.planShareLinks.push({
      id: randomUUID(),
      planId,
      token,
      createdByUserId: userId,
      createdAt: new Date().toISOString(),
    });
  }
  writeDb(db);
  const baseUrl = process.env.SHARE_LINK_BASE_URL ?? "https://connectsphere.app";
  return res.status(existing ? 200 : 201).json({
    token,
    planId,
    url: `${baseUrl}/p/${token}`,
    reused: !!existing,
  });
});

// Redeem a share-link token to join a plan. Anyone signed in can hit this.
router.post("/friends/plans/rsvp-link", (req, res) => {
  const db = readDb();
  const userId = authUserId(req, req.body.userId);
  const token = String(req.body.token ?? "");
  if (!token) return res.status(400).json({ error: "token is required" });
  db.planShareLinks = db.planShareLinks ?? [];
  db.planShareLinkRedemptions = db.planShareLinkRedemptions ?? [];
  const link = db.planShareLinks.find((item) => item.token === token && !item.revokedAt);
  if (!link) return res.status(404).json({ error: "This invite link is no longer valid" });
  const plan = db.plans.find((item) => item.id === link.planId);
  if (!plan) return res.status(404).json({ error: "Plan not found" });
  const creatorId = plan.creatorId ?? plan.creatorUserId ?? "";
  if (creatorId && isBlocked(db, userId, creatorId)) {
    return res.status(403).json({ error: "This plan is blocked" });
  }
  const alreadyMember =
    creatorId === userId ||
    db.planMembers.some((member) => member.planId === plan.id && member.userId === userId);
  const chat =
    db.chats.find((item) => item.id === plan.chatId || item.planId === plan.id) ?? null;
  if (alreadyMember) {
    // Idempotent: log redemption but skip duplicate membership writes.
    db.planShareLinkRedemptions.push({
      id: randomUUID(),
      token,
      planId: plan.id,
      userId,
      createdAt: new Date().toISOString(),
    });
    writeDb(db);
    return res.json({
      plan: planSummary(db, plan),
      chat,
      joinedViaLink: true,
      isFirstJoinForThisUser: false,
      alreadyMember: true,
    });
  }
  db.planMembers.push({ id: randomUUID(), planId: plan.id, userId, role: "guest" });
  if (chat) {
    ensureChatMember(db, chat.id, userId);
    ensureGroupPromotion(db, chat.id);
  }
  // System message: who joined and via link.
  if (chat) {
    db.messages.push({
      id: randomUUID(),
      chatId: chat.id,
      senderUserId: userId,
      text: "🔗 joined via share link",
      createdAt: new Date().toISOString(),
      system: true,
    });
  }
  const isFirstRedemption = !db.planShareLinkRedemptions.some(
    (entry) => entry.userId === userId && entry.token === token,
  );
  db.planShareLinkRedemptions.push({
    id: randomUUID(),
    token,
    planId: plan.id,
    userId,
    createdAt: new Date().toISOString(),
  });
  writeDb(db);
  return res.status(201).json({
    plan: planSummary(db, plan),
    chat,
    joinedViaLink: true,
    isFirstJoinForThisUser: isFirstRedemption,
  });
});

// Revoke a share link so further taps return 404.
router.post("/friends/plans/share-link/revoke", (req, res) => {
  const db = readDb();
  const userId = authUserId(req, req.body.userId);
  const token = String(req.body.token ?? "");
  db.planShareLinks = db.planShareLinks ?? [];
  const link = db.planShareLinks.find((item) => item.token === token);
  if (!link) return res.status(404).json({ error: "Link not found" });
  const plan = db.plans.find((item) => item.id === link.planId);
  const creatorId = plan?.creatorId ?? plan?.creatorUserId ?? "";
  // Only the link's creator OR the plan's host may revoke.
  if (link.createdByUserId !== userId && creatorId !== userId) {
    return res.status(403).json({ error: "Only the link creator or plan host may revoke" });
  }
  link.revokedAt = new Date().toISOString();
  writeDb(db);
  return res.json({ token, revokedAt: link.revokedAt });
});

router.post("/friends/plans/join", (req, res) => {
  const db = readDb();
  const userId = authUserId(req, req.body.userId);
  const planId = String(req.body.planId ?? "");
  const plan = db.plans.find((item) => item.id === planId);
  if (!plan) return res.status(404).json({ error: "Plan not found" });
  const creatorId = plan.creatorId ?? plan.creatorUserId ?? "";
  if (creatorId && isBlocked(db, userId, creatorId)) return res.status(403).json({ error: "This plan is blocked" });
  if (creatorId === userId || db.planMembers.some((member) => member.planId === planId && member.userId === userId)) {
    const chat = db.chats.find((item) => item.id === plan.chatId || item.planId === plan.id) ?? joinPlanAsMember(db, plan, userId);
    writeDb(db);
    return res.json({ plan: planSummary(db, plan), chat, request: null, status: "joined" });
  }
  db.planJoinRequests = db.planJoinRequests ?? [];
  const existing = db.planJoinRequests.find((request) => request.planId === planId && request.fromUserId === userId && request.status === "pending");
  const request = existing ?? {
    id: randomUUID(),
    planId,
    fromUserId: userId,
    creatorId,
    status: "pending" as const,
    createdAt: new Date().toISOString(),
  };
  if (!existing) db.planJoinRequests.push(request);
  writeDb(db);
  return res.status(existing ? 200 : 201).json({ plan: planSummary(db, plan), request, status: "pending" });
});

router.post("/friends/plans/request-join", (req, res) => {
  const db = readDb();
  const userId = authUserId(req, req.body.userId);
  const planId = String(req.body.planId ?? "");
  const plan = db.plans.find((item) => item.id === planId);
  if (!plan) return res.status(404).json({ error: "Plan not found" });
  const creatorId = plan.creatorId ?? plan.creatorUserId ?? "";
  if (creatorId && isBlocked(db, userId, creatorId)) return res.status(403).json({ error: "This plan is blocked" });
  if (creatorId === userId || db.planMembers.some((member) => member.planId === planId && member.userId === userId)) {
    const chat = db.chats.find((item) => item.id === plan.chatId || item.planId === plan.id) ?? joinPlanAsMember(db, plan, userId);
    writeDb(db);
    return res.json({ plan: planSummary(db, plan), chat, request: null, status: "joined" });
  }
  db.planJoinRequests = db.planJoinRequests ?? [];
  const existing = db.planJoinRequests.find((request) => request.planId === planId && request.fromUserId === userId && request.status === "pending");
  const request = existing ?? {
    id: randomUUID(),
    planId,
    fromUserId: userId,
    creatorId,
    status: "pending" as const,
    createdAt: new Date().toISOString(),
  };
  if (!existing) db.planJoinRequests.push(request);
  writeDb(db);
  return res.status(existing ? 200 : 201).json({ plan: planSummary(db, plan), request, status: "pending" });
});

router.post("/friends/plans/cancel-join", (req, res) => {
  const db = readDb();
  const requestId = String(req.body.requestId ?? "");
  const userId = authUserId(req, req.body.userId);
  const request = (db.planJoinRequests ?? []).find((item) => item.id === requestId);
  if (!request) return res.status(404).json({ error: "Plan request not found" });
  if (request.fromUserId !== userId) return res.status(403).json({ error: "Only the requester can cancel this join request" });
  if (request.status !== "pending") return res.status(409).json({ error: "Plan request is no longer pending" });
  request.status = "canceled";
  const plan = db.plans.find((item) => item.id === request.planId);
  writeDb(db);
  return res.json({ request, plan: plan ? planSummary(db, plan) : null });
});

router.post("/friends/plans/respond-join", (req, res) => {
  const db = readDb();
  const requestId = String(req.body.requestId ?? "");
  const creatorId = authUserId(req, req.body.creatorId);
  const action = String(req.body.action ?? "");
  const request = (db.planJoinRequests ?? []).find((item) => item.id === requestId);
  if (!request) return res.status(404).json({ error: "Plan request not found" });
  if (request.creatorId !== creatorId) return res.status(403).json({ error: "Only the creator can respond" });
  const plan = db.plans.find((item) => item.id === request.planId);
  if (!plan) return res.status(404).json({ error: "Plan not found" });
  if (action === "decline") {
    request.status = "declined";
    writeDb(db);
    return res.json({ request, plan: planSummary(db, plan) });
  }
  if (action !== "accept") return res.status(400).json({ error: "action must be accept or decline" });
  request.status = "accepted";
  const chat = joinPlanAsMember(db, plan, request.fromUserId);
  db.messages.push({
    id: randomUUID(),
    chatId: chat.id,
    senderId: "system",
    senderUserId: "system",
    text: `${userProfile(db, request.fromUserId).name} joined the plan.`,
    createdAt: new Date().toISOString(),
    system: true,
  });
  writeDb(db);
  return res.json({ request, plan: planSummary(db, plan), chat });
});

router.get("/friends/stories/:userId", (req, res) => {
  const db = readDb();
  const viewerId = req.params.userId;
  ensureMockPeopleStories(db, viewerId);
  const stories = (db.friendStories ?? [])
    .filter((story) => story.userId === viewerId || !isBlocked(db, viewerId, story.userId))
    .map((story) => ({
      ...story,
      user: userProfile(db, story.userId),
      relationshipStatus: story.userId === viewerId ? "self" : relationshipStatus(db, viewerId, story.userId),
      reactions: (db.friendStoryReactions ?? []).filter((reaction) => reaction.storyId === story.id),
      isOwn: story.userId === viewerId,
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  writeDb(db);
  res.json({ stories });
});

router.post("/friends/stories/create", (req, res) => {
  const db = readDb();
  const userId = authUserId(req, req.body.userId);
  const type = ["status", "photo", "plan_invite"].includes(String(req.body.type)) ? String(req.body.type) : "status";
  const createdAt = new Date().toISOString();
  let planId: string | undefined;
  if (type === "plan_invite") {
    const { plan } = createFriendPlanWithChat(db, {
      creatorId: userId,
      title: String(req.body.text ?? `${req.body.planType ?? "Plan"} invite`),
      type: String(req.body.planType ?? "Coffee"),
      time: typeof req.body.time === "string" ? req.body.time : undefined,
      timeLabel: typeof req.body.timeLabel === "string" ? req.body.timeLabel : undefined,
      scheduledAt: typeof req.body.scheduledAt === "string" ? req.body.scheduledAt : undefined,
      location: typeof req.body.location === "string" ? req.body.location : undefined,
      visibility: "friends_nearby",
      sourceType: "custom",
      invitedUserIds: [],
    });
    planId = plan.id;
  }
  const story: FriendStory = {
    id: randomUUID(),
    userId,
    type: type as FriendStory["type"],
    text: typeof req.body.text === "string" ? req.body.text : undefined,
    imageUrl: typeof req.body.imageUrl === "string" ? req.body.imageUrl : undefined,
    planType: typeof req.body.planType === "string" ? req.body.planType : undefined,
    planId,
    createdAt,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
  db.friendStories = db.friendStories ?? [];
  db.friendStories.unshift(story);
  writeDb(db);
  res.status(201).json({ story });
});

router.post("/friends/stories/react", (req, res) => {
  const db = readDb();
  const userId = authUserId(req, req.body.userId);
  const storyId = String(req.body.storyId ?? "");
  const story = (db.friendStories ?? []).find((item) => item.id === storyId);
  if (!story) return res.status(404).json({ error: "Story not found" });
  if (isBlocked(db, userId, story.userId)) return res.status(403).json({ error: "This story is blocked" });
  const reaction = {
    id: randomUUID(),
    storyId,
    userId,
    reaction: String(req.body.reaction ?? "spark"),
    createdAt: new Date().toISOString(),
  };
  db.friendStoryReactions = db.friendStoryReactions ?? [];
  db.friendStoryReactions.push(reaction);
  writeDb(db);
  return res.status(201).json({ reaction });
});

router.post("/friends/stories/reply", (req, res) => {
  const db = readDb();
  const userId = authUserId(req, req.body.userId);
  const storyId = String(req.body.storyId ?? "");
  const text = String(req.body.text ?? "Loved your story.");
  const story = (db.friendStories ?? []).find((item) => item.id === storyId);
  if (!story) return res.status(404).json({ error: "Story not found" });
  if (areFriends(db, userId, story.userId)) {
    const chat = ensureDirectChat(db, userId, story.userId);
    const message: Message = {
      id: randomUUID(),
      chatId: chat.id,
      senderId: userId,
      senderUserId: userId,
      text,
      createdAt: new Date().toISOString(),
    };
    db.messages.push(message);
    writeDb(db);
    return res.status(201).json({ mode: "chat", chat, message });
  }

  const request = ensurePendingRequest(db, userId, story.userId, { kind: "story_reply", message: text, storyId });
  if (!request) return res.status(403).json({ error: "This connection is blocked" });
  writeDb(db);
  return res.status(201).json({ mode: "request", request });
});

router.post("/friends/icebreakers/generate", async (req, res) => {
  const db = readDb();
  const userId = authUserId(req, req.body.userId);
  const context = icebreakerContextFromBody(db, req.body, userId);
  const suggestions = await generateFriendIcebreakers(context);
  return res.json({ suggestions });
});

router.post("/friends/icebreakers/send", (req, res) => {
  const db = readDb();
  const userId = authUserId(req, req.body.userId);
  const text = String(req.body.text ?? "").trim();
  if (!text) return res.status(400).json({ error: "text is required" });

  const kind = String(req.body.kind ?? "person");
  const targetUserId = typeof req.body.targetUserId === "string" ? req.body.targetUserId : "";
  const storyId = typeof req.body.storyId === "string" ? req.body.storyId : "";
  const planId = typeof req.body.planId === "string" ? req.body.planId : "";
  const chatId = typeof req.body.chatId === "string" ? req.body.chatId : "";
  const requestId = typeof req.body.requestId === "string" ? req.body.requestId : "";

  if (kind === "chat" && chatId) {
    const chat = db.chats.find((item) => item.id === chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found" });
    ensureChatMember(db, chatId, userId);
    const message = addChatMessage(db, chatId, userId, text);
    writeDb(db);
    return res.status(201).json({ mode: "chat", chat, message });
  }

  if (kind === "request" && requestId) {
    const request = db.connectionRequests.find((item) => item.id === requestId);
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.toUserId !== userId && request.fromUserId !== userId) return res.status(403).json({ error: "Request is not yours" });
    request.status = "accepted";
    const { connection, chat } = ensureConnection(db, request.fromUserId, request.toUserId);
    const message = addChatMessage(db, chat.id, userId, text);
    writeDb(db);
    return res.status(201).json({ mode: "chat", request, connection, chat, message });
  }

  if (kind === "story" && storyId) {
    const story = (db.friendStories ?? []).find((item) => item.id === storyId);
    if (!story) return res.status(404).json({ error: "Story not found" });
    if (areFriends(db, userId, story.userId)) {
      const chat = ensureDirectChat(db, userId, story.userId);
      const message = addChatMessage(db, chat.id, userId, text);
      writeDb(db);
      return res.status(201).json({ mode: "chat", chat, message });
    }
    const request = ensurePendingRequest(db, userId, story.userId, { kind: "story_reply", message: text, storyId });
    if (!request) return res.status(403).json({ error: "This connection is blocked" });
    writeDb(db);
    return res.status(201).json({ mode: "request", request });
  }

  if (kind === "plan" && planId) {
    const plan = db.plans.find((item) => item.id === planId);
    if (!plan) return res.status(404).json({ error: "Plan not found" });
    const creatorId = plan.creatorId ?? plan.creatorUserId ?? "";
    const isMember = db.planMembers.some((member) => member.planId === plan.id && member.userId === userId);
    if (isMember || creatorId === userId || areFriends(db, userId, creatorId)) {
      const chat = db.chats.find((item) => item.id === plan.chatId || item.planId === plan.id) ?? joinPlanAsMember(db, plan, userId);
      const message = addChatMessage(db, chat.id, userId, text);
      writeDb(db);
      return res.status(201).json({ mode: "plan", plan: planSummary(db, plan), chat, message });
    }
    db.planJoinRequests = db.planJoinRequests ?? [];
    const existing = db.planJoinRequests.find((item) => item.planId === planId && item.fromUserId === userId && item.status === "pending");
    const request =
      existing ??
      {
        id: randomUUID(),
        planId,
        fromUserId: userId,
        creatorId,
        status: "pending" as const,
        createdAt: new Date().toISOString(),
      };
    if (!existing) db.planJoinRequests.push(request);
    writeDb(db);
    return res.status(existing ? 200 : 201).json({ mode: "request", request, plan: planSummary(db, plan) });
  }

  if (!targetUserId) return res.status(400).json({ error: "targetUserId is required" });
  if (isBlocked(db, userId, targetUserId)) return res.status(403).json({ error: "This connection is blocked" });
  if (areFriends(db, userId, targetUserId)) {
    const chat = ensureDirectChat(db, userId, targetUserId);
    const message = addChatMessage(db, chat.id, userId, text);
    writeDb(db);
    return res.status(201).json({ mode: "chat", chat, message });
  }
  const request = ensurePendingRequest(db, userId, targetUserId, { kind: "friend", message: text });
  if (!request) return res.status(403).json({ error: "This connection is blocked" });
  writeDb(db);
  return res.status(201).json({ mode: "request", request });
});

router.delete("/friends/stories/:storyId", (req, res) => {
  const db = readDb();
  const storyId = req.params.storyId;
  db.friendStories = (db.friendStories ?? []).filter((story) => story.id !== storyId);
  db.friendStoryReactions = (db.friendStoryReactions ?? []).filter((reaction) => reaction.storyId !== storyId);
  writeDb(db);
  res.json({ success: true });
});

router.post("/friends/block", (req, res) => {
  const db = readDb();
  const userId = authUserId(req, req.body.userId);
  const blockedUserId = String(req.body.blockedUserId ?? "");
  if (!blockedUserId) return res.status(400).json({ error: "blockedUserId is required" });
  if (blockedUserId === userId) return res.status(400).json({ error: "You cannot block yourself" });

  db.blockedUsers = db.blockedUsers ?? [];
  let block = db.blockedUsers.find((item) => item.userId === userId && item.blockedUserId === blockedUserId);
  if (!block) {
    block = { id: randomUUID(), userId, blockedUserId, createdAt: new Date().toISOString() };
    db.blockedUsers.push(block);
  }

  db.connectionRequests.forEach((request) => {
    if (
      request.status === "pending" &&
      ((request.fromUserId === userId && request.toUserId === blockedUserId) ||
        (request.fromUserId === blockedUserId && request.toUserId === userId))
    ) {
      request.status = "canceled";
    }
  });
  (db.planJoinRequests ?? []).forEach((request) => {
    if (
      request.status === "pending" &&
      ((request.fromUserId === userId && request.creatorId === blockedUserId) ||
        (request.fromUserId === blockedUserId && request.creatorId === userId))
    ) {
      request.status = "canceled";
    }
  });
  db.connections = db.connections.filter((connection) => {
    const ids = connection.userIds ?? [connection.userAId, connection.userBId];
    return !(ids.includes(userId) && ids.includes(blockedUserId));
  });

  writeDb(db);
  return res.json({ block });
});

router.post("/friends/report", (req, res) => {
  const db = readDb();
  const userId = authUserId(req, req.body.userId);
  const reportedUserId = String(req.body.reportedUserId ?? "");
  if (!reportedUserId) return res.status(400).json({ error: "reportedUserId is required" });
  const report: FriendReport = {
    id: randomUUID(),
    userId,
    reportedUserId,
    reason: typeof req.body.reason === "string" ? req.body.reason : undefined,
    context: typeof req.body.context === "string" ? req.body.context : undefined,
    createdAt: new Date().toISOString(),
  };
  db.userReports = db.userReports ?? [];
  db.userReports.push(report);
  writeDb(db);
  return res.status(201).json({ report });
});

router.get("/friends/feed/:userId", (req, res) => {
  const db = readDb();
  const userId = req.params.userId;
  res.json({ feed: buildFriendsFeed(userId, db), users: db.users });
});

router.post("/friends/posts/create", (req, res) => {
  const db = readDb();
  const userId = authUserId(req, req.body.userId);
  const post: FriendPost = {
    id: randomUUID(),
    userId,
    text: String(req.body.text ?? ""),
    tag: String(req.body.tag ?? "Coffee"),
    imageUrl: typeof req.body.imageUrl === "string" ? req.body.imageUrl : undefined,
    createdAt: new Date().toISOString(),
  };
  db.friendPosts.unshift(post);
  writeDb(db);
  res.status(201).json({ post });
});

router.post("/friends/posts/like", (req, res) => {
  const db = readDb();
  const userId = authUserId(req, req.body.userId);
  const postId = String(req.body.postId ?? "");
  const existing = db.postLikes.find((like) => like.postId === postId && like.userId === userId);
  if (!existing) db.postLikes.push({ id: randomUUID(), postId, userId, createdAt: new Date().toISOString() });
  writeDb(db);
  res.json({ liked: true });
});

router.post("/friends/comments/create", (req, res) => {
  const db = readDb();
  const comment = {
    id: randomUUID(),
    postId: String(req.body.postId ?? ""),
    userId: authUserId(req, req.body.userId),
    text: String(req.body.text ?? ""),
    createdAt: new Date().toISOString(),
  };
  db.postComments.push(comment);
  writeDb(db);
  res.status(201).json({ comment });
});

router.post("/friends/connect/request", (req, res) => {
  const db = readDb();
  const fromUserId = authUserId(req, req.body.fromUserId);
  const toUserId = String(req.body.toUserId ?? "");
  if (isBlocked(db, fromUserId, toUserId)) return res.status(403).json({ error: "This connection is blocked" });
  const existing = pendingRequestBetween(db, fromUserId, toUserId);
  const request = ensurePendingRequest(db, fromUserId, toUserId);
  if (!request) return res.status(403).json({ error: "This connection is blocked" });
  writeDb(db);
  return res.status(existing ? 200 : 201).json({ request });
});

router.post("/friends/connect/accept", (req, res) => {
  const db = readDb();
  const requestId = String(req.body.requestId ?? "");
  const request = db.connectionRequests.find((item) => item.id === requestId);
  if (!request) return res.status(404).json({ error: "Request not found" });
  request.status = "accepted";
  const { connection, chat } = ensureConnection(db, request.fromUserId, request.toUserId);
  writeDb(db);
  return res.json({ request, connection, chat });
});

router.post("/friends/connect/ignore", (req, res) => {
  const db = readDb();
  const requestId = String(req.body.requestId ?? "");
  const request = db.connectionRequests.find((item) => item.id === requestId);
  if (!request) return res.status(404).json({ error: "Request not found" });
  request.status = "ignored";
  writeDb(db);
  return res.json({ request });
});

router.get("/connect/:userId", (req, res) => {
  const db = readDb();
  const userId = req.params.userId;
  const pairInfo = (pairId: string) => {
    const pair = db.doubleDatePairs?.find((item) => item.id === pairId);
    if (!pair) return null;
    return {
      ...pair,
      users: pair.userIds.map((id) => userProfile(db, id)),
      names: pair.userIds.map((id) => userProfile(db, id).name),
    };
  };
  const requests = db.connectionRequests
    .filter((request) => request.toUserId === userId && request.status === "pending")
    .filter((request) => requestVisibleToViewer(db, userId, request))
    .map((request) => requestSummary(db, userId, request));
  const connections = db.connections
    .filter((connection) => {
      const ids = connection.userIds ?? [connection.userAId, connection.userBId];
      const otherUserId = ids.find((id) => id !== userId) ?? "";
      return ids.includes(userId) && !isBlocked(db, userId, otherUserId);
    })
    .map((connection) => {
      const ids = connection.userIds ?? [connection.userAId, connection.userBId];
      const otherUserId = ids.find((id) => id !== userId) ?? ids[0];
      const chat = connection.chatId ? db.chats.find((item) => item.id === connection.chatId) : ensureDirectChat(db, ids[0], ids[1]);
      if (chat && connection.chatId !== chat.id) connection.chatId = chat.id;
      return {
        ...connection,
        userIds: ids,
        otherUser: userProfile(db, otherUserId),
        chatId: chat?.id ?? connection.chatId,
        chat,
        lastMessage: chat ? lastMessageForChat(db, chat.id) : undefined,
      };
    });
  const connectionChatIds = new Set(connections.map((connection) => connection.chatId).filter(Boolean));
  const userChats = db.chats.filter(
    (chat) => connectionChatIds.has(chat.id) || db.chatMembers.some((member) => member.chatId === chat.id && member.userId === userId),
  );
  const friendPlans = db.plans
    .filter((plan) => {
      const creatorId = plan.creatorId ?? plan.creatorUserId ?? "";
      return db.planMembers.some((member) => member.planId === plan.id && member.userId === userId) && !isBlocked(db, userId, creatorId);
    })
    .map((plan) => planSummary(db, plan));
  const doubleDateMatches = (db.doubleDateMatches ?? [])
    .filter((match) => match.userIds.includes(userId))
    .map((match) => ({
      ...match,
      pairs: match.pairIds.map(pairInfo).filter(Boolean),
      users: match.userIds.map((id) => userProfile(db, id)),
      chatId: match.chatId,
      lastMessage: lastMessageForChat(db, match.chatId),
    }));
  const chats = userChats.map((chat) => ({
    ...chat,
    members: db.chatMembers.filter((member) => member.chatId === chat.id),
    participants: db.chatMembers.filter((member) => member.chatId === chat.id).map((member) => userProfile(db, member.userId)),
    lastMessage: lastMessageForChat(db, chat.id),
  }));

  writeDb(db);
  res.json({
    requests: [
      ...requests,
      ...(db.planJoinRequests ?? [])
        .filter((request) => request.creatorId === userId && request.status === "pending")
        .filter((request) => planJoinRequestVisibleToViewer(db, userId, request))
        .map((request) => planJoinRequestSummary(db, userId, request)),
    ],
    connections,
    friends: connections,
    datingMatches: (db.datingMatches ?? []).filter((match) => match.userAId === userId || match.userBId === userId),
    friendPlans,
    plans: friendPlans,
    opportunityChats: [],
    doubleDateMatches,
    chats,
    activePlans: friendPlans,
  });
});

router.get("/chats/:chatId", (req, res) => {
  const db = readDb();
  const chatId = req.params.chatId;
  const chat = db.chats.find((item) => item.id === chatId);
  const members = db.chatMembers.filter((member) => member.chatId === chatId);
  const participants = members.map((member) => db.users.find((user) => user.id === member.userId) ?? { id: member.userId, name: "Someone" });
  res.json({
    chat,
    members,
    participants,
    messages: db.messages.filter((message) => message.chatId === chatId),
    quickActions:
      chat?.type === "double_date"
        ? ["Drinks", "Dinner", "Event Tonight", "Pick a Spot"]
        : chat?.type === "friend_direct" || chat?.type === "friend_plan" || chat?.type === "plan"
          ? ["AI opener", "Make a plan", "Pick a spot", "Invite more"]
          : [],
  });
});

router.post("/messages/send", (req, res) => {
  const db = readDb();
  const message: Message = {
    id: randomUUID(),
    chatId: String(req.body.chatId ?? ""),
    senderId: authUserId(req, req.body.senderUserId),
    senderUserId: authUserId(req, req.body.senderUserId),
    text: String(req.body.text ?? ""),
    createdAt: new Date().toISOString(),
  };
  db.messages.push(message);
  writeDb(db);
  res.status(201).json({ message });
});

export default router;
