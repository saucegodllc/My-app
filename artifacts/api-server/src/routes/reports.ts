import { Router } from "express";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { reportsTable, blocksTable } from "@workspace/db";
import { ReportUserBody, BlockUserBody } from "@workspace/api-zod";
import { getAuth } from "@clerk/express";

const router = Router();

router.post("/reports", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const parsed = ReportUserBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid data" });

  await db.insert(reportsTable).values({
    id: randomUUID(),
    reporterUserId: userId,
    reportedUserId: parsed.data.reportedUserId,
    reason: parsed.data.reason,
    details: parsed.data.details,
  });

  return res.status(201).json({ success: true, message: "Report submitted" });
});

router.post("/reports/block", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const parsed = BlockUserBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid data" });

  await db
    .insert(blocksTable)
    .values({
      id: randomUUID(),
      blockerUserId: userId,
      blockedUserId: parsed.data.blockedUserId,
    })
    .onConflictDoNothing();

  return res.json({ success: true, message: "User blocked" });
});

router.get("/reports/blocked", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const blocked = await db
    .select()
    .from(blocksTable)
    .where(eq(blocksTable.blockerUserId, userId));

  return res.json({
    blockedUsers: blocked.map((b) => ({
      userId: b.blockedUserId,
      blockedAt: b.createdAt.toISOString(),
    })),
  });
});

export default router;
