import { useAuth, useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState, useEffect } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useGetMyProfile, useUpsertMyProfile } from "@workspace/api-client-react";
import type { ConnectionIntent } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";

const SUBTYPES_BY_INTENT: Record<string, string[]> = {
  dating: ["1-on-1", "Double Date", "Group Hang"],
  friendship: ["Casual Hangout", "Activity Partner", "Wing Person", "BFF Hunt"],
};

const INTENT_OPTIONS: {
  value: ConnectionIntent;
  label: string;
  description: string;
  icon: string;
  gradient: [string, string];
}[] = [
  {
    value: "dating",
    label: "Dating",
    description: "Meet people for romantic connections",
    icon: "heart",
    gradient: ["#FF299B", "#FF6B9B"],
  },
  {
    value: "friendship",
    label: "Friends",
    description: "Find activity partners and BFFs",
    icon: "people",
    gradient: ["#60A5FA", "#818CF8"],
  },
  {
    value: "all",
    label: "Open to All",
    description: "Dating and friends",
    icon: "sparkles",
    gradient: ["#F59E0B", "#EF4444"],
  },
];

function IntentLabel(intent: string): string {
  const opt = INTENT_OPTIONS.find((o) => o.value === intent);
  return opt?.label ?? (intent.charAt(0).toUpperCase() + intent.slice(1));
}

function SettingRow({
  icon,
  label,
  value,
  onPress,
  colors,
  dangerous,
  chevron,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  colors: ReturnType<typeof useColors>;
  dangerous?: boolean;
  chevron?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingRow,
        { borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Ionicons name={icon as any} size={20} color={dangerous ? colors.destructive : colors.foreground} style={{ width: 24 }} />
      <Text style={[styles.settingLabel, { color: dangerous ? colors.destructive : colors.foreground }]}>{label}</Text>
      {value && <Text style={[styles.settingValue, { color: colors.mutedForeground }]} numberOfLines={1}>{value}</Text>}
      {(chevron || (onPress && !value)) && <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} style={{ marginLeft: value ? 4 : "auto" }} />}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const { user } = useUser();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const { data: profile } = useGetMyProfile();
  const updateProfile = useUpsertMyProfile();

  const [bio, setBio] = useState(profile?.bio ?? "");
  const [notifications, setNotifications] = useState(true);
  const [selectedSubtype, setSelectedSubtype] = useState(profile?.connectionSubtype ?? "");
  const [showIntentPicker, setShowIntentPicker] = useState(false);
  const [savingIntent, setSavingIntent] = useState(false);

  useEffect(() => {
    setBio(profile?.bio ?? "");
    setSelectedSubtype(profile?.connectionSubtype ?? "");
  }, [profile?.connectionSubtype, profile?.bio]);

  const intent = profile?.intent ?? "";
  const subtypeOptions: string[] = SUBTYPES_BY_INTENT[intent] ?? [];

  function handleSubtypeSelect(subtype: string) {
    const next = selectedSubtype === subtype ? "" : subtype;
    setSelectedSubtype(next);
    if (profile?.displayName) {
      updateProfile.mutate({
        data: {
          displayName: profile.displayName,
          intent: profile.intent,
          connectionSubtype: next || undefined,
        },
      });
    }
  }

  async function handleIntentSelect(newIntent: ConnectionIntent) {
    if (!profile?.displayName) return;
    setSavingIntent(true);
    try {
      await updateProfile.mutateAsync({
        data: {
          displayName: profile.displayName,
          intent: newIntent,
          connectionSubtype: undefined,
        },
      });
      setSelectedSubtype("");
    } finally {
      setSavingIntent(false);
      setShowIntentPicker(false);
    }
  }

  function handleSignOut() {
    Alert.alert(t("settings.signOut"), t("settings.signOutConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("settings.signOut"),
        style: "destructive",
        onPress: () => signOut().then(() => router.replace("/(auth)/welcome")),
      },
    ]);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topInset + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("settings.title")}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>{t("settings.account")}</Text>
        <SettingRow icon="person-outline" label={t("auth.email").replace("Email", "Name")} value={user?.firstName ?? ""} colors={colors} />
        <SettingRow icon="mail-outline" label={t("auth.email")} value={user?.primaryEmailAddress?.emailAddress ?? ""} colors={colors} />

        <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>{t("profile.title")}</Text>
        <View style={[styles.bioSection, { borderBottomColor: colors.border }]}>
          <Text style={[styles.settingLabel, { color: colors.foreground, marginBottom: 8 }]}>{t("settings.bio")}</Text>
          <TextInput
            style={[styles.bioInput, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border }]}
            value={bio}
            onChangeText={setBio}
            onBlur={() => {
              if (profile?.displayName) {
                updateProfile.mutate({
                  data: {
                    displayName: profile.displayName,
                    intent: profile.intent,
                    bio,
                  },
                });
              }
            }}
            multiline
            placeholder={t("settings.bioPlaceholder")}
            placeholderTextColor={colors.mutedForeground}
            maxLength={300}
          />
        </View>

        <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>{t("tabs.discover")}</Text>
        <SettingRow
          icon="map-outline"
          label={t("profile.location")}
          value={profile?.location ?? "—"}
          colors={colors}
        />
        <SettingRow
          icon="globe-outline"
          label={t("profile.intent")}
          value={intent ? IntentLabel(intent) : "—"}
          onPress={() => setShowIntentPicker(true)}
          chevron
          colors={colors}
        />

        {subtypeOptions.length > 0 && (
          <View style={[styles.subtypeSection, { borderBottomColor: colors.border }]}>
            <Text style={[styles.settingLabel, { color: colors.foreground, marginBottom: 10 }]}>
              Connection Subtype
            </Text>
            <View style={styles.subtypeChips}>
              {subtypeOptions.map((opt) => {
                const isSelected = selectedSubtype === opt;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => handleSubtypeSelect(opt)}
                    style={({ pressed }) => [
                      styles.subtypeChip,
                      {
                        backgroundColor: isSelected ? colors.primary + "20" : colors.muted,
                        borderColor: isSelected ? colors.primary : colors.border,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={13} color={colors.primary} />
                    )}
                    <Text
                      style={[
                        styles.subtypeChipText,
                        { color: isSelected ? colors.primary : colors.foreground },
                      ]}
                    >
                      {opt}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>{t("settings.notifications")}</Text>
        <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
          <Ionicons name="notifications-outline" size={20} color={colors.foreground} style={{ width: 24 }} />
          <Text style={[styles.settingLabel, { color: colors.foreground }]}>{t("settings.notifications")}</Text>
          <Switch
            value={notifications}
            onValueChange={setNotifications}
            trackColor={{ false: colors.muted, true: colors.primary }}
            thumbColor="#fff"
            style={{ marginLeft: "auto" }}
          />
        </View>

        <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>{t("settings.premium")}</Text>
        <SettingRow
          icon="star-outline"
          label={t("settings.premium")}
          onPress={() => router.push("/premium" as any)}
          colors={colors}
        />

        <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>{t("settings.account")}</Text>
        <SettingRow
          icon="log-out-outline"
          label={t("settings.signOut")}
          onPress={handleSignOut}
          colors={colors}
          dangerous
        />
      </ScrollView>

      <Modal
        visible={showIntentPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowIntentPicker(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setShowIntentPicker(false)}
        />
        <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: bottomInset + 16 }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.sheetTitle, { color: colors.foreground }]}>What are you looking for?</Text>
          <Text style={[styles.sheetSubtitle, { color: colors.mutedForeground }]}>
            This changes how the app works for you
          </Text>

          <View style={styles.intentOptions}>
            {INTENT_OPTIONS.map((opt) => {
              const isActive = intent === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => handleIntentSelect(opt.value)}
                  disabled={savingIntent}
                  style={({ pressed }) => [
                    styles.intentCard,
                    {
                      borderColor: isActive ? opt.gradient[0] : colors.border,
                      backgroundColor: isActive ? opt.gradient[0] + "15" : colors.muted,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <LinearGradient
                    colors={opt.gradient}
                    style={styles.intentIcon}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name={opt.icon as any} size={22} color="#fff" />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.intentLabel, { color: isActive ? opt.gradient[0] : colors.foreground }]}>
                      {opt.label}
                    </Text>
                    <Text style={[styles.intentDesc, { color: colors.mutedForeground }]}>
                      {opt.description}
                    </Text>
                  </View>
                  {isActive && (
                    <Ionicons name="checkmark-circle" size={22} color={opt.gradient[0]} />
                  )}
                  {savingIntent && intent === opt.value && (
                    <View style={[styles.savingDot, { backgroundColor: opt.gradient[0] }]} />
                  )}
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => setShowIntentPicker(false)}
            style={[styles.cancelBtn, { borderColor: colors.border }]}
          >
            <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 4 },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 20, fontFamily: "Inter_600SemiBold" },
  sectionHeader: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase", paddingHorizontal: 16, paddingTop: 24, paddingBottom: 4 },
  settingRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  settingLabel: { fontSize: 16, fontFamily: "Inter_500Medium", flex: 1 },
  settingValue: { fontSize: 14, fontFamily: "Inter_400Regular", flexShrink: 1, maxWidth: "40%" },
  bioSection: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  bioInput: { borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20, minHeight: 80, textAlignVertical: "top" },
  subtypeSection: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  subtypeChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  subtypeChip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  subtypeChipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingHorizontal: 16 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center", marginBottom: 4 },
  sheetSubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", marginBottom: 20 },
  intentOptions: { gap: 10, marginBottom: 16 },
  intentCard: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 16, borderWidth: 1.5, padding: 14 },
  intentIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  intentLabel: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  intentDesc: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 16 },
  savingDot: { width: 8, height: 8, borderRadius: 4 },
  cancelBtn: { borderRadius: 12, borderWidth: 1, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  cancelText: { fontSize: 15, fontFamily: "Inter_500Medium" },
});
