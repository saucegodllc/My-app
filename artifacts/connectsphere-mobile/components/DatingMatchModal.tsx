import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { DatingMatch } from "@/contexts/DatingMatchContext";

type Props = {
  match: DatingMatch | null;
  onClose: () => void;
};

export function DatingMatchModal({ match, onClose }: Props) {
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    if (match) {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          stiffness: 220,
          damping: 18,
          mass: 1,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          stiffness: 220,
          damping: 20,
          mass: 1,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scale.setValue(0.85);
      opacity.setValue(0);
      translateY.setValue(30);
    }
  }, [match, scale, opacity, translateY]);

  if (!match) return null;

  const photo = match.profile.photos[0];
  const handleMessageNow = () => {
    onClose();

    setTimeout(() => {
      if (match.source === "server" || match.serverMatchId) {
        router.push(`/chat/${match.serverMatchId ?? match.chatId}` as never);
      } else {
        router.push(`/chat/dating/${match.chatId}` as never);
      }
    }, 80);
  };
  const handleViewConnect = () => {
    onClose();
    setTimeout(() => {
      router.push("/(tabs)/matches" as never);
    }, 80);
  };

  return (
    <Modal
      visible={!!match}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <Animated.View
          style={[
            styles.card,
            { transform: [{ scale }, { translateY }] },
          ]}
        >

          <LinearGradient
            colors={["rgba(236,72,153,0.18)", "rgba(168,85,247,0.10)", "rgba(0,0,0,0)"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            pointerEvents="none"
          />

          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
            <Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" />
          </Pressable>

          <View style={styles.avatarWrap}>
            <LinearGradient
              colors={["#EC4899", "#A855F7"]}
              style={styles.avatarRing}
            >
              <View style={styles.avatarInner}>
                {photo ? (
                  <Image
                    source={{ uri: photo }}
                    style={styles.avatar}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Ionicons name="person" size={48} color="#fff" />
                  </View>
                )}
              </View>
            </LinearGradient>
          </View>

          <Text style={styles.title}>It's a Match</Text>

          <Text style={styles.subtitle}>
            You and {match.profile.name} both liked each other. This now lives in Connect.
          </Text>

          <Pressable onPress={handleMessageNow} style={styles.messageBtnWrap}>
            <LinearGradient
              colors={["#EC4899", "#D946EF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.messageBtn}
            >
              <Ionicons name="chatbubble-ellipses" size={16} color="#fff" />
              <Text style={styles.messageBtnText}>Message Now</Text>
            </LinearGradient>
          </Pressable>

          <Pressable onPress={onClose} style={styles.dismissBtn}>
            <Text style={styles.dismissBtnText}>Keep Discovering</Text>
          </Pressable>

          <Pressable onPress={handleViewConnect} style={styles.connectBtn}>
            <Text style={styles.connectBtnText}>View in Connect</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.82)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 36,
    backgroundColor: "#12000b",
    borderWidth: 1,
    borderColor: "rgba(236,72,153,0.4)",
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: "center",
    shadowColor: "#EC4899",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 40,
    elevation: 20,
    overflow: "hidden",
  },
  closeBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    zIndex: 2,
  },
  avatarWrap: { marginTop: 4 },
  avatarRing: {
    width: 116,
    height: 116,
    borderRadius: 58,
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInner: {
    width: "100%",
    height: "100%",
    borderRadius: 54,
    backgroundColor: "#000",
    overflow: "hidden",
    padding: 2,
  },
  avatar: {
    width: "100%",
    height: "100%",
    borderRadius: 52,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1f1029",
  },
  title: {
    marginTop: 18,
    fontSize: 32,
    fontFamily: "Sora_800ExtraBold",
    color: "#fff",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: "rgba(228,228,231,0.85)",
    textAlign: "center",
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  messageBtnWrap: {
    width: "100%",
    marginTop: 22,
    borderRadius: 999,
    overflow: "hidden",
  },
  messageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  messageBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.2,
  },
  dismissBtn: {
    width: "100%",
    marginTop: 10,
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  dismissBtnText: {
    color: "rgba(228,228,231,0.85)",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  connectBtn: {
    marginTop: 10,
    paddingVertical: 4,
  },
  connectBtnText: {
    color: "#F9A8D4",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
});

