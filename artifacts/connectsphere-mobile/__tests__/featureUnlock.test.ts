/**
 * Unit tests — Progressive feature unlock system
 *
 * Run with: pnpm test --testPathPattern=featureUnlock
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  MILESTONES,
  FEATURE_GATES,
  getUnlockedMilestone,
  advanceMilestone,
  isFeatureUnlocked,
  recordFirstSwipe,
  recordMatch,
  recordFirstMessage,
  recordThreeConversations,
  recordVibeQuizDone,
  MILESTONE_UNLOCKS,
} from "../lib/featureUnlock";

// AsyncStorage is auto-mocked by jest setup (react-native mock)
beforeEach(async () => {
  await AsyncStorage.clear();
});

// ─── getUnlockedMilestone ─────────────────────────────────────────────────────

describe("getUnlockedMilestone", () => {
  it("returns SIGNED_UP (0) with no data in storage", async () => {
    expect(await getUnlockedMilestone()).toBe(MILESTONES.SIGNED_UP);
  });

  it("returns the stored value after write", async () => {
    await AsyncStorage.setItem("feature_unlocks_v2", "3");
    expect(await getUnlockedMilestone()).toBe(3);
  });

  it("returns SIGNED_UP for corrupt storage value", async () => {
    await AsyncStorage.setItem("feature_unlocks_v2", "not_a_number");
    expect(await getUnlockedMilestone()).toBe(MILESTONES.SIGNED_UP);
  });
});

// ─── advanceMilestone ─────────────────────────────────────────────────────────

describe("advanceMilestone", () => {
  it("advances and returns true when new milestone is higher", async () => {
    const result = await advanceMilestone(MILESTONES.FIRST_SWIPE);
    expect(result).toBe(true);
    expect(await getUnlockedMilestone()).toBe(MILESTONES.FIRST_SWIPE);
  });

  it("returns false when trying to advance to same or lower milestone", async () => {
    await advanceMilestone(MILESTONES.FIRST_MATCH);
    const result = await advanceMilestone(MILESTONES.FIRST_SWIPE);
    expect(result).toBe(false);
    expect(await getUnlockedMilestone()).toBe(MILESTONES.FIRST_MATCH);
  });

  it("can advance through all milestones in order", async () => {
    const milestones = Object.values(MILESTONES).sort((a, b) => a - b);
    for (const m of milestones) {
      await advanceMilestone(m);
    }
    expect(await getUnlockedMilestone()).toBe(MILESTONES.FIVE_MATCHES);
  });
});

// ─── isFeatureUnlocked ────────────────────────────────────────────────────────

describe("isFeatureUnlocked", () => {
  it("storiesStrip is locked before first swipe", async () => {
    expect(await isFeatureUnlocked("storiesStrip")).toBe(false);
  });

  it("storiesStrip is unlocked after first swipe", async () => {
    await advanceMilestone(MILESTONES.FIRST_SWIPE);
    expect(await isFeatureUnlocked("storiesStrip")).toBe(true);
  });

  it("eventsTab is locked until 3 conversations", async () => {
    await advanceMilestone(MILESTONES.FIRST_MESSAGE);
    expect(await isFeatureUnlocked("eventsTab")).toBe(false);
  });

  it("eventsTab unlocked after 3 conversations milestone", async () => {
    await advanceMilestone(MILESTONES.THREE_CONVERSATIONS);
    expect(await isFeatureUnlocked("eventsTab")).toBe(true);
  });

  it("vibeBreakdown only unlocked after quiz done", async () => {
    await advanceMilestone(MILESTONES.THREE_CONVERSATIONS);
    expect(await isFeatureUnlocked("vibeBreakdown")).toBe(false);
    await advanceMilestone(MILESTONES.VIBE_QUIZ_DONE);
    expect(await isFeatureUnlocked("vibeBreakdown")).toBe(true);
  });

  it("profileBoost and doubleDate only after 5 matches", async () => {
    await advanceMilestone(MILESTONES.VIBE_QUIZ_DONE);
    expect(await isFeatureUnlocked("profileBoost")).toBe(false);
    expect(await isFeatureUnlocked("doubleDate")).toBe(false);
    await advanceMilestone(MILESTONES.FIVE_MATCHES);
    expect(await isFeatureUnlocked("profileBoost")).toBe(true);
    expect(await isFeatureUnlocked("doubleDate")).toBe(true);
  });
});

// ─── Helper functions ─────────────────────────────────────────────────────────

describe("recordFirstSwipe", () => {
  it("advances to FIRST_SWIPE milestone", async () => {
    await recordFirstSwipe();
    expect(await getUnlockedMilestone()).toBe(MILESTONES.FIRST_SWIPE);
  });
});

describe("recordMatch", () => {
  it("advances to FIRST_MATCH on first call", async () => {
    const unlocked = await recordMatch(1);
    expect(unlocked).toContain(MILESTONES.FIRST_MATCH);
    expect(await getUnlockedMilestone()).toBe(MILESTONES.FIRST_MATCH);
  });

  it("advances to FIVE_MATCHES when totalMatches >= 5", async () => {
    const unlocked = await recordMatch(5);
    expect(unlocked).toContain(MILESTONES.FIVE_MATCHES);
  });

  it("does not advance to FIVE_MATCHES for totalMatches < 5", async () => {
    const unlocked = await recordMatch(3);
    expect(unlocked).not.toContain(MILESTONES.FIVE_MATCHES);
  });
});

describe("recordFirstMessage", () => {
  it("advances to FIRST_MESSAGE milestone", async () => {
    await recordFirstMessage();
    expect(await getUnlockedMilestone()).toBe(MILESTONES.FIRST_MESSAGE);
  });
});

// ─── MILESTONE_UNLOCKS completeness ──────────────────────────────────────────

describe("MILESTONE_UNLOCKS", () => {
  it("has an entry for every milestone value", () => {
    Object.values(MILESTONES).forEach((m) => {
      expect(MILESTONE_UNLOCKS).toHaveProperty(String(m));
    });
  });
});

// ─── FEATURE_GATES completeness ───────────────────────────────────────────────

describe("FEATURE_GATES", () => {
  it("all gate values are valid milestones", () => {
    const validMilestones = new Set(Object.values(MILESTONES));
    Object.values(FEATURE_GATES).forEach((gate) => {
      expect(validMilestones.has(gate as any)).toBe(true);
    });
  });
});
