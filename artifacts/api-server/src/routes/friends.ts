import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { getAuth } from "@clerk/express";
import { Router } from "express";

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
  status: "pending" | "accepted" | "ignored";
  message?: string;
  storyId?: string;
  planId?: string;
  kind?: "friend" | "story_reply" | "plan_invite";
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
  status: "pending" | "accepted" | "declined";
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
  datingMatches?: Array<{ id: string; userAId: string; userBId: string; createdAt: string; shotId?: string }>;
  doubleDatePairs?: Array<{ id: string; userIds: [string, string]; createdBy: string; status: "active" | "paused"; vibeTags: string[]; createdAt: string }>;
  doubleDateLikes?: Array<{ id: string; fromPairId: string; toPairId: string; type: "like" | "spark"; createdAt: string }>;
  doubleDatePasses?: Array<{ id: string; fromPairId: string; toPairId: string; createdAt: string }>;
  doubleDateMatches?: Array<{ id: string; pairIds: [string, string]; userIds: [string, string, string, string]; chatId: string; createdAt: string }>;
  blockedUsers?: Array<{ id: string; userId: string; blockedUserId: string; createdAt: string }>;
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
    datingMatches: parsed.datingMatches ?? [],
    doubleDatePairs: parsed.doubleDatePairs ?? [],
    doubleDateLikes: parsed.doubleDateLikes ?? [],
    doubleDatePasses: parsed.doubleDatePasses ?? [],
    doubleDateMatches: parsed.doubleDateMatches ?? [],
    blockedUsers: parsed.blockedUsers ?? [],
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
  return {
    ...candidate,
    location: candidate.neighborhood || candidate.city,
    statusBadge: statusBadgeFor(candidate),
    relationshipStatus: relationshipStatus(db, viewerId, candidateId),
    requestId: pending?.id,
    chatId: chat?.id,
    sharedInterests,
  };
}

function lastMessageForChat(db: FriendsDb, chatId: string) {
  return db.messages
    .filter((message) => message.chatId === chatId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
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
  const instantInviteIds = invitedUserIds.filter((userId) => areFriends(db, input.creatorId, userId));
  const pendingInviteIds = invitedUserIds.filter((userId) => !areFriends(db, input.creatorId, userId));
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
    invitedUserIds,
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
  db.messages.push({
    id: randomUUID(),
    chatId: chat.id,
    senderUserId: input.creatorId,
    text: `Plan created: ${plan.title}.`,
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

  const candidates = db.users.filter((user) => user.id !== viewerId).slice(0, 4);
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
  const joinRequest = (db.planJoinRequests ?? []).find((request) => request.planId === plan.id && request.fromUserId === viewerId);
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
    .map((user) => peopleCard(db, userId, user.id))
    .filter((person) => {
      if (!query) return true;
      return [person.name, person.city, person.neighborhood, person.energy, ...(person.interests ?? [])]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  writeDb(db);
  res.json({ people });
});

router.post("/friends/request", (req, res) => {
  const db = readDb();
  const fromUserId = authUserId(req, req.body.fromUserId);
  const toUserId = String(req.body.toUserId ?? "");
  if (!toUserId) return res.status(400).json({ error: "toUserId is required" });
  if (areFriends(db, fromUserId, toUserId)) {
    const chat = ensureDirectChat(db, fromUserId, toUserId);
    writeDb(db);
    return res.json({ request: null, relationshipStatus: "friends", chat });
  }
  const request = ensurePendingRequest(db, fromUserId, toUserId, {
    kind: req.body.kind ?? "friend",
    message: typeof req.body.message === "string" ? req.body.message : undefined,
    planId: typeof req.body.planId === "string" ? req.body.planId : undefined,
    storyId: typeof req.body.storyId === "string" ? req.body.storyId : undefined,
  });
  writeDb(db);
  return res.status(201).json({ request, relationshipStatus: relationshipStatus(db, fromUserId, toUserId) });
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
      if (planChat) ensureChatMember(db, planChat.id, request.toUserId);
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
    .map((request) => requestSummary(db, userId, request));
  const planRequests = (db.planJoinRequests ?? [])
    .filter((request) => request.status === "pending" && (request.creatorId === userId || request.fromUserId === userId))
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

router.post("/friends/plans/join", (req, res) => {
  const db = readDb();
  const userId = authUserId(req, req.body.userId);
  const planId = String(req.body.planId ?? "");
  const plan = db.plans.find((item) => item.id === planId);
  if (!plan) return res.status(404).json({ error: "Plan not found" });
  const creatorId = plan.creatorId ?? plan.creatorUserId ?? "";
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
  const existing = pendingRequestBetween(db, fromUserId, toUserId);
  const request = ensurePendingRequest(db, fromUserId, toUserId);
  writeDb(db);
  res.status(existing ? 200 : 201).json({ request });
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
    .map((request) => requestSummary(db, userId, request));
  const connections = db.connections
    .filter((connection) => {
      const ids = connection.userIds ?? [connection.userAId, connection.userBId];
      return ids.includes(userId);
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
    .filter((plan) => db.planMembers.some((member) => member.planId === plan.id && member.userId === userId))
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
        .map((request) => planJoinRequestSummary(db, request)),
    ],
    connections,
    friends: connections,
    datingMatches: (db.datingMatches ?? []).filter((match) => match.userAId === userId || match.userBId === userId),
    friendPlans,
    plans: friendPlans,
    opportunityChats: chats.filter((chat) => chat.type === "opportunity"),
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
    quickActions: chat?.type === "double_date" ? ["Drinks", "Dinner", "Event Tonight", "Pick a Spot"] : [],
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
