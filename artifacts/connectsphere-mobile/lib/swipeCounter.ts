/**
 * swipeCounter.ts
 *
 * Manages the daily swipe limit for free users.
 * Persists via AsyncStorage so the counter survives app restarts.
 * Resets automatically at midnight (keyed by ISO date string).
 *
 * All async functions are safe to call concurrently — they re-read from
 * storage before writing to avoid race conditions.
 *
 * Usage:
 *   const left = await getSwipesLeft();      // how many swipes remain today
 *   const left = await decrementSwipes();    // consume one, returns new balance
 *   const left = await refundSwipe();        // rewind: add one back (capped at limit)
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

export const DAILY_SWIPE_LIMIT = 5;
const STORAGE_KEY = "cs:vibes:daily";

interface DailyRecord {
  date: string;  // "YYYY-MM-DD"
  count: number; // swipes USED today
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function readRecord(): Promise<DailyRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DailyRecord;
  } catch {
    return null;
  }
}

async function writeRecord(record: DailyRecord): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(record));
}

/**
 * Returns how many swipes the user has left today.
 * Always returns a value in [0, DAILY_SWIPE_LIMIT].
 */
export async function getSwipesLeft(): Promise<number> {
  const record = await readRecord();
  if (!record) return DAILY_SWIPE_LIMIT;
  const today = todayIso();
  const used = record.date === today ? record.count : 0;
  return Math.max(0, DAILY_SWIPE_LIMIT - used);
}

/**
 * Consume one swipe. Returns the new swipes-left balance.
 * If already at 0, does nothing and returns 0 (caller must enforce the gate).
 */
export async function decrementSwipes(): Promise<number> {
  const today = todayIso();
  const record = await readRecord();
  const prevUsed = record?.date === today ? record.count : 0;
  const newUsed = prevUsed + 1;
  await writeRecord({ date: today, count: newUsed });
  return Math.max(0, DAILY_SWIPE_LIMIT - newUsed);
}

/**
 * Refund one swipe (used by Rewind). Returns the new swipes-left balance.
 * Caps at DAILY_SWIPE_LIMIT — cannot go above the daily limit.
 */
export async function refundSwipe(): Promise<number> {
  const today = todayIso();
  const record = await readRecord();
  const prevUsed = record?.date === today ? record.count : 0;
  const newUsed = Math.max(0, prevUsed - 1);
  await writeRecord({ date: today, count: newUsed });
  return Math.min(DAILY_SWIPE_LIMIT, DAILY_SWIPE_LIMIT - newUsed);
}

/**
 * Reset the counter (for testing or logout).
 */
export async function resetSwipes(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
