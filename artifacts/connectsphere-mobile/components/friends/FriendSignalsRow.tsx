import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { FriendStory } from "@/services/friendsApi";
import { firstName, signalTitle } from "./friendsLabels";

const FALLBACK_PHOTO =
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=85";

type Props = {
  stories: FriendStory[];
  onReact: (story: FriendStory) => void;
  onReply: (story: FriendStory) => void;
  onPlan: (story: FriendStory) => void;
  onIcebreaker: (story: FriendStory) => void;
  isBusy?: (story: FriendStory, action: "react" | "reply" | "plan") => boolean;
};

export default function FriendSignalsRow({ stories, onReact, onReply, onPlan, onIcebreaker, isBusy }: Props) {
  if (!stories.length) {
    return (
      <View style={styles.empty}>
        <Ionicons name="radio-outline" size={17} color="#FF8BC4" />
        <Text style={styles.emptyText}>No live signals yet. Start a plan or check back soon.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Live friend signals</Text>
        <Text style={styles.subtitle}>Moments and open-to-plans pings</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {stories.slice(0, 8).map((story) => {
          const reacting = isBusy?.(story, "react") ?? false;
          const replying = isBusy?.(story, "reply") ?? false;
          const planning = isBusy?.(story, "plan") ?? false;

          return (
            <View key={story.id} style={styles.card}>
              <Image source={{ uri: story.imageUrl ?? story.user?.photoUrl ?? FALLBACK_PHOTO }} style={styles.image} contentFit="cover" />
              <Text style={styles.cardLabel}>{signalTitle(story)}</Text>
              <Text style={styles.cardText} numberOfLines={2}>
                {story.text ?? `${firstName(story.user?.name)} is open to plans.`}
              </Text>
              <Text style={styles.cardMeta} numberOfLines={1}>
                {firstName(story.user?.name)}
              </Text>
              <View style={styles.actions}>
                <Pressable
                  onPress={() => onReact(story)}
                  disabled={reacting}
                  style={[styles.iconButton, reacting && styles.disabledButton]}
                  hitSlop={8}
                >
                  <Ionicons name="sparkles" size={14} color="#FFB6D9" />
                </Pressable>
                <Pressable
                  onPress={() => onIcebreaker(story)}
                  disabled={replying}
                  style={[styles.actionButton, replying && styles.disabledButton]}
                >
                  <Text style={styles.actionText}>{replying ? "..." : "AI Reply"}</Text>
                </Pressable>
                <Pressable
                  onPress={() => onPlan(story)}
                  disabled={planning}
                  style={[styles.iconButton, planning && styles.disabledButton]}
                  hitSlop={8}
                >
                  <Ionicons name="calendar-outline" size={14} color="#FFB6D9" />
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  header: { gap: 2 },
  title: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  subtitle: { color: "#A1A1AA", fontSize: 12, fontWeight: "700" },
  row: { gap: 10, paddingRight: 4 },
  card: {
    backgroundColor: "#050505",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 18,
    borderWidth: 1,
    gap: 7,
    padding: 10,
    width: 176,
  },
  image: { backgroundColor: "#17171D", borderRadius: 14, height: 82, width: "100%" },
  cardLabel: { color: "#FF8BC4", fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  cardText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800", lineHeight: 18, minHeight: 36 },
  cardMeta: { color: "#A1A1AA", fontSize: 11, fontWeight: "800" },
  actions: { alignItems: "center", flexDirection: "row", gap: 7 },
  iconButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 13,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  actionButton: {
    alignItems: "center",
    backgroundColor: "#FF2D8D",
    borderRadius: 13,
    flex: 1,
    justifyContent: "center",
    minHeight: 30,
  },
  actionText: { color: "#0A0A0B", fontSize: 12, fontWeight: "900" },
  disabledButton: { opacity: 0.55 },
  empty: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.045)",
    borderColor: "rgba(255,255,255,0.09)",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  emptyText: { color: "#D7D7DE", flex: 1, fontSize: 12, fontWeight: "800", lineHeight: 17 },
});
