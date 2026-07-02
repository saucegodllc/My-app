/**
 * ExpandedProfileCard
 *
 * The single shared full-screen profile card used in:
 *   • Discover tab (dating + friends) — swipe actions, Shot CTA
 *   • Match / Chat context           — matchMode=true, no swipe actions,
 *                                      no "Shoot your shot", shows "Message" CTA
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *   profile      CardProfile  — works with both Profile (discover) and
 *                               DatingProfileSnapshot (match context)
 *   matchMode    boolean      — hides all swipe/shot actions; shows onMessage CTA
 *   onClose      ()=>void     — back / close
 *   onAction     fn           — discover: swipe action handler
 *   onShot       fn           — discover: open Shot composer
 *   onMessage    ()=>void     — matchMode: open chat / bring keyboard focus
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Flexible profile shape accepted by ExpandedProfileCard.
 *  Covers both the full discover Profile and the leaner DatingProfileSnapshot. */
export type CardProfile = {
  id: string | number;
  name: string;
  age?: number | null;
  location?: string | null;
  bio?: string | null;
  intent?: string | null;
  subGenre?: string;
  interests?: string[] | null;
  matchScore?: number | null;
  online?: boolean;
  verified?: boolean;
  /** Single hero image fallback when photos[] is absent */
  image?: string;
  photos?: string[] | null;
  datingGoal?: string | null;
  friendGoal?: string | null;
  sourceIntent?: "dating" | "friendship" | "all";
  firstDateStyle?: string | null;
  dateIdeas?: string[] | null;
  chemistrySignals?: string[] | null;
  comfortBadges?: string[] | null;
  prompt?: string | null;
  promptAnswer?: string | null;
  hotTake?: string | null;
  openerIdeas?: string[] | null;
  intentions?: string | null;
  likedCurrentUser?: boolean;
  lastActiveAt?: string | null;
};

export type ProfileAction =
  | "pass"
  | "vibe"
  | "spark"
  | "shot"
  | "create_plan"
  | "create_group"
  | "best_friend";

type Props = {
  profile: CardProfile;
  /** When true: hides swipe/shot actions, shows "Message" CTA instead */
  matchMode?: boolean;
  onClose: () => void;
  /** Discover mode — validates the action (guard check + record). Should NOT close the modal.
   *  Return false to abort (premium gate, etc.); true / void to proceed. */
  onAction?: (action: ProfileAction) => boolean | void | Promise<boolean | void>;
  /** Called AFTER the in-card overlay animation finishes — the right place to close
   *  the expanded profile and advance the deck.  This keeps the animation fully visible. */
  onActionComplete?: (action: ProfileAction) => void;
  /** Discover mode — open shot composer */
  onShot?: (initialMessage?: string) => void;
  /** Match mode — called when user taps the "Message" CTA */
  onMessage?: () => void;
};

// ─── Theme constants ──────────────────────────────────────────────────────────

const DATING_ACCENT: [string, string, string] = ["#EC4899", "#D946EF", "#F43F5E"];
const FRIENDS_ACCENT: [string, string, string] = ["#3B82F6", "#06B6D4", "#8B5CF6"];

function accentColors(profile: CardProfile): [string, string, string] {
  return (profile.intent ?? "dating") === "dating" ? DATING_ACCENT : FRIENDS_ACCENT;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const personalDatingIntents = ["Hookup", "Long Term", "Curious", "Having Fun"] as const;

function isPersonalDatingIntent(value?: string | null) {
  return personalDatingIntents.includes(value as (typeof personalDatingIntents)[number]);
}

function normalizedDatingIntentLabel(value?: string | null): string | undefined {
  if (!value) return undefined;
  if (value === "Longterm" || value === "Long-term" || value === "Long term") return "Long Term";
  if (value === "Having fun") return "Having Fun";
  return value;
}

function getSubIntentionLabel(profile: CardProfile): string | undefined {
  const preferred =
    (profile.intent ?? "dating") === "dating"
      ? normalizedDatingIntentLabel(profile.datingGoal ?? profile.subGenre)
      : profile.subGenre;
  if ((profile.intent ?? "dating") === "dating")
    return isPersonalDatingIntent(preferred) ? preferred : undefined;
  return preferred && preferred !== "For You" ? preferred : undefined;
}

const defaultDateIdeas = ["Coffee with a view", "Walk by the water", "Low-key dinner"];
const defaultChemistrySignals = ["Shared interests", "Similar pace", "Nearby plans"];

function getDatingDateIdeas(profile: CardProfile): string[] {
  return profile.dateIdeas?.length ? (profile.dateIdeas as string[]) : defaultDateIdeas;
}

function getDatingSignals(profile: CardProfile): string[] {
  return profile.chemistrySignals?.length
    ? (profile.chemistrySignals as string[])
    : defaultChemistrySignals;
}

// Rewrite common third-person opener commands ("Ask Maya about her sunset
// rooftop thing") into natural first-person openers ("okay, your sunset
// rooftop thing — I need the full story"). Returns undefined when no safe
// rewrite applies, in which case the suggestion is dropped (spec 4.1).
export function rewriteOpenerToFirstPerson(raw: string): string | undefined {
  const stripEnd = (s: string) => s.replace(/[.!?]+$/, "").trim();

  // "Ask <Name> about her/his/their X" / "Ask <Name> about X"
  const askMatch =
    raw.match(/^ask\s+\w+\s+about\s+(?:her|his|their)\s+(.+)$/i) ??
    raw.match(/^ask\s+\w+\s+about\s+(.+)$/i);
  if (askMatch?.[1]) {
    return `okay, your ${stripEnd(askMatch[1])} — I need the full story`;
  }

  // "Tell her/him/them (that) you X" → "I X"
  const tellMatch = raw.match(/^tell\s+(?:her|him|them)\s+(?:that\s+)?you\s+(.+)$/i);
  if (tellMatch?.[1]) {
    return `I ${stripEnd(tellMatch[1])}`;
  }

  // "Mention (the) X"
  const mentionMatch = raw.match(/^mention\s+(?:the\s+)?(.+)$/i);
  if (mentionMatch?.[1]) {
    return `the ${stripEnd(mentionMatch[1])} — we're talking about that, right?`;
  }

  return undefined;
}

export function getShotSuggestions(profile: CardProfile): string[] {
  const intent = getSubIntentionLabel(profile) ?? "Dating";
  const interests = (profile.interests as string[] | null) ?? [];
  const interest = interests[0] ?? "your vibe";
  const secondInterest = interests[1] ?? profile.firstDateStyle ?? "Miami nights";
  const style = profile.firstDateStyle ?? getDatingDateIdeas(profile)[0] ?? "something low-key";
  const promptAnswer = profile.promptAnswer?.trim();

  // openerIdeas from the server can be third-person commands like "Ask Maya
  // about X". Rewrite them into natural first-person openers where a safe
  // pattern applies; otherwise drop them (spec 4.1 — never show literal
  // automation copy to the user).
  const rawOpener = profile.openerIdeas?.[0]?.trim();
  const isThirdPerson = rawOpener
    ? /^(ask|tell|mention|talk\s+to|say\s+something)\s+\w/i.test(rawOpener)
    : false;
  const firstPersonOpener = rawOpener
    ? isThirdPerson
      ? rewriteOpenerToFirstPerson(rawOpener)
      : rawOpener
    : undefined;

  const raw: (string | undefined)[] = [
    firstPersonOpener,
    intent === "Hookup"
      ? `${interest} and no small talk?`
      : intent === "Long Term"
      ? `Your ${style} vibe sounds like my pace. Am I right?`
      : intent === "Curious"
      ? `Curious enough to trade a real first impression?`
      : `You seem fun. What do you like to do?`,
    promptAnswer
      ? `Your "${promptAnswer}" answer — what's the story there?`
      : `${style} with you sounds dangerously easy.`,
    `I had to shoot my shot: ${interest} or ${secondInterest}?`,
  ];

  return raw
    .filter((item): item is string => Boolean(item && item.trim().length > 4))
    .map((item) => item.slice(0, 120))
    .filter((item, index, arr) => arr.indexOf(item) === index)
    .slice(0, 3);
}

function getIntentDisplayLabel(intent?: string | null) {
  return (intent ?? "dating") === "dating" ? "Dating" : "Friend";
}

function getIntentIcon(intent?: string | null): keyof typeof Ionicons.glyphMap {
  return (intent ?? "dating") === "dating" ? "flame" : "people";
}

// ─── AnimatedTap ──────────────────────────────────────────────────────────────

function AnimatedTap({
  onPress,
  style,
  pressScale = 0.95,
  testID,
  children,
}: {
  onPress: () => void;
  style?: object;
  pressScale?: number;
  testID?: string;
  children: React.ReactNode;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.spring(scale, { toValue: pressScale, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      activeOpacity={1}
      testID={testID}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </TouchableOpacity>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={expStyles.infoPill}>
      <Text style={expStyles.infoPillLabel}>{label}</Text>
      <Text style={expStyles.infoPillValue}>{value}</Text>
    </View>
  );
}

function MiniStat({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={datingStyles.miniStat}>
      <Ionicons name={icon} size={16} color="#F472B6" />
      <Text style={datingStyles.miniStatLabel}>{label}</Text>
      <Text style={datingStyles.miniStatValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/** Dating info card.
 *  matchMode=true  → show date card only (no "Shoot your shot" section).
 *  matchMode=false → full card + shot suggestions. */
function DatingProfileSection({
  profile,
  matchMode,
  onShotIdea,
}: {
  profile: CardProfile;
  matchMode?: boolean;
  onShotIdea?: (message: string) => void;
}) {
  const signals = getDatingSignals(profile);
  const ideas = getDatingDateIdeas(profile);
  const shotIdeas = getShotSuggestions(profile);

  return (
    <View style={datingStyles.wrap}>
      {/* Date card — always shown */}
      <View style={datingStyles.card}>
        <View style={datingStyles.cardHeader}>
          <View>
            <Text style={datingStyles.eyebrow}>Date card</Text>
            <Text style={datingStyles.title}>
              {profile.intentions ?? "Clear, easy chemistry"}
            </Text>
          </View>
        </View>
        <View style={datingStyles.statsRow}>
          <MiniStat
            icon="flame"
            label="Intent"
            value={getSubIntentionLabel(profile) ?? "Dating"}
          />
          <MiniStat
            icon="wine-outline"
            label="First date"
            value={profile.firstDateStyle ?? ideas[0]!}
          />
        </View>
        <View style={datingStyles.signalRow}>
          {signals.map((signal) => (
            <View key={signal} style={datingStyles.signalChip}>
              <Ionicons name="sparkles" size={12} color="#F9A8D4" />
              <Text style={datingStyles.signalText}>{signal}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* "Shoot your shot" — hidden in match context (already matched) */}
      {!matchMode && onShotIdea && (
        <View style={datingStyles.planCard} testID="expanded-profile-shot-section">
          <View style={datingStyles.pollHeader}>
            <Text style={datingStyles.eyebrow}>Shoot your shot</Text>
            <Ionicons name="send" size={16} color="#F472B6" />
          </View>
          {shotIdeas.map((idea) => (
            <AnimatedTap
              key={idea}
              onPress={() => onShotIdea(idea)}
              style={datingStyles.planRow}
              pressScale={0.97}
            >
              <View style={datingStyles.planIcon}>
                <Ionicons name="create" size={15} color="#FFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={datingStyles.planTitle}>{idea}</Text>
                <Text style={datingStyles.planSub}>Tap to edit and send as a Shot</Text>
              </View>
              <View style={datingStyles.planEditHint}>
                <Ionicons name="create-outline" size={13} color="#F9A8D4" />
              </View>
            </AnimatedTap>
          ))}
        </View>
      )}
    </View>
  );
}

function FriendProfileSection({
  profile,
  onAction,
}: {
  profile: CardProfile;
  onAction: (action: ProfileAction) => void;
}) {
  const signals = getDatingSignals(profile);
  const ideas = (profile.dateIdeas as string[] | null)?.length
    ? (profile.dateIdeas as string[])
    : ["Coffee", "Walk", "Local event"];

  return (
    <View style={datingStyles.wrap}>
      <View style={[datingStyles.card, friendUpgradeStyles.card]}>
        <View style={datingStyles.cardHeader}>
          <View>
            <Text style={[datingStyles.eyebrow, friendUpgradeStyles.eyebrow]}>
              Friend card
            </Text>
            <Text style={datingStyles.title}>
              {profile.intentions ?? getSubIntentionLabel(profile) ?? "Easy friend energy"}
            </Text>
          </View>
        </View>
        <View style={datingStyles.statsRow}>
          <MiniStat
            icon="people"
            label="Purpose"
            value={getSubIntentionLabel(profile) ?? "Friends"}
          />
          <MiniStat icon="calendar-outline" label="First hang" value={ideas[0]!} />
        </View>
        <View style={datingStyles.signalRow}>
          {signals.map((signal) => (
            <View
              key={signal}
              style={[datingStyles.signalChip, friendUpgradeStyles.signalChip]}
            >
              <Ionicons name="checkmark-circle" size={12} color="#BFDBFE" />
              <Text style={datingStyles.signalText}>{signal}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={datingStyles.planCard}>
        <View style={datingStyles.pollHeader}>
          <Text style={[datingStyles.eyebrow, friendUpgradeStyles.eyebrow]}>
            Start the friendship
          </Text>
          <Ionicons name="people-circle" size={18} color="#93C5FD" />
        </View>
        {[
          {
            title: `Like ${profile.name}`,
            sub: "Send a friend like. You match when they accept.",
            icon: "person-add" as keyof typeof Ionicons.glyphMap,
            action: "vibe" as ProfileAction,
          },
          {
            title: `Make a ${ideas[0] ?? "hang"} plan`,
            sub: "Opens the shared plan creator.",
            icon: "calendar" as keyof typeof Ionicons.glyphMap,
            action: "create_plan" as ProfileAction,
          },
          {
            title: "Mark Besties",
            sub: "A premium friend badge that lands in Reactions.",
            icon: "people-circle" as keyof typeof Ionicons.glyphMap,
            action: "best_friend" as ProfileAction,
          },
        ].map((item) => (
          <AnimatedTap
            key={item.title}
            onPress={() => onAction(item.action)}
            style={datingStyles.planRow}
            pressScale={0.97}
          >
            <View style={[datingStyles.planIcon, friendUpgradeStyles.planIcon]}>
              <Ionicons name={item.icon} size={15} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={datingStyles.planTitle}>{item.title}</Text>
              <Text style={datingStyles.planSub}>{item.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#A1A1AA" />
          </AnimatedTap>
        ))}
      </View>
    </View>
  );
}

// Action bar used in discover mode (not matchMode)
const datingBigActions = [
  { label: "Pass", iconName: "close" as keyof typeof Ionicons.glyphMap, action: "pass" as ProfileAction },
  { label: "Shot", iconName: "send" as keyof typeof Ionicons.glyphMap, action: "shot" as ProfileAction },
  { label: "Like", iconName: "heart" as keyof typeof Ionicons.glyphMap, action: "vibe" as ProfileAction, main: true },
  { label: "Spark", iconName: "sparkles" as keyof typeof Ionicons.glyphMap, action: "spark" as ProfileAction },
];
const friendsBigActions = [
  { label: "Like", iconName: "person-add" as keyof typeof Ionicons.glyphMap, action: "vibe" as ProfileAction },
  { label: "Plan", iconName: "calendar" as keyof typeof Ionicons.glyphMap, action: "create_plan" as ProfileAction },
  { label: "Besties", iconName: "people-circle" as keyof typeof Ionicons.glyphMap, action: "best_friend" as ProfileAction, main: true },
  { label: "Pass", iconName: "close" as keyof typeof Ionicons.glyphMap, action: "pass" as ProfileAction },
];

/** Per-action animated button — each swipe type has its own micro-animation
 *  so the press feels distinct and intentional rather than generic. */
function BigActionButton({
  def,
  accent,
  onPress,
}: {
  def: { label: string; iconName: keyof typeof Ionicons.glyphMap; action: ProfileAction; main?: boolean };
  accent: [string, string, string];
  onPress: () => void;
}) {
  const pressScale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const rotateDeg = useRef(new Animated.Value(0)).current;

  const rotateInterp = rotateDeg.interpolate({
    inputRange: [-30, 30],
    outputRange: ["-30deg", "30deg"],
  });

  const playButtonAnim = (action: ProfileAction) => {
    if (action === "pass") {
      // Reject shake — quick left-right oscillate + slight shrink
      Animated.parallel([
        Animated.sequence([
          Animated.timing(translateX, { toValue: -7, duration: 55, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
          Animated.timing(translateX, { toValue: 7, duration: 55, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
          Animated.timing(translateX, { toValue: -4, duration: 45, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
          Animated.timing(translateX, { toValue: 4, duration: 45, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true, speed: 35, bounciness: 3 }),
        ]),
        Animated.sequence([
          Animated.spring(pressScale, { toValue: 0.83, useNativeDriver: true, speed: 55, bounciness: 0 }),
          Animated.spring(pressScale, { toValue: 1, useNativeDriver: true, speed: 25, bounciness: 5 }),
        ]),
      ]).start();
    } else if (action === "vibe") {
      // Heart pop — big overshoot spring, warm and celebratory
      Animated.sequence([
        Animated.spring(pressScale, { toValue: 1.30, useNativeDriver: true, speed: 75, bounciness: 24 }),
        Animated.spring(pressScale, { toValue: 1.0, useNativeDriver: true, speed: 28, bounciness: 6 }),
      ]).start();
    } else if (action === "spark") {
      // Sparkle shimmer — rotation burst + scale pop (magical energy)
      Animated.parallel([
        Animated.sequence([
          Animated.spring(rotateDeg, { toValue: 20, useNativeDriver: true, speed: 68, bounciness: 14 }),
          Animated.spring(rotateDeg, { toValue: -13, useNativeDriver: true, speed: 55, bounciness: 9 }),
          Animated.spring(rotateDeg, { toValue: 0, useNativeDriver: true, speed: 40, bounciness: 4 }),
        ]),
        Animated.sequence([
          Animated.spring(pressScale, { toValue: 1.22, useNativeDriver: true, speed: 62, bounciness: 16 }),
          Animated.spring(pressScale, { toValue: 1.0, useNativeDriver: true, speed: 28, bounciness: 4 }),
        ]),
      ]).start();
    } else if (action === "shot") {
      // Launch motion — translate right (send) then snap back
      Animated.sequence([
        Animated.spring(translateX, { toValue: 10, useNativeDriver: true, speed: 72, bounciness: 0 }),
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, speed: 26, bounciness: 10 }),
      ]).start();
      Animated.sequence([
        Animated.spring(pressScale, { toValue: 1.12, useNativeDriver: true, speed: 66, bounciness: 8 }),
        Animated.spring(pressScale, { toValue: 1.0, useNativeDriver: true, speed: 28, bounciness: 4 }),
      ]).start();
    } else if (action === "best_friend") {
      // Bestie burst — extra generous heart pop, more dramatic than vibe
      Animated.sequence([
        Animated.spring(pressScale, { toValue: 1.38, useNativeDriver: true, speed: 72, bounciness: 28 }),
        Animated.spring(pressScale, { toValue: 1.0, useNativeDriver: true, speed: 26, bounciness: 6 }),
      ]).start();
    } else if (action === "create_plan" || action === "create_group") {
      // Forward motion — similar to shot (you're sending an invite)
      Animated.sequence([
        Animated.spring(translateX, { toValue: 8, useNativeDriver: true, speed: 68, bounciness: 0 }),
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, speed: 26, bounciness: 9 }),
      ]).start();
      Animated.sequence([
        Animated.spring(pressScale, { toValue: 1.1, useNativeDriver: true, speed: 62, bounciness: 6 }),
        Animated.spring(pressScale, { toValue: 1.0, useNativeDriver: true, speed: 26, bounciness: 3 }),
      ]).start();
    } else {
      // Generic pop fallback
      Animated.sequence([
        Animated.spring(pressScale, { toValue: 1.12, useNativeDriver: true, speed: 60, bounciness: 10 }),
        Animated.spring(pressScale, { toValue: 1.0, useNativeDriver: true, speed: 26, bounciness: 4 }),
      ]).start();
    }
  };

  const handlePress = () => {
    playButtonAnim(def.action);
    onPress();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={1}
      testID={`action-${def.action}`}
    >
      <Animated.View
        style={[
          expStyles.bigWrap,
          {
            transform: [
              { scale: pressScale },
              { translateX },
              { rotate: rotateInterp },
            ],
          },
        ]}
      >
        <View style={expStyles.bigBtn}>
          {def.main ? (
            <LinearGradient
              colors={accent}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, expStyles.bigBtnDefault]} />
          )}
          <Ionicons name={def.iconName} size={30} color="#FFF" />
        </View>
        <Text style={expStyles.bigLabel}>{def.label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

function BigActionsBar({
  profile,
  onAction,
}: {
  profile: CardProfile;
  onAction: (action: ProfileAction) => void;
}) {
  const accent = accentColors(profile);
  const actions =
    (profile.intent ?? "dating") === "dating" ? datingBigActions : friendsBigActions;

  return (
    <View style={expStyles.bigActionsRow} testID="expanded-profile-actions-bar">
      {actions.map((def) => (
        <BigActionButton
          key={def.label}
          def={def}
          accent={accent}
          onPress={() => onAction(def.action)}
        />
      ))}
    </View>
  );
}

function ExpandedActionFeedback({
  action,
  intent,
  anim,
}: {
  action: ProfileAction;
  intent: string;
  anim: Animated.Value;
}) {
  const config = getExpandedActionFeedbackConfig(action, intent);
  const scale = anim.interpolate({ inputRange: [0, 0.72, 1], outputRange: [0.7, 1.08, 1] });
  const opacity = anim.interpolate({
    inputRange: [0, 0.12, 0.82, 1],
    outputRange: [0, 1, 1, 0],
  });
  const ringScale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 2.7] });
  const ringOpacity = anim.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, 0.45, 0],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[expStyles.feedbackOverlay, { opacity }]}
    >
      <Animated.View
        style={[
          expStyles.feedbackRing,
          { opacity: ringOpacity, transform: [{ scale: ringScale }] },
        ]}
      />
      <Animated.View style={[expStyles.feedbackCard, { transform: [{ scale }] }]}>
        <LinearGradient
          colors={config.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={expStyles.feedbackIcon}>
          <Ionicons name={config.icon} size={34} color="#FFFFFF" />
        </View>
        <Text style={expStyles.feedbackTitle}>{config.title}</Text>
        <Text style={expStyles.feedbackSubtitle}>{config.subtitle}</Text>
      </Animated.View>
    </Animated.View>
  );
}

function getExpandedActionFeedbackConfig(action: ProfileAction, intent: string) {
  if (action === "spark")
    return {
      icon: "sparkles" as keyof typeof Ionicons.glyphMap,
      title: "Spark sent",
      subtitle: "They will feel that pop.",
      colors: ["#EC4899", "#A855F7", "#F472B6"] as [string, string, string],
    };
  if (action === "best_friend")
    return {
      icon: "people-circle" as keyof typeof Ionicons.glyphMap,
      title: "Besties sent",
      subtitle: "Premium friend energy delivered.",
      colors: ["#60A5FA", "#8B5CF6", "#EC4899"] as [string, string, string],
    };
  if (action === "create_plan")
    return {
      icon: "calendar" as keyof typeof Ionicons.glyphMap,
      title: "Opening plan",
      subtitle: "Make the invite feel easy.",
      colors: ["#22C55E", "#06B6D4", "#60A5FA"] as [string, string, string],
    };
  if (action === "create_group")
    return {
      icon: "people" as keyof typeof Ionicons.glyphMap,
      title: "Opening group",
      subtitle: "Bring the crew in.",
      colors: ["#38BDF8", "#6366F1", "#EC4899"] as [string, string, string],
    };
  if (action === "pass")
    return {
      icon: "close" as keyof typeof Ionicons.glyphMap,
      title: "Skipped",
      subtitle: "Next vibe loaded.",
      colors: ["#F43F5E", "#FB7185", "#EC4899"] as [string, string, string],
    };
  return {
    icon: (intent === "friends" ? "person-add" : "heart") as keyof typeof Ionicons.glyphMap,
    title: "Like sent",
    subtitle:
      intent === "friends" ? "They can accept in Connect." : "You moved the match closer.",
    colors: ["#EC4899", "#F97316", "#FACC15"] as [string, string, string],
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ExpandedProfileCard({
  profile,
  matchMode = false,
  onClose,
  onAction,
  onActionComplete,
  onShot,
  onMessage,
}: Props) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 16 : insets.top;
  const bottomPad = Platform.OS === "web" ? 24 : insets.bottom + 16;

  const [photoIdx, setPhotoIdx] = useState(0);
  const [feedbackAction, setFeedbackAction] = useState<ProfileAction | null>(null);
  const actionInFlightRef = useRef(false);
  const feedbackAnim = useRef(new Animated.Value(0)).current;
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const intent = profile.intent ?? "dating";
  const accent = accentColors(profile);

  // All photos — prefer photos[], fall back to single image
  const allPhotos: string[] = profile.photos?.length
    ? (profile.photos as string[])
    : profile.image
    ? [profile.image]
    : [];

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    };
  }, []);

  const playActionFeedback = (action: ProfileAction) =>
    new Promise<void>((resolve) => {
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      setFeedbackAction(action);
      feedbackAnim.setValue(0);
      Animated.sequence([
        Animated.spring(feedbackAnim, {
          toValue: 1,
          stiffness: 290,
          damping: 16,
          mass: 0.9,
          useNativeDriver: true,
        }),
        Animated.timing(feedbackAnim, {
          toValue: 0,
          duration: 180,
          delay: 380,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setFeedbackAction(null);
        resolve();
      });
      feedbackTimeoutRef.current = setTimeout(resolve, 720);
    });

  const handleAction = async (action: ProfileAction) => {
    if (feedbackAction || actionInFlightRef.current) return;
    actionInFlightRef.current = true;

    if (intent === "dating" && action === "shot") {
      // Double-pulse haptic so the tap feels intentional before the sheet opens
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}), 100);
      onShot?.();
      actionInFlightRef.current = false;
      return;
    }

    const haptic =
      action === "pass"
        ? Haptics.ImpactFeedbackStyle.Light
        : action === "spark" || action === "best_friend"
        ? Haptics.ImpactFeedbackStyle.Heavy
        : Haptics.ImpactFeedbackStyle.Medium;
    void Haptics.impactAsync(haptic).catch(() => {});

    try {
      // 1. Validate with parent first (guard check + record). Fast — does NOT close the modal.
      //    Returns false if the action was blocked (premium gate, friend action rejected, etc.).
      const result = await Promise.resolve().then(() => onAction?.(action));
      if (result === false) return;

      // 2. Play the in-card overlay animation. The modal stays open so the full animation
      //    is visible — previously this raced with closeExpandedProfile and got cut short.
      await playActionFeedback(action);

      // 3. Success haptic confirms the action landed.
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      // 4. Hand off to parent to close the profile and advance to the next card.
      onActionComplete?.(action);
    } finally {
      actionInFlightRef.current = false;
    }
  };

  const goNext = () => setPhotoIdx((i) => Math.min(allPhotos.length - 1, i + 1));
  const goPrev = () => setPhotoIdx((i) => Math.max(0, i - 1));

  const nameStr = `${profile.name}${profile.age ? `, ${profile.age}` : ""}`;
  const subIntentLabel = getSubIntentionLabel(profile);

  return (
    <View style={expStyles.root}>
      <ScrollView
        style={expStyles.scroll}
        contentContainerStyle={[
          expStyles.scrollContent,
          { paddingBottom: matchMode ? 100 + bottomPad : 160 + bottomPad },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero photo section ─────────────────────────────────────────── */}
        <View style={expStyles.hero}>
          {allPhotos.length > 0 ? (
            <ExpoImage
              source={{ uri: allPhotos[photoIdx] ?? allPhotos[0] }}
              style={expStyles.heroImage}
              contentFit="cover"
              transition={220}
            />
          ) : (
            <LinearGradient
              colors={["#1a0a1e", "#0d0d12"]}
              style={[expStyles.heroImage, { alignItems: "center", justifyContent: "center" }]}
            >
              <Ionicons name="person" size={80} color="rgba(255,255,255,0.18)" />
            </LinearGradient>
          )}

          <LinearGradient
            colors={["rgba(0,0,0,0.15)", "rgba(0,0,0,0.25)", "#050505"]}
            locations={[0, 0.52, 1]}
            style={StyleSheet.absoluteFill}
          />

          {/* Tap zones for photo navigation */}
          {allPhotos.length > 1 ? (
            <>
              <Pressable onPress={goPrev} style={expStyles.photoZoneLeft} />
              <Pressable onPress={goNext} style={expStyles.photoZoneRight} />
            </>
          ) : null}

          {/* Photo progress dots */}
          {allPhotos.length > 1 ? (
            <View style={[expStyles.photoDots, { top: topPad + 6 }]}>
              {allPhotos.map((_, i) => (
                <View
                  key={i}
                  style={[expStyles.photoDot, i === photoIdx && expStyles.photoDotActive]}
                />
              ))}
            </View>
          ) : null}

          {/* Close button */}
          <View style={[expStyles.topBtnRow, { top: topPad + 4 }]}>
            <AnimatedTap onPress={onClose} style={expStyles.iconBtn} pressScale={0.92} testID="expanded-profile-close-btn">
              <Ionicons name="close" size={26} color="#FFF" />
            </AnimatedTap>
          </View>

          {/* Hero bottom info */}
          <View style={expStyles.heroBottom}>
            <View style={expStyles.heroTopRow}>
              <View style={{ flex: 1 }}>
                <View style={expStyles.heroNameRow}>
                  <Text style={expStyles.heroName} numberOfLines={1}>
                    {nameStr}
                  </Text>
                  {profile.verified ? (
                    <View style={expStyles.verifiedMark}>
                      <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                    </View>
                  ) : null}
                </View>

                <View style={expStyles.heroSubRow}>
                  {!!profile.location && (
                    <>
                      <Ionicons name="location-outline" size={14} color="#E4E4E7" />
                      <Text style={expStyles.heroSubText}>{profile.location}</Text>
                      {(profile.online || matchMode) ? (
                        <Text style={expStyles.heroSubDot}>•</Text>
                      ) : null}
                    </>
                  )}
                  {profile.online ? (
                    <>
                      <View style={expStyles.heroOnlineDot} />
                      <Text style={expStyles.heroSubText}>Online</Text>
                    </>
                  ) : matchMode ? (
                    // In match context, show "Your match" indicator instead of live status
                    <>
                      <View style={[expStyles.heroOnlineDot, { backgroundColor: "#EC4899" }]} />
                      <Text style={expStyles.heroSubText}>Your match</Text>
                    </>
                  ) : null}
                </View>
              </View>

              {/* Match score — only in discover mode when present */}
              {!matchMode && profile.matchScore != null ? (
                <View style={expStyles.matchBadge}>
                  <Text style={expStyles.matchBadgeText}>{profile.matchScore}% Match</Text>
                </View>
              ) : null}
            </View>

            {/* Intent badge */}
            <View style={expStyles.badgeRow}>
              <View style={expStyles.intentBadge}>
                <LinearGradient
                  colors={accent}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
                />
                <View style={expStyles.intentBadgeIcon}>
                  <Ionicons name={getIntentIcon(intent)} size={18} color="#FFF" />
                </View>
                <Text style={expStyles.intentBadgeText}>
                  {getIntentDisplayLabel(intent)}
                </Text>
                {subIntentLabel ? (
                  <>
                    <Text style={expStyles.intentBadgeDivider}>·</Text>
                    <Text style={expStyles.intentBadgeSubText} numberOfLines={1}>
                      {subIntentLabel}
                    </Text>
                  </>
                ) : null}
              </View>
            </View>
          </View>
        </View>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <View style={expStyles.body}>
          {/* Photo thumbnail strip */}
          {allPhotos.length > 1 ? (
            <View style={expStyles.photoStrip}>
              {allPhotos.map((uri, i) => (
                <Pressable
                  key={i}
                  onPress={() => setPhotoIdx(i)}
                  style={[
                    expStyles.photoThumb,
                    i === photoIdx && expStyles.photoThumbActive,
                  ]}
                >
                  <ExpoImage
                    source={{ uri }}
                    style={expStyles.photoThumbImg}
                    contentFit="cover"
                  />
                  {i === photoIdx ? (
                    <View style={expStyles.photoThumbOverlay} />
                  ) : null}
                </Pressable>
              ))}
            </View>
          ) : null}

          {/* Bio */}
          {!!profile.bio && (
            <Text style={expStyles.bio}>{profile.bio}</Text>
          )}

          <View style={expStyles.divider} />

          {/* Profile upgrade section */}
          {intent === "dating" ? (
            <DatingProfileSection
              profile={profile}
              matchMode={matchMode}
              onShotIdea={onShot}
            />
          ) : (
            <FriendProfileSection
              profile={profile}
              onAction={handleAction}
            />
          )}

          {/* About Me info grid */}
          <View>
            <Text style={expStyles.sectionTitle}>About Me</Text>
            <View style={expStyles.infoGrid}>
              {profile.firstDateStyle ? (
                <InfoPill label="First date" value={profile.firstDateStyle} />
              ) : null}
              {subIntentLabel ? (
                <InfoPill label="Looking for" value={subIntentLabel} />
              ) : null}
            </View>
          </View>

          {/* Interests */}
          {(profile.interests?.length ?? 0) > 0 && (
            <View style={expStyles.section}>
              <Text style={expStyles.sectionTitle}>Interests</Text>
              <View style={expStyles.interestsRow}>
                {(profile.interests as string[]).map((interest) => (
                  <View key={interest} style={expStyles.interestChip}>
                    <Text style={expStyles.interestText}>{interest}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Prompt answer */}
          {!!profile.promptAnswer && (
            <View style={[expStyles.section, datingStyles.card]}>
              {!!profile.prompt && (
                <Text style={datingStyles.eyebrow}>{profile.prompt}</Text>
              )}
              <Text style={[expStyles.bio, { marginTop: 6 }]}>
                "{profile.promptAnswer}"
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Bottom bar ─────────────────────────────────────────────────────── */}
      <View style={[expStyles.bottomBar, { paddingBottom: bottomPad }]}>
        {matchMode ? (
          /* Match mode — single "Message" CTA */
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              onMessage?.();
            }}
            style={expStyles.messageCta}
            testID="expanded-profile-message-cta"
          >
            <LinearGradient
              colors={["#EC4899", "#D946EF", "#A855F7"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={expStyles.messageCtaGrad}
            >
              <Ionicons name="chatbubble-ellipses" size={19} color="#fff" />
              <Text style={expStyles.messageCtaText}>
                Message {profile.name.split(" ")[0]}
              </Text>
            </LinearGradient>
          </Pressable>
        ) : (
          /* Discover mode — full action buttons */
          <BigActionsBar profile={profile} onAction={handleAction} />
        )}
      </View>

      {/* Feedback overlay (discover mode only) */}
      {!matchMode && feedbackAction ? (
        <ExpandedActionFeedback
          action={feedbackAction}
          intent={intent}
          anim={feedbackAnim}
        />
      ) : null}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const expStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#050505" },
  scroll: { flex: 1 },
  scrollContent: {},

  feedbackOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 60,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  feedbackRing: {
    position: "absolute",
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 2,
    borderColor: "rgba(236,72,153,0.82)",
  },
  feedbackCard: {
    width: 190,
    minHeight: 190,
    borderRadius: 34,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    shadowColor: "#EC4899",
    shadowOpacity: 0.55,
    shadowRadius: 32,
    elevation: 22,
  },
  feedbackIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  feedbackTitle: {
    marginTop: 14,
    color: "#FFFFFF",
    fontSize: 21,
    fontFamily: "Sora_800ExtraBold",
    textAlign: "center",
  },
  feedbackSubtitle: {
    marginTop: 4,
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    fontFamily: "Inter_800ExtraBold",
    textAlign: "center",
    lineHeight: 17,
  },

  hero: { position: "relative", minHeight: 470, height: 560, overflow: "hidden" },
  heroImage: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },

  photoZoneLeft: { position: "absolute", left: 0, top: 0, bottom: 0, width: "45%" },
  photoZoneRight: { position: "absolute", right: 0, top: 0, bottom: 0, width: "45%" },

  photoDots: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    gap: 4,
    justifyContent: "center",
  },
  photoDot: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.35)",
    maxWidth: 80,
  },
  photoDotActive: { backgroundColor: "#FFF" },

  photoStrip: { flexDirection: "row", gap: 8, marginBottom: 16 },
  photoThumb: {
    flex: 1,
    height: 100,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  photoThumbActive: { borderColor: "#EC4899" },
  photoThumbImg: { width: "100%", height: "100%" },
  photoThumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(236,72,153,0.18)",
  },

  topBtnRow: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },

  heroBottom: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 20 },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
  },
  heroNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: "100%",
  },
  heroName: {
    color: "#FFF",
    fontSize: 40,
    fontWeight: "900",
    letterSpacing: -1,
    flexShrink: 1,
  },
  verifiedMark: {
    width: 23,
    height: 23,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EC4899",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.86)",
    flexShrink: 0,
  },
  heroSubRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  heroSubText: { color: "#E4E4E7", fontSize: 13 },
  heroSubDot: { color: "#E4E4E7", fontSize: 13 },
  heroOnlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#34D399",
  },

  matchBadge: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(244,114,182,0.3)",
    backgroundColor: "rgba(236,72,153,0.15)",
  },
  matchBadgeText: { color: "#FBCFE8", fontSize: 13, fontWeight: "900" },

  badgeRow: { marginTop: 16, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  intentBadge: {
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
  },
  intentBadgeIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  intentBadgeText: { color: "#FFF", fontSize: 13, fontWeight: "900" },
  intentBadgeDivider: { color: "rgba(255,255,255,0.78)", fontSize: 13, fontWeight: "900" },
  intentBadgeSubText: { color: "#FFF", flexShrink: 1, fontSize: 13, fontWeight: "800" },

  body: { paddingHorizontal: 20 },
  bio: { marginTop: 12, color: "#F4F4F5", fontSize: 15, lineHeight: 24 },
  divider: {
    marginVertical: 20,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  section: { marginTop: 24 },
  sectionTitle: { color: "#F472B6", fontSize: 13, fontWeight: "900" },

  infoGrid: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  infoPill: {
    flexBasis: "47%",
    flexGrow: 1,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  infoPillLabel: {
    color: "#71717A",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  infoPillValue: { marginTop: 4, color: "#FFF", fontSize: 14, fontWeight: "900" },

  interestsRow: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  interestChip: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  interestText: { color: "#F4F4F5", fontSize: 14, fontWeight: "700" },

  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(0,0,0,0.85)",
    paddingHorizontal: 20,
    paddingTop: 16,
  },

  // Discover mode action buttons
  bigActionsRow: { flexDirection: "row", justifyContent: "space-around" },
  bigWrap: { alignItems: "center", gap: 8 },
  bigBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  bigBtnDefault: { backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 32 },
  bigLabel: { color: "#E4E4E7", fontSize: 12, fontWeight: "700" },

  // Match mode "Message" CTA
  messageCta: {
    borderRadius: 999,
    overflow: "hidden",
  },
  messageCtaGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 17,
  },
  messageCtaText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
});

const datingStyles = StyleSheet.create({
  wrap: { gap: 14, marginBottom: 6 },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(244,114,182,0.24)",
    backgroundColor: "rgba(236,72,153,0.08)",
    padding: 14,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  eyebrow: {
    color: "#F9A8D4",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  title: {
    marginTop: 4,
    color: "#FFF",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  statsRow: { marginTop: 14, flexDirection: "row", gap: 10 },
  miniStat: {
    flex: 1,
    minHeight: 86,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(0,0,0,0.24)",
    padding: 12,
    justifyContent: "space-between",
  },
  miniStatLabel: {
    color: "#A1A1AA",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  miniStatValue: { color: "#FFF", fontSize: 13, fontWeight: "900" },
  signalRow: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  signalChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(244,114,182,0.20)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  signalText: { color: "#FCE7F3", fontSize: 11, fontWeight: "800" },
  pollHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  planCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 14,
    gap: 10,
  },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  planIcon: {
    width: 34,
    height: 34,
    borderRadius: 13,
    backgroundColor: "rgba(236,72,153,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  planTitle: { color: "#FFF", fontSize: 14, fontWeight: "900" },
  planSub: { marginTop: 2, color: "#A1A1AA", fontSize: 12, fontWeight: "600" },
  planEditHint: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(249,168,212,0.30)",
    backgroundColor: "rgba(249,168,212,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
});

const friendUpgradeStyles = StyleSheet.create({
  card: {
    borderColor: "rgba(96,165,250,0.28)",
    backgroundColor: "rgba(59,130,246,0.08)",
  },
  eyebrow: { color: "#BFDBFE" },
  signalChip: { borderColor: "rgba(96,165,250,0.22)" },
  planIcon: { backgroundColor: "rgba(59,130,246,0.88)" },
});
