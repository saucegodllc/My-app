/**
 * AI Chat Bot Screen
 * Route: /chat/ai-bot?mode=dating|friends
 *
 * Spark ✨ (dating) and Vibe 🌊 (friends) AI companions.
 * - Streams tokens into a live bubble — no waiting for full reply
 * - Inverted FlatList for correct auto-scroll without manual scrollToEnd
 * - Conversation persisted to AsyncStorage per mode — survives navigation
 * - Copy button on every bot message
 * - Long-press header to clear history
 */
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
// Keyboard-controller KAV (provider is mounted in app/_layout) — RN's built-in
// KeyboardAvoidingView leaves the composer under the keyboard on Android with
// edge-to-edge enabled (spec 1.3).
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AI_BOT_NAMES,
  AI_BOT_SUBTITLES,
  AiChatError,
  DATING_STARTER_PROMPTS,
  FRIENDS_STARTER_PROMPTS,
  type AiChatMessage,
  type AiChatMode,
  clearConversation,
  loadConversation,
  makeAssistantMessage,
  makeUserMessage,
  saveConversation,
  sendAiChatMessageStreaming,
} from "@/lib/aiChat";

// ─── Action token parser ──────────────────────────────────────────────────────
// Spark can embed [GO:route:label] in its replies. We strip them from the
// displayed text and render them as tappable navigation chips below the bubble.

type ActionChip = { route: string; label: string };

const GO_TOKEN_RE = /\[GO:([^:[\]]+):([^\]]+)\]/g;

function parseActions(text: string): { display: string; chips: ActionChip[] } {
  const chips: ActionChip[] = [];
  const display = text.replace(GO_TOKEN_RE, (_, route: string, label: string) => {
    chips.push({ route: route.trim(), label: label.trim() });
    return "";
  }).trim();
  return { display, chips };
}

// ─── Theme (intentional hardcoded Miami neon — not useColors()) ──────────────
const PINK = "#FF2DA8";
const PURPLE = "#A855F7";
const BG = "#050008";
const CARD = "#0F0A1A";
const BORDER = "rgba(255,255,255,0.10)";
const TEXT = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.52)";

const AVATAR_DATING =
  "https://images.unsplash.com/photo-1620912189865-1e8a654f4d94?w=120&q=80";
const AVATAR_FRIENDS =
  "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=120&q=80";

// ─── isFresh guard — only animate bubbles created within last 3s ─────────────
function isFresh(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < 3000;
}

async function haptic(kind: "light" | "medium" | "success") {
  try {
    if (kind === "light") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (kind === "medium") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (kind === "success")
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {}
}

// ─── Typing dots ─────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <View style={styles.typingBubble}>
      <View style={styles.typingDots}>
        {[0, 1, 2].map((i) => (
          <Animated.View
            key={i}
            entering={FadeInDown.delay(i * 120).springify()}
            style={styles.typingDot}
          />
        ))}
      </View>
    </View>
  );
}

// ─── Chat bubble ─────────────────────────────────────────────────────────────
function ChatBubble({
  msg,
  botAvatar,
  isStreaming = false,
}: {
  msg: AiChatMessage;
  botAvatar: string;
  isStreaming?: boolean;
}) {
  const isUser = msg.role === "user";
  const fresh = isFresh(msg.createdAt);

  // Parse action chips from bot messages (never from user or while streaming)
  const { display, chips } = (!isUser && !isStreaming)
    ? parseActions(msg.content)
    : { display: msg.content, chips: [] };

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(display);
    void haptic("light");
  }, [display]);

  const handleChip = useCallback((route: string) => {
    void haptic("medium");
    if (route === "premium") {
      router.push("/premium" as never);
    } else {
      router.push(route as never);
    }
  }, []);

  return (
    <Animated.View
      entering={fresh ? FadeInUp.springify().damping(16).stiffness(130) : undefined}
      style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowBot]}
    >
      {!isUser && (
        <Image source={{ uri: botAvatar }} style={styles.botAvatar} contentFit="cover" />
      )}

      <View style={styles.bubbleWithActions}>
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
          {isUser && (
            <LinearGradient
              colors={[PINK, PURPLE]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          )}
          <Text
            style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextBot]}
          >
            {display}
            {isStreaming && <Text style={styles.cursor}>▌</Text>}
          </Text>
        </View>

        {/* Navigation action chips — rendered below bot bubble */}
        {chips.length > 0 && (
          <View style={styles.chipsRow}>
            {chips.map((chip) => (
              <Pressable
                key={chip.route}
                style={styles.actionChip}
                onPress={() => handleChip(chip.route)}
                accessibilityLabel={chip.label}
                accessibilityRole="button"
              >
                <LinearGradient
                  colors={[PINK, PURPLE]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.actionChipGrad}
                >
                  <Text style={styles.actionChipText}>{chip.label}</Text>
                </LinearGradient>
              </Pressable>
            ))}
          </View>
        )}

        {/* Copy button — only on completed bot messages */}
        {!isUser && !isStreaming && display.length > 0 && (
          <Pressable
            onPress={handleCopy}
            hitSlop={8}
            style={styles.copyBtn}
            accessibilityLabel="Copy message"
          >
            <Ionicons name="copy-outline" size={14} color={MUTED} />
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function AiBotScreen() {
  const insets = useSafeAreaInsets();
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>();
  const mode: AiChatMode = modeParam === "friends" ? "friends" : "dating";

  const botName = AI_BOT_NAMES[mode];
  const botSubtitle = AI_BOT_SUBTITLES[mode];
  const botAvatar = mode === "friends" ? AVATAR_FRIENDS : AVATAR_DATING;
  const starters = mode === "friends" ? FRIENDS_STARTER_PROMPTS : DATING_STARTER_PROMPTS;

  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [paywallHit, setPaywallHit] = useState(false);
  // Shows "waking up..." hint after 3s without a first token — Render cold start
  const [slowHint, setSlowHint] = useState(false);
  const slowHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  // Synchronous in-flight guard: the `loading` state guard alone can be passed
  // twice if two sends land before React re-renders (rapid double-tap).
  const inFlightRef = useRef(false);
  const inputRef = useRef<TextInput>(null);

  // ── Load persisted conversation on mount ──────────────────────────────────
  useEffect(() => {
    loadConversation(mode).then((saved) => {
      if (saved.length > 0) setMessages(saved);
      setHistoryLoaded(true);
    });
    return () => {
      abortRef.current?.abort();
    };
  }, [mode]);

  // ── Persist whenever messages change (after initial load) ─────────────────
  useEffect(() => {
    if (!historyLoaded) return;
    void saveConversation(mode, messages);
  }, [messages, mode, historyLoaded]);

  const showStarters = messages.length === 0;

  // ── Clear history ──────────────────────────────────────────────────────────
  const handleClearHistory = useCallback(() => {
    Alert.alert("Clear conversation?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          abortRef.current?.abort();
          inFlightRef.current = false;
          setMessages([]);
          setError(null);
          setLoading(false);
          setStreamingId(null);
          await clearConversation(mode);
          void haptic("medium");
        },
      },
    ]);
  }, [mode]);

  // ── Error copy per failure kind ────────────────────────────────────────────
  const errorCopy = useCallback(
    (e: unknown): string => {
      const name = mode === "dating" ? "Spark" : "Vibe";
      if (e instanceof AiChatError) {
        switch (e.kind) {
          case "rate_limited":
            return `${name} needs a breather — you've hit the hourly limit. Back soon. ✨`;
          case "unavailable":
            return `${name} is starting up — tap Retry in a few seconds. ☕`;
          case "timeout":
            return `${name} is waking up (cold server). Give it 5 seconds and tap Retry 🔄`;
          case "stream":
            return "That reply got cut off. Tap Retry to finish the thought.";
          case "network":
            return `${name} couldn't connect — check your internet and tap Retry.`;
        }
      }
      return `${name} couldn't connect. Tap Retry.`;
    },
    [mode],
  );

  // ── Stream a reply for a given history (used by send + retry) ─────────────
  const streamReply = useCallback(
    async (historySnapshot: AiChatMessage[]) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setError(null);
      setSlowHint(false);
      setLoading(true);

      // After 3s with no first token, show "waking up" hint so user isn't confused
      slowHintTimerRef.current = setTimeout(() => setSlowHint(true), 3000);

      // Insert empty placeholder that we'll fill token-by-token
      const botMsg = makeAssistantMessage("");
      setStreamingId(botMsg.id);
      setMessages((prev) => [...prev, botMsg]);

      abortRef.current = new AbortController();
      let received = ""; // tracked locally — state updates are async
      let firstToken = false;

      try {
        await sendAiChatMessageStreaming(
          mode,
          historySnapshot,
          (delta) => {
            if (!firstToken) {
              firstToken = true;
              // Kill the slow hint as soon as first token arrives
              if (slowHintTimerRef.current) clearTimeout(slowHintTimerRef.current);
              setSlowHint(false);
            }
            received += delta;
            setMessages((prev) =>
              prev.map((m) => (m.id === botMsg.id ? { ...m, content: m.content + delta } : m)),
            );
          },
          abortRef.current.signal,
        );
        void haptic("success");
      } catch (e) {
        const aborted = (e as Error)?.name === "AbortError";
        if (received.length === 0) {
          // Nothing arrived — drop the empty placeholder entirely.
          setMessages((prev) => prev.filter((m) => m.id !== botMsg.id));
        }
        if (!aborted) {
          if (e instanceof AiChatError && e.kind === "paywall") {
            setPaywallHit(true);
          } else {
            setError(errorCopy(e));
          }
        }
      } finally {
        if (slowHintTimerRef.current) clearTimeout(slowHintTimerRef.current);
        setSlowHint(false);
        inFlightRef.current = false;
        setLoading(false);
        setStreamingId(null);
      }
    },
    [errorCopy, mode],
  );

  // ── Send message (streaming) ──────────────────────────────────────────────
  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading || inFlightRef.current) return;

      setDraft("");
      const userMsg = makeUserMessage(trimmed);

      // Snapshot history before state update — this is what gets sent to the API
      const historySnapshot = [...messages, userMsg];
      setMessages(historySnapshot);
      void haptic("light");
      await streamReply(historySnapshot);
    },
    [loading, messages, streamReply],
  );

  const handleSend = useCallback(() => sendMessage(draft), [draft, sendMessage]);
  const handleStarter = useCallback((p: string) => sendMessage(p), [sendMessage]);

  // ── Retry: re-stream from the last user message WITHOUT duplicating it ────
  const handleRetry = useCallback(() => {
    if (inFlightRef.current) return;
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === "user") {
        lastUserIdx = i;
        break;
      }
    }
    if (lastUserIdx === -1) return;
    // Drop any partial/failed assistant messages after the last user message.
    const history = messages.slice(0, lastUserIdx + 1);
    setMessages(history);
    void streamReply(history);
  }, [messages, streamReply]);

  // ─── Inverted FlatList data ────────────────────────────────────────────────
  // Inverting both the list and the data means newest message renders at bottom.
  const reversedMessages = [...messages].reverse();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={
          mode === "dating"
            ? ["rgba(255,45,168,0.18)", "rgba(0,0,0,0)"]
            : ["rgba(168,85,247,0.18)", "rgba(0,0,0,0)"]
        }
        style={styles.headerGrad}
      />

      {/* Header — long press to clear */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={TEXT} />
        </Pressable>

        <Pressable
          onLongPress={handleClearHistory}
          style={styles.headerCenter}
          accessibilityLabel={`${botName} — long press to clear conversation`}
        >
          <View style={styles.headerAvatarWrap}>
            <Image
              source={{ uri: botAvatar }}
              style={styles.headerAvatar}
              contentFit="cover"
            />
            <View style={styles.headerOnline} />
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{botName}</Text>
            <Text style={styles.headerSub}>{botSubtitle}</Text>
          </View>
        </Pressable>

        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <FlatList
          data={reversedMessages}
          keyExtractor={(m) => m.id}
          inverted
          contentContainerStyle={[
            styles.listContent,
            { paddingTop: Math.max(insets.bottom, 12) + 8 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <ChatBubble
              msg={item}
              botAvatar={botAvatar}
              isStreaming={item.id === streamingId}
            />
          )}
          ListHeaderComponent={
            // On inverted list, ListHeader appears at BOTTOM = natural position for status
            loading && streamingId === null ? (
              <View style={[styles.bubbleRow, styles.bubbleRowBot]}>
                <Image source={{ uri: botAvatar }} style={styles.botAvatar} contentFit="cover" />
                <View style={{ gap: 4 }}>
                  <TypingDots />
                  {slowHint && (
                    <Animated.Text entering={FadeInDown.duration(300)} style={styles.slowHintText}>
                      waking up… just a sec ☕
                    </Animated.Text>
                  )}
                </View>
              </View>
            ) : error ? (
              <Animated.View entering={FadeInDown} style={styles.errorRow}>
                <Text style={styles.errorText}>{error}</Text>
                <Pressable onPress={handleRetry} style={styles.retryBtn}>
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
              </Animated.View>
            ) : null
          }
          ListFooterComponent={
            // On inverted list, ListFooter appears at TOP = starter prompt area
            showStarters ? (
              <Animated.View entering={FadeInDown.springify()} style={styles.starterWrap}>
                <View style={styles.starterAvatarWrap}>
                  <Image
                    source={{ uri: botAvatar }}
                    style={styles.starterAvatar}
                    contentFit="cover"
                  />
                  <LinearGradient
                    colors={mode === "dating" ? [PINK, PURPLE] : [PURPLE, "#3B82F6"]}
                    style={styles.starterAvatarRing}
                  />
                </View>
                <Text style={styles.starterName}>{botName}</Text>
                <Text style={styles.starterTagline}>
                  {mode === "dating"
                    ? "your new virtual bestie, what's good? Ask me anything 👋"
                    : "your new virtual bestie, what's good? Ask me anything 👋"}
                </Text>
                <View style={styles.starterChipsRow}>
                  {starters.map((prompt) => (
                    <Pressable
                      key={prompt}
                      style={styles.starterChip}
                      onPress={() => handleStarter(prompt)}
                    >
                      <Text style={styles.starterChipText}>{prompt}</Text>
                    </Pressable>
                  ))}
                </View>
              </Animated.View>
            ) : null
          }
        />

        {/* Paywall banner — shown instead of input bar when free limit is hit */}
        {paywallHit ? (
          <Animated.View
            entering={FadeInUp.springify().damping(18).stiffness(140)}
            style={[styles.paywallBar, { paddingBottom: Math.max(insets.bottom, 16) }]}
          >
            <Text style={styles.paywallEmoji}>⚡</Text>
            <Text style={styles.paywallTitle}>You've used all 5 free messages</Text>
            <Text style={styles.paywallSub}>
              Unlock unlimited {mode === "dating" ? "Spark" : "Vibe"} with ConnectSphere Plus
            </Text>
            <Pressable
              style={styles.paywallBtn}
              onPress={() => {
                void haptic("medium");
                router.push("/premium" as never);
              }}
              accessibilityLabel="Unlock ConnectSphere Plus"
              accessibilityRole="button"
            >
              <LinearGradient
                colors={[PINK, PURPLE]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.paywallBtnGrad}
              >
                <Text style={styles.paywallBtnText}>Unlock Plus ⚡</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        ) : (
          /* Input bar */
          <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder={mode === "dating" ? "Ask Spark anything…" : "Ask Vibe anything…"}
              placeholderTextColor={MUTED}
              value={draft}
              onChangeText={setDraft}
              multiline
              returnKeyType="send"
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
              submitBehavior="submit"
              maxLength={1000}
            />
            <Pressable
              onPress={handleSend}
              disabled={!draft.trim() || loading}
              style={[styles.sendBtn, (!draft.trim() || loading) && styles.sendBtnDisabled]}
            >
              {loading && streamingId === null ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <LinearGradient
                  colors={mode === "dating" ? [PINK, PURPLE] : [PURPLE, "#3B82F6"]}
                  style={styles.sendGrad}
                >
                  <Ionicons name="arrow-up" size={20} color="#fff" />
                </LinearGradient>
              )}
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  flex: { flex: 1 },
  headerGrad: { position: "absolute", top: 0, left: 0, right: 0, height: 140, zIndex: 0 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: "rgba(5,0,8,0.92)",
    zIndex: 10,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    justifyContent: "center",
  },
  headerAvatarWrap: { position: "relative" },
  headerAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: CARD },
  headerOnline: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#22C55E",
    borderWidth: 2,
    borderColor: BG,
  },
  headerInfo: { gap: 1 },
  headerName: { color: TEXT, fontSize: 15, fontWeight: "900" },
  headerSub: { color: MUTED, fontSize: 11, fontWeight: "500" },

  listContent: { paddingHorizontal: 16, gap: 10, flexGrow: 1 },

  starterWrap: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 8,
    gap: 12,
    paddingBottom: 16,
  },
  starterAvatarWrap: { position: "relative", marginBottom: 4 },
  starterAvatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: CARD },
  starterAvatarRing: {
    position: "absolute",
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 43,
    opacity: 0.5,
  },
  starterName: { color: TEXT, fontSize: 20, fontWeight: "900" },
  starterTagline: {
    color: MUTED,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 290,
  },
  starterChipsRow: { gap: 8, marginTop: 4, width: "100%" },
  starterChip: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(255,255,255,0.055)",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  starterChipText: { color: TEXT, fontSize: 13, fontWeight: "700" },

  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginBottom: 4,
  },
  bubbleRowUser: { justifyContent: "flex-end" },
  bubbleRowBot: { justifyContent: "flex-start" },
  botAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: CARD, flexShrink: 0 },
  bubbleWithActions: { maxWidth: "78%", gap: 4 },
  bubble: {
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 11,
    overflow: "hidden",
  },
  bubbleUser: { borderBottomRightRadius: 6 },
  bubbleBot: {
    backgroundColor: "rgba(255,255,255,0.09)",
    borderWidth: 1,
    borderColor: BORDER,
    borderBottomLeftRadius: 6,
  },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  bubbleTextUser: { color: "#FFF", fontWeight: "600" },
  bubbleTextBot: { color: "#F4F4F5", fontWeight: "500" },
  cursor: { color: PINK, opacity: 0.8 },

  copyBtn: { alignSelf: "flex-start", paddingLeft: 4, paddingVertical: 2 },
  slowHintText: { color: MUTED, fontSize: 11, fontWeight: "600", paddingLeft: 2 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  actionChip: { borderRadius: 20, overflow: "hidden" },
  actionChipGrad: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  actionChipText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  typingBubble: {
    backgroundColor: "rgba(255,255,255,0.09)",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    maxWidth: 78,
  },
  typingDots: { flexDirection: "row", gap: 5, alignItems: "center", justifyContent: "center" },
  typingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: MUTED },

  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: "rgba(239,68,68,0.12)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.25)",
    marginBottom: 8,
  },
  errorText: { color: "#FCA5A5", fontSize: 13, fontWeight: "600", flex: 1 },
  retryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "rgba(239,68,68,0.2)",
  },
  retryText: { color: "#FCA5A5", fontSize: 12, fontWeight: "800" },

  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    backgroundColor: "rgba(5,0,8,0.96)",
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(255,255,255,0.07)",
    color: TEXT,
    fontSize: 15,
    fontWeight: "600",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendGrad: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },

  paywallBar: {
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,45,168,0.3)",
    backgroundColor: "rgba(5,0,8,0.97)",
  },
  paywallEmoji: { fontSize: 28 },
  paywallTitle: { color: TEXT, fontSize: 15, fontWeight: "900", textAlign: "center" },
  paywallSub: {
    color: MUTED,
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 4,
  },
  paywallBtn: { width: "100%", borderRadius: 26, overflow: "hidden", marginTop: 4 },
  paywallBtnGrad: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 26,
  },
  paywallBtnText: { color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 0.3 },
});
