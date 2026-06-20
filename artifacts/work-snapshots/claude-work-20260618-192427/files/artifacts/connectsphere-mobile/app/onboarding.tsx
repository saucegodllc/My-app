import { useAuth, useUser } from "@clerk/clerk-expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import * as Notifications from "expo-notifications";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { LivenessCamera } from "../components/LivenessCamera";
import { apiUrl } from "@/lib/apiBase";
import { requestNotificationPermission } from "@/lib/permissions";
import {
  SHOT_TOOLTIP_COPY,
  SHOT_TOOLTIP_STORAGE_KEY,
  shouldShowShotTooltip,
} from "@/lib/retentionFeatures";
import { getFirebaseRuntime } from "@/services/connections/firebaseClient";
import { acceptFriendInvite } from "@/services/friendsApi";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  KeyboardAvoidingView,
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

const PINK = "#FF299B";
const ROSE = "#D91880";
const PURPLE = "#8B5CF6";
const FINISH_SAVE_TIMEOUT_MS = 15_000;
const PHOTO_UPLOAD_TIMEOUT_MS = 8_000;
const PHOTO_PICKER_QUALITY = 0.55;
// Temporary Expo Go launch bypass: let this test account finish onboarding without photos.
const REQUIRED_PROFILE_PHOTOS = 0;

function appleEmojiUrl(emoji: string): string {
  const points = [...emoji]
    .map((c) => c.codePointAt(0)!)
    .filter((cp) => cp !== 0xfe0f) // strip variation selectors
    .map((cp) => cp.toString(16).toLowerCase());
  return `https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/${points.join("-")}.png`;
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}
const WINDOW_WIDTH = Dimensions.get("window").width;
const TOTAL_STEPS = 12;
const BIO_MAX_LENGTH = 180;
const BIO_GENERATE_TIMEOUT_MS = 3_000;
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
// Reduced from 2500ms — users interpret >800ms as broken
const USERNAME_CHECK_TIMEOUT_MS = 800;
const USERNAME_CHECK_DEBOUNCE_MS = 175;
const ALLOW_DEV_USERNAME_FALLBACK = __DEV__;
const USERNAME_CHECK_UNAVAILABLE_MESSAGE = "Could not check username. Try again.";
const BIO_STARTERS = [
  "My perfect night is...",
  "I'm usually the friend who...",
  "You should know that...",
] as const;

// ─── Photo step data ─────────────────────────────────────────────────────────
const SLOT_PROMPTS = [
  { label: "Best smile", emoji: "📸", icon: "happy-outline"        as const },
  { label: "Adventure shot", emoji: "🏔️", icon: "compass-outline"  as const },
  { label: "With friends",  emoji: "🎉", icon: "people-outline"    as const },
  { label: "What you love", emoji: "🎨", icon: "heart-outline"     as const },
  { label: "Something fun", emoji: "🕺", icon: "musical-notes-outline" as const },
  { label: "Spontaneous",   emoji: "🌅", icon: "sunny-outline"     as const },
] as const;
const PHOTO_MESSAGES = [
  "Add 1 photo to unlock your profile",
  "✅ Profile unlocked! Add more for 6× more matches",
  "2 photos — keep going! 3 is the sweet spot 🎯",
  "3 photos — perfect for most matches! Add more to dominate 🔥",
  "Almost there! One more to max out",
  "Your profile is shining! 🔥",
  "Full house — you look incredible! ✨",
];
const PHOTO_TIPS = [
  { icon: "sunny-outline"   as const, text: "Natural light beats any filter" },
  { icon: "happy-outline"   as const, text: "Smiling gets 14% more swipes"   },
  { icon: "compass-outline" as const, text: "Show off your interests"         },
  { icon: "eye-outline"     as const, text: "Eye contact = instant connection"},
] as const;

// ─── Data ────────────────────────────────────────────────────────────────────

const MIAMI_DADE_CITIES = [
  "Aventura", "Bal Harbour", "Bay Harbor Islands", "Brickell", "Coconut Grove",
  "Coral Gables", "Cutler Bay", "Doral", "Downtown Miami", "El Portal",
  "Florida City", "Golden Beach", "Hialeah", "Hialeah Gardens", "Homestead",
  "Kendall", "Key Biscayne", "Little Haiti", "Little Havana", "Medley",
  "Miami", "Miami Beach", "Miami Gardens", "Miami Lakes", "Miami Shores",
  "Miami Springs", "North Bay Village", "North Miami", "North Miami Beach",
  "Opa-locka", "Overtown", "Palmetto Bay", "Pinecrest", "South Miami",
  "Surfside", "Sweetwater", "Virginia Gardens", "West Miami", "Westchester", "Wynwood",
];

const BROWARD_CITIES = [
  "Coconut Creek", "Cooper City", "Coral Springs", "Dania Beach", "Davie",
  "Deerfield Beach", "Fort Lauderdale", "Hallandale Beach", "Hollywood",
  "Lauderdale Lakes", "Lauderdale-by-the-Sea", "Lauderhill", "Lazy Lake",
  "Lighthouse Point", "Margate", "Miramar", "North Lauderdale", "Oakland Park",
  "Parkland", "Pembroke Park", "Pembroke Pines", "Plantation", "Pompano Beach",
  "Sea Ranch Lakes", "Southwest Ranches", "Sunrise", "Tamarac", "Weston",
  "West Park", "Wilton Manors",
];

const GENDERS = [
  { value: "Man",               icon: "male-outline" as const },
  { value: "Woman",             icon: "female-outline" as const },
  { value: "Non-binary",        icon: "transgender-outline" as const },
  { value: "Other",             icon: "sparkles-outline" as const },
  { value: "Prefer not to say", icon: "ellipsis-horizontal-circle-outline" as const },
];

const PREFERENCES = [
  { value: "Men",      icon: "male-outline" as const },
  { value: "Women",    icon: "female-outline" as const },
  { value: "Everyone", icon: "people-outline" as const },
];

const INTENTS = [
  { value: "dating",      label: "Dating",  icon: "heart" as const,    desc: "Find romantic connections",   color: PINK },
  { value: "friendship",  label: "Friends", icon: "people" as const,   desc: "Make new friends",           color: "#22D3EE" },
  { value: "all",         label: "Both",    icon: "sparkles" as const, desc: "Date and make friends",       color: "#A855F7" },
];

const FRIENDSHIP_TYPES = [
  { value: "Casual Hangout",   icon: "cafe-outline" as const,          label: "Casual Hangout" },
  { value: "Activity Partner", icon: "bicycle-outline" as const,        label: "Activity Partner" },
  { value: "Wing Person",      icon: "people-circle-outline" as const,  label: "Wing Person" },
  { value: "BFF Hunt",         icon: "heart-circle-outline" as const,   label: "BFF Hunt" },
];

const OPPORTUNITY_TYPES = [
  { value: "Jobs & Referrals", icon: "briefcase-outline" as const, label: "Jobs & Referrals" },
  { value: "Collaborations", icon: "git-network-outline" as const, label: "Collaborations" },
  { value: "Mentorship", icon: "school-outline" as const, label: "Mentorship" },
  { value: "Business Partners", icon: "rocket-outline" as const, label: "Business Partners" },
  { value: "Events & Gigs", icon: "calendar-outline" as const, label: "Events & Gigs" },
];

const DATING_GOALS = [
  { value: "Hookup", icon: "flame-outline" as const, label: "Hookup" },
  { value: "Long Term", icon: "heart-outline" as const, label: "Long Term" },
  { value: "Curious", icon: "sparkles-outline" as const, label: "Curious" },
  { value: "Having Fun", icon: "happy-outline" as const, label: "Having Fun" },
];

const FIRST_DATE_STYLES = [
  { value: "Coffee", icon: "cafe-outline" as const, label: "Coffee" },
  { value: "Dinner", icon: "restaurant-outline" as const, label: "Dinner" },
  { value: "Drinks", icon: "wine-outline" as const, label: "Drinks" },
  { value: "Walk", icon: "walk-outline" as const, label: "Walk" },
  { value: "Activity", icon: "tennisball-outline" as const, label: "Activity" },
];

const DATING_ENERGIES = [
  { value: "Playful", icon: "sparkles-outline" as const, label: "Playful" },
  { value: "Deep talks", icon: "chatbubbles-outline" as const, label: "Deep talks" },
  { value: "Low-key", icon: "moon-outline" as const, label: "Low-key" },
  { value: "Social", icon: "people-outline" as const, label: "Social" },
];

const DATING_COMFORTS = [
  { value: "Public place first", icon: "shield-checkmark-outline" as const, label: "Public place first" },
  { value: "Video first", icon: "videocam-outline" as const, label: "Video first" },
  { value: "Friend-friendly", icon: "people-circle-outline" as const, label: "Friend-friendly" },
  { value: "Low-noise plans", icon: "volume-low-outline" as const, label: "Low-noise plans" },
];


const INTERESTS = [
  "Travel", "Beach", "Nightlife", "Food", "Coffee", "Wine & Cocktails",
  "Music", "Dancing", "Salsa / Latin Dance", "Art", "Photography", "Fashion",
  "Fitness", "Running", "Cycling", "Swimming", "Yoga", "Tennis",
  "Sports", "Hiking", "Outdoors", "Movies", "Reading", "Live Events",
  "Tech", "Cooking", "Pets", "Mindfulness", "Volunteering", "Entrepreneurship",
];

// ─── Animated Background ──────────────────────────────────────────────────────

function AnimatedBackground() {
  const b1s = useRef(new Animated.Value(1)).current;
  const b1o = useRef(new Animated.Value(0.28)).current;
  const b2s = useRef(new Animated.Value(1)).current;
  const b2o = useRef(new Animated.Value(0.2)).current;
  const b3s = useRef(new Animated.Value(1)).current;
  const b3o = useRef(new Animated.Value(0.12)).current;

  useEffect(() => {
    const pulse = (
      scale: Animated.Value,
      opacity: Animated.Value,
      dur: number,
      toScale: number,
      toOp: number,
      fromOp: number,
    ) =>
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(scale, { toValue: toScale, duration: dur, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: toOp, duration: dur, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(scale, { toValue: 1, duration: dur, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: fromOp, duration: dur, useNativeDriver: true }),
          ]),
        ])
      );

    pulse(b1s, b1o, 3200, 1.18, 0.45, 0.28).start();
    pulse(b2s, b2o, 2600, 1.12, 0.32, 0.18).start();
    pulse(b3s, b3o, 1900, 1.22, 0.22, 0.1).start();
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={{
        position: "absolute", top: -100, right: -80,
        width: 300, height: 300, borderRadius: 150,
        backgroundColor: PINK, opacity: b1o, transform: [{ scale: b1s }],
      }} />
      <Animated.View style={{
        position: "absolute", bottom: 80, left: -100,
        width: 260, height: 260, borderRadius: 130,
        backgroundColor: ROSE, opacity: b2o, transform: [{ scale: b2s }],
      }} />
      <Animated.View style={{
        position: "absolute", top: "38%", left: "25%",
        width: 160, height: 160, borderRadius: 80,
        backgroundColor: PURPLE, opacity: b3o, transform: [{ scale: b3s }],
      }} />
    </View>
  );
}

// ─── ScalePressable ───────────────────────────────────────────────────────────

function ScalePressable({
  onPress,
  style,
  containerStyle,
  children,
  disabled,
}: {
  onPress?: () => void;
  style?: object | ((state: { pressed: boolean }) => object);
  containerStyle?: object;
  children?: React.ReactNode;
  disabled?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  function pressIn() {
    Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 60, bounciness: 3 }).start();
  }
  function pressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 35, bounciness: 7 }).start();
  }
  return (
    <Pressable onPress={onPress} onPressIn={pressIn} onPressOut={pressOut} disabled={disabled} style={containerStyle}>
      {({ pressed }) => (
        <Animated.View style={[typeof style === "function" ? style({ pressed }) : style, { transform: [{ scale }] }]}>
          {children}
        </Animated.View>
      )}
    </Pressable>
  );
}

// ─── DropdownPicker ───────────────────────────────────────────────────────────

function DropdownPicker({
  label, value, placeholder, options, onSelect, icon,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: string[];
  onSelect: (v: string) => void;
  icon?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <View style={{ gap: 8 }}>
        {label ? <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, fontFamily: "Inter_500Medium" }}>{label}</Text> : null}
        <ScalePressable onPress={() => setOpen(true)} style={{
          flexDirection: "row", alignItems: "center", gap: 10,
          borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 16, height: 54,
          backgroundColor: value ? "rgba(255,41,155,0.12)" : "rgba(255,255,255,0.06)",
          borderColor: value ? PINK : "rgba(255,255,255,0.12)",
        }}>
          {icon && <Ionicons name={icon as never} size={18} color={value ? PINK : "rgba(255,255,255,0.4)"} />}
          <Text style={{ flex: 1, fontSize: 16, fontFamily: "Inter_400Regular", color: value ? "#fff" : "rgba(255,255,255,0.4)" }} numberOfLines={1}>
            {value || placeholder}
          </Text>
          <Ionicons name="chevron-down" size={18} color="rgba(255,255,255,0.3)" />
        </ScalePressable>
      </View>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)" }} onPress={() => setOpen(false)} />
        <View style={{ backgroundColor: "#111", borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "72%", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", paddingBottom: 32 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.15)", alignSelf: "center", marginTop: 12, marginBottom: 4 }} />
          <Text style={{ fontSize: 17, fontFamily: "Inter_600SemiBold", color: "#fff", textAlign: "center", paddingVertical: 16, paddingHorizontal: 24 }}>{label || placeholder}</Text>
          <FlatList
            data={options}
            keyExtractor={(item) => item}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const sel = item === value;
              return (
                <ScalePressable onPress={() => { onSelect(item); setOpen(false); }} style={{
                  flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                  paddingHorizontal: 24, paddingVertical: 14,
                  borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.07)",
                  backgroundColor: sel ? "rgba(255,41,155,0.15)" : "transparent",
                }}>
                  <Text style={{ fontSize: 16, fontFamily: sel ? "Inter_600SemiBold" : "Inter_400Regular", color: sel ? PINK : "#fff" }}>{item}</Text>
                  {sel && <Ionicons name="checkmark" size={18} color={PINK} />}
                </ScalePressable>
              );
            }}
          />
        </View>
      </Modal>
    </>
  );
}

// ─── PinkButton ───────────────────────────────────────────────────────────────

function PinkButton({ label, onPress, disabled, icon }: {
  label: string; onPress: () => void; disabled?: boolean; icon?: string;
}) {
  return (
    <ScalePressable onPress={onPress} disabled={disabled} style={{
      height: 58, borderRadius: 18, overflow: "hidden", opacity: disabled ? 0.42 : 1,
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    }}>
      <LinearGradient
        colors={[PINK, ROSE]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <Text style={{ color: "#fff", fontSize: 17, fontFamily: "Inter_700Bold" }}>{label}</Text>
      {icon && <Ionicons name={icon as never} size={18} color="#fff" />}
    </ScalePressable>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const { getToken, signOut, isSignedIn, isLoaded: isAuthLoaded } = useAuth();
  const { user } = useUser();
  const params = useLocalSearchParams<{ friendInviteToken?: string }>();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  // ── Entry fade-in (smooth transition from congrats screen) ───────────────────
  const mountFade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(mountFade, {
      toValue: 1,
      duration: 550,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, []);

  // ── Navigation ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isAuthLoaded && !isSignedIn) {
      router.replace("/(auth)/welcome");
    }
  }, [isAuthLoaded, isSignedIn]);

  const [step, setStep] = useState(1);
  const [underageDenied, setUnderageDenied] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const stepRef = useRef(1);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function goToStep(newStep: number, direction: 1 | -1 = 1) {
    slideAnim.setValue(direction * WINDOW_WIDTH);
    stepRef.current = newStep;
    setStep(newStep);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: false,
      tension: 68,
      friction: 11,
    }).start();
  }

  function scheduleAdvance(fromStep: number) {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(() => {
      const next = fromStep + 1;
      saveProgress({ nextStep: next });
      goToStep(next, 1);
    }, 320);
  }

  // ── Step 1 — Name ───────────────────────────────────────────────────────────
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // ── Step 2 — Birthday ───────────────────────────────────────────────────────
  const [dobMonth, setDobMonth] = useState("");
  const [dobDay, setDobDay] = useState("");
  const [dobYear, setDobYear] = useState("");
  const [dobPickerOpen, setDobPickerOpen] = useState<null | "month" | "day" | "year">(null);
  const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dobMonthOptions = MONTH_NAMES.map((name, i) => ({ label: name, value: String(i + 1).padStart(2, "0") }));
  const dobDayOptions = Array.from({ length: 31 }, (_, i) => ({ label: String(i + 1), value: String(i + 1).padStart(2, "0") }));
  const dobCurrentYear = new Date().getFullYear();
  const dobYearOptions = Array.from({ length: 100 }, (_, i) => {
    const y = dobCurrentYear - 18 - i;
    return { label: String(y), value: String(y) };
  });

  function computedAge(): number | null {
    const m = parseInt(dobMonth, 10);
    const d = parseInt(dobDay, 10);
    const y = parseInt(dobYear, 10);
    if (!m || !d || !y || y < 1900 || y > 2100) return null;
    const dob = new Date(y, m - 1, d);
    if (isNaN(dob.getTime())) return null;
    return Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  }

  function dobIsoString(): string | null {
    const m = parseInt(dobMonth, 10);
    const d = parseInt(dobDay, 10);
    const y = parseInt(dobYear, 10);
    if (!m || !d || !y) return null;
    const dob = new Date(Date.UTC(y, m - 1, d));
    if (isNaN(dob.getTime())) return null;
    return dob.toISOString().slice(0, 10);
  }

  // ── Step 3 — Gender ─────────────────────────────────────────────────────────
  const [gender, setGender] = useState("");
  const [showGenderOnProfile, setShowGenderOnProfile] = useState(true);

  // ── Step 4 — Preference ─────────────────────────────────────────────────────
  const [lookingForGender, setLookingForGender] = useState("");

  // ── Step 5 — Intent + Interests ─────────────────────────────────────────────
  const [intent, setIntent] = useState("");
  const [datingGoal, setDatingGoal] = useState("");
  const [firstDateStyle, setFirstDateStyle] = useState("");
  const [datingEnergy, setDatingEnergy] = useState("");
  const [datingComforts, setDatingComforts] = useState<string[]>([]);
  const [shotTooltipSeen, setShotTooltipSeen] = useState(true);
  const [friendshipTypes, setFriendshipTypes] = useState<string[]>([]);
  const [careerStage, setCareerStage] = useState("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [allInterests, setAllInterests] = useState<string[]>([...INTERESTS]);
  const [customInterest, setCustomInterest] = useState("");
  const [bio, setBio] = useState("");
  const [bioGenerating, setBioGenerating] = useState(false);
  const [bioError, setBioError] = useState<string | null>(null);
  const [bioGeneratedOnce, setBioGeneratedOnce] = useState(false);
  const [username, setUsername] = useState("");
  const [usernameEdited, setUsernameEdited] = useState(false);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  function normalizeUsername(value: string) {
    return value.toLowerCase().replace(/^@+/, "").replace(/[^a-z0-9_]/g, "").slice(0, 20);
  }

  function suggestUsername() {
    const base = [firstName, lastName]
      .map((part) => part.trim().toLowerCase().replace(/[^a-z0-9_]/g, ""))
      .filter(Boolean)
      .join("_");
    return normalizeUsername(base || "miami_vibe").slice(0, 20);
  }

  function handleUsernameChange(value: string) {
    setUsernameEdited(true);
    setUsername(normalizeUsername(value));
    setUsernameAvailable(null);
    setUsernameError(null);
    setUsernameChecking(false);
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

  async function checkUsernameAvailability(nextUsername: string, _signal?: AbortSignal) {
    const { getFirestore: _fs, collection: _col, query: _q, where: _where, getDocs: _getDocs, limit: _limit } = await import("firebase/firestore");
    const { getApp: _ga } = await import("firebase/app");
    const _db = _fs(_ga());
    const snap = await _getDocs(_q(_col(_db, "profiles"), _where("username", "==", nextUsername), _limit(1)));
    if (snap.empty) return { available: true, error: null };
    // Own username is always available
    if (snap.docs[0].id === user?.id) return { available: true, error: null };
    return { available: false, error: "That username is already taken." };
  }

  useEffect(() => {
    if (usernameEdited || username.trim()) return;
    setUsername(suggestUsername());
  }, [firstName, lastName, username, usernameEdited]);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(SHOT_TOOLTIP_STORAGE_KEY)
      .then((value) => {
        if (mounted) setShotTooltipSeen(value === "1");
      })
      .catch(() => {
        if (mounted) setShotTooltipSeen(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const nextUsername = normalizeUsername(username);
    if (!nextUsername) {
      setUsernameAvailable(null);
      setUsernameError(null);
      return;
    }
    if (!USERNAME_RE.test(nextUsername)) {
      setUsernameAvailable(false);
      setUsernameChecking(false);
      setUsernameError("Use 3-20 lowercase letters, numbers, or underscores.");
      return;
    }

    setUsernameAvailable(null);
    setUsernameError(null);
    setUsernameChecking(false);

    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setUsernameChecking(true);
      setUsernameError(null);
      const timeoutId = setTimeout(() => controller.abort(), USERNAME_CHECK_TIMEOUT_MS);
      try {
        const result = await checkUsernameAvailability(nextUsername, controller.signal);
        if (cancelled) return;
        setUsernameAvailable(result.available);
        setUsernameError(result.error);
      } catch (error) {
        if (!cancelled) {
          if (ALLOW_DEV_USERNAME_FALLBACK) {
            setUsernameAvailable(true);
            setUsernameError(null);
          } else {
            setUsernameAvailable(false);
            setUsernameError(
              isAbortError(error)
                ? "Username check timed out. Check your connection and try again."
                : USERNAME_CHECK_UNAVAILABLE_MESSAGE,
            );
          }
        }
      } finally {
        clearTimeout(timeoutId);
        if (!cancelled) setUsernameChecking(false);
      }
    }, USERNAME_CHECK_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [username]);

  function toggleInterest(interest: string) {
    setSelectedInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : prev.length < 15 ? [...prev, interest] : prev
    );
  }

  function toggleDatingComfort(value: string) {
    setDatingComforts((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : prev.length < 3 ? [...prev, value] : prev,
    );
  }

  function dismissShotTooltip() {
    setShotTooltipSeen(true);
    void AsyncStorage.setItem(SHOT_TOOLTIP_STORAGE_KEY, "1").catch(() => {});
  }

  function addCustomInterest() {
    const t = customInterest.trim();
    if (!t || allInterests.includes(t)) return;
    setAllInterests((prev) => [...prev, t]);
    setSelectedInterests((prev) => prev.length < 15 ? [...prev, t] : prev);
    setCustomInterest("");
  }

  async function requireSessionToken(): Promise<string> {
    const token = await getToken();
    if (!token) {
      throw new Error("Your account is still opening. Please wait a moment, then try again.");
    }
    return token;
  }

  function authHeaders(token: string) {
    return {
      Authorization: `Bearer ${token}`,
      ...(user?.id ? { "X-ConnectSphere-User-Id": user.id } : {}),
    };
  }

  function setBioText(nextBio: string) {
    setBio(nextBio.slice(0, BIO_MAX_LENGTH));
    setBioError(null);
  }

  function addBioStarter(starter: string) {
    const trimmed = bio.trim();
    if (trimmed.includes(starter)) return;
    const nextBio = trimmed ? `${trimmed}\n${starter}` : starter;
    if (nextBio.length > BIO_MAX_LENGTH) {
      setBioError("Your intro is almost full. Trim a little before adding another starter.");
      return;
    }
    setBioText(nextBio);
  }

  function composeLocalBio() {
    const nameCopy = firstName.trim() ? `${firstName.trim()} here, ` : "";
    const location = [city, county].filter(Boolean).join(", ") || "South Florida";
    const interestsCopy =
      selectedInterests.length > 0
        ? selectedInterests.slice(0, 2).join(" + ")
        : intent === "friendship"
          ? "coffee plans + beach walks"
          : "good music + good food";
    const intentCopy =
      intent === "dating"
        ? datingGoal
          ? `${datingGoal.toLowerCase()} energy and easy laughs`
          : "real chemistry and easy laughs"
        : intent === "friendship"
          ? friendshipTypes[0]
            ? `${friendshipTypes[0].toLowerCase()} energy and spontaneous plans`
            : "new friends and spontaneous plans"
          : "dating, friendship, and plans that actually happen";

    return `${nameCopy}${location} days, ${interestsCopy}, and main-character energy 🌴 Here for ${intentCopy} ✨`
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, BIO_MAX_LENGTH);
  }

  async function generateBio() {
    if (bioGenerating) return;
    setBioGenerating(true);
    setBioError(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), BIO_GENERATE_TIMEOUT_MS);
      const goal =
        intent === "dating" ? [datingGoal, firstDateStyle, datingEnergy].filter(Boolean).join(", ") :
        intent === "friendship" ? friendshipTypes.join(", ") :
        "dating and friendship";
      const location = [city, county].filter(Boolean).join(", ") || "South Florida";
      const whoYouAre = [
        firstName.trim() ? `My name is ${firstName.trim()}` : "",
        selectedInterests.length > 0 ? `I am into ${selectedInterests.slice(0, 6).join(", ")}` : "",
        location ? `I am around ${location}` : "",
      ].filter(Boolean).join(". ");

      try {
        const token = await requireSessionToken();
        const response = await fetch(apiUrl("/api/bio/generate"), {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(token),
          },
          body: JSON.stringify({
            firstName: firstName.trim() || undefined,
            whoYouAre,
            whyHere: goal || undefined,
            intent: intent || undefined,
            location,
            interests: selectedInterests,
          }),
        });

        const payload = await response.json().catch(() => ({})) as { bio?: string; error?: string };
        if (response.ok && payload.bio) {
          setBioText(payload.bio);
          setBioGeneratedOnce(true);
          return;
        }
      } catch {
        // Local generation keeps onboarding moving in Expo Go when the API or AI provider is unavailable.
      } finally {
        clearTimeout(timeoutId);
      }

      setBioText(composeLocalBio());
      setBioGeneratedOnce(true);
    } catch (err) {
      setBioText(composeLocalBio());
      setBioGeneratedOnce(true);
    } finally {
      setBioGenerating(false);
    }
  }

  // ── Step 6 — Photos ─────────────────────────────────────────────────────────
  // 3 slots total: slot 0 = main, slots 1-2 = additional
  const [photoUris, setPhotoUris] = useState<(string | null)[]>([null, null, null]);
  const [photoBase64s, setPhotoBase64s] = useState<(string | null)[]>([null, null, null]);
  // URLs already uploaded to object storage — available immediately in handleFinish
  const [photoStorageUrls, setPhotoStorageUrls] = useState<(string | null)[]>([null, null, null]);
  const [photoUploading, setPhotoUploading] = useState<boolean[]>([false, false, false]);

  async function pickPhoto(slot: number) {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Please allow access to your photo library.");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      quality: PHOTO_PICKER_QUALITY,
      allowsEditing: slot === 0,
      aspect: slot === 0 ? [1, 1] : undefined,
      base64: true,
    });
    if (picked.canceled || !picked.assets?.[0]) return;
    const uri = picked.assets[0].uri;
    const b64 = picked.assets[0].base64 ?? null;

    // Update local URI immediately so the image shows right away
    setPhotoUris((prev) => { const copy = [...prev]; copy[slot] = uri; return copy; });
    setPhotoBase64s((prev) => { const copy = [...prev]; copy[slot] = b64; return copy; });
    // Clear any previous storage URL for this slot
    setPhotoStorageUrls((prev) => { const copy = [...prev]; copy[slot] = null; return copy; });

    // Upload to object storage immediately in the background
    setPhotoUploading((prev) => { const copy = [...prev]; copy[slot] = true; return copy; });
    const _controller = new AbortController();
    const timeoutId = setTimeout(() => _controller.abort(), PHOTO_UPLOAD_TIMEOUT_MS);
    try {
      let base64: string;
      if (b64) {
        base64 = b64;
      } else {
        base64 = await withTimeout(
          FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 }),
          PHOTO_UPLOAD_TIMEOUT_MS,
        );
      }
      const runtime = getFirebaseRuntime();
      if (!runtime) {
        if (slot === 0) {
          void user?.setProfileImage({ file: { uri, type: "image/jpeg", name: "profile.jpg" } as unknown as File })
            .then(() => user?.reload())
            .catch(() => {});
        }
        return;
      }

      // Upload directly to Firebase Storage
      const { getStorage: _gs, ref: _ref, uploadBytes: _ub, getDownloadURL: _gdl } = await import("firebase/storage");
      const _storage = _gs(runtime.app);
      const _fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
      const _uid = user?.id ?? "unknown";
      const _photoRef = _ref(_storage, `photos/${_uid}/${_fileName}`);
      const _binary = atob(base64);
      const _bytes = new Uint8Array(_binary.length);
      for (let i = 0; i < _binary.length; i++) _bytes[i] = _binary.charCodeAt(i);
      await _ub(_photoRef, _bytes, { contentType: "image/jpeg" });
      const url = await _gdl(_photoRef);
      if (url) {
        setPhotoStorageUrls((prev) => { const copy = [...prev]; copy[slot] = url; return copy; });
        setPhotoUploading((prev) => { const copy = [...prev]; copy[slot] = false; return copy; });
        // Sync main photo as Clerk profile image too
        if (slot === 0) {
          void user?.setProfileImage({ file: { uri, type: "image/jpeg", name: "profile.jpg" } as unknown as File })
            .then(() => user?.reload())
            .catch(() => {});
        }
      }
    } catch (err) {
      console.error("[pickPhoto] upload error:", err);
    } finally {
      clearTimeout(timeoutId);
      setPhotoUploading((prev) => { const copy = [...prev]; copy[slot] = false; return copy; });
    }
  }

  function removePhoto(slot: number) {
    setPhotoUris((prev) => { const copy = [...prev]; copy[slot] = null; return copy; });
    setPhotoBase64s((prev) => { const copy = [...prev]; copy[slot] = null; return copy; });
    setPhotoStorageUrls((prev) => { const copy = [...prev]; copy[slot] = null; return copy; });
  }

  const uploadedPhotoCount = photoUris.filter(Boolean).length;
  const anyPhotoUploading = photoUploading.some(Boolean);
  const missingRequiredPhotos = Math.max(0, REQUIRED_PROFILE_PHOTOS - uploadedPhotoCount);
  const canContinuePhotos = uploadedPhotoCount >= REQUIRED_PROFILE_PHOTOS;

  // ── Step 7 — Photos animations ────────────────────────────────────────────────
  const photoSlotEnter       = useRef([0,1,2].map(() => new Animated.Value(0.8))).current;
  const photoSlotGlow        = useRef([0,1,2].map(() => new Animated.Value(0))).current;
  const photoSlotPromptFade  = useRef([0,1,2].map(() => new Animated.Value(1))).current;
  const photoPingAnim        = useRef(new Animated.Value(1)).current;
  const continueBarAnim      = useRef(new Animated.Value(0)).current;
  const prevPhotoUrisRef     = useRef<(string | null)[]>([null,null,null]);

  // ── Step 8 — Transition celebration ──────────────────────────────────────────
  const transitionIconScale = useRef(new Animated.Value(0)).current;
  const transitionIconOpacity = useRef(new Animated.Value(0)).current;

  // 9-emoji burst — uniform 64px, 3×3 grid with generous spacing
  const EMOJI_CLUSTER = [
    // Row 0 — shifted down 36px so top emoji aren't clipped
    { emoji: "😁", top:  36, left:   8, size: 64, finalRot: -8 },
    { emoji: "🌟", top:  34, left: 108, size: 64, finalRot:  3 },
    { emoji: "🤩", top:  38, left: 208, size: 64, finalRot: 12 },
    // Row 1
    { emoji: "💖", top: 134, left:   8, size: 64, finalRot: -5 },
    { emoji: "🥳", top: 132, left: 108, size: 64, finalRot:  0 },
    { emoji: "🎉", top: 136, left: 208, size: 64, finalRot:-10 },
    // Row 2
    { emoji: "😍", top: 232, left:   8, size: 64, finalRot:  6 },
    { emoji: "✨", top: 234, left: 108, size: 64, finalRot: -4 },
    { emoji: "🥂", top: 230, left: 208, size: 64, finalRot: 10 },
  ] as const;
  const emojiAnims = useRef(
    EMOJI_CLUSTER.map((e) => ({
      scale:    new Animated.Value(0),
      rotation: new Animated.Value(e.finalRot * -2), // start from opposite tilt
    }))
  ).current;

  useEffect(() => {
    if (step === 10) {
      transitionIconScale.setValue(0);
      transitionIconOpacity.setValue(0);
      // Reset emoji refs
      emojiAnims.forEach((a, i) => {
        a.scale.setValue(0);
        a.rotation.setValue(EMOJI_CLUSTER[i].finalRot * -2);
      });
      Animated.parallel([
        // Container-level pop: scales the whole burst as a unit
        Animated.spring(transitionIconScale, { toValue: 1, useNativeDriver: true, bounciness: 14, speed: 8 }),
        Animated.timing(transitionIconOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        // Staggered emoji springs — 60 ms apart, each pop-in independently
        ...emojiAnims.map((a, i) =>
          Animated.sequence([
            Animated.delay(i * 60),
            Animated.parallel([
              Animated.spring(a.scale, { toValue: 1, useNativeDriver: true, bounciness: 20, speed: 7 }),
              Animated.spring(a.rotation, { toValue: EMOJI_CLUSTER[i].finalRot, useNativeDriver: true, bounciness: 14, speed: 8 }),
            ]),
          ])
        ),
      ]).start();
    }
  }, [step]);

  // Photo step: staggered entrance + badge ping loop
  useEffect(() => {
    if (step !== 9) return;
    continueBarAnim.setValue(0);
    photoSlotEnter.forEach((a) => a.setValue(0.8));
    Animated.stagger(60, photoSlotEnter.map((a) =>
      Animated.spring(a, { toValue: 1, useNativeDriver: true, bounciness: 14, speed: 9 })
    )).start();
    const pingLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(photoPingAnim, { toValue: 0.2, duration: 700, useNativeDriver: true }),
        Animated.timing(photoPingAnim, { toValue: 1,   duration: 700, useNativeDriver: true }),
      ])
    );
    pingLoop.start();
    return () => pingLoop.stop();
  }, [step]);

  // Photo step: reward pop + glow flash on add; fade prompt back in on remove; pop Continue bar
  useEffect(() => {
    if (canContinuePhotos) {
      Animated.spring(continueBarAnim, { toValue: 1, useNativeDriver: true, bounciness: 14, speed: 10 }).start();
    } else {
      Animated.timing(continueBarAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    }
    photoUris.forEach((uri, i) => {
      const wasSet = !!prevPhotoUrisRef.current[i];
      const isSet  = !!uri;
      if (isSet && !wasSet) {
        // Photo added — scale pop
        Animated.sequence([
          Animated.spring(photoSlotEnter[i], { toValue: 1.09, useNativeDriver: true, bounciness: 22, speed: 16 }),
          Animated.spring(photoSlotEnter[i], { toValue: 1,    useNativeDriver: true, bounciness: 10, speed: 12 }),
        ]).start();
        // Glow flash (pink overlay opacity: 0→0.45→0)
        photoSlotGlow[i].setValue(0);
        Animated.sequence([
          Animated.timing(photoSlotGlow[i], { toValue: 0.45, duration: 120, useNativeDriver: true }),
          Animated.timing(photoSlotGlow[i], { toValue: 0,    duration: 380, useNativeDriver: true }),
        ]).start();
        // Hide prompt immediately when photo fills slot
        photoSlotPromptFade[i].setValue(0);
      } else if (!isSet && wasSet) {
        // Photo removed — fade prompt back in
        photoSlotPromptFade[i].setValue(0);
        Animated.timing(photoSlotPromptFade[i], { toValue: 1, duration: 300, useNativeDriver: true }).start();
      }
    });
    prevPhotoUrisRef.current = [...photoUris];
  }, [canContinuePhotos, photoUris]);

  // ── Step 9 — Liveness verification ──────────────────────────────────────────
  const [showLiveness, setShowLiveness] = useState(false);
  const [verifyDone, setVerifyDone] = useState(false);
  const verifyCheckScale = useRef(new Animated.Value(0)).current;
  const verifyCheckOpacity = useRef(new Animated.Value(0)).current;

  function animateVerifySuccess() {
    Animated.parallel([
      Animated.spring(verifyCheckScale, { toValue: 1, useNativeDriver: true, bounciness: 14 }),
      Animated.timing(verifyCheckOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  }

  function handleLivenessSuccess() {
    setShowLiveness(false);
    setVerifyDone(true);
    animateVerifySuccess();
    setTimeout(() => handleNext(), 1400);
  }

  function handleLivenessCancel() {
    setShowLiveness(false);
  }

  // ── Step 8 — Permissions ────────────────────────────────────────────────────
  const [county, setCounty] = useState<"Miami-Dade" | "Broward" | "">("");
  const [city, setCity] = useState("");
  const [locationVisibility, setLocationVisibility] = useState<"hidden" | "fuzzy" | "active">("fuzzy");
  const [communityCodeAccepted, setCommunityCodeAccepted] = useState(false);
  const [notificationsOn, setNotificationsOn] = useState(false);

  const cityOptions = county === "Miami-Dade" ? MIAMI_DADE_CITIES : county === "Broward" ? BROWARD_CITIES : [];

  async function requestNotificationTogglePermission() {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      setNotificationsOn(status === "granted");
    } catch {
      setNotificationsOn(false);
    }
  }

  function handleNotificationsToggle(value: boolean) {
    if (!value) {
      setNotificationsOn(false);
      return;
    }

    Alert.alert(
      "Turn on notifications?",
      "Get alerts when someone likes, matches, or messages you.",
      [
        { text: "Don't Allow", style: "cancel", onPress: () => setNotificationsOn(false) },
        { text: "Allow", onPress: requestNotificationTogglePermission },
      ],
    );
  }

  // ── Celebration flash ────────────────────────────────────────────────────────
  const celebAnim = useRef(new Animated.Value(0)).current;
  const [loading, setLoading] = useState(false);

  // ── Progress restore ─────────────────────────────────────────────────────────
  useEffect(() => {
    const saved = user?.unsafeMetadata?.onboardingProgress as Record<string, unknown> | undefined;
    if (!saved) return;
    if (typeof saved.step === "number") {
      // Sync both state and the ref so goToStep() never re-runs from step 1
      setStep(saved.step);
      stepRef.current = saved.step;
    }
    if (typeof saved.firstName === "string") setFirstName(saved.firstName);
    if (typeof saved.lastName === "string") setLastName(saved.lastName);
    if (typeof saved.dobMonth === "string") setDobMonth(saved.dobMonth);
    if (typeof saved.dobDay === "string") setDobDay(saved.dobDay);
    if (typeof saved.dobYear === "string") setDobYear(saved.dobYear);
    if (typeof saved.gender === "string") setGender(saved.gender);
    if (typeof saved.showGenderOnProfile === "boolean") setShowGenderOnProfile(saved.showGenderOnProfile);
    if (typeof saved.lookingForGender === "string") setLookingForGender(saved.lookingForGender);
    if (typeof saved.intent === "string") setIntent(saved.intent === "networking" ? "friendship" : saved.intent);
    if (typeof saved.datingGoal === "string") setDatingGoal(saved.datingGoal);
    if (typeof saved.firstDateStyle === "string") setFirstDateStyle(saved.firstDateStyle);
    if (typeof saved.datingEnergy === "string") setDatingEnergy(saved.datingEnergy);
    if (Array.isArray(saved.datingComforts)) setDatingComforts(saved.datingComforts as string[]);
    if (Array.isArray(saved.friendshipTypes)) setFriendshipTypes(saved.friendshipTypes as string[]);
    if (Array.isArray(saved.selectedInterests)) setSelectedInterests(saved.selectedInterests as string[]);
    if (typeof saved.username === "string") {
      setUsername(normalizeUsername(saved.username));
      setUsernameEdited(true);
    }
    if (saved.county === "Miami-Dade" || saved.county === "Broward") setCounty(saved.county);
    if (typeof saved.city === "string") setCity(saved.city);
    if (saved.locationVisibility === "hidden" || saved.locationVisibility === "fuzzy" || saved.locationVisibility === "active") setLocationVisibility(saved.locationVisibility as "hidden" | "fuzzy" | "active");
    if (typeof saved.communityCodeAccepted === "boolean") setCommunityCodeAccepted(saved.communityCodeAccepted);
  }, []);

  function saveProgress(opts: { nextStep?: number }) {
    user?.update({
      unsafeMetadata: {
        ...user.unsafeMetadata,
        onboardingProgress: {
          step: opts.nextStep ?? step,
          firstName, lastName,
          dobMonth, dobDay, dobYear,
          gender, showGenderOnProfile,
          lookingForGender,
          intent, datingGoal, firstDateStyle, datingEnergy, datingComforts, friendshipTypes,
          selectedInterests,
          bio,
          username,
          county, city, locationVisibility,
          communityCodeAccepted,
        },
      },
    }).catch(() => {});
  }

  // ── Photo upload ─────────────────────────────────────────────────────────────
  // base64Hint: pre-fetched base64 from the image picker (preferred path).
  // Falls back to reading the file only if base64Hint is not available.
  async function uploadPhoto(uri: string, token: string, base64Hint?: string | null): Promise<string | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PHOTO_UPLOAD_TIMEOUT_MS);
    try {
      let base64: string;
      if (base64Hint) {
        base64 = base64Hint;
      } else if (Platform.OS === "web") {
        const imgRes = await fetch(uri, { signal: controller.signal });
        const blob = await imgRes.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        base64 = btoa(binary);
      } else {
        base64 = await withTimeout(
          FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          }),
          PHOTO_UPLOAD_TIMEOUT_MS,
        );
      }

      const runtime = getFirebaseRuntime();
      if (!runtime) {
        if (user?.imageUrl) return user.imageUrl;
        return uri;
      }

      // Upload directly to Firebase Storage — no backend needed
      const { getStorage, ref: storageRef, uploadBytes, getDownloadURL } = await import("firebase/storage");
      const storage = getStorage(runtime.app);
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
      const uid = user?.id ?? "unknown";
      const photoRef = storageRef(storage, `photos/${uid}/${fileName}`);
      // Decode base64 to Uint8Array for uploadBytes
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      await uploadBytes(photoRef, bytes, { contentType: "image/jpeg" });
      const url = await getDownloadURL(photoRef);
      return url || null;
    } catch (err) {
      console.error("[uploadPhoto] failed:", err);
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ── Navigation handlers ───────────────────────────────────────────────────────
  async function handleNext() {
    if (step === 1) {
      if (!firstName.trim()) {
        Alert.alert("Enter your name", "Please enter your first name to continue.");
        return;
      }
    }
    if (step === 2) {
      const age = computedAge();
      if (age === null) {
        Alert.alert("Enter your birthday", "Please fill in your full date of birth.");
        return;
      }
      if (age < 18) {
        setUnderageDenied(true);
        return;
      }
    }
    if (step === 8) {
      const nextUsername = normalizeUsername(username);
      if (!USERNAME_RE.test(nextUsername)) {
        Alert.alert("Select your @username", "Use 3-20 lowercase letters, numbers, or underscores.");
        return;
      }
      if (usernameAvailable !== true) {
        setUsernameChecking(true);
        setUsernameError(null);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), USERNAME_CHECK_TIMEOUT_MS);
        try {
          const result = await checkUsernameAvailability(nextUsername, controller.signal);
          setUsernameAvailable(result.available);
          setUsernameError(result.error);
          if (!result.available) {
            Alert.alert("Select your @username", result.error ?? "That username is already taken.");
            return;
          }
        } catch (error) {
          if (ALLOW_DEV_USERNAME_FALLBACK) {
            setUsernameAvailable(true);
            setUsernameError(null);
            clearTimeout(timeoutId);
            setUsernameChecking(false);
            if (normalizeUsername(username) !== nextUsername) {
              setUsername(nextUsername);
            }
            const next = step + 1;
            saveProgress({ nextStep: next });
            goToStep(next, 1);
            return;
          }
          const message = isAbortError(error)
            ? "Username check timed out. Make sure the app server is connected, then try again."
            : "Could not check username right now. Try again in a moment.";
          setUsernameAvailable(false);
          setUsernameError(message);
          Alert.alert("Select your @username", message);
          return;
        } finally {
          clearTimeout(timeoutId);
          setUsernameChecking(false);
        }
      }
      if (normalizeUsername(username) !== nextUsername) {
        setUsername(nextUsername);
      }
    }
    if (step === 9) {
      if (!canContinuePhotos) {
        Alert.alert("Add more photos", `Please add ${missingRequiredPhotos} more ${missingRequiredPhotos === 1 ? "photo" : "photos"} to finish your launch-ready profile.`);
        return;
      }
    }
    const next = step + 1;
    saveProgress({ nextStep: next });
    goToStep(next, 1);
  }

  function handleBack() {
    const prev = step - 1;
    saveProgress({ nextStep: prev });
    goToStep(prev, -1);
  }

  // ── Finish ────────────────────────────────────────────────────────────────────
  async function handleFinish() {
    if (!communityCodeAccepted) {
      Alert.alert("Almost there!", "Please accept the ConnectSphere Community Code to continue.");
      return;
    }
    setLoading(true);
    try {
      const token = await withTimeout(requireSessionToken(), FINISH_SAVE_TIMEOUT_MS);

      // Collect uploaded photo URLs — photos are uploaded immediately when picked,
      // so photoStorageUrls[i] is usually already set. If not, try once more now.
      const uploadedPhotos: string[] = [];
      for (let i = 0; i < photoUris.length; i++) {
        const uri = photoUris[i];
        if (!uri) continue;
        const alreadyUploaded = photoStorageUrls[i];
        if (alreadyUploaded) {
          uploadedPhotos.push(alreadyUploaded);
        } else {
          // Photo picked but upload hasn't completed — try once more
          const b64 = photoBase64s[i] ?? null;
          const url = await uploadPhoto(uri, token, b64);
          if (url) {
            uploadedPhotos.push(url);
          }
        }
      }

      if (uploadedPhotoCount > 0 && uploadedPhotos.length === 0) {
        throw new Error("Your photo could not upload. Check your connection and try again.");
      }
      if (uploadedPhotos.length < REQUIRED_PROFILE_PHOTOS) {
        throw new Error(`Add ${REQUIRED_PROFILE_PHOTOS} photos before launching your profile.`);
      }

      const connectionSubtype =
        intent === "dating" ? (datingGoal || undefined) :
        intent === "friendship" ? (friendshipTypes[0] || undefined) :
        intent === "all" ? (datingGoal || friendshipTypes[0] || undefined) :
        undefined;

      const modeData =
          intent === "dating" || intent === "all"
          ? {
              gender,
              lookingFor: lookingForGender,
              datingGoal: datingGoal || undefined,
              firstDateStyle: firstDateStyle || undefined,
              datingEnergy: datingEnergy || undefined,
              comfortBadges: datingComforts,
              ...(intent === "all" ? { friendshipTypes: friendshipTypes.length > 0 ? friendshipTypes : undefined } : {}),
            }
          : intent === "friendship"
          ? { friendshipTypes: friendshipTypes.length > 0 ? friendshipTypes : ["Casual Hangout"] }
          : {};

      // Save profile directly to Firestore — no backend server required
      const profilePayload = {
            firstName: firstName.trim() || null,
            lastName: lastName.trim() || null,
            displayName: [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") || "User",
            username: normalizeUsername(username),
            birthDate: dobIsoString() ?? null,
            gender,
            showGenderOnProfile,
            lookingForGender: intent === "dating" ? lookingForGender : null,
            location: city || county || "South Florida",
            country: "United States",
            intent: intent || "friendship",
            bio: bio.trim() || null,
            interests: selectedInterests,
            photos: uploadedPhotos,
            locationVisibility,
            acceptCommunityCode: communityCodeAccepted,
            connectionSubtype: connectionSubtype ?? null,
            modeData,
            onboardingComplete: true,
      };

      const runtime = getFirebaseRuntime();
      if (runtime) {
        const { doc: _doc, setDoc: _setDoc, serverTimestamp: _serverTimestamp } = await import("firebase/firestore");
        await withTimeout(
          _setDoc(
            _doc(runtime.db, "profiles", user!.id),
            {
              ...profilePayload,
              createdAt: _serverTimestamp(),
              updatedAt: _serverTimestamp(),
            },
            { merge: true },
          ),
          FINISH_SAVE_TIMEOUT_MS,
        );
      }

      if (user) {
        await withTimeout(
          user.update({
            unsafeMetadata: {
              ...user.unsafeMetadata,
              onboardingComplete: true,
              onboardingProgress: null,
              launchProfile: profilePayload,
            },
          }),
          FINISH_SAVE_TIMEOUT_MS,
        );
        await withTimeout(user.reload(), FINISH_SAVE_TIMEOUT_MS);
      }

      const friendInviteToken = Array.isArray(params.friendInviteToken) ? params.friendInviteToken[0] : params.friendInviteToken;
      if (friendInviteToken && user?.id) {
        await acceptFriendInvite(friendInviteToken, user.id).catch(() => null);
      }

      // Consume pending referral code (set by invite/[code].tsx deep link before sign-up)
      try {
        const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
        const pendingCode = await AsyncStorage.getItem("cs:pendingReferralCode");
        if (pendingCode && user?.id) {
          const { getFirestore, doc, setDoc, serverTimestamp } = await import("firebase/firestore");
          const { getApp } = await import("firebase/app");
          const db = getFirestore(getApp());
          await setDoc(
            doc(db, "referrals", pendingCode, "uses", user.id),
            { userId: user.id, createdAt: serverTimestamp() },
            { merge: true },
          );
          await AsyncStorage.removeItem("cs:pendingReferralCode");
        }
      } catch {
        // Non-fatal — referral credit can be applied manually if needed
      }

      // Register Expo push token if user enabled notifications.
      // Fire-and-forget — never block the success navigation.
      if (notificationsOn && user?.id) {
        requestNotificationPermission()
          .then(async (expoPushToken) => {
            if (!expoPushToken) return;
            const tok = await requireSessionToken().catch(() => null);
            if (!tok) return;
            await fetch(apiUrl("/api/users/push-token"), {
              method: "POST",
              headers: { "Content-Type": "application/json", ...authHeaders(tok) },
              body: JSON.stringify({ token: expoPushToken }),
            }).catch(() => undefined);
          })
          .catch(() => undefined);
      }

      // Celebration flash → navigate
      Animated.sequence([
        Animated.timing(celebAnim, { toValue: 0.55, duration: 220, useNativeDriver: true }),
        Animated.timing(celebAnim, { toValue: 0, duration: 480, useNativeDriver: true }),
      ]).start(() => router.replace("/success"));
    } catch (e) {
      const msg = isAbortError(e)
        ? "Saving your profile is taking too long. Check your connection and try again."
        : e instanceof Error ? e.message : "Something went wrong. Please try again.";
      Alert.alert("Couldn't save profile", msg);
    } finally {
      setLoading(false);
    }
  }

  // ── Underage screen ───────────────────────────────────────────────────────────
  if (underageDenied) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000", paddingTop: topInset, paddingBottom: bottomInset, justifyContent: "center", paddingHorizontal: 28 }}>
        <AnimatedBackground />
        <View style={{ alignItems: "center", gap: 20 }}>
          <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: "rgba(255,41,155,0.15)", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "rgba(255,41,155,0.4)" }}>
            <Ionicons name="shield-outline" size={38} color={PINK} />
          </View>
          <Text style={{ fontSize: 30, fontFamily: "Inter_700Bold", color: "#fff", textAlign: "center" }}>
            ConnectSphere is{" "}
            <Text style={{ color: PINK }}>18+ only</Text>
          </Text>
          <Text style={{ fontSize: 15, lineHeight: 24, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)", textAlign: "center" }}>
            You must be at least 18 years old. Come back when you're 18 — we'll be here.
          </Text>
          <View style={{ alignSelf: "stretch", marginTop: 8 }}>
            <PinkButton
              label="Sign out"
              onPress={async () => { await signOut(); router.replace("/(auth)/welcome"); }}
            />
          </View>
        </View>
      </View>
    );
  }

  // ── Step validations for button state ────────────────────────────────────────
  const canAdvance =
    step === 1 ? firstName.trim().length > 0 :
    step === 2 ? (computedAge() ?? 0) >= 18 :
    step === 3 ? gender.length > 0 :
    step === 4 ? (
      intent === "dating" ? datingGoal.length > 0 :
      intent === "friendship" ? friendshipTypes.length > 0 :
      intent === "all" ? datingGoal.length > 0 && friendshipTypes.length > 0 :
      false
    ) :
    step === 5 ? lookingForGender.length > 0 :
    step === 6 ? selectedInterests.length >= 3 :
    step === 7 ? true :
    step === 8 ? USERNAME_RE.test(username) && !usernameChecking :
    step === 9 ? canContinuePhotos :
    step === 10 ? true :
    step === 11 ? true :
    communityCodeAccepted;

  const isLastStep = step === TOTAL_STEPS;

  // ── Progress bar glow ─────────────────────────────────────────────────────────
  const progressPct = step / TOTAL_STEPS;

  return (
    <Animated.View style={{ flex: 1, backgroundColor: "#000", paddingTop: topInset, paddingBottom: bottomInset, opacity: mountFade }}>
      <AnimatedBackground />

      {/* Pink accent line at very top */}
      <LinearGradient
        colors={[PINK, PURPLE]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ height: 2, position: "absolute", top: 0, left: 0, right: 0 }}
      />

      {/* ── Header bar ── */}
      <View style={s.header}>
        {step > 1 && step !== 10 ? (
          <Pressable onPress={handleBack} style={s.backBtn} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </Pressable>
        ) : <View style={{ width: 38 }} />}
        <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, fontFamily: "Inter_500Medium" }}>
          {step} of {TOTAL_STEPS}
        </Text>
        {step === 11 && !isLastStep ? (
          <Pressable onPress={handleNext} hitSlop={12} style={{ paddingHorizontal: 4 }}>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, fontFamily: "Inter_600SemiBold" }}>Skip</Text>
          </Pressable>
        ) : <View style={{ width: 38 }} />}
      </View>

      {/* ── Progress bar ── */}
      <View style={{ height: 3, marginHorizontal: 24, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 2, marginBottom: 6, overflow: "hidden" }}>
        <View style={{
          height: "100%",
          width: `${progressPct * 100}%`,
          borderRadius: 2,
          backgroundColor: PINK,
          shadowColor: PINK,
          shadowOpacity: 0.9,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 0 },
          elevation: 4,
        }} />
      </View>

      {/* ── Step content ── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
      >
        <Animated.View style={{ flex: 1, transform: [{ translateX: slideAnim }] }}>
          <ScrollView
            contentContainerStyle={s.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >

            {/* ════════════════════════════════════════
                STEP 1 — NAME
            ════════════════════════════════════════ */}
            {step === 1 && (
              <View style={s.stepWrap}>
                <View style={s.badge}>
                  <Ionicons name="person-outline" size={16} color={PINK} />
                  <Text style={s.badgeText}>Let's get started</Text>
                </View>
                <View style={{ gap: 6 }}>
                  <Text style={s.headline}>What's your <Text style={{ color: PINK }}>name?</Text></Text>
                  <Text style={s.sub}>This is how you'll appear to others on ConnectSphere.</Text>
                </View>

                <View style={{ gap: 12 }}>
                  <View style={{ gap: 8 }}>
                    <Text style={s.fieldLabel}>First name</Text>
                    <TextInput
                      style={[s.input, { borderColor: firstName ? PINK : "rgba(255,255,255,0.12)" }]}
                      placeholder="e.g. Sofia"
                      placeholderTextColor="rgba(255,255,255,0.28)"
                      value={firstName}
                      onChangeText={setFirstName}
                      autoCapitalize="words"
                      autoFocus
                      returnKeyType="next"
                    />
                  </View>
                  <View style={{ gap: 8 }}>
                    <Text style={s.fieldLabel}>Last name <Text style={{ opacity: 0.5 }}>(optional)</Text></Text>
                    <TextInput
                      style={[s.input, { borderColor: lastName ? PINK : "rgba(255,255,255,0.12)" }]}
                      placeholder="e.g. Hernandez"
                      placeholderTextColor="rgba(255,255,255,0.28)"
                      value={lastName}
                      onChangeText={setLastName}
                      autoCapitalize="words"
                      returnKeyType="done"
                    />
                  </View>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" }}>
                  <Ionicons name="lock-closed-outline" size={14} color="rgba(255,255,255,0.3)" />
                  <Text style={{ flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.35)", lineHeight: 18 }}>
                    Only your first name is shown to other users.
                  </Text>
                </View>

                <PinkButton label="Continue" onPress={handleNext} disabled={!firstName.trim()} icon="arrow-forward" />
              </View>
            )}

            {/* ════════════════════════════════════════
                STEP 2 — BIRTHDAY
            ════════════════════════════════════════ */}
            {step === 2 && (
              <View style={s.stepWrap}>
                <View style={s.badge}>
                  <Ionicons name="calendar-outline" size={16} color={PINK} />
                  <Text style={s.badgeText}>Verify your age</Text>
                </View>
                <View style={{ gap: 6 }}>
                  <Text style={s.headline}>When's your <Text style={{ color: PINK }}>birthday?</Text></Text>
                  <Text style={s.sub}>ConnectSphere is 18+. Your full birthday is never shown on your profile.</Text>
                </View>

                {/* DOB pickers */}
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {([
                    { field: "month" as const, label: "Month", display: dobMonth ? MONTH_NAMES[parseInt(dobMonth, 10) - 1].slice(0, 3) : "MM", value: dobMonth },
                    { field: "day" as const,   label: "Day",   display: dobDay   ? String(parseInt(dobDay, 10))    : "DD",   value: dobDay },
                    { field: "year" as const,  label: "Year",  display: dobYear  || "YYYY",                                  value: dobYear },
                  ]).map(({ field, label, display, value }) => (
                    <View key={field} style={{ flex: field === "day" ? 1 : 1.25 }}>
                      <Text style={[s.fieldLabel, { marginBottom: 6 }]}>{label}</Text>
                      <Pressable
                        onPress={() => setDobPickerOpen(field)}
                        style={[s.input, { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, borderColor: value ? PINK : "rgba(255,255,255,0.12)" }]}
                      >
                        <Text style={{ color: value ? "#fff" : "rgba(255,255,255,0.3)", fontSize: 16, fontFamily: "Inter_600SemiBold" }}>{display}</Text>
                        <Ionicons name="chevron-down" size={15} color="rgba(255,255,255,0.3)" />
                      </Pressable>
                    </View>
                  ))}
                </View>

                {/* Age feedback pill */}
                {computedAge() !== null && (
                  <View style={{
                    flexDirection: "row", alignItems: "center", gap: 10,
                    padding: 14, borderRadius: 12,
                    backgroundColor: (computedAge() ?? 0) >= 18 ? "rgba(255,41,155,0.12)" : "rgba(220,50,50,0.12)",
                    borderWidth: 1,
                    borderColor: (computedAge() ?? 0) >= 18 ? "rgba(255,41,155,0.4)" : "rgba(220,50,50,0.4)",
                  }}>
                    <Ionicons
                      name={(computedAge() ?? 0) >= 18 ? "checkmark-circle" : "alert-circle"}
                      size={18}
                      color={(computedAge() ?? 0) >= 18 ? PINK : "#E05252"}
                    />
                    <Text style={{ flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: (computedAge() ?? 0) >= 18 ? PINK : "#E05252" }}>
                      {(computedAge() ?? 0) >= 18 ? `You're ${computedAge()} — welcome!` : "You must be 18+ to join."}
                    </Text>
                  </View>
                )}

                <PinkButton
                  label="Continue"
                  onPress={handleNext}
                  disabled={(computedAge() ?? 0) < 18}
                  icon="arrow-forward"
                />

                {/* DOB picker modal */}
                <Modal visible={dobPickerOpen !== null} transparent animationType="fade" onRequestClose={() => setDobPickerOpen(null)}>
                  <Pressable onPress={() => setDobPickerOpen(null)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" }}>
                    <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: "#111", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: bottomInset + 16, paddingTop: 18, maxHeight: "70%", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
                        <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff" }}>
                          Select {dobPickerOpen === "month" ? "Month" : dobPickerOpen === "day" ? "Day" : "Year"}
                        </Text>
                        <Pressable onPress={() => setDobPickerOpen(null)} hitSlop={12}>
                          <Ionicons name="close" size={22} color="rgba(255,255,255,0.4)" />
                        </Pressable>
                      </View>
                      <ScrollView style={{ paddingHorizontal: 8 }} contentContainerStyle={{ paddingVertical: 8 }}>
                        {(dobPickerOpen === "month" ? dobMonthOptions : dobPickerOpen === "day" ? dobDayOptions : dobYearOptions).map((opt) => {
                          const sel = dobPickerOpen === "month" ? dobMonth === opt.value : dobPickerOpen === "day" ? dobDay === opt.value : dobYear === opt.value;
                          return (
                            <Pressable
                              key={opt.value}
                              onPress={() => {
                                if (dobPickerOpen === "month") setDobMonth(opt.value);
                                else if (dobPickerOpen === "day") setDobDay(opt.value);
                                else setDobYear(opt.value);
                                setDobPickerOpen(null);
                              }}
                              style={{ paddingVertical: 14, paddingHorizontal: 16, marginVertical: 2, borderRadius: 10, backgroundColor: sel ? "rgba(255,41,155,0.18)" : "transparent", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                            >
                              <Text style={{ fontSize: 16, fontFamily: sel ? "Inter_700Bold" : "Inter_500Medium", color: sel ? PINK : "#fff" }}>{opt.label}</Text>
                              {sel && <Ionicons name="checkmark" size={18} color={PINK} />}
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </Pressable>
                  </Pressable>
                </Modal>
              </View>
            )}

            {/* ════════════════════════════════════════
                STEP 3 — GENDER
            ════════════════════════════════════════ */}
            {step === 3 && (
              <View style={s.stepWrap}>
                <View style={s.badge}>
                  <Ionicons name="person-circle-outline" size={16} color={PINK} />
                  <Text style={s.badgeText}>Your identity</Text>
                </View>
                <View style={{ gap: 6 }}>
                  <Text style={s.headline}>I am <Text style={{ color: PINK }}>a...</Text></Text>
                  <Text style={s.sub}>Choose what best describes you. You can update this anytime.</Text>
                </View>

                <View style={{ gap: 10 }}>
                  {GENDERS.map((g) => {
                    const sel = gender === g.value;
                    return (
                      <ScalePressable
                        key={g.value}
                        onPress={() => {
                          setGender(sel ? "" : g.value);
                          if (!sel) scheduleAdvance(3);
                        }}
                        style={{
                          flexDirection: "row", alignItems: "center", gap: 14,
                          paddingVertical: 14, paddingHorizontal: 18, borderRadius: 16,
                          backgroundColor: sel ? "rgba(255,41,155,0.15)" : "rgba(255,255,255,0.05)",
                          borderWidth: sel ? 2 : 1,
                          borderColor: sel ? PINK : "rgba(255,255,255,0.1)",
                        }}
                      >
                        <View style={{
                          width: 38, height: 38, borderRadius: 12,
                          backgroundColor: sel ? PINK : "rgba(255,255,255,0.08)",
                          alignItems: "center", justifyContent: "center",
                        }}>
                          <Ionicons name={g.icon} size={19} color={sel ? "#fff" : "rgba(255,255,255,0.5)"} />
                        </View>
                        <Text style={{ flex: 1, fontSize: 16, fontFamily: sel ? "Inter_700Bold" : "Inter_500Medium", color: sel ? PINK : "#fff" }}>
                          {g.value}
                        </Text>
                        <View style={{
                          width: 24, height: 24, borderRadius: 12,
                          borderWidth: sel ? 0 : 1.5,
                          borderColor: "rgba(255,255,255,0.2)",
                          backgroundColor: sel ? PINK : "transparent",
                          alignItems: "center", justifyContent: "center",
                        }}>
                          {sel && <Ionicons name="checkmark" size={14} color="#fff" />}
                        </View>
                      </ScalePressable>
                    );
                  })}
                </View>

                {/* Show on profile — always visible so user doesn't have to scroll */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(255,255,255,0.04)" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Ionicons name={showGenderOnProfile ? "eye-outline" : "eye-off-outline"} size={16} color={showGenderOnProfile ? PINK : "rgba(255,255,255,0.35)"} />
                    <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: "#fff" }}>Show gender on profile</Text>
                  </View>
                  <Switch
                    value={showGenderOnProfile}
                    onValueChange={setShowGenderOnProfile}
                    trackColor={{ false: "rgba(255,255,255,0.1)", true: PINK }}
                    thumbColor="#fff"
                    ios_backgroundColor="rgba(255,255,255,0.12)"
                  />
                </View>
              </View>
            )}

            {/* ════════════════════════════════════════
                STEP 4 — INTENT (I'm looking for...)
            ════════════════════════════════════════ */}
            {step === 4 && (
              <View style={s.stepWrap}>
                <View style={s.badge}>
                  <Ionicons name="compass-outline" size={16} color={PINK} />
                  <Text style={s.badgeText}>What brings you here</Text>
                </View>
                <View style={{ gap: 6 }}>
                  <Text style={s.headline}>I'm looking <Text style={{ color: PINK }}>for...</Text></Text>
                  <Text style={s.sub}>Choose what brings you to ConnectSphere.</Text>
                </View>

                {/* Intent cards */}
                <View style={{ gap: 10 }}>
                  {INTENTS.map((item) => {
                    const sel = intent === item.value;
                    return (
                      <ScalePressable
                        key={item.value}
                        onPress={() => {
                          const nextIntent = sel ? "" : item.value;
                          setIntent(nextIntent);
                          if (nextIntent !== "dating" && nextIntent !== "all") {
                            setDatingGoal("");
                            setFirstDateStyle("");
                            setDatingEnergy("");
                            setDatingComforts([]);
                          }
                          if (nextIntent !== "friendship" && nextIntent !== "all") setFriendshipTypes([]);
                        }}
                        style={{
                          flexDirection: "row", alignItems: "center", gap: 14,
                          padding: 16, borderRadius: 16,
                          backgroundColor: sel ? item.color + "1A" : "rgba(255,255,255,0.04)",
                          borderWidth: sel ? 2 : 1.5,
                          borderColor: sel ? item.color : "rgba(255,255,255,0.1)",
                        }}
                      >
                        <View style={{
                          width: 44, height: 44, borderRadius: 13,
                          backgroundColor: sel ? item.color + "30" : "rgba(255,255,255,0.07)",
                          alignItems: "center", justifyContent: "center",
                        }}>
                          <Ionicons name={item.icon} size={22} color={sel ? item.color : "rgba(255,255,255,0.4)"} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: sel ? item.color : "#fff" }}>{item.label}</Text>
                          <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{item.desc}</Text>
                        </View>
                        {sel ? (
                          <Ionicons name="checkmark-circle" size={20} color={item.color} />
                        ) : (
                          <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.2)" }} />
                        )}
                      </ScalePressable>
                    );
                  })}
                </View>

                {/* Sub-preference for dating */}
                {(intent === "dating" || intent === "all") && (
                  <View style={{ gap: 10 }}>
                    {shouldShowShotTooltip(intent, shotTooltipSeen) ? (
                      <View style={{
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: "rgba(255,41,155,0.36)",
                        backgroundColor: "rgba(255,41,155,0.10)",
                        padding: 14,
                        gap: 10,
                      }}>
                        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                          <View style={{
                            width: 32,
                            height: 32,
                            borderRadius: 12,
                            backgroundColor: "rgba(255,41,155,0.20)",
                            alignItems: "center",
                            justifyContent: "center",
                          }}>
                            <Ionicons name="flash" size={16} color={PINK} />
                          </View>
                          <View style={{ flex: 1, gap: 4 }}>
                            <Text style={{ color: "#fff", fontSize: 14, lineHeight: 20, fontFamily: "Inter_700Bold" }}>
                              Shot
                            </Text>
                            <Text style={{ color: "rgba(255,255,255,0.68)", fontSize: 13, lineHeight: 19, fontFamily: "Inter_400Regular" }}>
                              {SHOT_TOOLTIP_COPY}
                            </Text>
                          </View>
                        </View>
                        <Pressable
                          onPress={dismissShotTooltip}
                          style={{
                            alignSelf: "flex-start",
                            borderRadius: 999,
                            backgroundColor: PINK,
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                          }}
                        >
                          <Text style={{ color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" }}>Got it</Text>
                        </Pressable>
                      </View>
                    ) : null}
                    <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 2, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>What are you looking for?</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {DATING_GOALS.map((dg) => {
                        const sel = datingGoal === dg.value;
                        return (
                          <Pressable
                            key={dg.value}
                            onPress={() => setDatingGoal(sel ? "" : dg.value)}
                            style={{
                              flexDirection: "row", alignItems: "center", gap: 8,
                              borderRadius: 12, borderWidth: 1.5,
                              paddingHorizontal: 14, paddingVertical: 10,
                              backgroundColor: sel ? "rgba(255,41,155,0.15)" : "rgba(255,255,255,0.05)",
                              borderColor: sel ? PINK : "rgba(255,255,255,0.12)",
                            }}
                          >
                            <Ionicons name={dg.icon} size={14} color={sel ? PINK : "rgba(255,255,255,0.4)"} />
                            <Text style={{ fontSize: 13, fontFamily: sel ? "Inter_600SemiBold" : "Inter_400Regular", color: sel ? PINK : "#fff" }}>{dg.label}</Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>

                    <Text style={{ marginTop: 4, fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 2, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>Best first date</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {FIRST_DATE_STYLES.map((style) => {
                        const sel = firstDateStyle === style.value;
                        return (
                          <Pressable
                            key={style.value}
                            onPress={() => setFirstDateStyle(sel ? "" : style.value)}
                            style={{
                              flexDirection: "row", alignItems: "center", gap: 8,
                              borderRadius: 12, borderWidth: 1.5,
                              paddingHorizontal: 14, paddingVertical: 10,
                              backgroundColor: sel ? "rgba(255,41,155,0.15)" : "rgba(255,255,255,0.05)",
                              borderColor: sel ? PINK : "rgba(255,255,255,0.12)",
                            }}
                          >
                            <Ionicons name={style.icon} size={14} color={sel ? PINK : "rgba(255,255,255,0.4)"} />
                            <Text style={{ fontSize: 13, fontFamily: sel ? "Inter_600SemiBold" : "Inter_400Regular", color: sel ? PINK : "#fff" }}>{style.label}</Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>

                    <Text style={{ marginTop: 4, fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 2, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>Your date energy</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {DATING_ENERGIES.map((energy) => {
                        const sel = datingEnergy === energy.value;
                        return (
                          <Pressable
                            key={energy.value}
                            onPress={() => setDatingEnergy(sel ? "" : energy.value)}
                            style={{
                              flexDirection: "row", alignItems: "center", gap: 8,
                              borderRadius: 12, borderWidth: 1.5,
                              paddingHorizontal: 14, paddingVertical: 10,
                              backgroundColor: sel ? "rgba(255,41,155,0.15)" : "rgba(255,255,255,0.05)",
                              borderColor: sel ? PINK : "rgba(255,255,255,0.12)",
                            }}
                          >
                            <Ionicons name={energy.icon} size={14} color={sel ? PINK : "rgba(255,255,255,0.4)"} />
                            <Text style={{ fontSize: 13, fontFamily: sel ? "Inter_600SemiBold" : "Inter_400Regular", color: sel ? PINK : "#fff" }}>{energy.label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    <Text style={{ marginTop: 4, fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 2, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>Comfort preferences</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {DATING_COMFORTS.map((comfort) => {
                        const sel = datingComforts.includes(comfort.value);
                        return (
                          <Pressable
                            key={comfort.value}
                            onPress={() => toggleDatingComfort(comfort.value)}
                            style={{
                              flexDirection: "row", alignItems: "center", gap: 8,
                              borderRadius: 12, borderWidth: 1.5,
                              paddingHorizontal: 14, paddingVertical: 10,
                              backgroundColor: sel ? "rgba(16,185,129,0.14)" : "rgba(255,255,255,0.05)",
                              borderColor: sel ? "#6EE7B7" : "rgba(255,255,255,0.12)",
                            }}
                          >
                            <Ionicons name={comfort.icon} size={14} color={sel ? "#6EE7B7" : "rgba(255,255,255,0.4)"} />
                            <Text style={{ fontSize: 13, fontFamily: sel ? "Inter_600SemiBold" : "Inter_400Regular", color: sel ? "#D1FAE5" : "#fff" }}>{comfort.label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Sub-preference for friendship */}
                {(intent === "friendship" || intent === "all") && (
                  <View style={{ gap: 10 }}>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 2, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>What kind of friend?</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {FRIENDSHIP_TYPES.map((ft) => {
                        const sel = friendshipTypes.includes(ft.value);
                        return (
                          <Pressable
                            key={ft.value}
                            onPress={() => setFriendshipTypes(sel ? [] : [ft.value])}
                            style={{
                              flexDirection: "row", alignItems: "center", gap: 8,
                              borderRadius: 12, borderWidth: 1.5,
                              paddingHorizontal: 14, paddingVertical: 10,
                              backgroundColor: sel ? "rgba(34,211,238,0.15)" : "rgba(255,255,255,0.05)",
                              borderColor: sel ? "#22D3EE" : "rgba(255,255,255,0.12)",
                            }}
                          >
                            <Ionicons name={ft.icon} size={14} color={sel ? "#22D3EE" : "rgba(255,255,255,0.4)"} />
                            <Text style={{ fontSize: 13, fontFamily: sel ? "Inter_600SemiBold" : "Inter_400Regular", color: sel ? "#22D3EE" : "#fff" }}>{ft.label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )}

                <PinkButton
                  label="Continue"
                  onPress={handleNext}
                  disabled={!canAdvance}
                  icon="arrow-forward"
                />
              </View>
            )}

            {step === 7 && (
              <View style={s.stepWrap}>
                <View style={s.badge}>
                  <Ionicons name="pencil-outline" size={16} color={PINK} />
                  <Text style={s.badgeText}>Profile intro</Text>
                </View>
                <View style={{ gap: 6 }}>
                  <Text style={s.headline}>Introduce <Text style={{ color: PINK }}>yourself</Text></Text>
                  <Text style={s.sub}>Make it sound like you. Short, specific, and real.</Text>
                </View>

                <View style={{ gap: 10 }}>
                  <View style={{
                    borderRadius: 18,
                    borderWidth: 1.5,
                    borderColor: bio.length > 0 ? PINK : "rgba(255,255,255,0.12)",
                    backgroundColor: "rgba(255,255,255,0.06)",
                    padding: 14,
                    minHeight: 160,
                  }}>
                    <TextInput
                      style={s.bioInput}
                      placeholder="A little Miami energy, a little real-life you..."
                      placeholderTextColor="rgba(255,255,255,0.28)"
                      value={bio}
                      onChangeText={setBioText}
                      multiline
                      textAlignVertical="top"
                      maxLength={BIO_MAX_LENGTH}
                    />
                    <Text style={[s.bioCounter, { color: bio.length >= BIO_MAX_LENGTH ? PINK : "rgba(255,255,255,0.35)" }]}>
                      {bio.length}/{BIO_MAX_LENGTH}
                    </Text>
                  </View>

                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {BIO_STARTERS.map((starter) => (
                      <ScalePressable key={starter} onPress={() => addBioStarter(starter)} style={s.bioStarterChip}>
                        <Text style={s.bioStarterText}>{starter}</Text>
                      </ScalePressable>
                    ))}
                  </View>
                </View>

                <ScalePressable onPress={generateBio} disabled={bioGenerating} style={s.bioAiCard}>
                  <View style={s.bioAiIcon}>
                    {bioGenerating ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="pencil-outline" size={20} color="#fff" />
                    )}
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={s.bioAiTitle}>
                      {bioGenerating ? "Cooking..." : "Auto generate"}
                    </Text>
                    <Text style={s.bioAiSub}>Uses your answers, then you can edit every word.</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
                </ScalePressable>

                {bioError ? <Text style={s.bioError}>{bioError}</Text> : null}

                <PinkButton
                  label={bio.trim() ? "Continue" : "Skip for now"}
                  onPress={handleNext}
                  icon="arrow-forward"
                />
              </View>
            )}

            {step === 8 && (
              <View style={s.stepWrap}>
                <View style={s.badge}>
                  <Ionicons name="at-outline" size={16} color={PINK} />
                  <Text style={s.badgeText}>Your handle</Text>
                </View>
                <View style={{ gap: 6 }}>
                  <Text style={s.headline}>Select your <Text style={{ color: PINK }}>@username</Text></Text>
                  <Text style={s.sub}>This is how people can find you in Connect. Keep it clean, searchable, and yours.</Text>
                </View>

                <View style={{ gap: 12 }}>
                  <View style={[
                    s.usernameBox,
                    { borderColor: usernameAvailable === true ? PINK : usernameError ? "#ef4444" : "rgba(255,255,255,0.12)" },
                  ]}>
                    <Text style={s.usernameAt}>@</Text>
                    <TextInput
                      style={s.usernameInput}
                      value={username}
                      onChangeText={handleUsernameChange}
                      placeholder="miami_vibe"
                      placeholderTextColor="rgba(255,255,255,0.28)"
                      autoCapitalize="none"
                      autoCorrect={false}
                      maxLength={20}
                    />
                    {usernameChecking ? (
                      <ActivityIndicator size="small" color={PINK} />
                    ) : usernameAvailable === true ? (
                      <Ionicons name="checkmark-circle" size={22} color={PINK} />
                    ) : null}
                  </View>

                  <View style={s.usernameRules}>
                    <Text style={s.usernameRule}>3-20 characters</Text>
                    <Text style={s.usernameRule}>lowercase letters, numbers, underscores</Text>
                    <Text style={s.usernameRule}>unique across ConnectSphere</Text>
                  </View>

                  {usernameError ? <Text style={s.bioError}>{usernameError}</Text> : null}
                </View>

                <PinkButton
                  label="Continue"
                  onPress={handleNext}
                  disabled={!canAdvance || usernameChecking}
                  icon="arrow-forward"
                />
              </View>
            )}

            {/* ════════════════════════════════════════
                STEP 5 — SHOW ME (dating & friends only)
            ════════════════════════════════════════ */}
            {step === 5 && (
              <View style={s.stepWrap}>
                <View style={s.badge}>
                  <Ionicons name="eye-outline" size={16} color={PINK} />
                  <Text style={s.badgeText}>Your preference</Text>
                </View>
                <View style={{ gap: 6 }}>
                  <Text style={s.headline}>Show me <Text style={{ color: PINK }}>...</Text></Text>
                  <Text style={s.sub}>We'll prioritize people matching your preference.</Text>
                </View>

                <View style={{ gap: 12 }}>
                  {PREFERENCES.map((p) => {
                    const sel = lookingForGender === p.value;
                    return (
                      <ScalePressable
                        key={p.value}
                        onPress={() => {
                          setLookingForGender(p.value);
                          scheduleAdvance(5);
                        }}
                        style={{
                          flexDirection: "row", alignItems: "center", gap: 16,
                          padding: 18, borderRadius: 18,
                          backgroundColor: sel ? "rgba(255,41,155,0.15)" : "rgba(255,255,255,0.05)",
                          borderWidth: sel ? 2 : 1.5,
                          borderColor: sel ? PINK : "rgba(255,255,255,0.1)",
                        }}
                      >
                        <LinearGradient
                          colors={sel ? [PINK, ROSE] : ["rgba(255,255,255,0.08)", "rgba(255,255,255,0.04)"]}
                          style={{ width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" }}
                        >
                          <Ionicons name={p.icon} size={22} color={sel ? "#fff" : "rgba(255,255,255,0.45)"} />
                        </LinearGradient>
                        <Text style={{ flex: 1, fontSize: 18, fontFamily: "Inter_700Bold", color: sel ? PINK : "#fff" }}>
                          {p.value}
                        </Text>
                        {sel ? (
                          <Ionicons name="checkmark-circle" size={22} color={PINK} />
                        ) : (
                          <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.2)" }} />
                        )}
                      </ScalePressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ════════════════════════════════════════
                STEP 6 — INTERESTS
            ════════════════════════════════════════ */}
            {step === 6 && (
              <View style={s.stepWrap}>
                <View style={s.badge}>
                  <Ionicons name="heart-outline" size={16} color={PINK} />
                  <Text style={s.badgeText}>Your vibe</Text>
                </View>
                <View style={{ gap: 6 }}>
                  <Text style={s.headline}>My <Text style={{ color: PINK }}>interests are...</Text></Text>
                  <Text style={s.sub}>Pick at least 3 so we can match you with people who share your energy.</Text>
                </View>

                <View style={{ gap: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 2, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>Interests</Text>
                    <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: selectedInterests.length >= 3 ? PINK : "rgba(255,255,255,0.35)" }}>
                      {selectedInterests.length}/3 min
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {allInterests.map((interest) => {
                      const sel = selectedInterests.includes(interest);
                      return (
                        <ScalePressable
                          key={interest}
                          onPress={() => toggleInterest(interest)}
                          style={{
                            borderRadius: 24, borderWidth: 1.5,
                            paddingHorizontal: 16, paddingVertical: 8,
                            backgroundColor: sel ? PINK : "rgba(255,255,255,0.05)",
                            borderColor: sel ? PINK : "rgba(255,255,255,0.12)",
                          }}
                        >
                          <Text style={{ fontSize: 14, fontFamily: sel ? "Inter_600SemiBold" : "Inter_500Medium", color: sel ? "#fff" : "rgba(255,255,255,0.7)" }}>
                            {interest}
                          </Text>
                        </ScalePressable>
                      );
                    })}
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TextInput
                      style={[s.input, { flex: 1, borderColor: "rgba(255,255,255,0.12)" }]}
                      placeholder="Add your own..."
                      placeholderTextColor="rgba(255,255,255,0.28)"
                      value={customInterest}
                      onChangeText={setCustomInterest}
                      onSubmitEditing={addCustomInterest}
                      returnKeyType="done"
                      maxLength={30}
                    />
                    <Pressable
                      onPress={addCustomInterest}
                      disabled={!customInterest.trim()}
                      style={{ paddingHorizontal: 18, borderRadius: 12, backgroundColor: customInterest.trim() ? PINK : "rgba(255,255,255,0.08)", justifyContent: "center", height: 50 }}
                    >
                      <Ionicons name="add" size={22} color="#fff" />
                    </Pressable>
                  </View>
                </View>

                <PinkButton
                  label="Continue"
                  onPress={handleNext}
                  disabled={!canAdvance}
                  icon="arrow-forward"
                />
              </View>
            )}

            {/* ════════════════════════════════════════
                STEP 9 — CELEBRATION TRANSITION
            ════════════════════════════════════════ */}
            {step === 10 && (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingTop: 0, paddingBottom: 48 }}>
                {/* Emoji cluster */}
                <Animated.View style={{
                  width: 280, height: 302,
                  transform: [{ scale: transitionIconScale }],
                }}>
                  {EMOJI_CLUSTER.map((item, i) => (
                    <Animated.View
                      key={i}
                      style={{
                        position: "absolute",
                        top: item.top,
                        left: item.left,
                        width: item.size,
                        height: item.size,
                        transform: [
                          { scale: emojiAnims[i].scale },
                          {
                            rotate: emojiAnims[i].rotation.interpolate({
                              inputRange: [-30, 30],
                              outputRange: ["-30deg", "30deg"],
                            }),
                          },
                        ],
                      }}
                    >
                      {Platform.OS === "web" ? (
                        <Image
                          source={{ uri: appleEmojiUrl(item.emoji) }}
                          style={{ width: item.size, height: item.size }}
                          resizeMode="contain"
                        />
                      ) : (
                        <Text style={{ fontSize: item.size, lineHeight: item.size + 4 }}>
                          {item.emoji}
                        </Text>
                      )}
                    </Animated.View>
                  ))}
                </Animated.View>

                {/* Headline — sits directly under the cluster */}
                <Animated.View style={{ opacity: transitionIconOpacity, alignItems: "center", gap: 8, marginTop: 2 }}>
                  <Text style={{ fontSize: 46, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: -1 }}>
                    Great!
                  </Text>
                  <Text style={{ fontSize: 19, fontFamily: "Inter_600SemiBold", color: PINK, textAlign: "center" }}>
                    You're almost done.
                  </Text>
                  <Text style={{ fontSize: 15, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)", textAlign: "center", lineHeight: 22, maxWidth: 280 }}>
                    Last step — a quick selfie to verify it's really you.
                  </Text>
                </Animated.View>

                {/* Fixed gap between text and button */}
                <View style={{ height: 20 }} />

                {/* CTA button */}
                <Animated.View style={{ opacity: transitionIconOpacity, width: "100%" }}>
                  <PinkButton
                    label="Verify Face"
                    onPress={handleNext}
                    icon="scan-circle-outline"
                  />
                </Animated.View>
              </View>
            )}

            {/* ════════════════════════════════════════
                STEP 8 — PHOTOS
            ════════════════════════════════════════ */}
            {step === 9 && (() => {
              const heroH = 270;
              const colW = (WINDOW_WIDTH - 48 - 10) / 2;
              const colH = Math.round(colW * 4 / 3);
              return (
                <View style={s.stepWrap}>

                  {/* ── Social proof badge with live ping dot ── */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 2 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: PINK, alignItems: "center", justifyContent: "center" }}>
                      <Animated.View style={{
                        position: "absolute",
                        width: 16, height: 16, borderRadius: 8,
                        backgroundColor: PINK,
                        opacity: photoPingAnim,
                      }} />
                    </View>
                    <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.65)", flexShrink: 1 }}>
                      Profiles with 3+ photos get{" "}
                      <Text style={{ color: PINK, fontFamily: "Inter_700Bold" }}>6× more matches</Text>
                    </Text>
                  </View>

                  {/* ── Headline ── */}
                  <View style={{ gap: 6 }}>
                    <Text style={s.headline}>
                      Show the <Text style={{ color: PINK }}>real you</Text> ✨
                    </Text>
                    <Text style={s.sub}>
                      {anyPhotoUploading
                        ? "Uploading your photo — almost ready…"
                        : missingRequiredPhotos > 0
                          ? `Your first photo is your profile cover. Add ${missingRequiredPhotos} more ${missingRequiredPhotos === 1 ? "photo" : "photos"} to continue.`
                          : "Your profile has enough photos to launch."}
                    </Text>
                  </View>

                  {/* ── Hero slot (main photo) ── */}
                  <Animated.View style={{ transform: [{ scale: photoSlotEnter[0] }] }}>
                    <ScalePressable
                      onPress={() => photoUris[0] ? removePhoto(0) : pickPhoto(0)}
                      style={{ borderRadius: 24, overflow: "hidden" }}
                    >
                      <View style={{
                        height: heroH, borderRadius: 24, overflow: "hidden",
                        backgroundColor: photoUris[0] ? "transparent" : "rgba(255,41,155,0.07)",
                        borderWidth: 2,
                        borderColor: photoUris[0] ? "transparent" : "rgba(255,41,155,0.4)",
                        borderStyle: "dashed",
                        alignItems: "center", justifyContent: "center",
                      }}>
                        {photoUris[0] ? (
                          <>
                            <Image source={{ uri: photoUris[0] }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                            <LinearGradient
                              colors={["transparent", "rgba(0,0,0,0.6)"]}
                              style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 90, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}
                            />
                            <View style={{ position: "absolute", bottom: 14, left: 14, flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <View style={{
                                backgroundColor: photoUploading[0] ? "rgba(0,0,0,0.6)" : PINK, borderRadius: 20,
                                paddingHorizontal: 10, paddingVertical: 5,
                                flexDirection: "row", alignItems: "center", gap: 5,
                              }}>
                                {photoUploading[0] ? (
                                  <>
                                    <ActivityIndicator size="small" color="#fff" style={{ transform: [{ scale: 0.7 }] }} />
                                    <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" }}>Uploading…</Text>
                                  </>
                                ) : photoStorageUrls[0] ? (
                                  <>
                                    <Ionicons name="checkmark-circle" size={14} color="#fff" />
                                    <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" }}>Main Photo</Text>
                                  </>
                                ) : (
                                  <>
                                    <Text style={{ fontSize: 13 }}>✦</Text>
                                    <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" }}>Main Photo</Text>
                                  </>
                                )}
                              </View>
                            </View>
                            {!photoUploading[0] && (
                              <View style={{
                                position: "absolute", top: 12, right: 12,
                                backgroundColor: "rgba(0,0,0,0.65)", borderRadius: 20, padding: 8,
                              }}>
                                <Ionicons name="close" size={18} color="#fff" />
                              </View>
                            )}
                          </>
                        ) : (
                          <Animated.View style={{ alignItems: "center", gap: 16, opacity: photoSlotPromptFade[0] }}>
                            <LinearGradient
                              colors={[PINK, ROSE]}
                              style={{ width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center",
                                shadowColor: PINK, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12 }}
                            >
                              <Ionicons name="camera" size={38} color="#fff" />
                            </LinearGradient>
                            <View style={{ alignItems: "center", gap: 6 }}>
                              <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff" }}>
                                {SLOT_PROMPTS[0].label} {SLOT_PROMPTS[0].emoji}
                              </Text>
                              <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.4)", textAlign: "center" }}>
                                Tap to add your main photo
                              </Text>
                            </View>
                          </Animated.View>
                        )}
                        {/* Pink glow flash overlay */}
                        <Animated.View style={{
                          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                          borderRadius: 24, backgroundColor: PINK,
                          opacity: photoSlotGlow[0],
                        }} pointerEvents="none" />
                      </View>
                    </ScalePressable>
                  </Animated.View>

                  {/* ── 2-column row for slots 1 & 2 ── */}
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    {[1, 2].map((i) => {
                      const uri = photoUris[i];
                      const prompt = SLOT_PROMPTS[i];
                      return (
                        <Animated.View key={i} style={{ flex: 1, transform: [{ scale: photoSlotEnter[i] }] }}>
                          <ScalePressable
                            onPress={() => uri ? removePhoto(i) : pickPhoto(i)}
                            style={{ borderRadius: 18, overflow: "hidden" }}
                          >
                            <View style={{
                              height: colH, borderRadius: 18, overflow: "hidden",
                              backgroundColor: uri ? "transparent" : "rgba(255,41,155,0.05)",
                              borderWidth: 1.5,
                              borderColor: uri ? "transparent" : "rgba(255,41,155,0.28)",
                              borderStyle: "dashed",
                              alignItems: "center", justifyContent: "center",
                            }}>
                              {uri ? (
                                <>
                                  <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                                  {photoUploading[i] ? (
                                    <View style={{
                                      position: "absolute", top: 8, right: 8,
                                      backgroundColor: "rgba(0,0,0,0.65)", borderRadius: 14,
                                      width: 28, height: 28, alignItems: "center", justifyContent: "center",
                                    }}>
                                      <ActivityIndicator size="small" color={PINK} style={{ transform: [{ scale: 0.75 }] }} />
                                    </View>
                                  ) : (
                                    <View style={{
                                      position: "absolute", top: 8, right: 8,
                                      backgroundColor: "rgba(0,0,0,0.65)", borderRadius: 14,
                                      width: 28, height: 28, alignItems: "center", justifyContent: "center",
                                    }}>
                                      <Ionicons name="close" size={15} color="#fff" />
                                    </View>
                                  )}
                                </>
                              ) : (
                                <Animated.View style={{ alignItems: "center", gap: 8, paddingHorizontal: 8, opacity: photoSlotPromptFade[i] }}>
                                  <LinearGradient
                                    colors={["rgba(255,41,155,0.28)", "rgba(217,24,128,0.1)"]}
                                    style={{ width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" }}
                                  >
                                    <Ionicons name={prompt.icon} size={24} color="rgba(255,255,255,0.75)" />
                                  </LinearGradient>
                                  <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.45)", textAlign: "center", lineHeight: 15 }}>
                                    {prompt.label}{"\n"}{prompt.emoji}
                                  </Text>
                                </Animated.View>
                              )}
                              {/* Pink glow flash overlay */}
                              <Animated.View style={{
                                position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                                borderRadius: 18, backgroundColor: PINK,
                                opacity: photoSlotGlow[i],
                              }} pointerEvents="none" />
                            </View>
                          </ScalePressable>
                        </Animated.View>
                      );
                    })}
                  </View>

                  {/* ── Continue bar — springs in after first photo added ── */}
                  <Animated.View pointerEvents={canContinuePhotos ? "auto" : "none"} style={{
                    opacity: continueBarAnim,
                    transform: [{ translateY: continueBarAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
                  }}>
                    <PinkButton label="Continue" onPress={handleNext} icon="arrow-forward" />
                  </Animated.View>
                </View>
              );
            })()}

            {/* ════════════════════════════════════════
                STEP 10 — FACE LIVENESS VERIFICATION
            ════════════════════════════════════════ */}
            {step === 11 && (
              <View style={s.stepWrap}>
                <View style={s.badge}>
                  <Ionicons name="shield-checkmark-outline" size={16} color={PINK} />
                  <Text style={s.badgeText}>Safety first</Text>
                </View>
                <View style={{ gap: 6 }}>
                  <Text style={s.headline}>Get <Text style={{ color: PINK }}>Verified</Text></Text>
                  <Text style={s.sub}>Complete a quick face liveness check. Takes about 15 seconds and keeps everyone safe.</Text>
                </View>

                {!verifyDone ? (
                  <View style={{ gap: 18 }}>
                    {/* How it works */}
                    {[
                      { icon: "eye-outline"              as const, text: "Follow simple on-screen challenges (blink, smile, turn)" },
                      { icon: "lock-closed-outline"      as const, text: "No photo is stored — only an encrypted proof" },
                      { icon: "shield-checkmark-outline" as const, text: "Pink verified badge appears on your profile" },
                    ].map((item, idx) => (
                      <View key={idx} style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(255,41,155,0.12)", alignItems: "center", justifyContent: "center" }}>
                          <Ionicons name={item.icon} size={18} color={PINK} />
                        </View>
                        <Text style={{ flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)", lineHeight: 20 }}>{item.text}</Text>
                      </View>
                    ))}

                    {/* Anti-spoofing note */}
                    <View style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                      <Ionicons name="information-circle-outline" size={18} color="rgba(255,255,255,0.4)" style={{ marginTop: 1 }} />
                      <Text style={{ flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.4)", lineHeight: 18 }}>
                        Our system detects spoofing from printed photos or screen replays. Please use a live camera in good lighting.
                      </Text>
                    </View>

                    <PinkButton
                      label="Start Verification"
                      onPress={() => setShowLiveness(true)}
                      icon="scan-circle-outline"
                    />
                  </View>
                ) : (
                  <View style={{ alignItems: "center", gap: 20, paddingVertical: 16 }}>
                    <View style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: "rgba(255,41,155,0.12)", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: PINK }}>
                      <Animated.View style={{ opacity: verifyCheckOpacity, transform: [{ scale: verifyCheckScale }] }}>
                        <Ionicons name="checkmark-circle" size={62} color={PINK} />
                      </Animated.View>
                    </View>
                    <View style={{ alignItems: "center", gap: 8 }}>
                      <Text style={{ fontSize: 24, fontFamily: "Inter_700Bold", color: "#fff" }}>You're verified! ✓</Text>
                      <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.5)", textAlign: "center", lineHeight: 20 }}>
                        A pink checkmark will appear on your profile so others know you're real.
                      </Text>
                    </View>
                    <View style={{ alignSelf: "stretch" }}>
                      <PinkButton label="Continue" onPress={handleNext} icon="arrow-forward" />
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* ── LivenessCamera full-screen modal ── */}
            <Modal
              visible={showLiveness}
              animationType="slide"
              statusBarTranslucent
              onRequestClose={handleLivenessCancel}
            >
              <LivenessCamera
                domain={process.env.EXPO_PUBLIC_DOMAIN ?? ""}
                getToken={getToken}
                onSuccess={handleLivenessSuccess}
                onCancel={handleLivenessCancel}
              />
            </Modal>

            {/* ════════════════════════════════════════
                STEP 11 — PERMISSIONS
            ════════════════════════════════════════ */}
            {step === 12 && (
              <View style={s.stepWrap}>
                <View style={s.badge}>
                  <Ionicons name="location-outline" size={16} color={PINK} />
                  <Text style={s.badgeText}>Almost there!</Text>
                </View>
                <View style={{ gap: 6 }}>
                  <Text style={s.headline}>Final <Text style={{ color: PINK }}>setup</Text></Text>
                  <Text style={s.sub}>Tell us where you are and how you want to connect.</Text>
                </View>

                {/* Location / County */}
                <View style={{ gap: 12 }}>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 2, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>Your area</Text>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    {([
                      { id: "Miami-Dade" as const, label: "Miami-Dade", cities: MIAMI_DADE_CITIES.length },
                      { id: "Broward" as const,    label: "Broward",    cities: BROWARD_CITIES.length },
                    ]).map((c) => {
                      const sel = county === c.id;
                      return (
                        <ScalePressable
                          key={c.id}
                          onPress={() => { setCounty(c.id); setCity(""); }}
                          containerStyle={{ flex: 1 }}
                        >
                          <View style={{
                            flex: 1, padding: 16, borderRadius: 16, alignItems: "center", gap: 6,
                            borderWidth: sel ? 2 : 1.5,
                            borderColor: sel ? PINK : "rgba(255,255,255,0.1)",
                            backgroundColor: sel ? "rgba(255,41,155,0.12)" : "rgba(255,255,255,0.04)",
                          }}>
                            <Ionicons name="location" size={20} color={sel ? PINK : "rgba(255,255,255,0.35)"} />
                            <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: sel ? PINK : "#fff" }}>{c.label}</Text>
                            <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.35)" }}>{c.cities} cities</Text>
                          </View>
                        </ScalePressable>
                      );
                    })}
                  </View>

                  {county ? (
                    <DropdownPicker
                      label="Your city"
                      value={city}
                      placeholder="Select your city"
                      options={cityOptions}
                      onSelect={setCity}
                      icon="business-outline"
                    />
                  ) : null}

                  {/* Distance visibility — 2 options: hidden / fuzzy */}
                  <View style={{ gap: 8 }}>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 2, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>Distance visibility</Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {([
                        { key: "hidden" as const, label: "Hidden", icon: "eye-off-outline" as const, sub: "Never shown" },
                        { key: "fuzzy"  as const, label: "Area",   icon: "locate-outline" as const,  sub: "~500m blur" },
                      ]).map((opt) => {
                        const sel = locationVisibility === opt.key;
                        return (
                          <ScalePressable key={opt.key} onPress={() => setLocationVisibility(opt.key)} containerStyle={{ flex: 1 }}>
                            <View style={{ flex: 1, alignItems: "center", padding: 16, borderRadius: 14, borderWidth: sel ? 2 : 1, borderColor: sel ? PINK : "rgba(255,255,255,0.1)", backgroundColor: sel ? "rgba(255,41,155,0.12)" : "rgba(255,255,255,0.04)", gap: 5 }}>
                              <Ionicons name={opt.icon} size={20} color={sel ? PINK : "rgba(255,255,255,0.35)"} />
                              <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: sel ? PINK : "#fff" }}>{opt.label}</Text>
                              <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.35)", textAlign: "center" }}>{opt.sub}</Text>
                            </View>
                          </ScalePressable>
                        );
                      })}
                    </View>
                  </View>
                </View>

                {/* Notifications toggle */}
                <View style={{
                  flexDirection: "row", alignItems: "center", gap: 14,
                  padding: 16, borderRadius: 16, borderWidth: 1,
                  borderColor: notificationsOn ? "rgba(255,41,155,0.3)" : "rgba(255,255,255,0.1)",
                  backgroundColor: notificationsOn ? "rgba(255,41,155,0.08)" : "rgba(255,255,255,0.04)",
                }}>
                  <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: notificationsOn ? "rgba(255,41,155,0.2)" : "rgba(255,255,255,0.07)", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="notifications-outline" size={20} color={notificationsOn ? PINK : "rgba(255,255,255,0.4)"} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" }}>Turn on notifications</Text>
                    <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                      Know when someone likes or messages you
                    </Text>
                  </View>
                  <Switch
                    value={notificationsOn}
                    onValueChange={handleNotificationsToggle}
                    trackColor={{ false: "rgba(255,255,255,0.12)", true: PINK }}
                    thumbColor="#fff"
                    ios_backgroundColor="rgba(255,255,255,0.12)"
                  />
                </View>

                {/* Community code */}
                <Pressable
                  onPress={() => setCommunityCodeAccepted((v) => !v)}
                  style={{
                    flexDirection: "row", alignItems: "flex-start", gap: 14,
                    padding: 16, borderRadius: 16, borderWidth: communityCodeAccepted ? 2 : 1.5,
                    borderColor: communityCodeAccepted ? PINK : "rgba(255,255,255,0.1)",
                    backgroundColor: communityCodeAccepted ? "rgba(255,41,155,0.1)" : "rgba(255,255,255,0.04)",
                  }}
                >
                  <View style={{
                    width: 24, height: 24, borderRadius: 7, marginTop: 1,
                    borderWidth: 1.5,
                    borderColor: communityCodeAccepted ? PINK : "rgba(255,255,255,0.25)",
                    backgroundColor: communityCodeAccepted ? PINK : "transparent",
                    alignItems: "center", justifyContent: "center",
                  }}>
                    {communityCodeAccepted && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <Text style={{ flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)", lineHeight: 21 }}>
                    I agree to the{" "}
                    <Text style={{ color: PINK, fontFamily: "Inter_600SemiBold" }}>ConnectSphere Community Code</Text>
                    {" "}— I'm 18+, I'll treat others with respect, and I won't misuse the platform.
                  </Text>
                </Pressable>

                <PinkButton
                  label={loading ? "Setting up your profile…" : "Start exploring 🔥"}
                  onPress={handleFinish}
                  disabled={loading || !communityCodeAccepted}
                />
              </View>
            )}

          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>

      {/* Celebration flash overlay */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: PINK, opacity: celebAnim, zIndex: 9999 }]}
        pointerEvents="none"
      />
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 10,
  },
  backBtn: { padding: 4, width: 38 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 },
  stepWrap: { gap: 22 },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start",
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: "rgba(255,41,155,0.12)", borderWidth: 1, borderColor: "rgba(255,41,155,0.25)",
  },
  badgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: PINK, letterSpacing: 0.4 },
  headline: {
    fontSize: 36, fontFamily: "Inter_700Bold", letterSpacing: -1,
    color: "#fff", lineHeight: 42,
  },
  sub: {
    fontSize: 15, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.5)", lineHeight: 22,
  },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.45)" },
  input: {
    borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 16, height: 52,
    fontSize: 16, fontFamily: "Inter_400Regular",
    color: "#fff", backgroundColor: "rgba(255,255,255,0.06)",
  },
  bioInput: {
    minHeight: 118,
    fontSize: 16,
    lineHeight: 23,
    fontFamily: "Inter_400Regular",
    color: "#fff",
    padding: 0,
  },
  bioCounter: {
    alignSelf: "flex-end",
    marginTop: 8,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  bioStarterChip: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,41,155,0.28)",
    backgroundColor: "rgba(255,41,155,0.08)",
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  bioStarterText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.78)",
  },
  bioAiCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 15,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(255,41,155,0.35)",
    backgroundColor: "rgba(255,41,155,0.1)",
  },
  bioAiIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PINK,
  },
  bioAiTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  bioAiSub: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.48)",
  },
  bioError: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Inter_500Medium",
    color: PINK,
  },
  usernameBox: {
    minHeight: 62,
    borderRadius: 18,
    borderWidth: 1.5,
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  usernameAt: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: PINK,
  },
  usernameInput: {
    flex: 1,
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    paddingVertical: 14,
  },
  usernameRules: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  usernameRule: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.045)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.55)",
  },
});
