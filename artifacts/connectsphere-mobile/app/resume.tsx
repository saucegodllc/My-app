import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as FileSystem from "expo-file-system";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

type DetectResult = {
  isResume: boolean;
  confidence: "high" | "medium" | "low";
  message: string;
};

export default function ResumeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<DetectResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileType, setFileType] = useState<"image" | "pdf" | null>(null);

  async function detectResume(base64: string, mimeType: string, name: string) {
    setUploading(true);
    setResult(null);
    try {
      const token = await getToken();
      const apiBase = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
      const res = await fetch(`${apiBase}/api/resume/detect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ base64, mimeType, fileName: name }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Detection failed");
      }
      const data = await res.json() as DetectResult;
      setResult(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      Alert.alert("Error", msg);
    } finally {
      setUploading(false);
    }
  }

  async function pickFromGallery() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Please allow access to your photo library.");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
      allowsEditing: false,
    });
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];
    if (!asset.base64) {
      Alert.alert("Error", "Could not read image data.");
      return;
    }
    const mime = asset.mimeType ?? "image/jpeg";
    const name = asset.fileName ?? "resume-image.jpg";
    setFileName(name);
    setFileType("image");
    await detectResume(asset.base64, mime, name);
  }

  async function pickPDF() {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets?.[0]) return;
      const asset = picked.assets[0];
      const name = asset.name ?? "resume.pdf";
      setFileName(name);
      setFileType("pdf");

      // Read PDF as base64
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await detectResume(base64, "application/pdf", name);
    } catch {
      Alert.alert("Error", "Could not open the file.");
    }
  }

  function reset() {
    setResult(null);
    setFileName(null);
    setFileType(null);
  }

  const confidenceColor =
    result?.confidence === "high"
      ? "#22c55e"
      : result?.confidence === "medium"
      ? "#f59e0b"
      : "#ef4444";

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topInset, paddingBottom: bottomInset }]}>
      <View style={styles.headerBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Attach Resume</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.body}>
        {/* Hero */}
        <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <LinearGradient
            colors={[colors.primary + "30", colors.accent + "20"]}
            style={styles.heroGradient}
          >
            <Ionicons name="document-text" size={52} color={colors.primary} />
          </LinearGradient>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>Upload your resume</Text>
          <Text style={[styles.heroSubtitle, { color: colors.mutedForeground }]}>
            Let employers and connections see your professional background.
            {"\n"}AI will verify it's actually a resume.
          </Text>
        </View>

        {/* Upload buttons */}
        {!uploading && !result && (
          <View style={styles.uploadButtons}>
            <Pressable onPress={pickFromGallery} style={({ pressed }) => [styles.uploadBtn, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}>
              <View style={[styles.uploadBtnIcon, { backgroundColor: colors.primary + "20" }]}>
                <Ionicons name="images-outline" size={26} color={colors.primary} />
              </View>
              <View style={styles.uploadBtnText}>
                <Text style={[styles.uploadBtnTitle, { color: colors.foreground }]}>Camera Roll</Text>
                <Text style={[styles.uploadBtnSubtitle, { color: colors.mutedForeground }]}>JPG, PNG, or WEBP image</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
            </Pressable>

            <Pressable onPress={pickPDF} style={({ pressed }) => [styles.uploadBtn, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}>
              <View style={[styles.uploadBtnIcon, { backgroundColor: "#ef444420" }]}>
                <Ionicons name="document-outline" size={26} color="#ef4444" />
              </View>
              <View style={styles.uploadBtnText}>
                <Text style={[styles.uploadBtnTitle, { color: colors.foreground }]}>PDF File</Text>
                <Text style={[styles.uploadBtnSubtitle, { color: colors.mutedForeground }]}>Pick a PDF from your files</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
            </Pressable>
          </View>
        )}

        {/* Loading */}
        {uploading && (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingTitle, { color: colors.foreground }]}>Analyzing with AI…</Text>
            <Text style={[styles.loadingSubtitle, { color: colors.mutedForeground }]}>
              Checking if this is a real resume
            </Text>
          </View>
        )}

        {/* Result */}
        {result && !uploading && (
          <View style={styles.resultSection}>
            <View
              style={[
                styles.resultCard,
                {
                  backgroundColor: result.isResume ? "#22c55e15" : "#ef444415",
                  borderColor: result.isResume ? "#22c55e50" : "#ef444450",
                },
              ]}
            >
              <Ionicons
                name={result.isResume ? "checkmark-circle" : "close-circle"}
                size={48}
                color={result.isResume ? "#22c55e" : "#ef4444"}
              />
              <Text style={[styles.resultTitle, { color: result.isResume ? "#22c55e" : "#ef4444" }]}>
                {result.isResume ? "Resume Verified ✓" : "Not a Resume"}
              </Text>
              <Text style={[styles.resultMessage, { color: colors.foreground }]}>
                {result.message}
              </Text>
              <View style={[styles.confidenceBadge, { backgroundColor: confidenceColor + "20" }]}>
                <Text style={[styles.confidenceText, { color: confidenceColor }]}>
                  {result.confidence.charAt(0).toUpperCase() + result.confidence.slice(1)} confidence
                </Text>
              </View>
            </View>

            {fileName && (
              <View style={[styles.fileRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons
                  name={fileType === "pdf" ? "document-text-outline" : "image-outline"}
                  size={20}
                  color={colors.mutedForeground}
                />
                <Text style={[styles.fileName, { color: colors.foreground }]} numberOfLines={1}>
                  {fileName}
                </Text>
              </View>
            )}

            <View style={styles.resultActions}>
              {result.isResume && (
                <Pressable onPress={() => Alert.alert("Saved", "Your resume has been attached to your profile.")}>
                  {({ pressed }) => (
                    <LinearGradient
                      colors={[colors.primary, colors.accent]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.saveButton, { opacity: pressed ? 0.8 : 1 }]}
                    >
                      <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                      <Text style={styles.saveButtonText}>Save to Profile</Text>
                    </LinearGradient>
                  )}
                </Pressable>
              )}

              <Pressable
                onPress={reset}
                style={[styles.tryAgainButton, { borderColor: colors.border }]}
              >
                <Text style={[styles.tryAgainText, { color: colors.mutedForeground }]}>
                  {result.isResume ? "Upload a different one" : "Try another file"}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        <Text style={[styles.tip, { color: colors.mutedForeground }]}>
          Tip: Upload a photo of your printed resume or a PDF from Google Drive or iCloud.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { padding: 4, width: 40 },
  headerTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  body: { flex: 1, paddingHorizontal: 20, gap: 20, paddingTop: 8 },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    paddingBottom: 20,
    gap: 12,
  },
  heroGradient: {
    width: "100%",
    alignItems: "center",
    paddingVertical: 28,
  },
  heroTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  heroSubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20, paddingHorizontal: 16 },
  uploadButtons: { gap: 12 },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  uploadBtnIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadBtnText: { flex: 1, gap: 3 },
  uploadBtnTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  uploadBtnSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular" },
  loadingCard: { alignItems: "center", gap: 14, paddingVertical: 32 },
  loadingTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  loadingSubtitle: { fontSize: 14, fontFamily: "Inter_400Regular" },
  resultSection: { gap: 14 },
  resultCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  resultTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  resultMessage: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  confidenceBadge: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginTop: 4 },
  confidenceText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fileName: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  resultActions: { gap: 10 },
  saveButton: {
    height: 52,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveButtonText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  tryAgainButton: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tryAgainText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  tip: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18, paddingHorizontal: 8 },
});
