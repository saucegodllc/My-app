import { useAuth, useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { apiUrl } from "@/lib/apiBase";
import { useGetMyProfile, useGetSubscriptionStatus, useGetSavedVenues } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function ProfileScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { signOut, getToken } = useAuth();
  const { user, isSignedIn } = useUser();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const [updatingPhoto, setUpdatingPhoto] = useState(false);

  const { data: profile, isLoading, refetch } = useGetMyProfile({ query: { enabled: !!isSignedIn, refetchOnMount: "always" } });
  const { data: subscription } = useGetSubscriptionStatus({ query: { enabled: !!isSignedIn } });
  const { data: savedVenuesData } = useGetSavedVenues({ query: { enabled: !!isSignedIn } });
  const savedVenueCount = savedVenuesData?.placeIds?.length ?? 0;

  // If profile has no photos stored but Clerk has a *real* user-uploaded image,
  // silently patch photos[0] with the Clerk imageUrl. We only do this when
  // user.hasImage is true so we never overwrite with the generated default avatar.
  useEffect(() => {
    if (!profile || !user?.imageUrl || !user?.hasImage) return;
    if ((profile.photos as string[] | undefined)?.length) return; // already has photos
    getToken().then((token) => {
      fetch(apiUrl("/api/profiles/me"), {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          displayName: profile.displayName,
          bio: profile.bio ?? undefined,
          birthDate: profile.birthDate ?? undefined,
          gender: profile.gender ?? undefined,
          location: profile.location ?? undefined,
          country: profile.country ?? undefined,
          intent: profile.intent ?? undefined,
          interests: (profile.interests as string[] | undefined) ?? [],
          languages: (profile.languages as string[] | undefined) ?? [],
          photos: [user.imageUrl],
        }),
      }).then((r) => { if (r.ok) refetch(); }).catch(() => {});
    });
  }, [profile?.userId, user?.imageUrl, user?.hasImage]);

  const PHOTO_SIZE = SCREEN_WIDTH / 3 - 2;

  async function updateProfilePhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Please allow photo library access in your device Settings.");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
      base64: true,
    });
    if (picked.canceled || !picked.assets?.[0]) return;
    const uri = picked.assets[0].uri;
    const pickerBase64 = picked.assets[0].base64 ?? null;
    setUpdatingPhoto(true);
    try {
      const token = await getToken();

      // Get base64 from picker (preferred) or read from file as fallback
      let base64: string;
      if (pickerBase64) {
        base64 = pickerBase64;
      } else if (Platform.OS === "web") {
        const imgRes = await fetch(uri);
        const blob = await imgRes.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        base64 = btoa(binary);
      } else {
        base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: "base64",
        });
      }

      const uploadRes = await fetch(
        apiUrl("/api/profiles/me/photos"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ base64, contentType: "image/jpeg" }),
        }
      );
      if (!uploadRes.ok) {
        Alert.alert("Upload failed", "Photo could not be saved. Please try again.");
        return;
      }
      const { url: photoUrl } = (await uploadRes.json()) as { url: string };
      const existing = (profile?.photos ?? []) as string[];
      const updated = [photoUrl, ...existing.slice(1)];

      const profileRes = await fetch(
        apiUrl("/api/profiles/me"),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ photos: updated }),
        }
      );
      if (profileRes.ok) {
        // Also sync to Clerk so the profile avatar always reflects the latest photo
        try {
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const blob = new Blob([bytes], { type: "image/jpeg" });
          await user?.setProfileImage({ file: blob as File });
          await user?.reload();
        } catch (_) {}
        await refetch();
      } else {
        Alert.alert("Error", "Photo uploaded but profile was not updated. Please try again.");
      }
    } catch (e) {
      Alert.alert("Error", "Something went wrong uploading your photo. Please try again.");
    } finally {
      setUpdatingPhoto(false);
    }
  }

  if (!isSignedIn) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Ionicons name="person-circle-outline" size={64} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t("profile.notSignedIn")}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.headerBar, { paddingTop: topInset + 8 }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("profile.title")}</Text>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => router.push("/settings" as any)}
            style={styles.headerBtn}
            testID="settings-btn"
          >
            <Ionicons name="settings-outline" size={24} color={colors.foreground} />
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={styles.profileSection}>
            <View style={styles.avatarContainer}>
              <Pressable onPress={updateProfilePhoto} disabled={updatingPhoto}>
                {/* Only show a photo if there's a real one — not the Clerk-generated default avatar */}
              {(profile?.photos?.[0] || (user?.hasImage && user?.imageUrl)) ? (
                  <Image
                    source={{ uri: profile?.photos?.[0] || user?.imageUrl! }}
                    style={[styles.avatar, { backgroundColor: colors.muted }]}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.avatarEmpty, { backgroundColor: colors.muted }]}>
                    {updatingPhoto ? (
                      <ActivityIndicator color="#fff" size="large" />
                    ) : (
                      <>
                        <Ionicons name="camera" size={28} color={colors.primary} />
                        <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.primary, marginTop: 4 }}>
                          Add Photo
                        </Text>
                      </>
                    )}
                  </View>
                )}
                {(profile?.photos?.[0] || (user?.hasImage && user?.imageUrl)) && (
                  <View style={[styles.cameraOverlay, { backgroundColor: colors.primary }]}>
                    {updatingPhoto ? (
                      <ActivityIndicator color="#fff" size={12} />
                    ) : (
                      <Ionicons name="camera" size={14} color="#fff" />
                    )}
                  </View>
                )}
              </Pressable>
              {subscription?.isPremium && (
                <LinearGradient
                  colors={[colors.primary, colors.accent]}
                  style={styles.premiumBadge}
                >
                  <Ionicons name="star" size={12} color="#fff" />
                </LinearGradient>
              )}
            </View>

            <Text style={[styles.displayName, { color: colors.foreground }]}>
              {profile?.displayName ?? user?.firstName ?? "Your Name"}
              {profile?.age ? `, ${profile.age}` : ""}
            </Text>

            {profile?.profession && (
              <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: colors.mutedForeground, marginTop: -2, marginBottom: 2 }}>
                {profile.profession}
              </Text>
            )}

            {profile?.role && (
              <View style={{ alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.primary + "20", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: colors.primary + "50", marginBottom: 4 }}>
                <Ionicons name="person-circle-outline" size={12} color={colors.primary} />
                <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.primary, letterSpacing: 0.5 }}>
                  {profile.role.charAt(0).toUpperCase() + profile.role.slice(1).replace(/([A-Z])/g, " $1")}
                </Text>
              </View>
            )}

            {profile?.location && (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={14} color={colors.mutedForeground} />
                <Text style={[styles.location, { color: colors.mutedForeground }]}>
                  {profile.location}
                  {profile.country ? `, ${profile.country}` : ""}
                </Text>
              </View>
            )}

            {profile?.bio && (
              <Text style={[styles.bio, { color: colors.mutedForeground }]}>{profile.bio}</Text>
            )}

            <View style={styles.intentRow}>
              {profile?.intent && (
                <View style={[styles.intentBadge, { backgroundColor: colors.primary + "20", borderColor: colors.primary + "50" }]}>
                  <Ionicons
                    name={profile.intent === "dating" ? "flame" : "people"}
                    size={13}
                    color={colors.primary}
                  />
                  <Text style={[styles.intentText, { color: colors.primary }]}>
                    {profile.intent.charAt(0).toUpperCase() + profile.intent.slice(1)}
                  </Text>
                </View>
              )}
              {profile?.connectionSubtype && (
                <View style={[styles.intentBadge, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  <Text style={[styles.intentText, { color: colors.foreground }]}>
                    {profile.connectionSubtype}
                  </Text>
                </View>
              )}
              {profile?.isVerified && (
                <View style={[styles.verifiedBadge, { backgroundColor: "#60A5FA20", borderColor: "#60A5FA50" }]}>
                  <Ionicons name="checkmark-circle" size={13} color="#60A5FA" />
                  <Text style={[styles.intentText, { color: "#60A5FA" }]}>{t("profile.verified", "Verified")}</Text>
                </View>
              )}
              {savedVenueCount > 0 && (
                <View style={[styles.intentBadge, { backgroundColor: "#FF299B20", borderColor: "#FF299B50" }]}>
                  <Ionicons name="bookmark" size={13} color="#FF299B" />
                  <Text style={[styles.intentText, { color: "#FF299B" }]}>
                    {savedVenueCount} Saved {savedVenueCount === 1 ? "Spot" : "Spots"}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {!subscription?.isPremium && (
            <Pressable
              onPress={() => router.push("/premium" as any)}
              testID="upgrade-btn"
            >
              {({ pressed }) => (
                <LinearGradient
                  colors={[colors.primary, colors.accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.premiumBanner, { opacity: pressed ? 0.9 : 1 }]}
                >
                  <View>
                    <Text style={styles.premiumBannerTitle}>{t("profile.upgrade")}</Text>
                    <Text style={styles.premiumBannerSubtitle}>{t("premium.perks.unlimited")} · {t("premium.perks.seeWhoLiked")}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </LinearGradient>
              )}
            </Pressable>
          )}

          {profile?.languages && profile.languages.length > 0 && (
            <View style={[styles.section, { borderTopColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("profile.languages")}</Text>
              <View style={styles.interestsGrid}>
                {profile.languages.map((lang) => (
                  <View key={lang} style={[styles.langChip, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "40" }]}>
                    <Ionicons name="language-outline" size={13} color={colors.primary} />
                    <Text style={[styles.interestText, { color: colors.primary }]}>{lang}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {profile?.interests && profile.interests.length > 0 && (
            <View style={[styles.section, { borderTopColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("profile.interests")}</Text>
              <View style={styles.interestsGrid}>
                {profile.interests.map((interest) => (
                  <View key={interest} style={[styles.interestChip, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                    <Text style={[styles.interestText, { color: colors.foreground }]}>{interest}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {(profile?.photos?.length ?? 0) > 1 && (
            <View style={[styles.section, { borderTopColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Photos</Text>
              <View style={styles.photosGrid}>
                {profile?.photos?.map((photo, index) => (
                  <Image
                    key={index}
                    source={{ uri: photo }}
                    style={[styles.photoThumb, { width: PHOTO_SIZE, height: PHOTO_SIZE, backgroundColor: colors.muted }]}
                    contentFit="cover"
                  />
                ))}
              </View>
            </View>
          )}

          <View style={[styles.section, { borderTopColor: colors.border }]}>
            <Pressable
              onPress={() => router.push("/settings" as any)}
              style={({ pressed }) => [styles.menuItem, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Ionicons name="create-outline" size={20} color={colors.foreground} />
              <Text style={[styles.menuText, { color: colors.foreground }]}>Edit Profile</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} style={{ marginLeft: "auto" }} />
            </Pressable>
            <Pressable
              onPress={() => router.push("/resume" as any)}
              style={({ pressed }) => [styles.menuItem, { opacity: pressed ? 0.7 : 1 }]}
              testID="resume-btn"
            >
              <Ionicons name="document-text-outline" size={20} color={colors.foreground} />
              <Text style={[styles.menuText, { color: colors.foreground }]}>Attach Resume</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} style={{ marginLeft: "auto" }} />
            </Pressable>
            <Pressable
              onPress={() => signOut().then(() => router.replace("/(auth)/welcome"))}
              style={({ pressed }) => [styles.menuItem, { opacity: pressed ? 0.7 : 1 }]}
              testID="sign-out-btn"
            >
              <Ionicons name="log-out-outline" size={20} color={colors.destructive} />
              <Text style={[styles.menuText, { color: colors.destructive }]}>Sign Out</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  headerBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  headerActions: { flexDirection: "row", gap: 8 },
  headerBtn: { padding: 6 },
  profileSection: { alignItems: "center", paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24, gap: 10 },
  avatarContainer: { position: "relative" },
  cameraOverlay: { position: "absolute", bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#0a0a0a" },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarEmpty: { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center" },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  premiumBadge: { position: "absolute", bottom: 2, right: 2, width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#0a0a0a" },
  displayName: { fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  location: { fontSize: 13, fontFamily: "Inter_400Regular" },
  bio: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20, paddingHorizontal: 12 },
  intentRow: { flexDirection: "row", gap: 8 },
  intentBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  intentText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  premiumBanner: { marginHorizontal: 16, borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  premiumBannerTitle: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  premiumBannerSubtitle: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontFamily: "Inter_400Regular" },
  section: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  interestsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  interestChip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6 },
  langChip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 5 },
  interestText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  photosGrid: { flexDirection: "row", flexWrap: "wrap", gap: 2 },
  photoThumb: { borderRadius: 4 },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  menuText: { fontSize: 16, fontFamily: "Inter_500Medium" },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_600SemiBold" },
});
