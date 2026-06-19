import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { Router, type Request, type Response } from "express";
import { sendConnectThreadPush } from "../lib/connectPushNotifications";
import { getPushToken } from "./notifications";

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
  {
    id: "user-jade",
    name: "Jade Williams",
    city: "Miami",
    neighborhood: "Edgewater",
    age: 25,
    photoUrl: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=800&q=85",
    interests: ["art", "galleries", "rooftops", "sushi"],
    activityStyle: ["creative", "evening", "social"],
    energy: "Gallery-to-rooftop type",
    activeTonight: true,
  },
  {
    id: "user-marcus",
    name: "Marcus Cole",
    city: "Miami",
    neighborhood: "Wynwood",
    age: 29,
    photoUrl: "https://images.unsplash.com/photo-1463453091185-61582044d556?auto=format&fit=crop&w=800&q=85",
    interests: ["art", "sneakers", "basketball", "nightlife"],
    activityStyle: ["active", "evening", "group"],
    energy: "Always has a plan",
    activeTonight: true,
  },
  {
    id: "user-amara",
    name: "Amara Diallo",
    city: "Miami",
    neighborhood: "Little Haiti",
    age: 26,
    photoUrl: "https://images.unsplash.com/photo-1526510747491-58f928ec870f?auto=format&fit=crop&w=800&q=85",
    interests: ["dancing", "food", "travel", "live music"],
    activityStyle: ["social", "evening", "energetic"],
    energy: "Soca & sushi on Fridays",
    activeTonight: true,
  },
  {
    id: "user-ryan",
    name: "Ryan Torres",
    city: "Fort Lauderdale",
    neighborhood: "Las Olas",
    age: 28,
    photoUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=85",
    interests: ["boats", "fishing", "bars", "beach"],
    activityStyle: ["outdoors", "daytime", "casual"],
    energy: "Boat day to sunset bar",
    activeTonight: false,
  },
  {
    id: "user-camille",
    name: "Camille Fontaine",
    city: "Miami",
    neighborhood: "South Beach",
    age: 24,
    photoUrl: "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?auto=format&fit=crop&w=800&q=85",
    interests: ["fashion", "dancing", "sushi", "photography"],
    activityStyle: ["evening", "social", "spontaneous"],
    energy: "SoBe nights all week",
    activeTonight: true,
  },
  {
    id: "user-darius",
    name: "Darius King",
    city: "Miami",
    neighborhood: "Overtown",
    age: 27,
    photoUrl: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=800&q=85",
    interests: ["music production", "boxing", "food", "nightlife"],
    activityStyle: ["creative", "evening", "fast-plans"],
    energy: "Studio to streets",
    activeTonight: true,
  },
  {
    id: "user-isla",
    name: "Isla Monroe",
    city: "Fort Lauderdale",
    neighborhood: "Victoria Park",
    age: 26,
    photoUrl: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=800&q=85",
    interests: ["yoga", "brunch", "travel", "wine"],
    activityStyle: ["daytime", "relaxed", "small-group"],
    energy: "Brunch is a lifestyle",
    activeTonight: false,
  },
  {
    id: "user-kai",
    name: "Kai Nakamura",
    city: "Miami",
    neighborhood: "Brickell",
    age: 28,
    photoUrl: "https://images.unsplash.com/photo-1500048993953-d23a436266cf?auto=format&fit=crop&w=800&q=85",
    interests: ["tech", "rooftops", "DJing", "sushi"],
    activityStyle: ["evening", "social", "group"],
    energy: "Tech by day, rooftop by night",
    activeTonight: true,
  },
  {
    id: "user-zara",
    name: "Zara Hassan",
    city: "Miami",
    neighborhood: "Coral Gables",
    age: 25,
    photoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=85",
    interests: ["tennis", "fine dining", "travel", "fashion"],
    activityStyle: ["planned", "upscale", "small-group"],
    energy: "Classy but spontaneous",
    activeTonight: true,
  },
  {
    id: "user-theo",
    name: "Theo Martinez",
    city: "Miami",
    neighborhood: "Little Havana",
    age: 30,
    photoUrl: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&w=800&q=85",
    interests: ["salsa", "food", "cigars", "live music"],
    activityStyle: ["evening", "cultural", "group"],
    energy: "Little Havana on a Friday",
    activeTonight: true,
  },
  {
    id: "user-ana",
    name: "Ana Souza",
    city: "Miami",
    neighborhood: "Brickell",
    age: 26,
    photoUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=800&q=85",
    interests: ["fitness", "brunch", "beach", "nightlife"],
    activityStyle: ["social", "morning", "evening"],
    energy: "Spin class then happy hour",
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
      vibeTags: ["Nightlife 🎉", "Rooftops 🌆", "Sushi 🍣", "Active Tonight ⚡"],
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
      vibeTags: ["Brunch 🥂", "Beach 🏖️", "Travel ✈️", "Weekend Plans 📅"],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "pair-wynwood",
      active: true,
      status: "active",
      userIds: ["user-jade", "user-marcus"],
      memberIds: ["user-jade", "user-marcus"],
      createdBy: "user-jade",
      vibeTags: ["Art & Culture 🎨", "Nightlife 🎉", "Live Music 🎶", "Active Tonight ⚡"],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "pair-caribbean",
      active: true,
      status: "active",
      userIds: ["user-amara", "user-darius"],
      memberIds: ["user-amara", "user-darius"],
      createdBy: "user-amara",
      vibeTags: ["Dancing 💃", "Live Music 🎶", "Dinner 🍽️", "Active Tonight ⚡"],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "pair-broward",
      active: true,
      status: "active",
      userIds: ["user-ryan", "user-isla"],
      memberIds: ["user-ryan", "user-isla"],
      createdBy: "user-ryan",
      vibeTags: ["Beach 🏖️", "Brunch 🥂", "Chill Vibes 😌", "Weekend Plans 📅"],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "pair-sobe",
      active: true,
      status: "active",
      userIds: ["user-camille", "user-kai"],
      memberIds: ["user-camille", "user-kai"],
      createdBy: "user-camille",
      vibeTags: ["Nightlife 🎉", "Sushi 🍣", "Rooftops 🌆", "Active Tonight ⚡"],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "pair-gables",
      active: true,
      status: "active",
      userIds: ["user-zara", "user-nina"],
      memberIds: ["user-zara", "user-nina"],
      createdBy: "user-zara",
      vibeTags: ["Dinner 🍽️", "Travel ✈️", "Active Tonight ⚡", "Chill Vibes 😌"],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "pair-havana",
      active: true,
      status: "active",
      userIds: ["user-theo", "user-omar"],
      memberIds: ["user-theo", "user-omar"],
      createdBy: "user-theo",
      vibeTags: ["Live Music 🎶", "Dancing 💃", "Dinner 🍽️", "Active Tonight ⚡"],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "pair-brickell-fit",
      active: true,
      status: "active",
      userIds: ["user-ana", "user-maya"],
      memberIds: ["user-ana", "user-maya"],
      createdBy: "user-ana",
      vibeTags: ["Brunch 🥂", "Nightlife 🎉", "Active Tonight ⚡", "Rooftops 🌆"],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "pair-grove",
      active: true,
      status: "active",
      userIds: ["user-lucas", "user-kai"],
      memberIds: ["user-lucas", "user-kai"],
      createdBy: "user-lucas",
      vibeTags: ["Beach 🏖️", "Live Music 🎶", "Chill Vibes 😌", "Sushi 🍣"],
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

function sendDoubleDateMatchPush(db: JsonDb, userId: string, chatId: string, matchId: string) {
  const token = getPushToken(userId);
  if (!token) return;
  void sendConnectThreadPush({
    to: token,
    kind: "double_date_match",
    chatId,
    title: "Double Date Match",
    body: "Your group chat is ready in Connect",
    data: { doubleDateMatchId: matchId, userId },
  }).catch(() => {});
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

function createDoubleDatePair(db: JsonDb, userId: string, friendId: string, vibeTags?: string[]) {
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
    vibeTags: vibeTags && vibeTags.length > 0 ? vibeTags : ["Social", "Plan-ready"],
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
  allMembers.forEach((userId) => sendDoubleDateMatchPush(db, userId, chat.id, match.id));
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

  // Mutual like — create the match
  const { match, chat, alreadyMatched } = createGroupChatForMatch(db, currentPair, targetPair);
  return {
    matched: true as const,
    match,
    chat,
    otherPair: decoratePair(db, targetPair, currentPair),
    allUsers: unique([...pairMembers(currentPair), ...pairMembers(targetPair)]).map((userId) => decorateUser(db, userId)),
    alreadyMatched,
    swipe,
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /pair/:userId
router.get("/pair/:userId", (req: Request, res: Response) => {
  const db = readDb();
  const userId = String(req.params.userId ?? "");
  const pair = activePairForUser(db, userId);
  const friends = connectedFriends(db, userId);
  if (!pair) return res.json({ pair: null, connectedFriends: friends });
  return res.json({ pair: decoratePair(db, pair), connectedFriends: friends });
});

// POST /pair/create
router.post("/pair/create", (req: Request, res: Response) => {
  const db = readDb();
  const { userId, friendId, buddyUserId, vibeTags = [] } = req.body as {
    userId: string;
    friendId?: string;
    buddyUserId?: string;
    vibeTags?: string[];
  };
  const buddy = friendId ?? buddyUserId;
  if (!userId || !buddy) return res.status(400).json({ error: "userId and friendId required" });

  // Pause any existing active pair for these users
  for (const pair of db.doubleDatePairs) {
    if (pairIsActive(pair) && (pairMembers(pair).includes(userId) || pairMembers(pair).includes(buddy))) {
      pair.active = false;
      pair.status = "paused";
    }
  }

  const now = new Date().toISOString();
  const newPair: DoubleDatePair = {
    id: randomUUID(),
    active: true,
    status: "active",
    userIds: [userId, buddy],
    memberIds: [userId, buddy],
    createdBy: userId,
    vibeTags: vibeTags.length ? vibeTags : ["Social", "Plan-ready"],
    createdAt: now,
    updatedAt: now,
  };
  db.doubleDatePairs.push(newPair);
  writeDb(db);
  return res.status(201).json({ pair: decoratePair(db, newPair), connectedFriends: connectedFriends(db, userId) });
});

// POST /pair/pause
router.post("/pair/pause", (req: Request, res: Response) => {
  const db = readDb();
  const { pairId, userId } = req.body as { pairId: string; userId: string };
  const pair = db.doubleDatePairs.find((p) => p.id === pairId);
  if (!pair) return res.status(404).json({ error: "Pair not found" });
  if (!pairMembers(pair).includes(userId)) return res.status(403).json({ error: "Not a pair member" });
  pair.active = false;
  pair.status = "paused";
  pair.updatedAt = new Date().toISOString();
  writeDb(db);
  return res.json({ pair: decoratePair(db, pair) });
});

// GET /feed/:pairId
router.get("/feed/:pairId", (req: Request, res: Response) => {
  const db = readDb();
  const { pairId } = req.params;
  const viewerPair = db.doubleDatePairs.find((p) => p.id === pairId);
  if (!viewerPair) return res.status(404).json({ error: "Pair not found" });

  const alreadySwiped = new Set(
    db.doubleDateSwipes.filter((s) => s.swiperPairId === pairId).map((s) => s.targetPairId),
  );
  const viewerMembers = pairMembers(viewerPair);

  const feed = db.doubleDatePairs
    .filter((p) => {
      if (p.id === pairId) return false;
      if (!pairIsActive(p)) return false;
      if (alreadySwiped.has(p.id)) return false;
      if (pairMembers(p).some((uid) => viewerMembers.includes(uid))) return false;
      if (pairIncludesBlockedUser(db, p, viewerMembers)) return false;
      return true;
    })
    .map((p) => decoratePair(db, p, viewerPair))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  return res.json({ pairs: feed });
});

// POST /swipe
router.post("/swipe", (req: Request, res: Response) => {
  const db = readDb();
  const { currentPairId, targetPairId, direction, currentUserId } = req.body as {
    currentPairId: string;
    targetPairId: string;
    direction: SwipeDirection;
    currentUserId: string;
  };
  try {
    const result = swipeDoubleDatePair({ db, currentPairId, targetPairId, direction, currentUserId });
    writeDb(db);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Swipe failed" });
  }
});

// POST /shot
router.post("/shot", (req: Request, res: Response) => {
  const db = readDb();
  const { fromPairId, toPairId, message } = req.body as { fromPairId: string; toPairId: string; message?: string };
  if (!fromPairId || !toPairId) return res.status(400).json({ error: "fromPairId and toPairId required" });
  try {
    const result = swipeDoubleDatePair({
      db,
      currentPairId: fromPairId,
      targetPairId: toPairId,
      direction: "like",
      currentUserId: "user_self",
    });
    if (result.matched && message) {
      const chatId = result.match.chatId;
      db.messages.push({
        id: randomUUID(),
        chatId,
        senderId: "user_self",
        senderUserId: "user_self",
        text: message,
        createdAt: new Date().toISOString(),
        system: false,
      });
    }
    writeDb(db);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Shot failed" });
  }
});

// GET /pending/:pairId  — pairs that have liked this pair but we haven't liked back yet
router.get("/pending/:pairId", (req: Request, res: Response) => {
  const db = readDb();
  const { pairId } = req.params;
  const viewerPair = db.doubleDatePairs.find((p) => p.id === pairId);
  if (!viewerPair) return res.status(404).json({ error: "Pair not found" });

  const likedUsIds = new Set(
    db.doubleDateSwipes
      .filter((s) => s.targetPairId === pairId && s.direction === "like")
      .map((s) => s.swiperPairId),
  );
  const alreadyLikedBack = new Set(
    db.doubleDateSwipes
      .filter((s) => s.swiperPairId === pairId && s.direction === "like")
      .map((s) => s.targetPairId),
  );

  const pending = db.doubleDatePairs
    .filter((p) => likedUsIds.has(p.id) && !alreadyLikedBack.has(p.id) && pairIsActive(p))
    .map((p) => decoratePair(db, p, viewerPair));

  return res.json({ pairs: pending });
});

// POST /undo
router.post("/undo", (req: Request, res: Response) => {
  const db = readDb();
  const { pairId } = req.body as { pairId: string };
  if (!pairId) return res.status(400).json({ error: "pairId required" });

  // Remove the most recent swipe by this pair
  const swipes = db.doubleDateSwipes.filter((s) => s.swiperPairId === pairId);
  if (swipes.length === 0) return res.status(404).json({ error: "No swipe to undo" });

  const last = swipes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  db.doubleDateSwipes = db.doubleDateSwipes.filter((s) => s.id !== last.id);
  writeDb(db);
  return res.json({ undone: last });
});

export default router;
