import { Router } from "express";
import { eq, and, desc, or, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { blocksTable, matchesTable, messagesTable, profilesTable } from "@workspace/db";
import { GetMessagesQueryParams, SendMessageBody } from "@workspace/api-zod";
import { getAuth } from "@clerk/express";
import { getPushToken } from "./notifications";
import { sendConnectThreadPush } from "../lib/connectPushNotifications";
import { createOpsId, nowIso, readOpsStore, writeOpsStore } from "../lib/operationalStore";
import { logLaunchEvent } from "../lib/monitoring";
import { rateLimit } from "../middlewares/rateLimit";

const router = Router();

type MatchAccessResult =
  | { match: typeof matchesTable.$inferSelect }
  | { status: 403 | 404; error: string };

async function requireMatchAccess(matchId: string, userId: string): Promise<MatchAccessResult> {
  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId)).limit(1);
  if (!match) return { status: 404 as const, error: "Match not found" };
  if (match.userId1 !== userId && match.userId2 !== userId) return { status: 403 as const, error: "Forbidden" };
  return { match };
}

function recordChatControl(chatId: string, userId: string, action: "archive" | "mute" | "clear" | "read" | "unmatch" | "still_interested" | "dismiss_nudge", value?: boolean, reason?: string) {
  const store = readOpsStore();
  store.chatControls.push({ id: createOpsId(), chatId, userId, action, value, reason, createdAt: nowIso() });
  writeOpsStore(store);
}

router.get("/messages/:matchId", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const matchId = String(req.params.matchId ?? "");

  const [match] = await db
    .select()
    .from(matchesTable)
    .where(eq(matchesTable.id, matchId))
    .limit(1);

  if (!match) return res.status(404).json({ error: "Match not found" });
  if (match.userId1 !== userId && match.userId2 !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const otherUserId = match.userId1 === userId ? match.userId2 : match.userId1;
  const [block] = await db
    .select()
    .from(blocksTable)
    .where(
      or(
        and(eq(blocksTable.blockerUserId, userId), eq(blocksTable.blockedUserId, otherUserId)),
        and(eq(blocksTable.blockerUserId, otherUserId), eq(blocksTable.blockedUserId, userId)),
      ),
    )
    .limit(1);
  if (block) return res.status(403).json({ error: "This conversation is blocked." });

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

// 30 messages / minute per user — prevents message-spam abuse
router.post("/messages/:matchId", rateLimit({ key: "send_message", windowMs: 60_000, max: 30 }), async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const matchId = String(req.params.matchId ?? "");

  const [match] = await db
    .select()
    .from(matchesTable)
    .where(eq(matchesTable.id, matchId))
    .limit(1);

  if (!match) return res.status(404).json({ error: "Match not found" });
  if (match.userId1 !== userId && match.userId2 !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const otherUserId = match.userId1 === userId ? match.userId2 : match.userId1;
  const [block] = await db
    .select()
    .from(blocksTable)
    .where(
      or(
        and(eq(blocksTable.blockerUserId, userId), eq(blocksTable.blockedUserId, otherUserId)),
        and(eq(blocksTable.blockerUserId, otherUserId), eq(blocksTable.blockedUserId, userId)),
      ),
    )
    .limit(1);
  if (block) return res.status(403).json({ error: "This conversation is blocked." });

  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid data" });

  const [message] = await db
    .insert(messagesTable)
    .values({
      matchId,
      senderId: userId,
      content: parsed.data.content,
      isRead: false,
    })
    .returning();

  // Push notification — fire-and-forget, non-blocking
  try {
    const recipientId = match.userId1 === userId ? match.userId2 : match.userId1;
    const recipientToken = getPushToken(recipientId);
    if (recipientToken) {
      const [senderProfile] = await db
        .select({ displayName: profilesTable.displayName })
        .from(profilesTable)
        .where(eq(profilesTable.userId, userId))
        .limit(1);
      const senderName = senderProfile?.displayName ?? "Someone";
      await sendConnectThreadPush({
        to: recipientToken,
        kind: "message",
        chatId: matchId,
        title: senderName,
        body: parsed.data.content.slice(0, 100),
        data: { messageId: message.id },
      });
    }
  } catch { /* never block on push */ }

  return res.status(201).json(message);
});

router.post("/chats/:chatId/archive", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const access = await requireMatchAccess(req.params.chatId, userId);
  if ("error" in access) return res.status(access.status).json({ error: access.error });
  recordChatControl(req.params.chatId, userId, "archive", req.body?.archived !== false);
  return res.json({ ok: true, chatId: req.params.chatId, archived: req.body?.archived !== false });
});

router.post("/chats/:chatId/mute", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const access = await requireMatchAccess(req.params.chatId, userId);
  if ("error" in access) return res.status(access.status).json({ error: access.error });
  recordChatControl(req.params.chatId, userId, "mute", req.body?.muted !== false);
  return res.json({ ok: true, chatId: req.params.chatId, muted: req.body?.muted !== false });
});

router.post("/chats/:chatId/clear", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const access = await requireMatchAccess(req.params.chatId, userId);
  if ("error" in access) return res.status(access.status).json({ error: access.error });
  recordChatControl(req.params.chatId, userId, "clear", true);
  return res.json({ ok: true, chatId: req.params.chatId, clearedAt: nowIso() });
});

router.post("/chats/:chatId/read", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const access = await requireMatchAccess(req.params.chatId, userId);
  if ("error" in access) return res.status(access.status).json({ error: access.error });
  await db
    .update(messagesTable)
    .set({ isRead: true })
    .where(and(eq(messagesTable.matchId, req.params.chatId), sql`${messagesTable.senderId} != ${userId}`));
  recordChatControl(req.params.chatId, userId, "read", true);
  return res.json({ ok: true, chatId: req.params.chatId, readAt: nowIso() });
});

router.post("/chats/:chatId/unmatch", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const access = await requireMatchAccess(req.params.chatId, userId);
  if ("error" in access) return res.status(access.status).json({ error: access.error });
  recordChatControl(req.params.chatId, userId, "unmatch", true, typeof req.body?.reason === "string" ? req.body.reason : undefined);
  await db.delete(matchesTable).where(eq(matchesTable.id, req.params.chatId));
  logLaunchEvent("chat_unmatched", { userId, targetId: req.params.chatId, reason: req.body?.reason });
  return res.json({ ok: true, chatId: req.params.chatId, unmatched: true });
});

router.post("/matches/:matchId/still-interested", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const access = await requireMatchAccess(req.params.matchId, userId);
  if ("error" in access) return res.status(access.status).json({ error: access.error });
  recordChatControl(req.params.matchId, userId, "still_interested", req.body?.interested !== false);
  return res.json({ ok: true, matchId: req.params.matchId, interested: req.body?.interested !== false });
});

router.post("/matches/:matchId/dismiss-nudge", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const access = await requireMatchAccess(req.params.matchId, userId);
  if ("error" in access) return res.status(access.status).json({ error: access.error });
  recordChatControl(req.params.matchId, userId, "dismiss_nudge", true, typeof req.body?.nudge === "string" ? req.body.nudge : undefined);
  return res.json({ ok: true, matchId: req.params.matchId });
});

router.get("/matches/lifecycle", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const matches = await db
    .select()
    .from(matchesTable)
    .where(or(eq(matchesTable.userId1, userId), eq(matchesTable.userId2, userId)));
  const lifecycles = await Promise.all(matches.map(async (match) => {
    const messages = await db.select().from(messagesTable).where(eq(messagesTable.matchId, match.id)).orderBy(desc(messagesTable.createdAt)).limit(1);
    const matchedAt = new Date(match.matchedAt).getTime();
    const lastMessage = messages[0];
    const lastAt = lastMessage ? new Date(lastMessage.createdAt).getTime() : matchedAt;
    const hoursSinceMatch = (Date.now() - matchedAt) / 36e5;
    const daysSinceActivity = (Date.now() - lastAt) / 864e5;
    // First-message window: 72h (intentional UX pressure to open the conversation)
    // After first message: matches stay active for 30 days of inactivity
    const FIRST_MESSAGE_WINDOW_HOURS = 72;
    const STALE_DAYS = 5;      // gentle nudge at 5 days (shorter window = more urgency)
    const EXPIRED_DAYS = 7;    // hard expiry at 7 days — creates real scarcity
    const status = !lastMessage
      ? hoursSinceMatch > FIRST_MESSAGE_WINDOW_HOURS ? "expired" : "pending_first_message"
      : daysSinceActivity > EXPIRED_DAYS ? "expired" : daysSinceActivity > STALE_DAYS ? "still_interested_pending" : daysSinceActivity > 5 ? "stale" : lastMessage.senderId === userId ? "active" : "your_turn";
    return {
      matchId: match.id,
      status,
      expiresAt: !lastMessage
        ? new Date(matchedAt + FIRST_MESSAGE_WINDOW_HOURS * 36e5).toISOString()
        : new Date(lastAt + EXPIRED_DAYS * 864e5).toISOString(),
      lastActivityAt: new Date(lastAt).toISOString(),
    };
  }));
  return res.json({ lifecycles });
});

router.post("/messages/:messageId/report", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const messageId = Number(req.params.messageId);
  if (!Number.isFinite(messageId)) return res.status(400).json({ error: "Invalid message id" });
  const [message] = await db.select().from(messagesTable).where(eq(messagesTable.id, messageId)).limit(1);
  if (!message) return res.status(404).json({ error: "Message not found" });
  const access = await requireMatchAccess(message.matchId, userId);
  if ("error" in access) return res.status(access.status).json({ error: access.error });
  const store = readOpsStore();
  const now = nowIso();
  const reason = typeof req.body?.reason === "string" ? req.body.reason : "message_report";
  store.moderationQueue.push({
    id: createOpsId(),
    reporterUserId: userId,
    reportedUserId: message.senderId,
    reason,
    details: typeof req.body?.details === "string" ? req.body.details : message.content,
    context: `chat:${message.matchId}`,
    targetType: "message",
    targetId: String(message.id),
    status: "open",
    priority: reason === "harassment" ? "high" : "normal",
    createdAt: now,
    updatedAt: now,
  });
  writeOpsStore(store);
  logLaunchEvent("message_reported", { userId, targetId: String(message.id), reason });
  return res.status(201).json({ ok: true });
});

export default router;
