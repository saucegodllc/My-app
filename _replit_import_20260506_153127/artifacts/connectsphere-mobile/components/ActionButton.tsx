import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, View } from "react-native";

import { useColors } from "@/hooks/useColors";

type ActionType = "pass" | "superlike" | "like";

type Props = {
  type: ActionType;
  onPress: () => void;
  size?: "sm" | "md" | "lg";
};

const CONFIG: Record<ActionType, { icon: string; color: string; bg: string; size: number }> = {
  pass: { icon: "close", color: "#F87171", bg: "#F8717120", size: 28 },
  superlike: { icon: "star", color: "#60A5FA", bg: "#60A5FA20", size: 22 },
  like: { icon: "heart", color: "#FF299B", bg: "#FF299B20", size: 26 },
};

const DIMENSIONS: Record<string, number> = {
  sm: 52,
  md: 64,
  lg: 72,
};

export function ActionButton({ type, onPress, size = "md" }: Props) {
  const colors = useColors();
  const config = CONFIG[type];
  const dim = DIMENSIONS[size];

  async function handlePress() {
    await Haptics.impactAsync(
      type === "like" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
    );
    onPress();
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.button,
        {
          width: dim,
          height: dim,
          borderRadius: dim / 2,
          backgroundColor: config.bg,
          borderColor: config.color + "60",
          opacity: pressed ? 0.75 : 1,
          transform: [{ scale: pressed ? 0.93 : 1 }],
        },
      ]}
      testID={`action-${type}`}
    >
      <Ionicons
        name={config.icon as any}
        size={config.size}
        color={config.color}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
});
