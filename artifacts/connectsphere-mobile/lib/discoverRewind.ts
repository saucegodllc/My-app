type RewindSwipeAction = "vibe" | "spark" | "pass";
type RewindIntent = "dating" | "friends";

export type LastSwipeSnapshot<TProfile = { id: string | number; userId?: string | null }> = {
  profile: TProfile;
  action: RewindSwipeAction;
  index: number;
};

export type RewindDecision =
  | { type: "paywall"; feature: "rewind" }
  | { type: "noop" }
  | {
      type: "rewind";
      cardIndex: number;
      restorePassedProfileId?: string | number;
      withdrawReaction?: {
        receiverId: string;
        type: "like" | "spark";
      };
      refundSwipe: boolean;
    };

export type RewindPillState = {
  label: "Rewind";
  icon: "lock-closed" | "return-up-back";
  tone: "locked" | "disabled" | "active";
  disabled: boolean;
};

export function shouldShowRewindPill(intent: RewindIntent): boolean {
  return intent === "dating" || intent === "friends";
}

export function getRewindPillState({
  isPremium,
  canRewind,
}: {
  isPremium: boolean;
  canRewind: boolean;
}): RewindPillState {
  if (!isPremium) {
    return {
      label: "Rewind",
      icon: "lock-closed",
      tone: "locked",
      disabled: false,
    };
  }
  if (!canRewind) {
    return {
      label: "Rewind",
      icon: "return-up-back",
      tone: "disabled",
      disabled: true,
    };
  }
  return {
    label: "Rewind",
    icon: "return-up-back",
    tone: "active",
    disabled: false,
  };
}

export function getRewindDecision<TProfile extends { id: string | number; userId?: string | null }>({
  isPremium,
  lastSwipe,
  currentUserId,
}: {
  isPremium: boolean;
  lastSwipe: LastSwipeSnapshot<TProfile> | null;
  currentUserId?: string | null;
}): RewindDecision {
  if (!isPremium) return { type: "paywall", feature: "rewind" };
  if (!lastSwipe) return { type: "noop" };

  if (lastSwipe.action === "pass") {
    return {
      type: "rewind",
      cardIndex: lastSwipe.index,
      restorePassedProfileId: lastSwipe.profile.id,
      refundSwipe: false,
    };
  }

  const receiverId = lastSwipe.profile.userId ?? String(lastSwipe.profile.id);
  return {
    type: "rewind",
    cardIndex: lastSwipe.index,
    withdrawReaction: currentUserId
      ? {
          receiverId,
          type: lastSwipe.action === "spark" ? "spark" : "like",
        }
      : undefined,
    refundSwipe: !isPremium,
  };
}
