import { Ionicons } from "@expo/vector-icons";
import { customFetch } from "@workspace/api-client-react";
import { useState, useSyncExternalStore } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";

import {
  buildDevPushSmokeRequest,
  getDevPushSmokeSnapshot,
  getMaskedExpoPushToken,
  isDevPushSmokeEnabled,
  subscribeDevPushSmoke,
  type DevPushSmokeKind,
} from "@/lib/devPushSmoke";

function statusLabel(status: ReturnType<typeof getDevPushSmokeSnapshot>["registrationStatus"]) {
  switch (status) {
    case "disabled":
      return "Disabled";
    case "unsupported":
      return "Unsupported on this runtime";
    case "permission-denied":
      return "Permission denied";
    case "missing-project-id":
      return "Missing project ID";
    case "token-received":
      return "Token received";
    case "registering":
      return "Registering with API";
    case "registered":
      return "Registered";
    case "failed":
      return "Registration failed";
    default:
      return "Waiting for registrar";
  }
}

export default function DevPushSmokePanel() {
  const snapshot = useSyncExternalStore(
    subscribeDevPushSmoke,
    getDevPushSmokeSnapshot,
    getDevPushSmokeSnapshot,
  );
  const [sendingKind, setSendingKind] = useState<DevPushSmokeKind | null>(null);

  if (!isDevPushSmokeEnabled()) return null;

  async function sendSmoke(kind: DevPushSmokeKind) {
    setSendingKind(kind);
    try {
      const response = await customFetch("/api/notify/test", buildDevPushSmokeRequest(kind));
      const label = kind === "match" ? "Match" : "Message";
      const result = response as { kind?: string } | undefined;
      Alert.alert(`${label} push sent`, `Expo accepted the smoke push. Kind: ${result?.kind ?? kind}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not send push smoke notification.";
      Alert.alert("Push smoke failed", message);
    } finally {
      setSendingKind(null);
    }
  }

  const maskedToken = getMaskedExpoPushToken(snapshot.token);

  return (
    <>
      <Text style={styles.sectionHeader}>Dev Push Smoke</Text>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.icon}>
            <Ionicons name="flask-outline" size={19} color="#38BDF8" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Push registration</Text>
            <Text style={styles.meta}>{statusLabel(snapshot.registrationStatus)}</Text>
          </View>
          <View style={[styles.badge, snapshot.registeredWithApi ? styles.goodBadge : styles.warnBadge]}>
            <Text style={[styles.badgeText, snapshot.registeredWithApi ? styles.goodText : styles.warnText]}>
              {snapshot.registeredWithApi ? "API: yes" : "API: no"}
            </Text>
          </View>
        </View>

        <View style={styles.stateBlock}>
          <Text style={styles.stateLabel}>Expo token</Text>
          <Text selectable style={styles.tokenText}>{maskedToken}</Text>
        </View>

        {snapshot.registeredAt ? (
          <Text style={styles.detailText}>Registered at {new Date(snapshot.registeredAt).toLocaleString()}</Text>
        ) : null}
        {snapshot.lastMessage ? <Text style={styles.detailText}>{snapshot.lastMessage}</Text> : null}
        {snapshot.lastError ? <Text style={styles.errorText}>{snapshot.lastError}</Text> : null}

        <View style={styles.buttonRow}>
          <SmokeButton
            icon="chatbubble-ellipses-outline"
            label="Message"
            loading={sendingKind === "message"}
            disabled={sendingKind !== null}
            onPress={() => sendSmoke("message")}
          />
          <SmokeButton
            icon="heart-circle-outline"
            label="Match"
            loading={sendingKind === "match"}
            disabled={sendingKind !== null}
            onPress={() => sendSmoke("match")}
          />
        </View>
      </View>
    </>
  );
}

function SmokeButton({
  icon,
  label,
  loading,
  disabled,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.button, disabled && styles.disabledButton]}>
      {loading ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name={icon} size={17} color="#FFF" />}
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    color: "#A1A1AA",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 8,
  },
  card: {
    marginHorizontal: 16,
    borderRadius: 22,
    backgroundColor: "#101820",
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.28)",
    padding: 16,
    gap: 12,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(56,189,248,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: "#FFF", fontSize: 15, fontFamily: "Inter_800ExtraBold" },
  meta: { color: "#A1A1AA", fontSize: 12, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  badge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 6 },
  goodBadge: { borderColor: "rgba(34,197,94,0.45)", backgroundColor: "rgba(34,197,94,0.13)" },
  warnBadge: { borderColor: "rgba(251,191,36,0.45)", backgroundColor: "rgba(251,191,36,0.12)" },
  badgeText: { fontSize: 11, fontFamily: "Inter_800ExtraBold" },
  goodText: { color: "#86EFAC" },
  warnText: { color: "#FDE68A" },
  stateBlock: { borderRadius: 16, backgroundColor: "rgba(0,0,0,0.24)", padding: 12, gap: 5 },
  stateLabel: { color: "#7DD3FC", fontSize: 11, fontFamily: "Inter_800ExtraBold", textTransform: "uppercase" },
  tokenText: { color: "#F4F4F5", fontSize: 12, lineHeight: 17, fontFamily: "Inter_600SemiBold" },
  detailText: { color: "#A1A1AA", fontSize: 12, lineHeight: 17, fontFamily: "Inter_600SemiBold" },
  errorText: { color: "#FDA4AF", fontSize: 12, lineHeight: 17, fontFamily: "Inter_700Bold" },
  buttonRow: { flexDirection: "row", gap: 10 },
  button: {
    flex: 1,
    height: 46,
    borderRadius: 16,
    backgroundColor: "#0284C7",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  disabledButton: { opacity: 0.55 },
  buttonText: { color: "#FFF", fontSize: 13, fontFamily: "Inter_800ExtraBold" },
});
