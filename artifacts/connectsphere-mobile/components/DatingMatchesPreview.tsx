import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useDatingMatches } from "@/contexts/DatingMatchContext";

type Props = {
  
  variant?: "section" | "compact";
};

export function DatingMatchesPreview({ variant = "section" }: Props) {
  const { matches } = useDatingMatches();

  if (matches.length === 0) return null;

  const compact = variant === "compact";

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <LinearGradient
            colors={["#EC4899", "#D946EF"]}
            style={styles.titleDot}
          />
          <Text style={styles.title}>It's a Vibe</Text>
          <View style={styles.countPill}>
            <Text style={styles.countText}>{matches.length}</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>New dating matches · say hi first</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {matches.map((match) => {
          const photo = match.profile.photos[0];
          return (
            <Pressable
              key={match.id}
              onPress={() => router.push(`/chat/dating/${match.chatId}` as never)}
              style={styles.tile}
            >
              <LinearGradient
                colors={["#EC4899", "#A855F7"]}
                style={styles.tileRing}
              >
                <View style={styles.tileInner}>
                  {photo ? (
                    <Image source={{ uri: photo }} style={styles.tilePhoto} contentFit="cover" />
                  ) : (
                    <View style={[styles.tilePhoto, styles.tilePhotoFallback]}>
                      <Ionicons name="person" size={28} color="#fff" />
                    </View>
                  )}
                </View>
              </LinearGradient>
              <Text style={styles.tileName} numberOfLines={1}>
                {match.profile.name}
              </Text>
              <Text style={styles.tileHint} numberOfLines={1}>
                Say hi
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 18,
    paddingBottom: 6,
    gap: 12,
  },
  wrapCompact: {
    paddingTop: 12,
    paddingBottom: 4,
  },
  header: { paddingHorizontal: 16, gap: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  titleDot: { width: 10, height: 10, borderRadius: 5 },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: -0.2,
  },
  countPill: {
    minWidth: 22,
    height: 20,
    paddingHorizontal: 7,
    borderRadius: 10,
    backgroundColor: "rgba(236,72,153,0.18)",
    borderWidth: 1,
    borderColor: "rgba(236,72,153,0.45)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2,
  },
  countText: {
    color: "#FBCFE8",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    color: "rgba(228,228,231,0.55)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  row: { paddingHorizontal: 16, gap: 14 },
  tile: { alignItems: "center", width: 72, gap: 4 },
  tileRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    padding: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  tileInner: {
    width: "100%",
    height: "100%",
    borderRadius: 32,
    backgroundColor: "#0a0a0a",
    padding: 1.5,
    overflow: "hidden",
  },
  tilePhoto: { width: "100%", height: "100%", borderRadius: 30 },
  tilePhotoFallback: {
    backgroundColor: "#1f1029",
    alignItems: "center",
    justifyContent: "center",
  },
  tileName: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginTop: 4,
    textAlign: "center",
    maxWidth: 72,
  },
  tileHint: {
    color: "rgba(236,72,153,0.85)",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
