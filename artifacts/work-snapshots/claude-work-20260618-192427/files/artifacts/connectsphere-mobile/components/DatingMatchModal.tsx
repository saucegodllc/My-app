/**
 * DatingMatchModal — Cinematic Edition
 * ─────────────────────────────────────────────────────────────────
 * Split-screen full-bleed photos, hot pink (#FF1493) vertical
 * divider that draws top→bottom, pulsing node at intersection,
 * name pills fading up on each side, dark content sheet rising
 * from the bottom.
 *
 * Animation system: Reanimated v3 worklets (UI thread, zero JS jank).
 *
 * Sequence:
 *   0 ms  — backdrop fades in
 *  40 ms  — 20 particles burst from screen center
 *  70 ms  — left photo slides in from left edge  (spring 240/26)
 *           right photo slides in from right edge (spring 240/26)
 * 250 ms  — divider draws top → bottom (withTiming 320ms)
 * 380 ms  — content sheet rises + fades in
 * 440 ms  — divider node pops with spring overshoot (380/14)
 * 460 ms  — name pills fade + slide up
 * 520 ms  — headline elastic pop (spring 320/12)
 * 560 ms  — buttons rise into view
 *   ∞     — node glow pulse every 1100ms
 */
import { Ionicons } from "@expo/vector-icons";
import { useUser } from "@clerk/clerk-expo";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  cancelAnimation,
  interpolate,
  Extrapolation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import type { DatingMatch } from "@/contexts/DatingMatchContext";
import { openChat, openConnectChat } from "@/lib/routes";
import { Analytics } from "@/lib/analytics";
import { playSound } from "@/lib/sounds";
import { VibeBreakdownFull } from "./VibeBreakdown";
import type { VibeCheckAnswers } from "./VibeCheckQuiz";

// ─── Design tokens ────────────────────────────────────────────────────────────
const PINK = "#FF1493";
const DARK = "#050005";
const { width: SW, height: SH } = Dimensions.get("window");

// ─── Types ────────────────────────────────────────────────────────────────────

export type DopamineMatch = Pick<DatingMatch, "chatId" | "profile" | "source" | "serverMatchId"> & {
  id?: string;
};

type Props = {
  match: DopamineMatch | null;
  onClose: () => void;
  /** Called when user taps "Keep Discovering". Defaults to onClose if not provided. */
  onKeepExploring?: () => void;
  myVibeAnswers?: VibeCheckAnswers;
  theirVibeAnswers?: VibeCheckAnswers;
};

// ─── Particle config ──────────────────────────────────────────────────────────

const PARTICLE_CHARS = ["💗", "💖", "💕", "✨", "💫", "🩷", "⭐", "💥"];
const PARTICLE_COUNT = 20;

interface ParticleDef {
  key: string;
  angle: number;
  distance: number;
  char: string;
  fontSize: number;
}

const PARTICLE_DEFS: ParticleDef[] = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  key: `p-${i}`,
  angle: (Math.PI * 2 * i) / PARTICLE_COUNT + (i % 2 === 0 ? 0 : Math.PI / PARTICLE_COUNT),
  distance: i % 2 === 0 ? 100 + (i % 5) * 14 : 148 + (i % 4) * 16,
  char: PARTICLE_CHARS[i % PARTICLE_CHARS.length],
  fontSize: 18 + (i % 3) * 6,
}));

// ─── Particle component ───────────────────────────────────────────────────────

function Particle({
  progress,
  def,
}: {
  progress: SharedValue<number>;
  def: ParticleDef;
}) {
  const style = useAnimatedStyle(() => {
    "worklet";
    const p = progress.value;
    return {
      opacity: interpolate(p, [0, 0.10, 0.65, 1], [0, 1, 1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: interpolate(p, [0, 1], [0, Math.cos(def.angle) * def.distance], Extrapolation.CLAMP) },
        { translateY: interpolate(p, [0, 1], [0, Math.sin(def.angle) * def.distance], Extrapolation.CLAMP) },
        { scale: interpolate(p, [0, 0.12, 0.55, 1], [0, 1.2, 1.0, 0.6], Extrapolation.CLAMP) },
      ],
    };
  });
  return (
    <Animated.Text style={[pStyles.base, { fontSize: def.fontSize }, style]}>
      {def.char}
    </Animated.Text>
  );
}

const pStyles = StyleSheet.create({
  base: { position: "absolute", marginLeft: -12, marginTop: -12 },
});

// ─── DatingMatchModal ─────────────────────────────────────────────────────────

export function DatingMatchModal({ match, onClose, onKeepExploring, myVibeAnswers, theirVibeAnswers }: Props) {
  const { user } = useUser();

  // ── Shared values (all at top — before any early return) ──────────────────
  const backdropOp    = useSharedValue(0);
  const sceneX        = useSharedValue(0);
  const particleProg  = useSharedValue(0);
  const leftX         = useSharedValue(-SW);
  const rightX        = useSharedValue(SW);
  const dividerProg   = useSharedValue(0);
  const nodeProg      = useSharedValue(0);
  const glowVal       = useSharedValue(0);
  const nameOp        = useSharedValue(0);
  const nameY         = useSharedValue(16);
  const sheetOp       = useSharedValue(0);
  const sheetY        = useSharedValue(120);
  const headlineScale = useSharedValue(0);
  const buttonsOp     = useSharedValue(0);
  const buttonsY      = useSharedValue(32);

  // ── Animated styles ───────────────────────────────────────────────────────
  const backdropStyle   = useAnimatedStyle(() => ({ opacity: backdropOp.value }));
  const sceneStyle      = useAnimatedStyle(() => ({ transform: [{ translateX: sceneX.value }] }));
  const leftPhotoStyle  = useAnimatedStyle(() => ({ transform: [{ translateX: leftX.value }] }));
  const rightPhotoStyle = useAnimatedStyle(() => ({ transform: [{ translateX: rightX.value }] }));

  const dividerStyle = useAnimatedStyle(() => {
    "worklet";
    const prog = dividerProg.value;
    return {
      transform: [
        // Keep top edge fixed while scaleY grows: translate up by (1 - prog) * halfHeight
        { translateY: interpolate(prog, [0, 1], [-SH / 2, 0], Extrapolation.CLAMP) },
        { scaleY: prog },
      ],
    };
  });

  const nodeStyle = useAnimatedStyle(() => {
    "worklet";
    // Oscillate glow scale between 0.88 and 1.18
    const glowScale = interpolate(glowVal.value, [0, 1], [0.88, 1.18], Extrapolation.CLAMP);
    return {
      opacity: nodeProg.value,
      transform: [{ scale: nodeProg.value * glowScale }],
    };
  });

  const namePillsStyle = useAnimatedStyle(() => ({
    opacity: nameOp.value,
    transform: [{ translateY: nameY.value }],
  }));

  const sheetAnimStyle = useAnimatedStyle(() => ({
    opacity: sheetOp.value,
    transform: [{ translateY: sheetY.value }],
  }));

  const headlineScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: headlineScale.value }],
  }));

  const buttonsAnimStyle = useAnimatedStyle(() => ({
    opacity: buttonsOp.value,
    transform: [{ translateY: buttonsY.value }],
  }));

  // ── Animation sequence ────────────────────────────────────────────────────
  useEffect(() => {
    if (match) {
      // Reset everything first
      cancelAnimation(glowVal);
      backdropOp.value    = 0;
      sceneX.value        = 0;
      particleProg.value  = 0;
      leftX.value         = -SW;
      rightX.value        = SW;
      dividerProg.value   = 0;
      nodeProg.value      = 0;
      glowVal.value       = 0;
      nameOp.value        = 0;
      nameY.value         = 16;
      sheetOp.value       = 0;
      sheetY.value        = 120;
      headlineScale.value = 0;
      buttonsOp.value     = 0;
      buttonsY.value      = 32;

      void playSound("match");

      // 0ms — backdrop
      backdropOp.value = withTiming(1, { duration: 100 });

      // 40ms — particles burst
      particleProg.value = withDelay(40, withSpring(1, { stiffness: 280, damping: 18, mass: 0.7 }));

      // 70ms — split photos slide in from edges
      leftX.value  = withDelay(70, withSpring(0, { stiffness: 240, damping: 26, mass: 1.0 }));
      rightX.value = withDelay(70, withSpring(0, { stiffness: 240, damping: 26, mass: 1.0 }));

      // 250ms — divider draws top→bottom
      dividerProg.value = withDelay(250, withTiming(1, { duration: 320 }));

      // 380ms — bottom sheet rises
      sheetOp.value = withDelay(380, withTiming(1, { duration: 240 }));
      sheetY.value  = withDelay(380, withSpring(0, { stiffness: 200, damping: 24 }));

      // 440ms — node pops with spring overshoot
      nodeProg.value = withDelay(440, withSpring(1, { stiffness: 380, damping: 14, mass: 0.6 }));

      // 460ms — name pills fade up
      nameOp.value = withDelay(460, withTiming(1, { duration: 220 }));
      nameY.value  = withDelay(460, withSpring(0, { stiffness: 220, damping: 24 }));

      // 520ms — headline elastic pop
      headlineScale.value = withDelay(520, withSpring(1, { stiffness: 320, damping: 12, mass: 0.8 }));

      // 560ms — buttons rise in
      buttonsOp.value = withDelay(560, withTiming(1, { duration: 260 }));
      buttonsY.value  = withDelay(560, withSpring(0, { stiffness: 200, damping: 22 }));

      // ∞ — node glow pulse (starts after pop settles)
      glowVal.value = withDelay(
        600,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 1100 }),
            withTiming(0, { duration: 1100 }),
          ),
          -1,
          false,
        ),
      );
    } else {
      cancelAnimation(glowVal);
      cancelAnimation(dividerProg);
      backdropOp.value    = 0;
      particleProg.value  = 0;
      leftX.value         = -SW;
      rightX.value        = SW;
      dividerProg.value   = 0;
      nodeProg.value      = 0;
      glowVal.value       = 0;
      nameOp.value        = 0;
      nameY.value         = 16;
      sheetOp.value       = 0;
      sheetY.value        = 120;
      headlineScale.value = 0;
      buttonsOp.value     = 0;
      buttonsY.value      = 32;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match]);

  // ── Early return after all hooks ──────────────────────────────────────────
  if (!match) return null;

  const photo     = match.profile.photos[0];
  const userPhoto = user?.imageUrl;
  const firstName = match.profile.name.split(" ")[0];

  const goToChat = (wave = false, openPlan = false) => {
    const dismiss = () => {
      onClose();
      const chatId = match.serverMatchId ?? match.chatId;
      Analytics.chatOpened(chatId, { source: "match_modal", isFirstOpen: true });
      if (match.source === "server" || match.serverMatchId) {
        openChat(chatId, {
          ...(wave ? { wave: true } : {}),
          ...(openPlan ? { openPlan: true } : {}),
        });
      } else {
        router.push({
          pathname: "/chat/dating/[id]",
          params: {
            id: match.chatId,
            wave: wave ? "1" : undefined,
            openPlan: openPlan ? "1" : undefined,
          },
        } as never);
      }
    };
    sceneX.value = withTiming(
      -SW,
      { duration: 240 },
      () => { runOnJS(dismiss)(); },
    );
  };

  const handleViewConnect = () => {
    onClose();
    setTimeout(() => openConnectChat(match.serverMatchId ?? match.chatId), 80);
  };

  return (
    <Modal
      testID="dating-match-modal"
      visible={!!match}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View style={[s.backdrop, backdropStyle]}>
        <Animated.View style={[s.scene, sceneStyle]}>

          {/* ── Tap-to-dismiss (behind all layers) ─────────────────── */}
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

          {/* ── Layer 1: Split photos — full bleed ──────────────────── */}
          <View style={s.splitContainer}>
            {/* Left half — user photo */}
            <Animated.View style={[s.photoHalf, leftPhotoStyle]}>
              {userPhoto ? (
                <Image
                  source={{ uri: userPhoto }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
              ) : (
                <View style={[StyleSheet.absoluteFill, s.photoFallback]}>
                  <Ionicons name="person" size={64} color="rgba(255,255,255,0.45)" />
                </View>
              )}
              {/* Vignette: darken edges for contrast */}
              <LinearGradient
                colors={["rgba(0,0,0,0.48)", "transparent", "transparent", "rgba(0,0,0,0.82)"]}
                locations={[0, 0.20, 0.52, 1]}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
            </Animated.View>

            {/* Right half — match photo */}
            <Animated.View style={[s.photoHalf, rightPhotoStyle]}>
              {photo ? (
                <Image
                  source={{ uri: photo }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
              ) : (
                <View style={[StyleSheet.absoluteFill, s.photoFallback]}>
                  <Ionicons name="person" size={64} color="rgba(255,255,255,0.45)" />
                </View>
              )}
              <LinearGradient
                colors={["rgba(0,0,0,0.48)", "transparent", "transparent", "rgba(0,0,0,0.82)"]}
                locations={[0, 0.20, 0.52, 1]}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
            </Animated.View>
          </View>

          {/* ── Layer 2: Hot pink divider + pulsing node ─────────────── */}
          <View style={s.dividerLayer} pointerEvents="none">
            {/* Line draws from top → bottom via scaleY + translateY trick */}
            <Animated.View style={[s.dividerLine, dividerStyle]} />
            {/* Heart pops at center of divider with glow pulse — a real heart
                badge, not a pink circle (spec 4.4) */}
            <Animated.View style={[s.dividerNode, nodeStyle]}>
              <Ionicons name="heart" size={34} color={PINK} style={s.dividerHeart} />
            </Animated.View>
          </View>

          {/* ── Layer 3: Particles (burst from photo center area) ────── */}
          <View style={s.particleOrigin} pointerEvents="none">
            {PARTICLE_DEFS.map((def) => (
              <Particle key={def.key} progress={particleProg} def={def} />
            ))}
          </View>

          {/* ── Layer 4: Name pills ──────────────────────────────────── */}
          <Animated.View style={[s.leftNameWrap, namePillsStyle]} pointerEvents="none">
            <View style={s.namePill}>
              <Text style={s.namePillText} numberOfLines={1}>You</Text>
            </View>
          </Animated.View>
          <Animated.View style={[s.rightNameWrap, namePillsStyle]} pointerEvents="none">
            <View style={s.namePill}>
              <Text style={s.namePillText} numberOfLines={1}>{firstName}</Text>
            </View>
          </Animated.View>

          {/* ── Layer 5: Bottom content sheet ───────────────────────── */}
          <Animated.View style={[s.sheet, sheetAnimStyle]}>
            {/* Gradient transition: photos fade into dark sheet */}
            <LinearGradient
              colors={["transparent", "rgba(5,0,5,0.90)", "rgba(5,0,5,1)"]}
              locations={[0, 0.38, 1]}
              style={s.sheetGradient}
              pointerEvents="none"
            />

            <View style={s.sheetContent}>
              {/* Headline — elastic pop */}
              <Animated.View style={[s.headlineWrap, headlineScaleStyle]}>
                <Text style={s.headline}>
                  {"You two\n"}
                  <Text style={s.clicked}>clicked.</Text>
                </Text>
              </Animated.View>

              {/* Shared interests */}
              {(match.profile.interests?.length ?? 0) > 0 && (
                <View style={s.interestsRow}>
                  {match.profile.interests!.slice(0, 3).map((interest: string) => (
                    <View key={interest} style={s.interestPill}>
                      <Text style={s.interestPillText}>{interest}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Vibe Breakdown */}
              {myVibeAnswers && theirVibeAnswers && (
                <View style={s.vibeWrap}>
                  <VibeBreakdownFull
                    mine={myVibeAnswers}
                    theirs={theirVibeAnswers}
                    theirName={match.profile.name}
                    animate
                  />
                </View>
              )}

              {/* ── Buttons ────────────────────────────────────────── */}
              <Animated.View style={[s.actions, buttonsAnimStyle]}>
                {/* Primary — white pill, dark text, prominent */}
                <Pressable
                  testID="dating-match-start-chat"
                  onPress={() => goToChat(true)}
                  style={s.primaryBtn}
                >
                  <Text style={s.primaryBtnText}>Send a Message  →</Text>
                </Pressable>

                {/* Make a plan — the differentiator gets a seat at the match
                    moment, not just a buried calendar icon (design critique) */}
                <Pressable
                  testID="dating-match-make-plan"
                  onPress={() => goToChat(false, true)}
                  style={s.planBtn}
                >
                  <Ionicons name="calendar" size={16} color="#fff" />
                  <Text style={s.planBtnText}>Make a Plan</Text>
                </Pressable>

                {/* Secondary — hot pink border + pink text, clearly visible */}
                <Pressable
                  testID="dating-match-keep-exploring"
                  onPress={onKeepExploring ?? onClose}
                  style={s.secondaryBtn}
                >
                  <Text style={s.secondaryBtnText}>Keep Discovering</Text>
                </Pressable>

                {/* Quiet link */}
                <Pressable
                  testID="dating-match-view-connect"
                  onPress={handleViewConnect}
                  style={s.linkBtn}
                >
                  <Text style={s.linkText}>View in Connect</Text>
                </Pressable>
              </Animated.View>
            </View>
          </Animated.View>

          {/* ── Close button — floats above all layers ───────────────── */}
          <Pressable
            testID="dating-match-close"
            onPress={onClose}
            style={s.closeBtn}
            hitSlop={12}
          >
            <Ionicons name="close" size={18} color="rgba(255,255,255,0.82)" />
          </Pressable>

        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // ── Backdrop ──────────────────────────────────────────────────────────────
  backdrop: {
    flex: 1,
    backgroundColor: DARK,
  },
  scene: {
    flex: 1,
  },

  // ── Split photo container — full screen ───────────────────────────────────
  splitContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
  },
  photoHalf: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "#14001a",
    alignItems: "center",
    justifyContent: "center",
  },
  photoFallback: {
    backgroundColor: "#14001a",
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Divider — positioned by exact pixel coords ────────────────────────────
  dividerLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  dividerLine: {
    position: "absolute",
    left: SW / 2 - 1,   // centered on screen
    top: 0,
    width: 2,
    height: SH,
    backgroundColor: PINK,
    shadowColor: PINK,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 10,
    elevation: 12,
  },
  // Heart badge splitting the two profiles — heart SHAPE, not a pink circle
  // (spec 4.4). The glow lives on the icon itself so the silhouette stays a
  // heart rather than a glowing disc.
  dividerNode: {
    position: "absolute",
    left: SW / 2 - 17,   // centered on divider
    top: SH * 0.40 - 17, // 40% from top — sits in the photo area
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  dividerHeart: {
    textShadowColor: PINK,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },

  // ── Particles (burst origin at 38% from top, screen center) ──────────────
  particleOrigin: {
    position: "absolute",
    left: "50%" as any,
    top: "38%" as any,
    width: 1,
    height: 1,
    zIndex: 8,
  },

  // ── Name pills ────────────────────────────────────────────────────────────
  leftNameWrap: {
    position: "absolute",
    bottom: 300,
    left: 16,
    maxWidth: SW / 2 - 32,
  },
  rightNameWrap: {
    position: "absolute",
    bottom: 300,
    right: 16,
    maxWidth: SW / 2 - 32,
    alignItems: "flex-end",
  },
  namePill: {
    backgroundColor: "rgba(0,0,0,0.58)",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,20,147,0.55)",
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  namePillText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },

  // ── Bottom sheet ──────────────────────────────────────────────────────────
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  // 100px gradient that fades photos into the solid content area
  sheetGradient: {
    height: 100,
    width: "100%",
  },
  sheetContent: {
    backgroundColor: "rgba(5,0,5,1)",
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 38,
    alignItems: "center",
  },

  // ── Headline ──────────────────────────────────────────────────────────────
  headlineWrap: {
    alignItems: "center",
    marginBottom: 14,
  },
  headline: {
    fontSize: 44,
    fontFamily: "Sora_800ExtraBold",
    color: "#fff",
    textAlign: "center",
    lineHeight: 48,
    letterSpacing: -1.5,
  },
  // "clicked." inherits Sora_800ExtraBold; just override color + italic
  clicked: {
    color: PINK,
    fontStyle: "italic",
  },

  // ── Interests ─────────────────────────────────────────────────────────────
  interestsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginBottom: 10,
  },
  interestPill: {
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,20,147,0.35)",
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  interestPillText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  vibeWrap: {
    width: "100%",
    marginBottom: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,20,147,0.18)",
    overflow: "hidden",
  },

  // ── Actions ───────────────────────────────────────────────────────────────
  actions: {
    width: "100%",
    alignItems: "center",
    marginTop: 6,
  },

  // Primary — white background, dark text, full-width pill, tall touch target
  primaryBtn: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 999,
    paddingVertical: 17,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#ffffff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.20,
    shadowRadius: 14,
    elevation: 8,
  },
  primaryBtnText: {
    color: "#0d0010",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.4,
  },

  // Make a Plan — solid pink pill, sits between message and keep-discovering
  planBtn: {
    width: "100%",
    marginTop: 12,
    borderRadius: 999,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: PINK,
  },
  planBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.2,
  },

  // Secondary — hot pink border + hot pink text, clearly visible on dark bg
  secondaryBtn: {
    width: "100%",
    marginTop: 12,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,20,147,0.08)",
    borderWidth: 1.5,
    borderColor: PINK,
  },
  secondaryBtnText: {
    color: PINK,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.4,
  },

  // View in Connect — quiet link
  linkBtn: {
    marginTop: 14,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  linkText: {
    color: "rgba(255,255,255,0.38)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },

  // ── Close button — floats top-right above everything ─────────────────────
  closeBtn: {
    position: "absolute",
    top: 54,
    right: 18,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    zIndex: 20,
  },
});
