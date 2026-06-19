/**
 * firstSessionGuide.test.ts
 *
 * Tests for the first-session magic-loop guide overlay.
 *
 * Because FirstSessionGuide is a React component with animation and Modal,
 * we test the pure-logic layer: the AsyncStorage key contract and the
 * "shown once" behaviour encoded in DiscoverScreen's AsyncStorage check.
 *
 * Run: pnpm test
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { GUIDE_SEEN_KEY } from "../components/FirstSessionGuide";

beforeEach(async () => {
  await AsyncStorage.clear();
});

// ── GUIDE_SEEN_KEY contract ───────────────────────────────────────────────────

test("GUIDE_SEEN_KEY is a stable, namespaced string", () => {
  expect(GUIDE_SEEN_KEY).toBe("cs:guide:seen");
  // Must start with the app namespace so it doesn't clash with other keys
  expect(GUIDE_SEEN_KEY.startsWith("cs:")).toBe(true);
});

// ── "show once" logic (mirrors the useEffect in DiscoverScreen) ───────────────

async function shouldShowGuide(): Promise<boolean> {
  const val = await AsyncStorage.getItem(GUIDE_SEEN_KEY);
  return !val;
}

async function markGuideSeen(): Promise<void> {
  await AsyncStorage.setItem(GUIDE_SEEN_KEY, "1");
}

test("guide is shown on first app open (no storage entry)", async () => {
  const show = await shouldShowGuide();
  expect(show).toBe(true);
});

test("guide is NOT shown after the user completes it", async () => {
  await markGuideSeen();
  const show = await shouldShowGuide();
  expect(show).toBe(false);
});

test("guide is NOT shown after the user skips it", async () => {
  // Skip sets the same key
  await markGuideSeen();
  const show = await shouldShowGuide();
  expect(show).toBe(false);
});

test("clearing storage brings the guide back (e.g. fresh install)", async () => {
  await markGuideSeen();
  await AsyncStorage.clear();
  const show = await shouldShowGuide();
  expect(show).toBe(true);
});

test("any truthy stored value suppresses the guide", async () => {
  // Defence: even an unexpected value ("true", "yes") should hide the guide
  for (const val of ["1", "true", "yes", "seen"]) {
    await AsyncStorage.setItem(GUIDE_SEEN_KEY, val);
    const show = await shouldShowGuide();
    expect(show).toBe(false);
  }
});

test("empty string stored value shows the guide (treated as falsy)", async () => {
  await AsyncStorage.setItem(GUIDE_SEEN_KEY, "");
  const show = await shouldShowGuide();
  // Empty string is falsy — same as no value
  expect(show).toBe(true);
});
