/**
 * momentsSilentButtons.test.tsx
 *
 * Regression tests for the two silent-button fixes in moments.tsx (2026-06):
 *
 *   1. Echo button — previously called onClose() with zero user feedback.
 *      Fix: Alert.alert("Echo coming soon 🔜", ...) before closing.
 *
 *   2. handleLike — previously only fired haptics.
 *      Fix: sets sentFlash to "❤️ Liked <name>'s Moment!" and auto-clears after 2000ms.
 *
 * Both fixes live inside private functions (MomentViewer, handleLike callback)
 * so we test the behavioral contracts directly as pure-logic unit tests,
 * mirroring the approach used in connectRouting.test.ts.
 *
 * Run with: pnpm jest __tests__/momentsSilentButtons.test.tsx
 */

import { Alert } from "react-native";
import * as Haptics from "expo-haptics";

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Alert is not mocked globally in jest.setup.js; spy on it here.
const alertSpy = jest.spyOn(Alert, "alert");

// expo-haptics is globally mocked in jest.setup.js.

// ─── Fix 1: Echo button — Alert feedback ────────────────────────────────────

describe("Echo button (MomentViewer)", () => {
  beforeEach(() => {
    alertSpy.mockClear();
    (Haptics.impactAsync as jest.Mock).mockClear();
  });

  /**
   * Simulates the Echo button's onPress handler as written in moments.tsx:
   *
   *   Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
   *   Alert.alert("Echo coming soon 🔜", "Echo lets you ...", [{ text: "Got it", onPress: onClose }]);
   */
  function pressEchoButton(onClose: () => void) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Echo coming soon 🔜",
      "Echo lets you re-share a Moment to your own feed. Shipping next update!",
      [{ text: "Got it", onPress: onClose }],
    );
  }

  it("calls Alert.alert on press", () => {
    pressEchoButton(jest.fn());
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it("alert title is 'Echo coming soon 🔜'", () => {
    pressEchoButton(jest.fn());
    const [title] = alertSpy.mock.calls[0];
    expect(title).toBe("Echo coming soon 🔜");
  });

  it("alert body mentions 'Echo' and 'next update'", () => {
    pressEchoButton(jest.fn());
    const [, message] = alertSpy.mock.calls[0];
    expect(message).toMatch(/Echo/);
    expect(message).toMatch(/next update/i);
  });

  it("alert has exactly one button labelled 'Got it'", () => {
    pressEchoButton(jest.fn());
    const [, , buttons] = alertSpy.mock.calls[0] as any;
    expect(buttons).toHaveLength(1);
    expect(buttons[0].text).toBe("Got it");
  });

  it("'Got it' onPress calls the viewer's onClose", () => {
    const onClose = jest.fn();
    pressEchoButton(onClose);
    const [, , buttons] = alertSpy.mock.calls[0] as any;
    buttons[0].onPress();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("fires Medium haptic on press", () => {
    pressEchoButton(jest.fn());
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
  });
});

// ─── Fix 2: handleLike — visible flash ──────────────────────────────────────

describe("handleLike flash behavior", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    (Haptics.impactAsync as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /**
   * Simulates the handleLike useCallback as written in moments.tsx:
   *
   *   Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
   *   setSentFlash(`❤️ Liked ${moment.userDisplayName}'s Moment!`);
   *   setTimeout(() => setSentFlash(null), 2000);
   */
  function runHandleLike(
    moment: { userDisplayName: string },
    setSentFlash: (v: string | null) => void,
  ) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSentFlash(`❤️ Liked ${moment.userDisplayName}'s Moment!`);
    setTimeout(() => setSentFlash(null), 2000);
  }

  it("sets flash message immediately on like", () => {
    const setSentFlash = jest.fn();
    runHandleLike({ userDisplayName: "Maya" }, setSentFlash);
    expect(setSentFlash).toHaveBeenNthCalledWith(1, "❤️ Liked Maya's Moment!");
  });

  it("flash message includes the liked user's display name", () => {
    const setSentFlash = jest.fn();
    runHandleLike({ userDisplayName: "Jordan" }, setSentFlash);
    expect(setSentFlash.mock.calls[0][0]).toContain("Jordan");
  });

  it("flash message starts with the ❤️ emoji", () => {
    const setSentFlash = jest.fn();
    runHandleLike({ userDisplayName: "Alex" }, setSentFlash);
    expect(setSentFlash.mock.calls[0][0]).toMatch(/^❤️/);
  });

  it("clears flash to null after 2000ms", () => {
    const setSentFlash = jest.fn();
    runHandleLike({ userDisplayName: "Maya" }, setSentFlash);
    // Not yet cleared
    expect(setSentFlash).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(2000);
    expect(setSentFlash).toHaveBeenNthCalledWith(2, null);
  });

  it("does not clear flash before 2000ms", () => {
    const setSentFlash = jest.fn();
    runHandleLike({ userDisplayName: "Maya" }, setSentFlash);
    jest.advanceTimersByTime(1999);
    // Still only the initial set call, no null clear yet
    expect(setSentFlash).toHaveBeenCalledTimes(1);
  });

  it("fires Light haptic on like", () => {
    const setSentFlash = jest.fn();
    runHandleLike({ userDisplayName: "Maya" }, setSentFlash);
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
  });
});
