/**
 * Unit tests — VibeCheck wiring through DatingProfileSnapshot
 *
 * Covers:
 *   1. Seed profile vibeCheck answers are valid VibeCheckAnswers shapes
 *   2. datingSnapshot-style null-coalescing (vibeCheck ?? null)
 *   3. computeCompatibility integrates correctly with seed data
 *   4. DatingMatchContext vibeAnswers plumbing shape expectations
 *
 * Run with: pnpm test --testPathPattern=vibeCheckWiring
 */
import { computeCompatibility } from "../components/VibeCheckQuiz";
import type { VibeCheckAnswers } from "../components/VibeCheckQuiz";

// ─── Valid enum sets (mirrors the VibeCheckAnswers type) ──────────────────────

const VALID_LOVE_LANGUAGES = new Set(["words", "touch", "acts", "gifts", "time"]);
const VALID_ENERGY_TYPES    = new Set(["homebody", "adventurer", "balanced"]);
const VALID_CONFLICT_STYLES = new Set(["talk-it-out", "need-space", "quick-fix"]);
const VALID_DATE_PACES      = new Set(["slow-burn", "medium", "fast-sparks"]);
const VALID_ADVENTURE_LEVELS = new Set([1, 2, 3, 4, 5]);

function assertValidAnswers(answers: VibeCheckAnswers, label: string) {
  expect({ label, valid: VALID_LOVE_LANGUAGES.has(answers.loveLanguage) }).toEqual({ label, valid: true });
  expect({ label, valid: VALID_ENERGY_TYPES.has(answers.energyType) }).toEqual({ label, valid: true });
  expect({ label, valid: VALID_CONFLICT_STYLES.has(answers.conflictStyle) }).toEqual({ label, valid: true });
  expect({ label, valid: VALID_DATE_PACES.has(answers.datePace) }).toEqual({ label, valid: true });
  expect({ label, valid: VALID_ADVENTURE_LEVELS.has(answers.adventureLevel) }).toEqual({ label, valid: true });
}

// ─── Seed profile fixtures (must match the data in app/(tabs)/index.tsx) ─────

const SEED_MAYA: VibeCheckAnswers = {
  loveLanguage: "acts",
  energyType: "adventurer",
  conflictStyle: "talk-it-out",
  datePace: "fast-sparks",
  adventureLevel: 5,
};

const SEED_SOFIA: VibeCheckAnswers = {
  loveLanguage: "time",
  energyType: "balanced",
  conflictStyle: "talk-it-out",
  datePace: "medium",
  adventureLevel: 3,
};

const SEED_PRIYA: VibeCheckAnswers = {
  loveLanguage: "time",
  energyType: "balanced",
  conflictStyle: "quick-fix",
  datePace: "slow-burn",
  adventureLevel: 2,
};

// ─── Seed profile shapes ──────────────────────────────────────────────────────

describe("Seed profile vibeCheck answers", () => {
  it("Maya has valid VibeCheckAnswers shape", () => {
    assertValidAnswers(SEED_MAYA, "Maya");
  });

  it("Sofia has valid VibeCheckAnswers shape", () => {
    assertValidAnswers(SEED_SOFIA, "Sofia");
  });

  it("Priya has valid VibeCheckAnswers shape", () => {
    assertValidAnswers(SEED_PRIYA, "Priya");
  });

  it("all three seeds have all 5 required fields", () => {
    const REQUIRED: Array<keyof VibeCheckAnswers> = [
      "loveLanguage",
      "energyType",
      "conflictStyle",
      "datePace",
      "adventureLevel",
    ];
    for (const seed of [SEED_MAYA, SEED_SOFIA, SEED_PRIYA]) {
      for (const field of REQUIRED) {
        expect(seed).toHaveProperty(field);
        // field must be present and non-null
        expect(seed[field]).toBeDefined();
      }
    }
  });
});

// ─── datingSnapshot vibeCheck passthrough ────────────────────────────────────
//
// datingSnapshot() is not exported; we test the underlying logic contract:
//   `profile.vibeCheck ?? null`
// This ensures the snapshot layer never passes `undefined` downstream (which
// would skip the VibeBreakdownCompact render check in DatingMatchModal).

describe("datingSnapshot vibeCheck null-coalescing contract", () => {
  type ProfileVibeSlice = { vibeCheck?: { answers: VibeCheckAnswers; completedAt: string } | null };

  function snapshotVibeCheck(profile: ProfileVibeSlice) {
    return profile.vibeCheck ?? null;
  }

  it("returns the vibeCheck object when present", () => {
    const result = snapshotVibeCheck({
      vibeCheck: { answers: SEED_MAYA, completedAt: "2025-01-15T10:00:00Z" },
    });
    expect(result).not.toBeNull();
    expect(result?.answers).toEqual(SEED_MAYA);
  });

  it("returns null when vibeCheck is undefined", () => {
    expect(snapshotVibeCheck({})).toBeNull();
  });

  it("returns null when vibeCheck is explicitly null", () => {
    expect(snapshotVibeCheck({ vibeCheck: null })).toBeNull();
  });

  it("completedAt is preserved through the snapshot", () => {
    const completedAt = "2025-01-14T18:30:00Z";
    const result = snapshotVibeCheck({ vibeCheck: { answers: SEED_SOFIA, completedAt } });
    expect(result?.completedAt).toBe(completedAt);
  });
});

// ─── DatingMatchModal prop contract ──────────────────────────────────────────
//
// DatingMatchModal receives:
//   myVibeAnswers?:   VibeCheckAnswers  (from Firestore / current user)
//   theirVibeAnswers?: VibeCheckAnswers (from match profile snapshot)
//
// VibeBreakdownCompact only renders when BOTH are defined.
// These tests verify the pairing logic that DatingMatchContext performs.

describe("DatingMatchModal vibeAnswers pairing", () => {
  function shouldShowBreakdown(
    myAnswers: VibeCheckAnswers | null | undefined,
    theirAnswers: VibeCheckAnswers | null | undefined,
  ): boolean {
    return myAnswers != null && theirAnswers != null;
  }

  it("shows breakdown when both sides have answers", () => {
    expect(shouldShowBreakdown(SEED_MAYA, SEED_SOFIA)).toBe(true);
  });

  it("hides breakdown when current user has no answers yet", () => {
    expect(shouldShowBreakdown(null, SEED_SOFIA)).toBe(false);
    expect(shouldShowBreakdown(undefined, SEED_SOFIA)).toBe(false);
  });

  it("hides breakdown when match has no answers", () => {
    expect(shouldShowBreakdown(SEED_MAYA, null)).toBe(false);
    expect(shouldShowBreakdown(SEED_MAYA, undefined)).toBe(false);
  });

  it("hides breakdown when neither side has answers", () => {
    expect(shouldShowBreakdown(null, null)).toBe(false);
  });
});

// ─── Seed-data compatibility scores ──────────────────────────────────────────
//
// These are regression guards — they verify that the three seed profiles
// produce stable, meaningful scores relative to each other.

describe("computeCompatibility with seed profiles", () => {
  it("Maya vs Sofia returns a score between 0 and 100", () => {
    const score = computeCompatibility(SEED_MAYA, SEED_SOFIA);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("Maya vs Priya returns a score between 0 and 100", () => {
    const score = computeCompatibility(SEED_MAYA, SEED_PRIYA);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("Sofia vs Priya (similar profiles) scores higher than Maya vs Priya", () => {
    // Sofia and Priya share energyType (balanced) and loveLanguage (time)
    // Maya and Priya are more mismatched on energy and adventureLevel
    const sofiaPriya = computeCompatibility(SEED_SOFIA, SEED_PRIYA);
    const mayaPriya  = computeCompatibility(SEED_MAYA, SEED_PRIYA);
    expect(sofiaPriya).toBeGreaterThan(mayaPriya);
  });

  it("is symmetric — A vs B equals B vs A for seed profiles", () => {
    expect(computeCompatibility(SEED_MAYA, SEED_SOFIA)).toBe(
      computeCompatibility(SEED_SOFIA, SEED_MAYA),
    );
  });

  it("self-score is 100", () => {
    expect(computeCompatibility(SEED_MAYA, SEED_MAYA)).toBe(100);
    expect(computeCompatibility(SEED_SOFIA, SEED_SOFIA)).toBe(100);
    expect(computeCompatibility(SEED_PRIYA, SEED_PRIYA)).toBe(100);
  });
});
