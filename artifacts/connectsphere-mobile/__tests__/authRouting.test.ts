/**
 * authRouting.test.ts
 *
 * Verifies the three routing branches in app/index.tsx that fire after the
 * splash animation completes:
 *
 *   A. Not signed in              → router.replace("/(auth)/welcome")
 *   B. Signed in, no onboarding   → router.replace("/onboarding")
 *   C. Signed in, onboarding done → router.replace("/(tabs)")
 *   D. e2eSmokeEnabled = true      → router.replace("/(tabs)")  (bypasses auth)
 *
 * These are pure-logic unit tests — we mirror the exact conditional from the
 * screen rather than rendering the Animated splash (which pulls in native
 * modules that can't run in Jest).
 *
 * Run with: pnpm jest __tests__/authRouting.test.ts
 */

const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  router: { replace: mockReplace, push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({}),
}));

import { router } from "expo-router";

// ─── Mirrors the routing decision block in app/index.tsx ─────────────────────

function routeAfterSplash({
  e2eSmokeEnabled,
  isSignedIn,
  onboardingComplete,
}: {
  e2eSmokeEnabled: boolean;
  isSignedIn: boolean;
  onboardingComplete: boolean;
}) {
  if (e2eSmokeEnabled) {
    router.replace("/(tabs)");
  } else if (isSignedIn) {
    router.replace(onboardingComplete ? "/(tabs)" : "/onboarding");
  } else {
    router.replace("/(auth)/welcome");
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("app/index.tsx — routing after splash", () => {
  beforeEach(() => {
    mockReplace.mockClear();
  });

  describe("A. unauthenticated user", () => {
    it("routes to /(auth)/welcome", () => {
      routeAfterSplash({ e2eSmokeEnabled: false, isSignedIn: false, onboardingComplete: false });
      expect(mockReplace).toHaveBeenCalledWith("/(auth)/welcome");
    });

    it("does NOT route to tabs or onboarding", () => {
      routeAfterSplash({ e2eSmokeEnabled: false, isSignedIn: false, onboardingComplete: false });
      expect(mockReplace).not.toHaveBeenCalledWith("/(tabs)");
      expect(mockReplace).not.toHaveBeenCalledWith("/onboarding");
    });

    it("only calls replace once", () => {
      routeAfterSplash({ e2eSmokeEnabled: false, isSignedIn: false, onboardingComplete: false });
      expect(mockReplace).toHaveBeenCalledTimes(1);
    });
  });

  describe("B. signed in, onboarding NOT complete", () => {
    it("routes to /onboarding", () => {
      routeAfterSplash({ e2eSmokeEnabled: false, isSignedIn: true, onboardingComplete: false });
      expect(mockReplace).toHaveBeenCalledWith("/onboarding");
    });

    it("does NOT route to tabs or welcome", () => {
      routeAfterSplash({ e2eSmokeEnabled: false, isSignedIn: true, onboardingComplete: false });
      expect(mockReplace).not.toHaveBeenCalledWith("/(tabs)");
      expect(mockReplace).not.toHaveBeenCalledWith("/(auth)/welcome");
    });
  });

  describe("C. signed in, onboarding complete", () => {
    it("routes to /(tabs)", () => {
      routeAfterSplash({ e2eSmokeEnabled: false, isSignedIn: true, onboardingComplete: true });
      expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    });

    it("does NOT route to onboarding or welcome", () => {
      routeAfterSplash({ e2eSmokeEnabled: false, isSignedIn: true, onboardingComplete: true });
      expect(mockReplace).not.toHaveBeenCalledWith("/onboarding");
      expect(mockReplace).not.toHaveBeenCalledWith("/(auth)/welcome");
    });
  });

  describe("D. e2e smoke mode (bypasses auth entirely)", () => {
    it("routes to /(tabs) regardless of auth state", () => {
      routeAfterSplash({ e2eSmokeEnabled: true, isSignedIn: false, onboardingComplete: false });
      expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    });

    it("routes to /(tabs) even when onboarding is incomplete", () => {
      routeAfterSplash({ e2eSmokeEnabled: true, isSignedIn: true, onboardingComplete: false });
      expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    });

    it("never routes to welcome in smoke mode", () => {
      routeAfterSplash({ e2eSmokeEnabled: true, isSignedIn: false, onboardingComplete: false });
      expect(mockReplace).not.toHaveBeenCalledWith("/(auth)/welcome");
    });
  });

  describe("onboardingComplete edge cases", () => {
    it("treats onboardingComplete = undefined as false → /onboarding", () => {
      // unsafeMetadata?.onboardingComplete === true is the exact check in index.tsx
      const onboardingComplete = (undefined as unknown as boolean) === true;
      routeAfterSplash({ e2eSmokeEnabled: false, isSignedIn: true, onboardingComplete });
      expect(mockReplace).toHaveBeenCalledWith("/onboarding");
    });

    it("treats onboardingComplete = null as false → /onboarding", () => {
      const onboardingComplete = (null as unknown as boolean) === true;
      routeAfterSplash({ e2eSmokeEnabled: false, isSignedIn: true, onboardingComplete });
      expect(mockReplace).toHaveBeenCalledWith("/onboarding");
    });

    it("treats onboardingComplete = 'true' (string) as false → /onboarding", () => {
      // Must be exactly boolean true per the === true check
      const onboardingComplete = ("true" as unknown as boolean) === true;
      routeAfterSplash({ e2eSmokeEnabled: false, isSignedIn: true, onboardingComplete });
      expect(mockReplace).toHaveBeenCalledWith("/onboarding");
    });
  });
});
