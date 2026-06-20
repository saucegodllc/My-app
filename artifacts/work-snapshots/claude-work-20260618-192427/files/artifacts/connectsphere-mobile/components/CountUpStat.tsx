/**
 * CountUpStat — animated count-up number for profile stats.
 *
 * Usage:
 *   <CountUpStat value={1234} label="Likes" />
 *
 * On mount it animates from 0 → value over ~800ms with easeOut.
 * Re-animates any time `value` changes.
 */
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { BRAND, NEUTRAL, RADIUS, SPACE, TYPE } from "@/constants/tokens";

// AnimatedText requires the animated component factory
const AnimatedText = Animated.createAnimatedComponent(Text);

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(Math.floor(n));
}

type Props = {
  value: number;
  label: string;
  accent?: string;
};

export function CountUpStat({ value, label, accent = BRAND.pink }: Props) {
  const animValue = useSharedValue(0);

  useEffect(() => {
    animValue.value = withTiming(value, {
      duration: 820,
      easing: Easing.out(Easing.cubic),
    });
  }, [value]);

  const display = useDerivedValue(() => formatCount(animValue.value));

  const animProps = useAnimatedProps(() => ({
    text: display.value,
  } as any));

  return (
    <View style={styles.wrap}>
      <AnimatedText
        style={[styles.number, { color: accent }]}
        animatedProps={animProps}
      >
        {formatCount(value)}
      </AnimatedText>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: 3,
    flex: 1,
  },
  number: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    lineHeight: 26,
  },
  label: {
    ...TYPE.captionBold,
    color: NEUTRAL.textMuted,
  },
});
