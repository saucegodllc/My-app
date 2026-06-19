/**
 * UnlockToast
 * ────────────
 * Animated celebration banner shown when a user unlocks a new feature.
 * Slides in from top, holds for 3s, then slides out.
 *
 * Usage:
 *   <UnlockToast message={unlockLabel} />
 *   // Pass null/undefined to hide
 */
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  message: string | null;
  onDismiss?: () => void;
};

export default function UnlockToast({ message, onDismiss }: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!message) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    // Slide in
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        stiffness: 280,
        damping: 20,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, stiffness: 280, damping: 20, useNativeDriver: true }),
    ]).start();

    // Auto-dismiss after 3.5s
    timerRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -100, duration: 280, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]).start(() => onDismiss?.());
    }, 3500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [message]);

  if (!message) return null;

  return (
    <Animated.View
      style={[
        styles.wrap,
        { top: insets.top + 12 },
        { transform: [{ translateY }, { scale }], opacity },
      ]}
    >
      <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={["rgba(255,45,168,0.18)", "transparent"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.inner}>
        <Text style={styles.lockIcon}>🔓</Text>
        <Text style={styles.text}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 20,
    right: 20,
    zIndex: 9999,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,45,168,0.35)",
    shadowColor: "#FF2DA8",
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  lockIcon: {
    fontSize: 20,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.92)",
    lineHeight: 18,
  },
});
