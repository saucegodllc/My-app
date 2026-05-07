import { useAuth, useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { LivenessCamera } from "../components/LivenessCamera";
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

function appleEmojiUrl(emoji: string): string {
  const points = [...emoji]
    .map((c) => c.codePointAt(0)!)
    .filter((cp) => cp !== 0xfe0f) // strip variation selectors
    .map((cp) => cp.toString(16).toLowerCase());
  return `https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/${points.join("-")}.png`;
}
const WINDOW_WIDTH = Dimensions.get("window").width;
const TOTAL_STEPS = 10;

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
  "Tap a slot to add your first photo",
  "One more to unlock your profile →",
  "Nice! Keep going for 6× more matches",
  "3 photos — sweet spot 🎯 Add more!",
  "Almost there! One more to maximise matches",
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
];

const FRIENDSHIP_TYPES = [
  { value: "Casual Hangout",   icon: "cafe-outline" as const,          label: "Casual Hangout" },
  { value: "Activity Partner", icon: "bicycle-outline" as const,        label: "Activity Partner" },
  { value: "Wing Person",      icon: "people-circle-outline" as const,  label: "Wing Person" },
  { value: "BFF Hunt",         icon: "heart-circle-outline" as const,   label: "BFF Hunt" },
];

const DATING_GOALS = [
  { value: "1-on-1",      icon: "heart-outline" as const,       label: "1-on-1 Date" },
  { value: "Double Date", icon: "people-outline" as const,       label: "Double Date" },
  { value: "Group Hang",  icon: "bonfire-outline" as const,      label: "Group Hang" },
];


const INTERESTS = [
  "Travel", "Beach", "Nightlife", "Food", "Coffee", "Wine & Cocktails",
  "Music", "Dancing", "Salsa / Latin Dance", "Art", "Photography", "Fashion",
  "Fitness", "Running", "Cycling", "Swimming", "Yoga", "Tennis",
  "Sports", "Hiking", "Outdoors", "Gaming", "Movies", "Reading",
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
  const { getToken, signOut } = useAuth();
  const { user } = useUser();
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
  const [friendshipTypes, setFriendshipTypes] = useState<string[]>([]);
  const [careerStage, setCareerStage] = useState("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [allInterests, setAllInterests] = useState<string[]>([...INTERESTS]);
  const [customInterest, setCustomInterest] = useState("");

  function toggleInterest(interest: string) {
    setSelectedInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : prev.length < 15 ? [...prev, interest] : prev
    );
  }

  function addCustomInterest() {
    const t = customInterest.trim();
    if (!t || allInterests.includes(t)) return;
    setAllInterests((prev) => [...prev, t]);
    setSelectedInterests((prev) => prev.length < 15 ? [...prev, t] : prev);
    setCustomInterest("");
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
      quality: 0.82,
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
    try {
      const token = await getToken();
      let base64: string;
      if (b64) {
        base64 = b64;
      } else {
        base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      }
      const res = await fetch(
        `https://${process.env.EXPO_PUBLIC_DOMAIN}/api/profiles/me/photos`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ base64, contentType: "image/jpeg" }),
        }
      );
      if (res.ok) {
        const { url } = await res.json() as { url: string };
        if (url) {
          setPhotoStorageUrls((prev) => { const copy = [...prev]; copy[slot] = url; return copy; });
          // Sync main photo as Clerk profile image too
          if (slot === 0) {
            try {
              await user?.setProfileImage({ file: { uri, type: "image/jpeg", name: "profile.jpg" } as unknown as File });
              await user?.reload();
            } catch (_) {}
          }
        }
      } else {
        console.error("[pickPhoto] upload failed:", res.status, await res.text().catch(() => ""));
      }
    } catch (err) {
      console.error("[pickPhoto] upload error:", err);
    } finally {
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
  // Must have at least 1 photo AND the upload must be complete before continuing
  const canContinuePhotos = uploadedPhotoCount >= 1 && !anyPhotoUploading;

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
    if (step === 8) {
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
    if (step !== 7) return;
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
    // Spring continue bar in once first photo added
    if (uploadedPhotoCount >= 1) {
      Animated.spring(continueBarAnim, { toValue: 1, useNativeDriver: true, bounciness: 14, speed: 10 }).start();
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
  }, [photoUris]);

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

  // ── Celebration flash ────────────────────────────────────────────────────────
  const celebAnim = useRef(new Animated.Value(0)).current;
  const [loading, setLoading] = useState(false);

  // ── Progress restore ─────────────────────────────────────────────────────────
  useEffect(() => {
    const saved = user?.unsafeMetadata?.onboardingProgress as Record<string, unknown> | undefined;
    if (!saved) return;
    if (typeof saved.step === "number") setStep(saved.step);
    if (typeof saved.firstName === "string") setFirstName(saved.firstName);
    if (typeof saved.lastName === "string") setLastName(saved.lastName);
    if (typeof saved.dobMonth === "string") setDobMonth(saved.dobMonth);
    if (typeof saved.dobDay === "string") setDobDay(saved.dobDay);
    if (typeof saved.dobYear === "string") setDobYear(saved.dobYear);
    if (typeof saved.gender === "string") setGender(saved.gender);
    if (typeof saved.showGenderOnProfile === "boolean") setShowGenderOnProfile(saved.showGenderOnProfile);
    if (typeof saved.lookingForGender === "string") setLookingForGender(saved.lookingForGender);
    if (typeof saved.intent === "string") setIntent(saved.intent);
    if (typeof saved.datingGoal === "string") setDatingGoal(saved.datingGoal);
    if (Array.isArray(saved.friendshipTypes)) setFriendshipTypes(saved.friendshipTypes as string[]);
    if (typeof saved.careerStage === "string") setCareerStage(saved.careerStage);
    if (Array.isArray(saved.selectedInterests)) setSelectedInterests(saved.selectedInterests as string[]);
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
          intent, datingGoal, friendshipTypes, careerStage,
          selectedInterests,
          county, city, locationVisibility,
          communityCodeAccepted,
        },
      },
    }).catch(() => {});
  }

  // ── Photo upload ─────────────────────────────────────────────────────────────
  // base64Hint: pre-fetched base64 from the image picker (preferred path).
  // Falls back to reading the file only if base64Hint is not available.
  async function uploadPhoto(uri: string, token: string | null, base64Hint?: string | null): Promise<string | null> {
    try {
      let base64: string;
      if (base64Hint) {
        base64 = base64Hint;
      } else if (Platform.OS === "web") {
        const imgRes = await fetch(uri);
        const blob = await imgRes.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        base64 = btoa(binary);
      } else {
        base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

      const res = await fetch(
        `https://${process.env.EXPO_PUBLIC_DOMAIN}/api/profiles/me/photos`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ base64, contentType: "image/jpeg" }),
        }
      );
      if (!res.ok) return null;
      const { url } = await res.json() as { url: string };
      return url || null;
    } catch (err) {
      console.error("[uploadPhoto] failed:", err);
      return null;
    }
  }

  // ── Navigation handlers ───────────────────────────────────────────────────────
  function handleNext() {
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
    if (step === 7) {
      if (!canContinuePhotos) {
        Alert.alert("Add a photo", "Please add at least one photo to continue.");
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
      const token = await getToken();

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

      const connectionSubtype =
        intent === "dating" ? (datingGoal || undefined) :
        intent === "friendship" ? (friendshipTypes[0] || undefined) :
        intent === "networking" ? (careerStage || undefined) :
        undefined;

      const modeData =
        intent === "dating"
          ? { gender, lookingFor: lookingForGender, datingGoal: datingGoal || undefined }
          : intent === "friendship"
          ? { friendshipTypes: friendshipTypes.length > 0 ? friendshipTypes : ["Casual Hangout"] }
          : intent === "networking"
          ? { networkingSubtype: careerStage || undefined }
          : {};

      const response = await fetch(
        `https://${process.env.EXPO_PUBLIC_DOMAIN}/api/profiles/me`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            firstName: firstName.trim() || undefined,
            lastName: lastName.trim() || undefined,
            displayName: [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") || "User",
            birthDate: dobIsoString() ?? undefined,
            gender,
            showGenderOnProfile,
            lookingForGender: intent === "dating" ? lookingForGender : undefined,
            location: city || county || "South Florida",
            country: "United States",
            intent: intent || "friendship",
            interests: selectedInterests,
            photos: uploadedPhotos,
            locationVisibility,
            acceptCommunityCode: communityCodeAccepted,
            connectionSubtype,
            modeData,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to save profile");
      }

      await user?.update({
        unsafeMetadata: { ...user.unsafeMetadata, onboardingComplete: true, onboardingProgress: null },
      });

      // Celebration flash → navigate
      Animated.sequence([
        Animated.timing(celebAnim, { toValue: 0.55, duration: 220, useNativeDriver: true }),
        Animated.timing(celebAnim, { toValue: 0, duration: 480, useNativeDriver: true }),
      ]).start(() => router.replace("/success"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong. Please try again.";
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
      intent === "networking" ? careerStage.length > 0 :
      false
    ) :
    step === 5 ? lookingForGender.length > 0 :
    step === 6 ? selectedInterests.length >= 3 :
    step === 7 ? canContinuePhotos :
    step === 8 ? true :
    step === 9 ? true :
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
        {step > 1 && step !== 8 ? (
          <Pressable onPress={handleBack} style={s.backBtn} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </Pressable>
        ) : <View style={{ width: 38 }} />}
        <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, fontFamily: "Inter_500Medium" }}>
          {step} of {TOTAL_STEPS}
        </Text>
        {step === 9 && !isLastStep ? (
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
                        onPress={() => setIntent(sel ? "" : item.value)}
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
                {intent === "dating" && (
                  <View style={{ gap: 10 }}>
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
                  </View>
                )}

                {/* Sub-preference for friendship */}
                {intent === "friendship" && (
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
                STEP 8 — CELEBRATION TRANSITION
            ════════════════════════════════════════ */}
            {step === 8 && (
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
                STEP 7 — PHOTOS
            ════════════════════════════════════════ */}
            {step === 7 && (() => {
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
                      Profiles with 2+ photos get{" "}
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
                        : "Your first photo is your profile cover. Add at least 2 to continue."}
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
                  <Animated.View style={{
                    opacity: continueBarAnim,
                    transform: [{ translateY: continueBarAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
                  }}>
                    <PinkButton label="Continue" onPress={handleNext} icon="arrow-forward" />
                  </Animated.View>
                </View>
              );
            })()}

            {/* ════════════════════════════════════════
                STEP 9 — FACE LIVENESS VERIFICATION
            ════════════════════════════════════════ */}
            {step === 9 && (
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
                STEP 10 — PERMISSIONS
            ════════════════════════════════════════ */}
            {step === 10 && (
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
                    onValueChange={async (val) => {
                      if (val) {
                        const { status } = await Notifications.requestPermissionsAsync();
                        setNotificationsOn(status === "granted");
                      } else {
                        setNotificationsOn(false);
                      }
                    }}
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
});
