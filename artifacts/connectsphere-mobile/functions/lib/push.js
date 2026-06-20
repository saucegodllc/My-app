"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onMatchCreated = exports.pushNotifyMatch = exports.pushRegister = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const https = __importStar(require("https"));
if (!admin.apps.length)
    admin.initializeApp();
const db = admin.firestore();
function json(res, status, body) {
    res.status(status).json(body);
}
// ── push token registration ───────────────────────────────────────────────────
exports.pushRegister = functions.https.onRequest(async (req, res) => {
    if (req.method !== "POST")
        return json(res, 405, { error: "Method not allowed" });
    const userId = req.headers["x-cs-user-id"] ?? "";
    if (!userId)
        return json(res, 401, { error: "Unauthorized" });
    const { token } = req.body ?? {};
    if (!token || typeof token !== "string")
        return json(res, 400, { error: "token is required" });
    // Validate Expo push token format
    if (!token.startsWith("ExponentPushToken[") && !token.startsWith("ExpoPushToken[")) {
        return json(res, 400, { error: "Invalid Expo push token format" });
    }
    try {
        const ref = db.collection("pushTokens").doc(userId);
        await db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            const existing = snap.data()?.tokens ?? [];
            // Deduplicate — keep latest 5 tokens (multi-device)
            const updated = Array.from(new Set([token, ...existing])).slice(0, 5);
            tx.set(ref, {
                tokens: updated,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        });
        functions.logger.info("pushRegister: token saved", { userId });
        return json(res, 200, { ok: true });
    }
    catch (err) {
        functions.logger.error("pushRegister: error", { userId, err });
        return json(res, 500, { error: "Could not register push token." });
    }
});
function sendExpoPush(messages) {
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
async function getUserTokens(userId) {
    const snap = await db.collection("pushTokens").doc(userId).get();
    return snap.data()?.tokens ?? [];
}
// ── notify-match ──────────────────────────────────────────────────────────────
exports.pushNotifyMatch = functions.https.onRequest(async (req, res) => {
    if (req.method !== "POST")
        return json(res, 405, { error: "Method not allowed" });
    // This endpoint is called server-to-server (e.g. from the reaction mutation
    // Cloud Function or a Firestore trigger). Secure via internal secret header.
    const secret = req.headers["x-internal-secret"];
    const expectedSecret = process.env["INTERNAL_FUNCTION_SECRET"];
    if (!expectedSecret || secret !== expectedSecret) {
        return json(res, 401, { error: "Unauthorized" });
    }
    const { userId1, userId2, matchId } = req.body ?? {};
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
        const name1 = profile1Snap.data()?.displayName ?? "Someone";
        const name2 = profile2Snap.data()?.displayName ?? "Someone";
        const messages = [];
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
    }
    catch (err) {
        functions.logger.error("pushNotifyMatch: error", { matchId, userId1, userId2, err });
        return json(res, 500, { error: "Push notification failed." });
    }
});
// ── Firestore trigger: auto-notify on new match doc ───────────────────────────
/**
 * Fires whenever a new match is created in /matches/{matchId}.
 * Sends push to both participants automatically — no API call needed.
 */
exports.onMatchCreated = functions.firestore
    .document("matches/{matchId}")
    .onCreate(async (snap, context) => {
    const matchId = context.params["matchId"];
    const data = snap.data();
    const participants = data.participants ?? [];
    if (participants.length !== 2)
        return null;
    const [userId1, userId2] = participants;
    try {
        const [profile1Snap, profile2Snap, tokens1, tokens2] = await Promise.all([
            db.collection("profiles").doc(userId1).get(),
            db.collection("profiles").doc(userId2).get(),
            getUserTokens(userId1),
            getUserTokens(userId2),
        ]);
        const name1 = profile1Snap.data()?.displayName ?? "Someone";
        const name2 = profile2Snap.data()?.displayName ?? "Someone";
        const messages = [
            ...tokens1.map((token) => ({
                to: token,
                title: "It's a Match! 🎉",
                body: `You matched with ${name2}! Say something.`,
                data: { matchId, screen: "chat", matchedUserId: userId2 },
                sound: "default",
                priority: "high",
            })),
            ...tokens2.map((token) => ({
                to: token,
                title: "It's a Match! 🎉",
                body: `You matched with ${name1}! Say something.`,
                data: { matchId, screen: "chat", matchedUserId: userId1 },
                sound: "default",
                priority: "high",
            })),
        ];
        if (messages.length > 0)
            await sendExpoPush(messages);
        functions.logger.info("onMatchCreated: push sent", {
            matchId, count: messages.length,
        });
    }
    catch (err) {
        functions.logger.error("onMatchCreated: error", { matchId, err });
    }
    return null;
});
//# sourceMappingURL=push.js.map