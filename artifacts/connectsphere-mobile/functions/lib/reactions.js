"use strict";
/**
 * reactions.ts — ConnectSphere Reaction Cloud Functions
 *
 * withdrawReaction  POST /api/inbox/reactions/withdraw
 *   Lets a user undo a "vibe" (like) or "spark" they sent before the other
 *   person responds. Called by the Rewind feature on the client.
 *
 *   Body: { senderId: string; receiverId: string; type: "like" | "spark" }
 *   Auth: x-cs-user-id header must match senderId
 *
 *   Firestore paths touched:
 *     reactions/{receiverId}/received/{senderId}  — deleted
 *     reactions/{senderId}/sent/{receiverId}      — deleted (if present)
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
exports.withdrawReaction = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
if (!admin.apps.length)
    admin.initializeApp();
const db = admin.firestore();
// ── Helpers ───────────────────────────────────────────────────────────────────
function json(res, status, body) {
    res.status(status).json(body);
}
// ── withdrawReaction ──────────────────────────────────────────────────────────
exports.withdrawReaction = functions.https.onRequest(async (req, res) => {
    if (req.method !== "POST") {
        json(res, 405, { error: "Method not allowed" });
        return;
    }
    // Auth: caller must identify as the sender
    const callerId = req.headers["x-cs-user-id"];
    const { senderId, receiverId, type: reactionType } = req.body;
    if (!senderId || !receiverId || !reactionType) {
        json(res, 400, { error: "Missing required fields: senderId, receiverId, type" });
        return;
    }
    if (!["like", "spark"].includes(reactionType)) {
        json(res, 400, { error: "type must be 'like' or 'spark'" });
        return;
    }
    if (!callerId || callerId !== senderId) {
        json(res, 401, { error: "Unauthorized: x-cs-user-id must match senderId" });
        return;
    }
    try {
        // Check current reaction state — only withdraw if still pending
        const receivedRef = db
            .collection("reactions")
            .doc(receiverId)
            .collection("received")
            .doc(senderId);
        const sentRef = db
            .collection("reactions")
            .doc(senderId)
            .collection("sent")
            .doc(receiverId);
        const snap = await receivedRef.get();
        if (!snap.exists) {
            // Reaction doesn't exist — already withdrawn or never existed. Idempotent.
            json(res, 200, { ok: true, withdrawn: false, reason: "not_found" });
            return;
        }
        const data = snap.data();
        // Guard: don't withdraw reactions that have already been acted on
        if (data?.status && data.status !== "pending") {
            json(res, 409, {
                ok: false,
                withdrawn: false,
                reason: "already_acted",
                status: data.status,
            });
            return;
        }
        // Atomic delete of both the received and sent copies
        const batch = db.batch();
        batch.delete(receivedRef);
        batch.delete(sentRef);
        await batch.commit();
        json(res, 200, { ok: true, withdrawn: true });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        functions.logger.error("withdrawReaction error", { senderId, receiverId, reactionType, error: message });
        json(res, 500, { error: "Internal server error" });
    }
});
//# sourceMappingURL=reactions.js.map