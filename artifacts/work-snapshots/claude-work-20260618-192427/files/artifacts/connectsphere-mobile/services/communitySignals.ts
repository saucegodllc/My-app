/**
 * communitySignals — real-time "new post" signals via the Firestore signal bus.
 *
 * Pattern mirrors chatSignals.ts exactly:
 *   ✓ Firestore doc: communitySignals/{communityId}
 *     Shape: { at: Timestamp, by: authorId, postId: string }
 *   ✓ API server (Postgres) holds all post content — never duplicated here.
 *   ✓ Listeners re-fetch from the API on signal; idempotent by construction.
 *   ✓ No Firebase configured → no-ops; callers fall back to pull-to-refresh.
 *
 * Security: same posture as chatSignals — open-but-shape-validated rules.
 * Signals are content-free so the worst abuse is nuisance refetches.
 * Hardening path: mint Firebase custom tokens server-side from Clerk JWTs,
 * then require isSignedIn() in Firestore rules.
 */
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebaseRuntime } from "@/services/connections/firebaseClient";

const SIGNALS_COLLECTION = "communitySignals";

/**
 * Bump the community's signal doc after a successful post creation.
 * Fire-and-forget — a failed signal must never fail the post itself.
 */
export function publishCommunitySignal(
  communityId: string,
  authorId: string,
  postId: string,
): void {
  const runtime = getFirebaseRuntime();
  if (!runtime || !communityId) return;
  setDoc(
    doc(runtime.db, SIGNALS_COLLECTION, communityId),
    { at: serverTimestamp(), by: authorId, postId },
    { merge: true },
  ).catch(() => {
    // Non-fatal — see fallback pull-to-refresh in the feed screen.
  });
}

/**
 * Subscribe to new-post signals for a community.
 * Calls onSignal({ by, postId }) on server-confirmed changes.
 * Returns unsubscribe function, or null when Firebase isn't configured.
 */
export function subscribeToCommunitySignals(
  communityId: string,
  onSignal: (data: { by: string | null; postId: string | null }) => void,
): (() => void) | null {
  const runtime = getFirebaseRuntime();
  if (!runtime || !communityId) return null;

  try {
    return onSnapshot(
      doc(runtime.db, SIGNALS_COLLECTION, communityId),
      (snapshot) => {
        // Skip local optimistic echoes — we only care about server-confirmed writes.
        if (snapshot.metadata.hasPendingWrites) return;
        const data = snapshot.data();
        onSignal({
          by: (data?.by as string | undefined) ?? null,
          postId: (data?.postId as string | undefined) ?? null,
        });
      },
      () => {
        // Listener error (rules, network) — swallow; pull-to-refresh covers it.
      },
    );
  } catch {
    return null;
  }
}
