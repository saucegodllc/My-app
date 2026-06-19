import { createContext, useContext, type ReactNode } from "react";
import { useVideoPlayer, type VideoPlayer } from "expo-video";

const videoSource = require("@/assets/videos/champagne_cheers_welcome.mp4");

const CongratsVideoContext = createContext<VideoPlayer | null>(null);

export function CongratsVideoProvider({ children }: { children: ReactNode }) {
  const player = useVideoPlayer(videoSource, (p) => {
    p.loop = false;
    p.muted = true;
    p.pause();
  });

  return (
    <CongratsVideoContext.Provider value={player}>
      {children}
    </CongratsVideoContext.Provider>
  );
}

export function useCongratsVideoPlayer(): VideoPlayer | null {
  return useContext(CongratsVideoContext);
}

/** Call this right before navigating to /congrats so the video is already playing on arrival. */
export function usePrimeCongratsVideo(): () => void {
  const player = useContext(CongratsVideoContext);
  return () => {
    if (!player) return;
    player.currentTime = 0;
    player.muted = true;
    player.play();
  };
}
