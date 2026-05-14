import { useAuth, useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { getJsonChat, sendJsonChatMessage, type ChatResponse } from "@/services/doubleDateApi";
import { useGetMessages, useSendMessage } from "@workspace/api-client-react";

type Message = {
  id: string;
  matchId?: string;
  chatId?: string;
  senderId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  system?: boolean;
};

function MessageBubble({ message, isOwn, colors }: { message: Message; isOwn: boolean; colors: ReturnType<typeof useColors> }) {
  if (message.system || message.senderId === "system") {
    return (
      <View style={styles.systemBubble}>
        <Ionicons name="sparkles" size={13} color={colors.primary} />
        <Text style={[styles.systemText, { color: colors.mutedForeground }]}>{message.content}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleRow, isOwn ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
      <View style={[
        styles.bubble,
        isOwn
          ? { backgroundColor: colors.primary }
          : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
      ]}>
        <Text style={[styles.bubbleText, { color: isOwn ? "#fff" : colors.foreground }]}>
          {message.content}
        </Text>
        <Text style={[styles.bubbleTime, { color: isOwn ? "rgba(255,255,255,0.6)" : colors.mutedForeground }]}>
          {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </View>
    </View>
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
  return (
    <View style={styles.promptWrap}>
      <Text style={[styles.promptTitle, { color: colors.foreground }]}>{title}</Text>
      <View style={styles.promptRow}>
        {prompts.map((prompt) => (
          <Pressable key={prompt} onPress={() => onSend(prompt)} style={[styles.promptChip, { borderColor: colors.border }]}>
            <Ionicons name="sparkles" size={12} color={colors.primary} />
            <Text style={[styles.promptText, { color: colors.foreground }]}>{prompt}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const { user } = useUser();
  const { isSignedIn } = useAuth();

  const [text, setText] = useState("");
  const [jsonChat, setJsonChat] = useState<ChatResponse | null>(null);
  const [jsonLoading, setJsonLoading] = useState(false);
  const isJsonChat = !!jsonChat?.chat;
  const isDoubleDateChat = jsonChat?.chat?.type === "double_date";
  const isFriendPlanChat = jsonChat?.chat?.type === "friend_plan" || jsonChat?.chat?.type === "plan";
  const { data, isLoading, refetch, isRefetching } = useGetMessages(matchId ?? "", undefined, {
    query: { enabled: !!matchId && !!isSignedIn && !isJsonChat },
  });
  const sendMutation = useSendMessage();

  const loadJsonChat = useCallback(async () => {
    if (!matchId) return;
    setJsonLoading(true);
    try {
      const result = await getJsonChat(matchId);
      setJsonChat(result.chat ? result : null);
    } catch {
      setJsonChat(null);
    } finally {
      setJsonLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    loadJsonChat();
  }, [loadJsonChat]);

  const messages: Message[] = useMemo(() => {
    if (isJsonChat) {
      return [...(jsonChat?.messages ?? [])]
        .map((message) => ({
          id: message.id,
          chatId: message.chatId,
          senderId: message.senderId ?? message.senderUserId ?? "system",
          content: message.text,
          isRead: true,
          createdAt: message.createdAt,
          system: message.system,
        }))
        .reverse();
    }
    return [...(data?.messages ?? [])].reverse();
  }, [data?.messages, isJsonChat, jsonChat?.messages]);

  const headerTitle = isJsonChat ? jsonChat?.chat?.title ?? (isDoubleDateChat ? "Double Date" : "Chat") : "Chat";
  const quickPromptTitle = isDoubleDateChat ? "Plan the double date" : "Plan together";
  const quickActions = isDoubleDateChat
    ? jsonChat?.quickActions ?? ["Drinks", "Dinner", "Event Tonight", "Pick a Spot"]
    : isFriendPlanChat
      ? ["Coffee", "Dinner", "Event Tonight", "Pick a Spot"]
      : [];
  const currentUserId = user?.id ?? "user_self";

  const handleSend = useCallback(async () => {
    if (!text.trim() || !matchId) return;
    const content = text.trim();
    setText("");
    try {
      if (isJsonChat) {
        await sendJsonChatMessage(matchId, currentUserId, content);
        await loadJsonChat();
      } else {
        await sendMutation.mutateAsync({ matchId, data: { content } });
        refetch();
      }
    } catch {
      setText(content);
    }
  }, [text, matchId, isJsonChat, currentUserId, loadJsonChat, sendMutation, refetch]);

  const handleQuickAction = useCallback(
    async (prompt: string) => {
      if (!matchId || !isJsonChat) return;
      if (prompt.toLowerCase() === "pick a spot") {
        router.push({ pathname: "/(tabs)/map", params: { pickSpot: "1", chatId: matchId } } as never);
        return;
      }
      await sendJsonChatMessage(matchId, currentUserId, prompt);
      await loadJsonChat();
    },
    [currentUserId, isJsonChat, loadJsonChat, matchId],
  );

  const renderItem = useCallback(
    ({ item }: { item: Message }) => (
      <MessageBubble
        message={item}
        isOwn={item.senderId === user?.id || item.senderId === currentUserId}
        colors={colors}
      />
    ),
    [colors, currentUserId, user?.id]
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { paddingTop: topInset + 8, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerName, { color: colors.foreground }]} numberOfLines={1}>
          {headerTitle}
        </Text>
      </View>

      {(isJsonChat ? jsonLoading && messages.length === 0 : isLoading) ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
              data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          inverted
          scrollEnabled={messages.length > 0}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.messagesList}
          refreshControl={
            <RefreshControl
              refreshing={isJsonChat ? jsonLoading : isRefetching}
              onRefresh={isJsonChat ? loadJsonChat : refetch}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            isJsonChat && quickActions.length ? (
              <ChatQuickPrompts title={quickPromptTitle} prompts={quickActions} onSend={handleQuickAction} colors={colors} />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, { color: colors.mutedForeground }]}>Say hello!</Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                Start the conversation
              </Text>
            </View>
          }
        />
      )}

      <View style={[styles.inputBar, { borderTopColor: colors.border, backgroundColor: colors.background, paddingBottom: bottomInset + 8 }]}>
        <View style={[styles.inputWrapper, { backgroundColor: colors.input, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            placeholder="Message..."
            placeholderTextColor={colors.mutedForeground}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={500}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={handleSend}
            testID="message-input"
          />
        </View>
        <Pressable
          onPress={handleSend}
          disabled={!text.trim() || sendMutation.isPending}
          style={({ pressed }) => [
            styles.sendBtn,
            { backgroundColor: text.trim() ? colors.primary : colors.muted, opacity: pressed ? 0.8 : 1 },
          ]}
          testID="send-btn"
        >
          {sendMutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={18} color={text.trim() ? "#fff" : colors.mutedForeground} />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  backBtn: { padding: 8 },
  headerName: { fontSize: 18, fontFamily: "Inter_600SemiBold", flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  messagesList: { paddingHorizontal: 16, paddingVertical: 16, gap: 8 },
  bubbleRow: { marginVertical: 2 },
  bubbleRowRight: { alignItems: "flex-end" },
  bubbleRowLeft: { alignItems: "flex-start" },
  bubble: { maxWidth: "78%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, gap: 3 },
  bubbleText: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 20 },
  bubbleTime: { fontSize: 11, fontFamily: "Inter_400Regular", alignSelf: "flex-end" },
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
  systemText: { fontSize: 12, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  promptWrap: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 12,
    marginBottom: 14,
  },
  promptTitle: { fontSize: 13, fontFamily: "Inter_700Bold", marginBottom: 10 },
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
  promptText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  inputBar: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  inputWrapper: { flex: 1, borderRadius: 24, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10, maxHeight: 120 },
  input: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 20 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: 1 },
  emptyState: { alignItems: "center", gap: 8, paddingTop: 60 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptySubtitle: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
