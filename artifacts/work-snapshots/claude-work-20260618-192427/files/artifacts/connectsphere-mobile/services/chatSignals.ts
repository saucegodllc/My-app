/**
 * chatSignals — real-time chat delivery via a Firestore "signal bus".
 *
 * Architecture (Pass 5, Tier 0):
 *   - The API server (Postgres / JSON-db) stays the single source of truth
 *     for message CONTENT. Nothing here stores or transmits message text.
 *   - Firestore carries one tiny doc per chat: chatSignals/{chatId} with
 *     { at: serverTimestamp, by: senderId }. Senders bump it after a
 *     successful send; every open chat screen subscribes and silently
 *     refreshes its transport when the doc changes.
 *   - Result: device-to-device delivery in <1s with zero migration of
 *     message storage and zero new server infrastructure. Worst case
 *     (missed/spammed signal) degrades to exactly today's behavior — a
 *     refetch that finds nothing new. Idempotent by construction.
 *
 * Security note: Firebase Auth is not wired yet (Clerk is the only identity
 * provider), so the chatSignals rules are open-but-shape-validated. Signals
 * are content-free, so the worst abuse is nuisance refetches. Hardening
 * path: mint Firebase custom tokens from Clerk server-side, then require
 * isSignedIn() in rules. Tracked in COMPETITIVE_PLAN.md Phase 1.
 *
 * No Firebase configured (EXPO_PUBLIC_FIREBASE_* missing) → everything here
 * no-ops and callers fall back to polling.
 */
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";

import { getFirebaseRuntime } from "@/services/connections/firebaseClient";

const COLLECTION = "chatSignals";

/**
 * Bump the chat's signal doc after a successful send. Fire-and-forget:
 * a failed signal must never fail the send itself — the message is already
 * safely on the server, and the peer will pick it up via fallback refresh.
 */
export function publishChatSignal(chatId: string, senderId: string): void {
  const runtime = getFirebaseRuntime();
  if (!runtime || !chatId) return;
  setDoc(
    doc(runtime.db, COLLECTION, chatId),
    { at: serverTimestamp(), by: senderId },
    { merge: true },
  ).catch(() => {
    // Non-fatal — see fallback polling in the chat screen.
  });
}

/**
 * Subscribe to a chat's signal doc. Calls onSignal(by) whenever the doc
 * changes on the server (local optimistic echoes are skipped — the sender
 * already rendered their own message).
 *
 * Returns an unsubscribe function, or null when Firebase isn't configured —
 * callers should fall back to interval polling in that case.
 */
export function subscribeToChatSignals(
  chatId: string,
  onSignal: (by: string | null) => void,
): (() => void) | null {
  const runtime = getFirebaseRuntime();
  if (!runtime || !chatId) return null;

  try {
    return onSnapshot(
      doc(runtime.db, COLLECTION, chatId),
      (snapshot) => {
        // Skip the local echo of our own pending write; we only care about
        // server-confirmed changes (which include the peer's signals).
        if (snapshot.metadata.hasPendingWrites) return;
        const by = (snapshot.data()?.by as string | undefined) ?? null;
        onSignal(by);
      },
      () => {
        // Listener error (rules, network) — swallow; fallback polling covers it.
      },
    );
  } catch {
    return null;
  }
}
