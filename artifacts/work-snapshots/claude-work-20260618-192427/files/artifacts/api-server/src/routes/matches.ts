import { Router } from "express";
import { eq, and, or, sql, desc, inArray } from "drizzle-orm";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { db } from "@workspace/db";
import { blocksTable, matchesTable, profilesTable, messagesTable } from "@workspace/db";
import { GetMatchesQueryParams } from "@workspace/api-zod";
import { getAuth } from "@clerk/express";
import { buildProfilesByUserId, getOtherUserIdsForMatches, withProfileAge } from "./matchesBatching";
import { shouldUseLocalDbFallback } from "../launchGuards";

const router = Router();

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

type LocalMatch = { id: string; userId1: string; userId2: string; matchedAt: string };
type LocalProfile = { userId: string; displayName: string; birthDate?: string; photos?: string[]; [k: string]: unknown };
type LocalDb = { profiles?: LocalProfile[]; matches?: LocalMatch[]; [k: string]: unknown };

function readLocalDb(): LocalDb {
  if (!existsSync(localDbPath)) return {};
  try { return JSON.parse(readFileSync(localDbPath, "utf8")) as LocalDb; } catch { return {}; }
}

function calcAge(birthDate?: string | null) {
  if (!birthDate) return undefined;
  return Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}
// ─────────────────────────────────────────────────────────────────────────────

router.get("/matches", async (req, res) => {
  const authResult = getAuth(req);
  const userId = shouldUseLocalDbFallback() ? localFallbackUserId(req) : authResult.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  // ── Local JSON fallback ──
  if (shouldUseLocalDbFallback()) {
    const localDb = readLocalDb();
    const allMatches: LocalMatch[] = localDb.matches ?? [];
    const profiles: LocalProfile[] = localDb.profiles ?? [];
    const myMatches = allMatches.filter((m) => m.userId1 === userId || m.userId2 === userId);
    const enriched = myMatches.map((m) => {
      const otherUserId = m.userId1 === userId ? m.userId2 : m.userId1;
      const otherProfile = profiles.find((p) => p.userId === otherUserId);
      return {
        ...m,
        otherProfile: otherProfile ? { ...otherProfile, age: calcAge(otherProfile.birthDate) } : undefined,
        lastMessage: undefined,
        unreadCount: 0,
      };
    });
    return res.json({ matches: enriched, total: enriched.length, page: 1, hasMore: false });
  }

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

    const otherUserIds = getOtherUserIdsForMatches(userId, rawMatches);
    const otherProfilesRaw = otherUserIds.length > 0
      ? await db
          .select()
          .from(profilesTable)
          .where(inArray(profilesTable.userId, otherUserIds))
      : [];
    const profilesByUserId = buildProfilesByUserId(otherProfilesRaw.map(withProfileAge));

    // ── Batch-fetch last message + unread count — no N+1 ──────────────────────
    const matchIds = rawMatches.map((m) => m.id);

    // 1. All messages for these matches in one query, sorted newest-first
    const allMessages = matchIds.length > 0
      ? await db
          .select()
          .from(messagesTable)
          .where(inArray(messagesTable.matchId, matchIds))
          .orderBy(desc(messagesTable.createdAt))
      : [];

    // Build last-message map and unread-count map in memory
    const lastMessageByMatchId = new Map<string, typeof allMessages[number]>();
    const unreadCountByMatchId = new Map<string, number>();

    for (const msg of allMessages) {
      if (!lastMessageByMatchId.has(msg.matchId)) {
        lastMessageByMatchId.set(msg.matchId, msg);
      }
      if (!msg.isRead && msg.senderId !== userId) {
        unreadCountByMatchId.set(msg.matchId, (unreadCountByMatchId.get(msg.matchId) ?? 0) + 1);
      }
    }

    const matches = rawMatches.map((match) => {
      const otherUserId = match.userId1 === userId ? match.userId2 : match.userId1;
      const lastMessage = lastMessageByMatchId.get(match.id);
      const otherProfile = profilesByUserId.get(otherUserId);
      return {
        ...match,
        chatId: match.id,
        intent: otherProfile?.intent === "friendship" ? "friends" : "dating",
        originAction: "like",
        otherProfile,
        lastMessage,
        unreadCount: unreadCountByMatchId.get(match.id) ?? 0,
      };
    });
    const blockedByMe = await db.select({ userId: blocksTable.blockedUserId }).from(blocksTable).where(eq(blocksTable.blockerUserId, userId));
    const blockedMe = await db.select({ userId: blocksTable.blockerUserId }).from(blocksTable).where(eq(blocksTable.blockedUserId, userId));
    const blockedIds = new Set([...blockedByMe, ...blockedMe].map((item) => item.userId));
    const visibleMatches = matches.filter((match) => {
      const otherUserId = match.userId1 === userId ? match.userId2 : match.userId1;
      return !blockedIds.has(otherUserId);
    });

    return res.json({
      matches: visibleMatches,
      total: Number(totalRaw[0]?.count ?? 0),
      page,
      hasMore: offset + rawMatches.length < Number(totalRaw[0]?.count ?? 0),
    });
  } catch (err) {
    console.error("[GET /matches] error:", err);
    return res.status(500).json({ error: "Failed to load matches. Please try again." });
  }
});

router.delete("/matches/:matchId", async (req, res) => {
  const authResult = getAuth(req);
  const userId = shouldUseLocalDbFallback() ? localFallbackUserId(req) : authResult.userId;
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
