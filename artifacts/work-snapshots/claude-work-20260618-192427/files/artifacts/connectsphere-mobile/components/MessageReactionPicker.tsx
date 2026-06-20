/**
 * MessageReactionPicker
 *
 * Long-press a message bubble to pop this up.
 * Shows 6 emoji reactions + a "Report" action.
 *
 * Usage:
 *   const [pickerMsg, setPickerMsg] = useState<Message | null>(null);
 *
 *   // In message bubble:
 *   <Pressable onLongPress={() => setPickerMsg(message)}>
 *     ...
 *   </Pressable>
 *
 *   // Sibling / modal host:
 *   <MessageReactionPicker
 *     visible={!!pickerMsg}
 *     onReact={(emoji) => { addReaction(pickerMsg!, emoji); setPickerMsg(null); }}
 *     onReport={() => { reportMessage(pickerMsg!); setPickerMsg(null); }}
 *     onClose={() => setPickerMsg(null)}
 *   />
 *
 * Reactions are stored client-side in a Map<messageId, emoji> via the
 * `useMessageReactions` hook below, and optimistically synced to the server.
 */
import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";

import { BRAND, NEUTRAL, RADIUS, SPACE, TYPE } from "@/constants/tokens";

const REACTIONS = ["❤️", "😂", "😮", "😢", "😡", "🔥"] as const;
export type ReactionEmoji = (typeof REACTIONS)[number];

type Props = {
  visible: boolean;
  onReact: (emoji: ReactionEmoji) => void;
  onReport: () => void;
  onClose: () => void;
};

export function MessageReactionPicker({ visible, onReact, onReport, onClose }: Props) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          tension: 280,
          friction: 18,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 0.6,
          duration: 120,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  async function handleReact(emoji: ReactionEmoji) {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch { /* ignore */ }
    onReact(emoji);
  }

  async function handleReport() {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch { /* ignore */ }
    onReport();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View
          style={[
            styles.picker,
            { transform: [{ scale }], opacity },
          ]}
        >
          {/* Emoji reactions */}
          <View style={styles.emojiRow}>
            {REACTIONS.map((emoji) => (
              <Pressable
                key={emoji}
                onPress={() => handleReact(emoji)}
                style={({ pressed }) => [
                  styles.emojiBtn,
                  pressed && { transform: [{ scale: 0.85 }] },
                ]}
              >
                <Text style={styles.emoji}>{emoji}</Text>
              </Pressable>
            ))}
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Report action */}
          <Pressable
            onPress={handleReport}
            style={({ pressed }) => [
              styles.reportBtn,
              pressed && styles.reportBtnPressed,
            ]}
          >
            <Ionicons name="flag-outline" size={16} color={BRAND.red} />
            <Text style={styles.reportText}>Report message</Text>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ── useMessageReactions hook ─────────────────────────────────────────────────
/**
 * Manages per-message reactions in local state.
 * Call syncReaction() to persist to the server (fire-and-forget).
 */
export function useMessageReactions(
  syncReaction?: (messageId: string, emoji: string) => Promise<void>
) {
  const reactions = useRef<Map<string, ReactionEmoji>>(new Map()).current;

  function addReaction(messageId: string, emoji: ReactionEmoji) {
    const prev = reactions.get(messageId);
    if (prev === emoji) {
      reactions.delete(messageId); // toggle off
    } else {
      reactions.set(messageId, emoji);
    }
    syncReaction?.(messageId, emoji).catch(() => {/* best-effort */});
  }

  function getReaction(messageId: string): ReactionEmoji | undefined {
    return reactions.get(messageId);
  }

  return { addReaction, getReaction };
}

// ── MessageReactionBubble ─────────────────────────────────────────────────────
/** Tiny emoji badge shown below a message that has a reaction. */
export function MessageReactionBubble({
  emoji,
  isOwn,
  onPress,
}: {
  emoji: ReactionEmoji;
  isOwn: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.reactionBubble,
        isOwn ? styles.reactionBubbleRight : styles.reactionBubbleLeft,
      ]}
    >
      <Text style={styles.reactionEmoji}>{emoji}</Text>
    </Pressable>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  picker: {
    backgroundColor: "#1A1A1E",
    borderRadius: RADIUS["2xl"],
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
    minWidth: 280,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 20,
  },
  emojiRow: {
    flexDirection: "row",
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.md,
    gap: 4,
  },
  emojiBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACE.sm,
  },
  emoji: {
    fontSize: 28,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.10)",
    marginHorizontal: SPACE.md,
  },
  reportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
  },
  reportBtnPressed: {
    backgroundColor: "rgba(248,113,113,0.08)",
  },
  reportText: {
    color: BRAND.red,
    ...TYPE.labelBold,
  },
  reactionBubble: {
    position: "absolute",
    bottom: -10,
    backgroundColor: "#1C1C1E",
    borderRadius: RADIUS.pill,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1.5,
    borderColor: "#000",
  },
  reactionBubbleRight: { right: 8 },
  reactionBubbleLeft: { left: 8 },
  reactionEmoji: { fontSize: 14 },
});
