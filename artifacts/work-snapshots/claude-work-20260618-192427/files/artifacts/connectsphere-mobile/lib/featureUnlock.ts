/**
 * featureUnlock.ts
 * ─────────────────
 * Progressive feature unlock system.
 *
 * Users earn features by completing milestones — turning the app into
 * a guided flow rather than a dashboard that overwhelms on first open.
 *
 * Milestones (in order):
 *   0  — signed up                        → unlock: swipe deck
 *   1  — first swipe                      → unlock: stories strip
 *   2  — first match                      → unlock: chat, Connect tab
 *   3  — sent first message               → unlock: Moments CTA
 *   4  — 3 conversations started          → unlock: Events tab, Live Drop
 *   5  — completed vibe quiz              → unlock: Vibe Breakdown on cards
 *   6  — 5 matches                        → unlock: Profile Boost, Double Date
 *
 * All milestones are persisted in AsyncStorage so they survive restarts.
 * Milestone data is also synced to the API on achievement for analytics.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export const MILESTONES = {
  SIGNED_UP: 0,
  FIRST_SWIPE: 1,
  FIRST_MATCH: 2,
  FIRST_MESSAGE: 3,
  THREE_CONVERSATIONS: 4,
  VIBE_QUIZ_DONE: 5,
  FIVE_MATCHES: 6,
} as const;

export type Milestone = (typeof MILESTONES)[keyof typeof MILESTONES];

const STORAGE_KEY = "feature_unlocks_v2";

// ─── Features gated by milestone ─────────────────────────────────────────────

export const FEATURE_GATES: Record<string, Milestone> = {
  storiesStrip:    MILESTONES.FIRST_SWIPE,
  connectTab:      MILESTONES.FIRST_MATCH,
  chatScreen:      MILESTONES.FIRST_MATCH,
  momentsCta:      MILESTONES.FIRST_MESSAGE,
  eventsTab:       MILESTONES.THREE_CONVERSATIONS,
  liveDrop:        MILESTONES.THREE_CONVERSATIONS,
  vibeBreakdown:   MILESTONES.VIBE_QUIZ_DONE,
  profileBoost:    MILESTONES.FIVE_MATCHES,
  doubleDate:      MILESTONES.FIVE_MATCHES,
} as const;

export type FeatureKey = keyof typeof FEATURE_GATES;

// ─── Storage ─────────────────────────────────────────────────────────────────

export async function getUnlockedMilestone(): Promise<Milestone> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === null) return MILESTONES.SIGNED_UP;
    const val = Number(raw);
    return (Number.isFinite(val) ? val : MILESTONES.SIGNED_UP) as Milestone;
  } catch {
    return MILESTONES.SIGNED_UP;
  }
}

export async function advanceMilestone(milestone: Milestone): Promise<boolean> {
  try {
    const current = await getUnlockedMilestone();
    if (milestone > current) {
      await AsyncStorage.setItem(STORAGE_KEY, String(milestone));
      return true; // newly unlocked
    }
    return false;
  } catch {
    return false;
  }
}

export async function isFeatureUnlocked(feature: FeatureKey): Promise<boolean> {
  const required = FEATURE_GATES[feature];
  const current = await getUnlockedMilestone();
  return current >= required;
}

// ─── Convenience — call these from relevant places in the app ─────────────────

/** Call when user performs their first swipe */
export async function recordFirstSwipe() {
  return advanceMilestone(MILESTONES.FIRST_SWIPE);
}

/** Call when a dating or friend match is created */
export async function recordMatch(totalMatches: number) {
  const newlyUnlocked: Milestone[] = [];
  if (await advanceMilestone(MILESTONES.FIRST_MATCH)) {
    newlyUnlocked.push(MILESTONES.FIRST_MATCH);
  }
  if (totalMatches >= 5 && await advanceMilestone(MILESTONES.FIVE_MATCHES)) {
    newlyUnlocked.push(MILESTONES.FIVE_MATCHES);
  }
  return newlyUnlocked;
}

/** Call when user sends their first chat message */
export async function recordFirstMessage() {
  return advanceMilestone(MILESTONES.FIRST_MESSAGE);
}

/** Call when user has started 3 different conversations */
export async function recordThreeConversations() {
  return advanceMilestone(MILESTONES.THREE_CONVERSATIONS);
}

/** Call when vibe quiz is completed */
export async function recordVibeQuizDone() {
  return advanceMilestone(MILESTONES.VIBE_QUIZ_DONE);
}

// ─── Milestone label for onboarding tooltips ──────────────────────────────────

export const MILESTONE_UNLOCKS: Record<Milestone, string | null> = {
  [MILESTONES.SIGNED_UP]: null,
  [MILESTONES.FIRST_SWIPE]: "Stories unlocked! See who's active today 📸",
  [MILESTONES.FIRST_MATCH]: "Connect tab unlocked! Check your matches 🎉",
  [MILESTONES.FIRST_MESSAGE]: "Moments unlocked! Keep the conversation moving.",
  [MILESTONES.THREE_CONVERSATIONS]: "Events & Live Drop unlocked! See what's near you 📍",
  [MILESTONES.VIBE_QUIZ_DONE]: "Vibe Breakdown unlocked! See exactly why you match 🧠",
  [MILESTONES.FIVE_MATCHES]: "Profile Boost & Double Date unlocked! 🔥",
};
