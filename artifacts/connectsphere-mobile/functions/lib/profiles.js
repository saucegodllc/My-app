"use strict";
/**
 * Profile endpoints
 * ──────────────────
 * GET /api/profiles/username/check?username=<value>
 *   Returns { available: boolean, normalized: string }
 *
 * Rules:
 *  - 3–20 chars
 *  - alphanumeric + underscore only
 *  - case-insensitive (stored lowercase)
 *  - reserved words blocked
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
exports.usernameClaim = exports.usernameCheck = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
if (!admin.apps.length)
    admin.initializeApp();
const db = admin.firestore();
const RESERVED = new Set([
    "admin", "support", "connectsphere", "staff", "team", "official",
    "help", "info", "security", "root", "system", "null", "undefined",
    "moderator", "mod", "bot", "api", "app", "web", "ios", "android",
]);
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
function json(res, status, body) {
    res.status(status).json(body);
}
exports.usernameCheck = functions.https.onRequest(async (req, res) => {
    // CORS — needed for web preview
    res.set("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") {
        res.set("Access-Control-Allow-Methods", "GET");
        res.set("Access-Control-Allow-Headers", "Content-Type");
        res.status(204).send("");
        return;
    }
    if (req.method !== "GET")
        return json(res, 405, { error: "Method not allowed" });
    const raw = req.query["username"] ?? "";
    const normalized = raw.trim().toLowerCase().replace(/\s+/g, "_");
    if (!USERNAME_RE.test(normalized)) {
        return json(res, 200, {
            available: false,
            normalized,
            reason: "Usernames must be 3–20 characters and contain only letters, numbers, and underscores.",
        });
    }
    if (RESERVED.has(normalized)) {
        return json(res, 200, {
            available: false,
            normalized,
            reason: "That username is reserved.",
        });
    }
    try {
        // Check Firestore usernames index
        const snap = await db.collection("usernames").doc(normalized).get();
        return json(res, 200, { available: !snap.exists, normalized });
    }
    catch (err) {
        functions.logger.error("usernameCheck: error", { normalized, err });
        return json(res, 500, { error: "Could not check username availability." });
    }
});
/**
 * Claim a username atomically.
 * Called by the onboarding flow after the user confirms.
 *
 * POST /api/profiles/username/claim  { username: string }
 */
exports.usernameClaim = functions.https.onRequest(async (req, res) => {
    if (req.method !== "POST")
        return json(res, 405, { error: "Method not allowed" });
    const userId = req.headers["x-cs-user-id"] ?? "";
    if (!userId)
        return json(res, 401, { error: "Unauthorized" });
    const { username } = req.body ?? {};
    if (!username)
        return json(res, 400, { error: "username is required" });
    const normalized = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(normalized) || RESERVED.has(normalized)) {
        return json(res, 400, { error: "Invalid username" });
    }
    try {
        await db.runTransaction(async (tx) => {
            const nameRef = db.collection("usernames").doc(normalized);
            const existing = await tx.get(nameRef);
            if (existing.exists && existing.data()?.userId !== userId) {
                throw new Error("TAKEN");
            }
            tx.set(nameRef, { userId, claimedAt: admin.firestore.FieldValue.serverTimestamp() });
            tx.set(db.collection("profiles").doc(userId), { username: normalized }, { merge: true });
        });
        return json(res, 200, { ok: true, username: normalized });
    }
    catch (err) {
        if (err instanceof Error && err.message === "TAKEN") {
            return json(res, 409, { error: "That username is already taken." });
        }
        functions.logger.error("usernameClaim: error", { userId, normalized, err });
        return json(res, 500, { error: "Could not claim username." });
    }
});
//# sourceMappingURL=profiles.js.map