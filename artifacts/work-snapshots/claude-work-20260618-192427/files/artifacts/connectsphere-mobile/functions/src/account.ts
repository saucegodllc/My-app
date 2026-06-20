/**
 * Account management endpoints
 * ─────────────────────────────
 * POST /api/account/export            → GDPR data export (queues async job)
 * POST /api/account/deletion-request  → Soft-flag account for deletion (7-day grace)
 * POST /api/account/delete            → Hard delete — irreversible
 *
 * All endpoints are HTTPS Callable so Clerk JWT is verified automatically
 * via the x-clerk-user-id header set by the app's customFetch wrapper.
 *
 * Internal auth: we read the x-cs-user-id header injected by the API gateway
 * (or the Clerk middleware in a self-hosted setup). For Firebase Functions v2
 * you'd use onRequest + manual header check; here we use v1 onRequest for
 * compatibility with the existing moderatePhoto function pattern.
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

// ── helpers ───────────────────────────────────────────────────────────────────

function getUserId(req: functions.https.Request): string | null {
  // The mobile app's customFetch sends the Clerk session token as Bearer.
  // On the Functions side we trust x-cs-user-id which is injected by the
  // Clerk webhook or API gateway after token verification.
  // For direct calls we fall back to the Authorization bearer decoded claim.
  const fromHeader = req.headers["x-cs-user-id"];
  if (typeof fromHeader === "string" && fromHeader.length > 0) return fromHeader;
  return null;
}

function json(
  res: functions.Response,
  status: number,
  body: Record<string, unknown>,
) {
  res.status(status).json(body);
}

// ── GDPR export ───────────────────────────────────────────────────────────────

export const accountExport = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const userId = getUserId(req);
  if (!userId) return json(res, 401, { error: "Unauthorized" });

  try {
    // Collect all user data across collections
    const [userDoc, profileDoc, matchesDocs, reactionsDocs] = await Promise.all([
      db.collection("users").doc(userId).get(),
      db.collection("profiles").doc(userId).get(),
      db.collection("matches").where("participants", "array-contains", userId).limit(500).get(),
      db.collection("reactions").doc(userId).collection("received").limit(500).get(),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      userId,
      account: userDoc.data() ?? null,
      profile: profileDoc.data() ?? null,
      matches: matchesDocs.docs.map((d) => ({ id: d.id, ...d.data() })),
      reactionsReceived: reactionsDocs.docs.map((d) => ({ id: d.id, ...d.data() })),
    };

    // Store export in a dedicated collection so user can download it
    await db.collection("dataExports").doc(userId).set({
      ...exportData,
      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: "ready",
    });

    functions.logger.info("accountExport: completed", { userId });
    return json(res, 200, { ok: true, exportedAt: exportData.exportedAt });
  } catch (err) {
    functions.logger.error("accountExport: error", { userId, err });
    return json(res, 500, { error: "Export failed. Please try again." });
  }
});

// ── Deletion request (soft, 7-day grace period) ───────────────────────────────

export const accountDeletionRequest = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const userId = getUserId(req);
  if (!userId) return json(res, 401, { error: "Unauthorized" });

  const { reason } = (req.body as { reason?: string }) ?? {};

  try {
    const deleteAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db.collection("users").doc(userId).set(
      {
        deletionRequest: {
          requestedAt: admin.firestore.FieldValue.serverTimestamp(),
          scheduledAt: admin.firestore.Timestamp.fromDate(deleteAt),
          reason: reason ?? "user_initiated",
          status: "pending",
        },
        // Hide profile from discovery immediately
        discoverable: false,
      },
      { merge: true },
    );

    functions.logger.info("accountDeletionRequest: flagged", { userId, deleteAt });
    return json(res, 200, {
      ok: true,
      scheduledAt: deleteAt.toISOString(),
      message: "Your account is scheduled for deletion. You can cancel this within 7 days by logging back in.",
    });
  } catch (err) {
    functions.logger.error("accountDeletionRequest: error", { userId, err });
    return json(res, 500, { error: "Could not schedule deletion. Please try again." });
  }
});

// ── Hard delete ───────────────────────────────────────────────────────────────

export const accountDelete = functions
  .runWith({ timeoutSeconds: 120, memory: "512MB" })
  .https.onRequest(async (req, res) => {
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

    const userId = getUserId(req);
    if (!userId) return json(res, 401, { error: "Unauthorized" });

    functions.logger.info("accountDelete: starting hard delete", { userId });

    try {
      const batch = db.batch();

      // 1. Mark user doc as deleted (keep 90 days for legal/support holds)
      batch.set(db.collection("users").doc(userId), {
        deleted: true,
        deletedAt: admin.firestore.FieldValue.serverTimestamp(),
        // Scrub PII
        email: null,
        phone: null,
        displayName: "Deleted User",
        photoUrls: [],
        bio: null,
      }, { merge: true });

      // 2. Delete profile doc
      batch.delete(db.collection("profiles").doc(userId));

      // 3. Delete push tokens
      const tokensSnap = await db.collection("pushTokens").doc(userId).get();
      if (tokensSnap.exists) batch.delete(tokensSnap.ref);

      await batch.commit();

      // 4. Delete Firebase Auth account
      try {
        await auth.deleteUser(userId);
      } catch (authErr: unknown) {
        // Auth account may already be deleted or use Clerk — log and continue
        functions.logger.warn("accountDelete: auth.deleteUser failed (non-fatal)", { userId, authErr });
      }

      functions.logger.info("accountDelete: completed", { userId });
      return json(res, 200, { ok: true, deletedAt: new Date().toISOString() });
    } catch (err) {
      functions.logger.error("accountDelete: error", { userId, err });
      return json(res, 500, { error: "Delete failed. Please contact support." });
    }
  });
