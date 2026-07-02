import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFeedback } from "@/components/ActionFeedback";
import { openConnect, openPremium } from "@/lib/routes";

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
  initialMessage?: string;
  suggestions?: string[];
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
  initialMessage,
  suggestions,
  onClose,
  onSend,
}: Props) {
  const [message, setMessage] = useState("");
  // Ghost type-over suggestion (spec 4.1): renders dimmed inside the composer.
  // Tapping it (or pressing the main button) accepts it as editable real text;
  // typing replaces it. It is NEVER sent automatically.
  const [ghost, setGhost] = useState<string | null>(null);
  const [localSending, setLocalSending] = useState(false);
  const slide = useRef(new Animated.Value(28)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const count = message.length;
  const photo = target?.image ?? target?.photos?.[0];
  const hasGhost = !!ghost && count === 0;
  const disabled = (count === 0 && !hasGhost) || count > 120 || sending || localSending || !!premiumRequired;

  const { trigger: triggerFeedback, animatedStyle: sendBtnAnim, BurstOverlay } = useFeedback("shot");

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: 170, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(slide, { toValue: 36, duration: 190, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(onClose);
  };

  useEffect(() => {
    if (visible) {
      // When a suggestion was pre-chosen outside the sheet (from ExpandedProfileCard),
      // land it directly in the editable input — the user already picked it deliberately.
      // Inline sheet chips (below the input) still use ghost so they don't auto-send.
      // The "Send Shot" button still requires an explicit tap, so spec 4.1 is satisfied.
      if (initialMessage) {
        setMessage(initialMessage.slice(0, 120));
        setGhost(null);
      } else {
        setMessage("");
        setGhost(null);
      }
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(slide, { toValue: 0, damping: 20, stiffness: 220, useNativeDriver: true }),
      ]).start();
    } else {
      fade.setValue(0);
      slide.setValue(28);
    }
  }, [fade, initialMessage, slide, visible]);

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  const acceptGhost = () => {
    if (!ghost) return;
    setMessage(ghost);
    setGhost(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const handleChangeText = (value: string) => {
    if (value.length > 0) setGhost(null); // typing replaces the ghost
    setMessage(value.slice(0, 120));
  };

  const handleSend = async () => {
    // With a ghost showing, the main button ACCEPTS the suggestion as editable
    // text — it never auto-sends (spec 4.1).
    if (hasGhost) {
      acceptGhost();
      return;
    }
    if (disabled) return;
    setLocalSending(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const ok = await onSend(message.trim());
    setLocalSending(false);
    if (ok) {
      triggerFeedback();
      // brief delay so burst is visible before sheet closes
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = setTimeout(dismiss, 520);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={dismiss}>
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
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
              <Pressable
                accessibilityRole="button"
                testID="shot-close-button"
                onPress={dismiss}
                style={styles.closeBtn}
                hitSlop={10}
              >
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
                onChangeText={handleChangeText}
                placeholder={hasGhost ? undefined : "Say something worth replying to..."}
                placeholderTextColor="rgba(255,255,255,0.35)"
                multiline
                maxLength={120}
                style={styles.input}
              />
              {hasGhost ? (
                <Pressable
                  onPress={acceptGhost}
                  style={styles.ghostOverlay}
                  testID="shot-ghost-suggestion"
                  accessibilityLabel="Suggested opener — tap to use"
                >
                  <Text style={styles.ghostText}>{ghost}</Text>
                  <Text style={styles.ghostHint}>Tap to use — or just start typing</Text>
                </Pressable>
              ) : null}
              <Text style={[styles.counter, count > 110 && styles.counterHot]}>{count}/120</Text>
            </View>

            <View style={styles.suggestions}>
              {(suggestions?.length ? suggestions : SUGGESTIONS).map((suggestion) => (
                <Pressable
                  key={suggestion}
                  onPress={() => {
                    // Chips land as a ghost too — editable starter, never a send
                    setMessage("");
                    setGhost(suggestion.slice(0, 120));
                  }}
                  style={styles.suggestionChip}
                >
                  <Ionicons name="chatbubble-ellipses" size={12} color="#F9A8D4" />
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </Pressable>
              ))}
            </View>

            {premiumRequired ? (
              <View style={styles.premiumBanner}>
                <LinearGradient
                  colors={["rgba(236,72,153,0.22)", "rgba(168,85,247,0.18)"]}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
                <View style={styles.premiumBannerRow}>
                  <Ionicons name="diamond" size={22} color="#F9A8D4" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.premiumBannerTitle}>You've used your free Shot today</Text>
                    <Text style={styles.premiumBannerSub}>ConnectSphere Plus gives you unlimited Shots, no waiting.</Text>
                  </View>
                </View>
                <Pressable style={styles.premiumCta} onPress={() => {
                  dismiss();
                  openPremium("shots");
                }}>
                  <LinearGradient colors={["#EC4899", "#A855F7"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.premiumCtaGrad}>
                    <Ionicons name="diamond-outline" size={15} color="#fff" />
                    <Text style={styles.premiumCtaText}>Upgrade to ConnectSphere Plus</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            ) : error ? (
              <View style={styles.notice}>
                <Ionicons name="alert-circle" size={15} color="#FDA4AF" />
                <Text style={styles.noticeText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.sendBtnWrap}>
              <BurstOverlay />
              <Animated.View style={[styles.sendBtn, disabled && styles.sendBtnDisabled, sendBtnAnim]}>
                <Pressable
                  accessibilityRole="button"
                  testID="shot-send-button"
                  onPress={handleSend}
                  disabled={disabled}
                  style={{ borderRadius: 999, overflow: "hidden" }}
                >
                  <LinearGradient
                    colors={disabled ? ["rgba(255,255,255,0.10)", "rgba(255,255,255,0.06)"] : ["#EC4899", "#A855F7"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.sendGrad}
                  >
                    <Ionicons name={hasGhost ? "create-outline" : "send"} size={16} color="#fff" />
                    <Text style={styles.sendText}>
                      {sending || localSending ? "Sending..." : hasGhost ? "Use suggestion" : "Send Shot"}
                    </Text>
                  </LinearGradient>
                </Pressable>
              </Animated.View>
            </View>

            <Pressable accessibilityRole="button" onPress={dismiss} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

export function ShotToast({
  visible,
  target,
  onClose,
}: {
  visible: boolean;
  target?: ShotTarget | null;
  onClose?: () => void;
}) {
  const [rendered, setRendered] = useState(visible);
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.86)).current;
  const lift = useRef(new Animated.Value(20)).current;
  const iconPulse = useRef(new Animated.Value(0)).current;
  const photo = target?.image ?? target?.photos?.[0];

  useEffect(() => {
    if (visible) {
      setRendered(true);
      fade.setValue(0);
      scale.setValue(0.86);
      lift.setValue(20);
      iconPulse.setValue(0);
      // Premium haptic burst — heavy impact then a success notification pulse
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      setTimeout(
        () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
        160,
      );
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, damping: 15, stiffness: 220, mass: 0.8, useNativeDriver: true }),
        Animated.spring(lift, { toValue: 0, damping: 18, stiffness: 210, useNativeDriver: true }),
      ]).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(iconPulse, { toValue: 1, duration: 620, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(iconPulse, { toValue: 0, duration: 620, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
        { iterations: 2 },
      ).start();
      return;
    }

    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: 170, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(scale, { toValue: 0.94, duration: 170, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(lift, { toValue: 12, duration: 170, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start(() => setRendered(false));
  }, [fade, iconPulse, lift, scale, visible]);

  if (!rendered) return null;

  const pulseScale = iconPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const ringOpacity = iconPulse.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.04] });

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[styles.toastLayer, { opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.shotSentCard, { transform: [{ translateY: lift }, { scale }] }]}>
          <LinearGradient colors={["rgba(236,72,153,0.30)", "rgba(168,85,247,0.16)", "rgba(0,0,0,0)"]} style={StyleSheet.absoluteFill} />
          <View style={styles.shotSentHero}>
            <Animated.View style={[styles.shotSentRing, { opacity: ringOpacity, transform: [{ scale: pulseScale }] }]} />
            <Animated.View style={[styles.shotSentIcon, { transform: [{ scale: pulseScale }] }]}>
              <Text style={{ fontSize: 30, lineHeight: 36 }}>🏀</Text>
            </Animated.View>
            {photo ? <Image source={{ uri: photo }} style={styles.shotSentAvatar} contentFit="cover" /> : null}
          </View>
          <Text style={styles.shotSentTitle}>Shot Sent!</Text>
          <Text style={styles.shotSentEmphasis}>Damn, you just shot your shot.</Text>
          <Text style={styles.shotSentSub}>
            {target?.name
              ? `Your opener landed in ${target.name}'s court. Now we wait. 🔥`
              : "Your opener is live. Ball's in their court now. 🔥"}
          </Text>
          <View style={styles.shotSentStats}>
            <View style={styles.shotSentStat}>
              <Ionicons name="basketball" size={13} color="#F9A8D4" />
              <Text style={styles.shotSentStatText}>Bold move</Text>
            </View>
            <View style={styles.shotSentStat}>
              <Ionicons name="chatbubble-ellipses" size={13} color="#C4B5FD" />
              <Text style={styles.shotSentStatText}>Reply unlocks chat</Text>
            </View>
          </View>
          <View style={styles.shotSentActions}>
            <Pressable onPress={onClose} style={styles.shotSentSecondary}>
              <Text style={styles.shotSentSecondaryText}>Keep Swiping</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                onClose?.();
                openConnect();
              }}
              style={styles.shotSentPrimary}
            >
              <LinearGradient colors={["#EC4899", "#A855F7"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.shotSentPrimaryGrad}>
                <Text style={styles.shotSentPrimaryText}>Go to Connect</Text>
                <Ionicons name="arrow-forward" size={15} color="#fff" />
              </LinearGradient>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
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
  // Ghost type-over suggestion (spec 4.1) — dimmed, clearly distinct from
  // real input text; sits over the empty composer.
  ghostOverlay: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    gap: 6,
  },
  ghostText: {
    color: "rgba(255,255,255,0.42)",
    fontSize: 16,
    lineHeight: 22,
    fontFamily: "Inter_500Medium",
    fontStyle: "italic",
  },
  ghostHint: {
    color: "rgba(249,168,212,0.55)",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
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
  noticeText: { flex: 1, color: "#FCE7F3", fontSize: 12, fontFamily: "Inter_700Bold", lineHeight: 17 },
  // ConnectSphere Plus upsell banner
  premiumBanner: {
    marginTop: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(236,72,153,0.45)",
    overflow: "hidden",
    padding: 14,
    gap: 12,
  },
  premiumBannerRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  premiumBannerTitle: { color: "#fff", fontSize: 14, fontFamily: "Inter_800ExtraBold", marginBottom: 3 },
  premiumBannerSub: { color: "rgba(255,255,255,0.65)", fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 17 },
  premiumCta: { borderRadius: 999, overflow: "hidden" },
  premiumCtaGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 12, paddingHorizontal: 18 },
  premiumCtaText: { color: "#fff", fontSize: 13, fontFamily: "Inter_800ExtraBold" },
  sendBtnWrap: { marginTop: 16, position: "relative" },
  sendBtn: { borderRadius: 999, overflow: "hidden" },
  sendBtnDisabled: { opacity: 0.58 },
  sendGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15 },
  sendText: { color: "#fff", fontSize: 14, fontFamily: "Inter_800ExtraBold" },
  cancelBtn: { alignItems: "center", paddingTop: 13 },
  cancelText: { color: "rgba(255,255,255,0.62)", fontSize: 13, fontFamily: "Inter_700Bold" },
  toastLayer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    backgroundColor: "rgba(0,0,0,0.68)",
  },
  shotSentCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(236,72,153,0.36)",
    backgroundColor: "rgba(8,0,7,0.96)",
    padding: 20,
    alignItems: "center",
    overflow: "hidden",
    shadowColor: "#EC4899",
    shadowOpacity: 0.44,
    shadowRadius: 34,
  },
  shotSentHero: { width: 96, height: 96, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  shotSentRing: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#EC4899",
  },
  shotSentIcon: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EC4899",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  shotSentAvatar: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: "#090007",
  },
  shotSentTitle: { color: "#fff", fontSize: 32, fontFamily: "Sora_800ExtraBold", letterSpacing: -0.6, marginTop: 2 },
  shotSentEmphasis: { color: "#F9A8D4", fontSize: 15, fontFamily: "Inter_800ExtraBold", textAlign: "center", marginTop: 4, letterSpacing: 0.2 },
  shotSentSub: { color: "rgba(255,255,255,0.65)", fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "center", lineHeight: 19, marginTop: 6 },
  shotSentStats: { flexDirection: "row", gap: 8, marginTop: 16, marginBottom: 18 },
  shotSentStat: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.07)", paddingHorizontal: 10, paddingVertical: 7 },
  shotSentStatText: { color: "#FCE7F3", fontSize: 11, fontFamily: "Inter_800ExtraBold" },
  shotSentActions: { width: "100%", gap: 10 },
  shotSentSecondary: { alignItems: "center", justifyContent: "center", minHeight: 46, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" },
  shotSentSecondaryText: { color: "rgba(255,255,255,0.76)", fontSize: 13, fontFamily: "Inter_800ExtraBold" },
  shotSentPrimary: { borderRadius: 16, overflow: "hidden" },
  shotSentPrimaryGrad: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  shotSentPrimaryText: { color: "#fff", fontSize: 14, fontFamily: "Inter_800ExtraBold" },
});
