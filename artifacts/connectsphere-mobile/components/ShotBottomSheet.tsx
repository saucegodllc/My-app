import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export type ShotTarget = {
  name: string;
  image?: string;
  photos?: string[];
};

type Props = {
  visible: boolean;
  target: ShotTarget | null;
  sending?: boolean;
  error?: string | null;
  premiumRequired?: boolean;
  onClose: () => void;
  onSend: (message: string) => Promise<boolean> | boolean;
};

const SUGGESTIONS = [
  "Coffee or cocktails?",
  "Your vibe caught my attention.",
  "What's your perfect Miami night?",
  "I had to shoot my shot.",
];

export function ShotBottomSheet({
  visible,
  target,
  sending = false,
  error,
  premiumRequired,
  onClose,
  onSend,
}: Props) {
  const [message, setMessage] = useState("");
  const [localSending, setLocalSending] = useState(false);
  const slide = useRef(new Animated.Value(28)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const count = message.length;
  const photo = target?.image ?? target?.photos?.[0];
  const disabled = count === 0 || count > 120 || sending || localSending;

  useEffect(() => {
    if (visible) {
      setMessage("");
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(slide, { toValue: 0, damping: 20, stiffness: 220, useNativeDriver: true }),
      ]).start();
    } else {
      fade.setValue(0);
      slide.setValue(28);
    }
  }, [fade, slide, visible]);

  const handleSend = async () => {
    if (disabled) return;
    setLocalSending(true);
    const ok = await onSend(message.trim());
    setLocalSending(false);
    if (ok) onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboard}>
          <Animated.View style={[styles.sheet, { transform: [{ translateY: slide }] }]}>
            <LinearGradient
              colors={["rgba(236,72,153,0.18)", "rgba(168,85,247,0.10)", "rgba(0,0,0,0)"]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View style={styles.handle} />

            <View style={styles.header}>
              <View>
                <Text style={styles.eyebrow}>Shot</Text>
                <Text style={styles.title}>Shoot Your Shot</Text>
                <Text style={styles.subtitle}>Send one message before matching.</Text>
              </View>
              <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
                <Ionicons name="close" size={20} color="#fff" />
              </Pressable>
            </View>

            {target ? (
              <View style={styles.personRow}>
                {photo ? (
                  <Image source={{ uri: photo }} style={styles.avatar} contentFit="cover" />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Ionicons name="person" size={20} color="#fff" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.personName}>{target.name}</Text>
                  <Text style={styles.personSub}>One opener. No chat unless they accept.</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.inputWrap}>
              <TextInput
                value={message}
                onChangeText={(value) => setMessage(value.slice(0, 120))}
                placeholder="Say something worth replying to..."
                placeholderTextColor="rgba(255,255,255,0.35)"
                multiline
                maxLength={120}
                style={styles.input}
              />
              <Text style={[styles.counter, count > 110 && styles.counterHot]}>{count}/120</Text>
            </View>

            <View style={styles.suggestions}>
              {SUGGESTIONS.map((suggestion) => (
                <Pressable key={suggestion} onPress={() => setMessage(suggestion)} style={styles.suggestionChip}>
                  <Ionicons name="chatbubble-ellipses" size={12} color="#F9A8D4" />
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </Pressable>
              ))}
            </View>

            {error ? (
              <View style={[styles.notice, premiumRequired && styles.noticePremium]}>
                <Ionicons name={premiumRequired ? "diamond" : "alert-circle"} size={15} color={premiumRequired ? "#FBCFE8" : "#FDA4AF"} />
                <Text style={styles.noticeText}>
                  {premiumRequired ? "You're out of free Shots today. Upgrade for more." : error}
                </Text>
              </View>
            ) : null}

            <Pressable onPress={handleSend} disabled={disabled} style={[styles.sendBtn, disabled && styles.sendBtnDisabled]}>
              <LinearGradient
                colors={disabled ? ["rgba(255,255,255,0.10)", "rgba(255,255,255,0.06)"] : ["#EC4899", "#A855F7"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.sendGrad}
              >
                <Ionicons name="send" size={16} color="#fff" />
                <Text style={styles.sendText}>{sending || localSending ? "Sending..." : "Send Shot"}</Text>
              </LinearGradient>
            </Pressable>

            <Pressable onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

export function ShotToast({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View pointerEvents="none" style={styles.toastLayer}>
        <View style={styles.toast}>
          <Ionicons name="chatbubble-ellipses" size={16} color="#F9A8D4" />
          <View>
            <Text style={styles.toastTitle}>Shot sent 💬</Text>
            <Text style={styles.toastSub}>Now wait for them to catch it.</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "flex-end",
  },
  keyboard: { justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: "#090007",
    borderWidth: 1,
    borderColor: "rgba(236,72,153,0.28)",
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 24,
    overflow: "hidden",
    shadowColor: "#EC4899",
    shadowOpacity: 0.38,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: -10 },
    elevation: 18,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.20)",
    marginBottom: 18,
  },
  header: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  eyebrow: {
    color: "#F9A8D4",
    fontSize: 11,
    fontFamily: "Inter_800ExtraBold",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  title: { color: "#fff", fontSize: 26, fontFamily: "Sora_800ExtraBold", marginTop: 3 },
  subtitle: { color: "rgba(255,255,255,0.62)", fontSize: 13, fontFamily: "Inter_500Medium", marginTop: 4 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  personRow: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 10,
  },
  avatar: { width: 48, height: 48, borderRadius: 16 },
  avatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(236,72,153,0.22)" },
  personName: { color: "#fff", fontSize: 15, fontFamily: "Inter_800ExtraBold" },
  personSub: { color: "rgba(255,255,255,0.52)", fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  inputWrap: {
    minHeight: 116,
    marginTop: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(236,72,153,0.24)",
    backgroundColor: "rgba(0,0,0,0.34)",
    padding: 14,
  },
  input: {
    color: "#fff",
    minHeight: 74,
    textAlignVertical: "top",
    fontSize: 16,
    lineHeight: 22,
    fontFamily: "Inter_500Medium",
  },
  counter: { alignSelf: "flex-end", color: "rgba(255,255,255,0.45)", fontSize: 12, fontFamily: "Inter_700Bold" },
  counterHot: { color: "#F9A8D4" },
  suggestions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  suggestionText: { color: "#FCE7F3", fontSize: 12, fontFamily: "Inter_700Bold" },
  notice: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 16,
    padding: 10,
    backgroundColor: "rgba(244,63,94,0.12)",
    borderWidth: 1,
    borderColor: "rgba(244,63,94,0.30)",
  },
  noticePremium: { backgroundColor: "rgba(236,72,153,0.16)", borderColor: "rgba(236,72,153,0.36)" },
  noticeText: { flex: 1, color: "#FCE7F3", fontSize: 12, fontFamily: "Inter_700Bold", lineHeight: 17 },
  sendBtn: { marginTop: 16, borderRadius: 999, overflow: "hidden" },
  sendBtnDisabled: { opacity: 0.58 },
  sendGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15 },
  sendText: { color: "#fff", fontSize: 14, fontFamily: "Inter_800ExtraBold" },
  cancelBtn: { alignItems: "center", paddingTop: 13 },
  cancelText: { color: "rgba(255,255,255,0.62)", fontSize: 13, fontFamily: "Inter_700Bold" },
  toastLayer: {
    flex: 1,
    alignItems: "center",
    paddingTop: 72,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(236,72,153,0.35)",
    backgroundColor: "rgba(8,0,7,0.92)",
    paddingHorizontal: 14,
    paddingVertical: 11,
    shadowColor: "#EC4899",
    shadowOpacity: 0.36,
    shadowRadius: 22,
  },
  toastTitle: { color: "#fff", fontSize: 13, fontFamily: "Inter_800ExtraBold" },
  toastSub: { color: "rgba(255,255,255,0.58)", fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 1 },
});
