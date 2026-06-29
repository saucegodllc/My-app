import { useAuth, useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import * as Crypto from "expo-crypto";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import ReAnimated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CreateFriendPlanSheet, { type PlanDraft } from "@/components/CreateFriendPlanSheet";
import { encodePlanRequest, encodePlanResponse } from "@/lib/planRequestEnvelope";
import { encodeVoiceMemoPayload, parseChatPayload } from "@/lib/chatPayload";
import { createFriendPlan } from "@/services/friendsApi";
import { publishChatSignal, subscribeToChatSignals } from "@/services/chatSignals";
import VoiceNoteRecorder, { VoiceNoteBubble } from "@/components/VoiceNoteRecorder";
import GifPicker, { type GifItem } from "@/components/GifPicker";
import OpenerSuggestions from "@/components/OpenerSuggestions";
import IcebreakerBar from "@/components/IcebreakerBar";
import { useIcebreakers } from "@/hooks/useIcebreakers";
import { recordFirstMessage } from "@/lib/featureUnlock";
import { enqueueMessage, drainQueue } from "@/lib/offlineQueue";
import { playSound } from "@/lib/sounds";

import { useColors } from "@/hooks/useColors";
import ReportBlockSheet from "@/components/ReportBlockSheet";
import { useFeedback } from "@/components/ActionFeedback";
import { TypingIndicator } from "@/components/TypingIndicator";
import { MessageReactionPicker, MessageReactionBubble, useMessageReactions, type ReactionEmoji } from "@/components/MessageReactionPicker";
import { useSessionState } from "@/hooks/useSessionState";
import { hasUserMessages } from "./chatFreshness";
import { getJsonChat, sendJsonChatMessage, type ChatResponse } from "@/services/doubleDateApi";
import {
  getConversationMessages as getInboxConversationMessages,
  sendMessage as sendInboxMessage,
  type CsConversation,
} from "@/services/connectApi";
import { archiveChat, clearChat, markChatRead, muteChat, reportMessage, unmatchChat } from "@/services/launchReadyApi";
import { useGetMessages, useSendMessage } from "@workspace/api-client-react";

type MessageType = "text" | "voice" | "gif" | "image" | "plan_request";

type Message = {
  id: string;
  clientId?: string; // client-generated UUID for optimistic/offline
  matchId?: string;
  chatId?: string;
  senderId: string;
  content: string;
  isRead: boolean;
  readAt?: string; // ISO — for read receipts (premium)
  createdAt: string;
  system?: boolean;
  messageType?: MessageType;
  voiceUrl?: string;
  voiceDurationSeconds?: number;
  gifUrl?: string;
  imageUrl?: string;
  planData?: {
    planId?: string;
    title: string;
    time: string;
    location: string;
    status: "pending" | "accepted" | "declined";
  };
};

function createOfflineClientId() {
  const randomUUID = (Crypto as { randomUUID?: () => string }).randomUUID;
  if (typeof randomUUID === "function") return randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function PlanRequestCard({
  planData,
  isOwn,
  status,
  onAccept,
  onDecline,
  colors,
}: {
  planData: NonNullable<Message["planData"]>;
  isOwn: boolean;
  status: "pending" | "accepted" | "declined";
  onAccept?: () => void;
  onDecline?: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const statusColor =
    status === "accepted" ? "#22C55E" : status === "declined" ? "#F87171" : colors.mutedForeground;
  const statusIcon =
    status === "accepted"
      ? ("checkmark-circle" as const)
      : status === "declined"
        ? ("close-circle" as const)
        : ("time-outline" as const);
  const statusLabel =
    status === "accepted" ? "Plan confirmed!" : status === "declined" ? "Declined" : "Pending reply";

  return (
    <View style={[styles.planCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.planCardHeader}>
        <View style={[styles.planCardIconWrap, { backgroundColor: colors.primary + "18" }]}>
          <Ionicons name="calendar" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.planCardTitle, { color: colors.foreground }]} numberOfLines={2}>
            {planData.title}
          </Text>
          <View style={styles.planCardStatusRow}>
            <Ionicons name={statusIcon} size={13} color={statusColor} />
            <Text style={[styles.planCardStatusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>
      </View>
      {(planData.time || planData.location) ? (
        <View style={styles.planCardMeta}>
          {planData.time ? (
            <View style={styles.planCardMetaRow}>
              <Ionicons name="time-outline" size={13} color={colors.mutedForeground} />
              <Text style={[styles.planCardMetaText, { color: colors.mutedForeground }]}>{planData.time}</Text>
            </View>
          ) : null}
          {planData.location ? (
            <View style={styles.planCardMetaRow}>
              <Ionicons name="location-outline" size={13} color={colors.mutedForeground} />
              <Text style={[styles.planCardMetaText, { color: colors.mutedForeground }]}>{planData.location}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      {!isOwn && status === "pending" ? (
        <View style={styles.planCardActions}>
          <Pressable
            onPress={onDecline}
            style={[styles.planCardDecline, { borderColor: colors.border }]}
            hitSlop={4}
          >
            <Text style={[styles.planCardDeclineText, { color: colors.mutedForeground }]}>Decline</Text>
          </Pressable>
          <Pressable
            onPress={onAccept}
            style={[styles.planCardAccept, { backgroundColor: colors.primary }]}
            hitSlop={4}
          >
            <Text style={styles.planCardAcceptText}>Accept plan</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function ContextBanner({
  photoUrl,
  name,
  presence,
  onPress,
  colors,
}: {
  photoUrl?: string;
  name: string;
  presence: string;
  onPress?: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.ctxBanner, { borderBottomColor: colors.border }]}>
      <Pressable onPress={onPress} style={styles.ctxBannerContent} hitSlop={4}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.ctxAvatar} contentFit="cover" />
        ) : (
          <View style={[styles.ctxAvatar, styles.ctxAvatarFallback, { backgroundColor: colors.primary + "28" }]}>
            <Text style={{ fontSize: 20, fontWeight: "700", color: colors.primary }}>
              {(name[0] ?? "?").toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.ctxInfo}>
          <Text style={[styles.ctxName, { color: colors.foreground }]} numberOfLines={1}>{name}</Text>
          <Text style={[styles.ctxPresence, { color: colors.mutedForeground }]} numberOfLines={1}>{presence}</Text>
        </View>
      </Pressable>
      <View style={[styles.ctxHint, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "28" }]}>
        <Ionicons name="sparkles" size={13} color={colors.primary} />
        <Text style={[styles.ctxHintText, { color: colors.primary }]}>Be the first to say hi</Text>
      </View>
    </View>
  );
}

function MessageBubble({
  message,
  isOwn,
  colors,
  onLongPress,
  reaction,
  onReactionPress,
  planStatus,
  onAccept,
  onDecline,
}: {
  message: Message;
  isOwn: boolean;
  colors: ReturnType<typeof useColors>;
  onLongPress: (message: Message) => void;
  reaction?: ReactionEmoji;
  onReactionPress?: () => void;
  planStatus?: "pending" | "accepted" | "declined";
  onAccept?: () => void;
  onDecline?: () => void;
}) {
  const [showTime, setShowTime] = useState(false);
  // Only animate messages sent within the last 3 seconds — prevents the whole
  // history from springing in simultaneously on initial load.
  const isFresh = Date.now() - new Date(message.createdAt).getTime() < 3000;

  if (message.system || message.senderId === "system") {
    return (
      <View style={styles.systemBubble}>
        <Ionicons name="sparkles" size={13} color={colors.primary} />
        <Text style={[styles.systemText, { color: colors.mutedForeground }]}>{message.content}</Text>
      </View>
    );
  }

  const timeStr = new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  // Read receipt: ✓✓ (read) vs ✓ (delivered). Only shown for own messages.
  const readStatus = isOwn
    ? message.readAt
      ? "✓✓"
      : message.isRead
        ? "✓✓"
        : "✓"
    : "";

  // Voice note bubble
  if (message.messageType === "voice" && message.voiceUrl) {
    return (
      <View style={[styles.bubbleRow, isOwn ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
        <VoiceNoteBubble
          url={message.voiceUrl}
          durationSeconds={message.voiceDurationSeconds ?? 5}
          isOwn={isOwn}
        />
      </View>
    );
  }

  // GIF bubble
  if (message.messageType === "gif" && message.gifUrl) {
    return (
      <View style={[styles.bubbleRow, isOwn ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
        <Pressable
          onLongPress={() => onLongPress(message)}
          style={styles.gifBubble}
        >
          <Image source={{ uri: message.gifUrl }} style={styles.gifImage} contentFit="cover" />
        </Pressable>
      </View>
    );
  }

  // Image bubble (tappable full-screen)
  if (message.messageType === "image" && message.imageUrl) {
    return (
      <View style={[styles.bubbleRow, isOwn ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
        <Pressable
          onLongPress={() => onLongPress(message)}
          style={[styles.imageBubble, isOwn ? styles.imageBubbleOwn : styles.imageBubbleOther]}
        >
          <Image source={{ uri: message.imageUrl }} style={styles.imageBubbleImg} contentFit="cover" />
        </Pressable>
      </View>
    );
  }

  // Plan request card
  if (message.messageType === "plan_request" && message.planData) {
    return (
      <View style={[styles.bubbleRow, isOwn ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
        <PlanRequestCard
          planData={message.planData}
          isOwn={isOwn}
          status={planStatus ?? message.planData.status}
          onAccept={onAccept}
          onDecline={onDecline}
          colors={colors}
        />
      </View>
    );
  }

  return (
    <ReAnimated.View entering={isFresh ? FadeInDown.springify().damping(26).stiffness(300) : undefined}>
      <View style={[styles.bubbleRow, isOwn ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
        <View style={{ position: "relative" }}>
          <Pressable
            onLongPress={() => onLongPress(message)}
            onPress={() => setShowTime((v) => !v)}
            style={[
              styles.bubble,
              isOwn
                ? { backgroundColor: colors.primary }
                : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
            ]}
          >
            <Text style={[styles.bubbleText, { color: isOwn ? "#fff" : colors.foreground }]}>
              {message.content}
            </Text>
          </Pressable>
          {/* Reaction badge */}
          {reaction && (
            <MessageReactionBubble
              emoji={reaction}
              isOwn={isOwn}
              onPress={() => onReactionPress?.()}
            />
          )}
        </View>
        {/* Timestamp + read receipt shown on tap (iMessage-style) */}
        {showTime && (
          <Text style={[styles.bubbleTime, { color: colors.mutedForeground, alignSelf: isOwn ? "flex-end" : "flex-start" }]}>
            {timeStr}{readStatus ? ` ${readStatus}` : ""}
          </Text>
        )}
      </View>
    </ReAnimated.View>
  );
}

function ChatQuickPrompts({
  title,
  prompts,
  onSend,
  colors,
}: {
  title: string;
  prompts: string[];
  onSend: (prompt: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  // Import ScrollView at the top of the file — it's already there from RN
  const { ScrollView: HScrollView } = require("react-native");
  return (
    <View style={styles.promptWrap}>
      <Text style={[styles.promptTitle, { color: colors.foreground }]}>{title}</Text>
      <HScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.promptRow}
      >
        {prompts.map((prompt) => (
          <Pressable key={prompt} onPress={() => onSend(prompt)} style={[styles.promptChip, { borderColor: colors.border }]}>
            <Ionicons name="sparkles" size={12} color={colors.primary} />
            <Text style={[styles.promptText, { color: colors.foreground }]}>{prompt}</Text>
          </Pressable>
        ))}
      </HScrollView>
    </View>
  );
}

function buildFreshStarter({
  name,
  isDoubleDate,
  isPlan,
  quickActions,
}: {
  name?: string;
  isDoubleDate: boolean;
  isPlan: boolean;
  quickActions: string[];
}) {
  const firstName = (name ?? "your match").split(" ")[0] || "your match";
  const topic =
    quickActions.find((item) => !/ai opener|make a plan|invite more/i.test(item)) ??
    (isDoubleDate ? "a double-date spot" : isPlan ? "the plan" : "a favorite Miami spot");
  if (isDoubleDate) {
    return {
      fact: `${firstName} is ready to turn this match into a double-date plan.`,
      question: `Okay, what vibe should we make the double date: ${topic.toLowerCase()} or something spontaneous?`,
    };
  }
  if (isPlan) {
    return {
      fact: `${firstName} already has a plan thread open with you.`,
      question: "I'm in. What should we lock first: time, place, or who's coming?",
    };
  }
  return {
    fact: `${firstName}'s profile gives you an easy opening: ${topic}.`,
    question: `No way, tell me more about ${topic.toLowerCase()}?`,
  };
}

/**
 * NextMoveBanner — contextual nudge for stale / your-turn conversations.
 * Shows above the message list (below the header) when the conversation
 * has gone quiet. Dismissed by the user or automatically when they send.
 */
function NextMoveBanner({
  lastMessage,
  currentUserId,
  otherName,
  onOpenMoments,
  onMakePlan,
  onBreakIce,
  onDismiss,
  colors,
}: {
  lastMessage: Message | undefined;
  currentUserId: string;
  otherName?: string;
  onOpenMoments: () => void;
  onMakePlan: () => void;
  onBreakIce: () => void;
  onDismiss: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const name = (otherName ?? "them").split(" ")[0] || "them";
  const now = Date.now();

  // Determine nudge type
  if (!lastMessage) return null; // no messages yet → FreshChatStarter handles it
  const ageMs = now - new Date(lastMessage.createdAt).getTime();
  const ageH = ageMs / 3600000;
  const isTheirTurn = lastMessage.senderId === currentUserId; // we sent last
  const isOurTurn = lastMessage.senderId !== currentUserId;   // they sent last

  // Show when: they replied and we haven't responded in 3h+, OR we sent and no reply in 48h+
  const shouldShow = (isOurTurn && ageH > 3) || (isTheirTurn && ageH > 48);
  if (!shouldShow) return null;

  const emoji = isOurTurn ? "💬" : "⏳";
  const headline = isOurTurn
    ? `${name} is waiting on you`
    : `No reply yet — shake things up`;
  const sub = isOurTurn
    ? "A quick Moment reply or plan idea goes a long way."
    : "Reply with a Moment, make a plan, or send a sharper opener.";

  return (
    <View style={[styles.nextMoveBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Pressable onPress={onDismiss} style={styles.nextMoveDismiss} hitSlop={8}>
        <Ionicons name="close" size={16} color={colors.mutedForeground} />
      </Pressable>
      <View style={styles.nextMoveTop}>
        <Text style={styles.nextMoveEmoji}>{emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.nextMoveHeadline, { color: colors.foreground }]}>{headline}</Text>
          <Text style={[styles.nextMoveSub, { color: colors.mutedForeground }]}>{sub}</Text>
        </View>
      </View>
      <View style={styles.nextMoveActions}>
        <Pressable style={[styles.nextMoveChip, { borderColor: colors.border }]} onPress={onOpenMoments}>
          <Ionicons name="sparkles-outline" size={13} color={colors.primary} />
          <Text style={[styles.nextMoveChipText, { color: colors.foreground }]}>Open Moments</Text>
        </Pressable>
        <Pressable style={[styles.nextMoveChip, { borderColor: colors.border }]} onPress={onMakePlan}>
          <Ionicons name="calendar-outline" size={13} color={colors.primary} />
          <Text style={[styles.nextMoveChipText, { color: colors.foreground }]}>Make a plan</Text>
        </Pressable>
        <Pressable style={[styles.nextMoveChip, { borderColor: colors.border }]} onPress={onBreakIce}>
          <Ionicons name="sparkles" size={13} color={colors.primary} />
          <Text style={[styles.nextMoveChipText, { color: colors.foreground }]}>Break the ice</Text>
        </Pressable>
      </View>
    </View>
  );
}

function FreshChatStarter({
  fact,
  question,
  onUse,
}: {
  fact: string;
  question: string;
  onUse: (question: string) => void;
}) {
  const pop = useRef(new Animated.Value(1)).current;
  const handlePress = () => {
    Animated.sequence([
      Animated.spring(pop, { toValue: 1.08, stiffness: 280, damping: 10, useNativeDriver: true }),
      Animated.timing(pop, { toValue: 0, duration: 130, useNativeDriver: true }),
    ]).start(() => onUse(question));
  };

  return (
    <View style={styles.freshStarter}>
      <View style={styles.freshBox}>
        <Ionicons name="sparkles" size={18} color="#FF2DA8" />
        <Text style={styles.freshFact}>{fact}</Text>
      </View>
      <Animated.View style={{ transform: [{ scale: pop }] }}>
        <Pressable onPress={handlePress} style={styles.askChip}>
          <Text style={styles.askChipText}>🌟 Ask about this</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

type ChatPromptTrigger = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  message: string;
};

function buildPromptTriggers({
  name,
  isDoubleDate,
  isPlan,
  topic,
}: {
  name?: string;
  isDoubleDate: boolean;
  isPlan: boolean;
  topic: string;
}): ChatPromptTrigger[] {
  const firstName = (name ?? "you").split(" ")[0] || "you";
  if (isDoubleDate) {
    return [
      {
        id: "duo-this-or-that",
        icon: "shuffle",
        label: "This or That",
        message: "Quick opener: rooftop drinks, low-key dinner, or something weird neither pair has tried?",
      },
      {
        id: "duo-plan-dare",
        icon: "flame",
        label: "Plan Dare",
        message: "Plan dare: each pair picks one place, then we choose the boldest one. You in?",
      },
      {
        id: "duo-vibe-check",
        icon: "sparkles",
        label: "Vibe Check",
        message: `Vibe check for ${firstName}: are we going polished, chaotic-fun, or easy casual?`,
      },
    ];
  }
  if (isPlan) {
    return [
      {
        id: "plan-lock",
        icon: "calendar",
        label: "Lock It",
        message: "Tiny planning prompt: you pick the time, I'll pick the first spot?",
      },
      {
        id: "plan-wildcard",
        icon: "dice",
        label: "Wildcard",
        message: "Wildcard rule: if we can't decide in 3 messages, we choose the easiest public spot.",
      },
      {
        id: "plan-hype",
        icon: "flash",
        label: "Hype",
        message: "I'm voting yes. What would make this plan a 10/10?",
      },
    ];
  }
  return [
    {
      id: "two-truths",
      icon: "dice",
      label: "Two Truths",
      message: `Two truths and a lie, but make it about ${topic.toLowerCase()}. I'll guess first.`,
    },
    {
      id: "this-or-that",
      icon: "swap-horizontal",
      label: "This or That",
      message: `${firstName}, quick this-or-that: spontaneous night out or perfectly planned date?`,
    },
    {
      id: "tiny-dare",
      icon: "flame",
      label: "Tiny Dare",
      message: "Tiny dare: send me your most underrated Miami recommendation and I'll send mine.",
    },
  ];
}

function ChatPromptTriggers({
  triggers,
  onUse,
}: {
  triggers: ChatPromptTrigger[];
  onUse: (message: string) => void;
}) {
  return (
    <View style={styles.openerWrap}>
      <View style={styles.openerHeader}>
        <Ionicons name="sparkles" size={14} color="#FF2DA8" />
        <Text style={styles.openerTitle}>Opener prompts</Text>
        <Pressable
          onPress={() => router.push("/(tabs)/moments" as any)}
          style={styles.openerOpenTabBtn}
          hitSlop={8}
        >
          <Text style={styles.openerOpenTabText}>Open Moments</Text>
        </Pressable>
      </View>
      <View style={styles.openerRow}>
        {triggers.map((trigger) => (
          <Pressable key={trigger.id} onPress={() => onUse(trigger.message)} style={styles.openerChip}>
            <Ionicons name={trigger.icon} size={13} color="#fff" />
            <Text style={styles.openerChipText}>{trigger.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ── Attachment Tray ──────────────────────────────────────────────────────────
// Slides up when the + button is tapped. Three purposeful options:
// GIF (browse hundreds of reactions), Photo (camera roll), Plan (real meetup).
// Animates in on mount via useEffect so the enter feels alive.
function AttachmentTray({
  onGif,
  onPhoto,
  onPlan,
  colors,
}: {
  onGif: () => void;
  onPhoto: () => void;
  onPlan: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 18,
      stiffness: 240,
    }).start();
  }, [anim]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [44, 0] });

  const items = [
    {
      icon: "film-outline" as const,
      label: "GIF",
      sub: "Browse hundreds of reactions",
      onPress: onGif,
    },
    {
      icon: "image-outline" as const,
      label: "Photo",
      sub: "Share from your camera roll",
      onPress: onPhoto,
    },
    {
      icon: "calendar-outline" as const,
      label: "Plan",
      sub: "Browse events or create your own",
      onPress: onPlan,
    },
  ] as const;

  return (
    <Animated.View
      style={[
        styles.attachTray,
        {
          borderTopColor: colors.border,
          backgroundColor: colors.background,
          opacity: anim,
          transform: [{ translateY }],
        },
      ]}
    >
      {items.map(({ icon, label, sub, onPress }) => (
        <Pressable
          key={label}
          onPress={onPress}
          style={({ pressed }) => [
            styles.attachTrayItem,
            {
              opacity: pressed ? 0.65 : 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
            },
          ]}
        >
          <View style={[styles.attachTrayIconWrap, { backgroundColor: colors.primary + "1A" }]}>
            <Ionicons name={icon} size={22} color={colors.primary} />
          </View>
          <View style={styles.attachTrayText}>
            <Text style={[styles.attachTrayLabel, { color: colors.foreground }]}>{label}</Text>
            <Text style={[styles.attachTraySub, { color: colors.mutedForeground }]}>{sub}</Text>
          </View>
          <Ionicons name="chevron-forward" size={15} color={colors.mutedForeground} />
        </Pressable>
      ))}
    </Animated.View>
  );
}

// ── Session-level chat cache (spec 1.2) ──────────────────────────────────────
// Keyed by matchId. Survives navigation so re-entering a chat renders the last
// known data instantly while a background refresh hydrates it. An entry with
// both fields null means "probed before: it's a server match" — that alone
// lets re-entry skip the blocking preferred-chat probe.
type InboxChatState = {
  messages: Array<{ id: string; text: string; senderUserId: string; createdAt: string }>;
  conversation: CsConversation;
};
const chatScreenCache = new Map<string, {
  inboxChat: InboxChatState | null;
  jsonChat: ChatResponse | null;
}>();

export default function ChatScreen() {
  const { matchId, wave, openPlan } = useLocalSearchParams<{ matchId: string; wave?: string; openPlan?: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const { user } = useUser();
  const { isSignedIn } = useAuth();
  const { userId } = useSessionState();
  const inputRef = useRef<TextInput>(null);
  const waveSentRef = useRef<string | null>(null);

  const [text, setText] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [pickerMessage, setPickerMessage] = useState<Message | null>(null);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showAttachTray, setShowAttachTray] = useState(false);
  const plusAnim = useRef(new Animated.Value(0)).current;
  const [offlineWarning, setOfflineWarning] = useState(false);
  const [nextMoveDismissed, setNextMoveDismissed] = useState(false);
  const isFirstMessageRef = useRef(true);
  const { addReaction, getReaction } = useMessageReactions();
  const [localClearedAt, setLocalClearedAt] = useState<string | null>(null);
  const [showPlanSheet, setShowPlanSheet] = useState(false);
  // "Make a Plan" from the match moment routes here with ?openPlan=1 — open
  // the plan sheet once on arrival.
  const openPlanConsumedRef = useRef(false);
  useEffect(() => {
    const flag = Array.isArray(openPlan) ? openPlan[0] : openPlan;
    if (flag === "1" && !openPlanConsumedRef.current) {
      openPlanConsumedRef.current = true;
      setShowPlanSheet(true);
    }
  }, [openPlan]);
  const [planStatuses, setPlanStatuses] = useState<Record<string, "pending" | "accepted" | "declined">>({});

  // Attachment tray — + button opens/closes the tray; plus icon rotates 45° when open.
  useEffect(() => {
    Animated.spring(plusAnim, {
      toValue: showAttachTray ? 1 : 0,
      useNativeDriver: true,
      damping: 15,
      stiffness: 200,
    }).start();
  }, [showAttachTray, plusAnim]);

  const toggleAttachTray = useCallback(() => {
    setShowAttachTray((prev) => !prev);
  }, []);

  // Tray action: GIF — close tray, then open picker after tray animates away
  const handleGifFromTray = useCallback(() => {
    setShowAttachTray(false);
    setTimeout(() => setShowGifPicker(true), 180);
  }, []);

  // Tray action: Photo — close tray then open camera roll
  const handlePhotoFromTray = useCallback(() => {
    setShowAttachTray(false);
  }, []);

  // Tray action: Plan — Alert lets user pick "Browse events" or "Create a plan"
  const handlePlanFromTray = useCallback(() => {
    setShowAttachTray(false);
    setTimeout(() => {
      Alert.alert(
        "Start a plan",
        "Browse upcoming events or create your own.",
        [
          {
            text: "Browse events",
            onPress: () => router.push("/(tabs)/events" as any),
          },
          {
            text: "Create a plan",
            onPress: () => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowPlanSheet(true);
            },
          },
          { text: "Cancel", style: "cancel" },
        ],
      );
    }, 120);
  }, []);

  const { trigger: triggerMsgFeedback, animatedStyle: sendBtnAnim, BurstOverlay: MsgBurst } = useFeedback("message");
  // Seed from the session cache so re-entry renders instantly (spec 1.2).
  const cachedChat = matchId ? chatScreenCache.get(matchId) : undefined;
  const [inboxChat, setInboxChat] = useState<InboxChatState | null>(cachedChat?.inboxChat ?? null);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxSending, setInboxSending] = useState(false);
  const [checkedPreferredChat, setCheckedPreferredChat] = useState(!!cachedChat);
  const [jsonChat, setJsonChat] = useState<ChatResponse | null>(cachedChat?.jsonChat ?? null);
  const [jsonLoading, setJsonLoading] = useState(false);
  const isInboxChat = !!inboxChat?.conversation;
  const isJsonChat = !!jsonChat?.chat;
  const isDoubleDateChat = jsonChat?.chat?.type === "double_date";
  const isFriendDirectChat = jsonChat?.chat?.type === "friend_direct";
  const isFriendPlanChat = jsonChat?.chat?.type === "friend_plan" || jsonChat?.chat?.type === "plan";
  const { data, isLoading, isError, error, refetch, isRefetching } = useGetMessages(matchId ?? "", undefined, {
    query: { enabled: !!matchId && !!isSignedIn && checkedPreferredChat && !isInboxChat && !isJsonChat },
  });

  // Detect expired / deleted match — API returns 404 or 403 (unmatched)
  const isMatchGone = isError && (
    (error as { status?: number })?.status === 404 ||
    (error as { status?: number })?.status === 403
  );
  const sendMutation = useSendMessage();
  const currentUserId = userId ?? "";

  // Race any fetch against a deadline — prevents indefinite hangs when
  // Render.com is cold-starting or the device is on a slow connection.
  function withTimeout<T>(promise: Promise<T>, ms = 5000): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error("fetch_timeout")), ms),
      ),
    ]);
  }

  const loadInboxChat = useCallback(async () => {
    if (!matchId || !currentUserId) return false;
    const entry = chatScreenCache.get(matchId);
    // With any cached probe result we refresh silently — no loading flag, so
    // cached content stays on screen instead of a spinner (spec 1.2).
    const background = !!entry;
    if (!background) setInboxLoading(true);
    try {
      const result = await withTimeout(getInboxConversationMessages(matchId, currentUserId));
      setInboxChat(result);
      setJsonChat(null);
      chatScreenCache.set(matchId, { inboxChat: result, jsonChat: null });
      return true;
    } catch {
      // Transient failure: keep showing cached data, never wipe it.
      if (!background) setInboxChat(null);
      return !!entry?.inboxChat;
    } finally {
      setInboxLoading(false);
    }
  }, [currentUserId, matchId]);

  const loadJsonChat = useCallback(async () => {
    if (!matchId) return;
    const entry = chatScreenCache.get(matchId);
    const background = !!entry;
    if (!background) setJsonLoading(true);
    try {
      const result = await withTimeout(getJsonChat(matchId));
      const next = result.chat ? result : null;
      if (next) {
        setJsonChat(next);
        chatScreenCache.set(matchId, { inboxChat: null, jsonChat: next });
      } else if (!entry?.jsonChat) {
        setJsonChat(null);
      }
    } catch {
      if (!background) setJsonChat(null);
    } finally {
      setJsonLoading(false);
    }
  }, [matchId]);

  // ── Real-time delivery (Pass 5, Tier 0) ────────────────────────────────────
  // Subscribe to this chat's Firestore signal doc; any remote bump means new
  // content on the server → silently refresh the active transport. The 1.2
  // session cache guarantees this never flickers or blocks the UI.
  const refreshActiveTransport = useCallback(() => {
    if (isInboxChat) {
      void loadInboxChat();
    } else if (isJsonChat) {
      void loadJsonChat();
    } else {
      void refetch();
    }
  }, [isInboxChat, isJsonChat, loadInboxChat, loadJsonChat, refetch]);

  useEffect(() => {
    if (!matchId) return;
    const unsubscribe = subscribeToChatSignals(matchId, (by) => {
      // Our own sends are already rendered optimistically/by the send path.
      if (by && by === currentUserId) return;
      refreshActiveTransport();
    });
    if (unsubscribe) return unsubscribe;
    // Firebase not configured (dev/local) — modest foreground poll so chat
    // still feels alive without the signal bus.
    const pollId = setInterval(refreshActiveTransport, 12_000);
    return () => clearInterval(pollId);
  }, [matchId, currentUserId, refreshActiveTransport]);

  useEffect(() => {
    let cancelled = false;
    // Hard cap — if both API calls are slow/cold the spinner never runs >6 s.
    const hardCapId = setTimeout(() => {
      if (!cancelled) setCheckedPreferredChat(true);
    }, 6000);
    async function loadPreferredChat() {
      // Only gate the message query when this matchId has never been probed —
      // cached chats render instantly and refresh in the background.
      const known = !!(matchId && chatScreenCache.has(matchId));
      if (!known) setCheckedPreferredChat(false);
      // Try inbox first — it clears jsonChat on success so only one path is
      // active at a time. Fall back to JSON chat only if inbox finds nothing.
      const loadedInbox = await loadInboxChat();
      if (!loadedInbox && !cancelled) await loadJsonChat();
      if (cancelled) return;
      setCheckedPreferredChat(true);
      // Remember the probe outcome ("server match") so re-entry skips the
      // blocking probe even when neither inbox nor JSON chat matched.
      if (matchId && !chatScreenCache.has(matchId)) {
        chatScreenCache.set(matchId, { inboxChat: null, jsonChat: null });
      }
    }
    void loadPreferredChat();
    return () => {
      cancelled = true;
      clearTimeout(hardCapId);
    };
  }, [loadInboxChat, loadJsonChat, matchId]);

  const messages: Message[] = useMemo(() => {
    const afterLocalClear = (message: Message) => !localClearedAt || new Date(message.createdAt).getTime() > new Date(localClearedAt).getTime();
    let base: Message[];
    if (isInboxChat) {
      base = [...(inboxChat?.messages ?? [])]
        .map((message) => ({
          id: message.id,
          chatId: inboxChat?.conversation.id,
          senderId: message.senderUserId,
          content: message.text,
          isRead: true,
          createdAt: message.createdAt,
        }))
        .reverse()
        .filter(afterLocalClear);
    } else if (isJsonChat) {
      base = [...(jsonChat?.messages ?? [])]
        .map((message) => ({
          id: message.id,
          chatId: message.chatId,
          senderId: message.senderId ?? message.senderUserId ?? "system",
          content: message.text,
          isRead: true,
          createdAt: message.createdAt,
          system: message.system,
        }))
        .reverse()
        .filter(afterLocalClear);
    } else {
      base = [...(data?.messages ?? [])].reverse().filter(afterLocalClear);
    }
    return base;
  }, [data?.messages, inboxChat?.conversation.id, inboxChat?.messages, isInboxChat, isJsonChat, jsonChat?.messages, localClearedAt]);
  // ── Fold plan envelopes (spec 2.2) ─────────────────────────────────────────
  // Requests render as plan cards; responses are hidden from the list and flip
  // the matching card's status. Both travel as persisted chat messages, so
  // state survives restart and syncs to the other participant on refetch.
  const foldedMessages: Message[] = useMemo(() => {
    const statuses: Record<string, "accepted" | "declined"> = {};
    for (const m of messages) {
      const payload = parseChatPayload(m.content);
      if (payload.kind === "plan_response") statuses[payload.id] = payload.status;
    }
    const folded: Message[] = [];
    for (const m of messages) {
      const payload = parseChatPayload(m.content);
      if (payload.kind === "plan_response") continue; // hidden control message
      if (payload.kind === "plan_request") {
        folded.push({
          ...m,
          messageType: "plan_request",
          content: `Plan: ${payload.title}`,
          planData: {
            planId: payload.id,
            title: payload.title,
            time: payload.time ?? "",
            location: payload.location ?? "",
            status: statuses[payload.id] ?? "pending",
          },
        });
        continue;
      }
      if (payload.kind === "voice") {
        folded.push({
          ...m,
          messageType: "voice",
          voiceUrl: payload.url,
          voiceDurationSeconds: payload.durationSeconds,
        });
        continue;
      }
      if (payload.kind === "gif") {
        folded.push({
          ...m,
          messageType: "gif",
          gifUrl: payload.url,
        });
        continue;
      }
      if (payload.kind === "image") {
        folded.push({
          ...m,
          messageType: "image",
          imageUrl: payload.url,
        });
        continue;
      }
      folded.push(m);
    }
    return folded;
  }, [messages]);
  const hasRealMessages = useMemo(() => hasUserMessages(foldedMessages), [foldedMessages]);

  // Newest pending plan request — surfaced as a quiet contextual strip under
  // the header (spec 4.6, priority 1).
  const pendingPlan = useMemo(
    () =>
      foldedMessages.find(
        (m) =>
          m.messageType === "plan_request" &&
          (planStatuses[m.planData?.planId ?? m.id] ?? m.planData?.status ?? "pending") === "pending",
      ),
    [foldedMessages, planStatuses],
  );

  // Icebreakers — shown instead of blank screen on first open
  const { icebreakers, dismiss: dismissIcebreakers } = useIcebreakers(matchId, hasRealMessages);

  // Ping sound when a new inbound message arrives (not from us, not on first load)
  const prevMessageCountRef = useRef<number | null>(null);
  useEffect(() => {
    const count = messages.length;
    if (prevMessageCountRef.current === null) {
      prevMessageCountRef.current = count;
      return;
    }
    if (count > prevMessageCountRef.current) {
      // Find the newest message(s) that arrived
      const newest = messages[0]; // list is reversed: newest at index 0
      if (newest && newest.senderId !== currentUserId && !newest.system) {
        void playSound("message_ping");
      }
    }
    prevMessageCountRef.current = count;
  }, [messages, currentUserId]);

  const headerTitle = isInboxChat
    ? inboxChat?.conversation.peerName ?? "Chat"
    : isJsonChat
      ? jsonChat?.chat?.title ?? (isDoubleDateChat ? "Double Date" : "Chat")
      : "Chat";

  // Derive the other participant's userId for report/block
  const otherUserId = useMemo(() => {
    if (isInboxChat) return inboxChat?.conversation.peerId ?? "";
    const participants = jsonChat?.participants ?? [];
    const other = participants.find((p) => p.id !== currentUserId);
    return other?.id ?? "";
  }, [currentUserId, inboxChat?.conversation.peerId, isInboxChat, jsonChat?.participants]);

  const otherName = useMemo(() => {
    if (isInboxChat) return inboxChat?.conversation.peerName;
    const participants = jsonChat?.participants ?? [];
    const other = participants.find((p) => p.id !== currentUserId);
    return other?.name;
  }, [currentUserId, inboxChat?.conversation.peerName, isInboxChat, jsonChat?.participants]);
  const peerPhotoUrl = useMemo(() => {
    if (isInboxChat) return inboxChat?.conversation?.peerPhotoUrl;
    const participants = jsonChat?.participants ?? [];
    const other = participants.find((p) => p.id !== currentUserId);
    return (other as any)?.photoUrl as string | undefined;
  }, [isInboxChat, inboxChat?.conversation, jsonChat?.participants, currentUserId]);

  const openPeerProfile = useCallback(() => {
    if (otherUserId) {
      router.push({ pathname: "/user/[userId]" as any, params: { userId: otherUserId } });
    } else {
      Alert.alert("Profile unavailable", "This user's profile is no longer available.");
    }
  }, [otherUserId]);

  const presenceLabel = useMemo(() => {
    if (showTyping) return "typing...";
    if (!messages.length) return "online now";
    const lastOther = messages.find((message) => message.senderId !== currentUserId && !message.system);
    if (!lastOther) return "recently active";
    const minutes = Math.max(1, Math.round((Date.now() - new Date(lastOther.createdAt).getTime()) / 60000));
    return minutes < 60 ? `active ${minutes}m ago` : "recently active";
  }, [currentUserId, messages, showTyping]);
  const quickPromptTitle = isDoubleDateChat ? "Plan the double date" : "Plan together";
  const quickActions = isDoubleDateChat
    ? jsonChat?.quickActions ?? ["Drinks", "Dinner", "Event Tonight", "Pick a Spot"]
    : isFriendPlanChat || isFriendDirectChat
      ? jsonChat?.quickActions ?? ["AI opener", "Make a plan", "Pick a spot", "Invite more"]
      : [];
  const starter = useMemo(
    () =>
      buildFreshStarter({
        name: otherName ?? headerTitle,
        isDoubleDate: isDoubleDateChat,
        isPlan: isFriendPlanChat,
        quickActions,
      }),
    [headerTitle, isDoubleDateChat, isFriendPlanChat, otherName, quickActions],
  );
  const promptTriggers = useMemo(
    () =>
      buildPromptTriggers({
        name: otherName ?? headerTitle,
        isDoubleDate: isDoubleDateChat,
        isPlan: isFriendPlanChat,
        topic: quickActions.find((item) => !/ai opener|make a plan|invite more/i.test(item)) ?? "favorite Miami spot",
      }),
    [headerTitle, isDoubleDateChat, isFriendPlanChat, otherName, quickActions],
  );

  const sendContent = useCallback(async (content: string) => {
    if (!content.trim() || !matchId || !currentUserId) return;
    const trimmed = content.trim();
    const isFirst = isFirstMessageRef.current;
    try {
      if (isInboxChat) {
        setInboxSending(true);
        await sendInboxMessage({ conversationId: matchId, senderId: currentUserId, text: trimmed });
        await loadInboxChat();
      } else if (isJsonChat) {
        await sendJsonChatMessage(matchId, currentUserId, trimmed);
        await loadJsonChat();
      } else {
        await sendMutation.mutateAsync({ matchId, data: { content: trimmed } });
        refetch();
      }
      // Wake the peer's open chat screen (real-time signal bus).
      publishChatSignal(matchId, currentUserId);
      triggerMsgFeedback();
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setText("");
      setOfflineWarning(false);
      // Analytics funnel
      if (isFirst) {
        isFirstMessageRef.current = false;
        const { Analytics } = await import("@/lib/analytics");
        Analytics.firstMessageSent(matchId);
      }
      const { Analytics } = await import("@/lib/analytics");
      Analytics.messageSent(matchId, { chatType: isJsonChat ? "json" : isInboxChat ? "inbox" : "api", messageType: "text", isFirstMessage: isFirst });
    } catch {
      // Offline — enqueue
      await enqueueMessage({
        clientId: createOfflineClientId(),
        chatId: matchId,
        senderId: currentUserId,
        text: trimmed,
        queuedAt: new Date().toISOString(),
        messageType: "text",
      });
      setOfflineWarning(true);
      setText(trimmed);
    } finally {
      setInboxSending(false);
    }
  }, [currentUserId, isInboxChat, isJsonChat, loadInboxChat, loadJsonChat, matchId, refetch, sendMutation, triggerMsgFeedback]);

  // Voice note handler
  const handleVoiceNote = useCallback(async (url: string, durationSeconds: number) => {
    if (!matchId || !currentUserId) return;
    try {
      // Store as a special message type — requires backend support for voiceUrl field
      await sendContent(encodeVoiceMemoPayload(url, durationSeconds));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const { Analytics } = await import("@/lib/analytics");
      Analytics.messageSent(matchId, { messageType: "voice" });
    } catch {
      setOfflineWarning(true);
    }
  }, [currentUserId, matchId, sendContent]);

  // GIF send handler
  const handleGifSelect = useCallback(async (gif: GifItem) => {
    setShowGifPicker(false);
    if (!matchId || !currentUserId) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await sendContent(`[gif:${gif.url}]`);
      const { Analytics } = await import("@/lib/analytics");
      Analytics.messageSent(matchId, { messageType: "gif" });
    } catch {
      setOfflineWarning(true);
    }
  }, [currentUserId, matchId, sendContent]);

  // Image send handler
  const handleImageSend = useCallback(async () => {
    if (!matchId || !currentUserId) return;
    const result = await (await import("expo-image-picker")).launchImageLibraryAsync({
      mediaTypes: (await import("expo-image-picker")).MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const asset = result.assets[0];
    try {
      // Upload to Firebase Storage
      const { getStorage, ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
      const { getApp } = await import("firebase/app");
      const storage = getStorage(getApp());
      const storageRef = ref(storage, `chats/${matchId}/${Date.now()}.jpg`);
      const resp = await fetch(asset.uri);
      const blob = await resp.blob();
      await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
      const imageUrl = await getDownloadURL(storageRef);
      await sendContent(`[image:${imageUrl}]`);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const { Analytics } = await import("@/lib/analytics");
      Analytics.messageSent(matchId, { messageType: "image" });
    } catch {
      setOfflineWarning(true);
    }
  }, [currentUserId, matchId, sendContent]);

  // Drain offline queue on reconnect / mount
  useEffect(() => {
    if (!matchId || !currentUserId || !checkedPreferredChat) return;
    void drainQueue(matchId, async (msg) => {
      await sendInboxMessage({ conversationId: msg.chatId, senderId: msg.senderId, text: msg.text });
    }).then(() => {
      if (offlineWarning) {
        setOfflineWarning(false);
        if (isInboxChat) void loadInboxChat();
        // Queued messages just landed server-side — wake the peer.
        if (currentUserId) publishChatSignal(matchId, currentUserId);
      }
    });
  }, [checkedPreferredChat, matchId, currentUserId, offlineWarning, isInboxChat, loadInboxChat]);

  const handleSend = useCallback(async () => {
    await sendContent(text);
    void recordFirstMessage(); // milestone: first message sent
  }, [sendContent, text]);

  useEffect(() => {
    if (wave !== "1" || !matchId || waveSentRef.current === matchId) return;
    const ready = checkedPreferredChat || isInboxChat || isJsonChat;
    if (!ready) return;
    waveSentRef.current = matchId;
    void sendContent("👋");
  }, [checkedPreferredChat, isInboxChat, isJsonChat, matchId, sendContent, wave]);

  const handleUseStarter = useCallback((question: string) => {
    setText(question);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, []);

  const handleUsePromptTrigger = useCallback((message: string) => {
    setText(message);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    if (!matchId || !checkedPreferredChat) return;
    void markChatRead(matchId).catch(() => undefined);
  }, [checkedPreferredChat, matchId, messages.length]);

  useEffect(() => {
    if (!text.trim()) {
      setShowTyping(false);
      return;
    }
    setShowTyping(true);
    const timeout = setTimeout(() => setShowTyping(false), 1800);
    return () => clearTimeout(timeout);
  }, [text]);

  const handleReportMessage = useCallback((message: Message) => {
    Alert.alert("Report message?", "This sends the exact message to the moderation queue.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Report",
        style: "destructive",
        onPress: async () => {
          try {
            await reportMessage(message.id, "message_report", message.content);
            Alert.alert("Reported", "Thanks. Our team can review this message with chat context.");
          } catch {
            Alert.alert("Report unavailable", "Open the chat menu to report or block this person.");
          }
        },
      },
    ]);
  }, []);

  // ── Reanimated controls bottom sheet ────────────────────────────────────
  const controlSheetY = useSharedValue(800);
  const controlSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: controlSheetY.value }],
  }));
  const backdropOpacity = useSharedValue(0);
  const backdropAnimStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));
  const handleCloseControls = useCallback(() => {
    backdropOpacity.value = withTiming(0, { duration: 220 });
    controlSheetY.value = withTiming(800, { duration: 240 }, (finished) => {
      if (finished) runOnJS(setShowControls)(false);
    });
  }, [controlSheetY, backdropOpacity]);

  const handleChatControls = useCallback(() => {
    backdropOpacity.value = 0;
    controlSheetY.value = 800;
    setShowControls(true);
    requestAnimationFrame(() => {
      backdropOpacity.value = withTiming(1, { duration: 200 });
      controlSheetY.value = withSpring(0, { damping: 22, stiffness: 180 });
    });
  }, [controlSheetY, backdropOpacity]);

  const runChatAction = useCallback(async (action: "mute" | "archive" | "clear" | "unmatch" | "report") => {
    if (!matchId) return;
    handleCloseControls();
    if (action === "report") {
      setShowReport(true);
      return;
    }
    if (action === "mute") {
      await muteChat(matchId).then(() => Alert.alert("Muted", "You will not get alerts for this chat.")).catch(() => Alert.alert("Could not mute", "Please try again."));
      return;
    }
    if (action === "archive") {
      await archiveChat(matchId).then(() => Alert.alert("Archived", "This chat is archived for you.")).catch(() => Alert.alert("Could not archive", "Please try again."));
      return;
    }
    if (action === "clear") {
      const clearedAt = new Date().toISOString();
      setLocalClearedAt(clearedAt);
      await clearChat(matchId).catch(() => {
        setLocalClearedAt(null);
        Alert.alert("Could not clear", "Please try again.");
      });
      return;
    }
    await unmatchChat(matchId).then(() => router.back()).catch(() => Alert.alert("Could not unmatch", "Please try again."));
  }, [matchId, handleCloseControls]);

  const handleQuickAction = useCallback(
    async (prompt: string) => {
      if (!matchId || !isJsonChat || !currentUserId) return;
      if (/make a plan/i.test(prompt)) {
        setShowPlanSheet(true);
        return;
      }
      if (prompt.toLowerCase() === "pick a spot") {
        router.push("/(tabs)/events" as never);
        return;
      }
      await sendJsonChatMessage(matchId, currentUserId, prompt);
      await loadJsonChat();
      publishChatSignal(matchId, currentUserId);
    },
    [currentUserId, isJsonChat, loadJsonChat, matchId],
  );

  // Plan sheet hands back a draft (request-only mode) — send it into the
  // conversation as a persisted plan_request message (spec 2.1). No plan is
  // created until the other person accepts.
  const handlePlanDraft = useCallback((draft: PlanDraft) => {
    setShowPlanSheet(false);
    const requestId = createOfflineClientId();
    void sendContent(encodePlanRequest({
      id: requestId,
      title: draft.title,
      time: draft.timeLabel,
      location: draft.location,
    }));
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [sendContent]);

  // Recipient accepts: record the response in-thread (persisted + synced),
  // then confirm the plan via the existing plans backend so it appears in the
  // Plans area (spec 2.2).
  const handlePlanAccept = useCallback(async (msg: Message) => {
    const plan = msg.planData;
    if (!plan) return;
    const key = plan.planId ?? msg.id;
    setPlanStatuses((prev) => ({ ...prev, [key]: "accepted" }));
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await sendContent(encodePlanResponse({ id: key, status: "accepted" }));
    try {
      await createFriendPlan({
        creatorId: currentUserId,
        title: plan.title,
        type: "Custom",
        time: plan.time || undefined,
        timeLabel: plan.time || undefined,
        location: plan.location || undefined,
        invitedUserIds: otherUserId ? [otherUserId] : [],
      });
    } catch {
      // The acceptance is already recorded in-thread; plan backend hiccups
      // shouldn't block the conversation.
    }
  }, [currentUserId, otherUserId, sendContent]);

  // Recipient declines: persisted response flips the sender's card to
  // "Declined" in-thread (spec 2.2).
  const handlePlanDecline = useCallback(async (msg: Message) => {
    const plan = msg.planData;
    if (!plan) return;
    const key = plan.planId ?? msg.id;
    setPlanStatuses((prev) => ({ ...prev, [key]: "declined" }));
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await sendContent(encodePlanResponse({ id: key, status: "declined" }));
  }, [sendContent]);

  const renderItem = useCallback(
    ({ item }: { item: Message }) => {
      const isPlanMsg = item.messageType === "plan_request";
      const isOwn = item.senderId === user?.id || item.senderId === currentUserId;
      return (
        <MessageBubble
          message={item}
          isOwn={isOwn}
          colors={colors}
          onLongPress={(msg) => setPickerMessage(msg)}
          reaction={getReaction(item.id)}
          onReactionPress={() => setPickerMessage(item)}
          planStatus={isPlanMsg
            ? (planStatuses[item.planData?.planId ?? item.id] ?? item.planData?.status ?? "pending")
            : undefined}
          onAccept={isPlanMsg && !isOwn ? () => void handlePlanAccept(item) : undefined}
          onDecline={isPlanMsg && !isOwn ? () => void handlePlanDecline(item) : undefined}
        />
      );
    },
    [colors, currentUserId, getReaction, handlePlanAccept, handlePlanDecline, planStatuses, user?.id]
  );

  // Suppress unused warning — handleReportMessage used via long-press on bubbles
  void handleReportMessage;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      // "padding" on BOTH platforms — keyboard-controller's "height" behavior
      // on Android (edge-to-edge) leaves the composer under the keyboard/nav
      // bar (spec 1.3). Padding is the mode RNKC recommends everywhere.
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { paddingTop: topInset + 8, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={colors.foreground} />
        </Pressable>

        {/* Avatar — taps to full profile, no sheet/modal */}
        <Pressable
          style={styles.headerAvatarBtn}
          onPress={openPeerProfile}
          hitSlop={4}
        >
          {peerPhotoUrl ? (
            <Image source={{ uri: peerPhotoUrl }} style={styles.headerAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarFallback, { backgroundColor: colors.primary + "28" }]}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: colors.primary }}>
                {(headerTitle[0] ?? "?").toUpperCase()}
              </Text>
            </View>
          )}
          {(presenceLabel === "online now" || presenceLabel === "typing...") && (
            <View style={[styles.onlineDot, { backgroundColor: "#22C55E", borderColor: colors.background }]} />
          )}
        </Pressable>

        {/* Name + presence — also navigates to profile */}
        <Pressable
          style={styles.headerTitleWrap}
          onPress={openPeerProfile}
          hitSlop={4}
        >
          <Text style={[styles.headerName, { color: colors.foreground }]} numberOfLines={1}>
            {headerTitle}
          </Text>
          <Text
            style={[styles.presenceText, { color: showTyping ? colors.primary : colors.mutedForeground }]}
            numberOfLines={1}
          >
            {presenceLabel}
          </Text>
        </Pressable>

        {/* Plan button — labeled pill, not a mystery icon (design critique).
            Plan creation is the app's differentiator; it gets a name. */}
        <Pressable
          style={[styles.headerPlanBtn, { borderColor: colors.primary + "55", backgroundColor: colors.primary + "16" }]}
          hitSlop={6}
          accessibilityLabel="Make a plan"
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShowPlanSheet(true);
          }}
        >
          <Ionicons name="calendar" size={15} color={colors.primary} />
          <Text style={[styles.headerPlanText, { color: colors.primary }]}>Plan</Text>
        </Pressable>

        {/* Three-dot controls menu */}
        <Pressable onPress={handleChatControls} style={styles.headerActionBtn} hitSlop={6}>
          <Ionicons name="ellipsis-horizontal" size={22} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {/* Next-move nudge — shows when conversation has gone stale and user hasn't dismissed it */}
      {!nextMoveDismissed && hasRealMessages && (
        <NextMoveBanner
          lastMessage={messages[0]}
          currentUserId={currentUserId}
          otherName={otherName}
          onOpenMoments={() => {
            setNextMoveDismissed(true);
            router.push("/(tabs)/moments" as never);
          }}
          onMakePlan={() => {
            setNextMoveDismissed(true);
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShowPlanSheet(true);
            return;
            setNextMoveDismissed(true);
            void sendContent("Let's make a plan — what sounds good to you?");
          }}
          onBreakIce={() => {
            setNextMoveDismissed(true);
            void sendContent(starter.question);
          }}
          onDismiss={() => setNextMoveDismissed(true)}
          colors={colors}
        />
      )}

      {/* ── Contextual strip — pending plan prompt (spec 4.6) ──────────────── */}
      {!isMatchGone && pendingPlan?.planData ? (
        <View style={[styles.ctxStrip, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Ionicons name="calendar" size={14} color={colors.primary} />
          <Text style={[styles.ctxStripText, { color: colors.mutedForeground }]} numberOfLines={1}>
            {pendingPlan.senderId === currentUserId
              ? `Plan sent — waiting on ${otherName ?? "them"}: ${pendingPlan.planData.title}`
              : `${otherName ?? "They"} proposed “${pendingPlan.planData.title}” — respond below`}
          </Text>
        </View>
      ) : null}

      {/* ── Contextual banner — peer profile + presence strip (empty chats only) ─ */}
      {!isMatchGone && !hasRealMessages && (
        <ContextBanner
          photoUrl={peerPhotoUrl}
          name={headerTitle}
          presence={presenceLabel}
          onPress={openPeerProfile}
          colors={colors}
        />
      )}

      {/* ── Expired / deleted match — full-screen explainer ─────────────────── */}
      {isMatchGone ? (
        <View style={styles.expiredState}>
          <Text style={styles.expiredEmoji}>⏳</Text>
          <Text style={styles.expiredTitle}>This match has expired</Text>
          <Text style={styles.expiredBody}>
            Matches fade after 30 days without a connection.{"\n"}
            Keep the vibe alive — someone new is waiting.
          </Text>
          <Pressable
            style={styles.expiredCta}
            onPress={() => { router.replace("/(tabs)"); }}
          >
            <Text style={styles.expiredCtaText}>Discover more people</Text>
          </Pressable>
        </View>
      ) : (isInboxChat ? inboxLoading && messages.length === 0 : isJsonChat ? jsonLoading && messages.length === 0 : (isLoading || inboxLoading || jsonLoading) && messages.length === 0) ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <View style={styles.chatBody}>
          {/* Fresh-chat starters — rendered ABOVE the FlatList so they appear
              at the top of the screen, not buried at the bottom of an inverted list */}
          {!hasRealMessages ? (
            <View style={styles.chatStarterArea}>
              {isJsonChat && quickActions.length ? (
                <ChatQuickPrompts title={quickPromptTitle} prompts={quickActions} onSend={handleQuickAction} colors={colors} />
              ) : null}
              <FreshChatStarter fact={starter.fact} question={starter.question} onUse={handleUseStarter} />
              <ChatPromptTriggers triggers={promptTriggers} onUse={handleUsePromptTrigger} />
            </View>
          ) : null}
          <FlatList
            data={foldedMessages}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            inverted
            scrollEnabled={messages.length > 0}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.messagesList}
            refreshControl={
              <RefreshControl
                refreshing={isInboxChat ? inboxLoading : isJsonChat ? jsonLoading : isRefetching}
                onRefresh={isInboxChat ? loadInboxChat : isJsonChat ? loadJsonChat : refetch}
                tintColor={colors.primary}
              />
            }
            ListHeaderComponent={
              hasRealMessages ? (
                <View>
                  {isJsonChat && quickActions.length ? (
                    <ChatQuickPrompts title={quickPromptTitle} prompts={quickActions} onSend={handleQuickAction} colors={colors} />
                  ) : null}
                  <ChatPromptTriggers triggers={promptTriggers} onUse={handleUsePromptTrigger} />
                </View>
              ) : null
            }
            ListEmptyComponent={null}
          />
        </View>
      )}

      {/* Offline warning bar */}
      {offlineWarning && (
        <View style={[styles.offlineBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="cloud-offline-outline" size={15} color={colors.mutedForeground} />
          <Text style={[styles.offlineText, { color: colors.mutedForeground }]}>Message queued — will send when back online</Text>
        </View>
      )}

      {/* Typing indicator */}
      {showTyping && (
        <View style={styles.typingRow}>
          <TypingIndicator visible name={otherName ?? headerTitle} />
        </View>
      )}

      {/* Reaction picker */}
      {pickerMessage && (
        <MessageReactionPicker
          visible
          onReact={(emoji: ReactionEmoji) => {
            addReaction(pickerMessage.id, emoji);
            setPickerMessage(null);
          }}
          onReport={() => {
            handleReportMessage(pickerMessage);
            setPickerMessage(null);
          }}
          onClose={() => setPickerMessage(null)}
        />
      )}

      {/* Icebreaker bar — personalized 1-tap openers on first open */}
      <IcebreakerBar
        icebreakers={icebreakers}
        onSelect={(text) => {
          void sendContent(text);
          void recordFirstMessage();
        }}
        onDismiss={dismissIcebreakers}
      />

      {/* Fallback opener suggestions for no-vibe-data chats */}
      {!hasRealMessages && icebreakers.length === 0 && wave !== "1" && (
        <OpenerSuggestions
          visible
          myName={user?.firstName ?? user?.fullName ?? "Me"}
          theirName={otherName ?? headerTitle}
          onSelect={(opener) => { setText(opener); inputRef.current?.focus(); }}
        />
      )}

      {/* Attachment tray — shown when + button is tapped */}
      {showAttachTray && (
        <AttachmentTray
          onGif={handleGifFromTray}
          onPhoto={() => { handlePhotoFromTray(); handleImageSend(); }}
          onPlan={handlePlanFromTray}
          colors={colors}
        />
      )}

      {/* Input bar */}
      <View
        style={[
          styles.inputBar,
          {
            borderTopColor: colors.border,
            backgroundColor: colors.background,
            paddingBottom: Math.max(bottomInset, 8) + 6,
          },
        ]}
      >
        {/* + button: opens attachment tray (GIF / Photo / Plan) */}
        <Pressable
          onPress={toggleAttachTray}
          hitSlop={6}
          style={[
            styles.plusBtn,
            {
              backgroundColor: showAttachTray ? colors.primary : colors.card,
              borderColor: showAttachTray ? colors.primary : colors.border,
            },
          ]}
        >
          <Animated.View
            style={{
              transform: [
                {
                  rotate: plusAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0deg", "45deg"],
                  }),
                },
              ],
            }}
          >
            <Ionicons
              name="add"
              size={22}
              color={showAttachTray ? "#fff" : colors.mutedForeground}
            />
          </Animated.View>
        </Pressable>

        <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: colors.foreground }]}
            placeholder="Message..."
            placeholderTextColor={colors.mutedForeground}
            value={text}
            onChangeText={setText}
            multiline
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={handleSend}
            testID="message-input"
          />
        </View>

        <VoiceNoteRecorder
          chatId={matchId ?? ""}
          disabled={!matchId}
          onVoiceNote={handleVoiceNote}
        />

        <Animated.View style={sendBtnAnim}>
          <Pressable
            onPress={handleSend}
            disabled={!text.trim() || sendMutation.isPending || inboxSending}
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor: text.trim() ? colors.primary : colors.muted,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            testID="send-btn"
          >
            {(sendMutation.isPending || inboxSending) ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color={text.trim() ? "#fff" : colors.mutedForeground} />
            )}
          </Pressable>
        </Animated.View>
        <MsgBurst />
      </View>

      {/* GIF picker sheet */}
      <GifPicker
        visible={showGifPicker}
        onSelect={handleGifSelect}
        onClose={() => setShowGifPicker(false)}
      />

      {/* Report / block sheet */}
      <ReportBlockSheet
        visible={showReport}
        targetUserId={otherUserId}
        targetName={otherName}
        onClose={() => setShowReport(false)}
        onBlocked={() => router.back()}
      />

      {/* Chat controls bottom sheet — Reanimated spring slide + fade backdrop */}
      <Modal visible={showControls} transparent animationType="none" onRequestClose={handleCloseControls}>
        <ReAnimated.View style={[styles.controlBackdrop, backdropAnimStyle]} pointerEvents="box-none">
          {/* Pressable dismissal layer — sits behind the sheet */}
          <Pressable style={StyleSheet.absoluteFill} onPress={handleCloseControls} />
          <ReAnimated.View
            style={[styles.controlSheet, { backgroundColor: colors.card, borderColor: colors.border }, controlSheetStyle]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.controlHandle} />
            <Text style={[styles.controlTitle, { color: colors.foreground }]}>Chat controls</Text>
            <Text style={[styles.controlSub, { color: colors.mutedForeground }]}>
              Every action is saved to your account and can be recovered cleanly.
            </Text>
            {[
              { key: "mute", icon: "notifications-off" as const, label: "Mute chat", sub: "Pause alerts for this thread." },
              { key: "archive", icon: "archive" as const, label: "Archive chat", sub: "Move it out of your active list." },
              { key: "clear", icon: "trash" as const, label: "Clear conversation", sub: "Hide the current history for you.", danger: true },
              { key: "unmatch", icon: "heart-dislike" as const, label: "Unmatch", sub: "End the match and leave this chat.", danger: true },
              { key: "report", icon: "flag" as const, label: "Report or block", sub: "Send this to our moderation team." },
            ].map((item) => (
              <Pressable
                key={item.key}
                style={[styles.controlRow, { borderBottomColor: colors.border }]}
                onPress={() => runChatAction(item.key as Parameters<typeof runChatAction>[0])}
              >
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={(item as { danger?: boolean }).danger ? "#F87171" : colors.foreground}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.controlRowLabel, { color: (item as { danger?: boolean }).danger ? "#F87171" : colors.foreground }]}>
                    {item.label}
                  </Text>
                  <Text style={[styles.controlRowSub, { color: colors.mutedForeground }]}>{item.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
              </Pressable>
            ))}
          </ReAnimated.View>
        </ReAnimated.View>
      </Modal>
      {/* Create plan sheet — opens when calendar button is pressed */}
      {/* Request-only mode: the sheet returns a draft, we send it as a
          plan_request message — the plan is only created on accept (spec 2.1) */}
      <CreateFriendPlanSheet
        visible={showPlanSheet}
        userId={currentUserId}
        initialInviteIds={otherUserId ? [otherUserId] : undefined}
        onClose={() => setShowPlanSheet(false)}
        onDraft={handlePlanDraft}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  backBtn: { padding: 8 },
  headerAvatarBtn: { position: "relative", marginRight: 2 },
  headerAvatar: { width: 38, height: 38, borderRadius: 19 },
  headerAvatarFallback: { alignItems: "center", justifyContent: "center" },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
  },
  headerTitleWrap: { flex: 1, minWidth: 0 },
  headerName: { fontSize: 16, fontWeight: "700" },
  presenceText: { fontSize: 12, fontWeight: "500", marginTop: 1 },
  headerActionBtn: { padding: 11 },
  moreBtn: { padding: 8 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  messagesList: { paddingHorizontal: 16, paddingVertical: 16, gap: 8 },
  bubbleRow: { marginVertical: 2 },
  bubbleRowRight: { alignItems: "flex-end" },
  bubbleRowLeft: { alignItems: "flex-start" },
  bubble: { maxWidth: "78%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, gap: 3 },
  bubbleText: { fontSize: 15, fontWeight: "400", lineHeight: 20 },
  bubbleTime: { fontSize: 11, fontWeight: "400", alignSelf: "flex-end" },
  bubbleReadRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  bubbleReadText: { fontSize: 10, fontWeight: "500" },
  systemBubble: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "86%",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginVertical: 6,
  },
  systemText: { fontSize: 12, fontWeight: "600", textAlign: "center" },
  gifBubble: { maxWidth: "70%", borderRadius: 18, overflow: "hidden" },
  gifImage: { width: 220, height: 160 },
  imageBubble: { maxWidth: "70%", borderRadius: 18, overflow: "hidden" },
  imageBubbleOwn: {},
  imageBubbleOther: {},
  imageBubbleImg: { width: 220, height: 180 },
  promptWrap: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 12,
    marginBottom: 14,
  },
  promptTitle: { fontSize: 13, fontWeight: "700", marginBottom: 10 },
  promptRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  promptChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "rgba(255,45,168,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  promptText: { fontSize: 12, fontWeight: "700" },
  freshStarter: { marginBottom: 16, gap: 10 },
  freshBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,45,168,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,45,168,0.14)",
  },
  freshFact: { flex: 1, fontSize: 13, fontWeight: "500", color: "rgba(255,255,255,0.82)", lineHeight: 18 },
  askChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: "rgba(255,45,168,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,45,168,0.28)",
  },
  askChipText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  openerWrap: {
    marginBottom: 10,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  openerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  openerTitle: { fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: 0.8 },
  openerOpenTabBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  openerOpenTabText: { fontSize: 12, fontWeight: "700", color: "#FF2DA8" },
  openerRow: { flexDirection: "row", flexWrap: "wrap", padding: 10, gap: 8 },
  openerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255,45,168,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,45,168,0.20)",
  },
  openerChipText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  // + button (opens attachment tray)
  plusBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  // Attachment tray (GIF · Photo · Plan)
  attachTray: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
  },
  attachTrayItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 7,
  },
  attachTrayIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  attachTrayText: { flex: 1 },
  attachTrayLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  attachTraySub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  // Next-move banner
  nextMoveBanner: {
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  nextMoveDismiss: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 1,
  },
  nextMoveTop: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingRight: 24 },
  nextMoveEmoji: { fontSize: 24, lineHeight: 30 },
  nextMoveHeadline: { fontSize: 13, fontWeight: "800", lineHeight: 18 },
  nextMoveSub: { fontSize: 12, fontWeight: "500", lineHeight: 17, marginTop: 2 },
  nextMoveActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  nextMoveChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  nextMoveChipText: { fontSize: 12, fontWeight: "700" },
  // Offline / typing
  offlineBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 12,
    marginBottom: 6,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  offlineText: { fontSize: 12, fontWeight: "500", flex: 1 },
  typingRow: { paddingHorizontal: 20, paddingBottom: 4 },
  // Input bar
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  attachBtn: { padding: 6, marginBottom: 4 },
  inputWrapper: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
    maxHeight: 120,
  },
  input: { fontSize: 15, fontWeight: "400", lineHeight: 20 },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 1,
  },
  // Control sheet
  controlBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  controlSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 14,
    paddingBottom: 40,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    gap: 2,
  },
  controlHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignSelf: "center",
    marginBottom: 16,
  },
  controlTitle: { fontSize: 17, fontWeight: "800", marginBottom: 4 },
  controlSub: { fontSize: 13, fontWeight: "500", lineHeight: 18, marginBottom: 14 },
  controlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  controlRowLabel: { fontSize: 15, fontWeight: "700" },
  controlRowSub: { fontSize: 12, fontWeight: "500", marginTop: 2 },
  // ── Expired / deleted match empty state ─────────────────────────────────
  expiredState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  expiredEmoji: { fontSize: 52, lineHeight: 60, textAlign: "center" },
  expiredTitle: { fontSize: 22, fontWeight: "800", color: "#fff", textAlign: "center" },
  expiredBody: { fontSize: 15, fontWeight: "400", color: "#A1A1AA", textAlign: "center", lineHeight: 22 },
  expiredCta: {
    marginTop: 12,
    backgroundColor: "#FF2DA8",
    borderRadius: 26,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  expiredCtaText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  // ── Chat body layout ─────────────────────────────────────────────────────
  chatBody: { flex: 1 },
  chatStarterArea: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 12,
  },
  // ── Context banner (empty-chat peer preview) ─────────────────────────────
  ctxBanner: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  ctxBannerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  ctxAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  ctxAvatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  ctxInfo: { flex: 1, gap: 3 },
  ctxName: { fontSize: 17, fontWeight: "800" },
  ctxPresence: { fontSize: 13, fontWeight: "500" },
  ctxHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  ctxHintText: { fontSize: 13, fontWeight: "700" },
  // Compact pending-plan strip under the header (spec 4.6) — quiet, one line,
  // never tall enough to push messages off-screen.
  ctxStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  ctxStripText: { flex: 1, fontSize: 12, fontWeight: "600" },
  // Labeled plan pill in the chat header (design critique) — ≥44pt tall incl.
  // hitSlop, clearly a button, names the differentiator.
  headerPlanBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 2,
  },
  headerPlanText: { fontSize: 13, fontWeight: "700" },
  // ── Plan request card ────────────────────────────────────────────────────
  planCard: {
    maxWidth: "86%",
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    gap: 0,
  },
  planCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
  },
  planCardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  planCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
    marginBottom: 4,
  },
  planCardStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  planCardStatusText: { fontSize: 12, fontWeight: "600" },
  planCardMeta: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.06)",
    paddingTop: 10,
  },
  planCardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  planCardMetaText: { fontSize: 13, fontWeight: "500" },
  planCardActions: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  planCardDecline: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  planCardDeclineText: { fontSize: 14, fontWeight: "700" },
  planCardAccept: {
    flex: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  planCardAcceptText: { fontSize: 14, fontWeight: "800", color: "#fff" },
});
