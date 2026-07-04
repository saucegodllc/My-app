/**
 * Anti-Ghost Nudge - fires once per match when a chat goes silent for 48 hours.
 *
 * POST /api/notifications/anti-ghost/broadcast
 *   Called by the `connectsphere-anti-ghost` Render cron job daily.
 *   Protected by x-cron-secret header.
 */

import { Router } from "express";
import { db } from "@workspace/db";
import { matches as matchesTable, messagesTable } from "@workspace/db/schema";
import { and, between, desc, eq, or, sql } from "drizzle-orm";
import { readOpsStore, writeOpsStore } from "../lib/operationalStore";
import { logger } from "../lib/logger";

const router = Router();

const NUDGE_COPY = [
  {
    title: "Still thinking about it? 👀",
    body: "Your match is waiting. One message is all it takes.",
  },
  {
    title: "The spark is still there ✨",
    body: "Don't let this one go quiet — say something good.",
  },
  {
    title: "You matched for a reason 💫",
    body: "Pick up where you left off before this fades.",
  },
  {
    title: "This could be something 🔥",
    body: "Your match is still here. Break the silence.",
  },
];

function pickNudgeCopy(matchId: string): { title: string; body: string } {
  const hash = matchId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return NUDGE_COPY[hash % NUDGE_COPY.length];
}

async function sendExpoPush(
  token: string,
  title: string,
  body: string,
  data: Record<string, string>,
) {
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: token, title, body, data, sound: "default", priority: "high" }),
    });
  } catch (err) {
    logger.warn({ err, token }, "anti-ghost push send failed");
  }
}

router.post("/notifications/anti-ghost/broadcast", async (req, res) => {
  const secret = req.headers["x-cron-secret"];
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const now = Date.now();
  const windowStart = new Date(now - 71 * 3600_000);
  const windowEnd = new Date(now - 48 * 3600_000);

  const store = readOpsStore();
  const alreadyNudged = new Set(
    store.chatControls
      .filter((c) => (c.action as string) === "anti_ghost_sent")
      .map((c) => c.chatId),
  );

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  try {
    const candidateMatches = await db
      .select()
      .from(matchesTable)
      .where(
        or(
          and(
            between(matchesTable.matchedAt, windowStart, windowEnd),
            sql`NOT EXISTS (
              SELECT 1 FROM ${messagesTable}
              WHERE ${messagesTable.matchId} = ${matchesTable.id}
            )`,
          ),
          sql`(
            SELECT max(${messagesTable.createdAt})
            FROM ${messagesTable}
            WHERE ${messagesTable.matchId} = ${matchesTable.id}
          ) BETWEEN ${windowStart} AND ${windowEnd}`,
        ),
      );

    for (const match of candidateMatches) {
      if (alreadyNudged.has(match.id)) {
        skipped++;
        continue;
      }

      const [lastMessage] = await db
        .select()
        .from(messagesTable)
        .where(eq(messagesTable.matchId, match.id))
        .orderBy(desc(messagesTable.createdAt))
        .limit(1);

      const userIdsToNudge: string[] = [];
      if (!lastMessage) {
        userIdsToNudge.push(match.userId1, match.userId2);
      } else if (lastMessage.senderId === match.userId1) {
        userIdsToNudge.push(match.userId2);
      } else {
        userIdsToNudge.push(match.userId1);
      }

      const copy = pickNudgeCopy(match.id);
      const data = { route: `/chat/dating/${match.id}`, reason: "anti_ghost" };

      for (const userId of userIdsToNudge) {
        const tokenRow = await db.query.pushTokens?.findFirst({
          where: (t) => eq(t.userId, userId),
        }).catch(() => null);

        if (tokenRow?.token) {
          await sendExpoPush(tokenRow.token, copy.title, copy.body, data);
          sent++;
        } else {
          skipped++;
        }
      }

      store.chatControls.push({
        id: `anti_ghost_${match.id}_${now}`,
        chatId: match.id,
        userId: "system",
        action: "anti_ghost_sent" as "dismiss_nudge",
        createdAt: new Date(now).toISOString(),
      });
    }

    writeOpsStore(store);
    logger.info({ sent, skipped, errors, candidates: candidateMatches.length }, "anti-ghost broadcast done");
    return res.json({ sent, skipped, errors, candidates: candidateMatches.length });
  } catch (err) {
    logger.error({ err }, "anti-ghost broadcast failed");
    errors++;
    return res.status(500).json({ error: "Internal server error", sent, errors });
  }
});

export default router;
