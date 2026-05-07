import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useGetProfile } from "@workspace/api-client-react";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const { isSignedIn } = useAuth();

  const { data: profile, isLoading } = useGetProfile(userId ?? "", { query: { enabled: !!userId && !!isSignedIn } });

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Profile not found</Text>
      </View>
    );
  }

  const mainPhoto = profile.photos?.[0];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Pressable
        onPress={() => router.back()}
        style={[styles.backBtn, { top: topInset + 8 }]}
      >
        <Ionicons name="chevron-back" size={26} color="#fff" />
      </Pressable>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomInset + 100 }}>
        <View style={{ height: SCREEN_WIDTH * 1.2 }}>
          {mainPhoto ? (
            <Image
              source={{ uri: mainPhoto }}
              style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.2 }}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.photoPlaceholder, { width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.2, backgroundColor: colors.muted }]}>
              <Ionicons name="person" size={80} color={colors.mutedForeground} />
            </View>
          )}
          <LinearGradient
            colors={["transparent", colors.background]}
            style={[styles.photoGradient, { height: SCREEN_WIDTH * 0.5 }]}
          />
        </View>

        <View style={styles.infoSection}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.foreground }]}>
              {profile.displayName}{profile.age ? `, ${profile.age}` : ""}
            </Text>
            {profile.isVerified && (
              <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
            )}
          </View>

          {profile.location && (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color={colors.mutedForeground} />
              <Text style={[styles.location, { color: colors.mutedForeground }]}>
                {profile.location}{profile.country ? `, ${profile.country}` : ""}
              </Text>
            </View>
          )}

          {profile.bio && (
            <Text style={[styles.bio, { color: colors.mutedForeground }]}>{profile.bio}</Text>
          )}

          {profile.interests && profile.interests.length > 0 && (
            <View style={styles.interestsSection}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Interests</Text>
              <View style={styles.interestsGrid}>
                {profile.interests.map((i) => (
                  <View key={i} style={[styles.chip, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                    <Text style={[styles.chipText, { color: colors.foreground }]}>{i}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: 16, fontFamily: "Inter_400Regular" },
  backBtn: { position: "absolute", left: 16, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  photoPlaceholder: { alignItems: "center", justifyContent: "center" },
  photoGradient: { position: "absolute", bottom: 0, left: 0, right: 0 },
  infoSection: { paddingHorizontal: 20, paddingTop: 8, gap: 12 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.3, flex: 1 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  location: { fontSize: 14, fontFamily: "Inter_400Regular" },
  bio: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  interestsSection: { gap: 10 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  interestsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
});
