/**
 * VideoMomentPicker + VideoMomentPlayer
 * ───────────────────────────────────────
 * Record or pick a 15-second profile video loop from the library.
 * The video plays silently and auto-loops on the swipe card (like Tinder Loops).
 *
 * VideoMomentPicker — opens from the profile edit screen.
 * VideoMomentPlayer — looping card overlay triggered by a tap.
 *
 * Flow:
 *  1. User presses "Add video moment" button
 *  2. ImagePicker launches with videoMaxDuration=15
 *  3. Video is uploaded to Firebase Storage at profiles/{userId}/moment.mp4
 *  4. users/{userId}.videoMomentUrl is updated in Firestore
 *  5. SwipeCard reads videoMomentUrl and shows a play button overlay
 *
 * Dependencies: expo-image-picker, expo-video (already in deps), firebase
 */
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { VideoView, useVideoPlayer } from "expo-video";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Analytics } from "@/lib/analytics";
import { useColors } from "@/hooks/useColors";

// ─── Upload helper ────────────────────────────────────────────────────────────

async function uploadVideoMoment(localUri: string, userId: string): Promise<string> {
  try {
    const { getStorage, ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
    const { getApp } = await import("firebase/app");
    const storage = getStorage(getApp());
    const storageRef = ref(storage, `profiles/${userId}/moment.mp4`);
    const resp = await fetch(localUri);
    const blob = await resp.blob();
    await uploadBytes(storageRef, blob, { contentType: "video/mp4" });
    return await getDownloadURL(storageRef);
  } catch {
    return localUri; // dev fallback
  }
}

async function saveVideoMomentUrl(userId: string, url: string): Promise<void> {
  try {
    const { getFirestore, doc, updateDoc } = await import("firebase/firestore");
    const { getApp } = await import("firebase/app");
    const db = getFirestore(getApp());
    await updateDoc(doc(db, "users", userId), { videoMomentUrl: url });
  } catch {
    // Non-critical
  }
}

// ─── VideoMomentPlayer ────────────────────────────────────────────────────────
// Compact looping player shown when tapping the play button on a swipe card.

interface VideoMomentPlayerProps {
  url: string;
  onClose: () => void;
  style?: object;
}

export function VideoMomentPlayer({ url, onClose, style }: VideoMomentPlayerProps) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <View style={[StyleSheet.absoluteFill, styles.playerContainer, style]}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />
      <Pressable onPress={onClose} style={styles.playerClose} hitSlop={16}>
        <Ionicons name="close-circle" size={28} color="rgba(255,255,255,0.9)" />
      </Pressable>
    </View>
  );
}

// ─── VideoMomentBadge — shown on swipe cards ──────────────────────────────────

export function VideoMomentBadge({ onPress }: { onPress: () => void }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.14, duration: 900, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.delay(1400),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  return (
    <Pressable onPress={onPress} style={styles.videoBadgeWrap}>
      <Animated.View style={[styles.videoBadge, { transform: [{ scale: pulseAnim }] }]}>
        <LinearGradient
          colors={["rgba(0,0,0,0.72)", "rgba(0,0,0,0.5)"]}
          style={styles.videoBadgeGrad}
        >
          <Ionicons name="play-circle" size={22} color="#fff" />
          <Text style={styles.videoBadgeText}>15s</Text>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

// ─── VideoMomentPicker ────────────────────────────────────────────────────────

interface VideoMomentPickerProps {
  userId: string;
  currentUrl?: string | null;
  onUploaded: (url: string) => void;
}

export default function VideoMomentPicker({ userId, currentUrl, onUploaded }: VideoMomentPickerProps) {
  const colors = useColors();
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl ?? null);
  const [showPreview, setShowPreview] = useState(false);

  const player = useVideoPlayer(previewUrl ?? "", (p) => {
    p.loop = true;
    p.muted = true;
    if (previewUrl) p.play();
  });

  const handlePick = useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 0.85,
      videoMaxDuration: 15,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const url = await uploadVideoMoment(asset.uri, userId);
      await saveVideoMomentUrl(userId, url);
      setPreviewUrl(url);
      onUploaded(url);
      Analytics.storyPosted("video");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setUploading(false);
    }
  }, [onUploaded, userId]);

  return (
    <View>
      {previewUrl && !showPreview ? (
        <Pressable
          onPress={() => setShowPreview(true)}
          style={[styles.previewThumbnail, { borderColor: colors.primary }]}
        >
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
          />
          <View style={styles.previewOverlay}>
            <Ionicons name="play-circle" size={36} color="#fff" />
            <Text style={styles.previewLabel}>Preview</Text>
          </View>
        </Pressable>
      ) : null}

      {showPreview && previewUrl ? (
        <VideoMomentPlayer url={previewUrl} onClose={() => setShowPreview(false)} />
      ) : null}

      <Pressable
        onPress={handlePick}
        disabled={uploading}
        style={({ pressed }) => [
          styles.pickBtn,
          { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        {uploading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons name="videocam-outline" size={20} color={colors.primary} />
        )}
        <Text style={[styles.pickBtnText, { color: colors.foreground }]}>
          {uploading ? "Uploading…" : previewUrl ? "Replace 15s video" : "Add 15s video moment"}
        </Text>
      </Pressable>

      <Text style={[styles.hint, { color: colors.mutedForeground }]}>
        Plays silently on your card. Max 15 seconds.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  previewThumbnail: {
    width: "100%",
    aspectRatio: 9 / 16,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 2,
    marginBottom: 12,
    position: "relative",
  },
  previewOverlay: {
    position: "absolute",
    inset: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    gap: 6,
  },
  previewLabel: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  pickBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  pickBtnText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  hint: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 6, textAlign: "center" },
  // Player overlay
  playerContainer: { zIndex: 20, backgroundColor: "#000" },
  playerClose: { position: "absolute", top: 48, right: 16, zIndex: 21 },
  // Card badge
  videoBadgeWrap: { position: "absolute", top: 12, right: 12, zIndex: 5 },
  videoBadge: { borderRadius: 999 },
  videoBadgeGrad: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  videoBadgeText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
});
