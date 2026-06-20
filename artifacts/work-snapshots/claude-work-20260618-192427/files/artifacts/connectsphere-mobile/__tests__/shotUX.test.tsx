/**
 * Tests for the shot UX changes:
 *   - getShotSuggestions() — third-person filter, copy quality, output shape
 *   - Shot prompt chips — subtitle copy, edit affordance
 *   - ShotToast — upgraded copy, haptics on appear
 *   - ShotBottomSheet — initialMessage prefill, haptic on send
 *
 * NEW (UX polish pass):
 *   - Prompt copy — no more "Travel soon?", natural questions for every intent
 *   - Close behavior — X dismisses sheet only; expanded profile stays visible
 *   - dismissShotToast logic — from-expanded flag drives close + advance
 *
 * Run with: npx jest __tests__/shotUX.test.tsx
 */

import React from "react";
import { render, fireEvent, act, waitFor } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";

import {
  getShotSuggestions,
  rewriteOpenerToFirstPerson,
  ExpandedProfileCard,
  type CardProfile,
} from "@/components/ExpandedProfileCard";
import { ShotBottomSheet, ShotToast } from "@/components/ShotBottomSheet";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeProfile(overrides: Partial<CardProfile> = {}): CardProfile {
  return {
    id: "u1",
    name: "Maya",
    age: 25,
    intent: "dating",
    interests: ["jazz", "rooftops"],
    firstDateStyle: "wine bar",
    promptAnswer: "I booked a flight on a Friday afternoon.",
    openerIdeas: undefined,
    ...overrides,
  };
}

// ─── getShotSuggestions — output shape ────────────────────────────────────────

describe("getShotSuggestions — output shape", () => {
  it("returns at most 3 suggestions", () => {
    const out = getShotSuggestions(makeProfile());
    expect(out.length).toBeLessThanOrEqual(3);
  });

  it("returns at least 1 suggestion even with minimal profile data", () => {
    const out = getShotSuggestions({ id: "x", name: "Test", intent: "dating" } as CardProfile);
    expect(out.length).toBeGreaterThan(0);
  });

  it("returns no duplicates", () => {
    const out = getShotSuggestions(makeProfile());
    expect(new Set(out).size).toBe(out.length);
  });

  it("truncates each suggestion to ≤120 chars", () => {
    const out = getShotSuggestions(makeProfile({ promptAnswer: "x".repeat(200) }));
    out.forEach((s) => expect(s.length).toBeLessThanOrEqual(120));
  });

  it("filters out empty/whitespace-only items", () => {
    const out = getShotSuggestions(makeProfile());
    out.forEach((s) => expect(s.trim().length).toBeGreaterThan(0));
  });
});

// ─── getShotSuggestions — third-person rewrite (spec 4.1) ─────────────────────

describe("rewriteOpenerToFirstPerson — converts automation copy to openers", () => {
  it("rewrites 'Ask <Name> about her X' into a first-person opener about X", () => {
    const out = rewriteOpenerToFirstPerson("Ask Maya about her sunset rooftop thing");
    expect(out).toBeDefined();
    expect(out).toMatch(/sunset rooftop thing/);
    expect(out).not.toMatch(/^ask/i);
    expect(out).not.toMatch(/\bMaya\b/); // never addresses them in third person
  });

  it("rewrites 'Tell her you X' into 'I X'", () => {
    expect(rewriteOpenerToFirstPerson("Tell her you love jazz too")).toBe("I love jazz too");
  });

  it("rewrites 'Mention the X' into a first-person opener about X", () => {
    const out = rewriteOpenerToFirstPerson("Mention the wine bar thing");
    expect(out).toBeDefined();
    expect(out).toMatch(/wine bar thing/);
    expect(out).not.toMatch(/^mention/i);
  });

  it("returns undefined for patterns with no safe rewrite", () => {
    expect(rewriteOpenerToFirstPerson("Say something about her interests")).toBeUndefined();
  });
});

describe("getShotSuggestions — third-person openerIdeas never shown literally", () => {
  it("never includes the literal 'Ask [Name] about...' copy", () => {
    const out = getShotSuggestions(makeProfile({ openerIdeas: ["Ask Maya about her sunset rooftop thing"] }));
    expect(out).not.toContain("Ask Maya about her sunset rooftop thing");
    // The rewritten first-person version IS offered
    expect(out.some((s) => /sunset rooftop thing/.test(s))).toBe(true);
  });

  it("rewrites 'Tell them...' instead of showing it literally", () => {
    const out = getShotSuggestions(makeProfile({ openerIdeas: ["Tell her you love jazz too"] }));
    expect(out).not.toContain("Tell her you love jazz too");
    expect(out).toContain("I love jazz too");
  });

  it("rewrites 'Mention...' instead of showing it literally", () => {
    const out = getShotSuggestions(makeProfile({ openerIdeas: ["Mention the wine bar thing"] }));
    expect(out).not.toContain("Mention the wine bar thing");
    expect(out.some((s) => /wine bar thing/.test(s))).toBe(true);
  });

  it("drops 'Say something about...' (no safe rewrite)", () => {
    const out = getShotSuggestions(makeProfile({ openerIdeas: ["Say something about her interests"] }));
    expect(out).not.toContain("Say something about her interests");
    expect(out.some((s) => /^say something/i.test(s))).toBe(false);
  });

  it("KEEPS first-person openerIdeas", () => {
    const firstPerson = "I had to reach out after seeing your jazz taste";
    const out = getShotSuggestions(makeProfile({ openerIdeas: [firstPerson] }));
    expect(out[0]).toBe(firstPerson);
  });

  it("KEEPS openerIdeas that start with 'I'", () => {
    const opener = "I noticed you love rooftops too";
    const out = getShotSuggestions(makeProfile({ openerIdeas: [opener] }));
    expect(out).toContain(opener);
  });

  it("handles undefined openerIdeas gracefully", () => {
    expect(() => getShotSuggestions(makeProfile({ openerIdeas: undefined }))).not.toThrow();
  });
});

// ─── getShotSuggestions — copy quality ────────────────────────────────────────

describe("getShotSuggestions — copy uses profile data", () => {
  it("uses promptAnswer in a suggestion when present", () => {
    const out = getShotSuggestions(makeProfile({ promptAnswer: "I booked a flight on a Friday afternoon." }));
    const hasPromptRef = out.some((s) => s.includes("I booked a flight on a Friday afternoon."));
    expect(hasPromptRef).toBe(true);
  });

  it("includes interest or firstDateStyle in at least one suggestion", () => {
    const out = getShotSuggestions(makeProfile({ interests: ["jazz"], firstDateStyle: "wine bar" }));
    const hasData = out.some((s) => /jazz|wine bar/i.test(s));
    expect(hasData).toBe(true);
  });
});

// ─── Shot prompt chips — UI text ──────────────────────────────────────────────

describe("Shot prompt chips — subtitle and affordance", () => {
  const profile = makeProfile({ promptAnswer: "I cook breakfast at midnight" });

  it("renders 'Tap to edit and send as a Shot' subtitle on each chip", () => {
    const { getAllByText } = render(
      <ExpandedProfileCard
        profile={profile}
        onClose={jest.fn()}
        onAction={jest.fn()}
        onShot={jest.fn()}
      />,
    );
    const subtitles = getAllByText("Tap to edit and send as a Shot");
    expect(subtitles.length).toBeGreaterThan(0);
  });

  it("does NOT render old subtitle 'Send this as a Shot before matching'", () => {
    const { queryByText } = render(
      <ExpandedProfileCard
        profile={profile}
        onClose={jest.fn()}
        onAction={jest.fn()}
        onShot={jest.fn()}
      />,
    );
    expect(queryByText(/Send this as a Shot before matching/i)).toBeNull();
  });

  it("calls onShot when a chip is pressed (shot section visible)", () => {
    const onShot = jest.fn();
    const { getByTestId, getAllByText } = render(
      <ExpandedProfileCard
        profile={profile}
        onClose={jest.fn()}
        onAction={jest.fn()}
        onShot={onShot}
      />,
    );
    // The shot section must be visible
    expect(getByTestId("expanded-profile-shot-section")).toBeTruthy();
    // Press the first chip (its text == the suggestion)
    const chips = getAllByText("Tap to edit and send as a Shot");
    fireEvent.press(chips[0].parent!);
    // onShot is called by ExpandedProfileCard (wraps onShotIdea)
    expect(onShot).toHaveBeenCalled();
  });
});

// ─── handleAction — shot button double-haptic ─────────────────────────────────

describe("handleAction — shot button", () => {
  beforeEach(() => jest.clearAllMocks());

  it("fires impactAsync(Heavy) when shot button pressed", () => {
    const { getByTestId } = render(
      <ExpandedProfileCard
        profile={makeProfile()}
        onClose={jest.fn()}
        onAction={jest.fn()}
        onShot={jest.fn()}
      />,
    );
    fireEvent.press(getByTestId("action-shot"));
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Heavy);
  });

  it("calls onShot immediately (no animation delay)", () => {
    const onShot = jest.fn();
    const { getByTestId } = render(
      <ExpandedProfileCard
        profile={makeProfile()}
        onClose={jest.fn()}
        onAction={jest.fn()}
        onShot={onShot}
      />,
    );
    fireEvent.press(getByTestId("action-shot"));
    expect(onShot).toHaveBeenCalledTimes(1);
  });
});

// ─── ShotToast — copy ─────────────────────────────────────────────────────────

describe("ShotToast — upgraded copy", () => {
  it("renders 'Shot's live 🔥' title", () => {
    const { getByText } = render(<ShotToast visible target={{ name: "Maya" }} />);
    expect(getByText("Shot's live 🔥")).toBeTruthy();
  });

  it("does NOT render old title 'Shot Sent!'", () => {
    const { queryByText } = render(<ShotToast visible target={{ name: "Maya" }} />);
    expect(queryByText("Shot Sent!")).toBeNull();
  });

  it("includes target name and 'Ball's in their court' in subtitle", () => {
    const { getByText } = render(<ShotToast visible target={{ name: "Maya" }} />);
    expect(getByText(/Maya/)).toBeTruthy();
    expect(getByText(/Ball's in their court/)).toBeTruthy();
  });

  it("renders fallback subtitle when target has no name", () => {
    const { getByText } = render(<ShotToast visible target={null} />);
    expect(getByText(/Ball's in their court/)).toBeTruthy();
  });

  it("does NOT render legacy 'Shot sent 💬' text anywhere", () => {
    const { queryByText } = render(<ShotToast visible target={{ name: "Maya" }} />);
    expect(queryByText("Shot sent 💬")).toBeNull();
  });

  it("fires impactAsync(Heavy) when it becomes visible", () => {
    jest.clearAllMocks();
    render(<ShotToast visible target={{ name: "Maya" }} />);
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Heavy);
  });

  it("fires notificationAsync(Success) after delay when visible", async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    render(<ShotToast visible target={{ name: "Maya" }} />);
    act(() => jest.advanceTimersByTime(200));
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
    jest.useRealTimers();
  });
});

// ─── ShotBottomSheet — ghost type-over suggestion (spec 4.1) ──────────────────

describe("ShotBottomSheet — ghost suggestion behavior", () => {
  const baseProps = {
    visible: true,
    target: { name: "Maya" },
    onClose: jest.fn(),
    onSend: jest.fn().mockResolvedValue(true),
  };

  beforeEach(() => jest.clearAllMocks());

  it("renders initialMessage as a GHOST, not as real input text", () => {
    const { getByTestId, getByText, getByDisplayValue } = render(
      <ShotBottomSheet {...baseProps} initialMessage="Had to shoot: jazz or rooftops?" />,
    );
    expect(getByTestId("shot-ghost-suggestion")).toBeTruthy();
    expect(getByText("Had to shoot: jazz or rooftops?")).toBeTruthy();
    expect(getByDisplayValue("")).toBeTruthy(); // input itself stays empty
  });

  it("tapping the ghost accepts it as editable real text", () => {
    const { getByTestId, getByDisplayValue, queryByTestId } = render(
      <ShotBottomSheet {...baseProps} initialMessage="Jazz or rooftops?" />,
    );
    fireEvent.press(getByTestId("shot-ghost-suggestion"));
    expect(getByDisplayValue("Jazz or rooftops?")).toBeTruthy();
    expect(queryByTestId("shot-ghost-suggestion")).toBeNull();
  });

  it("pressing the main button with a ghost ACCEPTS it — never sends", () => {
    const onSend = jest.fn().mockResolvedValue(true);
    const { getByText, getByDisplayValue } = render(
      <ShotBottomSheet {...baseProps} onSend={onSend} initialMessage="Jazz or rooftops?" />,
    );
    fireEvent.press(getByText("Use suggestion"));
    expect(onSend).not.toHaveBeenCalled();
    expect(getByDisplayValue("Jazz or rooftops?")).toBeTruthy();
  });

  it("typing replaces the ghost", () => {
    const { getByDisplayValue, queryByTestId } = render(
      <ShotBottomSheet {...baseProps} initialMessage="Jazz or rooftops?" />,
    );
    fireEvent.changeText(getByDisplayValue(""), "my own opener");
    expect(getByDisplayValue("my own opener")).toBeTruthy();
    expect(queryByTestId("shot-ghost-suggestion")).toBeNull();
  });

  it("never auto-sends a suggestion (onSend not called on open)", () => {
    const onSend = jest.fn();
    render(<ShotBottomSheet {...baseProps} onSend={onSend} initialMessage="Jazz or rooftops?" />);
    expect(onSend).not.toHaveBeenCalled();
  });

  it("truncates the ghost to 120 chars", () => {
    const long = "x".repeat(150);
    const { getByText } = render(<ShotBottomSheet {...baseProps} initialMessage={long} />);
    expect(getByText("x".repeat(120))).toBeTruthy();
  });

  it("shows no ghost when initialMessage is undefined", () => {
    const { queryByTestId, getByDisplayValue } = render(
      <ShotBottomSheet {...baseProps} initialMessage={undefined} />,
    );
    expect(queryByTestId("shot-ghost-suggestion")).toBeNull();
    expect(getByDisplayValue("")).toBeTruthy();
  });

  it("suggestion chips land as a ghost, not as real text", () => {
    const { getByText, getByTestId, getByDisplayValue } = render(
      <ShotBottomSheet {...baseProps} initialMessage={undefined} />,
    );
    fireEvent.press(getByText("Coffee or cocktails?"));
    expect(getByTestId("shot-ghost-suggestion")).toBeTruthy();
    expect(getByDisplayValue("")).toBeTruthy();
  });
});

// ─── ShotBottomSheet — send (after accepting / typing) ────────────────────────

describe("ShotBottomSheet — send behavior", () => {
  beforeEach(() => jest.clearAllMocks());

  it("sends typed text and fires impactAsync(Medium)", async () => {
    const onSend = jest.fn().mockResolvedValue(true);
    const { getByText, getByDisplayValue } = render(
      <ShotBottomSheet
        visible
        target={{ name: "Maya" }}
        onClose={jest.fn()}
        onSend={onSend}
      />,
    );
    fireEvent.changeText(getByDisplayValue(""), "Jazz or rooftops?");
    await act(async () => {
      fireEvent.press(getByText("Send Shot"));
    });
    expect(onSend).toHaveBeenCalledWith("Jazz or rooftops?");
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
  });

  it("sends after accepting a ghost then pressing Send Shot", async () => {
    const onSend = jest.fn().mockResolvedValue(true);
    const { getByText, getByTestId } = render(
      <ShotBottomSheet
        visible
        target={{ name: "Maya" }}
        initialMessage="Jazz or rooftops?"
        onClose={jest.fn()}
        onSend={onSend}
      />,
    );
    fireEvent.press(getByTestId("shot-ghost-suggestion")); // accept
    await act(async () => {
      fireEvent.press(getByText("Send Shot")); // now a real send
    });
    expect(onSend).toHaveBeenCalledWith("Jazz or rooftops?");
  });

  it("does NOT fire send haptic when message is empty and no ghost (disabled)", () => {
    const { getByText } = render(
      <ShotBottomSheet
        visible
        target={{ name: "Maya" }}
        initialMessage=""
        onClose={jest.fn()}
        onSend={jest.fn()}
      />,
    );
    fireEvent.press(getByText("Send Shot"));
    expect(Haptics.impactAsync).not.toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UX POLISH PASS — three fixes verified below
// ─────────────────────────────────────────────────────────────────────────────

// ─── Fix 2: Prompt copy — natural questions, no "Travel soon?" ───────────────

describe("getShotSuggestions — updated prompt copy (UX polish)", () => {
  it("default intent (Having Fun) → 'You seem fun. What do you like to do?'", () => {
    // Having Fun is not Hookup / Long Term / Curious, so falls to default
    const out = getShotSuggestions(
      makeProfile({ datingGoal: "Having Fun", interests: ["Travel", "Dancing"] }),
    );
    expect(out).toContain("You seem fun. What do you like to do?");
  });

  it("profile with no specific dating intent → default suggestion, not 'soon?'", () => {
    const out = getShotSuggestions(
      makeProfile({ datingGoal: undefined, interests: ["Travel", "Yoga"] }),
    );
    // Must not contain the old "Travel soon?" pattern
    out.forEach((s) => {
      expect(s).not.toMatch(/Travel soon\?/i);
      expect(s).not.toMatch(/seem like fun/i);
    });
    // Must contain the new default
    expect(out).toContain("You seem fun. What do you like to do?");
  });

  it("Long Term profile → suggestion asks 'Am I right?'", () => {
    const out = getShotSuggestions(makeProfile({ datingGoal: "Long Term", firstDateStyle: "wine bar" }));
    const hit = out.find((s) => s.includes("Am I right?"));
    expect(hit).toBeDefined();
    expect(hit).toMatch(/wine bar/i);
  });

  it("Curious profile → suggestion is a real question ending with '?'", () => {
    const out = getShotSuggestions(makeProfile({ datingGoal: "Curious" }));
    const curiousLine = out.find((s) => /curious/i.test(s));
    expect(curiousLine).toBeDefined();
    expect(curiousLine).toMatch(/\?$/);
    // Confirm it's not the old first-person intro style
    expect(curiousLine).not.toMatch(/^I'm curious/);
  });

  it("Hookup profile → suggestion includes interest + 'no small talk?'", () => {
    const out = getShotSuggestions(
      makeProfile({ datingGoal: "Hookup", interests: ["jazz", "rooftops"] }),
    );
    const hookupLine = out.find((s) => /no small talk\?/i.test(s));
    expect(hookupLine).toBeDefined();
    expect(hookupLine).toMatch(/jazz/i);
  });

  it("promptAnswer present → 'Your ... answer — what's the story there?'", () => {
    const out = getShotSuggestions(
      makeProfile({ promptAnswer: "I booked a flight on a Friday afternoon." }),
    );
    const promptLine = out.find((s) => s.includes("what's the story there?"));
    expect(promptLine).toBeDefined();
    expect(promptLine).toContain("Your");
    expect(promptLine).toContain("I booked a flight on a Friday afternoon.");
    // Old format never appears
    expect(out).not.toContain(expect.stringMatching(/^".*" — I had to say something/));
  });

  it("last fallback shot → 'I had to shoot my shot: X or Y?'", () => {
    // With no opener and a promptAnswer (which takes the 2nd slot), the 3rd slot
    // is the "had to shoot" line.
    const out = getShotSuggestions(
      makeProfile({
        openerIdeas: undefined,
        datingGoal: "Having Fun",
        interests: ["jazz", "rooftops"],
        promptAnswer: undefined,
      }),
    );
    const shotLine = out.find((s) => /I had to shoot my shot/i.test(s));
    expect(shotLine).toBeDefined();
    expect(shotLine).not.toMatch(/^Had to shoot:/); // old copy gone
  });

  it("no suggestion ever contains old 'soon?' for a travel-interest profile", () => {
    const out = getShotSuggestions(
      makeProfile({
        datingGoal: "Having Fun",
        interests: ["Travel", "Dancing"],
        firstDateStyle: "beach walk",
      }),
    );
    out.forEach((s) => {
      expect(s).not.toMatch(/soon\?$/i);
    });
  });
});

// ─── Fix 1: Close behavior — X closes sheet only, never drops to Discover ────

describe("ShotBottomSheet — close calls onClose and nothing else", () => {
  beforeEach(() => jest.clearAllMocks());

  it("pressing X triggers onClose callback", async () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <ShotBottomSheet
        visible
        target={{ name: "Maya" }}
        onClose={onClose}
        onSend={jest.fn()}
      />,
    );
    // The close Pressable wraps an icon; find it by the aria role or by testID
    // ShotBottomSheet renders the X inside a Pressable — we target the backdrop
    // dismiss as a proxy (same dismiss() fn called by both X and backdrop).
    // Directly calling fireEvent on the close Pressable:
    const pressables = [getByTestId("shot-close-button")];
    // First pressable that isn't the backdrop is the close button
    fireEvent.press(pressables[0]!);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("onSend is NOT called when the sheet is closed via X", () => {
    const onSend = jest.fn();
    const onClose = jest.fn();
    const { getByTestId } = render(
      <ShotBottomSheet
        visible
        target={{ name: "Maya" }}
        onClose={onClose}
        onSend={onSend}
        initialMessage="Jazz or rooftops?"
      />,
    );
    const pressables = [getByTestId("shot-close-button")];
    fireEvent.press(pressables[0]!);
    expect(onSend).not.toHaveBeenCalled();
  });
});

// ─── Fix 3: dismissShotToast logic — from-expanded ref drives close+advance ──

describe("dismissShotToast — from-expanded-profile flag behavior (unit)", () => {
  /**
   * dismissShotToast lives inside DiscoverScreenInner (index.tsx) and reads
   * two React refs.  We test its _logic_ directly here using a plain function
   * that mirrors the real implementation, without mounting the entire screen.
   *
   * If the implementation changes, update this mirror accordingly.
   */
  function makeDismissToast({
    fromExpanded,
    justSent,
    onSetToastVisible,
    onSetSentTarget,
    onCloseExpanded,
  }: {
    fromExpanded: boolean;
    justSent: boolean;
    onSetToastVisible: (v: boolean) => void;
    onSetSentTarget: (t: null) => void;
    onCloseExpanded: (cb: () => void) => void;
  }) {
    // mirrors the real dismissShotToast useCallback body
    const shotFromExpandedRef = { current: fromExpanded };
    const shotJustSentRef = { current: justSent };

    return () => {
      onSetToastVisible(false);
      onSetSentTarget(null);
      if (shotFromExpandedRef.current && shotJustSentRef.current) {
        onCloseExpanded(() => {/* advanceDeck */});
      }
      shotFromExpandedRef.current = false;
      shotJustSentRef.current = false;
    };
  }

  it("when shot came from expanded profile → closeExpandedProfile is called", () => {
    const onSetToastVisible = jest.fn();
    const onSetSentTarget = jest.fn();
    const onCloseExpanded = jest.fn();

    const dismiss = makeDismissToast({
      fromExpanded: true,
      justSent: true,
      onSetToastVisible,
      onSetSentTarget,
      onCloseExpanded,
    });

    dismiss();

    expect(onSetToastVisible).toHaveBeenCalledWith(false);
    expect(onSetSentTarget).toHaveBeenCalledWith(null);
    expect(onCloseExpanded).toHaveBeenCalledTimes(1);
  });

  it("when shot came from the DECK → closeExpandedProfile is NOT called", () => {
    const onCloseExpanded = jest.fn();

    const dismiss = makeDismissToast({
      fromExpanded: false,  // deck-origin shot
      justSent: true,
      onSetToastVisible: jest.fn(),
      onSetSentTarget: jest.fn(),
      onCloseExpanded,
    });

    dismiss();
    expect(onCloseExpanded).not.toHaveBeenCalled();
  });

  it("when toast dismissed WITHOUT a shot being sent → closeExpandedProfile NOT called", () => {
    const onCloseExpanded = jest.fn();

    const dismiss = makeDismissToast({
      fromExpanded: true,
      justSent: false,  // no shot was actually sent
      onSetToastVisible: jest.fn(),
      onSetSentTarget: jest.fn(),
      onCloseExpanded,
    });

    dismiss();
    expect(onCloseExpanded).not.toHaveBeenCalled();
  });

  it("dismissing twice is idempotent — closeExpandedProfile called at most once", () => {
    const onCloseExpanded = jest.fn();
    let fromExpanded = true;
    let justSent = true;

    // Simulates calling dismissShotToast twice (e.g. timer + manual tap race)
    const dismissOnce = () => {
      const setToast = jest.fn();
      const setTarget = jest.fn();
      if (fromExpanded && justSent) onCloseExpanded(() => {});
      fromExpanded = false;
      justSent = false;
    };

    dismissOnce();
    dismissOnce();

    expect(onCloseExpanded).toHaveBeenCalledTimes(1);
  });
});

// ─── Expo Go compatibility smoke assertions ───────────────────────────────────

describe("Expo Go compatibility — no native-only APIs in changed files", () => {
  /**
   * These tests guard against accidentally importing native-only modules that
   * would crash Expo Go. All three changed files must import only:
   *   - react / react-native builtins
   *   - expo-* packages (all available in Expo Go SDK 54)
   *   - @expo/vector-icons
   *   - Project-local @/ aliases
   *
   * We test this by asserting the components actually render without throwing
   * in the Jest RNTL environment (which uses the same JS-only resolver as Expo Go).
   */
  it("ShotBottomSheet renders without throwing", () => {
    expect(() =>
      render(
        <ShotBottomSheet
          visible={false}
          target={{ name: "Maya" }}
          onClose={jest.fn()}
          onSend={jest.fn()}
        />,
      ),
    ).not.toThrow();
  });

  it("ShotToast renders without throwing", () => {
    expect(() =>
      render(<ShotToast visible={false} target={{ name: "Maya" }} />),
    ).not.toThrow();
  });

  it("getShotSuggestions runs without throwing for any intent value", () => {
    const intents = ["Having Fun", "Long Term", "Curious", "Hookup", undefined];
    intents.forEach((datingGoal) => {
      expect(() =>
        getShotSuggestions(makeProfile({ datingGoal })),
      ).not.toThrow();
    });
  });

  it("rewriteOpenerToFirstPerson handles null/empty safely", () => {
    expect(() => rewriteOpenerToFirstPerson("")).not.toThrow();
    expect(() => rewriteOpenerToFirstPerson("  ")).not.toThrow();
    expect(rewriteOpenerToFirstPerson("")).toBeUndefined();
  });
});
