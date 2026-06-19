/**
 * analyticsEvents.test.ts
 * ────────────────────────
 * Tests for the 5 new critical-path analytics events added in #172:
 *   • swipeLimitHit
 *   • paywallSeen
 *   • chatOpened
 *   • errorBoundaryTriggered
 *   • boostRestoredFromCache
 *
 * Strategy: mock SecureStore + the PostHog dynamic import so we can
 * verify that `track()` is called with the correct event name and properties.
 */

// ─── Mock SecureStore ─────────────────────────────────────────────────────────
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(() => Promise.resolve("granted")),
  setItemAsync: jest.fn(() => Promise.resolve()),
}));

// ─── Capture track() calls ────────────────────────────────────────────────────
const capturedEvents: Array<{ event: string; properties?: Record<string, unknown> }> = [];

jest.mock("posthog-react-native", () => ({
  PostHog: class {
    capture(event: string, properties?: Record<string, unknown>) {
      capturedEvents.push({ event, properties });
    }
    identify() {}
    reset() {}
  },
}), { virtual: true });

// Now import Analytics — consent is pre-granted by the SecureStore mock so
// every track() call will synchronously reach our posthog.capture stub.
import { Analytics } from "@/lib/analytics";

beforeEach(() => {
  capturedEvents.length = 0;
});

// ─── Helper: flush promises so async consent check + PostHog load resolves ────
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

// ─── swipeLimitHit ────────────────────────────────────────────────────────────

describe("Analytics.swipeLimitHit", () => {
  it("tracks 'swipe_limit_hit' with intent and swipesUsed", async () => {
    Analytics.swipeLimitHit({ intent: "dating", swipesUsed: 10 });
    await flush();
    const ev = capturedEvents.find((e) => e.event === "swipe_limit_hit");
    expect(ev).toBeDefined();
    expect(ev?.properties?.intent).toBe("dating");
    expect(ev?.properties?.swipesUsed).toBe(10);
  });

  it("accepts 'friends' intent", async () => {
    Analytics.swipeLimitHit({ intent: "friends", swipesUsed: 7 });
    await flush();
    const ev = capturedEvents.find((e) => e.event === "swipe_limit_hit");
    expect(ev?.properties?.intent).toBe("friends");
  });
});

// ─── paywallSeen ──────────────────────────────────────────────────────────────

describe("Analytics.paywallSeen", () => {
  it("tracks 'paywall_seen' with feature='swipes'", async () => {
    Analytics.paywallSeen("swipes");
    await flush();
    const ev = capturedEvents.find((e) => e.event === "paywall_seen");
    expect(ev).toBeDefined();
    expect(ev?.properties?.feature).toBe("swipes");
  });

  it("tracks 'paywall_seen' with feature='boost'", async () => {
    Analytics.paywallSeen("boost");
    await flush();
    const ev = capturedEvents.find((e) => e.event === "paywall_seen");
    expect(ev?.properties?.feature).toBe("boost");
  });

  it("merges extra properties alongside feature", async () => {
    Analytics.paywallSeen("swipes", { source: "swipe_guard", intent: "dating" });
    await flush();
    const ev = capturedEvents.find((e) => e.event === "paywall_seen");
    expect(ev?.properties?.source).toBe("swipe_guard");
    expect(ev?.properties?.intent).toBe("dating");
  });
});

// ─── chatOpened ───────────────────────────────────────────────────────────────

describe("Analytics.chatOpened", () => {
  it("tracks 'chat_opened' with matchId and source", async () => {
    Analytics.chatOpened("match_abc", { source: "match_modal", isFirstOpen: true });
    await flush();
    const ev = capturedEvents.find((e) => e.event === "chat_opened");
    expect(ev).toBeDefined();
    expect(ev?.properties?.matchId).toBe("match_abc");
    expect(ev?.properties?.source).toBe("match_modal");
    expect(ev?.properties?.isFirstOpen).toBe(true);
  });

  it("accepts all valid source values", async () => {
    const sources = ["match_modal", "matches_list", "notification", "other"] as const;
    for (const source of sources) {
      capturedEvents.length = 0;
      Analytics.chatOpened("id_x", { source });
      await flush();
      const ev = capturedEvents.find((e) => e.event === "chat_opened");
      expect(ev?.properties?.source).toBe(source);
    }
  });

  it("works without isFirstOpen flag", async () => {
    Analytics.chatOpened("match_xyz", { source: "matches_list" });
    await flush();
    const ev = capturedEvents.find((e) => e.event === "chat_opened");
    expect(ev).toBeDefined();
    expect(ev?.properties?.isFirstOpen).toBeUndefined();
  });
});

// ─── errorBoundaryTriggered ───────────────────────────────────────────────────

describe("Analytics.errorBoundaryTriggered", () => {
  it("tracks 'error_boundary_triggered' with screen='discover'", async () => {
    Analytics.errorBoundaryTriggered("discover", { message: "SwipeCard null ref" });
    await flush();
    const ev = capturedEvents.find((e) => e.event === "error_boundary_triggered");
    expect(ev).toBeDefined();
    expect(ev?.properties?.screen).toBe("discover");
    expect(ev?.properties?.message).toBe("SwipeCard null ref");
  });

  it("works without optional message prop", async () => {
    Analytics.errorBoundaryTriggered("discover");
    await flush();
    const ev = capturedEvents.find((e) => e.event === "error_boundary_triggered");
    expect(ev?.properties?.screen).toBe("discover");
    expect(ev?.properties?.message).toBeUndefined();
  });
});

// ─── boostRestoredFromCache ───────────────────────────────────────────────────

describe("Analytics.boostRestoredFromCache", () => {
  it("tracks 'boost_restored_from_cache'", async () => {
    Analytics.boostRestoredFromCache();
    await flush();
    const ev = capturedEvents.find((e) => e.event === "boost_restored_from_cache");
    expect(ev).toBeDefined();
  });

  it("has no properties payload (event is a simple signal)", async () => {
    Analytics.boostRestoredFromCache();
    await flush();
    const ev = capturedEvents.find((e) => e.event === "boost_restored_from_cache");
    // PostHog capture is called with undefined properties — that's fine
    expect(ev?.properties).toBeUndefined();
  });
});

// ─── Consent gate ─────────────────────────────────────────────────────────────

describe("Consent gate", () => {
  it("does NOT track when consent is denied", async () => {
    const SecureStore = require("expo-secure-store");
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce("denied");

    // Force a fresh consent check by importing the setter
    const { setAnalyticsConsent } = require("@/lib/analytics");
    await setAnalyticsConsent(false);

    capturedEvents.length = 0;
    Analytics.boostRestoredFromCache();
    await flush();

    expect(capturedEvents).toHaveLength(0);

    // Restore consent for subsequent tests
    await setAnalyticsConsent(true);
  });
});
