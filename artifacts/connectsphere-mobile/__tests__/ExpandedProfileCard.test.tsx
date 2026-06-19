/**
 * Tests for ExpandedProfileCard — unified profile card used in
 * both Discover (swipe) and Match (chat) contexts.
 *
 * Run with: npx jest __tests__/ExpandedProfileCard.test.tsx
 */

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { ExpandedProfileCard, type CardProfile } from "@/components/ExpandedProfileCard";
import type { DatingProfileSnapshot } from "@/contexts/DatingMatchContext";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Minimal CardProfile for dating tests */
function makeDatingProfile(overrides: Partial<CardProfile> = {}): CardProfile {
  return {
    id: "user-1",
    name: "Aaliyah",
    age: 26,
    location: "Miami, FL",
    intent: "dating",
    photos: ["https://example.com/photo1.jpg", "https://example.com/photo2.jpg"],
    interests: ["hiking", "coffee", "art"],
    datingGoal: "Long-term relationship",
    firstDateStyle: "Coffee first",
    dateIdeas: ["Wynwood Art Walk", "Brickell City Centre"],
    prompt: "The most spontaneous thing I've done",
    promptAnswer: "Booked a flight to NYC on a Friday afternoon.",
    openerIdeas: ["Ask about her favourite spot in Wynwood", "Coffee or cocktails for a first date?"],
    likedCurrentUser: false,
    ...overrides,
  };
}

/** Minimal CardProfile for friends tests */
function makeFriendProfile(overrides: Partial<CardProfile> = {}): CardProfile {
  return {
    id: "user-2",
    name: "Jordan",
    age: 28,
    intent: "friendship",
    photos: ["https://example.com/jordan.jpg"],
    interests: ["travel", "live events"],
    ...overrides,
  };
}

/** toCardProfile adapter — mirrors the one in MatchProfileSheet */
function toCardProfile(p: DatingProfileSnapshot): CardProfile {
  return {
    id: p.id,
    name: p.name,
    age: p.age ?? undefined,
    location: p.location ?? undefined,
    intent: p.intent ?? "dating",
    photos: p.photos?.length ? p.photos : undefined,
    interests: p.interests ?? undefined,
    datingGoal: p.datingGoal ?? undefined,
    firstDateStyle: p.firstDateStyle ?? undefined,
    dateIdeas: p.dateIdeas ?? undefined,
    prompt: p.prompt ?? undefined,
    promptAnswer: p.promptAnswer ?? undefined,
    openerIdeas: p.openerIdeas ?? undefined,
    likedCurrentUser: p.likedCurrentUser,
  };
}

// ─── toCardProfile adapter ───────────────────────────────────────────────────

describe("toCardProfile adapter", () => {
  const snapshot: DatingProfileSnapshot = {
    id: "snap-1",
    name: "Maya",
    age: 24,
    location: "Brickell",
    intent: "dating",
    photos: ["https://example.com/maya.jpg"],
    interests: ["yoga", "brunch"],
    datingGoal: "Casual dating",
    firstDateStyle: "Drinks",
    dateIdeas: ["Rooftop bar"],
    prompt: "Two truths and a lie",
    promptAnswer: "I've never eaten pizza, I speak 3 languages, I skydived once.",
    openerIdeas: ["Ask about the 3 languages"],
    likedCurrentUser: true,
  };

  it("maps id and name", () => {
    const card = toCardProfile(snapshot);
    expect(card.id).toBe("snap-1");
    expect(card.name).toBe("Maya");
  });

  it("maps age and location", () => {
    const card = toCardProfile(snapshot);
    expect(card.age).toBe(24);
    expect(card.location).toBe("Brickell");
  });

  it("maps photos array", () => {
    const card = toCardProfile(snapshot);
    expect(card.photos).toEqual(["https://example.com/maya.jpg"]);
  });

  it("maps interests", () => {
    const card = toCardProfile(snapshot);
    expect(card.interests).toEqual(["yoga", "brunch"]);
  });

  it("maps dating-specific fields", () => {
    const card = toCardProfile(snapshot);
    expect(card.datingGoal).toBe("Casual dating");
    expect(card.firstDateStyle).toBe("Drinks");
    expect(card.dateIdeas).toEqual(["Rooftop bar"]);
    expect(card.prompt).toBe("Two truths and a lie");
    expect(card.promptAnswer).toBe("I've never eaten pizza, I speak 3 languages, I skydived once.");
    expect(card.openerIdeas).toEqual(["Ask about the 3 languages"]);
  });

  it("maps likedCurrentUser", () => {
    const card = toCardProfile(snapshot);
    expect(card.likedCurrentUser).toBe(true);
  });

  it("converts null age to undefined", () => {
    const card = toCardProfile({ ...snapshot, age: null });
    expect(card.age).toBeUndefined();
  });

  it("converts null location to undefined", () => {
    const card = toCardProfile({ ...snapshot, location: null });
    expect(card.location).toBeUndefined();
  });

  it("uses empty photos array → undefined", () => {
    const card = toCardProfile({ ...snapshot, photos: [] });
    expect(card.photos).toBeUndefined();
  });

  it("defaults intent to 'dating' when null", () => {
    const card = toCardProfile({ ...snapshot, intent: undefined as any });
    expect(card.intent).toBe("dating");
  });
});

// ─── matchMode — hides shot/swipe actions ───────────────────────────────────

describe("ExpandedProfileCard — matchMode=true", () => {
  const profile = makeDatingProfile();
  const onClose = jest.fn();
  const onMessage = jest.fn();

  it("renders Message CTA button", () => {
    const { getByTestId } = render(
      <ExpandedProfileCard
        profile={profile}
        matchMode
        onClose={onClose}
        onMessage={onMessage}
      />,
    );
    expect(getByTestId("expanded-profile-message-cta")).toBeTruthy();
  });

  it("does NOT render the shot/swipe action bar", () => {
    const { queryByTestId } = render(
      <ExpandedProfileCard
        profile={profile}
        matchMode
        onClose={onClose}
        onMessage={onMessage}
      />,
    );
    // BigActionsBar uses testID="expanded-profile-actions-bar"
    expect(queryByTestId("expanded-profile-actions-bar")).toBeNull();
  });

  it("does NOT render Shoot Your Shot section", () => {
    const { queryByTestId } = render(
      <ExpandedProfileCard
        profile={profile}
        matchMode
        onClose={onClose}
        onMessage={onMessage}
      />,
    );
    expect(queryByTestId("expanded-profile-shot-section")).toBeNull();
  });

  it("fires onMessage when Message CTA is pressed", () => {
    const { getByTestId } = render(
      <ExpandedProfileCard
        profile={profile}
        matchMode
        onClose={onClose}
        onMessage={onMessage}
      />,
    );
    fireEvent.press(getByTestId("expanded-profile-message-cta"));
    expect(onMessage).toHaveBeenCalledTimes(1);
  });

  it("Message CTA label includes first name", () => {
    const { getByText } = render(
      <ExpandedProfileCard
        profile={profile}
        matchMode
        onClose={onClose}
        onMessage={onMessage}
      />,
    );
    // profile.name = "Aaliyah" → "Message Aaliyah"
    expect(getByText(/Message Aaliyah/i)).toBeTruthy();
  });

  it("fires onClose when close button pressed", () => {
    const { getByTestId } = render(
      <ExpandedProfileCard
        profile={profile}
        matchMode
        onClose={onClose}
        onMessage={onMessage}
      />,
    );
    fireEvent.press(getByTestId("expanded-profile-close-btn"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ─── matchMode — profile data renders correctly ──────────────────────────────

describe("ExpandedProfileCard — matchMode profile data", () => {
  const profile = makeDatingProfile();

  it("renders name and age", () => {
    const { getByText } = render(
      <ExpandedProfileCard profile={profile} matchMode onClose={jest.fn()} />,
    );
    expect(getByText(/Aaliyah/)).toBeTruthy();
    expect(getByText(/26/)).toBeTruthy();
  });

  it("renders location", () => {
    const { getByText } = render(
      <ExpandedProfileCard profile={profile} matchMode onClose={jest.fn()} />,
    );
    expect(getByText(/Miami/i)).toBeTruthy();
  });

  it("renders interests", () => {
    const { getByText } = render(
      <ExpandedProfileCard profile={profile} matchMode onClose={jest.fn()} />,
    );
    expect(getByText(/hiking/i)).toBeTruthy();
    expect(getByText(/coffee/i)).toBeTruthy();
    expect(getByText(/art/i)).toBeTruthy();
  });

  it("renders prompt and answer", () => {
    const { getByText } = render(
      <ExpandedProfileCard profile={profile} matchMode onClose={jest.fn()} />,
    );
    expect(getByText(/most spontaneous/i)).toBeTruthy();
    expect(getByText(/Booked a flight/i)).toBeTruthy();
  });

  it("renders dating goal", () => {
    const { getByText } = render(
      <ExpandedProfileCard profile={profile} matchMode onClose={jest.fn()} />,
    );
    expect(getByText(/Long-term relationship/i)).toBeTruthy();
  });
});

// ─── discover mode — actions bar present ─────────────────────────────────────

describe("ExpandedProfileCard — discover mode (matchMode=false)", () => {
  const profile = makeDatingProfile();

  it("renders the action bar", () => {
    const onAction = jest.fn();
    const { getByTestId } = render(
      <ExpandedProfileCard
        profile={profile}
        onClose={jest.fn()}
        onAction={onAction}
        onShot={jest.fn()}
      />,
    );
    expect(getByTestId("expanded-profile-actions-bar")).toBeTruthy();
  });

  it("does NOT render Message CTA", () => {
    const { queryByTestId } = render(
      <ExpandedProfileCard
        profile={profile}
        onClose={jest.fn()}
        onAction={jest.fn()}
        onShot={jest.fn()}
      />,
    );
    expect(queryByTestId("expanded-profile-message-cta")).toBeNull();
  });

  it("calls onAction with 'pass' when pass button pressed", () => {
    const onAction = jest.fn().mockResolvedValue(true);
    const { getByTestId } = render(
      <ExpandedProfileCard
        profile={profile}
        onClose={jest.fn()}
        onAction={onAction}
        onShot={jest.fn()}
      />,
    );
    fireEvent.press(getByTestId("action-pass"));
    expect(onAction).toHaveBeenCalledWith("pass");
  });

  it("calls onAction with 'vibe' when like button pressed (dating)", () => {
    const onAction = jest.fn().mockResolvedValue(true);
    const { getByTestId } = render(
      <ExpandedProfileCard
        profile={profile}
        onClose={jest.fn()}
        onAction={onAction}
        onShot={jest.fn()}
      />,
    );
    fireEvent.press(getByTestId("action-vibe"));
    expect(onAction).toHaveBeenCalledWith("vibe");
  });

  it("calls onShot when shot button pressed", () => {
    const onShot = jest.fn();
    const { getByTestId } = render(
      <ExpandedProfileCard
        profile={profile}
        onClose={jest.fn()}
        onAction={jest.fn().mockResolvedValue(true)}
        onShot={onShot}
      />,
    );
    fireEvent.press(getByTestId("action-shot"));
    expect(onShot).toHaveBeenCalled();
  });
});

// ─── friends intent — action bar ─────────────────────────────────────────────

describe("ExpandedProfileCard — friends intent", () => {
  const profile = makeFriendProfile();

  it("renders the action bar", () => {
    const { getByTestId } = render(
      <ExpandedProfileCard
        profile={profile}
        onClose={jest.fn()}
        onAction={jest.fn().mockResolvedValue(true)}
      />,
    );
    expect(getByTestId("expanded-profile-actions-bar")).toBeTruthy();
  });

  it("does NOT render shot action (friends mode)", () => {
    const { queryByTestId } = render(
      <ExpandedProfileCard
        profile={profile}
        onClose={jest.fn()}
        onAction={jest.fn().mockResolvedValue(true)}
      />,
    );
    expect(queryByTestId("action-shot")).toBeNull();
  });

  it("calls onAction with 'best_friend' when besties pressed", () => {
    const onAction = jest.fn().mockResolvedValue(true);
    const { getByTestId } = render(
      <ExpandedProfileCard
        profile={profile}
        onClose={jest.fn()}
        onAction={onAction}
      />,
    );
    fireEvent.press(getByTestId("action-best_friend"));
    expect(onAction).toHaveBeenCalledWith("best_friend");
  });
});
