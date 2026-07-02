import { useAuth, useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
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

import { customFetch, useGetMyProfile, useUpsertMyProfile, type ConnectionIntent } from "@workspace/api-client-react";
import DiscoveryFiltersSheet from "@/components/DiscoveryFilters";
import DevPushSmokePanel from "@/components/DevPushSmokePanel";
import { useTranslation } from "react-i18next";
import { setAnalyticsConsent } from "@/lib/analytics";
import { openPremium } from "@/lib/routes";
import { isSentrySmokeEnabled, sendSentrySmokeTest } from "@/lib/sentry";

type DisplayIntent = "dating" | "friendship" | "all";
type ModeData = Record<string, unknown>;

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const USERNAME_CHECK_TIMEOUT_MS = 6_000;
const DATING_GOALS = ["Hookup", "Long Term", "Curious", "Having Fun"];
const FRIEND_GOALS = ["Casual Hangout", "Activity Partner", "Wing Person", "BFF Hunt"];
const LEGAL_LINKS = {
  privacy: { route: "/legal/privacy", meta: "In-app privacy policy" },
  terms: { route: "/legal/terms", meta: "In-app terms of service" },
  guidelines: { url: "https://connectsphere.app/legal/community-guidelines" },
  safety: { url: "https://connectsphere.app/safety" },
  support: { url: "mailto:support@connectsphere.app" },
} as const;
type LegalLink = (typeof LEGAL_LINKS)[keyof typeof LEGAL_LINKS];
const LEGAL_SUPPORT_LINKS: ReadonlyArray<{
  label: string;
  link: LegalLink;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { label: "Privacy Policy", link: LEGAL_LINKS.privacy, icon: "shield-checkmark-outline" },
  { label: "Terms of Service", link: LEGAL_LINKS.terms, icon: "document-text-outline" },
  { label: "Community Guidelines", link: LEGAL_LINKS.guidelines, icon: "people-circle-outline" },
  { label: "Safety Center", link: LEGAL_LINKS.safety, icon: "medical-outline" },
  { label: "Contact Support", link: LEGAL_LINKS.support, icon: "mail-outline" },
];
const LOCATION_PRECISION_KEY = "connectsphere.privacy.locationPrecision";
const NOTIFICATION_CONSENT_KEY = "connectsphere.notifications.consent";

const COUNTIES = [
  {
    name: "Miami-Dade",
    cities: [
      "Miami",
      "Miami Beach",
      "Brickell",
      "Wynwood",
      "Coral Gables",
      "Doral",
      "Aventura",
      "Kendall",
      "Homestead",
    ],
  },
  {
    name: "Broward",
    cities: [
      "Fort Lauderdale",
      "Hollywood",
      "Pembroke Pines",
      "Miramar",
      "Pompano Beach",
      "Davie",
      "Plantation",
      "Las Olas",
      "Deerfield Beach",
    ],
  },
];

const INTENT_OPTIONS: {
  value: DisplayIntent;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  gradient: [string, string];
}[] = [
  {
    value: "dating",
    label: "Dating",
    description: "Show Dating in Discover and match by romantic intent.",
    icon: "flame",
    gradient: ["#FF007F", "#FF4FB0"],
  },
  {
    value: "friendship",
    label: "Friends",
    description: "Show Friends in Discover and match by friend intent.",
    icon: "people",
    gradient: ["#38BDF8", "#818CF8"],
  },
  {
    value: "all",
    label: "Both",
    description: "Show both Dating and Friends with separate intentions.",
    icon: "sparkles",
    gradient: ["#FF007F", "#8B5CF6"],
  },
];

function normalizeUsername(value?: string | null) {
  return (value ?? "").trim().toLowerCase().replace(/^@+/, "");
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function makeTimeoutError() {
  const error = new Error("Timed out");
  error.name = "AbortError";
  return error;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(makeTimeoutError()), ms);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function normalizeIntent(value?: string): DisplayIntent {
  if (value === "dating") return "dating";
  if (value === "friendship" || value === "networking") return "friendship";
  return "all";
}

function modeDataOf(profile?: unknown) {
  const candidate = profile as { modeData?: ModeData } | undefined;
  return (candidate?.modeData ?? {}) as ModeData;
}

function stringFromMode(modeData: ModeData, key: string) {
  return typeof modeData[key] === "string" ? (modeData[key] as string) : "";
}

function friendGoalFromMode(modeData: ModeData) {
  const value = modeData.friendshipTypes;
  return Array.isArray(value) && typeof value[0] === "string" ? value[0] : "";
}

function countyForCity(city?: string) {
  if (!city) return "Miami-Dade";
  return COUNTIES.find((county) => county.cities.includes(city))?.name ?? "Miami-Dade";
}

function UsernameStatus({
  checking,
  available,
  error,
}: {
  checking: boolean;
  available: boolean | null;
  error: string | null;
}) {
  if (checking) {
    return (
      <View style={styles.usernameStatus}>
        <ActivityIndicator size="small" color="#FF007F" />
        <Text style={styles.usernameStatusText}>Checking username...</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.usernameStatus}>
        <Ionicons name="alert-circle" size={14} color="#FB7185" />
        <Text style={[styles.usernameStatusText, { color: "#FB7185" }]}>{error}</Text>
      </View>
    );
  }
  if (available === true) {
    return (
      <View style={styles.usernameStatus}>
        <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
        <Text style={[styles.usernameStatusText, { color: "#22C55E" }]}>Available</Text>
      </View>
    );
  }
  return null;
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const { user } = useUser();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const { data: profile, refetch } = useGetMyProfile();
  const updateProfile = useUpsertMyProfile();
  const profileExtras = profile as (NonNullable<typeof profile> & { username?: string; modeData?: ModeData }) | undefined;

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [county, setCounty] = useState("Miami-Dade");
  const [intent, setIntent] = useState<DisplayIntent>("all");
  const [datingGoal, setDatingGoal] = useState("Hookup");
  const [friendGoal, setFriendGoal] = useState("Casual Hangout");
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showIntentPicker, setShowIntentPicker] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [analyticsOn, setAnalyticsOn] = useState(false);
  const [preciseLocationOn, setPreciseLocationOn] = useState(false);
  const [notificationsOn, setNotificationsOn] = useState(false);
  const [exportSubmitting, setExportSubmitting] = useState(false);
  const [deletionSubmitting, setDeletionSubmitting] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [showDiscoveryFilters, setShowDiscoveryFilters] = useState(false);
  const [sentrySmokeSending, setSentrySmokeSending] = useState(false);

  const originalUsername = normalizeUsername(profileExtras?.username);
  const currentModeData = useMemo(() => modeDataOf(profileExtras), [profileExtras]);

  useEffect(() => {
    if (!profile) return;
    const nextProfile = profile as (NonNullable<typeof profile> & { username?: string; modeData?: ModeData }) | undefined;
    const nextModeData = modeDataOf(nextProfile);
    const nextIntent = normalizeIntent(profile.intent);
    const nextLocation = profile.location ?? "";
    setDisplayName(profile.displayName ?? "");
    setUsername(normalizeUsername(nextProfile?.username));
    setBio(profile.bio ?? "");
    setLocation(nextLocation);
    setCounty(stringFromMode(nextModeData, "county") || countyForCity(nextLocation));
    setIntent(nextIntent);
    setDatingGoal(stringFromMode(nextModeData, "datingGoal") || (nextIntent !== "friendship" ? profile.connectionSubtype ?? "Hookup" : "Hookup"));
    setFriendGoal(friendGoalFromMode(nextModeData) || (nextIntent === "friendship" ? profile.connectionSubtype ?? "Casual Hangout" : "Casual Hangout"));
    setUsernameAvailable(null);
    setUsernameError(null);
  }, [profile]);

  useEffect(() => {
    const normalized = normalizeUsername(username);
    setUsernameError(null);
    setUsernameAvailable(null);
    setUsernameChecking(false);
    if (!normalized || normalized === originalUsername) return;
    if (!USERNAME_RE.test(normalized)) {
      setUsernameError("Use 3-20 lowercase letters, numbers, or underscores.");
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setUsernameChecking(true);
      const timeoutId = setTimeout(() => controller.abort(), USERNAME_CHECK_TIMEOUT_MS);
      try {
        const { getFirestore: _fs, collection: _col, query: _q, where: _wh, getDocs: _gd, limit: _lim } = await import("firebase/firestore");
        const { getApp: _ga } = await import("firebase/app");
        const _db = _fs(_ga());
        const _snap = await _gd(_q(_col(_db, "profiles"), _wh("username", "==", normalized), _lim(1)));
        if (cancelled) return;
        const available = _snap.empty || _snap.docs[0].id === user?.id;
        setUsernameAvailable(available);
        setUsernameError(available ? null : "That username is already taken.");
      } catch (error) {
        if (!cancelled) {
          setUsernameAvailable(false);
          setUsernameError(
            isAbortError(error)
              ? "Username check timed out. Check your connection and try again."
              : "Could not check username. Try again.",
          );
        }
      } finally {
        clearTimeout(timeoutId);
        if (!cancelled) setUsernameChecking(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [originalUsername, user?.id, username]);

  useEffect(() => {
    let mounted = true;
    void Promise.all([
      SecureStore.getItemAsync(LOCATION_PRECISION_KEY).catch(() => null),
      SecureStore.getItemAsync(NOTIFICATION_CONSENT_KEY).catch(() => null),
    ]).then(([precision, notificationConsent]) => {
      if (!mounted) return;
      setPreciseLocationOn(precision === "precise");
      setNotificationsOn(notificationConsent === "granted");
    });
    return () => {
      mounted = false;
    };
  }, []);

  function payloadForSave(overrides: {
    displayName?: string;
    username?: string;
    bio?: string;
    location?: string;
    county?: string;
    intent?: DisplayIntent;
    datingGoal?: string;
    friendGoal?: string;
  } = {}) {
    const nextIntent = overrides.intent ?? intent;
    const nextDatingGoal = overrides.datingGoal ?? datingGoal;
    const nextFriendGoal = overrides.friendGoal ?? friendGoal;
    const nextUsername = normalizeUsername(overrides.username ?? username);
    const nextLocation = overrides.location ?? location;
    const nextCounty = overrides.county ?? countyForCity(nextLocation);
    const nextModeData: ModeData = {
      ...currentModeData,
      username: nextUsername,
      county: nextCounty,
      ...(nextIntent === "dating" || nextIntent === "all" ? { datingGoal: nextDatingGoal } : { datingGoal: undefined }),
      ...(nextIntent === "friendship" || nextIntent === "all" ? { friendshipTypes: [nextFriendGoal] } : { friendshipTypes: [] }),
    };
    const connectionSubtype =
      nextIntent === "dating"
        ? nextDatingGoal
        : nextIntent === "friendship"
          ? nextFriendGoal
          : nextDatingGoal;

    return {
      displayName: (overrides.displayName ?? displayName).trim() || profile?.displayName || user?.firstName || "ConnectSphere User",
      username: nextUsername,
      bio: overrides.bio ?? bio,
      birthDate: profile?.birthDate,
      gender: profile?.gender,
      location: nextLocation || undefined,
      country: profile?.country ?? "United States",
      intent: nextIntent as ConnectionIntent,
      interests: profile?.interests ?? [],
      languages: profile?.languages ?? [],
      photos: profile?.photos ?? [],
      role: profile?.role,
      profession: profile?.profession,
      connectionSubtype,
      modeData: nextModeData,
      acceptCommunityCode: true,
    };
  }

  async function saveProfile(key: string, overrides: Parameters<typeof payloadForSave>[0] = {}) {
    if (!profile) return;
    const normalized = normalizeUsername(overrides.username ?? username);
    if (!USERNAME_RE.test(normalized)) {
      setUsernameError("Use 3-20 lowercase letters, numbers, or underscores.");
      return;
    }
    if (normalized !== originalUsername && usernameAvailable !== true && overrides.username !== originalUsername) {
      setUsernameError("Confirm an available username before saving.");
      return;
    }
    setSavingKey(key);
    try {
      await updateProfile.mutateAsync({ data: payloadForSave(overrides) });
      await refetch();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not save profile.";
      Alert.alert("Save failed", message.includes("409") ? "That username is already taken." : message);
    } finally {
      setSavingKey(null);
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

  async function handleAnalyticsToggle(value: boolean) {
    setAnalyticsOn(value);
    await setAnalyticsConsent(value);
  }

  async function handleLocationPrecisionToggle(value: boolean) {
    setPreciseLocationOn(value);
    await SecureStore.setItemAsync(LOCATION_PRECISION_KEY, value ? "precise" : "approximate").catch(() => {});
  }

  async function handleNotificationsToggle(value: boolean) {
    if (!value) {
      setNotificationsOn(false);
      await SecureStore.setItemAsync(NOTIFICATION_CONSENT_KEY, "denied").catch(() => {});
      return;
    }

    const existing = await Notifications.getPermissionsAsync().catch(() => null);
    const granted =
      existing?.granted ||
      (await Notifications.requestPermissionsAsync().catch(() => ({ granted: false }))).granted;
    setNotificationsOn(granted);
    await SecureStore.setItemAsync(NOTIFICATION_CONSENT_KEY, granted ? "granted" : "denied").catch(() => {});
    if (!granted) Alert.alert("Notifications off", "You can enable notifications later from system settings.");
  }

  async function handleRequestExport() {
    setExportSubmitting(true);
    try {
      await customFetch("/api/account/export", { method: "POST", body: JSON.stringify({}) });
      Alert.alert("Export requested", "Your data export request is queued. We'll notify you when it is ready.");
    } catch {
      Alert.alert("Export failed", "We couldn't request your export. Please try again.");
    } finally {
      setExportSubmitting(false);
    }
  }

  async function handleRequestDeletion() {
    setDeletionSubmitting(true);
    try {
      await customFetch("/api/account/deletion-request", { method: "POST", body: JSON.stringify({}) });
      Alert.alert("Deletion queued", "Type DELETE below and tap Delete account to confirm removal.");
    } catch {
      Alert.alert("Deletion request failed", "We couldn't queue deletion. Please try again.");
    } finally {
      setDeletionSubmitting(false);
    }
  }

  async function handleConfirmDeletion() {
    if (deleteConfirmation !== "DELETE") {
      Alert.alert("Confirmation required", "Type DELETE exactly before deleting your account.");
      return;
    }
    Alert.alert("Delete your account?", "This removes your profile and queues retained safety/payment records per policy.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete account",
        style: "destructive",
        onPress: async () => {
          setDeletionSubmitting(true);
          try {
            await customFetch("/api/account/delete", {
              method: "POST",
              body: JSON.stringify({ confirmation: "DELETE" }),
            });
            await signOut();
            router.replace("/(auth)/welcome");
          } catch {
            Alert.alert("Delete failed", "Your deletion request is still queued. Contact support if this keeps happening.");
          } finally {
            setDeletionSubmitting(false);
          }
        },
      },
    ]);
  }

  function openLegalLink(link: LegalLink) {
    if ("route" in link) {
      router.push(link.route);
      return;
    }
    void Linking.openURL(link.url).catch(() => Alert.alert("Could not open link", link.url));
  }

  async function handleSentrySmoke() {
    setSentrySmokeSending(true);
    try {
      const result = await sendSentrySmokeTest();
      if (!result.sent) {
        Alert.alert("Sentry unavailable", "The Sentry SDK did not load. Check the DSN and rebuild environment.");
        return;
      }
      Alert.alert(
        "Sentry test sent",
        result.metricsSent
          ? "Check Sentry Issues and Metrics for the ConnectSphere smoke event."
          : "Check Sentry Issues for the ConnectSphere smoke message. Metrics were not available on this SDK runtime.",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not send the Sentry smoke event.";
      Alert.alert("Sentry test failed", message);
    } finally {
      setSentrySmokeSending(false);
    }
  }

  const saveUsernameDisabled =
    usernameChecking ||
    !!usernameError ||
    !USERNAME_RE.test(normalizeUsername(username)) ||
    (normalizeUsername(username) !== originalUsername && usernameAvailable !== true);

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#130611", "#0A0A0A", "#0A0A0A"]} style={StyleSheet.absoluteFill} />
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color="#FFF" />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>{t("settings.title")}</Text>
          <Text style={styles.headerSub}>Profile, privacy, and the way Discover works for you.</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomInset + 44 }}>
        <View style={styles.heroCard}>
          <LinearGradient colors={["rgba(255,0,127,0.18)", "rgba(255,255,255,0.03)"]} style={StyleSheet.absoluteFill} />
          <View style={styles.heroIcon}>
            <Ionicons name="person-circle" size={34} color="#FFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>{profile?.displayName || user?.firstName || "Your profile"}</Text>
            <Text style={styles.heroMeta}>{username ? `@${normalizeUsername(username)}` : "Choose your unique username"}</Text>
          </View>
          <View style={styles.verifiedMini}>
            <Ionicons name={profile?.isVerified ? "shield-checkmark" : "shield-outline"} size={15} color="#FF007F" />
            <Text style={styles.verifiedMiniText}>{profile?.isVerified ? "Verified" : "Verify"}</Text>
          </View>
        </View>

        <Text style={styles.sectionHeader}>Account</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Display name</Text>
          <View style={styles.inputRow}>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
              placeholderTextColor="#71717A"
              style={styles.input}
            />
            <Pressable onPress={() => saveProfile("name", { displayName })} style={styles.smallBtn}>
              {savingKey === "name" ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.smallBtnText}>Save</Text>}
            </Pressable>
          </View>

          <Text style={[styles.label, { marginTop: 18 }]}>Username</Text>
          <View style={styles.usernameInputWrap}>
            <Text style={styles.atSymbol}>@</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              value={username}
              onChangeText={(value) => setUsername(normalizeUsername(value))}
              placeholder="username"
              placeholderTextColor="#71717A"
              style={[styles.input, { paddingLeft: 34 }]}
            />
          </View>
          <UsernameStatus checking={usernameChecking} available={usernameAvailable} error={usernameError} />
          <Pressable
            onPress={() => saveProfile("username", { username: normalizeUsername(username) })}
            disabled={saveUsernameDisabled || savingKey === "username"}
            style={[styles.primaryBtn, (saveUsernameDisabled || savingKey === "username") && styles.disabledBtn]}
          >
            {savingKey === "username" ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Save username</Text>}
          </Pressable>

          <View style={styles.emailRow}>
            <Ionicons name="mail-outline" size={18} color="#A1A1AA" />
            <Text style={styles.emailText}>{user?.primaryEmailAddress?.emailAddress ?? "Email connected"}</Text>
          </View>
        </View>

        <Text style={styles.sectionHeader}>Profile</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={styles.bioInput}
            value={bio}
            onChangeText={setBio}
            multiline
            maxLength={300}
            placeholder="Tell people what you are actually like."
            placeholderTextColor="#71717A"
          />
          <View style={styles.bioFooter}>
            <Text style={styles.counter}>{bio.length}/300</Text>
            <Pressable onPress={() => saveProfile("bio", { bio })} style={styles.smallBtn}>
              {savingKey === "bio" ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.smallBtnText}>Save</Text>}
            </Pressable>
          </View>
        </View>

        <Text style={styles.sectionHeader}>Discover</Text>
        <View style={styles.card}>
          <Pressable onPress={() => setShowLocationPicker(true)} style={styles.navRow}>
            <View style={styles.navIcon}>
              <Ionicons name="location-outline" size={19} color="#FF007F" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.navTitle}>Location</Text>
              <Text style={styles.navMeta}>{location ? `${location}, ${county}` : "Choose Miami-Dade or Broward"}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#71717A" />
          </Pressable>

          <Pressable onPress={() => setShowIntentPicker(true)} style={styles.navRow}>
            <View style={styles.navIcon}>
              <Ionicons name="compass-outline" size={19} color="#FF007F" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.navTitle}>I'm looking for</Text>
              <Text style={styles.navMeta}>{INTENT_OPTIONS.find((item) => item.value === intent)?.label ?? "Both"}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#71717A" />
          </Pressable>

          {(intent === "dating" || intent === "all") ? (
            <View style={styles.chipBlock}>
              <Text style={styles.label}>Dating intention</Text>
              <View style={styles.chipWrap}>
                {DATING_GOALS.map((goal) => (
                  <Pressable
                    key={goal}
                    onPress={() => {
                      setDatingGoal(goal);
                      saveProfile(`dating-${goal}`, { datingGoal: goal });
                    }}
                    style={[styles.chip, datingGoal === goal && styles.activeChip]}
                  >
                    <Text style={[styles.chipText, datingGoal === goal && styles.activeChipText]}>{goal}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {(intent === "friendship" || intent === "all") ? (
            <View style={styles.chipBlock}>
              <Text style={styles.label}>Friend intention</Text>
              <View style={styles.chipWrap}>
                {FRIEND_GOALS.map((goal) => (
                  <Pressable
                    key={goal}
                    onPress={() => {
                      setFriendGoal(goal);
                      saveProfile(`friend-${goal}`, { friendGoal: goal });
                    }}
                    style={[styles.chip, friendGoal === goal && styles.friendActiveChip]}
                  >
                    <Text style={[styles.chipText, friendGoal === goal && styles.friendActiveChipText]}>{goal}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </View>

        <Text style={styles.sectionHeader}>ConnectSphere Plus</Text>
        <View style={styles.plusGrid}>
          <Pressable onPress={() => openPremium("shots")} style={styles.plusCard}>
            <Ionicons name="paper-plane" size={22} color="#FF007F" />
            <Text style={styles.plusTitle}>Get more Shots</Text>
            <Text style={styles.plusText}>Send more high-intent openers without waiting.</Text>
          </Pressable>
          <Pressable onPress={() => openPremium("best-friend")} style={styles.plusCard}>
            <Ionicons name="ribbon" size={22} color="#FF007F" />
            <Text style={styles.plusTitle}>More Best Friend sends</Text>
            <Text style={styles.plusText}>Stand out in Friends reactions with a premium badge.</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionHeader}>Account</Text>
        <View style={styles.card}>
          <Pressable onPress={handleSignOut} style={styles.signOutRow}>
            <Ionicons name="log-out-outline" size={20} color="#FB7185" />
            <Text style={styles.signOutText}>{t("settings.signOut")}</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionHeader}>Privacy & Safety</Text>
        <View style={styles.card}>
          <View style={styles.navRow}>
            <View style={styles.navIcon}>
              <Ionicons name="analytics-outline" size={19} color="#FF007F" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.navTitle}>Product analytics</Text>
              <Text style={styles.navMeta}>Help improve launch quality. Crash logs stay separate.</Text>
            </View>
            <Switch value={analyticsOn} onValueChange={handleAnalyticsToggle} trackColor={{ true: "#FF7ABF", false: "#3F3F46" }} />
          </View>

          <View style={styles.navRow}>
            <View style={styles.navIcon}>
              <Ionicons name="navigate-outline" size={19} color="#FF007F" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.navTitle}>Precise location</Text>
              <Text style={styles.navMeta}>{preciseLocationOn ? "Use precise location for nearby matching." : "Use approximate city-level location."}</Text>
            </View>
            <Switch value={preciseLocationOn} onValueChange={handleLocationPrecisionToggle} trackColor={{ true: "#FF7ABF", false: "#3F3F46" }} />
          </View>

          <View style={styles.navRow}>
            <View style={styles.navIcon}>
              <Ionicons name="notifications-outline" size={19} color="#FF007F" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.navTitle}>Push notifications</Text>
              <Text style={styles.navMeta}>Control match, invite, plan, and safety notifications.</Text>
            </View>
            <Switch value={notificationsOn} onValueChange={handleNotificationsToggle} trackColor={{ true: "#FF7ABF", false: "#3F3F46" }} />
          </View>

          <Pressable onPress={handleRequestExport} style={styles.navRow}>
            <View style={styles.navIcon}>
              <Ionicons name="download-outline" size={19} color="#FF007F" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.navTitle}>Request my data</Text>
              <Text style={styles.navMeta}>Queue an export of your account data.</Text>
            </View>
            {exportSubmitting ? <ActivityIndicator color="#FF007F" /> : <Ionicons name="chevron-forward" size={18} color="#71717A" />}
          </Pressable>

          <Pressable onPress={handleRequestDeletion} style={styles.navRow}>
            <View style={styles.navIcon}>
              <Ionicons name="trash-outline" size={19} color="#FB7185" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.navTitle}>Request account deletion</Text>
              <Text style={styles.navMeta}>Queue deletion and review retained safety/payment records.</Text>
            </View>
            {deletionSubmitting ? <ActivityIndicator color="#FB7185" /> : <Ionicons name="chevron-forward" size={18} color="#71717A" />}
          </Pressable>

          <TextInput
            value={deleteConfirmation}
            onChangeText={setDeleteConfirmation}
            autoCapitalize="characters"
            placeholder="Type DELETE to confirm"
            placeholderTextColor="#71717A"
            style={styles.input}
          />
          <Pressable onPress={handleConfirmDeletion} disabled={deletionSubmitting} style={[styles.dangerBtn, deletionSubmitting && styles.disabledBtn]}>
            <Text style={styles.dangerBtnText}>Delete account</Text>
          </Pressable>
        </View>

        <DevPushSmokePanel />

        {isSentrySmokeEnabled() ? (
          <>
            <Text style={styles.sectionHeader}>Sentry Smoke</Text>
            <View style={styles.card}>
              <Pressable onPress={handleSentrySmoke} disabled={sentrySmokeSending} style={styles.navRow}>
                <View style={styles.navIcon}>
                  <Ionicons name="bug-outline" size={19} color="#FF007F" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.navTitle}>Send Sentry test</Text>
                  <Text style={styles.navMeta}>Send a smoke message and metrics to the configured Sentry project.</Text>
                </View>
                {sentrySmokeSending ? <ActivityIndicator color="#FF007F" /> : <Ionicons name="chevron-forward" size={18} color="#71717A" />}
              </Pressable>
            </View>
          </>
        ) : null}

        {/* Discovery preferences */}
        <Text style={styles.sectionHeader}>Discovery</Text>
        <View style={styles.card}>
          <Pressable onPress={() => setShowDiscoveryFilters(true)} style={styles.navRow}>
            <View style={styles.navIcon}>
              <Ionicons name="options-outline" size={19} color="#FF007F" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.navTitle}>Age & Distance Filters</Text>
              <Text style={styles.navMeta}>Set who you see in your feed</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#71717A" />
          </Pressable>
          <Pressable onPress={() => router.push("/blocked-users" as never)} style={styles.navRow}>
            <View style={styles.navIcon}>
              <Ionicons name="ban-outline" size={19} color="#FF007F" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.navTitle}>Blocked Users</Text>
              <Text style={styles.navMeta}>Manage who you've blocked</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#71717A" />
          </Pressable>
        </View>

        <Text style={styles.sectionHeader}>Legal & Support</Text>
        <View style={styles.card}>
          {LEGAL_SUPPORT_LINKS.map(({ label, link, icon }) => (
            <Pressable key={label} onPress={() => openLegalLink(link)} style={styles.navRow}>
              <View style={styles.navIcon}>
                <Ionicons name={icon} size={19} color="#FF007F" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.navTitle}>{label}</Text>
                <Text style={styles.navMeta}>{"route" in link ? link.meta : link.url.replace(/^mailto:/, "")}</Text>
              </View>
              <Ionicons name={"route" in link ? "chevron-forward" : "open-outline"} size={18} color="#71717A" />
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <DiscoveryFiltersSheet
        visible={showDiscoveryFilters}
        userId={user?.id}
        onClose={() => setShowDiscoveryFilters(false)}
      />

      <Modal visible={showIntentPicker} transparent animationType="slide" onRequestClose={() => setShowIntentPicker(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowIntentPicker(false)} />
        <View style={[styles.sheet, { paddingBottom: bottomInset + 18 }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Choose your lane</Text>
          <Text style={styles.sheetSub}>This controls which Discover tabs you see.</Text>
          {INTENT_OPTIONS.map((option) => {
            const isActive = intent === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  setIntent(option.value);
                  saveProfile("intent", {
                    intent: option.value,
                    datingGoal: datingGoal || "Hookup",
                    friendGoal: friendGoal || "Casual Hangout",
                  });
                  setShowIntentPicker(false);
                }}
                style={[styles.intentOption, isActive && { borderColor: option.gradient[0], backgroundColor: `${option.gradient[0]}18` }]}
              >
                <LinearGradient colors={option.gradient} style={styles.intentIcon}>
                  <Ionicons name={option.icon} size={21} color="#FFF" />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={styles.intentLabel}>{option.label}</Text>
                  <Text style={styles.intentDesc}>{option.description}</Text>
                </View>
                {isActive ? <Ionicons name="checkmark-circle" size={22} color={option.gradient[0]} /> : null}
              </Pressable>
            );
          })}
        </View>
      </Modal>

      <Modal visible={showLocationPicker} transparent animationType="slide" onRequestClose={() => setShowLocationPicker(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowLocationPicker(false)} />
        <View style={[styles.sheet, { maxHeight: "78%", paddingBottom: bottomInset + 18 }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Set your home base</Text>
          <Text style={styles.sheetSub}>Pick the South Florida area people should match around.</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {COUNTIES.map((countyItem) => (
              <View key={countyItem.name} style={styles.countyBlock}>
                <Text style={styles.countyTitle}>{countyItem.name}</Text>
                <View style={styles.cityWrap}>
                  {countyItem.cities.map((city) => {
                    const isActive = location === city;
                    return (
                      <Pressable
                        key={city}
                        onPress={() => {
                          setLocation(city);
                          setCounty(countyItem.name);
                          saveProfile("location", { location: city, county: countyItem.name });
                          setShowLocationPicker(false);
                        }}
                        style={[styles.cityChip, isActive && styles.activeCityChip]}
                      >
                        <Text style={[styles.cityText, isActive && styles.activeCityText]}>{city}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A0A" },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingBottom: 14 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.06)" },
  headerTitle: { color: "#FFF", fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  headerSub: { color: "#A1A1AA", fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  sectionHeader: { color: "#A1A1AA", fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 1.1, textTransform: "uppercase", paddingHorizontal: 18, paddingTop: 22, paddingBottom: 8 },
  heroCard: { marginHorizontal: 16, marginTop: 4, borderRadius: 24, borderWidth: 1, borderColor: "rgba(255,0,127,0.28)", padding: 16, overflow: "hidden", flexDirection: "row", alignItems: "center", gap: 12 },
  heroIcon: { width: 54, height: 54, borderRadius: 20, backgroundColor: "rgba(255,0,127,0.22)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,0,127,0.35)" },
  heroTitle: { color: "#FFF", fontSize: 18, fontFamily: "Inter_800ExtraBold" },
  heroMeta: { color: "#FF7ABF", fontSize: 13, fontFamily: "Inter_700Bold", marginTop: 3 },
  verifiedMini: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, backgroundColor: "rgba(255,0,127,0.13)", borderWidth: 1, borderColor: "rgba(255,0,127,0.3)", paddingHorizontal: 9, paddingVertical: 6 },
  verifiedMiniText: { color: "#FF7ABF", fontSize: 11, fontFamily: "Inter_800ExtraBold" },
  card: { marginHorizontal: 16, borderRadius: 22, backgroundColor: "#161616", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", padding: 16, gap: 10 },
  label: { color: "#F4F4F5", fontSize: 13, fontFamily: "Inter_800ExtraBold", marginBottom: 2 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  input: { flex: 1, minHeight: 48, borderRadius: 16, backgroundColor: "#0F0F0F", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)", paddingHorizontal: 14, color: "#FFF", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  usernameInputWrap: { position: "relative" },
  atSymbol: { position: "absolute", left: 15, top: 14, zIndex: 2, color: "#FF007F", fontSize: 16, fontFamily: "Inter_800ExtraBold" },
  usernameStatus: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  usernameStatusText: { color: "#A1A1AA", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  smallBtn: { minWidth: 76, height: 46, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#FF007F", paddingHorizontal: 14 },
  smallBtnText: { color: "#FFF", fontSize: 13, fontFamily: "Inter_800ExtraBold" },
  primaryBtn: { height: 48, borderRadius: 16, backgroundColor: "#FF007F", alignItems: "center", justifyContent: "center", marginTop: 4 },
  disabledBtn: { opacity: 0.45 },
  primaryBtnText: { color: "#FFF", fontSize: 14, fontFamily: "Inter_800ExtraBold" },
  emailRow: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.09)", paddingTop: 13 },
  emailText: { color: "#A1A1AA", fontSize: 13, fontFamily: "Inter_500Medium" },
  bioInput: { minHeight: 104, borderRadius: 18, backgroundColor: "#0F0F0F", borderWidth: 1, borderColor: "rgba(255,0,127,0.22)", color: "#FFF", padding: 14, textAlignVertical: "top", fontSize: 15, lineHeight: 21, fontFamily: "Inter_500Medium" },
  bioFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  counter: { color: "#71717A", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  navRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.08)" },
  navIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: "rgba(255,0,127,0.13)", alignItems: "center", justifyContent: "center" },
  navTitle: { color: "#FFF", fontSize: 15, fontFamily: "Inter_800ExtraBold" },
  navMeta: { color: "#A1A1AA", fontSize: 12, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  chipBlock: { paddingTop: 12, gap: 8 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: "#101010", paddingHorizontal: 13, paddingVertical: 9 },
  activeChip: { borderColor: "#FF007F", backgroundColor: "rgba(255,0,127,0.17)" },
  friendActiveChip: { borderColor: "#38BDF8", backgroundColor: "rgba(56,189,248,0.16)" },
  chipText: { color: "#D4D4D8", fontSize: 12, fontFamily: "Inter_800ExtraBold" },
  activeChipText: { color: "#FF7ABF" },
  friendActiveChipText: { color: "#7DD3FC" },
  plusGrid: { marginHorizontal: 16, flexDirection: "row", gap: 10 },
  plusCard: { flex: 1, minHeight: 132, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,0,127,0.22)", backgroundColor: "#161616", padding: 14, gap: 8 },
  plusTitle: { color: "#FFF", fontSize: 14, fontFamily: "Inter_800ExtraBold" },
  plusText: { color: "#A1A1AA", fontSize: 12, lineHeight: 16, fontFamily: "Inter_500Medium" },
  signOutRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  signOutText: { color: "#FB7185", fontSize: 15, fontFamily: "Inter_800ExtraBold" },
  dangerBtn: { height: 48, borderRadius: 16, backgroundColor: "#BE123C", alignItems: "center", justifyContent: "center", marginTop: 4 },
  dangerBtnText: { color: "#FFF", fontSize: 14, fontFamily: "Inter_800ExtraBold" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)" },
  sheet: { backgroundColor: "#111111", borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", padding: 18 },
  sheetHandle: { alignSelf: "center", width: 42, height: 4, borderRadius: 4, backgroundColor: "#3F3F46", marginBottom: 16 },
  sheetTitle: { color: "#FFF", fontSize: 22, fontFamily: "Inter_800ExtraBold", textAlign: "center" },
  sheetSub: { color: "#A1A1AA", fontSize: 13, lineHeight: 18, fontFamily: "Inter_500Medium", textAlign: "center", marginTop: 4, marginBottom: 16 },
  intentOption: { flexDirection: "row", alignItems: "center", gap: 13, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.09)", backgroundColor: "#161616", padding: 14, marginBottom: 10 },
  intentIcon: { width: 44, height: 44, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  intentLabel: { color: "#FFF", fontSize: 16, fontFamily: "Inter_800ExtraBold" },
  intentDesc: { color: "#A1A1AA", fontSize: 12, lineHeight: 16, fontFamily: "Inter_500Medium", marginTop: 2 },
  countyBlock: { marginBottom: 18 },
  countyTitle: { color: "#FFF", fontSize: 15, fontFamily: "Inter_800ExtraBold", marginBottom: 10 },
  cityWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cityChip: { borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", backgroundColor: "#161616", paddingHorizontal: 13, paddingVertical: 9 },
  activeCityChip: { borderColor: "#FF007F", backgroundColor: "rgba(255,0,127,0.16)" },
  cityText: { color: "#D4D4D8", fontSize: 12, fontFamily: "Inter_700Bold" },
  activeCityText: { color: "#FF7ABF" },
});
