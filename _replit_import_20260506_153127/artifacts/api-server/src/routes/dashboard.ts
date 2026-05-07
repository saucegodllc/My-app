import { Router } from "express";
import { eq, or, and, ne, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { profilesTable, matchesTable, messagesTable, likesTable } from "@workspace/db";
import { getAuth } from "@clerk/express";

const router = Router();

router.get("/dashboard/summary", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);

  const [totalMatchesRaw] = await db
    .select({ count: sql<number>`count(*)` })
    .from(matchesTable)
    .where(or(eq(matchesTable.userId1, userId), eq(matchesTable.userId2, userId)));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [newMatchesTodayRaw] = await db
    .select({ count: sql<number>`count(*)` })
    .from(matchesTable)
    .where(
      and(
        or(eq(matchesTable.userId1, userId), eq(matchesTable.userId2, userId)),
        sql`${matchesTable.matchedAt} >= ${today.toISOString()}`
      )
    );

  const matchIds = await db
    .select({ id: matchesTable.id })
    .from(matchesTable)
    .where(or(eq(matchesTable.userId1, userId), eq(matchesTable.userId2, userId)));

  let unreadMessages = 0;
  if (matchIds.length > 0) {
    const [unreadRaw] = await db
      .select({ count: sql<number>`count(*)` })
      .from(messagesTable)
      .where(
        and(
          sql`${messagesTable.matchId} IN (${sql.join(matchIds.map((m) => sql`${m.id}`), sql`, `)})`,
          eq(messagesTable.isRead, false),
          ne(messagesTable.senderId, userId)
        )
      );
    unreadMessages = Number(unreadRaw?.count ?? 0);
  }

  const [likesReceivedRaw] = await db
    .select({ count: sql<number>`count(*)` })
    .from(likesTable)
    .where(and(eq(likesTable.toUserId, userId), ne(likesTable.action, "pass")));

  const [superLikesRaw] = await db
    .select({ count: sql<number>`count(*)` })
    .from(likesTable)
    .where(and(eq(likesTable.toUserId, userId), eq(likesTable.action, "superlike")));

  return res.json({
    totalMatches: Number(totalMatchesRaw?.count ?? 0),
    newMatchesToday: Number(newMatchesTodayRaw?.count ?? 0),
    unreadMessages,
    profileViews: profile?.profileViews ?? 0,
    likesReceived: Number(likesReceivedRaw?.count ?? 0),
    superLikesReceived: Number(superLikesRaw?.count ?? 0),
    isPremium: profile?.isPremium ?? false,
  });
});

router.get("/dashboard/who-liked-me", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);

  if (!profile?.isPremium) {
    const count = await db
      .select({ count: sql<number>`count(*)` })
      .from(likesTable)
      .where(and(eq(likesTable.toUserId, userId), ne(likesTable.action, "pass")));

    return res.json({
      profiles: [],
      isPremiumRequired: true,
      count: Number(count[0]?.count ?? 0),
    });
  }

  const likers = await db
    .select({ fromUserId: likesTable.fromUserId })
    .from(likesTable)
    .where(and(eq(likesTable.toUserId, userId), ne(likesTable.action, "pass")))
    .orderBy(sql`${likesTable.createdAt} DESC`)
    .limit(20);

  const profiles = await Promise.all(
    likers.map(async (liker) => {
      const [p] = await db
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.userId, liker.fromUserId))
        .limit(1);
      return p
        ? {
            ...p,
            age: p.birthDate
              ? Math.floor(
                  (Date.now() - new Date(p.birthDate).getTime()) /
                    (365.25 * 24 * 60 * 60 * 1000)
                )
              : undefined,
          }
        : null;
    })
  );

  return res.json({
    profiles: profiles.filter(Boolean),
    isPremiumRequired: false,
  });
});

export default router;
