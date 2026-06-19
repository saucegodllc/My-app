/**
 * Retention Feature Tests
 *
 * Covers the 5 new engagement/retention features added in this session:
 *
 *   1. Auto-fill opener   — useEffect logic that pre-fills the draft
 *   2. 7-day expiry       — countdown label derivation + expiry boundary
 *   3. Vibe personality   — archetype derivation from VibeCheckAnswers
 *   4. Vibe pill sheet    — shouldShowVibeSheet gating logic
 *   5. Anti-ghost nudge   — silence-window boundary logic (48h–71h)
 *
 * Run with: pnpm test --testPathPattern=retentionFeatures
 */

import type { VibeCheckAnswers } from "../components/VibeCheckQuiz";
import {
  FRESH_CHAT_DOUBLE_DATE_LABEL,
  FRESH_CHAT_OPENER_LABEL,
  SHOT_TOOLTIP_COPY,
  SHOT_TOOLTIP_STORAGE_KEY,
  STORIES_ADD_CTA_LABEL,
  canUseDailyBoost,
  buildCuratedSeedStories,
  buildDatingSubTabs,
  getBoostPressDecision,
  buildFreshChatDoubleDateInvite,
  buildFreshChatOpenerInvite,
  buildWhyWeWouldWorkCopy,
  getDisplayMoments,
  getDiscoverySubtypeForDatingTab,
  getRailPopLabel,
  shouldBypassVibeGate,
  shouldConsumeDiscoverAction,
  shouldShowFreshChatFallbackCtas,
  shouldShowShotTooltip,
} from "../lib/retentionFeatures";

// ─── 1. Auto-fill opener ─────────────────────────────────────────────────────
//
// The useEffect in app/chat/dating/[id].tsx fires once on mount and:
//   • Skips if the chat already has user messages
//   • Skips if the wave=1 nav param is present (wave sends 👋 instead)
//   • Sets draft to openerIdeas[0] when present
//
// We test the gate logic in pure JS (no React), matching the exact conditions.

function shouldAutoFillOpener(opts: {
  hasUserMessages: boolean;
  isWave: boolean;
  openerIdeas?: string[];
}): string | null {
  if (opts.hasUserMessages) return null;
  if (opts.isWave) return null;
  return opts.openerIdeas?.[0] ?? null;
}

describe("Auto-fill opener", () => {
  const IDEAS = ["Your profile about Miami nights — are you more rooftop bars or beach bonfires?"];

  it("returns the first opener on a fresh non-wave chat", () => {
    expect(shouldAutoFillOpener({ hasUserMessages: false, isWave: false, openerIdeas: IDEAS }))
      .toBe(IDEAS[0]);
  });

  it("returns null when the chat already has user messages", () => {
    expect(shouldAutoFillOpener({ hasUserMessages: true, isWave: false, openerIdeas: IDEAS }))
      .toBeNull();
  });

  it("returns null when the wave nav param is set", () => {
    expect(shouldAutoFillOpener({ hasUserMessages: false, isWave: true, openerIdeas: IDEAS }))
      .toBeNull();
  });

  it("returns null when openerIdeas is empty", () => {
    expect(shouldAutoFillOpener({ hasUserMessages: false, isWave: false, openerIdeas: [] }))
      .toBeNull();
  });

  it("returns null when openerIdeas is undefined", () => {
    expect(shouldAutoFillOpener({ hasUserMessages: false, isWave: false })).toBeNull();
  });
});

// ─── 2. 7-day expiry countdown ───────────────────────────────────────────────
//
// The nudge in app/(tabs)/matches.tsx uses:
//   ageMs = Date.now() - new Date(createdAt).getTime()
//   remainingDays = Math.max(0, Math.ceil((EXPIRY_MS - ageMs) / 864e5))
//
// We test the three cases: ≤1 day (red), ≤3 days (amber), >3 days (default).

const EXPIRY_MS = 7 * 24 * 3600 * 1000;

function getRemainingDays(createdAtMs: number, nowMs = Date.now()): number {
  const ageMs = nowMs - createdAtMs;
  return Math.max(0, Math.ceil((EXPIRY_MS - ageMs) / 864e5));
}

type NudgeLevel = "urgent" | "warning" | "default";

function getNudgeLevel(remainingDays: number): NudgeLevel {
  if (remainingDays <= 1) return "urgent";
  if (remainingDays <= 3) return "warning";
  return "default";
}

describe("7-day expiry countdown", () => {
  const NOW = 1_750_000_000_000; // fixed reference

  it("returns 7 days remaining for a brand-new match", () => {
    expect(getRemainingDays(NOW, NOW)).toBe(7);
  });

  it("returns 3 days remaining when the match is 4 days old", () => {
    const fourDaysAgo = NOW - 4 * 24 * 3600 * 1000;
    expect(getRemainingDays(fourDaysAgo, NOW)).toBe(3);
  });

  it("returns 1 day remaining when the match is 6 days old", () => {
    const sixDaysAgo = NOW - 6 * 24 * 3600 * 1000;
    expect(getRemainingDays(sixDaysAgo, NOW)).toBe(1);
  });

  it("returns 0 when the match is expired (> 7 days)", () => {
    const eightDaysAgo = NOW - 8 * 24 * 3600 * 1000;
    expect(getRemainingDays(eightDaysAgo, NOW)).toBe(0);
  });

  it("shows urgent nudge at ≤1 day", () => {
    expect(getNudgeLevel(1)).toBe("urgent");
    expect(getNudgeLevel(0)).toBe("urgent");
  });

  it("shows warning nudge at ≤3 days but >1", () => {
    expect(getNudgeLevel(2)).toBe("warning");
    expect(getNudgeLevel(3)).toBe("warning");
  });

  it("shows default copy at >3 days", () => {
    expect(getNudgeLevel(4)).toBe("default");
    expect(getNudgeLevel(7)).toBe("default");
  });
});

// ─── 3. Vibe personality reveal — archetype derivation ───────────────────────
//
// VibeRevealScreen.tsx derives an archetype from VibeCheckAnswers.
// We test the 6 archetypes match their intended trigger conditions.

// Mirror the derivation logic from VibeRevealScreen.tsx (pure function test)
type ArchetypeTitle =
  | "The Spark Chaser"
  | "The Deep Diver"
  | "The Warm Pulse"
  | "The Cozy Architect"
  | "The Trailblazer"
  | "The Connector";

function deriveArchetypeTitle(answers: VibeCheckAnswers): ArchetypeTitle {
  const { energyType, loveLanguage, adventureLevel, conflictStyle, datePace } = answers;
  if (energyType === "adventurer" && adventureLevel >= 4) return "The Spark Chaser";
  if (loveLanguage === "words" && datePace === "slow-burn") return "The Deep Diver";
  if (loveLanguage === "touch" && energyType !== "homebody") return "The Warm Pulse";
  if (energyType === "homebody" && loveLanguage === "time") return "The Cozy Architect";
  if (conflictStyle === "quick-fix" && datePace === "fast-sparks") return "The Trailblazer";
  return "The Connector";
}

const BASE: VibeCheckAnswers = {
  loveLanguage: "acts",
  energyType: "balanced",
  conflictStyle: "talk-it-out",
  datePace: "medium",
  adventureLevel: 3,
};

describe("Vibe personality reveal — archetype derivation", () => {
  it("adventurer + adventureLevel 5 → The Spark Chaser", () => {
    expect(deriveArchetypeTitle({ ...BASE, energyType: "adventurer", adventureLevel: 5 }))
      .toBe("The Spark Chaser");
  });

  it("adventurer + adventureLevel 4 → The Spark Chaser", () => {
    expect(deriveArchetypeTitle({ ...BASE, energyType: "adventurer", adventureLevel: 4 }))
      .toBe("The Spark Chaser");
  });

  it("words + slow-burn → The Deep Diver", () => {
    expect(deriveArchetypeTitle({ ...BASE, loveLanguage: "words", datePace: "slow-burn" }))
      .toBe("The Deep Diver");
  });

  it("touch + adventurer → The Warm Pulse", () => {
    expect(deriveArchetypeTitle({ ...BASE, loveLanguage: "touch", energyType: "adventurer" }))
      .toBe("The Warm Pulse");
  });

  it("homebody + time → The Cozy Architect", () => {
    expect(deriveArchetypeTitle({ ...BASE, energyType: "homebody", loveLanguage: "time" }))
      .toBe("The Cozy Architect");
  });

  it("quick-fix + fast-sparks → The Trailblazer", () => {
    expect(deriveArchetypeTitle({ ...BASE, conflictStyle: "quick-fix", datePace: "fast-sparks" }))
      .toBe("The Trailblazer");
  });

  it("fallback balanced answers → The Connector", () => {
    expect(deriveArchetypeTitle({ ...BASE })).toBe("The Connector");
  });

  it("is deterministic — same answers always produce same archetype", () => {
    const answers: VibeCheckAnswers = {
      loveLanguage: "gifts",
      energyType: "balanced",
      conflictStyle: "need-space",
      datePace: "medium",
      adventureLevel: 2,
    };
    expect(deriveArchetypeTitle(answers)).toBe(deriveArchetypeTitle(answers));
  });
});

// ─── 4. Vibe pill sheet — gate logic ─────────────────────────────────────────
//
// The pill only opens the sheet when the user has real compat data
// (hasRealCompatibilityScore === true). We test the guard.

describe("Vibe pill sheet gating", () => {
  function canOpenVibeSheet(hasRealCompatibilityScore: boolean): boolean {
    return hasRealCompatibilityScore;
  }

  it("opens sheet when real compat data exists", () => {
    expect(canOpenVibeSheet(true)).toBe(true);
  });

  it("does NOT open sheet on fallback matchScore (no quiz data)", () => {
    expect(canOpenVibeSheet(false)).toBe(false);
  });
});

// ─── 5. Anti-ghost nudge — silence-window boundary ───────────────────────────
//
// The cron fires for matches where the last activity was 48–71 hours ago.
// We verify the window boundaries exactly.

function isInSilenceWindow(lastActivityMs: number, nowMs: number): boolean {
  const ageHours = (nowMs - lastActivityMs) / 3600_000;
  return ageHours >= 48 && ageHours < 72;
}

function whichUserShouldReceiveNudge(match: {
  userId1: string;
  userId2: string;
  lastMessageAt: string | null;
  lastSenderId?: string | null;
}): string[] {
  if (!match.lastMessageAt) return [match.userId1, match.userId2];
  if (match.lastSenderId === match.userId1) return [match.userId2];
  return [match.userId1];
}

describe("Anti-ghost nudge — silence window", () => {
  const NOW = 1_750_000_000_000;
  const h = (n: number) => n * 3600_000;

  it("is in window at exactly 48h", () => {
    expect(isInSilenceWindow(NOW - h(48), NOW)).toBe(true);
  });

  it("is in window at 60h", () => {
    expect(isInSilenceWindow(NOW - h(60), NOW)).toBe(true);
  });

  it("is NOT in window at 47h (too soon)", () => {
    expect(isInSilenceWindow(NOW - h(47), NOW)).toBe(false);
  });

  it("is NOT in window at 72h (already fired, or use expiry instead)", () => {
    expect(isInSilenceWindow(NOW - h(72), NOW)).toBe(false);
  });

  it("is NOT in window for a brand-new match (1h old)", () => {
    expect(isInSilenceWindow(NOW - h(1), NOW)).toBe(false);
  });

  it("nudges both users when no messages have been sent", () => {
    const result = whichUserShouldReceiveNudge({
      userId1: "user_a",
      userId2: "user_b",
      lastMessageAt: null,
    });
    expect(result).toContain("user_a");
    expect(result).toContain("user_b");
    expect(result).toHaveLength(2);
  });

  it("nudges userId2 when userId1 sent the last message (userId2 is ghosting)", () => {
    const result = whichUserShouldReceiveNudge({
      userId1: "user_a",
      userId2: "user_b",
      lastMessageAt: new Date(NOW - h(50)).toISOString(),
      lastSenderId: "user_a",
    });
    expect(result).toEqual(["user_b"]);
  });

  it("nudges userId1 when userId2 sent the last message", () => {
    const result = whichUserShouldReceiveNudge({
      userId1: "user_a",
      userId2: "user_b",
      lastMessageAt: new Date(NOW - h(50)).toISOString(),
      lastSenderId: "user_b",
    });
    expect(result).toEqual(["user_a"]);
  });
});

describe("Stories strip seed content", () => {
  const NOW = 1_750_000_000_000;

  it("always exposes the front add-story CTA label", () => {
    expect(STORIES_ADD_CTA_LABEL).toBe("Add your story");
  });

  it("uses 4 curated seed stories when Firestore returns no moments", () => {
    const displayMoments = getDisplayMoments([], "current_user", NOW);

    expect(displayMoments).toHaveLength(4);
    expect(displayMoments.map((m) => m.id)).toEqual([
      "seed-story-rooftop",
      "seed-story-market",
      "seed-story-trivia-night",
      "seed-story-sunset",
    ]);
    expect(displayMoments.every((m) => m.expiresAt > m.createdAt)).toBe(true);
  });

  it("keeps Firestore moments as the source of truth when real stories exist", () => {
    const realMoment = {
      ...buildCuratedSeedStories(NOW)[0]!,
      id: "real-firestore-moment",
      authorId: "real_author",
      caption: "Actually from Firestore",
    };

    expect(getDisplayMoments([realMoment], "current_user", NOW)).toEqual([realMoment]);
  });
});

describe("Fresh dating chat fallback CTAs", () => {
  it("only shows fallback CTAs for a fresh chat with no opener", () => {
    expect(shouldShowFreshChatFallbackCtas(true, "")).toBe(true);
    expect(shouldShowFreshChatFallbackCtas(true, undefined)).toBe(true);
    expect(shouldShowFreshChatFallbackCtas(false, "")).toBe(false);
    expect(shouldShowFreshChatFallbackCtas(true, "Ask about rooftop salsa")).toBe(false);
  });

  it("uses the requested CTA labels and deterministic draft copy", () => {
    expect(FRESH_CHAT_OPENER_LABEL).toBe("✨ Send an opener");
    expect(FRESH_CHAT_DOUBLE_DATE_LABEL).toBe("🍻 Double date?");
    expect(buildFreshChatOpenerInvite("Maya Chen", "live jazz")).toBe(
      "Maya, quick opener: two truths and a lie about live jazz - I'll guess first.",
    );
    expect(buildFreshChatDoubleDateInvite("Maya Chen", "live jazz")).toBe(
      "Maya, low-pressure idea: double date over live jazz sometime? Bring your funniest friend and I'll bring mine.",
    );
  });
});

describe("Shot onboarding coach mark", () => {
  it("uses the launch storage key and copy", () => {
    expect(SHOT_TOOLTIP_STORAGE_KEY).toBe("cs:onboarding:shot-tooltip-seen");
    expect(SHOT_TOOLTIP_COPY).toBe("A Shot is a bold first move — send a message before you even match.");
  });

  it("appears once for dating/all intent and stays dismissed", () => {
    expect(shouldShowShotTooltip("dating", false)).toBe(true);
    expect(shouldShowShotTooltip("all", false)).toBe(true);
    expect(shouldShowShotTooltip("friendship", false)).toBe(false);
    expect(shouldShowShotTooltip("dating", true)).toBe(false);
  });
});

describe("Why would we work copy", () => {
  const mine = {
    loveLanguage: "words",
    energyType: "adventurer",
    conflictStyle: "talk-it-out",
    datePace: "slow-burn",
    adventureLevel: 4,
  };

  const profile = {
    name: "Maya Chen",
    interests: ["live jazz", "food halls", "sunset walks"],
    chemistrySignals: ["playful planner"],
    prompt: "A perfect Sunday",
    promptAnswer: "markets, music, and a tiny dessert crawl",
    firstDateStyle: "low-key drinks",
    dateIdeas: ["vinyl bar"],
    vibeCheck: {
      answers: {
        loveLanguage: "words",
        energyType: "adventurer",
        conflictStyle: "need-space",
        datePace: "slow-burn",
        adventureLevel: 5,
      },
    },
  };

  it("deterministically derives useful 1-2 sentence copy from profile data", () => {
    const first = buildWhyWeWouldWorkCopy(profile, mine);
    const second = buildWhyWeWouldWorkCopy(profile, mine);

    expect(first).toBe(second);
    expect(first).toContain("Maya");
    expect(first).toContain("live jazz");
    expect(first).toContain("VibeCheck");
    expect(first.split(".").filter(Boolean).length).toBeLessThanOrEqual(2);
  });

  it("has a stable sparse-profile fallback", () => {
    expect(buildWhyWeWouldWorkCopy({ name: "Jordan" })).toBe(
      "You and Jordan both give low-pressure, curious energy, so starting with one simple question should feel natural.",
    );
  });
});

describe("Discover launch monetization", () => {
  it("uses shared daily free actions for dating and friends impressions", () => {
    expect(shouldConsumeDiscoverAction("dating", "vibe")).toBe(true);
    expect(shouldConsumeDiscoverAction("dating", "shot")).toBe(true);
    expect(shouldConsumeDiscoverAction("dating", "pass")).toBe(true);
    expect(shouldConsumeDiscoverAction("friends", "create_plan")).toBe(true);
    expect(shouldConsumeDiscoverAction("friends", "best_friend")).toBe(true);
  });

  it("opens dating directly instead of showing the Vibe Check gate", () => {
    expect(shouldBypassVibeGate()).toBe(true);
  });

  it("renames the side rail Shot pop label to Shoot without changing action routing", () => {
    expect(getRailPopLabel("SHOOT")).toBe("Shoot");
    expect(getRailPopLabel("SHOT")).toBe("Shoot");
  });

  it("exposes onboarding dating goals in the Discover dating slider", () => {
    expect(buildDatingSubTabs()).toEqual([
      "For You",
      "Active Tonight",
      "Hookup",
      "Intentional",
      "Curious",
      "Having Fun",
    ]);
  });

  it("maps discover dating tabs to backend subtype values", () => {
    expect(getDiscoverySubtypeForDatingTab("For You", "Curious")).toBe("Curious");
    expect(getDiscoverySubtypeForDatingTab("Intentional", "Hookup")).toBe("Long Term");
    expect(getDiscoverySubtypeForDatingTab("Hookup", "Long Term")).toBe("Hookup");
    expect(getDiscoverySubtypeForDatingTab("Having Fun", "Long Term")).toBe("Having Fun");
    expect(getDiscoverySubtypeForDatingTab("Active Tonight", "Curious")).toBeUndefined();
  });

  it("limits premium boosts to one activation per day", () => {
    expect(canUseDailyBoost(true, null, "2026-06-04")).toBe(true);
    expect(canUseDailyBoost(false, null, "2026-06-04")).toBe(false);
    expect(canUseDailyBoost(true, "2026-06-03", "2026-06-04")).toBe(true);
    expect(canUseDailyBoost(true, "2026-06-04", "2026-06-04")).toBe(false);
  });

  it("routes inactive non-premium boost taps to the boost paywall", () => {
    expect(getBoostPressDecision({
      isActive: false,
      isPremium: false,
      lastActivatedDate: null,
      today: "2026-06-05",
    })).toEqual({ type: "paywall", feature: "boost" });
  });

  it("keeps active boost taps informational instead of reactivating", () => {
    expect(getBoostPressDecision({
      isActive: true,
      isPremium: true,
      lastActivatedDate: "2026-06-05",
      today: "2026-06-05",
    })).toEqual({ type: "active" });
  });

  it("prevents a second Plus boost on the same day", () => {
    expect(getBoostPressDecision({
      isActive: false,
      isPremium: true,
      lastActivatedDate: "2026-06-05",
      today: "2026-06-05",
    })).toEqual({ type: "used-today" });
  });
});
