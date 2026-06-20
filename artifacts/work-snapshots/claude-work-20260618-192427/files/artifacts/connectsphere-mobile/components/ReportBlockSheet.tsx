/**
 * ReportBlockSheet — reusable bottom sheet for reporting/blocking a user.
 * Satisfies Apple App Store Review Guideline 1.2 (user safety).
 *
 * Usage:
 *   <ReportBlockSheet
 *     visible={showSheet}
 *     targetUserId="user_abc"
 *     targetName="Maya"
 *     onClose={() => setShowSheet(false)}
 *   />
 */
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { customFetch } from "@workspace/api-client-react";
import { useFeedback } from "@/components/ActionFeedback";

const PINK = "#FF0080";
const BG = "#0a0a0a";
const CARD = "#141414";
const BORDER = "rgba(255,255,255,0.1)";
const MUTED = "rgba(255,255,255,0.45)";

const REPORT_REASONS = [
  { id: "inappropriate_content", label: "Inappropriate content", icon: "warning-outline" },
  { id: "harassment", label: "Harassment or bullying", icon: "hand-left-outline" },
  { id: "fake_profile", label: "Fake profile or spam", icon: "person-remove-outline" },
  { id: "underage", label: "Appears underage", icon: "shield-outline" },
  { id: "spam", label: "Spam", icon: "mail-unread-outline" },
  { id: "other", label: "Something else", icon: "ellipsis-horizontal-outline" },
] as const;

type ReportReason = (typeof REPORT_REASONS)[number]["id"];

type Props = {
  visible: boolean;
  targetUserId: string;
  targetName?: string;
  onClose: () => void;
  onBlocked?: () => void;
};

type SheetView = "menu" | "report" | "done";

export default function ReportBlockSheet({ visible, targetUserId, targetName, onClose, onBlocked }: Props) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(400)).current;
  const [view, setView] = useState<SheetView>("menu");
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { trigger: triggerReport, animatedStyle: reportBtnAnim, BurstOverlay: ReportBurst } = useFeedback("report");
  const { trigger: triggerBlock } = useFeedback("block");

  useEffect(() => {
    if (visible) {
      setView("menu");
      setSelectedReason(null);
      setDetails("");
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 65,
        friction: 11,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 400,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const handleBlock = () => {
    Alert.alert(
      `Block ${targetName ?? "this person"}?`,
      "They won't be able to see your profile or contact you. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            triggerBlock();
            try {
              await customFetch("/api/reports/block", {
                method: "POST",
                body: JSON.stringify({ blockedUserId: targetUserId }),
              });
              onClose();
              onBlocked?.();
            } catch {
              Alert.alert("Couldn't block", "Please try again.");
            }
          },
        },
      ],
    );
  };

  const handleSubmitReport = async () => {
    if (!selectedReason) return;
    setSubmitting(true);
    try {
      await customFetch("/api/reports", {
        method: "POST",
        body: JSON.stringify({
          reportedUserId: targetUserId,
          reason: selectedReason,
          details: details.trim() || undefined,
        }),
      });
      triggerReport();
      setView("done");
    } catch {
      Alert.alert("Error", "Couldn't submit report. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: insets.bottom + 16, transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Soft brand tint — matches ShotBottomSheet's sheet treatment so the
            safety surface feels native to the app, not a system dialog */}
        <LinearGradient
          colors={["rgba(236,72,153,0.10)", "rgba(168,85,247,0.05)", "rgba(0,0,0,0)"]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Handle */}
        <View style={styles.handle} />

        {/* ── Menu view ── */}
        {view === "menu" && (
          <>
            <Text style={styles.sheetTitle}>
              {targetName ? `Report or block ${targetName}` : "Report or block"}
            </Text>
            <Text style={styles.sheetSub}>Your safety matters. Reports are anonymous.</Text>

            <TouchableOpacity style={styles.menuRow} onPress={() => setView("report")} activeOpacity={0.8}>
              <View style={[styles.menuIcon, { backgroundColor: "#FF000020" }]}>
                <Ionicons name="flag-outline" size={20} color="#FF4444" />
              </View>
              <View style={styles.menuBody}>
                <Text style={styles.menuTitle}>Report</Text>
                <Text style={styles.menuSub}>Flag inappropriate behaviour</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={MUTED} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuRow} onPress={handleBlock} activeOpacity={0.8}>
              <View style={[styles.menuIcon, { backgroundColor: "#FF008020" }]}>
                <Ionicons name="ban-outline" size={20} color={PINK} />
              </View>
              <View style={styles.menuBody}>
                <Text style={styles.menuTitle}>Block</Text>
                <Text style={styles.menuSub}>Remove from your feed permanently</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={MUTED} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── Report view ── */}
        {view === "report" && (
          <>
            <TouchableOpacity onPress={() => setView("menu")} style={styles.backRow} activeOpacity={0.8}>
              <Ionicons name="chevron-back" size={20} color={MUTED} />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.sheetTitle}>What's going on?</Text>
            <Text style={styles.sheetSub}>Select the reason that best describes the issue.</Text>

            {REPORT_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason.id}
                style={[styles.reasonRow, selectedReason === reason.id && styles.reasonRowActive]}
                onPress={() => setSelectedReason(reason.id)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={reason.icon as any}
                  size={18}
                  color={selectedReason === reason.id ? PINK : MUTED}
                />
                <Text style={[styles.reasonText, selectedReason === reason.id && { color: "#fff" }]}>
                  {reason.label}
                </Text>
                {selectedReason === reason.id && (
                  <Ionicons name="checkmark-circle" size={18} color={PINK} style={{ marginLeft: "auto" }} />
                )}
              </TouchableOpacity>
            ))}

            {selectedReason === "other" && (
              <TextInput
                style={styles.detailsInput}
                placeholder="Tell us more (optional)"
                placeholderTextColor={MUTED}
                value={details}
                onChangeText={setDetails}
                multiline
                maxLength={200}
              />
            )}

            <View style={{ position: "relative" }}>
              <ReportBurst />
              <Animated.View style={reportBtnAnim}>
                <TouchableOpacity
                  style={[styles.submitBtn, (!selectedReason || submitting) && { opacity: 0.4 }]}
                  onPress={handleSubmitReport}
                  disabled={!selectedReason || submitting}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={[PINK, "#A855F7"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.submitGrad}
                  >
                    <Text style={styles.submitText}>{submitting ? "Submitting…" : "Submit Report"}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </>
        )}

        {/* ── Done view ── */}
        {view === "done" && (
          <View style={styles.doneView}>
            <View style={styles.doneIcon}>
              <Ionicons name="checkmark-circle" size={52} color={PINK} />
            </View>
            <Text style={styles.doneTitle}>Report submitted</Text>
            <Text style={styles.doneSub}>
              Thank you. We'll review this and take action if needed. Reports are always anonymous.
            </Text>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.cancelText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: CARD,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: "rgba(236,72,153,0.22)",
    overflow: "hidden",
    shadowColor: PINK,
    shadowOpacity: 0.25,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: -8 },
    elevation: 14,
  },
  handle: {
    width: 40, height: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  sheetTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18, color: "#fff",
    marginBottom: 4,
  },
  sheetSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13, color: MUTED,
    marginBottom: 20,
  },
  menuRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 18, padding: 14,
    marginBottom: 10, gap: 12,
    borderWidth: 1, borderColor: BORDER,
  },
  menuIcon: {
    width: 40, height: 40,
    borderRadius: 20,
    alignItems: "center", justifyContent: "center",
  },
  menuBody: { flex: 1 },
  menuTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#fff" },
  menuSub: { fontFamily: "Inter_400Regular", fontSize: 12, color: MUTED, marginTop: 2 },
  cancelBtn: {
    height: 48, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center", justifyContent: "center",
    marginTop: 6,
  },
  cancelText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: MUTED },
  backRow: {
    flexDirection: "row", alignItems: "center",
    gap: 4, marginBottom: 16,
  },
  backText: { fontFamily: "Inter_500Medium", fontSize: 14, color: MUTED },
  reasonRow: {
    flexDirection: "row", alignItems: "center",
    gap: 12, padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginBottom: 8,
    borderWidth: 1, borderColor: BORDER,
  },
  reasonRowActive: {
    borderColor: PINK,
    backgroundColor: "#1a0010",
  },
  reasonText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14, color: MUTED, flex: 1,
  },
  detailsInput: {
    backgroundColor: BG,
    borderRadius: 12,
    borderWidth: 1, borderColor: BORDER,
    color: "#fff",
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    padding: 14,
    minHeight: 80,
    marginBottom: 12,
    textAlignVertical: "top",
  },
  submitBtn: { borderRadius: 14, overflow: "hidden", marginTop: 4 },
  submitGrad: { height: 52, alignItems: "center", justifyContent: "center" },
  submitText: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
  doneView: { alignItems: "center", paddingVertical: 16 },
  doneIcon: {
    width: 88, height: 88,
    borderRadius: 44,
    backgroundColor: "#FF008018",
    alignItems: "center", justifyContent: "center",
    marginBottom: 16,
  },
  doneTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: "#fff", marginBottom: 8 },
  doneSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14, color: MUTED,
    textAlign: "center", lineHeight: 20,
    marginBottom: 24, maxWidth: 280,
  },
});
