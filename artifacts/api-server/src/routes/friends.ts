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
  interests: string[];
  activityStyle: string[];
  energy: string;
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
  createdAt: string;
};

type Plan = {
  id: string;
  creatorUserId: string;
  title: string;
  type: string;
  createdAt: string;
};

type Chat = {
  id: string;
  planId?: string;
  createdAt: string;
};

type Message = {
  id: string;
  chatId: string;
  senderUserId: string;
  text: string;
  createdAt: string;
};

type UserBehavior = {
  userId: string;
  searches: string[];
  likedTags: string[];
  clickedTags: string[];
  interactedUserIds: string[];
};

type FriendsDb = {
  users: FriendUser[];
  friendPosts: FriendPost[];
  postComments: Array<{ id: string; postId: string; userId: string; text: string; createdAt: string }>;
  postLikes: Array<{ id: string; postId: string; userId: string; createdAt: string }>;
  connectionRequests: ConnectionRequest[];
  connections: Array<{ id: string; userAId: string; userBId: string; createdAt: string }>;
  plans: Plan[];
  planMembers: Array<{ id: string; planId: string; userId: string; role: string }>;
  chats: Chat[];
  chatMembers: Array<{ id: string; chatId: string; userId: string }>;
  messages: Message[];
  userBehavior: UserBehavior[];
};

const router = Router();
const dbPath = join(process.cwd(), "artifacts", "api-server", "db.json");

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
  };
}

function readDb(): FriendsDb {
  if (!existsSync(dbPath)) {
    const initial = emptyDb();
    writeDb(initial);
    return initial;
  }

  return JSON.parse(readFileSync(dbPath, "utf8")) as FriendsDb;
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
  const viewer = db.users.find((user) => user.id === userId) ?? db.users[0];
  const behavior = db.userBehavior.find((item) => item.userId === userId);

  return db.friendPosts
    .map((post) => {
      const author = db.users.find((user) => user.id === post.userId) ?? viewer;
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
  const existing = db.connectionRequests.find((request) => request.fromUserId === fromUserId && request.toUserId === toUserId && request.status === "pending");
  const request = existing ?? { id: randomUUID(), fromUserId, toUserId, status: "pending" as const, createdAt: new Date().toISOString() };
  if (!existing) db.connectionRequests.push(request);
  writeDb(db);
  res.status(existing ? 200 : 201).json({ request });
});

router.post("/friends/connect/accept", (req, res) => {
  const db = readDb();
  const requestId = String(req.body.requestId ?? "");
  const request = db.connectionRequests.find((item) => item.id === requestId);
  if (!request) return res.status(404).json({ error: "Request not found" });
  request.status = "accepted";
  const connection = { id: randomUUID(), userAId: request.fromUserId, userBId: request.toUserId, createdAt: new Date().toISOString() };
  db.connections.push(connection);
  writeDb(db);
  return res.json({ request, connection });
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

router.post("/friends/plans/create", (req, res) => {
  const db = readDb();
  const creatorUserId = authUserId(req, req.body.creatorUserId);
  const invitedUserId = String(req.body.invitedUserId ?? "");
  const plan: Plan = {
    id: randomUUID(),
    creatorUserId,
    title: String(req.body.title ?? "New plan"),
    type: String(req.body.type ?? "Coffee"),
    createdAt: new Date().toISOString(),
  };
  const chat: Chat = { id: randomUUID(), planId: plan.id, createdAt: new Date().toISOString() };
  db.plans.push(plan);
  db.planMembers.push({ id: randomUUID(), planId: plan.id, userId: creatorUserId, role: "host" });
  if (invitedUserId) db.planMembers.push({ id: randomUUID(), planId: plan.id, userId: invitedUserId, role: "guest" });
  db.chats.push(chat);
  db.chatMembers.push({ id: randomUUID(), chatId: chat.id, userId: creatorUserId });
  if (invitedUserId) db.chatMembers.push({ id: randomUUID(), chatId: chat.id, userId: invitedUserId });
  writeDb(db);
  res.status(201).json({ plan, chat });
});

router.get("/connect/:userId", (req, res) => {
  const db = readDb();
  const userId = req.params.userId;
  res.json({
    requests: db.connectionRequests.filter((request) => request.toUserId === userId && request.status === "pending"),
    connections: db.connections.filter((connection) => connection.userAId === userId || connection.userBId === userId),
    chats: db.chats.filter((chat) => db.chatMembers.some((member) => member.chatId === chat.id && member.userId === userId)),
    activePlans: db.plans.filter((plan) => db.planMembers.some((member) => member.planId === plan.id && member.userId === userId)),
  });
});

router.get("/chats/:chatId", (req, res) => {
  const db = readDb();
  const chatId = req.params.chatId;
  res.json({ chat: db.chats.find((chat) => chat.id === chatId), messages: db.messages.filter((message) => message.chatId === chatId) });
});

router.post("/messages/send", (req, res) => {
  const db = readDb();
  const message: Message = {
    id: randomUUID(),
    chatId: String(req.body.chatId ?? ""),
    senderUserId: authUserId(req, req.body.senderUserId),
    text: String(req.body.text ?? ""),
    createdAt: new Date().toISOString(),
  };
  db.messages.push(message);
  writeDb(db);
  res.status(201).json({ message });
});

export default router;
