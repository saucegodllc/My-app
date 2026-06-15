import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from "react-native";

const PINK = "#ff2da8";
const PINK_HOT = "#ff5fc1";
const FLAME = "#ffb43d";
const HYPE = "#b6ff3d";
const INK = "#0a0a0c";
const INK_2 = "#16161a";
const TEXT = "#f4f4f5";
const MUTED = "#a1a1aa";

const SPARKLE_COLORS = [PINK, PINK_HOT, FLAME, HYPE, "#ffffff"];

type Props = {
  visible: boolean;
  planTitle?: string;
  whenLabel?: string;
  locationLabel?: string;
  // Optional CTA — if provided, the user can dismiss + run a follow-up (e.g. open the chat in Connect).
  ctaLabel?: string;
  onCtaPress?: () => void;
  // Always called on auto-dismiss after the animation completes (~1.4s).
  onDismiss: () => void;
  // Override the auto-dismiss timing in ms. Defaults to 1400.
  autoDismissMs?: number;
};

/**
 * Full-screen celebration overlay. Fires when a user joins a plan — via the plans
 * feed, a friend's invite, a mutual vibe match, or a share link redemption.
 *
 * Hot pink + black, ~1.4 seconds, three beats:
 *   0-300ms   particle burst from center, "you're in" springs up
 *   300-800ms plan title + when/where slide up
 *   800-1100ms "say hi" CTA fades in
 *   1100-1400ms auto-dismiss → caller routes to Connect on the chat
 *
 * Designed to be cheap and self-contained — no external animation libs beyond
 * the RN Animated runtime already in the workspace.
 */
export default function JoinedBurst({
  visible,
  planTitle,
  whenLabel,
  locationLabel,
  ctaLabel,
  onCtaPress,
  onDismiss,
  autoDismissMs = 1400,
}: Props) {
  const fade = useRef(new Animated.Value(0)).current;
  const titleScale = useRef(new Animated.Value(0.4)).current;
  const detailTranslate = useRef(new Animated.Value(24)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;
  const sparkles = useMemo(
    () =>
      Array.from({ length: 16 }, (_, index) => ({
        key: index,
        color: SPARKLE_COLORS[index % SPARKLE_COLORS.length],
        angle: (Math.PI * 2 * index) / 16 + (index % 2 === 0 ? 0.1 : -0.1),
        distance: 90 + (index % 4) * 18,
        radius: 4 + (index % 3) * 2,
        anim: new Animated.Value(0),
      })),
    [],
  );

  useEffect(() => {
    if (!visible) return;
    // Haptic to underline the moment.
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    fade.setValue(0);
    titleScale.setValue(0.4);
    detailTranslate.setValue(24);
    ctaOpacity.setValue(0);
    sparkles.forEach((sparkle) => sparkle.anim.setValue(0));

    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
      Animated.spring(titleScale, { toValue: 1, friction: 5, tension: 110, useNativeDriver: true }),
      Animated.timing(detailTranslate, {
        toValue: 0,
        duration: 480,
        delay: 220,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(ctaOpacity, {
        toValue: 1,
        duration: 280,
        delay: 800,
        useNativeDriver: true,
      }),
      ...sparkles.map((sparkle, index) =>
        Animated.timing(sparkle.anim, {
          toValue: 1,
          duration: 700,
          delay: 30 + (index % 4) * 40,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ),
    ]).start();

    const dismissTimer = setTimeout(() => {
      Animated.timing(fade, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
        easing: Easing.in(Easing.quad),
      }).start(() => {
        onDismiss();
      });
    }, autoDismissMs);

    return () => {
      clearTimeout(dismissTimer);
    };
  }, [autoDismissMs, ctaOpacity, detailTranslate, fade, onDismiss, sparkles, titleScale, visible]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onDismiss}>
      <Animated.View style={[styles.overlay, { opacity: fade }]}>
        <View style={styles.center}>
          {sparkles.map((sparkle) => {
            const dx = Math.cos(sparkle.angle) * sparkle.distance;
            const dy = Math.sin(sparkle.angle) * sparkle.distance;
            return (
              <Animated.View
                key={sparkle.key}
                style={[
                  styles.sparkle,
                  {
                    backgroundColor: sparkle.color,
                    width: sparkle.radius * 2,
                    height: sparkle.radius * 2,
                    borderRadius: sparkle.radius,
                    transform: [
                      {
                        translateX: sparkle.anim.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }),
                      },
                      {
                        translateY: sparkle.anim.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }),
                      },
                      {
                        scale: sparkle.anim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1.1, 0] }),
                      },
                    ],
                  },
                ]}
              />
            );
          })}

          <Animated.View style={[styles.titleWrap, { transform: [{ scale: titleScale }] }]}>
            <Text style={styles.eyebrow}>you're</Text>
            <Text style={styles.title}>in</Text>
          </Animated.View>

          <Animated.View style={[styles.detailWrap, { transform: [{ translateY: detailTranslate }], opacity: fade }]}>
            {planTitle ? <Text style={styles.planTitle} numberOfLines={2}>{planTitle}</Text> : null}
            {whenLabel || locationLabel ? (
              <Text style={styles.planMeta} numberOfLines={2}>
                {[whenLabel, locationLabel].filter(Boolean).join(" · ")}
              </Text>
            ) : null}
          </Animated.View>

          {ctaLabel && onCtaPress ? (
            <Animated.View style={{ opacity: ctaOpacity }}>
              <Pressable onPress={onCtaPress} style={styles.cta}>
                <Text style={styles.ctaText}>{ctaLabel}</Text>
                <Ionicons name="arrow-forward" size={18} color={INK} />
              </Pressable>
            </Animated.View>
          ) : null}
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(10,10,12,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  sparkle: {
    position: "absolute",
  },
  titleWrap: {
    alignItems: "center",
  },
  eyebrow: {
    color: PINK,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  title: {
    color: TEXT,
    fontSize: 76,
    fontWeight: "900",
    letterSpacing: -1,
    lineHeight: 78,
  },
  detailWrap: {
    alignItems: "center",
    marginTop: 18,
    maxWidth: 280,
  },
  planTitle: {
    color: TEXT,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  planMeta: {
    color: MUTED,
    fontSize: 13,
    marginTop: 6,
    textAlign: "center",
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: PINK,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    marginTop: 28,
  },
  ctaText: {
    color: INK,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
});
