import { randomUUID } from "crypto";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { blocksTable, db, matchesTable, messagesTable, profilesTable } from "@workspace/db";

export type MatchIntent = "dating" | "friends" | "double_date";
export type MatchOriginAction =
  | "like"
  | "spark"
  | "shot"
  | "bestie"
  | "friend_accept"
  | "invite"
  | "double_date";

export class MatchThreadError extends Error {
  status: 400 | 403 | 404;

  constructor(status: 400 | 403 | 404, message: string) {
    super(message);
    this.status = status;
  }
}

function ageFromBirthDate(birthDate?: string | null) {
  if (!birthDate) return undefined;
  return Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

export async function assertMatchThreadAllowed(userId1: string, userId2: string) {
  if (!userId1 || !userId2) throw new MatchThreadError(400, "Both user ids are required.");
  if (userId1 === userId2) throw new MatchThreadError(400, "Cannot create a match with yourself.");

  const [block] = await db
    .select({ id: blocksTable.id })
    .from(blocksTable)
    .where(
      or(
        and(eq(blocksTable.blockerUserId, userId1), eq(blocksTable.blockedUserId, userId2)),
        and(eq(blocksTable.blockerUserId, userId2), eq(blocksTable.blockedUserId, userId1)),
      ),
    )
    .limit(1);

  if (block) throw new MatchThreadError(403, "This connection is blocked.");
}

export async function ensureMatchThread({
  userId1,
  userId2,
}: {
  userId1: string;
  userId2: string;
  intent?: MatchIntent;
  originAction?: MatchOriginAction;
  sourceId?: string;
}) {
  await assertMatchThreadAllowed(userId1, userId2);

  const [existingMatch] = await db
    .select()
    .from(matchesTable)
    .where(
      sql`(${matchesTable.userId1} = ${userId1} AND ${matchesTable.userId2} = ${userId2}) OR (${matchesTable.userId1} = ${userId2} AND ${matchesTable.userId2} = ${userId1})`,
    )
    .limit(1);

  if (existingMatch) return { match: existingMatch, created: false };

  const [match] = await db
    .insert(matchesTable)
    .values({ id: randomUUID(), userId1, userId2 })
    .returning();

  return { match, created: true };
}

export async function buildMatchThreadResponse({
  match,
  viewerUserId,
  intent = "dating",
  originAction = "like",
}: {
  match: typeof matchesTable.$inferSelect;
  viewerUserId: string;
  intent?: MatchIntent;
  originAction?: MatchOriginAction;
}) {
  const otherUserId = match.userId1 === viewerUserId ? match.userId2 : match.userId1;
  const [otherProfileRaw] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, otherUserId))
    .limit(1);
  const [lastMessage] = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.matchId, match.id))
    .orderBy(desc(messagesTable.createdAt))
    .limit(1);
  const [{ count: unreadRaw } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(messagesTable)
    .where(
      and(
        eq(messagesTable.matchId, match.id),
        eq(messagesTable.isRead, false),
        sql`${messagesTable.senderId} != ${viewerUserId}`,
      ),
    );

  const otherProfile = otherProfileRaw
    ? {
        ...otherProfileRaw,
        age: ageFromBirthDate(otherProfileRaw.birthDate),
      }
    : undefined;

  return {
    ...match,
    chatId: match.id,
    intent,
    originAction,
    otherProfile,
    lastMessage,
    unreadCount: Number(unreadRaw ?? 0),
  };
}
