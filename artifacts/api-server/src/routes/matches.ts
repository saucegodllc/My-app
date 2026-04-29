import { Router } from "express";
import { eq, and, or, sql, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { matchesTable, profilesTable, messagesTable } from "@workspace/db";
import { GetMatchesQueryParams } from "@workspace/api-zod";
import { getAuth } from "@clerk/express";

const router = Router();

router.get("/matches", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const parsed = GetMatchesQueryParams.safeParse(req.query);
    const params = parsed.success ? parsed.data : { page: 1, limit: 20 };
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const offset = (page - 1) * limit;

    const rawMatches = await db
      .select()
      .from(matchesTable)
      .where(
        or(eq(matchesTable.userId1, userId), eq(matchesTable.userId2, userId))
      )
      .orderBy(desc(matchesTable.matchedAt))
      .limit(limit)
      .offset(offset);

    const totalRaw = await db
      .select({ count: sql<number>`count(*)` })
      .from(matchesTable)
      .where(
        or(eq(matchesTable.userId1, userId), eq(matchesTable.userId2, userId))
      );

    const matches = await Promise.all(
      rawMatches.map(async (match) => {
        const otherUserId = match.userId1 === userId ? match.userId2 : match.userId1;

        const [otherProfileRaw] = await db
          .select()
          .from(profilesTable)
          .where(eq(profilesTable.userId, otherUserId))
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

        const [lastMessage] = await db
          .select()
          .from(messagesTable)
          .where(eq(messagesTable.matchId, match.id))
          .orderBy(desc(messagesTable.createdAt))
          .limit(1);

        const [unreadRaw] = await db
          .select({ count: sql<number>`count(*)` })
          .from(messagesTable)
          .where(
            and(
              eq(messagesTable.matchId, match.id),
              eq(messagesTable.isRead, false),
              sql`${messagesTable.senderId} != ${userId}`
            )
          );

        return {
          ...match,
          otherProfile,
          lastMessage: lastMessage || undefined,
          unreadCount: Number(unreadRaw?.count ?? 0),
        };
      })
    );

    return res.json({
      matches,
      total: Number(totalRaw[0]?.count ?? 0),
      page,
      hasMore: offset + matches.length < Number(totalRaw[0]?.count ?? 0),
    });
  } catch (err) {
    console.error("[GET /matches] error:", err);
    return res.status(500).json({ error: "Failed to load matches. Please try again." });
  }
});

router.delete("/matches/:matchId", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { matchId } = req.params;

  const [match] = await db
    .select()
    .from(matchesTable)
    .where(eq(matchesTable.id, matchId))
    .limit(1);

  if (!match) return res.status(404).json({ error: "Match not found" });
  if (match.userId1 !== userId && match.userId2 !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  await db.delete(matchesTable).where(eq(matchesTable.id, matchId));

  return res.json({ success: true, message: "Unmatched successfully" });
});

export default router;
