import { Router } from "express";
import { and, eq, or } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, blocksTable, messagesTable, profilesTable, reportsTable } from "@workspace/db";
import { createOpsId, nowIso, readOpsStore, writeOpsStore } from "../lib/operationalStore";
import { captureApiError, logLaunchEvent } from "../lib/monitoring";
import { rateLimit } from "../middlewares/rateLimit";

const router = Router();
const RETAINED_DATA = [
  "moderation reports needed to investigate safety issues",
  "payment records required by app stores and tax law",
  "security logs needed to prevent abuse",
];

async function deleteClerkUser(userId: string): Promise<boolean> {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret || secret === "sk_test_connectsphere_local") return false;
  const response = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${secret}` },
  });
  return response.ok || response.status === 404;
}

router.post("/account/export", rateLimit({ key: "account_export", windowMs: 60_000, max: 3 }), async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const store = readOpsStore();
  const existing = store.dataExportRequests.find((item) => item.userId === userId && item.status !== "failed");
  const record =
    existing ??
    {
      id: createOpsId(),
      userId,
      status: "queued" as const,
      requestedAt: nowIso(),
      updatedAt: nowIso(),
    };
  if (!existing) store.dataExportRequests.push(record);
  writeOpsStore(store);
  logLaunchEvent("account_export_requested", { userId, ip: req.ip });

  return res.status(existing ? 200 : 202).json({
    request: record,
    message: "Your data export request is queued. We'll notify you when it is ready.",
  });
});

router.post("/account/deletion-request", rateLimit({ key: "account_deletion_request", windowMs: 60_000, max: 3 }), async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const reason = typeof req.body?.reason === "string" ? req.body.reason.slice(0, 500) : undefined;
  const store = readOpsStore();
  const existing = store.accountDeletionRequests.find((item) => item.userId === userId && item.status !== "completed");
  const record =
    existing ??
    {
      id: createOpsId(),
      userId,
      status: "queued" as const,
      confirmation: "DELETE",
      reason,
      retainedData: RETAINED_DATA,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
  if (existing) {
    existing.reason = reason ?? existing.reason;
    existing.updatedAt = nowIso();
  } else {
    store.accountDeletionRequests.push(record);
  }
  writeOpsStore(store);
  logLaunchEvent("account_deletion_requested", { userId, ip: req.ip });

  return res.status(existing ? 200 : 202).json({
    request: record,
    retainedData: RETAINED_DATA,
    message: "Deletion is queued. Confirm with DELETE to remove your account data.",
  });
});

router.get("/account/deletion-status", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const store = readOpsStore();
  const request = [...store.accountDeletionRequests].reverse().find((item) => item.userId === userId) ?? null;
  return res.json({ request, retainedData: RETAINED_DATA });
});

router.post("/account/delete", rateLimit({ key: "account_delete", windowMs: 60_000, max: 2 }), async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  if (req.body?.confirmation !== "DELETE") {
    return res.status(400).json({ error: "Type DELETE to confirm account deletion." });
  }

  const store = readOpsStore();
  let record = store.accountDeletionRequests.find((item) => item.userId === userId && item.status !== "completed");
  if (!record) {
    record = {
      id: createOpsId(),
      userId,
      status: "processing",
      confirmation: "DELETE",
      retainedData: RETAINED_DATA,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    store.accountDeletionRequests.push(record);
  }
  record.status = "processing";
  record.updatedAt = nowIso();
  writeOpsStore(store);

  try {
    await db.delete(messagesTable).where(eq(messagesTable.senderId, userId));
    await db.delete(blocksTable).where(or(eq(blocksTable.blockerUserId, userId), eq(blocksTable.blockedUserId, userId)));
    await db.delete(reportsTable).where(and(eq(reportsTable.reporterUserId, userId), eq(reportsTable.isReviewed, false)));
    await db.delete(profilesTable).where(eq(profilesTable.userId, userId));
    const clerkDeleted = await deleteClerkUser(userId).catch((err) => {
      captureApiError(err, { userId, action: "clerk_delete" });
      return false;
    });

    record.status = "completed";
    record.updatedAt = nowIso();
    writeOpsStore(store);
    logLaunchEvent("account_deleted", { userId, ip: req.ip });

    return res.json({
      ok: true,
      request: record,
      clerkDeleted,
      retainedData: RETAINED_DATA,
    });
  } catch (err) {
    record.status = "queued";
    record.updatedAt = nowIso();
    writeOpsStore(store);
    captureApiError(err, { userId, action: "account_delete" });
    return res.status(500).json({ error: "Account deletion could not complete. Your request remains queued." });
  }
});

export default router;
