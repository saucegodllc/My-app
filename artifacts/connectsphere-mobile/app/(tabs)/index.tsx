import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useMemo, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ActionButton } from "@/components/ActionButton";
import { SwipeCard, type Profile } from "@/components/SwipeCard";
import { useDiscoveryMode, type DiscoveryMode } from "@/contexts/DiscoveryModeContext";
import { useColors } from "@/hooks/useColors";
import {
  useGetDiscoveryFeed,
  useGetMyProfile,
  usePerformDiscoveryAction,
} from "@workspace/api-client-react";
import type { ConnectionIntent } from "@workspace/api-client-react";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const CARD_HEIGHT = SCREEN_HEIGHT * 0.62;

const MODE_TABS: { value: DiscoveryMode; label: string; icon: IoniconName; color: string }[] = [
  { value: "dating", label: "Dating", icon: "flame", color: "#FF299B" },
  { value: "friendship", label: "Friends", icon: "people", color: "#22D3EE" },
  { value: "networking", label: "Networking", icon: "briefcase", color: "#A855F7" },
];

const SUBTYPE_CHIPS: Record<DiscoveryMode, string[]> = {
  dating: ["All", "Serious", "Casual", "Long-Term", "Luxury", "Adventure", "Creative", "Double Dates", "Active Tonight", "New in Town"],
  friendship: ["All", "Going Out", "Gym", "Study", "Travel", "Foodies", "Nightlife"],
  networking: ["All", "Entrepreneurs", "Creators", "Students", "Investors", "Jobs", "Mentors"],
};

const MOCK_DISCOVERY_PROFILES: Record<DiscoveryMode, Profile[]> = {
  dating: [
    {
      id: "mock-dating-1",
      userId: "mock-dating-1",
      displayName: "Maya",
      age: 24,
      location: "Miami",
      country: "FL",
      intent: "dating",
      connectionSubtype: "Active Tonight",
      bio: "Looking for people to go out and have fun tonight. Love rooftop bars, dancing, and spontaneous plans.",
      interests: ["Nightlife", "Travel", "Yoga", "Foodie"],
      photos: [
        "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1200&q=80",
        "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=1200&q=80",
        "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1200&q=80",
      ],
      isPremium: true,
      isVerified: true,
    },
    {
      id: "mock-dating-2",
      userId: "mock-dating-2",
      displayName: "Andre",
      age: 27,
      location: "Brickell",
      country: "Miami",
      intent: "dating",
      connectionSubtype: "Serious",
      bio: "Big on chemistry, consistency, and planning cute dates that turn into stories.",
      interests: ["Fitness", "Restaurants", "Beach", "Live Music"],
      photos: [
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=1200&q=80",
        "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=1200&q=80",
        "https://images.unsplash.com/photo-1504593811423-6dd665756598?w=1200&q=80",
      ],
      isPremium: false,
      isVerified: true,
    },
    {
      id: "mock-dating-3",
      userId: "mock-dating-3",
      displayName: "Sofia",
      age: 25,
      location: "Wynwood",
      country: "Miami",
      intent: "dating",
      connectionSubtype: "Casual",
      bio: "Sunset walks, art nights, and playful energy. Down for last-minute plans if the vibe is right.",
      interests: ["Art", "Coffee", "Fashion", "Pilates"],
      photos: [
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=1200&q=80",
        "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=1200&q=80",
        "https://images.unsplash.com/photo-1521119989659-a83eee488004?w=1200&q=80",
      ],
      isPremium: true,
      isVerified: false,
    },
    {
      id: "mock-dating-4",
      userId: "mock-dating-4",
      displayName: "Leo",
      age: 29,
      location: "Fort Lauderdale",
      country: "FL",
      intent: "dating",
      connectionSubtype: "Double Dates",
      bio: "Usually with my crew, always down for a fun dinner and something that turns into an adventure.",
      interests: ["Boating", "Brunch", "Comedy", "Travel"],
      photos: [
        "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=1200&q=80",
        "https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=1200&q=80",
      ],
      isPremium: false,
      isVerified: true,
    },
    {
      id: "mock-dating-5",
      userId: "mock-dating-5",
      displayName: "Ariella",
      age: 26,
      location: "Sunny Isles",
      country: "FL",
      intent: "dating",
      connectionSubtype: "Long-Term",
      bio: "Soft life energy with real intention. Looking for consistency, chemistry, and someone who actually dates with purpose.",
      interests: ["Pilates", "Dinner Dates", "Wellness", "Travel"],
      photos: [
        "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=1200&q=80",
        "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=1200&q=80",
      ],
      isPremium: true,
      isVerified: true,
    },
    {
      id: "mock-dating-6",
      userId: "mock-dating-6",
      displayName: "Damian",
      age: 31,
      location: "Bal Harbour",
      country: "FL",
      intent: "dating",
      connectionSubtype: "Luxury",
      bio: "I like beautiful spaces, clean style, and dates that feel elevated without trying too hard.",
      interests: ["Fine Dining", "Boats", "Design", "Weekend Escapes"],
      photos: [
        "https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=1200&q=80",
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=1200&q=80&sat=-25",
      ],
      isPremium: true,
      isVerified: true,
    },
    {
      id: "mock-dating-7",
      userId: "mock-dating-7",
      displayName: "Kiara",
      age: 23,
      location: "Coconut Grove",
      country: "FL",
      intent: "dating",
      connectionSubtype: "Adventure",
      bio: "Say yes to jet skis, hidden cafes, random drives, and someone who can match spontaneous energy.",
      interests: ["Hiking", "Kayaking", "Travel", "Sunsets"],
      photos: [
        "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=1200&q=80",
        "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1200&q=80",
      ],
      isPremium: false,
      isVerified: true,
    },
    {
      id: "mock-dating-8",
      userId: "mock-dating-8",
      displayName: "Noah",
      age: 28,
      location: "Wynwood",
      country: "Miami",
      intent: "dating",
      connectionSubtype: "Creative",
      bio: "Photographer and visual storyteller. Looking for someone inspiring, playful, and down for late-night idea spirals.",
      interests: ["Photography", "Art", "Fashion", "Music"],
      photos: [
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=1200&q=80&sat=-20",
        "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=1200&q=80&sat=-20",
      ],
      isPremium: false,
      isVerified: false,
    },
    {
      id: "mock-dating-9",
      userId: "mock-dating-9",
      displayName: "Valentina",
      age: 25,
      location: "Edgewater",
      country: "Miami",
      intent: "dating",
      connectionSubtype: "New in Town",
      bio: "Just moved here and want one person who makes Miami feel instantly exciting, warm, and a little dangerous.",
      interests: ["Trying New Spots", "Beach Walks", "Latin Music", "Coffee"],
      photos: [
        "https://images.unsplash.com/photo-1521119989659-a83eee488004?w=1200&q=80",
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=1200&q=80&sat=10",
      ],
      isPremium: true,
      isVerified: true,
    },
  ],
  friendship: [
    {
      id: "mock-friends-1",
      userId: "mock-friends-1",
      displayName: "Janelle",
      age: 23,
      location: "Aventura",
      country: "FL",
      intent: "friendship",
      connectionSubtype: "Going Out",
      bio: "New in town and building a solid friend group for brunches, girls' nights, and beach days.",
      interests: ["Brunch", "Beach", "Concerts", "Shopping"],
      photos: ["https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=1200&q=80"],
      isPremium: false,
      isVerified: true,
    },
    {
      id: "mock-friends-2",
      userId: "mock-friends-2",
      displayName: "Chris",
      age: 26,
      location: "Downtown",
      country: "Miami",
      intent: "friendship",
      connectionSubtype: "Gym",
      bio: "Looking for friends who are into fitness, matcha runs, and actually sticking to plans.",
      interests: ["Gym", "Running", "Smoothies", "Recovery"],
      photos: ["https://images.unsplash.com/photo-1504593811423-6dd665756598?w=1200&q=80"],
      isPremium: true,
      isVerified: false,
    },
    {
      id: "mock-friends-3",
      userId: "mock-friends-3",
      displayName: "Nia",
      age: 22,
      location: "Coral Gables",
      country: "FL",
      intent: "friendship",
      connectionSubtype: "Study",
      bio: "Med student who still wants balance. Study buddy energy with occasional iced coffee escapes.",
      interests: ["Study", "Coffee", "Books", "Wellness"],
      photos: ["https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=1200&q=80"],
      isPremium: false,
      isVerified: true,
    },
    {
      id: "mock-friends-4",
      userId: "mock-friends-4",
      displayName: "Marco",
      age: 28,
      location: "Hollywood",
      country: "FL",
      intent: "friendship",
      connectionSubtype: "Travel",
      bio: "Always looking for a passport-ready crew, random road trips, and people who say yes to experiences.",
      interests: ["Travel", "Photography", "Food", "Road Trips"],
      photos: ["https://images.unsplash.com/photo-1504257432389-52343af06ae3?w=1200&q=80"],
      isPremium: true,
      isVerified: true,
    },
  ],
  networking: [
    {
      id: "mock-network-1",
      userId: "mock-network-1",
      displayName: "Alex Carter",
      age: 30,
      location: "Brickell",
      country: "Miami",
      intent: "networking",
      connectionSubtype: "Entrepreneurs",
      role: "founder",
      profession: "Founder & CEO",
      bio: "Building an AI growth tool for creators. Looking for operators, early hires, and sharp people who move fast.",
      interests: ["Startups", "AI", "Growth", "Pitch Nights"],
      photos: ["https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=1200&q=80"],
      isPremium: true,
      isVerified: true,
    },
    {
      id: "mock-network-2",
      userId: "mock-network-2",
      displayName: "Jasmine Lee",
      age: 28,
      location: "Wynwood",
      country: "Miami",
      intent: "networking",
      connectionSubtype: "Creators",
      role: "creativeDirector",
      profession: "Creative Director",
      bio: "Running campaigns for nightlife and hospitality brands. Always down to meet photographers, editors, and founders.",
      interests: ["Branding", "Events", "Content", "Fashion"],
      photos: ["https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=1200&q=80"],
      isPremium: false,
      isVerified: true,
    },
    {
      id: "mock-network-3",
      userId: "mock-network-3",
      displayName: "Marcus Webb",
      age: 33,
      location: "Downtown",
      country: "Miami",
      intent: "networking",
      connectionSubtype: "Investors",
      role: "investor",
      profession: "Angel Investor",
      bio: "Backing bold South Florida founders in AI, fintech, and consumer social. I like people with edge and execution.",
      interests: ["Venture", "Fintech", "AI", "Founder Dinners"],
      photos: ["https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200&q=80"],
      isPremium: true,
      isVerified: true,
    },
    {
      id: "mock-network-4",
      userId: "mock-network-4",
      displayName: "Sofia Mendez",
      age: 27,
      location: "Coral Gables",
      country: "FL",
      intent: "networking",
      connectionSubtype: "Mentors",
      role: "engineer",
      profession: "Senior Product Engineer",
      bio: "Helping first-time founders go from messy idea to clean launch. Especially into women-led products and community apps.",
      interests: ["Product", "Engineering", "Mentorship", "Coffee Chats"],
      photos: ["https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=1200&q=80"],
      isPremium: true,
      isVerified: false,
    },
  ],
};

function normalizeSubtype(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function getInitials(name = "User") {
  return name
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function deterministicPct(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (((hash << 5) - hash) + id.charCodeAt(index)) | 0;
  }
  return 70 + (Math.abs(hash) % 30);
}

function PreviewModal({
  visible,
  profile,
  onClose,
  onLike,
}: {
  visible: boolean;
  profile: Profile | null;
  onClose: () => void;
  onLike: () => void;
}) {
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    setPhotoIndex(0);
  }, [profile?.id, visible]);

  if (!profile) {
    return null;
  }

  const photoCount = Math.min(profile.photos?.length ?? 0, 5);
  const photoUrl = photoCount > 0 ? profile.photos?.[Math.min(photoIndex, photoCount - 1)] : undefined;
  const compatibility = deterministicPct(profile.userId);
  const locationText = [profile.location, profile.country].filter(Boolean).join(", ");

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={previewStyles.container}>
        <ScrollView bounces={false} style={previewStyles.container}>
          <View style={previewStyles.hero}>
            {photoUrl ? (
              <Animated.Image source={{ uri: photoUrl }} style={previewStyles.heroImage} />
            ) : (
              <LinearGradient colors={["#111111", "#3a0426", "#000000"]} style={previewStyles.heroImage}>
                <View style={previewStyles.initialsBubble}>
                  <Text style={previewStyles.initialsText}>{getInitials(profile.displayName)}</Text>
                </View>
              </LinearGradient>
            )}

            <LinearGradient colors={["transparent", "rgba(0,0,0,0.18)", "#000"]} style={previewStyles.heroShade} />

            {photoCount > 1 ? (
              <View style={previewStyles.photoProgress}>
                {profile.photos?.slice(0, 5).map((_, index) => (
                  <View
                    key={`${profile.id}-preview-photo-${index}`}
                    style={[
                      previewStyles.photoProgressDot,
                      index === photoIndex ? previewStyles.photoProgressDotActive : null,
                    ]}
                  />
                ))}
              </View>
            ) : null}

            <View style={previewStyles.photoTapRow}>
              <Pressable
                onPress={() => {
                  if (photoCount > 1) {
                    setPhotoIndex((current) => (current === 0 ? photoCount - 1 : current - 1));
                  }
                }}
                style={previewStyles.photoTapZone}
              />
              <Pressable
                onPress={() => {
                  if (photoCount > 1) {
                    setPhotoIndex((current) => (current + 1) % photoCount);
                  }
                }}
                style={previewStyles.photoTapZone}
              />
            </View>

            <View style={previewStyles.heroTop}>
              <Pressable onPress={onClose} style={previewStyles.roundButton}>
                <Ionicons name="close" size={22} color="#fff" />
              </Pressable>
              <View style={previewStyles.matchPill}>
                <Text style={previewStyles.matchPillText}>{compatibility}% Match</Text>
              </View>
            </View>

            <View style={previewStyles.heroBottom}>
              <View style={previewStyles.heroNameRow}>
                <Text style={previewStyles.heroName}>
                  {profile.displayName}
                  {profile.age ? `, ${profile.age}` : ""}
                </Text>
                {profile.isVerified ? (
                  <Ionicons name="checkmark-circle" size={22} color="#FF299B" />
                ) : null}
              </View>
              {locationText ? (
                <View style={previewStyles.locationRow}>
                  <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.72)" />
                  <Text style={previewStyles.locationText}>{locationText}</Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={previewStyles.content}>
            <View style={previewStyles.badgeRow}>
              <View style={previewStyles.primaryBadge}>
                <Text style={previewStyles.primaryBadgeText}>
                  {profile.intent === "friendship"
                    ? "Friends"
                    : profile.intent.charAt(0).toUpperCase() + profile.intent.slice(1)}
                </Text>
              </View>
              {profile.connectionSubtype ? (
                <View style={previewStyles.secondaryBadge}>
                  <Text style={previewStyles.secondaryBadgeText}>{profile.connectionSubtype}</Text>
                </View>
              ) : null}
            </View>

            {profile.bio ? (
              <View style={previewStyles.vibeCard}>
                <Text style={previewStyles.sectionEyebrow}>Vibe</Text>
                <Text style={previewStyles.vibeCopy}>{profile.bio}</Text>
              </View>
            ) : null}

            {profile.interests && profile.interests.length > 0 ? (
              <View style={previewStyles.section}>
                <Text style={previewStyles.sectionTitle}>Interests</Text>
                <View style={previewStyles.interestsWrap}>
                  {profile.interests.map((interest) => (
                    <View key={interest} style={previewStyles.interestChip}>
                      <Text style={previewStyles.interestChipText}>{interest}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        </ScrollView>

        <View style={previewStyles.footer}>
          <Pressable onPress={onClose} style={previewStyles.secondaryCta}>
            <Text style={previewStyles.secondaryCtaText}>Back</Text>
          </Pressable>
          <Pressable onPress={onLike} style={previewStyles.primaryCta}>
            <Text style={previewStyles.primaryCtaText}>Like</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function DiscoverScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const { isSignedIn } = useAuth();
  const { data: myProfile } = useGetMyProfile({ query: { enabled: !!isSignedIn } });
  const { mode, setMode } = useDiscoveryMode();

  const visibleModeTabs = MODE_TABS.filter((tab) => {
    if (!myProfile?.intent) return true;
    if (tab.value === "dating") return myProfile.intent === "dating" || myProfile.intent === "all";
    if (tab.value === "friendship") return myProfile.intent === "friendship" || myProfile.intent === "all";
    if (tab.value === "networking") return myProfile.intent === "networking" || myProfile.intent === "all";
    return false;
  });

  const [page, setPage] = useState(1);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedSubtype, setSelectedSubtype] = useState("All");
  const [previewProfile, setPreviewProfile] = useState<Profile | null>(null);
  const [matchAnim] = useState(new Animated.Value(0));
  const [matchedProfile, setMatchedProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!myProfile?.intent) return;
    const valid = visibleModeTabs.some((tab) => tab.value === mode);
    if (!valid && visibleModeTabs.length > 0) {
      setMode(visibleModeTabs[0]!.value);
    }
  }, [mode, myProfile?.intent, setMode, visibleModeTabs]);

  const { data, isLoading, refetch } = useGetDiscoveryFeed(
    {
      page,
      limit: 10,
      intent: mode as ConnectionIntent,
      ...(selectedSubtype !== "All" ? { subtype: selectedSubtype } : {}),
    },
    { query: { enabled: !!isSignedIn } }
  );

  const actionMutation = usePerformDiscoveryAction();

  useEffect(() => {
    setProfiles([]);
    setCurrentIndex(0);
    setPage(1);
  }, [mode, selectedSubtype]);

  useEffect(() => {
    if (data?.profiles) {
      setProfiles((prev) => {
        const existingIds = new Set(prev.map((profile) => profile.id));
        const newProfiles = data.profiles.filter((profile: Profile) => !existingIds.has(profile.id));
        return page === 1 ? newProfiles : [...prev, ...newProfiles];
      });
    }
  }, [data?.profiles, page]);

  const filteredProfiles = useMemo(
    () =>
      profiles.filter((profile) =>
        selectedSubtype === "All"
          ? true
          : normalizeSubtype(profile.connectionSubtype) === normalizeSubtype(selectedSubtype)
      ),
    [profiles, selectedSubtype]
  );

  const mockProfiles = useMemo(
    () =>
      MOCK_DISCOVERY_PROFILES[mode].filter((profile) =>
        selectedSubtype === "All"
          ? true
          : normalizeSubtype(profile.connectionSubtype) === normalizeSubtype(selectedSubtype)
      ),
    [mode, selectedSubtype]
  );

  const activeProfiles = filteredProfiles.length > 0 ? filteredProfiles : mockProfiles;

  const visibleProfiles = activeProfiles.slice(currentIndex, currentIndex + 3);
  const topProfile = visibleProfiles[0] ?? null;
  const activeTabConfig = visibleModeTabs.find((tab) => tab.value === mode) ?? visibleModeTabs[0] ?? MODE_TABS[0]!;
  const chips = SUBTYPE_CHIPS[mode];

  async function switchMode(newMode: DiscoveryMode) {
    if (newMode === mode) return;
    await Haptics.selectionAsync();
    setMode(newMode);
    setSelectedSubtype("All");
  }

  async function handleSubtypePress(chip: string) {
    await Haptics.selectionAsync();
    setSelectedSubtype(chip);
  }

  async function handleAction(action: "like" | "superlike" | "pass", profile: Profile) {
    await Haptics.impactAsync(
      action === "like" || action === "superlike"
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light
    );

    setCurrentIndex((index) => index + 1);

    if (filteredProfiles.length > 0 && filteredProfiles.length - currentIndex < 4 && data?.hasMore) {
      setPage((currentPage) => currentPage + 1);
    }

    if (profile.userId.startsWith("mock-")) {
      if (action !== "pass" && deterministicPct(profile.userId) >= 90) {
        setMatchedProfile(profile);
        Animated.sequence([
          Animated.timing(matchAnim, { toValue: 1, duration: 280, useNativeDriver: false }),
          Animated.delay(1800),
          Animated.timing(matchAnim, { toValue: 0, duration: 280, useNativeDriver: false }),
        ]).start(() => setMatchedProfile(null));
      }
      return;
    }

    try {
      const result = await actionMutation.mutateAsync({
        data: { targetUserId: profile.userId, action },
      });

      if (result.matched && result.match) {
        setMatchedProfile(profile);
        Animated.sequence([
          Animated.timing(matchAnim, { toValue: 1, duration: 280, useNativeDriver: false }),
          Animated.delay(1800),
          Animated.timing(matchAnim, { toValue: 0, duration: 280, useNativeDriver: false }),
        ]).start(() => setMatchedProfile(null));
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      setCurrentIndex((index) => Math.max(0, index - 1));
    }
  }

  const showEmpty = !isLoading && !isSignedIn;
  const showNoMore = !isLoading && isSignedIn && activeProfiles.length > 0 && currentIndex >= activeProfiles.length;
  const showCards = isSignedIn && visibleProfiles.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={["#050505", "#090909", "#14050e"]} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <View>
          <Text style={styles.title}>Discover</Text>
          <View style={styles.subtitleRow}>
            <Ionicons name="flame" size={13} color="#FF299B" />
            <Text style={styles.subtitle}>
              {showCards ? `${Math.max(activeProfiles.length - currentIndex, 0)} people waiting` : "Active now"}
            </Text>
            <View style={styles.subtitleDot} />
          </View>
        </View>
        <Pressable onPress={() => router.push("/settings" as any)} style={styles.headerButton}>
          <Ionicons name="options-outline" size={20} color="#F4F4F5" />
        </Pressable>
      </View>

      {isSignedIn && visibleModeTabs.length > 1 ? (
        <View style={styles.modeSwitcher}>
          {visibleModeTabs.map((tab) => {
            const isActive = mode === tab.value;
            return (
              <Pressable
                key={tab.value}
                onPress={() => {
                  void switchMode(tab.value);
                }}
                style={[styles.modeTab, isActive && { backgroundColor: tab.color }]}
              >
                <Ionicons
                  name={tab.icon}
                  size={14}
                  color={isActive ? "#fff" : "#A1A1AA"}
                />
                <Text style={[styles.modeTabText, { color: isActive ? "#fff" : "#A1A1AA" }]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {isSignedIn ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          style={styles.chipsScroller}
        >
          {chips.map((chip) => {
            const isActive = selectedSubtype === chip;
            return (
              <Pressable
                key={chip}
                onPress={() => {
                  void handleSubtypePress(chip);
                }}
                style={[styles.chip, isActive ? styles.chipActive : null]}
              >
                <Text style={[styles.chipText, isActive ? styles.chipTextActive : null]}>{chip}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {isSignedIn && filteredProfiles.length === 0 ? (
        <View style={styles.demoBanner}>
          <Ionicons name="sparkles" size={14} color="#FFB6DF" />
          <Text style={styles.demoBannerText}>Showing mock profiles while your real feed is empty.</Text>
        </View>
      ) : null}

      <View style={[styles.cardArea, { height: CARD_HEIGHT }]}>
        {isLoading && profiles.length === 0 ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : null}

        {showEmpty ? (
          <View style={styles.emptyState}>
            <Ionicons name="lock-closed-outline" size={56} color={colors.mutedForeground} />
            <Text style={styles.emptyTitle}>Discover</Text>
            <Pressable onPress={() => router.push("/(auth)/welcome" as any)}>
              <Text style={[styles.emptyLink, { color: colors.primary }]}>Sign up to start swiping</Text>
            </Pressable>
          </View>
        ) : null}

        {showNoMore ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyModeIcon, { backgroundColor: activeTabConfig.color + "18" }]}>
              <Ionicons name={activeTabConfig.icon} size={30} color={activeTabConfig.color} />
            </View>
            <Text style={styles.emptyTitle}>You're all caught up</Text>
            <Text style={styles.emptySubtitle}>Try another vibe or reset the stack for more people nearby.</Text>
            <Pressable
              onPress={() => {
                setProfiles([]);
                setCurrentIndex(0);
                setPage(1);
                void refetch();
              }}
              style={styles.refreshBtn}
            >
              <Ionicons name="refresh" size={18} color="#fff" />
              <Text style={styles.refreshText}>Reset Discover</Text>
            </Pressable>
          </View>
        ) : null}

        {showCards ? (
          <>
            {visibleProfiles
              .slice()
              .reverse()
              .map((profile, reverseIndex) => {
                const index = visibleProfiles.length - 1 - reverseIndex;
                const isTop = index === 0;
                const scale = 1 - index * 0.04;
                const translateY = index * 12;

                return (
                  <View
                    key={profile.id}
                    style={[
                      styles.cardWrapper,
                      !isTop ? { transform: [{ scale }, { translateY }] } : null,
                    ]}
                  >
                    <SwipeCard
                      profile={profile}
                      isTop={isTop}
                      onOpenProfile={() => setPreviewProfile(profile)}
                      onSwipeRight={() => {
                        if (topProfile) {
                          void handleAction("like", topProfile);
                        }
                      }}
                      onSwipeLeft={() => {
                        if (topProfile) {
                          void handleAction("pass", topProfile);
                        }
                      }}
                      onSwipeUp={() => {
                        if (topProfile) {
                          void handleAction("superlike", topProfile);
                        }
                      }}
                    />
                  </View>
                );
              })}
          </>
        ) : null}
      </View>

      {showCards ? (
        <View style={[styles.actions, { paddingBottom: bottomInset + 18 }]}>
          <ActionButton type="pass" size="lg" onPress={() => topProfile && void handleAction("pass", topProfile)} />
          <ActionButton type="superlike" size="md" onPress={() => topProfile && void handleAction("superlike", topProfile)} />
          <ActionButton type="like" size="lg" onPress={() => topProfile && void handleAction("like", topProfile)} />
        </View>
      ) : null}

      {matchedProfile ? (
        <Animated.View
          style={[
            styles.matchOverlay,
            {
              opacity: matchAnim,
              transform: [
                {
                  scale: matchAnim.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }),
                },
              ],
            },
          ]}
        >
          <LinearGradient colors={["rgba(255,41,155,0.96)", "rgba(168,85,247,0.96)"]} style={styles.matchCard}>
            <Text style={styles.matchEmoji}>#</Text>
            <Text style={styles.matchTitle}>It's a match</Text>
            <Text style={styles.matchSubtitle}>
              You and {matchedProfile.displayName} liked each other.
            </Text>
            <Pressable onPress={() => setMatchedProfile(null)} style={styles.matchBtn}>
              <Text style={styles.matchBtnText}>Keep discovering</Text>
            </Pressable>
          </LinearGradient>
        </Animated.View>
      ) : null}

      <PreviewModal
        visible={Boolean(previewProfile)}
        profile={previewProfile}
        onClose={() => setPreviewProfile(null)}
        onLike={() => {
          const selectedProfile = previewProfile;
          setPreviewProfile(null);
          if (selectedProfile) {
            void handleAction("like", selectedProfile);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  title: {
    color: "#fff",
    fontSize: 34,
    fontFamily: "Inter_700Bold",
  },
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
  },
  subtitle: {
    color: "#A1A1AA",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  subtitleDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: "#4ADE80",
    marginLeft: 2,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  modeSwitcher: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 4,
  },
  modeTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 999,
  },
  modeTabText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  chipsScroller: {
    maxHeight: 52,
  },
  demoBanner: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 8,
    marginTop: 6,
    marginBottom: 2,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,41,155,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,41,155,0.16)",
  },
  demoBannerText: {
    color: "#F9A8D4",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  chipsRow: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 4,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  chipActive: {
    backgroundColor: "#FF299B",
    borderColor: "#FF7EC8",
  },
  chipText: {
    color: "#D4D4D8",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  chipTextActive: {
    color: "#fff",
  },
  cardArea: {
    alignItems: "center",
    justifyContent: "flex-start",
    marginHorizontal: 16,
    marginTop: 12,
  },
  cardWrapper: {
    position: "absolute",
    width: SCREEN_WIDTH - 32,
    top: 0,
  },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyState: { alignItems: "center", gap: 12, paddingHorizontal: 40 },
  emptyModeIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  emptySubtitle: {
    color: "#A1A1AA",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  emptyLink: { fontSize: 16, fontFamily: "Inter_700Bold" },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 8,
    backgroundColor: "rgba(255,41,155,0.9)",
  },
  refreshText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 24,
    paddingTop: 18,
  },
  matchOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 99,
  },
  matchCard: {
    borderRadius: 28,
    padding: 34,
    alignItems: "center",
    gap: 12,
    width: SCREEN_WIDTH - 52,
  },
  matchEmoji: {
    color: "#fff",
    fontSize: 44,
    fontFamily: "Inter_700Bold",
  },
  matchTitle: {
    color: "#fff",
    fontSize: 32,
    fontFamily: "Inter_700Bold",
  },
  matchSubtitle: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
    fontFamily: "Inter_400Regular",
  },
  matchBtn: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 999,
    paddingHorizontal: 28,
    paddingVertical: 14,
    marginTop: 8,
  },
  matchBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
});

const previewStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  hero: {
    height: SCREEN_HEIGHT * 0.62,
    minHeight: 420,
  },
  heroImage: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  heroShade: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  photoProgress: {
    position: "absolute",
    top: 18,
    left: 16,
    right: 16,
    flexDirection: "row",
    gap: 6,
  },
  photoProgressDot: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  photoProgressDotActive: {
    backgroundColor: "#FFFFFF",
  },
  photoTapRow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "74%",
    flexDirection: "row",
  },
  photoTapZone: {
    flex: 1,
  },
  initialsBubble: {
    width: 136,
    height: 136,
    borderRadius: 68,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  initialsText: {
    color: "#fff",
    fontSize: 44,
    fontFamily: "Inter_700Bold",
  },
  heroTop: {
    position: "absolute",
    top: 58,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroBottom: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 20,
  },
  heroNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heroName: {
    color: "#fff",
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    flex: 1,
  },
  roundButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  matchPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  matchPillText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  locationText: {
    color: "rgba(255,255,255,0.74)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 120,
    gap: 22,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  primaryBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(255,41,155,0.22)",
  },
  primaryBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  secondaryBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  secondaryBadgeText: {
    color: "#F4F4F5",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  vibeCard: {
    borderRadius: 24,
    padding: 16,
    backgroundColor: "rgba(255,41,155,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,41,155,0.18)",
  },
  sectionEyebrow: {
    color: "#F9A8D4",
    fontSize: 11,
    letterSpacing: 1.4,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
  },
  vibeCopy: {
    color: "#FCE7F3",
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
    fontFamily: "Inter_500Medium",
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  interestsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  interestChip: {
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  interestChipText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
    backgroundColor: "rgba(0,0,0,0.94)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  secondaryCta: {
    flex: 1,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  secondaryCtaText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  primaryCta: {
    flex: 1,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    backgroundColor: "#FF299B",
  },
  primaryCtaText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
});
