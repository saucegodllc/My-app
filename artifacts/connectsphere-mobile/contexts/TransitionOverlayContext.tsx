import { createContext, useContext, useRef, type ReactNode } from "react";
import { Animated, Easing, StyleSheet } from "react-native";

type ContextType = { fadeTransition: (callback: () => void) => void };

const TransitionOverlayContext = createContext<ContextType>({ fadeTransition: (cb) => cb() });

export function TransitionOverlayProvider({ children }: { children: ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;

  function fadeTransition(callback: () => void) {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 450,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      callback();
      // Brief pause so the new screen mounts fully before revealing it
      setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 350,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }).start();
      }, 80);
    });
  }

  return (
    <TransitionOverlayContext.Provider value={{ fadeTransition }}>
      {children}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: "#000", opacity }]}
        pointerEvents="none"
      />
    </TransitionOverlayContext.Provider>
  );
}

export function useTransitionOverlay() {
  return useContext(TransitionOverlayContext);
}
