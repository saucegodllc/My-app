import { isDiscoverySwipeLimitError, remainingSwipesFromDiscoveryResult } from "../lib/discoverySwipeAuthority";

test("detects server-side swipe limit errors", () => {
  expect(isDiscoverySwipeLimitError({ status: 429 })).toBe(true);
  expect(isDiscoverySwipeLimitError({ data: { code: "SWIPE_LIMIT_REACHED" } })).toBe(true);
  expect(isDiscoverySwipeLimitError({ status: 402, data: { code: "SPARK_LIMIT_REACHED" } })).toBe(false);
});

test("reads and clamps server remaining swipe counts", () => {
  expect(remainingSwipesFromDiscoveryResult({ remainingSwipes: 3 })).toBe(3);
  expect(remainingSwipesFromDiscoveryResult({ remainingSwipes: -2 })).toBe(0);
  expect(remainingSwipesFromDiscoveryResult({ remainingSwipes: null })).toBeNull();
});
