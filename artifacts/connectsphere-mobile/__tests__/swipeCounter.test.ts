/**
 * swipeCounter.test.ts
 *
 * Tests for the daily swipe counter (lib/swipeCounter.ts).
 * Covers: fresh state, decrement, zero-clamp, date rollover, refund cap.
 *
 * Run: pnpm test (requires jest-expo + @react-native-async-storage/async-storage mock)
 */

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DAILY_SWIPE_LIMIT,
  decrementSwipes,
  getSwipesLeft,
  refundSwipe,
  resetSwipes,
} from "../lib/swipeCounter";

// The jest-expo preset mocks AsyncStorage via:
//   @react-native-async-storage/async-storage/jest/async-storage-mock
// which uses an in-memory store — perfect for unit tests.

const TODAY = "2026-06-01";
const YESTERDAY = "2026-05-31";

test("free users get 5 shared Discover actions per day", () => {
  expect(DAILY_SWIPE_LIMIT).toBe(5);
});

// Fix the date so "today" is always TODAY in these tests
beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(`${TODAY}T12:00:00.000Z`));
});

afterAll(() => {
  jest.useRealTimers();
});

beforeEach(async () => {
  await resetSwipes();
});

// ── Fresh state ───────────────────────────────────────────────────────────────

test("returns DAILY_SWIPE_LIMIT when no data stored", async () => {
  const left = await getSwipesLeft();
  expect(left).toBe(DAILY_SWIPE_LIMIT);
});

// ── Decrement ─────────────────────────────────────────────────────────────────

test("decrement reduces count by 1", async () => {
  const left = await decrementSwipes();
  expect(left).toBe(DAILY_SWIPE_LIMIT - 1);
});

test("getSwipesLeft reflects decremented count", async () => {
  await decrementSwipes();
  await decrementSwipes();
  const left = await getSwipesLeft();
  expect(left).toBe(DAILY_SWIPE_LIMIT - 2);
});

test("decrement does not go below 0", async () => {
  // Use up all swipes
  for (let i = 0; i < DAILY_SWIPE_LIMIT; i++) {
    await decrementSwipes();
  }
  // One more — should not produce a negative number
  const left = await decrementSwipes();
  expect(left).toBe(0);
});

test("count clamps to 0 even if storage count exceeds limit", async () => {
  // Simulate corrupted storage with count above limit
  await AsyncStorage.setItem(
    "cs:vibes:daily",
    JSON.stringify({ date: TODAY, count: DAILY_SWIPE_LIMIT + 10 })
  );
  const left = await getSwipesLeft();
  expect(left).toBe(0);
});

// ── Date rollover ─────────────────────────────────────────────────────────────

test("counter resets to full limit when stored date is yesterday", async () => {
  await AsyncStorage.setItem(
    "cs:vibes:daily",
    JSON.stringify({ date: YESTERDAY, count: DAILY_SWIPE_LIMIT })
  );
  const left = await getSwipesLeft();
  expect(left).toBe(DAILY_SWIPE_LIMIT);
});

test("decrement on a new day resets from full limit, not from yesterday's count", async () => {
  await AsyncStorage.setItem(
    "cs:vibes:daily",
    JSON.stringify({ date: YESTERDAY, count: 25 }) // used 25 yesterday
  );
  const left = await decrementSwipes(); // first swipe today
  expect(left).toBe(DAILY_SWIPE_LIMIT - 1);
});

test("decrement writes today's date and first used count from empty storage", async () => {
  await decrementSwipes();

  const raw = await AsyncStorage.getItem("cs:vibes:daily");
  expect(JSON.parse(raw!)).toEqual({ date: TODAY, count: 1 });
});

test("decrement increments an existing same-day count", async () => {
  await AsyncStorage.setItem(
    "cs:vibes:daily",
    JSON.stringify({ date: TODAY, count: 3 })
  );

  const left = await decrementSwipes();
  const raw = await AsyncStorage.getItem("cs:vibes:daily");

  expect(left).toBe(DAILY_SWIPE_LIMIT - 4);
  expect(JSON.parse(raw!)).toEqual({ date: TODAY, count: 4 });
});

test("decrement treats corrupted storage as a fresh day", async () => {
  await AsyncStorage.setItem("cs:vibes:daily", "{not valid json");

  const left = await decrementSwipes();
  const raw = await AsyncStorage.getItem("cs:vibes:daily");

  expect(left).toBe(DAILY_SWIPE_LIMIT - 1);
  expect(JSON.parse(raw!)).toEqual({ date: TODAY, count: 1 });
});

test("repeated decrement at zero never returns a negative value", async () => {
  await AsyncStorage.setItem(
    "cs:vibes:daily",
    JSON.stringify({ date: TODAY, count: DAILY_SWIPE_LIMIT })
  );

  expect(await decrementSwipes()).toBe(0);
  expect(await decrementSwipes()).toBe(0);
  expect(await getSwipesLeft()).toBe(0);
});

// ── Refund (Rewind) ───────────────────────────────────────────────────────────

test("refund adds 1 swipe back", async () => {
  await decrementSwipes(); // left = LIMIT - 1
  await decrementSwipes(); // left = LIMIT - 2
  const left = await refundSwipe();
  expect(left).toBe(DAILY_SWIPE_LIMIT - 1);
});

test("refund does not exceed DAILY_SWIPE_LIMIT", async () => {
  // Start with full limit — refund should stay at limit
  const left = await refundSwipe();
  expect(left).toBe(DAILY_SWIPE_LIMIT);
});

test("multiple refunds never exceed the daily limit", async () => {
  await decrementSwipes();
  await refundSwipe();
  await refundSwipe(); // second refund on unused quota — should cap
  const left = await getSwipesLeft();
  expect(left).toBe(DAILY_SWIPE_LIMIT);
});
