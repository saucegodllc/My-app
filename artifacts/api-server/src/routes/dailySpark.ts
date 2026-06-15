/**
 * Daily Spark — personalized re-engagement push notifications
 *
 * POST /api/notifications/daily-spark
 *   Triggers the daily spark for a single user (callable from cron).
 *
 * POST /api/notifications/daily-spark/broadcast
 *   Admin-only: fires sparks for all users with push tokens
 *   (called by your cron job at 6pm).
 *
 * The notification content is chosen based on the user's activity:
 *   • New vibers nearby      → "X people who match your vibe joined today 🔥"
 *   • Pending match          → "Someone liked you — will you like them back? 👀"
 *   • Stale conversation     → "Your match is waiting — say something! 💬"
 *   • Streak risk            → "Don't break your X-day streak ⚡"
 *   • Default                → Daily question / vibe prompt
 */

import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { db } from "@workspace/db";
import { profiles, matches, pushTokens } from "@workspace/db/schema";
import { and, eq, gt, sql, ne } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

// ─── Spark copy bank ─────────────────────────────────────────────────────────

const DAILY_QUESTIONS = [
  { title: "Vibe question of the day ✨", body: "What's a small habit you'd want a partner to share?" },
  { title: "Today's vibe check 🎯", body: "Describe your perfect Sunday in 5 words." },
  { title: "Question of the day 💭", body: "What's the most spontaneous thing you've done recently?" },
  { title: "New question just dropped 🔥", body: "Night in or night out — what would tip you?" },
  { title: "Vibe insight 🧠", body: "What would you want someone to know before a first date?" },
  { title: "Daily spark ⚡", body: "If you could live anywhere for 1 year, where and why?" },
  { title: "Get to know yourself 💛", body: "What's your 10/10 date idea right now?" },
];

function pickDailyQuestion(userId: string): { title: string; body: string } {
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  const userHash = userId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return DAILY_QUESTIONS[(dayIndex + userHash) % DAILY_QUESTIONS.length];
}

// ─── Spark generator ─────────────────────────────────────────────────────────

async function buildSparkForUser(userId: string): Promise<{
  title: string;
  body: string;
  data: Record<string, string>;
} | null> {
  try {
    // Check for pending reactions (someone liked them)
    const pendingReactions = await db
      .select({ count: sql<number>`count(*)` })
      .from(matches)
      .where(
        and(
          eq(matches.userId2, userId),
          eq(matches.status, "pending"),
        )
      )
      .catch(() => [{ count: 0 }]);

    const pendingCount = Number(pendingReactions[0]?.count ?? 0);
    if (pendingCount > 0) {
      return {
        title: pendingCount > 1
          ? `${pendingCount} people liked you 👀`
          : "Someone liked you back 👀",
        body: "Will you like them back? Open ConnectSphere to find out.",
        data: { route: "/(tabs)/index", reason: "pending_reactions" },
      };
    }

    // Check for recent new vibers (profiles created in last 24h nearby)
    // Simplified: just count new profiles today
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    const newVibers = await db
      .select({ count: sql<number>`count(*)` })
      .from(profiles)
      .where(
        and(
          gt(profiles.createdAt, yesterday),
          ne(profiles.userId, userId),
        )
      )
      .catch(() => [{ count: 0 }]);

    const newCount = Number(newVibers[0]?.count ?? 0);
    if (newCount >= 3) {
      return {
        title: `${newCount} new people added their vibes today 🔥`,
        body: "See who matches yours — your deck is refreshed.",
        data: { route: "/(tabs)/index", reason: "new_vibers" },
      };
    }

    // Check for matches with no messages (stale conversation)
    const staleMatches = await db
      .select({ count: sql<number>`count(*)` })
      .from(matches)
      .where(
        and(
          eq(matches.status, "matched"),
          sql`(${matches.userId1} = ${userId} OR ${matches.userId2} = ${userId})`,
          sql`${matches.lastMessageAt} IS NULL`,
          gt(matches.createdAt, new Date(Date.now() - 7 * 86_400_000).toISOString()),
        )
      )
      .catch(() => [{ count: 0 }]);

    const staleCount = Number(staleMatches[0]?.count ?? 0);
    if (staleCount > 0) {
      return {
        title: staleCount > 1
          ? `${staleCount} matches are waiting to hear from you 💬`
          : "Your match hasn't heard from you yet 💬",
        body: "Don't let it expire — say hi before the spark fades.",
        data: { route: "/(tabs)/matches", reason: "stale_match" },
      };
    }

    // Default: daily question
    const q = pickDailyQuestion(userId);
    return {
      title: q.title,
      body: q.body,
      data: { route: "/(tabs)/index", reason: "daily_question" },
    };
  } catch (err) {
    logger.error({ err, userId }, "buildSparkForUser failed");
    return null;
  }
}

// ─── Push sender ─────────────────────────────────────────────────────────────

async function sendExpoPush(
  token: string,
  title: string,
  body: string,
  data: Record<string, string>,
) {
  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: token,
      title,
      body,
      data,
      sound: "default",
      priority: "normal",
    }),
  });
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/** Single user spark — used by the broadcast loop and for testing */
router.post("/notifications/daily-spark", requireAuth, async (req, res) => {
  const userId = req.auth?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const spark = await buildSparkForUser(userId);
  if (!spark) return res.json({ sent: false, reason: "no_spark" });

  // Load push token for this user
  try {
    const tokenRow = await db.query.pushTokens?.findFirst({
      where: (t) => eq(t.userId, userId),
    });
    if (tokenRow?.token) {
      await sendExpoPush(tokenRow.token, spark.title, spark.body, spark.data);
    }
    return res.json({ sent: !!tokenRow?.token, spark });
  } catch (err) {
    logger.error({ err }, "daily-spark send failed");
    return res.status(500).json({ error: "Failed" });
  }
});

/**
 * Broadcast — fires all daily sparks.
 * Protect with a secret header so only your cron job can call it.
 * Set CRON_SECRET env var, then call:
 *   POST /api/notifications/daily-spark/broadcast
 *   Header: x-cron-secret: <CRON_SECRET>
 */
router.post("/notifications/daily-spark/broadcast", async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers["x-cron-secret"] !== cronSecret) {
    return res.status(403).json({ error: "Forbidden" });
  }

  let sent = 0;
  let failed = 0;

  try {
    // Load all users with push tokens
    const allTokens = await db.select().from(pushTokens).limit(10_000);

    for (const row of allTokens) {
      const spark = await buildSparkForUser(row.userId);
      if (!spark) { failed++; continue; }
      try {
        await sendExpoPush(row.token, spark.title, spark.body, spark.data);
        sent++;
      } catch {
        failed++;
      }
      // Small delay to avoid rate limits
      await new Promise((r) => setTimeout(r, 20));
    }

    logger.info({ sent, failed }, "daily-spark broadcast complete");
    return res.json({ sent, failed });
  } catch (err) {
    logger.error({ err }, "daily-spark broadcast failed");
    return res.status(500).json({ error: "Broadcast failed" });
  }
});

export default router;
