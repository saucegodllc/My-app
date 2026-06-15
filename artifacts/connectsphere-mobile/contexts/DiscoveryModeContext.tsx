import { createContext, useContext, useState, type ReactNode } from "react";

export type DiscoveryMode = "dating" | "friendship";

type DiscoveryModeContextValue = {
  mode: DiscoveryMode;
  setMode: (mode: DiscoveryMode) => void;
};

const DiscoveryModeContext = createContext<DiscoveryModeContextValue>({
  mode: "dating",
  setMode: () => {},
});

export function DiscoveryModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<DiscoveryMode>("dating");
  return (
    <DiscoveryModeContext.Provider value={{ mode, setMode }}>
      {children}
    </DiscoveryModeContext.Provider>
  );
}

export function useDiscoveryMode() {
  return useContext(DiscoveryModeContext);
}
