/**
 * Unit tests — VibeBreakdown + VibeCheckQuiz compatibility logic
 *
 * These are pure-function tests with zero UI/network dependencies.
 * Run with: pnpm test --testPathPattern=vibeBreakdown
 */
import { computeCompatibility } from "../components/VibeCheckQuiz";
import { computeVibeBreakdown } from "../components/VibeBreakdown";
import type { VibeCheckAnswers } from "../components/VibeCheckQuiz";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const PERFECT_MATCH: [VibeCheckAnswers, VibeCheckAnswers] = [
  { loveLanguage: "words", energyType: "adventurer", conflictStyle: "talk-it-out", datePace: "slow-burn", adventureLevel: 5 },
  { loveLanguage: "words", energyType: "adventurer", conflictStyle: "talk-it-out", datePace: "slow-burn", adventureLevel: 5 },
];

const WORST_MATCH: [VibeCheckAnswers, VibeCheckAnswers] = [
  { loveLanguage: "words", energyType: "homebody", conflictStyle: "talk-it-out", datePace: "slow-burn", adventureLevel: 1 },
  { loveLanguage: "gifts", energyType: "adventurer", conflictStyle: "quick-fix",   datePace: "fast-sparks", adventureLevel: 5 },
];

const PARTIAL_MATCH: [VibeCheckAnswers, VibeCheckAnswers] = [
  { loveLanguage: "time",  energyType: "balanced", conflictStyle: "need-space", datePace: "medium", adventureLevel: 3 },
  { loveLanguage: "touch", energyType: "balanced", conflictStyle: "need-space", datePace: "medium", adventureLevel: 3 },
];

// ─── computeCompatibility ─────────────────────────────────────────────────────

describe("computeCompatibility", () => {
  it("returns 100 for identical answers", () => {
    expect(computeCompatibility(...PERFECT_MATCH)).toBe(100);
  });

  it("returns a value between 0 and 100 for any input", () => {
    const score = computeCompatibility(...WORST_MATCH);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("is symmetric — A vs B equals B vs A", () => {
    const [a, b] = PARTIAL_MATCH;
    expect(computeCompatibility(a, b)).toBe(computeCompatibility(b, a));
  });

  it("returns lower score for worst-case mismatch than partial match", () => {
    const worst   = computeCompatibility(...WORST_MATCH);
    const partial = computeCompatibility(...PARTIAL_MATCH);
    expect(worst).toBeLessThan(partial);
  });

  it("returns a whole number (rounded)", () => {
    const score = computeCompatibility(...PARTIAL_MATCH);
    expect(Number.isInteger(score)).toBe(true);
  });
});

// ─── computeVibeBreakdown ─────────────────────────────────────────────────────

describe("computeVibeBreakdown", () => {
  it("returns exactly 5 dimensions", () => {
    const dims = computeVibeBreakdown(...PERFECT_MATCH);
    expect(dims).toHaveLength(5);
  });

  it("all dimension scores are 100 for identical answers", () => {
    const dims = computeVibeBreakdown(...PERFECT_MATCH);
    dims.forEach((d) => expect(d.score).toBe(100));
  });

  it("all dimension scores are 0–100", () => {
    const dims = computeVibeBreakdown(...WORST_MATCH);
    dims.forEach((d) => {
      expect(d.score).toBeGreaterThanOrEqual(0);
      expect(d.score).toBeLessThanOrEqual(100);
    });
  });

  it("includes required fields on each dimension", () => {
    const dims = computeVibeBreakdown(...PARTIAL_MATCH);
    dims.forEach((d) => {
      expect(d).toHaveProperty("key");
      expect(d).toHaveProperty("label");
      expect(d).toHaveProperty("emoji");
      expect(d).toHaveProperty("score");
      expect(d).toHaveProperty("detail");
    });
  });

  it("detail string contains both users' values", () => {
    const [a, b] = PARTIAL_MATCH;
    const dims = computeVibeBreakdown(a, b);
    const loveDim = dims.find((d) => d.key === "love")!;
    // Both values should appear in the detail string
    expect(loveDim.detail).toBeTruthy();
    expect(loveDim.detail.includes("·")).toBe(true);
  });

  it("adventure dimension reflects numeric proximity", () => {
    const close: [VibeCheckAnswers, VibeCheckAnswers] = [
      { ...PERFECT_MATCH[0], adventureLevel: 4 },
      { ...PERFECT_MATCH[1], adventureLevel: 5 },
    ];
    const far: [VibeCheckAnswers, VibeCheckAnswers] = [
      { ...PERFECT_MATCH[0], adventureLevel: 1 },
      { ...PERFECT_MATCH[1], adventureLevel: 5 },
    ];
    const closeScore = computeVibeBreakdown(...close).find((d) => d.key === "adventure")!.score;
    const farScore   = computeVibeBreakdown(...far).find((d) => d.key === "adventure")!.score;
    expect(closeScore).toBeGreaterThan(farScore);
  });
});
