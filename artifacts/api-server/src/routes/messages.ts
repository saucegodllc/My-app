import { Router } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { matchesTable, messagesTable } from "@workspace/db";
import { GetMessagesQueryParams, SendMessageBody } from "@workspace/api-zod";
import { getAuth } from "@clerk/express";

const router = Router();

router.get("/messages/:matchId", async (req, res) => {
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

  const parsed = GetMessagesQueryParams.safeParse(req.query);
  const params = parsed.success ? parsed.data : { page: 1, limit: 50 };
  const page = params.page ?? 1;
  const limit = params.limit ?? 50;
  const offset = (page - 1) * limit;

  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.matchId, matchId))
    .orderBy(desc(messagesTable.createdAt))
    .limit(limit)
    .offset(offset);

  await db
    .update(messagesTable)
    .set({ isRead: true })
    .where(
      and(
        eq(messagesTable.matchId, matchId),
        eq(messagesTable.isRead, false),
        sql`${messagesTable.senderId} != ${userId}`
      )
    );

  const totalRaw = await db
    .select({ count: sql<number>`count(*)` })
    .from(messagesTable)
    .where(eq(messagesTable.matchId, matchId));

  return res.json({
    messages: messages.reverse(),
    total: Number(totalRaw[0]?.count ?? 0),
    page,
    hasMore: offset + messages.length < Number(totalRaw[0]?.count ?? 0),
  });
});

router.post("/messages/:matchId", async (req, res) => {
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

  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid data" });

  const [message] = await db
    .insert(messagesTable)
    .values({
      id: randomUUID(),
      matchId,
      senderId: userId,
      content: parsed.data.content,
      isRead: false,
    })
    .returning();

  return res.status(201).json(message);
});

export default router;
