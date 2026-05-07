import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { getAuth } from "@clerk/express";
import { Router } from "express";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { db, matchesTable, messagesTable, profilesTable } from "@workspace/db";

const router = Router();
const PLAN_PREFIX = "Date idea:";
const SHOT_LIMIT = 3;
const dbPath = join(process.cwd(), "artifacts", "api-server", "db.json");

type DatingShotStatus = "pending" | "accepted" | "sparked_back" | "ignored";

type DatingShot = {
  id: string;
  fromUserId: string;
  toUserId: string;
  message: string;
  status: DatingShotStatus;
  createdAt: string;
  respondedAt?: string;
};

type ShotUsage = {
  userId: string;
  date: string;
  count: number;
};

type JsonDb = {
  users?: unknown[];
  friendPosts?: unknown[];
  postComments?: unknown[];
  postLikes?: unknown[];
  connectionRequests?: unknown[];
  connections?: unknown[];
  plans?: unknown[];
  planMembers?: unknown[];
  chats?: Array<{ id: string; planId?: string; createdAt: string }>;
  chatMembers?: Array<{ id: string; chatId: string; userId: string }>;
  messages?: Array<{ id: string; chatId: string; senderUserId: string; text: string; createdAt: string; system?: boolean }>;
  userBehavior?: unknown[];
  datingShots?: DatingShot[];
  datingMatches?: Array<{ id: string; userAId: string; userBId: string; createdAt: string; shotId?: string }>;
  shotUsage?: ShotUsage[];
};

function defaultJsonDb(): JsonDb {
  return {
    users: [],
    friendPosts: [],
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
    datingShots: [],
    datingMatches: [],
    shotUsage: [],
  };
}

function readJsonDb(): JsonDb {
  const base = defaultJsonDb();
  if (!existsSync(dbPath)) {
    writeJsonDb(base);
    return base;
  }

  const parsed = JSON.parse(readFileSync(dbPath, "utf8")) as JsonDb;
  return {
    ...base,
    ...parsed,
    datingShots: parsed.datingShots ?? [],
    datingMatches: parsed.datingMatches ?? [],
    shotUsage: parsed.shotUsage ?? [],
    chats: parsed.chats ?? [],
    chatMembers: parsed.chatMembers ?? [],
    messages: parsed.messages ?? [],
  };
}

function writeJsonDb(data: JsonDb) {
  mkdirSync(dirname(dbPath), { recursive: true });
  writeFileSync(dbPath, `${JSON.stringify(data, null, 2)}\n`);
}

function authUserId(req: Parameters<typeof getAuth>[0], fallback?: string) {
  const { userId } = getAuth(req);
  return userId ?? fallback;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function ageFromBirthDate(birthDate?: string | null) {
  if (!birthDate) return undefined;
  return Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

async function getOrCreateMatch(userId: string, otherUserId: string) {
  const [existingMatch] = await db
    .select()
    .from(matchesTable)
    .where(
      sql`(${matchesTable.userId1} = ${userId} AND ${matchesTable.userId2} = ${otherUserId}) OR (${matchesTable.userId1} = ${otherUserId} AND ${matchesTable.userId2} = ${userId})`,
    )
    .limit(1);

  if (existingMatch) return existingMatch;

  const [match] = await db
    .insert(matchesTable)
    .values({ id: randomUUID(), userId1: userId, userId2: otherUserId })
    .returning();

  return match;
}

async function getProfile(userId: string) {
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);

  return profile
    ? {
        ...profile,
        age: ageFromBirthDate(profile.birthDate),
      }
    : undefined;
}

async function decorateShot(shot: DatingShot, side: "sender" | "receiver") {
  const profile = await getProfile(side === "sender" ? shot.fromUserId : shot.toUserId);
  return side === "sender"
    ? { ...shot, senderProfile: profile }
    : { ...shot, receiverProfile: profile };
}

function ensureJsonChatRecords(data: JsonDb, matchId: string, userAId: string, userBId: string, shot: DatingShot, sparkedBack: boolean) {
  const now = new Date().toISOString();
  data.datingMatches ??= [];
  data.chats ??= [];
  data.chatMembers ??= [];
  data.messages ??= [];

  if (!data.datingMatches.some((match) => match.id === matchId)) {
    data.datingMatches.push({ id: matchId, userAId, userBId, createdAt: now, shotId: shot.id });
  }
  if (!data.chats.some((chat) => chat.id === matchId)) {
    data.chats.push({ id: matchId, createdAt: now });
  }
  for (const userId of [userAId, userBId]) {
    const hasMember = data.chatMembers.some((member) => member.chatId === matchId && member.userId === userId);
    if (!hasMember) data.chatMembers.push({ id: randomUUID(), chatId: matchId, userId });
  }
  const shotMessageExists = data.messages.some((message) => message.chatId === matchId && message.id === `shot:${shot.id}`);
  if (!shotMessageExists) {
    data.messages.push({
      id: `shot:${shot.id}`,
      chatId: matchId,
      senderUserId: shot.fromUserId,
      text: shot.message,
      createdAt: shot.createdAt,
    });
  }
  if (sparkedBack) {
    data.messages.push({
      id: randomUUID(),
      chatId: matchId,
      senderUserId: "system",
      text: "Sparked back ⚡",
      createdAt: now,
      system: true,
    });
  }
}

function parsePlanContent(content: string) {
  const [firstLine = content, ...detailLines] = content.split("\n");
  const parsed = {
    title: firstLine.replace(PLAN_PREFIX, "").trim() || "Date idea",
    place: undefined as string | undefined,
    time: undefined as string | undefined,
    reason: undefined as string | undefined,
  };

  const reasonLines: string[] = [];
  for (const line of detailLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("Place:")) {
      parsed.place = trimmed.replace("Place:", "").trim() || undefined;
    } else if (trimmed.startsWith("Time:")) {
      parsed.time = trimmed.replace("Time:", "").trim() || undefined;
    } else {
      reasonLines.push(trimmed);
    }
  }
  parsed.reason = reasonLines.join("\n") || undefined;

  return parsed;
}

router.get("/dating/plans", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const userMatches = await db
    .select()
    .from(matchesTable)
    .where(or(eq(matchesTable.userId1, userId), eq(matchesTable.userId2, userId)))
    .orderBy(desc(matchesTable.matchedAt))
    .limit(100);

  if (userMatches.length === 0) return res.json({ plans: [] });

  const plans = (
    await Promise.all(
      userMatches.map(async (match) => {
        const otherUserId = match.userId1 === userId ? match.userId2 : match.userId1;
        const otherProfile = await getProfile(otherUserId);
        const messages = await db
          .select()
          .from(messagesTable)
          .where(and(eq(messagesTable.matchId, match.id), sql`${messagesTable.content} LIKE ${`${PLAN_PREFIX}%`}`))
          .orderBy(desc(messagesTable.createdAt))
          .limit(10);

        return messages.map((message) => {
          const parsed = parsePlanContent(message.content);
          return {
            id: String(message.id),
            matchId: match.id,
            chatId: match.id,
            title: parsed.title,
            place: parsed.place,
            time: parsed.time,
            reason: parsed.reason,
            note: message.content,
            createdAt: message.createdAt.toISOString(),
            profile: otherProfile,
            status: "active" as const,
          };
        });
      }),
    )
  )
    .flat()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return res.json({ plans });
});

router.post("/dating/plans/create", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const targetUserId = typeof req.body?.targetUserId === "string" ? req.body.targetUserId.trim() : "";
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const place = typeof req.body?.place === "string" ? req.body.place.trim() : "";
  const time = typeof req.body?.time === "string" ? req.body.time.trim() : "";
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";

  if (!targetUserId || !title) {
    return res.status(400).json({ error: "targetUserId and title are required" });
  }
  if (targetUserId === userId) {
    return res.status(400).json({ error: "You cannot create a date plan with yourself" });
  }

  const otherProfile = await getProfile(targetUserId);
  if (!otherProfile) return res.status(404).json({ error: "Profile not found" });

  const match = await getOrCreateMatch(userId, targetUserId);
  const details = [place ? `Place: ${place}` : "", time ? `Time: ${time}` : "", reason].filter(Boolean);
  const content = `${PLAN_PREFIX} ${title}${details.length ? `\n${details.join("\n")}` : ""}`;
  const [message] = await db
    .insert(messagesTable)
    .values({
      matchId: match.id,
      senderId: userId,
      content,
      isRead: false,
    })
    .returning();

  return res.status(201).json({
    plan: {
      id: String(message.id),
      matchId: match.id,
      chatId: match.id,
      title,
      place: place || undefined,
      time: time || undefined,
      reason: reason || undefined,
      note: content,
      createdAt: message.createdAt.toISOString(),
      profile: otherProfile,
      status: "active",
    },
    match,
  });
});

router.post("/dating/shots/send", async (req, res) => {
  const fromUserId = authUserId(req, typeof req.body?.fromUserId === "string" ? req.body.fromUserId.trim() : undefined);
  const toUserId = typeof req.body?.toUserId === "string" ? req.body.toUserId.trim() : "";
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";

  if (!fromUserId) return res.status(401).json({ error: "Unauthorized" });
  if (!toUserId || !message) return res.status(400).json({ error: "toUserId and message are required" });
  if (fromUserId === toUserId) return res.status(400).json({ error: "You cannot send a Shot to yourself" });
  if (message.length > 120) return res.status(400).json({ error: "Shot must be 120 characters or fewer" });

  const data = readJsonDb();
  data.datingShots ??= [];
  data.shotUsage ??= [];

  const duplicate = data.datingShots.find(
    (shot) => shot.fromUserId === fromUserId && shot.toUserId === toUserId && shot.status === "pending",
  );
  if (duplicate) {
    return res.status(409).json({ error: "You already have a pending Shot with this person", shot: duplicate });
  }

  const profile = await getProfile(fromUserId);
  const date = todayKey();
  const usage = data.shotUsage.find((item) => item.userId === fromUserId && item.date === date);
  const used = usage?.count ?? 0;
  if (!profile?.isPremium && used >= SHOT_LIMIT) {
    return res.status(402).json({
      error: "Daily Shot limit reached",
      code: "SHOT_LIMIT_REACHED",
      remainingShots: 0,
      premiumRequired: true,
    });
  }

  const shot: DatingShot = {
    id: randomUUID(),
    fromUserId,
    toUserId,
    message,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  data.datingShots.unshift(shot);
  if (usage) usage.count += 1;
  else data.shotUsage.push({ userId: fromUserId, date, count: 1 });
  writeJsonDb(data);

  return res.status(201).json({
    success: true,
    shot,
    remainingShots: profile?.isPremium ? null : Math.max(0, SHOT_LIMIT - (used + 1)),
  });
});

router.get("/dating/shots/incoming/:userId", async (req, res) => {
  const userId = authUserId(req, req.params.userId);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const data = readJsonDb();
  const pending = (data.datingShots ?? [])
    .filter((shot) => shot.toUserId === userId && shot.status === "pending")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const shots = await Promise.all(pending.map((shot) => decorateShot(shot, "sender")));

  return res.json({ shots });
});

router.get("/dating/shots/sent/:userId", async (req, res) => {
  const userId = authUserId(req, req.params.userId);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const data = readJsonDb();
  const sent = (data.datingShots ?? [])
    .filter((shot) => shot.fromUserId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const shots = await Promise.all(sent.map((shot) => decorateShot(shot, "receiver")));

  return res.json({ shots });
});

router.post("/dating/shots/respond", async (req, res) => {
  const shotId = typeof req.body?.shotId === "string" ? req.body.shotId.trim() : "";
  const userId = authUserId(req, typeof req.body?.userId === "string" ? req.body.userId.trim() : undefined);
  const action = req.body?.action;

  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  if (!shotId || !["accept", "spark_back", "ignore"].includes(action)) {
    return res.status(400).json({ error: "shotId and a valid action are required" });
  }

  const data = readJsonDb();
  data.datingShots ??= [];
  const shot = data.datingShots.find((item) => item.id === shotId);
  if (!shot) return res.status(404).json({ error: "Shot not found" });
  if (shot.toUserId !== userId) return res.status(403).json({ error: "Forbidden" });
  if (shot.status !== "pending") return res.status(409).json({ error: "Shot already responded to", shot });

  const now = new Date().toISOString();
  if (action === "ignore") {
    shot.status = "ignored";
    shot.respondedAt = now;
    writeJsonDb(data);
    return res.json({ success: true, shot });
  }

  const status: DatingShotStatus = action === "spark_back" ? "sparked_back" : "accepted";
  shot.status = status;
  shot.respondedAt = now;

  const match = await getOrCreateMatch(shot.fromUserId, shot.toUserId);
  await db
    .insert(messagesTable)
    .values({
      matchId: match.id,
      senderId: shot.fromUserId,
      content: shot.message,
      isRead: false,
    })
    .returning();

  if (action === "spark_back") {
    await db
      .insert(messagesTable)
      .values({
        matchId: match.id,
        senderId: "system",
        content: "Sparked back ⚡",
        isRead: false,
      })
      .returning();
  }

  ensureJsonChatRecords(data, match.id, shot.fromUserId, shot.toUserId, shot, action === "spark_back");
  writeJsonDb(data);

  const senderProfile = await getProfile(shot.fromUserId);
  return res.json({
    success: true,
    shot,
    match: { ...match, otherProfile: senderProfile, unreadCount: action === "spark_back" ? 2 : 1 },
    chat: { id: match.id, matchId: match.id },
  });
});

export default router;

