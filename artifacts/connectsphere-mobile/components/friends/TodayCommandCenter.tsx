import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { TodayCommand } from "./friendsMissionControl";

type Props = {
  command: TodayCommand;
  onPrimary: (command: TodayCommand) => void;
  onSecondary?: (command: TodayCommand) => void;
};

export default function TodayCommandCenter({ command, onPrimary, onSecondary }: Props) {
  const showSecondary = command.kind === "person" || command.kind === "plan";
  const secondaryLabel = command.kind === "person" ? "Make Plan" : "Share";

  return (
    <LinearGradient colors={["rgba(255,45,168,0.22)", "rgba(255,255,255,0.055)"]} style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.icon}>
          <Ionicons name="sparkles" size={17} color="#0A0A0B" />
        </View>
        <Text style={styles.label}>{command.label}</Text>
      </View>

      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={2}>
          {command.title}
        </Text>
        <Text style={styles.reason} numberOfLines={3}>
          {command.reason}
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable onPress={() => onPrimary(command)} style={styles.primary}>
          <Text style={styles.primaryText} numberOfLines={1}>
            {command.primaryLabel}
          </Text>
        </Pressable>
        {showSecondary && onSecondary ? (
          <Pressable onPress={() => onSecondary(command)} style={styles.secondary}>
            <Text style={styles.secondaryText} numberOfLines={1}>
              {secondaryLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderColor: "rgba(255,45,168,0.28)",
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  icon: {
    alignItems: "center",
    backgroundColor: "#FF2D8D",
    borderRadius: 15,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  label: {
    color: "#FFB6D9",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  copy: {
    gap: 6,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 25,
  },
  reason: {
    color: "#EDEDF2",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 2,
  },
  primary: {
    alignItems: "center",
    backgroundColor: "#FF2D8D",
    borderRadius: 14,
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 12,
  },
  primaryText: {
    color: "#0A0A0B",
    fontSize: 14,
    fontWeight: "900",
  },
  secondary: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.09)",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 16,
  },
  secondaryText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
});
