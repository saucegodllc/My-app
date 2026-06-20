/**
 * TypingIndicator — animated three-dot typing indicator for chat.
 *
 * Usage:
 *   <TypingIndicator visible={isOtherUserTyping} name="Jasmine" />
 *
 * The three dots wave in sequence with a stagger. The whole component
 * fades in/out via react-native-reanimated (native driver).
 */
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  FadeIn,
  FadeOut,
} from "react-native-reanimated";
import { useEffect } from "react";

import { BRAND, NEUTRAL, RADIUS, SPACE, TYPE } from "@/constants/tokens";

const DOT_SIZE = 7;
const STAGGER = 140; // ms between each dot
const UP_DURATION = 220;
const DOWN_DURATION = 220;
const HOLD = 80;
const UP_DIST = -7;

type Props = {
  visible: boolean;
  /** Optional name shown as "Jasmine is typing…" */
  name?: string;
};

function AnimatedDot({ delay }: { delay: number }) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(UP_DIST, { duration: UP_DURATION, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: DOWN_DURATION, easing: Easing.in(Easing.quad) }),
          withTiming(0, { duration: HOLD + STAGGER * 2 }) // idle until next cycle
        ),
        -1, // infinite
        false
      )
    );
    return () => {
      translateY.value = 0;
    };
  }, [delay]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={[styles.dot, dotStyle]} />;
}

export function TypingIndicator({ visible, name }: Props) {
  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(160)}
      style={styles.wrap}
    >
      <View style={styles.bubble}>
        <View style={styles.dots}>
          <AnimatedDot delay={0} />
          <AnimatedDot delay={STAGGER} />
          <AnimatedDot delay={STAGGER * 2} />
        </View>
      </View>
      {name && (
        <Text style={styles.label}>{name} is typing…</Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.xs,
  },
  bubble: {
    backgroundColor: "#1C1C1E",
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm + 2,
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: DOT_SIZE + 8,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: BRAND.pink,
    opacity: 0.85,
  },
  label: {
    ...TYPE.caption,
    color: NEUTRAL.textMuted,
    fontStyle: "italic",
  },
});
