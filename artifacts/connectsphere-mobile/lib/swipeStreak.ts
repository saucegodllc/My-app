/**
 * swipeStreak
 * ───────────
 * Tracks consecutive days the user swiped.
 * Stored in AsyncStorage as:
 *   { lastSwipeDate: "YYYY-MM-DD", streak: number }
 *
 * A day is counted if the user swipes at least once.
 * Streak resets to 1 if a calendar day is skipped.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "cs:streak:daily";

type StreakData = {
  lastSwipeDate: string; // YYYY-MM-DD
  streak: number;
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function getSwipeStreak(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return 0;
    const data = JSON.parse(raw) as StreakData;
    // If last swipe was not today or yesterday, streak is 0
    const today = todayStr();
    const yesterday = yesterdayStr();
    if (data.lastSwipeDate !== today && data.lastSwipeDate !== yesterday) {
      return 0;
    }
    return data.streak;
  } catch {
    return 0;
  }
}

/**
 * Call once per session after the user swipes.
 * Returns the new streak count.
 */
export async function recordSwipe(): Promise<number> {
  try {
    const today = todayStr();
    const yesterday = yesterdayStr();
    const raw = await AsyncStorage.getItem(KEY);

    if (!raw) {
      await AsyncStorage.setItem(KEY, JSON.stringify({ lastSwipeDate: today, streak: 1 }));
      return 1;
    }

    const data = JSON.parse(raw) as StreakData;

    if (data.lastSwipeDate === today) {
      // Already counted today
      return data.streak;
    }

    const newStreak = data.lastSwipeDate === yesterday ? data.streak + 1 : 1;
    await AsyncStorage.setItem(KEY, JSON.stringify({ lastSwipeDate: today, streak: newStreak }));
    return newStreak;
  } catch {
    return 0;
  }
}
