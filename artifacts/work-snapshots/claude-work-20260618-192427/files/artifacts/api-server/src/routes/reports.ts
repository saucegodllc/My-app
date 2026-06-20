import { Router, type Request, type Response } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { db } from "@workspace/db";
import { reportsTable, blocksTable, profilesTable } from "@workspace/db";
import { ReportUserBody, BlockUserBody } from "@workspace/api-zod";
import { getAuth } from "@clerk/express";
import { createOpsId, nowIso, readOpsStore, writeOpsStore } from "../lib/operationalStore";
import { logLaunchEvent } from "../lib/monitoring";
import { rateLimit } from "../middlewares/rateLimit";

const router = Router();

type LegacyFriendsDb = {
  blockedUsers?: Array<{ id: string; userId: string; blockedUserId: string; createdAt: string }>;
  connectionRequests?: Array<{ fromUserId: string; toUserId: string; status: string }>;
  planJoinRequests?: Array<{ fromUserId: string; creatorId: string; status: string }>;
  connections?: Array<{ userIds?: string[]; userAId?: string; userBId?: string }>;
  [key: string]: unknown;
};

const workspaceRoot = process.cwd().endsWith(join("artifacts", "api-server"))
  ? join(process.cwd(), "..", "..")
  : process.cwd();
const legacyDbPath = join(workspaceRoot, "artifacts", "api-server", "db.json");

function blockCreatedAtIso(createdAt: Date | string) {
  return createdAt instanceof Date ? createdAt.toISOString() : new Date(createdAt).toISOString();
}

async function ensureBlock(blockerUserId: string, blockedUserId: string) {
  const [existing] = await db
    .select()
    .from(blocksTable)
    .where(and(eq(blocksTable.blockerUserId, blockerUserId), eq(blocksTable.blockedUserId, blockedUserId)))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(blocksTable)
    .values({
      id: randomUUID(),
      blockerUserId,
      blockedUserId,
    })
    .returning();
  return created;
}

function readLegacyFriendsDb(): LegacyFriendsDb {
  if (!existsSync(legacyDbPath)) return {};
  return JSON.parse(readFileSync(legacyDbPath, "utf8")) as LegacyFriendsDb;
}

function writeLegacyFriendsDb(data: LegacyFriendsDb) {
  mkdirSync(dirname(legacyDbPath), { recursive: true });
  writeFileSync(legacyDbPath, `${JSON.stringify(data, null, 2)}\n`);
}

function addLegacyBlock(blockerUserId: string, blockedUserId: string) {
  const legacyDb = readLegacyFriendsDb();
  legacyDb.blockedUsers = legacyDb.blockedUsers ?? [];
  const exists = legacyDb.blockedUsers.some(
    (block) => block.userId === blockerUserId && block.blockedUserId === blockedUserId,
  );
  if (!exists) {
    legacyDb.blockedUsers.push({ id: randomUUID(), userId: blockerUserId, blockedUserId, createdAt: new Date().toISOString() });
  }

  legacyDb.connectionRequests = (legacyDb.connectionRequests ?? []).map((request) =>
    request.status === "pending" &&
    ((request.fromUserId === blockerUserId && request.toUserId === blockedUserId) ||
      (request.fromUserId === blockedUserId && request.toUserId === blockerUserId))
      ? { ...request, status: "canceled" }
      : request,
  );
  legacyDb.planJoinRequests = (legacyDb.planJoinRequests ?? []).map((request) =>
    request.status === "pending" &&
    ((request.fromUserId === blockerUserId && request.creatorId === blockedUserId) ||
      (request.fromUserId === blockedUserId && request.creatorId === blockerUserId))
      ? { ...request, status: "canceled" }
      : request,
  );
  legacyDb.connections = (legacyDb.connections ?? []).filter((connection) => {
    const ids = connection.userIds ?? [connection.userAId, connection.userBId].filter((id): id is string => Boolean(id));
    return !(ids.includes(blockerUserId) && ids.includes(blockedUserId));
  });
  writeLegacyFriendsDb(legacyDb);
}

function removeLegacyBlock(blockerUserId: string, blockedUserId: string) {
  if (!existsSync(legacyDbPath)) return 0;
  const legacyDb = readLegacyFriendsDb();
  const before = legacyDb.blockedUsers?.length ?? 0;
  legacyDb.blockedUsers = (legacyDb.blockedUsers ?? []).filter(
    (block) => !(block.userId === blockerUserId && block.blockedUserId === blockedUserId),
  );
  writeLegacyFriendsDb(legacyDb);
  return before - legacyDb.blockedUsers.length;
}

function priorityForReason(reason: string): "low" | "normal" | "high" | "urgent" {
  if (reason === "underage") return "urgent";
  // Accept both canonical "fake_profile" and legacy "fake" for backwards compat
  if (reason === "harassment" || reason === "fake_profile" || reason === "fake") return "high";
  if (reason === "inappropriate_content" || reason === "inappropriate") return "normal";
  if (reason === "spam") return "normal";
  return "low";
}

function requireAdmin(req: Request, res: Response) {
  const adminToken = process.env.CONNECTSPHERE_ADMIN_TOKEN;
  const token = req.header("x-connectsphere-admin-token");
  if (!adminToken || token !== adminToken) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return req.header("x-connectsphere-admin-id") || "admin";
}

router.post("/reports", rateLimit({ key: "reports", windowMs: 60_000, max: 8 }), async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const parsed = ReportUserBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid data" });

  const reportId = randomUUID();
  await db.insert(reportsTable).values({
    id: reportId,
    reporterUserId: userId,
    reportedUserId: parsed.data.reportedUserId,
    reason: parsed.data.reason,
    details: parsed.data.details,
  });

  const store = readOpsStore();
  const now = nowIso();
  store.moderationQueue.push({
    id: createOpsId(),
    reportId,
    reporterUserId: userId,
    reportedUserId: parsed.data.reportedUserId,
    reason: parsed.data.reason,
    details: parsed.data.details,
    context: typeof req.body?.context === "string" ? req.body.context : undefined,
    targetType: typeof req.body?.targetType === "string" ? req.body.targetType : "profile",
    targetId: typeof req.body?.targetId === "string" ? req.body.targetId : parsed.data.reportedUserId,
    status: "open",
    priority: priorityForReason(parsed.data.reason),
    createdAt: now,
    updatedAt: now,
  });
  writeOpsStore(store);
  logLaunchEvent("report_submitted", { userId, targetId: parsed.data.reportedUserId, reason: parsed.data.reason, ip: req.ip });

  return res.status(201).json({ success: true, message: "Report submitted" });
});

router.post("/reports/block", rateLimit({ key: "blocks", windowMs: 60_000, max: 20 }), async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const parsed = BlockUserBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid data" });
  if (parsed.data.blockedUserId === userId) return res.status(400).json({ error: "You cannot block yourself" });

  const block = await ensureBlock(userId, parsed.data.blockedUserId);
  addLegacyBlock(userId, parsed.data.blockedUserId);
  logLaunchEvent("user_blocked", { userId, targetId: parsed.data.blockedUserId, ip: req.ip });

  return res.json({ success: true, message: "User blocked", block });
});

router.get("/reports/blocked", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const blocked = await db
    .select()
    .from(blocksTable)
    .where(eq(blocksTable.blockerUserId, userId));

  const profiles =
    blocked.length > 0
      ? await db
          .select({
            userId: profilesTable.userId,
            displayName: profilesTable.displayName,
            photos: profilesTable.photos,
          })
          .from(profilesTable)
          .where(inArray(profilesTable.userId, blocked.map((b) => b.blockedUserId)))
      : [];
  const profilesByUserId = new Map(profiles.map((profile) => [profile.userId, profile]));

  return res.json({
    blockedUsers: blocked.map((b) => {
      const profile = profilesByUserId.get(b.blockedUserId);
      return {
        id: b.blockedUserId,
        userId: b.blockedUserId,
        name: profile?.displayName ?? "Unknown",
        photoUrl: profile?.photos?.[0] ?? "",
        blockedAt: blockCreatedAtIso(b.createdAt),
      };
    }),
  });
});

router.delete("/reports/blocked/:blockedUserId", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const blockedUserId = req.params.blockedUserId;
  if (!blockedUserId) return res.status(400).json({ error: "blockedUserId is required" });

  const removed = await db
    .delete(blocksTable)
    .where(and(eq(blocksTable.blockerUserId, userId), eq(blocksTable.blockedUserId, blockedUserId)))
    .returning();
  const legacyRemoved = removeLegacyBlock(userId, blockedUserId);

  logLaunchEvent("user_unblocked", { userId, targetId: blockedUserId, removed: removed.length, legacyRemoved, ip: req.ip });
  return res.json({ success: true, unblockedUserId: blockedUserId, removed: removed.length, legacyRemoved });
});

router.get("/moderation/reports", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const store = readOpsStore();
  return res.json({ reports: store.moderationQueue });
});

router.patch("/moderation/reports/:id", async (req, res) => {
  const adminId = requireAdmin(req, res);
  if (!adminId) return;
  const store = readOpsStore();
  const report = store.moderationQueue.find((item) => item.id === req.params.id);
  if (!report) return res.status(404).json({ error: "Moderation report not found" });
  const nextStatus = String(req.body?.status ?? report.status);
  if (!["open", "reviewing", "resolved", "dismissed"].includes(nextStatus)) {
    return res.status(400).json({ error: "Invalid moderation status" });
  }
  report.status = nextStatus as typeof report.status;
  report.resolutionNotes = typeof req.body?.resolutionNotes === "string" ? req.body.resolutionNotes : report.resolutionNotes;
  report.updatedAt = nowIso();
  if (report.status === "resolved" || report.status === "dismissed") report.resolvedAt = report.updatedAt;
  store.adminAuditLog.push({
    id: createOpsId(),
    adminId,
    action: `report_${report.status}`,
    targetType: "report",
    targetId: report.id,
    reason: report.resolutionNotes,
    requestId: req.header("x-request-id") ?? undefined,
    createdAt: report.updatedAt,
  });
  writeOpsStore(store);
  return res.json({ report });
});

router.get("/admin/reports", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const store = readOpsStore();
  return res.json({ reports: store.moderationQueue });
});

router.get("/admin/reports/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const store = readOpsStore();
  const report = store.moderationQueue.find((item) => item.id === req.params.id);
  if (!report) return res.status(404).json({ error: "Report not found" });
  return res.json({ report });
});

router.patch("/admin/reports/:id", async (req, res) => {
  const adminId = requireAdmin(req, res);
  if (!adminId) return;
  const store = readOpsStore();
  const report = store.moderationQueue.find((item) => item.id === req.params.id);
  if (!report) return res.status(404).json({ error: "Report not found" });
  const status = String(req.body?.status ?? report.status);
  if (!["open", "reviewing", "resolved", "dismissed"].includes(status)) return res.status(400).json({ error: "Invalid status" });
  report.status = status as typeof report.status;
  report.resolutionNotes = typeof req.body?.resolutionNotes === "string" ? req.body.resolutionNotes : report.resolutionNotes;
  report.updatedAt = nowIso();
  if (report.status === "resolved" || report.status === "dismissed") report.resolvedAt = report.updatedAt;
  store.adminAuditLog.push({
    id: createOpsId(),
    adminId,
    action: `report_${report.status}`,
    targetType: "report",
    targetId: report.id,
    reason: report.resolutionNotes,
    requestId: req.header("x-request-id") ?? undefined,
    createdAt: report.updatedAt,
  });
  writeOpsStore(store);
  return res.json({ report });
});

router.post("/admin/users/:userId/suspend", async (req, res) => {
  const adminId = requireAdmin(req, res);
  if (!adminId) return;
  const store = readOpsStore();
  const now = nowIso();
  store.suspendedUsers = store.suspendedUsers.filter((item) => item.userId !== req.params.userId);
  store.suspendedUsers.push({
    userId: req.params.userId,
    status: "suspended",
    reason: typeof req.body?.reason === "string" ? req.body.reason : undefined,
    adminId,
    createdAt: now,
  });
  store.adminAuditLog.push({ id: createOpsId(), adminId, action: "user_suspended", targetType: "user", targetId: req.params.userId, reason: req.body?.reason, requestId: req.header("x-request-id") ?? undefined, createdAt: now });
  writeOpsStore(store);
  return res.json({ ok: true, userId: req.params.userId, status: "suspended" });
});

router.post("/admin/users/:userId/ban", async (req, res) => {
  const adminId = requireAdmin(req, res);
  if (!adminId) return;
  const store = readOpsStore();
  const now = nowIso();
  store.suspendedUsers = store.suspendedUsers.filter((item) => item.userId !== req.params.userId);
  store.suspendedUsers.push({
    userId: req.params.userId,
    status: "banned",
    reason: typeof req.body?.reason === "string" ? req.body.reason : undefined,
    adminId,
    createdAt: now,
  });
  store.adminAuditLog.push({ id: createOpsId(), adminId, action: "user_banned", targetType: "user", targetId: req.params.userId, reason: req.body?.reason, requestId: req.header("x-request-id") ?? undefined, createdAt: now });
  writeOpsStore(store);
  return res.json({ ok: true, userId: req.params.userId, status: "banned" });
});

router.get("/admin/audit-log", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const store = readOpsStore();
  return res.json({ auditLog: store.adminAuditLog.slice().reverse() });
});

export default router;
