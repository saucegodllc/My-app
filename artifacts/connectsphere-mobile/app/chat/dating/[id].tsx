import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  useDatingMatches,
  type DatingChatMessage,
} from "@/contexts/DatingMatchContext";

export default function DatingChatPlaceholderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { chats, matches, sendMessage, currentUserId } = useDatingMatches();
  const [draft, setDraft] = useState("");

  const chat = useMemo(() => chats.find((c) => c.id === id), [chats, id]);
  const match = useMemo(
    () => matches.find((m) => m.chatId === id),
    [matches, id],
  );

  if (!chat || !match) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingTitle}>Chat unavailable</Text>
        <Text style={styles.missingText}>
          This match isn't in your local session anymore.
        </Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const photo = match.profile.photos[0];
  const topInset = Platform.OS === "web" ? 16 : insets.top;
  const bottomInset = Platform.OS === "web" ? 16 : insets.bottom;

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;
    sendMessage(chat.id, text);
    setDraft("");
  };

  return (
    <View style={styles.root}>
      
      <View style={[styles.header, { paddingTop: topInset + 10 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>

        <View style={styles.headerCenter}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.headerAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarFallback]}>
              <Ionicons name="person" size={16} color="#fff" />
            </View>
          )}
          <View>
            <Text style={styles.headerName} numberOfLines={1}>
              {match.profile.name}
            </Text>
            <Text style={styles.headerSub}>It's a Vibe · just matched</Text>
          </View>
        </View>

        <View style={styles.headerBtn} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <FlatList
          data={chat.messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <Bubble message={item} currentUserId={currentUserId} />
          )}
          contentContainerStyle={[styles.list, { paddingBottom: 16 }]}
        />

        <View style={[styles.composer, { paddingBottom: bottomInset + 10 }]}>
          <View style={styles.inputWrap}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={`Message ${match.profile.name}`}
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={styles.input}
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
          </View>
          <Pressable onPress={handleSend} disabled={!draft.trim()} style={styles.sendBtn}>
            <LinearGradient
              colors={
                draft.trim()
                  ? ["#EC4899", "#D946EF"]
                  : ["rgba(255,255,255,0.10)", "rgba(255,255,255,0.06)"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sendBtnGrad}
            >
              <Ionicons name="send" size={16} color="#fff" />
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function Bubble({
  message,
  currentUserId,
}: {
  message: DatingChatMessage;
  currentUserId: string;
}) {
  const isSystem = message.senderId === "system";
  const isMine = message.senderId === currentUserId;

  if (isSystem) {
    return (
      <View style={styles.systemRow}>
        <View style={styles.systemBubble}>
          <Text style={styles.systemText}>{message.text}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleRow, isMine ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>
          {message.text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0a0a0a" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    gap: 8,
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  headerAvatar: { width: 36, height: 36, borderRadius: 18 },
  headerAvatarFallback: {
    backgroundColor: "#1f1029",
    alignItems: "center",
    justifyContent: "center",
  },
  headerName: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  headerSub: {
    color: "rgba(236,72,153,0.85)",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginTop: 1,
  },

  list: { padding: 16, gap: 8 },

  bubbleRow: { flexDirection: "row", marginBottom: 4 },
  bubbleRowLeft: { justifyContent: "flex-start" },
  bubbleRowRight: { justifyContent: "flex-end" },
  bubble: {
    maxWidth: "78%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleMine: {
    backgroundColor: "#EC4899",
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  bubbleText: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Inter_400Regular",
  },
  bubbleTextMine: { fontFamily: "Inter_500Medium" },

  systemRow: { alignItems: "center", marginVertical: 8 },
  systemBubble: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(236,72,153,0.10)",
    borderWidth: 1,
    borderColor: "rgba(236,72,153,0.30)",
  },
  systemText: {
    color: "rgba(251,207,232,0.95)",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },

  composer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    backgroundColor: "#0a0a0a",
  },
  inputWrap: {
    flex: 1,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    paddingHorizontal: 14,
  },
  input: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
  },
  sendBtn: { borderRadius: 22, overflow: "hidden" },
  sendBtnGrad: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  missing: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 10,
  },
  missingTitle: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" },
  missingText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  backBtn: {
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#EC4899",
  },
  backBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13 },
});
