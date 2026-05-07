import React, { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
  Dimensions,
  Platform,
  ActivityIndicator,
  AccessibilityInfo,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Ellipse, Defs, Mask, Rect, Circle } from "react-native-svg";
import {
  useFaceChallenge,
  CHALLENGE_LABELS,
  CHALLENGE_ICONS,
  type ChallengeType,
  type Phase,
} from "../hooks/useFaceChallenge";

const PINK = "#FF299B";
const { width: W, height: H } = Dimensions.get("window");
const OVAL_W  = W * 0.62;
const OVAL_H  = OVAL_W * 1.28;
const OVAL_CX = W / 2;
const OVAL_CY = H * 0.38;

// Explicit Ionicon type union to avoid `as any` casts
type IoniconName =
  | "close"
  | "checkmark-circle"
  | "close-circle"
  | "camera-outline"
  | "eye-outline"
  | "happy-outline"
  | "arrow-back-outline"
  | "arrow-forward-outline"
  | "swap-vertical-outline"
  | "scan-outline";

interface Props {
  domain: string;
  getToken: () => Promise<string | null>;
  onSuccess: () => void;
  onCancel: () => void;
}

// ── Detection progress ring ───────────────────────────────────────────────────
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function DetectionRing({ progress }: { progress: number }) {
  const R    = 32;
  const CIRC = 2 * Math.PI * R;
  const animProg = useRef(new Animated.Value(0)).current;
  const [displayPct, setDisplayPct] = useState(0);

  useEffect(() => {
    const id = animProg.addListener(({ value }) => setDisplayPct(Math.round(value * 100)));
    return () => animProg.removeListener(id);
  }, []);

  useEffect(() => {
    Animated.timing(animProg, { toValue: progress, duration: 310, useNativeDriver: false }).start();
  }, [progress]);

  const strokeDashoffset = animProg.interpolate({ inputRange: [0, 1], outputRange: [CIRC, 0] });

  return (
    <View style={{ width: 76, height: 76, alignItems: "center", justifyContent: "center" }}>
      <Svg width={76} height={76} style={{ position: "absolute" }}>
        <Circle cx={38} cy={38} r={R} stroke="rgba(255,255,255,0.12)" strokeWidth={3.5} fill="none" />
      </Svg>
      <Svg width={76} height={76} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <AnimatedCircle
          cx={38} cy={38} r={R}
          stroke={PINK}
          strokeWidth={3.5}
          fill="none"
          strokeDasharray={`${CIRC} ${CIRC}`}
          strokeDashoffset={strokeDashoffset as unknown as number}
          strokeLinecap="round"
        />
      </Svg>
      <Text style={styles.ringPct}>{displayPct}%</Text>
    </View>
  );
}

function ProgressDots({ passed, total }: { passed: number; total: number }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[styles.dot, i < passed && styles.dotDone]} />
      ))}
    </View>
  );
}

function CountdownRing({ value }: { value: number }) {
  const color = value <= 2 ? "#FF6060" : PINK;
  return (
    <View style={[styles.countdownBadge, { borderColor: color }]}>
      <Text style={[styles.countdownText, { color }]}>{value}s</Text>
    </View>
  );
}

function OvalGuide({ phase }: { phase: Phase }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (phase === "challenge") {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1.022, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,      duration: 750, useNativeDriver: true }),
      ]));
      loop.start();
      return () => loop.stop();
    }
    pulse.setValue(1);
  }, [phase]);

  return (
    <Animated.View
      style={{
        position: "absolute",
        top: OVAL_CY - OVAL_H / 2,
        left: OVAL_CX - OVAL_W / 2,
        width: OVAL_W,
        height: OVAL_H,
        transform: [{ scale: pulse }],
      }}
      pointerEvents="none"
    >
      <Svg width={OVAL_W} height={OVAL_H}>
        <Ellipse
          cx={OVAL_W / 2} cy={OVAL_H / 2}
          rx={OVAL_W / 2 - 3} ry={OVAL_H / 2 - 3}
          stroke={phase === "challenge" ? PINK : "rgba(255,255,255,0.5)"}
          strokeWidth={2.5}
          strokeDasharray="10 6"
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}

function CameraFallback({ onCancel }: { onCancel: () => void }) {
  return (
    <View style={[styles.container, { alignItems: "center", justifyContent: "center", gap: 20 }]}>
      <Ionicons name={"camera-outline" as IoniconName} size={52} color="rgba(255,255,255,0.4)" />
      <Text style={styles.errorTitle}>Camera access required</Text>
      <Text style={styles.errorSub}>Please allow camera access in device settings and try again.</Text>
      <Pressable onPress={onCancel} style={styles.cancelPill}>
        <Text style={styles.cancelPillText}>Go back</Text>
      </Pressable>
    </View>
  );
}

export function LivenessCamera({ domain, getToken, onSuccess, onCancel }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef     = useRef<CameraView | null>(null);
  const instructAnim  = useRef(new Animated.Value(1)).current;

  const {
    phase,
    currentChallenge,
    qualityHint,
    countdown,
    errorMsg,
    passedCount,
    totalChallenges,
    detectionProgress,
    detectorStatus,
    retry,
    triggerBlink,
    triggerSmile,
    triggerTurnLeft,
    triggerTurnRight,
    triggerNod,
  } = useFaceChallenge(domain, getToken, cameraRef, onSuccess, onCancel);

  const handleChallengeTap = () => {
    if (!currentChallenge) return;
    if (currentChallenge === "blink")       triggerBlink?.();
    else if (currentChallenge === "smile")  triggerSmile?.();
    else if (currentChallenge === "turn_left")  triggerTurnLeft?.();
    else if (currentChallenge === "turn_right") triggerTurnRight?.();
    else if (currentChallenge === "nod")        triggerNod?.();
  };

  useEffect(() => {
    Animated.sequence([
      Animated.timing(instructAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(instructAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    if (currentChallenge) {
      // Challenge-phase: announce the active challenge instruction.
      AccessibilityInfo.announceForAccessibility(CHALLENGE_LABELS[currentChallenge]);
    } else if (phase === "quality" && qualityHint) {
      // Quality-phase: announce every hint change so screen-reader users receive guidance.
      AccessibilityInfo.announceForAccessibility(qualityHint);
    }
  }, [currentChallenge, qualityHint, phase]);

  // ── Permission gate ───────────────────────────────────────────────────────
  if (!permission) {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={PINK} size="large" />
      </View>
    );
  }
  if (!permission.granted) {
    if (!permission.canAskAgain) return <CameraFallback onCancel={onCancel} />;
    requestPermission();
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={PINK} size="large" />
      </View>
    );
  }

  const challengeIconName: IoniconName = currentChallenge
    ? (CHALLENGE_ICONS[currentChallenge] as IoniconName)
    : ("scan-outline" as IoniconName);

  const showCamera  = phase !== "success" && phase !== "failed";
  const isLoading   = phase === "loading" || phase === "modelwait" || phase === "submitting";

  const instructionText =
    phase === "modelwait"  ? `Loading face model… (${detectorStatus})` :
    phase === "loading"    ? "Preparing session…" :
    phase === "quality"    ? qualityHint :
    phase === "challenge"  ? (currentChallenge ? CHALLENGE_LABELS[currentChallenge] : "") :
    phase === "submitting" ? "Verifying…" :
    phase === "success"    ? "Verification complete ✓" :
    phase === "failed"     ? (errorMsg || "Verification failed") : "";

  return (
    <View style={styles.container} accessible accessibilityLabel="Face liveness verification">
      {/* Camera */}
      {showCamera && (
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" zoom={0} />
      )}

      {/* Oval mask overlay */}
      {showCamera && (
        <Svg style={StyleSheet.absoluteFill} width={W} height={H} pointerEvents="none">
          <Defs>
            <Mask id="cutout">
              <Rect x={0} y={0} width={W} height={H} fill="white" />
              <Ellipse cx={OVAL_CX} cy={OVAL_CY} rx={OVAL_W / 2} ry={OVAL_H / 2} fill="black" />
            </Mask>
          </Defs>
          <Rect x={0} y={0} width={W} height={H} fill="rgba(0,0,0,0.55)" mask="url(#cutout)" />
        </Svg>
      )}

      {/* Oval guide border */}
      {showCamera && <OvalGuide phase={phase} />}

      {/* Header: cancel + dots */}
      <View style={styles.topBar}>
        <Pressable onPress={onCancel} style={styles.cancelBtn} accessibilityRole="button" accessibilityLabel="Cancel">
          <Ionicons name={"close" as IoniconName} size={20} color="#fff" />
        </Pressable>
        <ProgressDots passed={passedCount} total={totalChallenges} />
        <View style={{ width: 40 }} />
      </View>

      {/* Loading / submitting */}
      {isLoading && (
        <View style={styles.centeredOverlay}>
          <ActivityIndicator color={PINK} size="large" />
          <Text style={styles.loadingText}>{instructionText}</Text>
          {phase === "modelwait" && (
            <Text style={styles.loadingSub}>Face recognition model is downloading…</Text>
          )}
        </View>
      )}

      {/* Success */}
      {phase === "success" && (
        <View style={styles.resultOverlay}>
          <View style={styles.resultIconWrap}>
            <Ionicons name={"checkmark-circle" as IoniconName} size={72} color={PINK} />
          </View>
          <Text style={styles.resultTitle}>Verified! ✓</Text>
          <Text style={styles.resultSub}>You've passed face liveness verification.</Text>
        </View>
      )}

      {/* Failed */}
      {phase === "failed" && (
        <View style={styles.resultOverlay}>
          <View style={[styles.resultIconWrap, { backgroundColor: "rgba(255,60,60,0.12)" }]}>
            <Ionicons name={"close-circle" as IoniconName} size={72} color="#FF5555" />
          </View>
          <Text style={styles.resultTitle}>Verification failed</Text>
          <Text style={styles.resultSub}>{errorMsg || "Please try again in good lighting."}</Text>
          <Pressable onPress={retry} style={styles.retryBtn} accessibilityRole="button" accessibilityLabel="Try again">
            <Text style={styles.retryBtnText}>Try again</Text>
          </Pressable>
          <Pressable onPress={onCancel} accessibilityRole="button" accessibilityLabel="Go back">
            <Text style={styles.backLink}>Go back</Text>
          </Pressable>
        </View>
      )}

      {/* Quality + challenge instruction area */}
      {(phase === "quality" || phase === "challenge") && (
        <View style={styles.pillArea}>
          {/* Challenge icon + detection ring */}
          {phase === "challenge" && currentChallenge && (
            <View style={styles.challengeRow}>
              <DetectionRing progress={detectionProgress} />
              <View style={styles.challengeIconWrap}>
                <Ionicons name={challengeIconName} size={30} color={PINK} />
              </View>
            </View>
          )}

          {/* Instruction pill */}
          <Animated.View style={[styles.instructionPill, { opacity: instructAnim }]}>
            <Text style={styles.instructionText} accessibilityLiveRegion="polite">
              {instructionText}
            </Text>
            {phase === "challenge" && <CountdownRing value={countdown} />}
          </Animated.View>

          {/* Single tap button for every challenge type */}
          {phase === "challenge" && currentChallenge && (
            <Pressable
              onPress={handleChallengeTap}
              style={[styles.manualBtn, detectionProgress > 0 && styles.manualBtnActive]}
              accessibilityRole="button"
              accessibilityLabel="Tap to confirm action"
            >
              <Text style={styles.manualBtnText}>
                {currentChallenge === "blink"       ? "Tap when you blink 👁️" :
                 currentChallenge === "smile"       ? "Tap when you smile 😊" :
                 currentChallenge === "turn_left"   ? "Tap when facing left ←" :
                 currentChallenge === "turn_right"  ? "Tap when facing right →" :
                 currentChallenge === "nod"         ? "Tap when you nod ↕" : "Tap to confirm"}
              </Text>
            </Pressable>
          )}

          {/* Sub-text */}
          {phase === "challenge" && (
            <Text style={[styles.qualitySubtext, detectionProgress >= 0.9 && { color: PINK }]}>
              {detectionProgress >= 0.9 ? "Almost done…" : "Perform the action, then tap"}
            </Text>
          )}
          {phase === "quality" && (
            <Text style={styles.qualitySubtext}>Look straight ahead and hold still</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  topBar: {
    position: "absolute",
    top: Platform.OS === "ios" ? 56 : 32,
    left: 0, right: 0,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, zIndex: 20,
  },
  cancelBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center",
  },
  dotsRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  dot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.4)",
  },
  dotDone: {
    backgroundColor: PINK, borderColor: PINK,
    shadowColor: PINK, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 6, elevation: 4,
  },
  pillArea: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 72 : 48,
    left: 24, right: 24,
    alignItems: "center", gap: 14, zIndex: 20,
  },
  challengeRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  challengeIconWrap: {
    width: 62, height: 62, borderRadius: 31,
    backgroundColor: "rgba(255,41,155,0.14)", alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "rgba(255,41,155,0.38)",
  },
  instructionPill: {
    backgroundColor: "rgba(10,10,10,0.88)", borderRadius: 20,
    paddingHorizontal: 22, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", gap: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", minWidth: 220,
  },
  instructionText: {
    flex: 1, fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff", textAlign: "center",
  },
  countdownBadge: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: "center", justifyContent: "center",
  },
  countdownText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  qualitySubtext: {
    fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.5)", textAlign: "center",
  },
  ringPct: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff" },
  centeredOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.85)", alignItems: "center", justifyContent: "center",
    gap: 16, zIndex: 30,
  },
  loadingText: { fontSize: 16, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.75)" },
  loadingSub: {
    fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.4)", textAlign: "center",
    paddingHorizontal: 32,
  },
  resultOverlay: {
    flex: 1, backgroundColor: "#0a0a0a", alignItems: "center", justifyContent: "center",
    paddingHorizontal: 32, gap: 16,
  },
  resultIconWrap: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: "rgba(255,41,155,0.12)", alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
  resultTitle: { fontSize: 28, fontFamily: "Inter_700Bold", color: "#fff", textAlign: "center" },
  resultSub: {
    fontSize: 15, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)", textAlign: "center", lineHeight: 22,
  },
  retryBtn: { marginTop: 8, backgroundColor: PINK, paddingHorizontal: 40, paddingVertical: 16, borderRadius: 28 },
  retryBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  backLink: { fontSize: 14, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.4)", paddingVertical: 8 },
  errorTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff", textAlign: "center" },
  errorSub: {
    fontSize: 15, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.5)", textAlign: "center",
    lineHeight: 22, paddingHorizontal: 16,
  },
  cancelPill: { backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 28, paddingVertical: 12, borderRadius: 20 },
  cancelPillText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  manualBtn: {
    backgroundColor: PINK,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 28,
    marginTop: 4,
    alignItems: "center",
  },
  manualBtnActive: {
    opacity: 0.7,
  },
  manualBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
});
