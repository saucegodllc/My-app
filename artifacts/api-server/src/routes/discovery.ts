import { Router } from "express";
import { eq, and, ne, notInArray, sql, gte, lte, or } from "drizzle-orm";
import { randomUUID } from "crypto";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { db } from "@workspace/db";
import { profilesTable, likesTable, matchesTable, blocksTable, discoveryActionUsageTable } from "@workspace/db";
import { PerformDiscoveryActionBody, GetDiscoveryFeedQueryParams } from "@workspace/api-zod";
import { getAuth } from "@clerk/express";
import { rateLimit } from "../middlewares/rateLimit";
import { buildMatchThreadResponse, ensureMatchThread, MatchThreadError } from "../lib/matchThreads";
import { shouldUseLocalDbFallback } from "../launchGuards";

const router = Router();
const FREE_SPARKS_PER_DAY = 1;
const FREE_DATING_SWIPES_PER_DAY = 5;
const DISCOVERY_SWIPE_BUCKET = "dating_swipe";

// ── Local JSON fallback helpers (dev only) ───────────────────────────────────
const workspaceRoot = process.cwd().endsWith(join("artifacts", "api-server"))
  ? join(process.cwd(), "..", "..")
  : process.cwd();
const localDbPath = join(workspaceRoot, "artifacts", "api-server", "db.json");

function localFallbackUserId(req: Parameters<typeof getAuth>[0]) {
  const header = req.headers["x-connectsphere-user-id"];
  const candidate = Array.isArray(header) ? header[0] : header;
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : "demo-user";
}

type LocalLike = { id: string; fromUserId: string; toUserId: string; action: string; createdAt: string };
type LocalMatch = { id: string; userId1: string; userId2: string; matchedAt: string };
type LocalProfile = { id: string; userId: string; displayName: string; birthDate?: string; gender?: string; intent?: string; connectionSubtype?: string; modeData?: Record<string, unknown>; photos?: string[]; interests?: string[]; bio?: string; location?: string; country?: string; isPremium?: boolean; isVerified?: boolean; [k: string]: unknown };
type LocalDiscoveryActionUsage = { id: string; userId: string; dateKey: string; actionBucket: string; count: number; createdAt: string; updatedAt: string };
type LocalDb = { profiles?: LocalProfile[]; likes?: LocalLike[]; matches?: LocalMatch[]; discoveryActionUsage?: LocalDiscoveryActionUsage[]; [k: string]: unknown };

function readLocalDb(): LocalDb {
  if (!existsSync(localDbPath)) return {};
  try { return JSON.parse(readFileSync(localDbPath, "utf8")) as LocalDb; } catch { return {}; }
}

function writeLocalDb(data: LocalDb) {
  writeFileSync(localDbPath, JSON.stringify(data, null, 2), "utf8");
}

function calcAge(birthDate?: string | null) {
  if (!birthDate) return undefined;
  return Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function swipeLimitResponse() {
  return {
    error: "Daily swipe limit reached",
    code: "SWIPE_LIMIT_REACHED",
    remainingSwipes: 0,
    premiumRequired: true,
  };
}

function localRemainingSwipes(localDb: LocalDb, userId: string) {
  const usage = (localDb.discoveryActionUsage ?? []).find(
    (item) => item.userId === userId && item.dateKey === todayKey() && item.actionBucket === DISCOVERY_SWIPE_BUCKET,
  );
  return Math.max(0, FREE_DATING_SWIPES_PER_DAY - (usage?.count ?? 0));
}

function consumeLocalSwipe(localDb: LocalDb, userId: string, premium: boolean) {
  if (premium) return { allowed: true, remaining: null as number | null };
  const dateKey = todayKey();
  localDb.discoveryActionUsage = localDb.discoveryActionUsage ?? [];
  let usage = localDb.discoveryActionUsage.find(
    (item) => item.userId === userId && item.dateKey === dateKey && item.actionBucket === DISCOVERY_SWIPE_BUCKET,
  );
  if (!usage) {
    usage = {
      id: randomUUID(),
      userId,
      dateKey,
      actionBucket: DISCOVERY_SWIPE_BUCKET,
      count: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    localDb.discoveryActionUsage.push(usage);
  }
  if (usage.count >= FREE_DATING_SWIPES_PER_DAY) {
    return { allowed: false, remaining: 0 };
  }
  usage.count += 1;
  usage.updatedAt = new Date().toISOString();
  return { allowed: true, remaining: Math.max(0, FREE_DATING_SWIPES_PER_DAY - usage.count) };
}

async function remainingSwipes(userId: string, premium: boolean) {
  if (premium) return null;
  const [usage] = await db
    .select({ count: discoveryActionUsageTable.count })
    .from(discoveryActionUsageTable)
    .where(
      and(
        eq(discoveryActionUsageTable.userId, userId),
        eq(discoveryActionUsageTable.dateKey, todayKey()),
        eq(discoveryActionUsageTable.actionBucket, DISCOVERY_SWIPE_BUCKET),
      ),
    )
    .limit(1);
  return Math.max(0, FREE_DATING_SWIPES_PER_DAY - Number(usage?.count ?? 0));
}

async function consumeServerSwipe(userId: string, premium: boolean) {
  if (premium) return { allowed: true, remaining: null as number | null };
  const [usage] = await db
    .insert(discoveryActionUsageTable)
    .values({
      id: randomUUID(),
      userId,
      dateKey: todayKey(),
      actionBucket: DISCOVERY_SWIPE_BUCKET,
      count: 1,
    })
    .onConflictDoUpdate({
      target: [
        discoveryActionUsageTable.userId,
        discoveryActionUsageTable.dateKey,
        discoveryActionUsageTable.actionBucket,
      ],
      set: {
        count: sql`${discoveryActionUsageTable.count} + 1`,
        updatedAt: new Date(),
      },
      where: sql`${discoveryActionUsageTable.count} < ${FREE_DATING_SWIPES_PER_DAY}`,
    })
    .returning({ count: discoveryActionUsageTable.count });

  if (!usage) return { allowed: false, remaining: 0 };
  return { allowed: true, remaining: Math.max(0, FREE_DATING_SWIPES_PER_DAY - Number(usage.count ?? 0)) };
}
// ─────────────────────────────────────────────────────────────────────────────

router.get("/discovery", async (req, res) => {
  const authResult = getAuth(req);
  const userId = shouldUseLocalDbFallback() ? localFallbackUserId(req) : authResult.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  // ── Local JSON fallback ──
  if (shouldUseLocalDbFallback()) {
    const localDb = readLocalDb();
    const profiles = localDb.profiles ?? [];
    const likes = localDb.likes ?? [];
    const alreadySeen = new Set(likes.filter((l) => l.fromUserId === userId).map((l) => l.toUserId));
    const available = profiles.filter((p) => p.userId !== userId && !alreadySeen.has(p.userId));
    const withAge = available.map((p) => ({ ...p, age: calcAge(p.birthDate as string | undefined) }));
    return res.json({ profiles: withAge, total: withAge.length, page: 1, hasMore: false });
  }
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const parsed = GetDiscoveryFeedQueryParams.safeParse(req.query);
  const params = parsed.success ? parsed.data : { page: 1, limit: 10 };
  const countryFilter = typeof req.query.country === "string" ? req.query.country : undefined;
  const subtypeFilter = typeof req.query.subtype === "string" ? req.query.subtype : undefined;

  const page = params.page ?? 1;
  const limit = params.limit ?? 10;
  const offset = (page - 1) * limit;

  const alreadySeenRaw = await db
    .select({ toUserId: likesTable.toUserId })
    .from(likesTable)
    .where(eq(likesTable.fromUserId, userId));
  const alreadySeen = alreadySeenRaw.map((r) => r.toUserId);

  const blockedByMeRaw = await db
    .select({ blockedUserId: blocksTable.blockedUserId })
    .from(blocksTable)
    .where(eq(blocksTable.blockerUserId, userId));
  const blockedByMe = blockedByMeRaw.map((r) => r.blockedUserId);
  const blockedMeRaw = await db
    .select({ blockerUserId: blocksTable.blockerUserId })
    .from(blocksTable)
    .where(eq(blocksTable.blockedUserId, userId));
  const blockedMe = blockedMeRaw.map((r) => r.blockerUserId);

  const excludeIds = [...new Set([userId, ...alreadySeen, ...blockedByMe, ...blockedMe])];

  const conditions = [ne(profilesTable.userId, userId)];
  if (excludeIds.length > 0) {
    conditions.push(notInArray(profilesTable.userId, excludeIds));
  }
  if (params.intent === "dating") {
    conditions.push(or(eq(profilesTable.intent, "dating"), eq(profilesTable.intent, "all"))!);
  } else if (params.intent === "friendship") {
    conditions.push(or(eq(profilesTable.intent, "friendship"), eq(profilesTable.intent, "all"))!);
  } else if (params.intent && params.intent !== "all") {
    conditions.push(eq(profilesTable.intent, params.intent));
  }
  if (subtypeFilter) {
    conditions.push(
      or(
        eq(profilesTable.connectionSubtype, subtypeFilter),
        sql`${profilesTable.modeData}->>'datingGoal' = ${subtypeFilter}`,
        sql`${profilesTable.modeData}->'friendshipTypes'->>0 = ${subtypeFilter}`
      )!
    );
  }
  if (countryFilter) {
    conditions.push(eq(profilesTable.country, countryFilter));
  }
  if (params.minAge) {
    const maxBirthDate = new Date();
    maxBirthDate.setFullYear(maxBirthDate.getFullYear() - params.minAge);
    conditions.push(lte(profilesTable.birthDate, maxBirthDate.toISOString().split("T")[0]));
  }
  if (params.maxAge) {
    const minBirthDate = new Date();
    minBirthDate.setFullYear(minBirthDate.getFullYear() - params.maxAge - 1);
    conditions.push(gte(profilesTable.birthDate, minBirthDate.toISOString().split("T")[0]));
  }

  const profiles = await db
    .select()
    .from(profilesTable)
    .where(and(...conditions))
    .limit(limit)
    .offset(offset)
    .orderBy(sql`RANDOM()`);

  const total = await db
    .select({ count: sql<number>`count(*)` })
    .from(profilesTable)
    .where(and(...conditions));

  const profilesWithAge = profiles.map((p) => ({
    ...p,
    age: p.birthDate
      ? Math.floor((Date.now() - new Date(p.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : undefined,
  }));

  return res.json({
    profiles: profilesWithAge,
    total: Number(total[0]?.count ?? 0),
    page,
    hasMore: offset + profiles.length < Number(total[0]?.count ?? 0),
  });
});

// 120 actions / minute per user — fast swipers are fine; bot-level hammering is not
router.post("/discovery/action", rateLimit({ key: "discovery_action", windowMs: 60_000, max: 120 }), async (req, res) => {
  const authResult = getAuth(req);
  const userId = shouldUseLocalDbFallback() ? localFallbackUserId(req) : authResult.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const parsed = PerformDiscoveryActionBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid data" });

  const { targetUserId, action } = parsed.data;
  const originAction = action === "superlike" ? "spark" : "like";

  // ── Local JSON fallback ──
  if (shouldUseLocalDbFallback()) {
    const localDb = readLocalDb();
    const likes: LocalLike[] = localDb.likes ?? [];
    const matches: LocalMatch[] = localDb.matches ?? [];
    const profiles: LocalProfile[] = localDb.profiles ?? [];
    const senderProfile = profiles.find((p) => p.userId === userId);
    const premium = senderProfile?.isPremium === true;

    // Record the like/pass
    const existing = likes.find((l) => l.fromUserId === userId && l.toUserId === targetUserId);
    const swipeUsage = existing
      ? { allowed: true, remaining: premium ? null : localRemainingSwipes(localDb, userId) }
      : consumeLocalSwipe(localDb, userId, premium);
    if (!swipeUsage.allowed) {
      return res.status(429).json(swipeLimitResponse());
    }

    if (!existing) {
      likes.push({ id: randomUUID(), fromUserId: userId, toUserId: targetUserId, action, createdAt: new Date().toISOString() });
    }

    if (action === "pass") {
      writeLocalDb({ ...localDb, likes });
      return res.json({ matched: false, pending: false, remainingSwipes: swipeUsage.remaining });
    }

    // Check mutual like
    const theyLikedUs = likes.find((l) => l.fromUserId === targetUserId && l.toUserId === userId && l.action !== "pass");
    if (!theyLikedUs) {
      writeLocalDb({ ...localDb, likes });
      return res.json({ matched: false, pending: true, remainingSwipes: swipeUsage.remaining });
    }

    // Already matched?
    const existingMatch = matches.find(
      (m) => (m.userId1 === userId && m.userId2 === targetUserId) || (m.userId1 === targetUserId && m.userId2 === userId)
    );
    if (existingMatch) {
      writeLocalDb({ ...localDb, likes });
      return res.json({ matched: true, chatId: existingMatch.id, match: { ...existingMatch, chatId: existingMatch.id }, remainingSwipes: swipeUsage.remaining });
    }

    const newMatch: LocalMatch = { id: randomUUID(), userId1: userId, userId2: targetUserId, matchedAt: new Date().toISOString() };
    matches.push(newMatch);
    writeLocalDb({ ...localDb, likes, matches });

    const otherProfileRaw = profiles.find((p) => p.userId === targetUserId);
    const otherProfile = otherProfileRaw ? { ...otherProfileRaw, age: calcAge(otherProfileRaw.birthDate as string | undefined) } : undefined;
    return res.json({ matched: true, chatId: newMatch.id, match: { ...newMatch, chatId: newMatch.id, otherProfile, unreadCount: 0 }, remainingSwipes: swipeUsage.remaining });
  }

  // From here on: real Postgres path
  const [block] = await db
    .select()
    .from(blocksTable)
    .where(
      or(
        and(eq(blocksTable.blockerUserId, userId), eq(blocksTable.blockedUserId, targetUserId)),
        and(eq(blocksTable.blockerUserId, targetUserId), eq(blocksTable.blockedUserId, userId)),
      ),
    )
    .limit(1);
  if (block) return res.status(403).json({ error: "This interaction is blocked." });

  const [existingLike] = await db
    .select()
    .from(likesTable)
    .where(and(eq(likesTable.fromUserId, userId), eq(likesTable.toUserId, targetUserId)))
    .limit(1);

  const [profile] = await db
    .select({ isPremium: profilesTable.isPremium })
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);
  const premium = profile?.isPremium === true;
  let swipeUsage = {
    allowed: true,
    remaining: await remainingSwipes(userId, premium),
  };

  if (action === "superlike" && !existingLike) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(likesTable)
      .where(
        and(
          eq(likesTable.fromUserId, userId),
          eq(likesTable.action, "superlike"),
          sql`${likesTable.createdAt} >= ${startOfDay.toISOString()}`,
        ),
      );

    if (!profile?.isPremium && Number(count ?? 0) >= FREE_SPARKS_PER_DAY) {
      return res.status(402).json({
        error: "Daily Spark limit reached",
        code: "SPARK_LIMIT_REACHED",
        remainingSparks: 0,
        premiumRequired: true,
      });
    }
  }

  if (!existingLike) {
    swipeUsage = await consumeServerSwipe(userId, premium);
    if (!swipeUsage.allowed) {
      return res.status(429).json(swipeLimitResponse());
    }

    await db
      .insert(likesTable)
      .values({
        id: randomUUID(),
        fromUserId: userId,
        toUserId: targetUserId,
        action,
      })
      .onConflictDoNothing();
  }

  if (action === "pass") {
    return res.json({ matched: false, pending: false, remainingSwipes: swipeUsage.remaining });
  }

  const [theyLikedUs] = await db
    .select()
    .from(likesTable)
    .where(
      and(
        eq(likesTable.fromUserId, targetUserId),
        eq(likesTable.toUserId, userId),
        ne(likesTable.action, "pass")
      )
    )
    .limit(1);

  if (!theyLikedUs) {
    return res.json({ matched: false, pending: true, remainingSwipes: swipeUsage.remaining });
  }

  const [existingMatch] = await db
    .select()
    .from(matchesTable)
    .where(
      sql`(${matchesTable.userId1} = ${userId} AND ${matchesTable.userId2} = ${targetUserId}) OR (${matchesTable.userId1} = ${targetUserId} AND ${matchesTable.userId2} = ${userId})`
    )
    .limit(1);

  if (existingMatch) {
    return res.json({
      matched: true,
      chatId: existingMatch.id,
      remainingSwipes: swipeUsage.remaining,
      match: await buildMatchThreadResponse({
        match: existingMatch,
        viewerUserId: userId,
        intent: "dating",
        originAction,
      }),
    });
  }

  let match: typeof matchesTable.$inferSelect;
  try {
    ({ match } = await ensureMatchThread({
      userId1: userId,
      userId2: targetUserId,
      intent: "dating",
      originAction,
    }));
  } catch (error) {
    if (error instanceof MatchThreadError) {
      return res.status(error.status).json({ error: error.message });
    }
    throw error;
  }

  const [otherProfileRaw] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, targetUserId))
    .limit(1);

  const otherProfile = otherProfileRaw
    ? {
        ...otherProfileRaw,
        age: otherProfileRaw.birthDate
          ? Math.floor(
              (Date.now() - new Date(otherProfileRaw.birthDate).getTime()) /
                (365.25 * 24 * 60 * 60 * 1000)
            )
          : undefined,
      }
    : undefined;

  return res.json({
    matched: true,
    chatId: match.id,
    remainingSwipes: swipeUsage.remaining,
    match: {
      ...(await buildMatchThreadResponse({
        match,
        viewerUserId: userId,
        intent: "dating",
        originAction,
      })),
      otherProfile,
      unreadCount: 0,
    },
  });
});

export default router;
