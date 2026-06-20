"use strict";
/**
 * moderatePhoto
 * ──────────────
 * Cloud Function — triggered when a file is uploaded to Firebase Storage.
 * Checks profile photos against Google Vision SafeSearch.
 * If VERY_LIKELY adult/violence content is detected, deletes the file and
 * marks the user's Firestore doc so the app can show a warning.
 *
 * Paths checked: profiles/{userId}/**
 *
 * Deploy:
 *   cd functions && npm run deploy
 *
 * Required env vars (set via firebase functions:config:set or Secret Manager):
 *   GOOGLE_CLOUD_PROJECT — auto-set by Functions runtime
 *   (Vision API is enabled via the same service account as Cloud Functions)
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.moderatePhoto = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const vision_1 = __importDefault(require("@google-cloud/vision"));
// ── init ─────────────────────────────────────────────────────────────────────
if (!admin.apps.length)
    admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage();
const visionClient = new vision_1.default.ImageAnnotatorClient();
const FLAGRANT = ["LIKELY", "VERY_LIKELY"];
function isFlagged(label) {
    return FLAGRANT.includes((label ?? "UNKNOWN"));
}
// ── helper: update user doc ───────────────────────────────────────────────────
async function flagUserPhoto(userId, filePath) {
    await db.collection("users").doc(userId).set({
        photoModerationFlag: {
            flaggedAt: admin.firestore.FieldValue.serverTimestamp(),
            path: filePath,
            reason: "SafeSearch: adult or violent content detected",
        },
    }, { merge: true });
}
// ── main handler ──────────────────────────────────────────────────────────────
exports.moderatePhoto = functions.storage
    .object()
    .onFinalize(async (object) => {
    const filePath = object.name ?? "";
    const contentType = object.contentType ?? "";
    const bucket = object.bucket;
    // Only process images under profiles/
    if (!filePath.startsWith("profiles/"))
        return null;
    if (!contentType.startsWith("image/"))
        return null;
    // Extract userId: profiles/{userId}/filename.jpg
    const userId = filePath.split("/")[1];
    if (!userId) {
        functions.logger.warn("moderatePhoto: could not parse userId from path", { filePath });
        return null;
    }
    functions.logger.info("moderatePhoto: checking", { filePath, userId });
    try {
        // Run SafeSearch detection
        const gcsUri = `gs://${bucket}/${filePath}`;
        const [result] = await visionClient.safeSearchDetection(gcsUri);
        const safe = result.safeSearchAnnotation;
        if (!safe) {
            functions.logger.warn("moderatePhoto: no SafeSearch annotation returned", { filePath });
            return null;
        }
        const adult = safe.adult;
        const violence = safe.violence;
        const racy = safe.racy;
        functions.logger.info("moderatePhoto: results", { adult, violence, racy, filePath });
        if (isFlagged(adult) || isFlagged(violence)) {
            functions.logger.warn("moderatePhoto: FLAGGED — deleting file", { filePath, adult, violence });
            // Delete the file
            await storage.bucket(bucket).file(filePath).delete();
            // Mark the user in Firestore
            await flagUserPhoto(userId, filePath);
            functions.logger.info("moderatePhoto: deleted and user flagged", { userId });
        }
        else if (isFlagged(racy)) {
            // Racy-only: keep but log for manual review queue
            functions.logger.info("moderatePhoto: racy-only — queued for review", { filePath });
            await db.collection("moderationQueue").add({
                userId,
                filePath,
                bucket,
                racy: true,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        return null;
    }
    catch (err) {
        functions.logger.error("moderatePhoto: error during Vision check", { filePath, err });
        return null;
    }
});
//# sourceMappingURL=moderatePhoto.js.map