import { Router } from "express";
import { eq, and, or, ne, notInArray, inArray, ilike, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { profilesTable, networkConnectionsTable, matchesTable } from "@workspace/db";
import { getAuth } from "@clerk/express";

const router = Router();

async function getRequesterIntent(userId: string): Promise<string | null> {
  const [profile] = await db
    .select({ intent: profilesTable.intent })
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);
  return profile?.intent ?? null;
}

function isNetworkingEligible(intent: string | null): boolean {
  return intent === "networking" || intent === "all";
}

router.get("/network/directory", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const intent = await getRequesterIntent(userId);
  if (!isNetworkingEligible(intent)) {
    return res.status(403).json({ error: "Networking not available for your account intent" });
  }

  const page = parseInt((req.query.page as string) ?? "1", 10);
  const limit = parseInt((req.query.limit as string) ?? "20", 10);
  const offset = (page - 1) * limit;
  const search = typeof req.query.search === "string" ? req.query.search.trim() : undefined;
  const careerStage = typeof req.query.careerStage === "string" ? req.query.careerStage : undefined;
  const networkingGoal =
    typeof req.query.networkingGoal === "string" ? req.query.networkingGoal.trim() : undefined;

  const existingRaw = await db
    .select({
      recipientId: networkConnectionsTable.recipientId,
      requesterId: networkConnectionsTable.requesterId,
    })
    .from(networkConnectionsTable)
    .where(
      and(
        or(
          eq(networkConnectionsTable.requesterId, userId),
          eq(networkConnectionsTable.recipientId, userId)
        ),
        ne(networkConnectionsTable.status, "ignored")
      )
    );

  const excludeUserIds = new Set<string>([userId]);
  for (const row of existingRaw) {
    if (row.recipientId !== userId) excludeUserIds.add(row.recipientId);
    if (row.requesterId !== userId) excludeUserIds.add(row.requesterId);
  }

  const whereClause = and(
    ne(profilesTable.userId, userId),
    or(eq(profilesTable.intent, "networking"), eq(profilesTable.intent, "all")),
    excludeUserIds.size > 1
      ? notInArray(profilesTable.userId, [...excludeUserIds])
      : undefined,
    search
      ? or(
          ilike(profilesTable.displayName, `%${search}%`),
          ilike(profilesTable.profession, `%${search}%`)
        )
      : undefined,
    careerStage ? eq(profilesTable.role, careerStage) : undefined,
    networkingGoal
      ? sql`${profilesTable.modeData}->>'networkingGoals' ILIKE ${"%" + networkingGoal + "%"}`
      : undefined
  );

  const profiles = await db
    .select({
      id: profilesTable.id,
      userId: profilesTable.userId,
      displayName: profilesTable.displayName,
      bio: profilesTable.bio,
      role: profilesTable.role,
      profession: profilesTable.profession,
      photos: profilesTable.photos,
      intent: profilesTable.intent,
      isVerified: profilesTable.isVerified,
      location: profilesTable.location,
      modeData: profilesTable.modeData,
    })
    .from(profilesTable)
    .where(whereClause)
    .limit(limit)
    .offset(offset)
    .orderBy(sql`RANDOM()`);

  const totalRaw = await db
    .select({ count: sql<number>`count(*)` })
    .from(profilesTable)
    .where(whereClause);

  const result = profiles.map((p) => ({
    ...p,
    networkingGoals:
      (p.modeData as Record<string, unknown> | null)?.networkingGoals ?? null,
    modeData: undefined,
  }));

  return res.json({
    profiles: result,
    total: Number(totalRaw[0]?.count ?? 0),
    page,
    hasMore: offset + profiles.length < Number(totalRaw[0]?.count ?? 0),
  });
});

router.post("/network/request", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const intent = await getRequesterIntent(userId);
  if (!isNetworkingEligible(intent)) {
    return res.status(403).json({ error: "Networking not available for your account intent" });
  }

  const { recipientId } = req.body;
  if (!recipientId || typeof recipientId !== "string") {
    return res.status(400).json({ error: "recipientId is required" });
  }
  if (recipientId === userId) {
    return res.status(400).json({ error: "Cannot connect with yourself" });
  }

  const [recipient] = await db
    .select({ intent: profilesTable.intent })
    .from(profilesTable)
    .where(eq(profilesTable.userId, recipientId))
    .limit(1);

  if (!recipient || !isNetworkingEligible(recipient.intent)) {
    return res.status(400).json({ error: "Recipient is not available for networking" });
  }

  const [existing] = await db
    .select()
    .from(networkConnectionsTable)
    .where(
      or(
        and(
          eq(networkConnectionsTable.requesterId, userId),
          eq(networkConnectionsTable.recipientId, recipientId)
        ),
        and(
          eq(networkConnectionsTable.requesterId, recipientId),
          eq(networkConnectionsTable.recipientId, userId)
        )
      )
    )
    .limit(1);

  if (existing) {
    return res.json({ connection: existing });
  }

  const [connection] = await db
    .insert(networkConnectionsTable)
    .values({
      id: randomUUID(),
      requesterId: userId,
      recipientId,
      status: "pending",
    })
    .returning();

  return res.status(201).json({ connection });
});

router.post("/network/respond", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const intent = await getRequesterIntent(userId);
  if (!isNetworkingEligible(intent)) {
    return res.status(403).json({ error: "Networking not available for your account intent" });
  }

  const { connectionId, action } = req.body;
  if (!connectionId || !action || !["accepted", "ignored"].includes(action)) {
    return res.status(400).json({
      error: "connectionId and action (accepted|ignored) are required",
    });
  }

  const [connection] = await db
    .select()
    .from(networkConnectionsTable)
    .where(eq(networkConnectionsTable.id, connectionId))
    .limit(1);

  if (!connection) return res.status(404).json({ error: "Connection not found" });
  if (connection.recipientId !== userId) return res.status(403).json({ error: "Forbidden" });

  const [updated] = await db
    .update(networkConnectionsTable)
    .set({ status: action, updatedAt: new Date() })
    .where(eq(networkConnectionsTable.id, connectionId))
    .returning();

  return res.json({ connection: updated });
});

router.get("/network/connections", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const intent = await getRequesterIntent(userId);
  if (!isNetworkingEligible(intent)) {
    return res.status(403).json({ error: "Networking not available for your account intent" });
  }

  const rows = await db
    .select()
    .from(networkConnectionsTable)
    .where(
      and(
        or(
          eq(networkConnectionsTable.requesterId, userId),
          eq(networkConnectionsTable.recipientId, userId)
        ),
        ne(networkConnectionsTable.status, "ignored")
      )
    )
    .orderBy(networkConnectionsTable.createdAt);

  const otherUserIds = rows.map((r) => (r.requesterId === userId ? r.recipientId : r.requesterId));

  const profileRows =
    otherUserIds.length > 0
      ? await db
          .select({
            id: profilesTable.id,
            userId: profilesTable.userId,
            displayName: profilesTable.displayName,
            bio: profilesTable.bio,
            role: profilesTable.role,
            profession: profilesTable.profession,
            photos: profilesTable.photos,
            intent: profilesTable.intent,
            isVerified: profilesTable.isVerified,
            location: profilesTable.location,
            modeData: profilesTable.modeData,
          })
          .from(profilesTable)
          .where(inArray(profilesTable.userId, otherUserIds))
      : [];

  const profileMap = new Map(profileRows.map((p) => [p.userId, p]));

  const withProfiles = rows.map((row) => {
    const otherUserId = row.requesterId === userId ? row.recipientId : row.requesterId;
    const profile = profileMap.get(otherUserId) ?? null;
    const otherProfile = profile
      ? {
          ...profile,
          networkingGoals:
            (profile.modeData as Record<string, unknown> | null)?.networkingGoals ?? null,
          modeData: undefined,
        }
      : null;
    return { ...row, otherProfile };
  });

  const accepted = withProfiles.filter((r) => r.status === "accepted");
  const pendingIncoming = withProfiles.filter(
    (r) => r.status === "pending" && r.recipientId === userId
  );
  const pendingOutgoing = withProfiles.filter(
    (r) => r.status === "pending" && r.requesterId === userId
  );

  return res.json({ accepted, pendingIncoming, pendingOutgoing });
});

router.post("/network/chat-match", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const intent = await getRequesterIntent(userId);
  if (!isNetworkingEligible(intent)) {
    return res.status(403).json({ error: "Networking not available for your account intent" });
  }

  const { otherUserId } = req.body;
  if (!otherUserId || typeof otherUserId !== "string") {
    return res.status(400).json({ error: "otherUserId is required" });
  }

  const [connection] = await db
    .select()
    .from(networkConnectionsTable)
    .where(
      and(
        or(
          and(
            eq(networkConnectionsTable.requesterId, userId),
            eq(networkConnectionsTable.recipientId, otherUserId)
          ),
          and(
            eq(networkConnectionsTable.requesterId, otherUserId),
            eq(networkConnectionsTable.recipientId, userId)
          )
        ),
        eq(networkConnectionsTable.status, "accepted")
      )
    )
    .limit(1);

  if (!connection) return res.status(403).json({ error: "Not connected" });

  const [existingMatch] = await db
    .select()
    .from(matchesTable)
    .where(
      sql`(${matchesTable.userId1} = ${userId} AND ${matchesTable.userId2} = ${otherUserId}) OR (${matchesTable.userId1} = ${otherUserId} AND ${matchesTable.userId2} = ${userId})`
    )
    .limit(1);

  if (existingMatch) {
    return res.json({ matchId: existingMatch.id });
  }

  const [match] = await db
    .insert(matchesTable)
    .values({
      id: randomUUID(),
      userId1: userId,
      userId2: otherUserId,
    })
    .returning();

  return res.json({ matchId: match.id });
});

export default router;
