/**
 * Critical user flow tests — ConnectSphere
 *
 * Tests the three flows that must NEVER break at launch:
 *   1. Onboarding → vibe quiz → discover deck
 *   2. Swipe → match → chat → icebreaker
 *   3. Feature unlock progression
 *
 * Run with: pnpm test --testPathPattern=criticalFlows
 */
import {
  computeCompatibility,
} from "../components/VibeCheckQuiz";
import {
  MILESTONES,
  getUnlockedMilestone,
  recordFirstSwipe,
  recordMatch,
  recordFirstMessage,
  recordThreeConversations,
  recordVibeQuizDone,
  isFeatureUnlocked,
} from "../lib/featureUnlock";
import AsyncStorage from "@react-native-async-storage/async-storage";

beforeEach(async () => {
  await AsyncStorage.clear();
});

// ─── Flow 1: New user → vibe quiz → deck unlocked ────────────────────────────

describe("Flow 1: New user onboarding", () => {
  it("deck is available from the start (milestone 0)", async () => {
    const m = await getUnlockedMilestone();
    expect(m).toBe(MILESTONES.SIGNED_UP);
    // Deck doesn't need a milestone gate
    expect(m).toBeGreaterThanOrEqual(MILESTONES.SIGNED_UP);
  });

  it("stories strip locked until first swipe", async () => {
    expect(await isFeatureUnlocked("storiesStrip")).toBe(false);
    await recordFirstSwipe();
    expect(await isFeatureUnlocked("storiesStrip")).toBe(true);
  });

  it("vibe breakdown locked until quiz done, even with matches", async () => {
    await recordMatch(3);
    expect(await isFeatureUnlocked("vibeBreakdown")).toBe(false);
    await recordVibeQuizDone();
    expect(await isFeatureUnlocked("vibeBreakdown")).toBe(true);
  });
});

// ─── Flow 2: Swipe → match → first message ────────────────────────────────────

describe("Flow 2: Match and message flow", () => {
  it("Connect tab unlocks after first match", async () => {
    expect(await isFeatureUnlocked("connectTab")).toBe(false);
    await recordMatch(1);
    expect(await isFeatureUnlocked("connectTab")).toBe(true);
    expect(await isFeatureUnlocked("chatScreen")).toBe(true);
  });

  it("Moments CTA unlocks after first message", async () => {
    await recordMatch(1);
    expect(await isFeatureUnlocked("momentsCta")).toBe(false);
    await recordFirstMessage();
    expect(await isFeatureUnlocked("momentsCta")).toBe(true);
  });

  it("vibe score is always 0–100", () => {
    const pairs: Array<[any, any]> = [
      [
        { loveLanguage: "words", energyType: "homebody", conflictStyle: "talk-it-out", datePace: "slow-burn", adventureLevel: 1 },
        { loveLanguage: "gifts", energyType: "adventurer", conflictStyle: "quick-fix", datePace: "fast-sparks", adventureLevel: 5 },
      ],
      [
        { loveLanguage: "time",  energyType: "balanced", conflictStyle: "need-space", datePace: "medium", adventureLevel: 3 },
        { loveLanguage: "time",  energyType: "balanced", conflictStyle: "need-space", datePace: "medium", adventureLevel: 3 },
      ],
    ];
    for (const [a, b] of pairs) {
      const score = computeCompatibility(a, b);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});

// ─── Flow 3: Full milestone progression ──────────────────────────────────────

describe("Flow 3: Full progression unlocks everything", () => {
  it("completing all milestones unlocks all features", async () => {
    await recordFirstSwipe();
    await recordMatch(1);
    await recordFirstMessage();
    await recordThreeConversations();
    await recordVibeQuizDone();
    await recordMatch(5);

    const features = [
      "storiesStrip",
      "connectTab",
      "chatScreen",
      "momentsCta",
      "eventsTab",
      "liveDrop",
      "vibeBreakdown",
      "profileBoost",
      "doubleDate",
    ] as const;

    for (const f of features) {
      expect(await isFeatureUnlocked(f)).toBe(true);
    }
  });

  it("milestones persist across simulated restarts", async () => {
    await recordMatch(1);
    // Simulate restart by reading milestone fresh
    const m = await getUnlockedMilestone();
    expect(m).toBeGreaterThanOrEqual(MILESTONES.FIRST_MATCH);
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe("Edge cases", () => {
  it("recordMatch(5) skips intermediate milestones cleanly", async () => {
    // User gets 5 matches on first session somehow
    await recordMatch(5);
    const m = await getUnlockedMilestone();
    // Should have FIVE_MATCHES but NOT necessarily FIRST_MESSAGE or VIBE_QUIZ
    expect(m).toBe(MILESTONES.FIVE_MATCHES);
    expect(await isFeatureUnlocked("connectTab")).toBe(true);
    expect(await isFeatureUnlocked("vibeBreakdown")).toBe(false); // quiz not done
  });

  it("calling milestones out of order does not regress", async () => {
    await recordVibeQuizDone(); // jump straight to milestone 5
    const m = await getUnlockedMilestone();
    expect(m).toBe(MILESTONES.VIBE_QUIZ_DONE);
    // Going back should not change anything
    await recordFirstSwipe();
    expect(await getUnlockedMilestone()).toBe(MILESTONES.VIBE_QUIZ_DONE);
  });
});
