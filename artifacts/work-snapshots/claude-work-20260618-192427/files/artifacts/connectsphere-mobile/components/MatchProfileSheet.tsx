/**
 * MatchProfileSheet
 *
 * Shows a match's full profile using the same ExpandedProfileCard used in
 * the Discover tab — photo carousel, intent card, date signals, interests,
 * prompt answer — everything, minus swipe actions and "Shoot your shot"
 * (they're already matched).
 *
 * The sheet slides up full-screen and dismisses with the same spring-out
 * animation. The only CTA at the bottom is "Message <name>" which closes
 * the sheet and calls onMessage (optional; defaults to just closing).
 *
 * Usage:
 *   <MatchProfileSheet
 *     visible={showProfile}
 *     profile={match.profile}          // DatingProfileSnapshot
 *     onClose={() => setShowProfile(false)}
 *     onMessage={() => inputRef.current?.focus()}
 *   />
 */
import { Modal } from "react-native";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from "react-native-reanimated";
import { useState } from "react";

import { ExpandedProfileCard, type CardProfile } from "@/components/ExpandedProfileCard";
import type { DatingProfileSnapshot } from "@/contexts/DatingMatchContext";

type Props = {
  visible: boolean;
  profile: DatingProfileSnapshot;
  onClose: () => void;
  /** Optional: called after the sheet closes when user taps "Message". */
  onMessage?: () => void;
};

/** Map the leaner DatingProfileSnapshot onto CardProfile so ExpandedProfileCard
 *  can render without caring about the source. */
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

export function MatchProfileSheet({ visible, profile, onClose, onMessage }: Props) {
  const [isVisible, setIsVisible] = useState(visible);

  // Keep the Modal mounted a beat after visible flips to false so the exit
  // animation has time to play before the Modal unmounts.
  const handleAnimatedClose = () => {
    setIsVisible(false);
    // SlideOutDown takes ~280ms; give it room then call the parent callback.
    setTimeout(onClose, 320);
  };

  // Sync internal visibility when the parent re-opens the sheet.
  if (visible && !isVisible) setIsVisible(true);

  const cardProfile = toCardProfile(profile);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleAnimatedClose}
    >
      <Animated.View
        entering={FadeIn.duration(160)}
        exiting={FadeOut.duration(140)}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.65)" }}
      >
        <Animated.View
          entering={SlideInDown.springify().damping(22).stiffness(240)}
          exiting={SlideOutDown.duration(280)}
          style={{ flex: 1, marginTop: 36, borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: "hidden" }}
        >
          <ExpandedProfileCard
            profile={cardProfile}
            matchMode
            onClose={handleAnimatedClose}
            onMessage={() => {
              handleAnimatedClose();
              // Slight delay so the sheet has started dismissing before the
              // keyboard / composer gets focus.
              setTimeout(() => onMessage?.(), 80);
            }}
          />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
