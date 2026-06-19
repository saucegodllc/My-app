import { getRewindDecision, getRewindPillState, shouldShowRewindPill } from "../lib/discoverRewind";

const profile = { id: 42, userId: "user_target" };

describe("getRewindDecision", () => {
  it("routes free users to the rewind paywall", () => {
    expect(getRewindDecision({
      isPremium: false,
      lastSwipe: { profile, action: "pass", index: 2 },
      currentUserId: "user_me",
    })).toEqual({ type: "paywall", feature: "rewind" });
  });

  it("no-ops for premium users with no previous swipe", () => {
    expect(getRewindDecision({
      isPremium: true,
      lastSwipe: null,
      currentUserId: "user_me",
    })).toEqual({ type: "noop" });
  });

  it("restores a passed profile and card index", () => {
    expect(getRewindDecision({
      isPremium: true,
      lastSwipe: { profile, action: "pass", index: 3 },
      currentUserId: "user_me",
    })).toEqual({
      type: "rewind",
      cardIndex: 3,
      restorePassedProfileId: 42,
      refundSwipe: false,
    });
  });

  it("withdraws a like reaction for rewound vibe actions", () => {
    expect(getRewindDecision({
      isPremium: true,
      lastSwipe: { profile, action: "vibe", index: 1 },
      currentUserId: "user_me",
    })).toEqual({
      type: "rewind",
      cardIndex: 1,
      withdrawReaction: { receiverId: "user_target", type: "like" },
      refundSwipe: false,
    });
  });

  it("withdraws a spark reaction for rewound spark actions", () => {
    expect(getRewindDecision({
      isPremium: true,
      lastSwipe: { profile: { id: "fallback-id" }, action: "spark", index: 4 },
      currentUserId: "user_me",
    })).toEqual({
      type: "rewind",
      cardIndex: 4,
      withdrawReaction: { receiverId: "fallback-id", type: "spark" },
      refundSwipe: false,
    });
  });

  it("does not withdraw when the current user is unavailable", () => {
    expect(getRewindDecision({
      isPremium: true,
      lastSwipe: { profile, action: "vibe", index: 1 },
      currentUserId: null,
    })).toEqual({
      type: "rewind",
      cardIndex: 1,
      withdrawReaction: undefined,
      refundSwipe: false,
    });
  });
});

describe("Rewind utility pill presentation", () => {
  it("shows the rewind pill in both dating and friends modes", () => {
    expect(shouldShowRewindPill("dating")).toBe(true);
    expect(shouldShowRewindPill("friends")).toBe(true);
  });

  it("uses a locked but tappable state for free users", () => {
    expect(getRewindPillState({ isPremium: false, canRewind: false })).toEqual({
      label: "Rewind",
      icon: "lock-closed",
      tone: "locked",
      disabled: false,
    });
  });

  it("uses a quiet disabled state for premium users with nothing to rewind", () => {
    expect(getRewindPillState({ isPremium: true, canRewind: false })).toEqual({
      label: "Rewind",
      icon: "return-up-back",
      tone: "disabled",
      disabled: true,
    });
  });

  it("uses an active state when premium users can rewind", () => {
    expect(getRewindPillState({ isPremium: true, canRewind: true })).toEqual({
      label: "Rewind",
      icon: "return-up-back",
      tone: "active",
      disabled: false,
    });
  });
});
