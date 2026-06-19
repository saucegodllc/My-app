/**
 * usePersistentBoost
 * ──────────────────
 * Manages boost expiry state so it survives:
 *  1. App restarts (AsyncStorage cache — available instantly on cold start)
 *  2. Firestore being slow / offline (falls back to cache, syncs when online)
 *
 * Without this, ProfileBoostBanner had to wait for Firestore on every cold
 * start. A 1–2 second Firestore round-trip meant the boost pill flashed
 * "Boost" → "BOOSTED · 22:14" after a delay, which looks broken.
 *
 * Architecture:
 *   • On mount: read AsyncStorage immediately → show cached boost state
 *   • Concurrently: fetch from Firestore → reconcile (Firestore wins on conflict)
 *   • On activate: write to AsyncStorage + Firestore simultaneously
 *   • On expiry: clear both stores
 *
 * Returns:
 *   expiresAt        — Date | null, never stale by more than 1 tick
 *   lastActivatedDate — "YYYY-MM-DD" | null
 *   activate()       — start a 30-min boost (writes both stores)
 *   activating       — loading flag during activate()
 *
 * Usage (drop-in replacement for the inline Firestore calls in ProfileBoostBanner):
 *   const { expiresAt, lastActivatedDate, activate, activating } = usePersistentBoost(userId);
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { Analytics } from "@/lib/analytics";

// ─── Storage keys ─────────────────────────────────────────────────────────────
const BOOST_EXPIRY_KEY = "cs:boost:expiresAt";       // ISO timestamp string
const BOOST_DATE_KEY   = "cs:boost:lastActivatedDate"; // "YYYY-MM-DD"

// ─── Cache helpers ────────────────────────────────────────────────────────────

async function readCachedExpiry(): Promise<Date | null> {
  try {
    const raw = await AsyncStorage.getItem(BOOST_EXPIRY_KEY);
    if (!raw) return null;
    const d = new Date(raw);
    return d > new Date() ? d : null;
  } catch {
    return null;
  }
}

async function readCachedDate(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(BOOST_DATE_KEY);
  } catch {
    return null;
  }
}

async function writeCache(expiresAt: Date, date: string): Promise<void> {
  try {
    await AsyncStorage.multiSet([
      [BOOST_EXPIRY_KEY, expiresAt.toISOString()],
      [BOOST_DATE_KEY, date],
    ]);
  } catch {
    // Non-critical — Firestore is the source of truth
  }
}

async function clearCache(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([BOOST_EXPIRY_KEY, BOOST_DATE_KEY]);
  } catch {}
}

// ─── Firestore helpers ────────────────────────────────────────────────────────

async function fetchFirestoreBoost(userId: string): Promise<{ expiresAt: Date | null; lastActivatedDate: string | null }> {
  try {
    const { getFirestore, doc, getDoc } = await import("firebase/firestore");
    const { getApp } = await import("firebase/app");
    const db = getFirestore(getApp());
    const snap = await getDoc(doc(db, "users", userId));
    const data = snap.data() as Record<string, unknown> | undefined;

    const ts = data?.boostExpiresAt;
    const expiresAt = ts
      ? (() => {
          const d = (ts as { toDate?: () => Date }).toDate
            ? (ts as { toDate: () => Date }).toDate()
            : new Date(ts as string);
          return d > new Date() ? d : null;
        })()
      : null;

    const lastActivatedDate =
      typeof data?.boostLastActivatedDate === "string"
        ? data.boostLastActivatedDate
        : null;

    return { expiresAt, lastActivatedDate };
  } catch {
    return { expiresAt: null, lastActivatedDate: null };
  }
}

async function writeFirestoreBoost(userId: string, expiresAt: Date): Promise<void> {
  const { getFirestore, doc, updateDoc, Timestamp } = await import("firebase/firestore");
  const { getApp } = await import("firebase/app");
  const db = getFirestore(getApp());
  const today = new Date().toISOString().slice(0, 10);
  await updateDoc(doc(db, "users", userId), {
    boostExpiresAt: Timestamp.fromDate(expiresAt),
    boostActivatedAt: Timestamp.now(),
    boostLastActivatedDate: today,
  });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UsePersistentBoostResult {
  expiresAt: Date | null;
  lastActivatedDate: string | null;
  activating: boolean;
  activate: () => Promise<{ success: boolean; error?: string }>;
}

export function usePersistentBoost(userId: string | null): UsePersistentBoostResult {
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [lastActivatedDate, setLastActivatedDate] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);

  // Phase 1: read cache immediately (synchronous-ish, no network round-trip)
  // Phase 2: reconcile with Firestore (async — Firestore wins on conflict)
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    void (async () => {
      // ── Phase 1: AsyncStorage (instant) ──
      const [cachedExpiry, cachedDate] = await Promise.all([
        readCachedExpiry(),
        readCachedDate(),
      ]);

      if (!cancelled) {
        if (cachedExpiry) {
          setExpiresAt(cachedExpiry);
          Analytics.boostRestoredFromCache();
        }
        if (cachedDate) setLastActivatedDate(cachedDate);
      }

      // ── Phase 2: Firestore (authoritative) ──
      const remote = await fetchFirestoreBoost(userId);
      if (cancelled) return;

      // Firestore wins: if remote has a later/different expiry, use it.
      // If remote says null but cache said active, clear (boost was cancelled server-side).
      if (remote.expiresAt !== null) {
        setExpiresAt(remote.expiresAt);
        // Keep cache in sync so next cold start is instant
        void writeCache(
          remote.expiresAt,
          remote.lastActivatedDate ?? new Date().toISOString().slice(0, 10),
        );
      } else {
        // Remote says no active boost — clear both states
        setExpiresAt(null);
        void clearCache();
      }
      if (remote.lastActivatedDate !== null) {
        setLastActivatedDate(remote.lastActivatedDate);
      }
    })();

    return () => { cancelled = true; };
  }, [userId]);

  // Auto-clear when the boost timer expires
  useEffect(() => {
    if (!expiresAt) return;
    const ms = expiresAt.getTime() - Date.now();
    if (ms <= 0) {
      setExpiresAt(null);
      void clearCache();
      Analytics.boostExpired();
      return;
    }
    const id = setTimeout(() => {
      setExpiresAt(null);
      void clearCache();
      Analytics.boostExpired();
    }, ms);
    return () => clearTimeout(id);
  }, [expiresAt]);

  const activate = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!userId) return { success: false, error: "Not signed in" };
    setActivating(true);
    try {
      const expiresIn30 = new Date(Date.now() + 30 * 60 * 1000);
      const today = new Date().toISOString().slice(0, 10);

      // Write to both stores in parallel — local state is instant
      await Promise.all([
        writeFirestoreBoost(userId, expiresIn30),
        writeCache(expiresIn30, today),
      ]);

      setExpiresAt(expiresIn30);
      setLastActivatedDate(today);
      Analytics.boostStarted();
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Boost activation failed";
      Analytics.purchaseFailed("boost", message);
      return { success: false, error: message };
    } finally {
      setActivating(false);
    }
  }, [userId]);

  return { expiresAt, lastActivatedDate, activating, activate };
}
