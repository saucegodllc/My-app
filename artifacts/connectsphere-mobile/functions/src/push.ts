/**
 * Push notification endpoints
 * ────────────────────────────
 * POST /api/push/register    — save Expo push token for a user
 * POST /api/push/notify-match — send match notification to both users
 *
 * Uses Expo Push API (https://exp.host/--/api/v2/push/send) directly via
 * HTTPS so we don't need the expo-server-sdk npm package in functions.
 *
 * Firestore schema:
 *   pushTokens/{userId} → { tokens: string[], updatedAt: Timestamp }
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as https from "https";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function json(res: functions.Response, status: number, body: Record<string, unknown>) {
  res.status(status).json(body);
}

// ── push token registration ───────────────────────────────────────────────────

export const pushRegister = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const userId = (req.headers["x-cs-user-id"] as string | undefined) ?? "";
  if (!userId) return json(res, 401, { error: "Unauthorized" });

  const { token } = (req.body as { token?: string }) ?? {};
  if (!token || typeof token !== "string") return json(res, 400, { error: "token is required" });

  // Validate Expo push token format
  if (!token.startsWith("ExponentPushToken[") && !token.startsWith("ExpoPushToken[")) {
    return json(res, 400, { error: "Invalid Expo push token format" });
  }

  try {
    const ref = db.collection("pushTokens").doc(userId);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const existing: string[] = snap.data()?.tokens ?? [];
      // Deduplicate — keep latest 5 tokens (multi-device)
      const updated = Array.from(new Set([token, ...existing])).slice(0, 5);
      tx.set(ref, {
        tokens: updated,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    functions.logger.info("pushRegister: token saved", { userId });
    return json(res, 200, { ok: true });
  } catch (err) {
    functions.logger.error("pushRegister: error", { userId, err });
    return json(res, 500, { error: "Could not register push token." });
  }
});

// ── Expo push sender ──────────────────────────────────────────────────────────

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default";
  badge?: number;
  priority?: "default" | "normal" | "high";
}

function sendExpoPush(messages: ExpoMessage[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(messages);
    const options = {
      hostname: "exp.host",
      path: "/--/api/v2/push/send",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (httpRes) => {
      httpRes.on("data", () => undefined); // drain
      httpRes.on("end", resolve);
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function getUserTokens(userId: string): Promise<string[]> {
  const snap = await db.collection("pushTokens").doc(userId).get();
  return (snap.data()?.tokens as string[] | undefined) ?? [];
}

// ── notify-match ──────────────────────────────────────────────────────────────

export const pushNotifyMatch = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  // This endpoint is called server-to-server (e.g. from the reaction mutation
  // Cloud Function or a Firestore trigger). Secure via internal secret header.
  const secret = req.headers["x-internal-secret"] as string | undefined;
  const expectedSecret = process.env["INTERNAL_FUNCTION_SECRET"];
  if (!expectedSecret || secret !== expectedSecret) {
    return json(res, 401, { error: "Unauthorized" });
  }

  const { userId1, userId2, matchId } = (req.body as {
    userId1?: string;
    userId2?: string;
    matchId?: string;
  }) ?? {};

  if (!userId1 || !userId2 || !matchId) {
    return json(res, 400, { error: "userId1, userId2, and matchId are required" });
  }

  try {
    // Fetch both users' display names and push tokens concurrently
    const [profile1Snap, profile2Snap, tokens1, tokens2] = await Promise.all([
      db.collection("profiles").doc(userId1).get(),
      db.collection("profiles").doc(userId2).get(),
      getUserTokens(userId1),
      getUserTokens(userId2),
    ]);

    const name1: string = profile1Snap.data()?.displayName ?? "Someone";
    const name2: string = profile2Snap.data()?.displayName ?? "Someone";

    const messages: ExpoMessage[] = [];

    for (const token of tokens1) {
      messages.push({
        to: token,
        title: "It's a Match! 🎉",
        body: `You matched with ${name2}! Send the first message.`,
        data: { matchId, screen: "chat", matchedUserId: userId2 },
        sound: "default",
        priority: "high",
      });
    }

    for (const token of tokens2) {
      messages.push({
        to: token,
        title: "It's a Match! 🎉",
        body: `You matched with ${name1}! Send the first message.`,
        data: { matchId, screen: "chat", matchedUserId: userId1 },
        sound: "default",
        priority: "high",
      });
    }

    if (messages.length > 0) {
      await sendExpoPush(messages);
      functions.logger.info("pushNotifyMatch: sent", {
        matchId, userId1, userId2, tokenCount: messages.length,
      });
    }

    return json(res, 200, { ok: true, sent: messages.length });
  } catch (err) {
    functions.logger.error("pushNotifyMatch: error", { matchId, userId1, userId2, err });
    return json(res, 500, { error: "Push notification failed." });
  }
});

// ── Firestore trigger: auto-notify on new match doc ───────────────────────────

/**
 * Fires whenever a new match is created in /matches/{matchId}.
 * Sends push to both participants automatically — no API call needed.
 */
export const onMatchCreated = functions.firestore
  .document("matches/{matchId}")
  .onCreate(async (snap, context) => {
    const matchId = context.params["matchId"] as string;
    const data = snap.data() as {
      participants?: string[];
      createdAt?: admin.firestore.Timestamp;
    };

    const participants = data.participants ?? [];
    if (participants.length !== 2) return null;

    const [userId1, userId2] = participants as [string, string];

    try {
      const [profile1Snap, profile2Snap, tokens1, tokens2] = await Promise.all([
        db.collection("profiles").doc(userId1).get(),
        db.collection("profiles").doc(userId2).get(),
        getUserTokens(userId1),
        getUserTokens(userId2),
      ]);

      const name1: string = profile1Snap.data()?.displayName ?? "Someone";
      const name2: string = profile2Snap.data()?.displayName ?? "Someone";

      const messages: ExpoMessage[] = [
        ...tokens1.map((token) => ({
          to: token,
          title: "It's a Match! 🎉",
          body: `You matched with ${name2}! Say something.`,
          data: { matchId, screen: "chat", matchedUserId: userId2 },
          sound: "default" as const,
          priority: "high" as const,
        })),
        ...tokens2.map((token) => ({
          to: token,
          title: "It's a Match! 🎉",
          body: `You matched with ${name1}! Say something.`,
          data: { matchId, screen: "chat", matchedUserId: userId1 },
          sound: "default" as const,
          priority: "high" as const,
        })),
      ];

      if (messages.length > 0) await sendExpoPush(messages);

      functions.logger.info("onMatchCreated: push sent", {
        matchId, count: messages.length,
      });
    } catch (err) {
      functions.logger.error("onMatchCreated: error", { matchId, err });
    }

    return null;
  });
