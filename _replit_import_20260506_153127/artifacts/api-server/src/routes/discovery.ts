import { Router } from "express";
import { eq, and, ne, notInArray, sql, gte, lte } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { profilesTable, likesTable, matchesTable, blocksTable } from "@workspace/db";
import { PerformDiscoveryActionBody, GetDiscoveryFeedQueryParams } from "@workspace/api-zod";
import { getAuth } from "@clerk/express";

const router = Router();

router.get("/discovery", async (req, res) => {
  const { userId } = getAuth(req);
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

  const excludeIds = [...new Set([userId, ...alreadySeen, ...blockedByMe])];

  const conditions = [ne(profilesTable.userId, userId)];
  if (excludeIds.length > 0) {
    conditions.push(notInArray(profilesTable.userId, excludeIds));
  }
  if (params.intent && params.intent !== "all") {
    conditions.push(eq(profilesTable.intent, params.intent));
  }
  if (subtypeFilter) {
    conditions.push(eq(profilesTable.connectionSubtype, subtypeFilter));
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

router.post("/discovery/action", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const parsed = PerformDiscoveryActionBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid data" });

  const { targetUserId, action } = parsed.data;

  await db
    .insert(likesTable)
    .values({
      id: randomUUID(),
      fromUserId: userId,
      toUserId: targetUserId,
      action,
    })
    .onConflictDoNothing();

  if (action === "pass") {
    return res.json({ matched: false });
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
    return res.json({ matched: false });
  }

  const [existingMatch] = await db
    .select()
    .from(matchesTable)
    .where(
      sql`(${matchesTable.userId1} = ${userId} AND ${matchesTable.userId2} = ${targetUserId}) OR (${matchesTable.userId1} = ${targetUserId} AND ${matchesTable.userId2} = ${userId})`
    )
    .limit(1);

  if (existingMatch) {
    return res.json({ matched: true });
  }

  const [match] = await db
    .insert(matchesTable)
    .values({
      id: randomUUID(),
      userId1: userId,
      userId2: targetUserId,
    })
    .returning();

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
    match: {
      ...match,
      otherProfile,
      unreadCount: 0,
    },
  });
});

export default router;
