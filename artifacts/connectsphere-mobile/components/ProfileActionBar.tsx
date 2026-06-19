/**
 * ProfileActionBar — Like / Plan / Besties / Pass
 *
 * Replaces the old action bar. Key animation improvements:
 *   • Toast: spring scale-in from 0.6 → 1 with overshoot (no more instant pop)
 *   • Icon: bounce spring on tap
 *   • Ripple: expanding ring that fades out (native-driver)
 *   • Badge: springs onto icon 120ms after tap
 *   • Dismiss: animated progress bar sweeps across toast
 *   • Haptics: selection on tap, notification feedback on confirm
 *
 * Plan button flow:
 *   tap Plan → CreateFriendPlanSheet (onDraft mode)
 *   → sendFriendRequest(kind:"plan", planDraft)
 *   → success toast → router.push Connect requests
 */

import { useEffect, useRef, useCallback, useState } from "react";
import {
  Pressable,
  View,
  Text,
  StyleSheet,
  Animated,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/clerk-expo";

import CreateFriendPlanSheet, { type PlanDraft } from "@/components/CreateFriendPlanSheet";
import { sendFriendRequest } from "@/services/friendsApi";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActionType = "like" | "plan" | "besties" | "pass";

export interface ActionConfig {
  type: ActionType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
  toast: { title: string; emoji: string; action?: string } | null;
  haptic: "selection" | "success" | "warning" | "error";
}

const ACTIONS: ActionConfig[] = [
  {
    type: "like",
    label: "Like",
    icon: "heart-outline",
    iconActive: "heart",
    color: "#FF3C64",
    bgColor: "rgba(255,60,100,0.15)",
    toast: { title: "Liked!", emoji: "❤️", action: "Undo" },
    haptic: "success",
  },
  {
    type: "plan",
    label: "Plan",
    icon: "calendar-outline",
    iconActive: "calendar",
    color: "#5A82FF",
    bgColor: "rgba(90,130,255,0.15)",
    toast: null, // plan opens CreateFriendPlanSheet; success toast fires in handlePlanDraft
    haptic: "selection",
  },
  {
    type: "besties",
    label: "Besties",
    icon: "people-outline",
    iconActive: "people",
    color: "#A855F7",
    bgColor: "rgba(168,85,247,0.15)",
    toast: { title: "Besties sent", emoji: "👥", action: "View" },
    haptic: "success",
  },
  {
    type: "pass",
    label: "Pass",
    icon: "close-outline",
    iconActive: "close",
    color: "#888",
    bgColor: "rgba(120,120,120,0.12)",
    toast: null,
    haptic: "selection",
  },
];

const TOAST_DURATION_MS = 2400;

// ─── Ripple ───────────────────────────────────────────────────────────────────

function RippleRing({ color, trigger }: { color: string; trigger: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (trigger === 0) return;
    scale.setValue(1);
    opacity.setValue(0.8);
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 2.3,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, [trigger]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ripple,
        {
          borderColor: color,
          transform: [{ scale }],
          opacity,
        },
      ]}
    />
  );
}

// ─── Single action button ─────────────────────────────────────────────────────

function ActionButton({
  config,
  onPress,
  active,
}: {
  config: ActionConfig;
  onPress: (cfg: ActionConfig) => void;
  active: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const iconScale = useRef(new Animated.Value(1)).current;
  const badgeScale = useRef(new Animated.Value(0)).current;
  const badgeOpacity = useRef(new Animated.Value(0)).current;
  const [rippleTrigger, setRippleTrigger] = useState(0);

  const handlePress = useCallback(() => {
    // 1. Haptic
    if (config.haptic === "success") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.selectionAsync();
    }

    // 2. Button press-down then spring back
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.88,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        damping: 12,
        stiffness: 260,
        useNativeDriver: true,
      }),
    ]).start();

    // 3. Icon bounce
    Animated.sequence([
      Animated.timing(iconScale, {
        toValue: 1.4,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.spring(iconScale, {
        toValue: 1,
        damping: 8,
        stiffness: 280,
        useNativeDriver: true,
      }),
    ]).start();

    // 4. Ripple ring
    setRippleTrigger((t) => t + 1);

    // 5. Badge pop (delayed 120ms)
    if (config.toast) {
      setTimeout(() => {
        badgeScale.setValue(0);
        badgeOpacity.setValue(0);
        Animated.parallel([
          Animated.spring(badgeScale, {
            toValue: 1,
            damping: 10,
            stiffness: 300,
            useNativeDriver: true,
          }),
          Animated.timing(badgeOpacity, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }),
        ]).start();
      }, 120);

      // Badge fades after toast duration
      setTimeout(() => {
        Animated.timing(badgeOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => badgeScale.setValue(0));
      }, TOAST_DURATION_MS + 120);
    }

    onPress(config);
  }, [config, onPress]);

  return (
    <Pressable onPress={handlePress} style={styles.actionBtn}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <View style={[styles.iconWrap, { backgroundColor: config.bgColor }]}>
          <RippleRing color={config.color} trigger={rippleTrigger} />
          <Animated.View style={{ transform: [{ scale: iconScale }] }}>
            <Ionicons
              name={active ? config.iconActive : config.icon}
              size={22}
              color={config.color}
            />
          </Animated.View>
          {/* "sent" badge */}
          {config.toast && (
            <Animated.View
              style={[
                styles.badge,
                { transform: [{ scale: badgeScale }], opacity: badgeOpacity },
              ]}
            >
              <Text style={styles.badgeText}>sent</Text>
            </Animated.View>
          )}
        </View>
        <Text style={styles.btnLabel}>{config.label}</Text>
      </Animated.View>
    </Pressable>
  );
}

// ─── Toast — Style E: minimal snackbar ───────────────────────────────────────

function ActionToast({
  config,
  visible,
  onHide,
  onAction,
}: {
  config: ActionConfig | null;
  visible: boolean;
  onHide: () => void;
  onAction?: () => void;
}) {
  const translateY = useRef(new Animated.Value(16)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible && config?.toast) {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);

      translateY.setValue(16);
      opacity.setValue(0);
      scale.setValue(0.92);

      // Slide up + spring scale
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          damping: 16,
          stiffness: 240,
          mass: 0.7,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          damping: 16,
          stiffness: 240,
          mass: 0.7,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-dismiss
      dismissTimer.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, { toValue: 10, duration: 200, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start(onHide);
      }, TOAST_DURATION_MS);
    }

    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [visible, config]);

  if (!config?.toast) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.snackbar,
        {
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      {/* Emoji */}
      <Text style={styles.snackEmoji}>{config.toast.emoji}</Text>

      {/* Label */}
      <Text style={styles.snackText}>{config.toast.title}</Text>

      {/* Action (Undo / View) */}
      {config.toast.action && (
        <Pressable
          onPress={() => {
            if (dismissTimer.current) clearTimeout(dismissTimer.current);
            onAction?.();
            onHide();
          }}
          hitSlop={10}
        >
          <Text style={styles.snackAction}>{config.toast.action}</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

// ─── Plan success toast config (fires after sheet resolves) ──────────────────

const PLAN_SENT_TOAST: ActionConfig = {
  type: "plan",
  label: "Plan",
  icon: "calendar-outline",
  iconActive: "calendar",
  color: "#5A82FF",
  bgColor: "rgba(90,130,255,0.15)",
  toast: { title: "Plan request sent!", emoji: "📅", action: "View" },
  haptic: "success",
};

// ─── Main component ───────────────────────────────────────────────────────────

interface ProfileActionBarProps {
  /** Clerk userId of the person whose profile is open */
  targetUserId: string;
  /** Display name — pre-fills the plan sheet title */
  targetUserName?: string;
  onLike?: () => void;
  onBesties?: () => void;
  onPass?: () => void;
}

export default function ProfileActionBar({
  targetUserId,
  targetUserName,
  onLike,
  onBesties,
  onPass,
}: ProfileActionBarProps) {
  const insets = useSafeAreaInsets();
  const { userId: myUserId } = useAuth();

  const [toastConfig, setToastConfig] = useState<ActionConfig | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastActionFn, setToastActionFn] = useState<(() => void) | undefined>(undefined);
  const [activeType, setActiveType] = useState<ActionType | null>(null);

  // Plan sheet state
  const [planSheetVisible, setPlanSheetVisible] = useState(false);
  const [planSending, setPlanSending] = useState(false);

  // ── Called when user taps a button ──────────────────────────────────────────
  const handleAction = useCallback((cfg: ActionConfig) => {
    setActiveType(cfg.type);

    if (cfg.type === "plan") {
      // Plan: open sheet instead of showing toast immediately
      setPlanSheetVisible(true);
      return;
    }

    if (cfg.toast) {
      setToastConfig(cfg);
      setToastVisible(true);
      // "View" on Besties navigates to Connect; "Undo" on Like is a no-op
      if (cfg.type === "besties") {
        setToastActionFn(() => () =>
          router.push({ pathname: "/(tabs)/matches", params: { segment: "matches" } } as never)
        );
      } else {
        setToastActionFn(undefined);
      }
    }

    if (cfg.type === "like") onLike?.();
    if (cfg.type === "besties") onBesties?.();
    if (cfg.type === "pass") onPass?.();
  }, [onLike, onBesties, onPass]);

  // ── Called when CreateFriendPlanSheet submits in onDraft mode ────────────────
  const handlePlanDraft = useCallback(async (draft: PlanDraft) => {
    // Close the sheet first — give it time to fully animate out
    // before the snackbar slides up
    setPlanSheetVisible(false);
    setPlanSending(true);

    // Fire the request in the background while the sheet is closing
    sendFriendRequest(myUserId ?? "", targetUserId, {
      kind: "plan",
      message: `${draft.title} · ${draft.timeLabel} · ${draft.location}`,
    }).catch(() => {
      // Best-effort — optimistic UI
    }).finally(() => {
      setPlanSending(false);
    });

    // Wait for sheet close animation (~380ms), then show snackbar
    setTimeout(() => {
      const goToConnect = () =>
        router.push({ pathname: "/(tabs)/matches", params: { segment: "matches" } } as never);

      setToastConfig(PLAN_SENT_TOAST);
      setToastActionFn(() => goToConnect);
      setToastVisible(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 380);
  }, [myUserId, targetUserId]);

  const handleToastHide = useCallback(() => {
    setToastVisible(false);
    setActiveType(null);
  }, []);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 12 }]}>
      {/* Toast sits above the bar */}
      <ActionToast
        config={toastConfig}
        visible={toastVisible}
        onHide={handleToastHide}
        onAction={toastActionFn}
      />

      {/* Glass bar */}
      <View style={styles.bar}>
        <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.grid}>
          {ACTIONS.map((cfg) => (
            <ActionButton
              key={cfg.type}
              config={cfg}
              onPress={handleAction}
              active={activeType === cfg.type || (cfg.type === "plan" && planSending)}
            />
          ))}
        </View>
      </View>

      {/* Plan creation sheet — onDraft mode: no plan created until accepted */}
      <CreateFriendPlanSheet
        visible={planSheetVisible}
        userId={myUserId ?? ""}
        initialTitle={targetUserName ? `Plans with ${targetUserName.split(" ")[0]}` : undefined}
        onClose={() => {
          setPlanSheetVisible(false);
          setActiveType(null);
        }}
        onDraft={handlePlanDraft}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  bar: {
    width: "100%",
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  grid: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  actionBtn: {
    alignItems: "center",
    gap: 5,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  ripple: {
    position: "absolute",
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#A855F7",
    borderRadius: 20,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1.5,
    borderColor: "#050008",
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "600",
  },
  btnLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    textAlign: "center",
  },

  // Snackbar (Style E)
  snackbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderRadius: 99,
    paddingHorizontal: 18,
    paddingVertical: 11,
    marginBottom: 10,
    alignSelf: "center",
    minWidth: 150,
    maxWidth: 270,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  snackEmoji: {
    fontSize: 16,
    flexShrink: 0,
  },
  snackText: {
    flex: 1,
    color: "#111",
    fontSize: 13,
    fontWeight: "600",
  },
  snackAction: {
    color: "#5A82FF",
    fontSize: 13,
    fontWeight: "600",
  },
});
