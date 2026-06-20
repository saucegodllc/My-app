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

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import vision from "@google-cloud/vision";

// ── init ─────────────────────────────────────────────────────────────────────

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage();
const visionClient = new vision.ImageAnnotatorClient();

// ── types ─────────────────────────────────────────────────────────────────────

type SafeSearchLikelihood =
  | "UNKNOWN"
  | "VERY_UNLIKELY"
  | "UNLIKELY"
  | "POSSIBLE"
  | "LIKELY"
  | "VERY_LIKELY";

const FLAGRANT: SafeSearchLikelihood[] = ["LIKELY", "VERY_LIKELY"];

function isFlagged(label: SafeSearchLikelihood | null | undefined): boolean {
  return FLAGRANT.includes((label ?? "UNKNOWN") as SafeSearchLikelihood);
}

// ── helper: update user doc ───────────────────────────────────────────────────

async function flagUserPhoto(userId: string, filePath: string): Promise<void> {
  await db.collection("users").doc(userId).set(
    {
      photoModerationFlag: {
        flaggedAt: admin.firestore.FieldValue.serverTimestamp(),
        path: filePath,
        reason: "SafeSearch: adult or violent content detected",
      },
    },
    { merge: true },
  );
}

// ── main handler ──────────────────────────────────────────────────────────────

export const moderatePhoto = functions.storage
  .object()
  .onFinalize(async (object) => {
    const filePath = object.name ?? "";
    const contentType = object.contentType ?? "";
    const bucket = object.bucket;

    // Only process images under profiles/
    if (!filePath.startsWith("profiles/")) return null;
    if (!contentType.startsWith("image/")) return null;

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

      const adult = safe.adult as SafeSearchLikelihood;
      const violence = safe.violence as SafeSearchLikelihood;
      const racy = safe.racy as SafeSearchLikelihood;

      functions.logger.info("moderatePhoto: results", { adult, violence, racy, filePath });

      if (isFlagged(adult) || isFlagged(violence)) {
        functions.logger.warn("moderatePhoto: FLAGGED — deleting file", { filePath, adult, violence });

        // Delete the file
        await storage.bucket(bucket).file(filePath).delete();

        // Mark the user in Firestore
        await flagUserPhoto(userId, filePath);

        functions.logger.info("moderatePhoto: deleted and user flagged", { userId });
      } else if (isFlagged(racy)) {
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
    } catch (err) {
      functions.logger.error("moderatePhoto: error during Vision check", { filePath, err });
      return null;
    }
  });
