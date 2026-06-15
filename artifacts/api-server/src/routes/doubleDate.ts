import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { Router, type Request, type Response } from "express";

type SwipeDirection = "like" | "pass";

type User = {
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
};

type DoubleDatePair = {
  id: string;
  active?: boolean;
  status?: "active" | "paused";
  userIds?: [string, string];
  memberIds?: [string, string];
  createdBy: string;
  vibeTags?: string[];
  createdAt: string;
  updatedAt?: string;
};

type DoubleDateSwipe = {
  id: string;
  swiperPairId: string;
  targetPairId: string;
  direction: SwipeDirection;
  createdBy: string;
  createdAt: string;
};

type DoubleDateMatch = {
  id: string;
  pairOneId?: string;
  pairTwoId?: string;
  pairIds?: [string, string];
  userIds: [string, string, string, string];
  chatId: string;
  createdAt: string;
};

type Chat = {
  id: string;
  type?: "double_date" | "opportunity" | "plan" | "dating_match" | "friend_direct" | "friend_plan";
  participantIds?: string[];
  title?: string;
  planId?: string;
  createdAt: string;
  updatedAt?: string;
};

type ChatMember = {
  id: string;
  chatId: string;
  userId: string;
};

type Message = {
  id: string;
  chatId: string;
  senderId?: string;
  senderUserId?: string;
  text: string;
  createdAt: string;
  system?: boolean;
};

type JsonDb = {
  users: User[];
  friendPosts: unknown[];
  postComments: unknown[];
  postLikes: unknown[];
  connectionRequests: Array<{ id: string; fromUserId: string; toUserId: string; status: string; createdAt: string }>;
  connections: Array<{ id: string; userAId?: string; userBId?: string; userIds?: [string, string]; createdAt: string; chatId?: string }>;
  plans: unknown[];
  planMembers: unknown[];
  chats: Chat[];
  chatMembers: ChatMember[];
  messages: Message[];
  userBehavior: unknown[];
  datingMatches: unknown[];
  doubleDatePairs: DoubleDatePair[];
  doubleDateSwipes: DoubleDateSwipe[];
  doubleDateMatches: DoubleDateMatch[];
  blockedUsers: Array<{ id: string; userId: string; blockedUserId: string; createdAt: string }>;
  doubleDateLikes?: Array<{ id: string; fromPairId: string; toPairId: string; type: string; createdAt: string }>;
  doubleDatePasses?: Array<{ id: string; fromPairId: string; toPairId: string; createdAt: string }>;
};

const router = Router();
const workspaceRoot = process.cwd().endsWith(join("artifacts", "api-server"))
  ? join(process.cwd(), "..", "..")
  : process.cwd();
const dbPath = join(workspaceRoot, "artifacts", "api-server", "db.json");
const SYSTEM_MATCH_MESSAGE = "It's a double date match. A 4-person group chat is ready in Connect.";

const seedUsers: User[] = [
  {
    id: "user_self",
    name: "You",
    city: "Miami",
    neighborhood: "Brickell",
    age: 26,
    photoUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=85",
    interests: ["nightlife", "dinner", "music", "rooftops"],
    activityStyle: ["social", "fast-plans", "evening"],
    energy: "Ready for a fun plan",
    activeTonight: true,
  },
  {
    id: "user-maya",
    name: "Maya Johnson",
    city: "Miami",
    neighborhood: "Brickell",
    age: 25,
    photoUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=85",
    interests: ["brunch", "design", "rooftops", "dancing"],
    activityStyle: ["social", "after-work", "small-group"],
    energy: "High-energy but kind",
    activeTonight: true,
  },
  {
    id: "user-omar",
    name: "Omar Ellis",
    city: "Miami",
    neighborhood: "Wynwood",
    age: 27,
    photoUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=85",
    interests: ["gym", "food", "music", "nightlife"],
    activityStyle: ["active", "evening", "group"],
    energy: "Looking for plans",
    activeTonight: true,
  },
  {
    id: "user-nina",
    name: "Nina Patel",
    city: "Miami",
    neighborhood: "Coral Gables",
    age: 26,
    photoUrl: "https://images.unsplash.com/photo-1521119989659-a83eee488004?auto=format&fit=crop&w=800&q=85",
    interests: ["parks", "learning", "food", "tennis"],
    activityStyle: ["daytime", "calm", "planned"],
    energy: "Chill Mode",
    activeTonight: false,
  },
  {
    id: "user-sofia",
    name: "Sofia Reyes",
    city: "Miami",
    neighborhood: "Brickell",
    age: 24,
    photoUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=85",
    interests: ["dancing", "rooftops", "sushi", "fashion"],
    activityStyle: ["social", "evening", "group"],
    energy: "Plans over pen pals",
    activeTonight: true,
  },
  {
    id: "user-diego",
    name: "Diego Ramos",
    city: "Miami",
    neighborhood: "Brickell",
    age: 28,
    photoUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=85",
    interests: ["restaurants", "live music", "boxing", "nightlife"],
    activityStyle: ["evening", "social", "fast-plans"],
    energy: "Late dinner energy",
    activeTonight: true,
  },
  {
    id: "user-priya",
    name: "Priya Shah",
    city: "Miami",
    neighborhood: "Bal Harbour",
    age: 27,
    photoUrl: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=800&q=85",
    interests: ["brunch", "travel", "tennis", "sushi"],
    activityStyle: ["planned", "social", "weekend"],
    energy: "Group-friendly dating",
    activeTonight: false,
  },
  {
    id: "user-lucas",
    name: "Lucas Bennett",
    city: "Miami",
    neighborhood: "Coconut Grove",
    age: 30,
    photoUrl: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=800&q=85",
    interests: ["surf", "mixology", "house music", "sunsets"],
    activityStyle: ["outdoors", "evening", "easygoing"],
    energy: "Day-to-night Miami local",
    activeTonight: true,
  },
];

function seedPairs(): DoubleDatePair[] {
  const now = new Date().toISOString();
  return [
    {
      id: "pair-skyline",
      active: true,
      status: "active",
      userIds: ["user-sofia", "user-diego"],
      memberIds: ["user-sofia", "user-diego"],
      createdBy: "user-sofia",
      vibeTags: ["Nightlife", "Rooftops", "Sushi", "Active Tonight"],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "pair-weekend",
      active: true,
      status: "active",
      userIds: ["user-priya", "user-lucas"],
      memberIds: ["user-priya", "user-lucas"],
      createdBy: "user-priya",
      vibeTags: ["Brunch", "Beach", "Travel", "Weekend"],
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function initialDb(): JsonDb {
  return {
    users: seedUsers,
    friendPosts: [],
    postComments: [],
    postLikes: [],
    connectionRequests: [],
    connections: [
      { id: "conn-self-maya", userAId: "user_self", userBId: "user-maya", createdAt: new Date().toISOString() },
      { id: "conn-self-omar", userAId: "user_self", userBId: "user-omar", createdAt: new Date().toISOString() },
      { id: "conn-self-nina", userAId: "user_self", userBId: "user-nina", createdAt: new Date().toISOString() },
    ],
    plans: [],
    planMembers: [],
    chats: [],
    chatMembers: [],
    messages: [],
    userBehavior: [],
    datingMatches: [],
    doubleDatePairs: seedPairs(),
    doubleDateSwipes: [],
    doubleDateMatches: [],
    blockedUsers: [],
    doubleDateLikes: [],
    doubleDatePasses: [],
  };
}

function pairMembers(pair: DoubleDatePair): [string, string] {
  const ids = pair.memberIds ?? pair.userIds;
  if (!ids || ids.length !== 2) throw new Error("Double date pair must have exactly 2 members");
  return [ids[0], ids[1]];
}

function normalizePair(pair: DoubleDatePair): DoubleDatePair {
  const ids = pairMembers(pair);
  const active = pair.active !== false && pair.status !== "paused";
  return {
    ...pair,
    active,
    status: active ? "active" : "paused",
    userIds: ids,
    memberIds: ids,
    vibeTags: pair.vibeTags?.length ? pair.vibeTags : ["Dinner", "Social", "Plan-ready"],
    updatedAt: pair.updatedAt ?? pair.createdAt,
  };
}

function migrateLegacySwipes(parsed: Partial<JsonDb>): DoubleDateSwipe[] {
  const swipes = [...(parsed.doubleDateSwipes ?? [])];
  const hasSwipe = (swiperPairId: string, targetPairId: string, direction: SwipeDirection) =>
    swipes.some((swipe) => swipe.swiperPairId === swiperPairId && swipe.targetPairId === targetPairId && swipe.direction === direction);

  for (const like of parsed.doubleDateLikes ?? []) {
    if (!hasSwipe(like.fromPairId, like.toPairId, "like")) {
      swipes.push({
        id: like.id ?? randomUUID(),
        swiperPairId: like.fromPairId,
        targetPairId: like.toPairId,
        direction: "like",
        createdBy: "",
        createdAt: like.createdAt ?? new Date().toISOString(),
      });
    }
  }
  for (const pass of parsed.doubleDatePasses ?? []) {
    if (!hasSwipe(pass.fromPairId, pass.toPairId, "pass")) {
      swipes.push({
        id: pass.id ?? randomUUID(),
        swiperPairId: pass.fromPairId,
        targetPairId: pass.toPairId,
        direction: "pass",
        createdBy: "",
        createdAt: pass.createdAt ?? new Date().toISOString(),
      });
    }
  }
  return swipes;
}

function normalizeMatch(match: DoubleDateMatch): DoubleDateMatch {
  const pairIds = match.pairIds ?? [match.pairOneId ?? "", match.pairTwoId ?? ""];
  return {
    ...match,
    pairOneId: pairIds[0],
    pairTwoId: pairIds[1],
    pairIds: [pairIds[0], pairIds[1]],
  };
}

function mergeDb(parsed: Partial<JsonDb>): JsonDb {
  const base = initialDb();
  const users = [...base.users];
  for (const user of parsed.users ?? []) {
    if (!users.some((item) => item.id === user.id)) users.push(user);
  }

  const pairs = (parsed.doubleDatePairs ?? []).map(normalizePair);
  for (const pair of base.doubleDatePairs) {
    if (!pairs.some((item) => item.id === pair.id)) pairs.push(normalizePair(pair));
  }

  const connections = [...(parsed.connections ?? [])];
  for (const connection of base.connections) {
    if (
      !connections.some((item) => {
        const ids = connectionIds(item);
        const seedIds = connectionIds(connection);
        return ids.includes(seedIds[0]) && ids.includes(seedIds[1]);
      })
    ) {
      connections.push(connection);
    }
  }

  return {
    ...base,
    ...parsed,
    users,
    connections,
    chats: parsed.chats ?? [],
    chatMembers: parsed.chatMembers ?? [],
    messages: parsed.messages ?? [],
    doubleDatePairs: pairs,
    doubleDateSwipes: migrateLegacySwipes(parsed),
    doubleDateMatches: (parsed.doubleDateMatches ?? []).map(normalizeMatch),
    blockedUsers: parsed.blockedUsers ?? [],
    doubleDateLikes: parsed.doubleDateLikes ?? [],
    doubleDatePasses: parsed.doubleDatePasses ?? [],
  };
}

function readDb(): JsonDb {
  if (!existsSync(dbPath)) {
    const db = initialDb();
    writeDb(db);
    return db;
  }
  return mergeDb(JSON.parse(readFileSync(dbPath, "utf8")) as Partial<JsonDb>);
}

function writeDb(db: JsonDb) {
  mkdirSync(dirname(dbPath), { recursive: true });
  writeFileSync(dbPath, `${JSON.stringify(db, null, 2)}\n`);
}

function connectionIds(connection: { userAId?: string; userBId?: string; userIds?: [string, string] }): [string, string] {
  const ids = connection.userIds ?? [connection.userAId ?? "", connection.userBId ?? ""];
  return [ids[0], ids[1]];
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function getUser(db: JsonDb, userId: string) {
  return db.users.find((user) => user.id === userId);
}

function decorateUser(db: JsonDb, userId: string) {
  const user = getUser(db, userId);
  return user
    ? {
        id: user.id,
        name: user.name,
        city: user.city,
        neighborhood: user.neighborhood,
        age: user.age,
        photoUrl: user.photoUrl,
        interests: user.interests,
        activityStyle: user.activityStyle,
        energy: user.energy,
        activeTonight: user.activeTonight === true,
      }
    : {
        id: userId,
        name: "Someone",
        city: "Miami",
        neighborhood: "Miami",
        interests: [],
        activityStyle: [],
        energy: "Social",
        activeTonight: false,
      };
}

function pairNames(db: JsonDb, pair: DoubleDatePair) {
  return pairMembers(pair).map((userId) => decorateUser(db, userId).name);
}

function scorePair(db: JsonDb, pair: DoubleDatePair, viewerPair?: DoubleDatePair) {
  if (!viewerPair) return 0;
  const viewerTags = new Set((viewerPair.vibeTags ?? []).map((tag) => tag.toLowerCase()));
  const sharedTags = (pair.vibeTags ?? []).filter((tag) => viewerTags.has(tag.toLowerCase())).length;
  const viewerNeighborhoods = new Set(pairMembers(viewerPair).map((userId) => getUser(db, userId)?.neighborhood));
  const sameLocation = pairMembers(pair).some((userId) => viewerNeighborhoods.has(getUser(db, userId)?.neighborhood));
  const viewerInterests = new Set(pairMembers(viewerPair).flatMap((userId) => getUser(db, userId)?.interests ?? []).map((item) => item.toLowerCase()));
  const mutualInterests = pairMembers(pair)
    .flatMap((userId) => getUser(db, userId)?.interests ?? [])
    .filter((interest) => viewerInterests.has(interest.toLowerCase())).length;
  const activeTonight = pairMembers(pair).some((userId) => getUser(db, userId)?.activeTonight);
  return sharedTags * 22 + mutualInterests * 10 + (sameLocation ? 18 : 0) + (activeTonight ? 14 : 0);
}

function decoratePair(db: JsonDb, pair: DoubleDatePair, viewerPair?: DoubleDatePair) {
  const normalized = normalizePair(pair);
  const users = pairMembers(normalized).map((userId) => decorateUser(db, userId));
  const viewerTags = new Set((viewerPair?.vibeTags ?? []).map((tag) => tag.toLowerCase()));
  const sharedVibeTags = (normalized.vibeTags ?? []).filter((tag) => viewerTags.has(tag.toLowerCase()));
  const neighborhoods = unique(users.map((user) => user.neighborhood).filter(Boolean));
  const viewerNeighborhoods = new Set(
    (viewerPair ? pairMembers(viewerPair) : []).map((userId) => getUser(db, userId)?.neighborhood).filter((item): item is string => Boolean(item)),
  );
  const nearby = neighborhoods.find((item) => viewerNeighborhoods.has(item));
  const compatibilityHints = [
    sharedVibeTags.length ? `${sharedVibeTags.length} shared vibes` : undefined,
    nearby ? `Both around ${nearby}` : neighborhoods[0] ? `${neighborhoods[0]} energy` : undefined,
    users.some((user) => user.activeTonight) ? "Ready tonight" : "Good group-date pace",
  ].filter((hint): hint is string => Boolean(hint));

  return {
    ...normalized,
    users,
    names: pairNames(db, normalized),
    location: neighborhoods.join(" + ") || "Miami",
    activeTonight: users.some((user) => user.activeTonight),
    sharedVibeTags,
    compatibilityHints,
    score: scorePair(db, normalized, viewerPair),
  };
}

function areConnected(db: JsonDb, userAId: string, userBId: string) {
  return db.connections.some((connection) => {
    const ids = connectionIds(connection);
    return ids.includes(userAId) && ids.includes(userBId);
  });
}

function connectedFriends(db: JsonDb, userId: string) {
  return db.connections
    .map((connection) => {
      const ids = connectionIds(connection);
      if (ids[0] === userId) return ids[1];
      if (ids[1] === userId) return ids[0];
      return null;
    })
    .filter((id): id is string => Boolean(id))
    .map((id) => decorateUser(db, id));
}

function pairIsActive(pair: DoubleDatePair) {
  return pair.active !== false && pair.status !== "paused";
}

function activePairForUser(db: JsonDb, userId: string) {
  return db.doubleDatePairs.find((pair) => pairIsActive(pair) && pairMembers(pair).includes(userId));
}

function pairIncludesBlockedUser(db: JsonDb, pair: DoubleDatePair, viewerUserIds: string[]) {
  return pairMembers(pair).some((candidateUserId) =>
    db.blockedUsers.some(
      (block) =>
        (viewerUserIds.includes(block.userId) && block.blockedUserId === candidateUserId) ||
        (viewerUserIds.includes(block.blockedUserId) && block.userId === candidateUserId),
    ),
  );
}

function existingMatch(db: JsonDb, pairAId: string, pairBId: string) {
  return db.doubleDateMatches.find((match) => {
    const pairIds = match.pairIds ?? [match.pairOneId, match.pairTwoId];
    return pairIds.includes(pairAId) && pairIds.includes(pairBId);
  });
}

function createDoubleDatePair(db: JsonDb, userId: string, friendId: string) {
  if (!userId || !friendId) throw new Error("Missing pair information");
  if (userId === friendId) throw new Error("Pick a different friend");
  if (activePairForUser(db, userId)) throw new Error("You already have an active double date pair");
  if (activePairForUser(db, friendId)) throw new Error("That friend already has an active double date pair");
  if (db.connections.length > 0 && !areConnected(db, userId, friendId)) throw new Error("Double date buddies must be connected friends");

  const now = new Date().toISOString();
  const pair: DoubleDatePair = {
    id: randomUUID(),
    active: true,
    status: "active",
    userIds: [userId, friendId],
    memberIds: [userId, friendId],
    createdBy: userId,
    vibeTags: ["Dinner", "Social", "Plan-ready"],
    createdAt: now,
    updatedAt: now,
  };
  db.doubleDatePairs.unshift(pair);
  return pair;
}

function createGroupChatForMatch(db: JsonDb, currentPair: DoubleDatePair, targetPair: DoubleDatePair) {
  const now = new Date().toISOString();
  const existing = existingMatch(db, currentPair.id, targetPair.id);
  if (existing) {
    return { match: normalizeMatch(existing), chat: db.chats.find((chat) => chat.id === existing.chatId), alreadyMatched: true };
  }

  const allMembers = unique([...pairMembers(currentPair), ...pairMembers(targetPair)]);
  if (allMembers.length !== 4) throw new Error("Double date matches require 4 unique users");

  const chat: Chat = {
    id: randomUUID(),
    type: "double_date",
    title: "Double Date Match",
    participantIds: allMembers,
    createdAt: now,
    updatedAt: now,
  };
  const match: DoubleDateMatch = {
    id: randomUUID(),
    pairOneId: currentPair.id,
    pairTwoId: targetPair.id,
    pairIds: [currentPair.id, targetPair.id],
    userIds: allMembers as [string, string, string, string],
    chatId: chat.id,
    createdAt: now,
  };

  db.chats.unshift(chat);
  for (const userId of allMembers) {
    if (!db.chatMembers.some((member) => member.chatId === chat.id && member.userId === userId)) {
      db.chatMembers.push({ id: randomUUID(), chatId: chat.id, userId });
    }
  }
  db.messages.push({
    id: randomUUID(),
    chatId: chat.id,
    senderId: "system",
    senderUserId: "system",
    text: SYSTEM_MATCH_MESSAGE,
    createdAt: now,
    system: true,
  });
  db.doubleDateMatches.unshift(match);
  return { match, chat, alreadyMatched: false };
}

function swipeDoubleDatePair({
  db,
  currentPairId,
  targetPairId,
  direction,
  currentUserId,
}: {
  db: JsonDb;
  currentPairId: string;
  targetPairId: string;
  direction: SwipeDirection;
  currentUserId: string;
}) {
  if (!currentPairId || !targetPairId) throw new Error("Missing pair information");
  if (currentPairId === targetPairId) throw new Error("You cannot swipe on your own pair");

  const currentPair = db.doubleDatePairs.find((pair) => pair.id === currentPairId);
  const targetPair = db.doubleDatePairs.find((pair) => pair.id === targetPairId);
  if (!currentPair || !targetPair) throw new Error("Pair not found");
  if (!pairIsActive(currentPair) || !pairIsActive(targetPair)) throw new Error("Both pairs must be active");
  if (!pairMembers(currentPair).includes(currentUserId)) throw new Error("Only a pair member can swipe");
  if (pairMembers(currentPair).some((userId) => pairMembers(targetPair).includes(userId))) throw new Error("Pairs cannot share members");

  const existingSwipe = db.doubleDateSwipes.find((swipe) => swipe.swiperPairId === currentPairId && swipe.targetPairId === targetPairId);
  const swipe: DoubleDateSwipe =
    existingSwipe ??
    {
      id: randomUUID(),
      swiperPairId: currentPairId,
      targetPairId,
      direction,
      createdBy: currentUserId,
      createdAt: new Date().toISOString(),
    };
  if (existingSwipe) {
    existingSwipe.direction = direction;
    existingSwipe.createdBy = currentUserId;
  } else {
    db.doubleDateSwipes.push(swipe);
  }

  if (direction === "pass") return { matched: false as const, swipe };

  const reverseLike = db.doubleDateSwipes.find(
    (item) => item.swiperPairId === targetPairId && item.targetPairId === currentPairId && item.direction === "like",
  );
  if (!reverseLike) return { matched: false as const, swipe };

  const existing = existingMatch(db, currentPairId, targetPairId);
  if (existing) {
    return {
      matched: true as const,
      match: normalizeMatch(existing),
      chat: db.chats.find((chat) => chat.id === existing.chatId),
      alreadyMatched: true,
    };
  }

  return { matched: true as const, ...createGroupChatForMatch(db, currentPair, targetPair) };
}

router.get("/dating/double-date/pair/:userId", (req, res) => {
  const db = readDb();
  const userId = req.params.userId;
  const pair = activePairForUser(db, userId);
  return res.json({
    pair: pair ? decoratePair(db, pair) : null,
    connectedFriends: connectedFriends(db, userId),
  });
});

router.post("/dating/double-date/pair/create", (req, res) => {
  const db = readDb();
  try {
    const userId = String(req.body?.userId ?? "").trim();
    const friendId = String(req.body?.friendId ?? req.body?.buddyUserId ?? "").trim();
    const pair = createDoubleDatePair(db, userId, friendId);
    writeDb(db);
    return res.status(201).json({ pair: decoratePair(db, pair), connectedFriends: connectedFriends(db, userId) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create double date pair";
    const status = message.includes("already") ? 409 : message.includes("connected") ? 403 : 400;
    return res.status(status).json({ error: message });
  }
});

router.post("/dating/double-date/pair/pause", (req, res) => {
  const db = readDb();
  const pairId = String(req.body?.pairId ?? "").trim();
  const userId = String(req.body?.userId ?? "").trim();
  const pair = db.doubleDatePairs.find((item) => item.id === pairId);
  if (!pair) return res.status(404).json({ error: "Pair not found" });
  if (!pairMembers(pair).includes(userId)) return res.status(403).json({ error: "Only a pair member can change this pair" });
  pair.active = false;
  pair.status = "paused";
  pair.updatedAt = new Date().toISOString();
  writeDb(db);
  return res.json({ pair: decoratePair(db, pair) });
});

router.get("/dating/double-date/feed/:pairId", (req, res) => {
  const db = readDb();
  const pair = db.doubleDatePairs.find((item) => item.id === req.params.pairId);
  if (!pair) return res.status(404).json({ error: "Pair not found" });

  const viewerIds = pairMembers(pair);
  const swipedPairIds = new Set(db.doubleDateSwipes.filter((swipe) => swipe.swiperPairId === pair.id).map((swipe) => swipe.targetPairId));
  const matchedPairIds = new Set(
    db.doubleDateMatches
      .filter((match) => (match.pairIds ?? [match.pairOneId, match.pairTwoId]).includes(pair.id))
      .flatMap((match) => (match.pairIds ?? [match.pairOneId, match.pairTwoId]).filter((id): id is string => Boolean(id) && id !== pair.id)),
  );

  const pairs = db.doubleDatePairs
    .filter((candidate) => pairIsActive(candidate))
    .filter((candidate) => candidate.id !== pair.id)
    .filter((candidate) => !pairMembers(candidate).some((userId) => viewerIds.includes(userId)))
    .filter((candidate) => !swipedPairIds.has(candidate.id))
    .filter((candidate) => !matchedPairIds.has(candidate.id))
    .filter((candidate) => !pairIncludesBlockedUser(db, candidate, viewerIds))
    .map((candidate) => decoratePair(db, candidate, pair))
    .sort((a, b) => b.score - a.score);

  return res.json({ pairs });
});

function handleSwipeRequest(req: Request, res: Response) {
  const db = readDb();
  try {
    const currentPairId = String(req.body?.currentPairId ?? req.body?.fromPairId ?? "").trim();
    const targetPairId = String(req.body?.targetPairId ?? req.body?.toPairId ?? "").trim();
    const result = swipeDoubleDatePair({
      db,
      currentPairId,
      targetPairId,
      direction: req.body?.direction === "pass" ? "pass" : "like",
      currentUserId: String(req.body?.currentUserId ?? "").trim(),
    });
    writeDb(db);
    if (!result.matched) return res.json(result);
    const currentPair = db.doubleDatePairs.find((pair) => pair.id === currentPairId);
    const targetPair = db.doubleDatePairs.find((pair) => pair.id === targetPairId);
    return res.json({
      ...result,
      otherPair: targetPair ? decoratePair(db, targetPair, currentPair) : undefined,
      allUsers: result.match.userIds.map((userId) => decorateUser(db, userId)),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Swipe failed";
    const status = message.includes("not found") ? 404 : message.includes("Only") ? 403 : 400;
    return res.status(status).json({ error: message });
  }
}

router.post("/dating/double-date/swipe", handleSwipeRequest);

router.post("/dating/double-date/pass", (req, res) => {
  req.body.direction = "pass";
  req.body.currentPairId = req.body.currentPairId ?? req.body.fromPairId;
  req.body.targetPairId = req.body.targetPairId ?? req.body.toPairId;
  return handleSwipeRequest(req, res);
});

router.post("/dating/double-date/like", (req, res) => {
  req.body.direction = "like";
  req.body.currentPairId = req.body.currentPairId ?? req.body.fromPairId;
  req.body.targetPairId = req.body.targetPairId ?? req.body.toPairId;
  return handleSwipeRequest(req, res);
});

export default router;
