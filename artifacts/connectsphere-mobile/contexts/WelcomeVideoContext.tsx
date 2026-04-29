import { createContext, useContext, type ReactNode } from "react";
import { useVideoPlayer, type VideoPlayer } from "expo-video";

const welcomeVideoSource = require("@/assets/videos/welcome-loop.mp4");

const WelcomeVideoContext = createContext<VideoPlayer | null>(null);

export function WelcomeVideoProvider({ children }: { children: ReactNode }) {
  const player = useVideoPlayer(welcomeVideoSource, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <WelcomeVideoContext.Provider value={player}>
      {children}
    </WelcomeVideoContext.Provider>
  );
}

export function useWelcomeVideoPlayer(): VideoPlayer | null {
  return useContext(WelcomeVideoContext);
}
