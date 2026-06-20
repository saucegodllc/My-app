import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
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

import { useColors } from "@/hooks/useColors";
import {
  useDatingMatches,
  type DatingChatMessage,
} from "@/contexts/DatingMatchContext";
import {
  FRESH_CHAT_DOUBLE_DATE_LABEL,
  buildFreshChatDoubleDateInvite,
  shouldShowFreshChatFallbackCtas,
} from "@/lib/retentionFeatures";
import { hasUserMessages } from "../chatFreshness";
import { MatchProfileSheet } from "@/components/MatchProfileSheet";

// ── Bubble ────────────────────────────────────────────────────────────────────

function MessageBubble({
  message,
  isOwn,
  colors,
}: {
  message: DatingChatMessage;
  isOwn: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  const isSystem = message.senderId === "system";
  const createdAt = (message as { createdAt?: string }).createdAt;
  const isFresh = createdAt
    ? Date.now() - new Date(createdAt).getTime() < 3000
    : false;

  if (isSystem) {
    return (
      <View style={styles.systemRow}>
        <View style={[styles.systemBubble, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Text style={[styles.systemText, { color: colors.mutedForeground }]}>{message.text}</Text>
        </View>
      </View>
    );
  }

  return (
    <ReAnimated.View
      entering={isFresh ? FadeInDown.springify().damping(26).stiffness(300) : undefined}
      style={[styles.bubbleRow, isOwn ? styles.bubbleRowRight : styles.bubbleRowLeft]}
    >
      <View
        style={[
          styles.bubble,
          isOwn
            ? [styles.bubbleMine, { backgroundColor: colors.primary }]
            : [styles.bubbleTheirs, { backgroundColor: colors.card, borderColor: colors.border }],
        ]}
      >
        <Text style={[styles.bubbleText, { color: isOwn ? "#fff" : colors.foreground }]}>
          {message.text}
        </Text>
      </View>
    </ReAnimated.View>
  );
}

// ── Suggestion card ───────────────────────────────────────────────────────────

function DatingChatSuggestions({
  fact,
  question,
  onUse,
  colors,
}: {
  name: string;
  fact: string;
  question: string;
  onUse: (text: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.suggestionsWrap, { borderColor: colors.primary + "55", backgroundColor: colors.primary + "0d" }]}>
      <Ionicons name="sparkles" size={18} color={colors.primary} />
      <Text style={[styles.suggestionsTitle, { color: colors.foreground }]}>{fact}</Text>
      <Pressable
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onUse(question);
        }}
        style={[styles.suggestionChip, { backgroundColor: colors.primary }]}
      >
        <Text style={styles.suggestionChipText}>🌟 Ask about this</Text>
      </Pressable>
    </View>
  );
}

function FreshChatFallbackCtas({
  doubleDateInvite,
  onUse,
  colors,
}: {
  doubleDateInvite: string;
  onUse: (message: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.fallbackCtaWrap}>
      <Pressable
        onPress={() => onUse(doubleDateInvite)}
        style={[styles.fallbackCtaButton, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <Text style={[styles.fallbackCtaText, { color: colors.foreground }]}>
          {FRESH_CHAT_DOUBLE_DATE_LABEL}
        </Text>
      </Pressable>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function DatingChatScreen() {
  const { id, openPlan } = useLocalSearchParams<{ id: string; openPlan?: string }>();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { chats, matches, sendMessage, currentUserId } = useDatingMatches();
  const [draft, setDraft] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const fillPlanComposer = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDraft("Let's make a plan - what sounds good to you?");
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  // "Make a Plan" from the match moment (?openPlan=1) — this local-chat screen
  // has no plan sheet, so honor it the way its own plan button does: prefill
  // the composer with a plan opener, once.
  const openPlanConsumedRef = useRef(false);
  useEffect(() => {
    const flag = Array.isArray(openPlan) ? openPlan[0] : openPlan;
    if (flag === "1" && !openPlanConsumedRef.current) {
      openPlanConsumedRef.current = true;
      setDraft("Let's make a plan — what sounds good to you?");
      setTimeout(() => inputRef.current?.focus(), 350);
    }
  }, [openPlan]);
  const topInset = Platform.OS === "web" ? 16 : insets.top;
  const bottomInset = Platform.OS === "web" ? 16 : insets.bottom;

  const chat = useMemo(() => chats.find((c) => c.id === id), [chats, id]);
  const match = useMemo(() => matches.find((m) => m.chatId === id), [matches, id]);

  // ── Reanimated controls sheet ─────────────────────────────────────────────
  const controlSheetY = useSharedValue(800);
  const controlSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: controlSheetY.value }],
  }));
  const backdropOpacity = useSharedValue(0);
  const backdropAnimStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  const handleCloseControls = useCallback(() => {
    backdropOpacity.value = withTiming(0, { duration: 220 });
    controlSheetY.value = withTiming(800, { duration: 240 }, (finished) => {
      if (finished) runOnJS(setShowControls)(false);
    });
  }, [controlSheetY, backdropOpacity]);

  const handleOpenControls = useCallback(() => {
    backdropOpacity.value = 0;
    controlSheetY.value = 800;
    setShowControls(true);
    requestAnimationFrame(() => {
      backdropOpacity.value = withTiming(1, { duration: 200 });
      controlSheetY.value = withSpring(0, { damping: 22, stiffness: 180 });
    });
  }, [controlSheetY, backdropOpacity]);

  // ── Send ──────────────────────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const text = draft.trim();
    if (!text || !chat) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendMessage(chat.id, text);
    setDraft("");
  }, [chat, draft, sendMessage]);

  const fillComposer = useCallback((message: string) => {
    setDraft(message);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  // ── Missing state ─────────────────────────────────────────────────────────
  if (!chat || !match) {
    return (
      <View style={[styles.missing, { backgroundColor: colors.background, paddingTop: topInset + 24, paddingBottom: bottomInset + 24 }]}>
        <View style={[styles.missingIcon, { backgroundColor: colors.primary + "22", borderColor: colors.primary + "44" }]}>
          <Ionicons name="chatbubble-ellipses" size={30} color={colors.primary} />
        </View>
        <Text style={[styles.missingTitle, { color: colors.foreground }]}>Chat unavailable</Text>
        <Text style={[styles.missingBody, { color: colors.mutedForeground }]}>
          This match may have expired or finished syncing. Jump back to your matches or keep discovering.
        </Text>
        <View style={styles.missingActions}>
          <Pressable
            onPress={() => router.replace("/(tabs)/matches" as never)}
            style={[styles.missingBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.missingBtnText}>Back to Matches</Text>
          </Pressable>
          <Pressable
            onPress={() => router.replace("/(tabs)" as never)}
            style={[styles.missingBtnSecondary, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Text style={[styles.missingBtnSecondaryText, { color: colors.foreground }]}>Keep Discovering</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const photo = match.profile.photos[0];
  const name = match.profile.name;
  const firstName = name.split(" ")[0] ?? name;

  const profileTopic =
    match.profile.promptAnswer ??
    match.profile.prompt ??
    match.profile.firstDateStyle ??
    match.profile.dateIdeas?.[0] ??
    "their ideal first date";

  const starterQuestion = profileTopic.toLowerCase().includes("bodega")
    ? `No way, what do you usually order at Bodega?`
    : `No way, tell me more about ${profileTopic.toLowerCase()}?`;

  const isFreshChat = !hasUserMessages(chat.messages);
  const primaryOpener = match.profile.openerIdeas?.[0]?.trim();
  const showFallbackCtas = shouldShowFreshChatFallbackCtas(isFreshChat, primaryOpener);
  const doubleDateInvite = buildFreshChatDoubleDateInvite(name, profileTopic);

  const renderItem = useCallback(
    ({ item }: { item: DatingChatMessage }) => (
      <MessageBubble
        message={item}
        isOwn={item.senderId === currentUserId}
        colors={colors}
      />
    ),
    [colors, currentUserId],
  );

  return (
    <KeyboardAvoidingView
      testID="dating-chat-thread"
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: topInset + 8, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={colors.foreground} />
        </Pressable>

        {/* Avatar */}
        <Pressable
          style={styles.headerAvatarBtn}
          onPress={() => setShowProfile(true)}
          hitSlop={4}
        >
          {photo ? (
            <Image source={{ uri: photo }} style={styles.headerAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarFallback, { backgroundColor: colors.primary + "28" }]}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: colors.primary }}>
                {(firstName[0] ?? "?").toUpperCase()}
              </Text>
            </View>
          )}
          {/* Online dot — always active for local dating matches */}
          <View style={[styles.onlineDot, { backgroundColor: "#22C55E", borderColor: colors.background }]} />
        </Pressable>

        {/* Name + presence */}
        <Pressable style={styles.headerTitleWrap} onPress={() => setShowProfile(true)} hitSlop={4}>
          <Text style={[styles.headerName, { color: colors.foreground }]} numberOfLines={1}>{name}</Text>
          <Text style={[styles.presenceText, { color: colors.primary }]} numberOfLines={1}>online now</Text>
        </Pressable>

        {/* Plan — long press to avoid accidental sends */}
        <Pressable
          testID="dating-chat-plan-button"
          style={styles.headerActionBtn}
          hitSlop={6}
          onPress={fillPlanComposer}
          onLongPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            fillComposer(`Let's make a plan — what sounds good to you?`);
          }}
          delayLongPress={400}
        >
          <Ionicons name="calendar-outline" size={22} color={colors.primary} />
        </Pressable>

        {/* Controls */}
        <Pressable onPress={handleOpenControls} style={styles.headerActionBtn} hitSlop={6}>
          <Ionicons name="warning-outline" size={22} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {/* ── Messages ───────────────────────────────────────────────────────── */}
      <FlatList
        data={[...chat.messages].reverse()}
        keyExtractor={(m) => m.id}
        renderItem={renderItem}
        inverted
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.messagesList, { paddingBottom: bottomInset + 8 }]}
        ListHeaderComponent={
          isFreshChat ? (
            <View>
              <DatingChatSuggestions
                name={firstName}
                fact={`${firstName}'s profile says ${profileTopic}.`}
                question={starterQuestion}
                onUse={fillComposer}
                colors={colors}
              />
              {showFallbackCtas ? (
                <FreshChatFallbackCtas
                  doubleDateInvite={doubleDateInvite}
                  onUse={fillComposer}
                  colors={colors}
                />
              ) : null}
            </View>
          ) : null
        }
      />

      {/* ── Composer ───────────────────────────────────────────────────────── */}
      <View style={[styles.composer, { paddingBottom: bottomInset + 8, borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            testID="dating-chat-message-input"
            ref={inputRef}
            value={draft}
            onChangeText={setDraft}
            placeholder={`Message ${firstName}…`}
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground }]}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            multiline
          />
        </View>
        <Pressable
          onPress={handleSend}
          disabled={!draft.trim()}
          style={[
            styles.sendBtn,
            { backgroundColor: draft.trim() ? colors.primary : colors.card },
          ]}
        >
          <Ionicons name="send" size={16} color={draft.trim() ? "#fff" : colors.mutedForeground} />
        </Pressable>
      </View>

      {/* ── Profile sheet ──────────────────────────────────────────────────── */}
      <MatchProfileSheet
        visible={showProfile}
        profile={match.profile}
        onClose={() => setShowProfile(false)}
      />

      {/* ── Controls bottom sheet ──────────────────────────────────────────── */}
      {showControls && (
        <ReAnimated.View
          style={[StyleSheet.absoluteFill, styles.controlBackdrop, backdropAnimStyle]}
          pointerEvents="box-none"
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={handleCloseControls} />
          <ReAnimated.View
            style={[styles.controlSheet, { backgroundColor: colors.card, borderColor: colors.border }, controlSheetStyle]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.controlHandle} />
            <Text style={[styles.controlTitle, { color: colors.foreground }]}>Chat controls</Text>
            <Text style={[styles.controlSub, { color: colors.mutedForeground }]}>
              Manage this match from here.
            </Text>
            {[
              { key: "report", icon: "flag" as const, label: "Report or block", sub: "Send this to our moderation team.", danger: false },
              { key: "unmatch", icon: "heart-dislike" as const, label: "Unmatch", sub: "End the match and leave this chat.", danger: true },
            ].map((item) => (
              <Pressable
                key={item.key}
                style={[styles.controlRow, { borderBottomColor: colors.border }]}
                onPress={() => {
                  handleCloseControls();
                  // Unmatch navigates back after close animation
                  if (item.key === "unmatch") {
                    setTimeout(() => router.replace("/(tabs)/matches" as never), 280);
                  }
                }}
              >
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={item.danger ? "#F87171" : colors.foreground}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.controlRowLabel, { color: item.danger ? "#F87171" : colors.foreground }]}>
                    {item.label}
                  </Text>
                  <Text style={[styles.controlRowSub, { color: colors.mutedForeground }]}>{item.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
              </Pressable>
            ))}
          </ReAnimated.View>
        </ReAnimated.View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
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
  headerTitleWrap: { flex: 1 },
  headerName: { fontSize: 15, fontWeight: "700", letterSpacing: -0.2 },
  presenceText: { fontSize: 11, fontWeight: "500", marginTop: 1 },
  headerActionBtn: { padding: 11 },

  // Messages
  messagesList: { paddingHorizontal: 12, paddingTop: 12, gap: 4 },
  bubbleRow: { flexDirection: "row", marginBottom: 3 },
  bubbleRowLeft: { justifyContent: "flex-start" },
  bubbleRowRight: { justifyContent: "flex-end" },
  bubble: {
    maxWidth: "78%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleMine: { borderBottomRightRadius: 5 },
  bubbleTheirs: { borderBottomLeftRadius: 5, borderWidth: StyleSheet.hairlineWidth },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  systemRow: { alignItems: "center", marginVertical: 8 },
  systemBubble: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  systemText: { fontSize: 12, textAlign: "center" },

  // Suggestions
  suggestionsWrap: {
    borderRadius: 20,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 20,
    marginBottom: 14,
    alignItems: "center",
    gap: 12,
  },
  suggestionsTitle: { fontSize: 15, lineHeight: 21, fontWeight: "700", textAlign: "center" },
  suggestionChip: {
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  suggestionChipText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  fallbackCtaWrap: { marginBottom: 14 },
  fallbackCtaButton: {
    minHeight: 44,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  fallbackCtaText: { fontSize: 13, fontWeight: "700", textAlign: "center" },

  // Composer
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputWrap: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
    maxHeight: 110,
  },
  input: { fontSize: 15, lineHeight: 20 },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  // Controls sheet
  controlBackdrop: {
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
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(128,128,128,0.35)",
    marginBottom: 14,
  },
  controlTitle: { fontSize: 17, fontWeight: "700", marginBottom: 4 },
  controlSub: { fontSize: 13, marginBottom: 12 },
  controlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  controlRowLabel: { fontSize: 15, fontWeight: "600" },
  controlRowSub: { fontSize: 12, marginTop: 2 },

  // Missing state
  missing: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 10,
  },
  missingIcon: {
    width: 74,
    height: 74,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 8,
  },
  missingTitle: { fontSize: 22, fontWeight: "800", textAlign: "center" },
  missingBody: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  missingActions: { width: "100%", gap: 10, marginTop: 14 },
  missingBtn: {
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 16,
    alignItems: "center",
  },
  missingBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  missingBtnSecondary: {
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
  },
  missingBtnSecondaryText: { fontWeight: "700", fontSize: 13 },
});
