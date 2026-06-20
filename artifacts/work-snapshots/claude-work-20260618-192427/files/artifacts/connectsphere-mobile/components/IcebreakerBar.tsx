/**
 * IcebreakerBar
 * ─────────────
 * Shown above the chat input on first open of a new match conversation.
 * Three tappable suggestion chips — tap one to send instantly.
 * Dismissed after first message or by pressing ✕.
 *
 * Design: frosted glass strip just above the keyboard with animated entry.
 */
import { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

type Props = {
  icebreakers: string[];
  onSelect: (text: string) => void;
  onDismiss: () => void;
};

export default function IcebreakerBar({ icebreakers, onSelect, onDismiss }: Props) {
  const slideY = useRef(new Animated.Value(60)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (icebreakers.length === 0) return;
    Animated.parallel([
      Animated.spring(slideY, {
        toValue: 0,
        stiffness: 260,
        damping: 22,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [icebreakers.length]);

  if (icebreakers.length === 0) return null;

  function handleSelect(text: string) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(text);
    onDismiss();
  }

  return (
    <Animated.View
      style={[styles.wrap, { transform: [{ translateY: slideY }], opacity }]}
    >
      <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.inner}>
        <View style={styles.header}>
          <Text style={styles.headerText}>✨ Break the ice</Text>
          <Pressable onPress={onDismiss} hitSlop={10} style={styles.closeBtn}>
            <Ionicons name="close" size={14} color="rgba(255,255,255,0.45)" />
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {icebreakers.map((text, i) => (
            <Pressable
              key={i}
              onPress={() => handleSelect(text)}
              style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
            >
              <Text style={styles.chipText} numberOfLines={2}>
                {text}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  inner: {
    paddingTop: 10,
    paddingBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  headerText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 0.3,
  },
  closeBtn: {
    padding: 4,
  },
  chips: {
    paddingHorizontal: 14,
    gap: 8,
  },
  chip: {
    maxWidth: 220,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: "rgba(255,45,168,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,45,168,0.30)",
  },
  chipPressed: {
    backgroundColor: "rgba(255,45,168,0.25)",
    transform: [{ scale: 0.97 }],
  },
  chipText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.88)",
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
});
