import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useVideoPlayer, type VideoPlayer } from "expo-video";

const videoSource = require("@/assets/videos/champagne_cheers_welcome.mp4");

// Hardcoded — player.duration becomes Infinity with loop=true
export const SUCCESS_CLIP_S = 8;

interface SuccessVideoContextValue {
  playerA: VideoPlayer;
  playerB: VideoPlayer;
}

const SuccessVideoContext = createContext<SuccessVideoContextValue | null>(null);

/**
 * Pre-warms both video players at app root so the decoders are fully loaded
 * by the time the success screen appears. Both players run silently in the
 * background during onboarding — no cold-start latency on the success screen.
 */
export function SuccessVideoProvider({ children }: { children: ReactNode }) {
  const playerA = useVideoPlayer(videoSource, (p) => {
    p.muted = true;
    p.loop  = true;
  });

  const playerB = useVideoPlayer(videoSource, (p) => {
    p.muted = true;
    p.loop  = true;
  });

  // Start both players immediately so decoders are warm before success screen appears.
  // They play silently in the background; VideoViews are only rendered in success.tsx.
  useEffect(() => {
    playerA.play();
    playerB.play();
  }, []);

  return (
    <SuccessVideoContext.Provider value={{ playerA, playerB }}>
      {children}
    </SuccessVideoContext.Provider>
  );
}

export function useSuccessVideoPlayers(): SuccessVideoContextValue | null {
  return useContext(SuccessVideoContext);
}
