import { useAuth, useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
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
import { useGetMessages, useSendMessage } from "@workspace/api-client-react";

type Message = {
  id: string;
  matchId: string;
  senderId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
};

function MessageBubble({ message, isOwn, colors }: { message: Message; isOwn: boolean; colors: ReturnType<typeof useColors> }) {
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

export default function ChatScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const { user } = useUser();
  const { isSignedIn } = useAuth();

  const [text, setText] = useState("");
  const { data, isLoading, refetch, isRefetching } = useGetMessages(matchId ?? "", { query: { enabled: !!matchId && !!isSignedIn } });
  const sendMutation = useSendMessage();

  const messages: Message[] = [...(data?.messages ?? [])].reverse();

  const handleSend = useCallback(async () => {
    if (!text.trim() || !matchId) return;
    const content = text.trim();
    setText("");
    try {
      await sendMutation.mutateAsync({ matchId, data: { content } });
      refetch();
    } catch {
      setText(content);
    }
  }, [text, matchId, sendMutation, refetch]);

  const renderItem = useCallback(
    ({ item }: { item: Message }) => (
      <MessageBubble
        message={item}
        isOwn={item.senderId === user?.id}
        colors={colors}
      />
    ),
    [user?.id, colors]
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
          Chat
        </Text>
      </View>

      {isLoading ? (
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
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
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
  inputBar: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  inputWrapper: { flex: 1, borderRadius: 24, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10, maxHeight: 120 },
  input: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 20 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: 1 },
  emptyState: { alignItems: "center", gap: 8, paddingTop: 60 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptySubtitle: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
