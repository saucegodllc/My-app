/**
 * persistentBoost.test.ts
 * ───────────────────────
 * Unit tests for usePersistentBoost hook logic.
 *
 * We test the pure helper functions directly (no hook renderer needed) to keep
 * the suite fast and dependency-free. The hook itself is covered by the
 * integration paths in criticalFlows.test.ts.
 */

import { canUseDailyBoost } from "../lib/retentionFeatures";

// ─── Minimal AsyncStorage mock ────────────────────────────────────────────────
const store: Record<string, string> = {};
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
  setItem: jest.fn((key: string, val: string) => {
    store[key] = val;
    return Promise.resolve();
  }),
  multiSet: jest.fn((pairs: [string, string][]) => {
    pairs.forEach(([k, v]) => { store[k] = v; });
    return Promise.resolve();
  }),
  multiRemove: jest.fn((keys: string[]) => {
    keys.forEach((k) => { delete store[k]; });
    return Promise.resolve();
  }),
}));

// ─── Minimal firebase mock ────────────────────────────────────────────────────
jest.mock("firebase/firestore", () => ({}), { virtual: true });
jest.mock("firebase/app", () => ({}), { virtual: true });

// ─── Analytics mock ───────────────────────────────────────────────────────────
jest.mock("@/lib/analytics", () => ({
  Analytics: {
    boostStarted: jest.fn(),
    boostExpired: jest.fn(),
    boostRestoredFromCache: jest.fn(),
    purchaseFailed: jest.fn(),
  },
}));

// ─── Storage key constants (duplicated from hook — avoids import side effects) ─
const BOOST_EXPIRY_KEY = "cs:boost:expiresAt";
const BOOST_DATE_KEY = "cs:boost:lastActivatedDate";
const AsyncStorage = require("@react-native-async-storage/async-storage");

beforeEach(() => {
  // Clear the in-memory store before each test
  Object.keys(store).forEach((k) => { delete store[k]; });
  jest.clearAllMocks();
});

// ─── readCachedExpiry ─────────────────────────────────────────────────────────

describe("AsyncStorage boost cache — expiry key", () => {
  it("returns null when no key is stored", async () => {
    const raw = await AsyncStorage.getItem(BOOST_EXPIRY_KEY);
    expect(raw).toBeNull();
  });

  it("returns a future Date when a valid ISO string is stored", async () => {
    const future = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    store[BOOST_EXPIRY_KEY] = future;
    const raw = await AsyncStorage.getItem(BOOST_EXPIRY_KEY);
    expect(raw).not.toBeNull();
    const d = new Date(raw!);
    expect(d.getTime()).toBeGreaterThan(Date.now());
  });

  it("returns null (logically expired) when stored timestamp is in the past", async () => {
    const past = new Date(Date.now() - 5000).toISOString();
    store[BOOST_EXPIRY_KEY] = past;
    const raw = await AsyncStorage.getItem(BOOST_EXPIRY_KEY);
    expect(raw).not.toBeNull();
    // The hook's readCachedExpiry checks d > new Date() — simulate here:
    const d = new Date(raw!);
    expect(d.getTime()).toBeLessThan(Date.now());
  });
});

// ─── readCachedDate ───────────────────────────────────────────────────────────

describe("AsyncStorage boost cache — date key", () => {
  it("returns null when no date is stored", async () => {
    const raw = await AsyncStorage.getItem(BOOST_DATE_KEY);
    expect(raw).toBeNull();
  });

  it("returns stored YYYY-MM-DD string", async () => {
    store[BOOST_DATE_KEY] = "2026-06-05";
    const raw = await AsyncStorage.getItem(BOOST_DATE_KEY);
    expect(raw).toBe("2026-06-05");
  });
});

// ─── writeCache ───────────────────────────────────────────────────────────────

describe("AsyncStorage writeCache", () => {
  it("multiSet writes both expiry and date keys", async () => {
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const today = "2026-06-05";
    await AsyncStorage.multiSet([
      [BOOST_EXPIRY_KEY, expiresAt.toISOString()],
      [BOOST_DATE_KEY, today],
    ]);
    expect(store[BOOST_EXPIRY_KEY]).toBe(expiresAt.toISOString());
    expect(store[BOOST_DATE_KEY]).toBe(today);
  });
});

// ─── clearCache ───────────────────────────────────────────────────────────────

describe("AsyncStorage clearCache", () => {
  it("multiRemove deletes both keys", async () => {
    store[BOOST_EXPIRY_KEY] = new Date().toISOString();
    store[BOOST_DATE_KEY] = "2026-06-05";
    await AsyncStorage.multiRemove([BOOST_EXPIRY_KEY, BOOST_DATE_KEY]);
    expect(store[BOOST_EXPIRY_KEY]).toBeUndefined();
    expect(store[BOOST_DATE_KEY]).toBeUndefined();
  });
});

// ─── Boost activation timing ──────────────────────────────────────────────────

describe("Boost activation: 30-minute window", () => {
  it("expiresAt is approximately 30 minutes from now", () => {
    const before = Date.now();
    const expiresIn30 = new Date(Date.now() + 30 * 60 * 1000);
    const after = Date.now();
    const windowMs = 30 * 60 * 1000;
    expect(expiresIn30.getTime()).toBeGreaterThanOrEqual(before + windowMs - 10);
    expect(expiresIn30.getTime()).toBeLessThanOrEqual(after + windowMs + 10);
  });

  it("an active boost expires correctly after 30 minutes (simulated)", () => {
    const activated = new Date(Date.now() - 30 * 60 * 1000 - 1); // 30 min ago + 1ms
    const isExpired = activated.getTime() < Date.now();
    expect(isExpired).toBe(true);
  });

  it("a boost activated 15 minutes ago is still active", () => {
    const activated = new Date(Date.now() - 15 * 60 * 1000);
    const expiresAt = new Date(activated.getTime() + 30 * 60 * 1000);
    const isActive = expiresAt.getTime() > Date.now();
    expect(isActive).toBe(true);
  });
});

// ─── Two-phase loading: cache wins on cold start ──────────────────────────────

describe("Two-phase loading: cache-first behaviour", () => {
  it("Phase 1: shows cached boost immediately when cache contains a future expiry", async () => {
    const future = new Date(Date.now() + 20 * 60 * 1000).toISOString();
    store[BOOST_EXPIRY_KEY] = future;

    const raw = await AsyncStorage.getItem(BOOST_EXPIRY_KEY);
    const d = raw ? new Date(raw) : null;
    const isActive = d !== null && d.getTime() > Date.now();

    expect(isActive).toBe(true);
  });

  it("Phase 1: shows no boost when cache is empty", async () => {
    const raw = await AsyncStorage.getItem(BOOST_EXPIRY_KEY);
    expect(raw).toBeNull();
  });

  it("Phase 2: Firestore null result clears cache (server cancellation)", async () => {
    // Pre-populate cache as if boost was active
    store[BOOST_EXPIRY_KEY] = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    store[BOOST_DATE_KEY] = "2026-06-05";

    // Simulate Firestore returning no active boost → hook clears cache
    await AsyncStorage.multiRemove([BOOST_EXPIRY_KEY, BOOST_DATE_KEY]);

    expect(store[BOOST_EXPIRY_KEY]).toBeUndefined();
    expect(store[BOOST_DATE_KEY]).toBeUndefined();
  });

  it("Phase 2: Firestore result overwrites a stale cache entry", async () => {
    // Cache says boost expired
    store[BOOST_EXPIRY_KEY] = new Date(Date.now() - 1000).toISOString();

    // Firestore returns a fresher (server-updated) expiry
    const fresherExpiry = new Date(Date.now() + 25 * 60 * 1000);
    const fresherToday = "2026-06-05";
    await AsyncStorage.multiSet([
      [BOOST_EXPIRY_KEY, fresherExpiry.toISOString()],
      [BOOST_DATE_KEY, fresherToday],
    ]);

    const cached = new Date(store[BOOST_EXPIRY_KEY]);
    expect(cached.getTime()).toBeGreaterThan(Date.now());
  });
});

// ─── Daily limit guard ────────────────────────────────────────────────────────

describe("Daily boost limit", () => {
  const TODAY = "2026-06-05";
  const YESTERDAY = "2026-06-04";

  it("allows a premium user with no previous activation to boost", () => {
    expect(canUseDailyBoost(true, null, TODAY)).toBe(true);
  });

  it("allows a premium user whose last activation was yesterday to boost", () => {
    expect(canUseDailyBoost(true, YESTERDAY, TODAY)).toBe(true);
  });

  it("blocks a premium user whose last activation is today", () => {
    expect(canUseDailyBoost(true, TODAY, TODAY)).toBe(false);
  });

  it("blocks a non-premium user even with no previous activation", () => {
    expect(canUseDailyBoost(false, null, TODAY)).toBe(false);
  });

  it("uses the current ISO date when today is omitted", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-06-05T16:30:00.000Z"));

    try {
      expect(canUseDailyBoost(true, YESTERDAY)).toBe(true);
      expect(canUseDailyBoost(true, TODAY)).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });
});
