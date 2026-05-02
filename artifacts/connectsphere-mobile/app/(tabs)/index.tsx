import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useMemo, useRef, useState, type ComponentProps } from "react";
import {
  Animated,
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type IoniconName = ComponentProps<typeof Ionicons>["name"];
type MaterialIconName = ComponentProps<typeof MaterialCommunityIcons>["name"];
type IntentId = "dating" | "friends" | "networking";

type Theme = {
  id: IntentId;
  label: string;
  icon: IoniconName;
  accent: [string, string, string];
  glow: string;
};

type Profile = {
  id: number;
  name: string;
  age: number;
  location: string;
  intent: IntentId;
  subGenre: string;
  bio: string;
  interests: string[];
  matchScore: number;
  online: boolean;
  verified: boolean;
  image: string;
};

const currentUserIntent: IntentId | "all" = "all";

const tabs: Theme[] = [
  {
    id: "dating",
    label: "Dating",
    icon: "flame",
    accent: ["#EC4899", "#D946EF", "#F43F5E"],
    glow: "#EC4899",
  },
  {
    id: "friends",
    label: "Friends",
    icon: "people",
    accent: ["#3B82F6", "#6366F1", "#8B5CF6"],
    glow: "#3B82F6",
  },
  {
    id: "networking",
    label: "Networking",
    icon: "briefcase",
    accent: ["#34D399", "#2DD4BF", "#22D3EE"],
    glow: "#2DD4BF",
  },
];

const subTabs: Record<IntentId, string[]> = {
  dating: ["For You", "Active Tonight", "Double Dates", "Serious", "Miami Local"],
  friends: ["For You", "Brunch", "Gym", "Beach Day", "Events", "New to Miami"],
  networking: ["For You", "Founders", "Creators", "Real Estate", "Nightlife Pros", "Investors"],
};

const profiles: Profile[] = [
  {
    id: 1,
    name: "Maya",
    age: 24,
    location: "Miami, FL",
    intent: "dating",
    subGenre: "Active Tonight",
    bio: "Looking for people to go out and have fun tonight. Love rooftop bars, dancing, and spontaneous plans.",
    interests: ["Nightlife", "Travel", "Dancing", "Yoga"],
    matchScore: 82,
    online: true,
    verified: true,
    image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=90",
  },
  {
    id: 2,
    name: "Sofia",
    age: 25,
    location: "Brickell, Miami",
    intent: "dating",
    subGenre: "Double Dates",
    bio: "Here for fun plans, good energy, and people who actually make it out of the group chat.",
    interests: ["Dancing", "Rooftops", "Fashion", "Sushi"],
    matchScore: 86,
    online: true,
    verified: true,
    image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=90",
  },
  {
    id: 3,
    name: "Ari",
    age: 26,
    location: "South Beach",
    intent: "friends",
    subGenre: "Brunch",
    bio: "New friends, brunch plans, beach days, and people who actually want to go outside.",
    interests: ["Brunch", "Beach", "Events", "Coffee"],
    matchScore: 84,
    online: true,
    verified: false,
    image: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=1200&q=90",
  },
  {
    id: 4,
    name: "Jade",
    age: 23,
    location: "Coral Gables",
    intent: "friends",
    subGenre: "Gym",
    bio: "Looking for workout partners, casual hangs, and girls who love trying new spots.",
    interests: ["Gym", "Pilates", "Smoothies", "Beach"],
    matchScore: 90,
    online: true,
    verified: true,
    image: "https://images.unsplash.com/photo-1524250502761-1ac6f2e30d43?auto=format&fit=crop&w=1200&q=90",
  },
  {
    id: 5,
    name: "Marcus",
    age: 29,
    location: "Wynwood",
    intent: "networking",
    subGenre: "Founders",
    bio: "Building startups, meeting creators, and connecting with people who move with purpose.",
    interests: ["Startups", "AI", "Real Estate", "Creators"],
    matchScore: 92,
    online: false,
    verified: true,
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=1200&q=90",
  },
  {
    id: 6,
    name: "Camila",
    age: 27,
    location: "Design District",
    intent: "networking",
    subGenre: "Creators",
    bio: "Creative director looking to meet founders, artists, nightlife pros, and brand builders.",
    interests: ["Branding", "Events", "Content", "Fashion"],
    matchScore: 88,
    online: true,
    verified: true,
    image: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=1200&q=90",
  },
  {
    id: 7,
    name: "Isabella",
    age: 26,
    location: "Edgewater, Miami",
    intent: "dating",
    subGenre: "Serious",
    bio: "Soft life energy with real intention. Looking for chemistry, consistency, and someone who actually dates with purpose.",
    interests: ["Pilates", "Wine", "Travel", "Reading"],
    matchScore: 92,
    online: true,
    verified: true,
    image: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=1200&q=90",
  },
  {
    id: 8,
    name: "Diego",
    age: 28,
    location: "Brickell, Miami",
    intent: "dating",
    subGenre: "Casual",
    bio: "Big on chemistry, late dinners, and people who can hold a real conversation past midnight.",
    interests: ["Restaurants", "Live Music", "Boxing", "Beach"],
    matchScore: 79,
    online: false,
    verified: false,
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=90",
  },
  {
    id: 9,
    name: "Aaliyah",
    age: 24,
    location: "Wynwood",
    intent: "dating",
    subGenre: "Active Tonight",
    bio: "Looking for someone to actually leave the apartment with tonight. Down for rooftops, dancing, and wherever the vibe takes us.",
    interests: ["Nightlife", "Salsa", "Cocktails", "Art Walks"],
    matchScore: 85,
    online: true,
    verified: true,
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=90",
  },
  {
    id: 10,
    name: "Lucas",
    age: 30,
    location: "Coconut Grove",
    intent: "dating",
    subGenre: "Nightlife Pros",
    bio: "Bartender by night, surfer by morning. If you can keep up with both energies we'll get along.",
    interests: ["Surf", "Mixology", "House Music", "Sunsets"],
    matchScore: 83,
    online: true,
    verified: false,
    image: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=1200&q=90",
  },
  {
    id: 11,
    name: "Priya",
    age: 27,
    location: "Bal Harbour",
    intent: "dating",
    subGenre: "Double Dates",
    bio: "Group dinners, beach days with friends, and meeting another couple to actually do things with.",
    interests: ["Brunch", "Travel", "Tennis", "Sushi"],
    matchScore: 87,
    online: false,
    verified: true,
    image: "https://images.unsplash.com/photo-1521119989659-a83eee488004?auto=format&fit=crop&w=1200&q=90",
  },
  {
    id: 12,
    name: "Zoe",
    age: 25,
    location: "South Beach",
    intent: "friends",
    subGenre: "Beach Day",
    bio: "Beach mornings, iced matcha runs, and a friend group that actually shows up.",
    interests: ["Beach", "Yoga", "Matcha", "Sunsets"],
    matchScore: 82,
    online: true,
    verified: false,
    image: "https://images.unsplash.com/photo-1500917293891-ef795e70e1f6?auto=format&fit=crop&w=1200&q=90",
  },
  {
    id: 13,
    name: "Tyler",
    age: 27,
    location: "Downtown Miami",
    intent: "friends",
    subGenre: "Gym",
    bio: "Looking for gym buddies, recovery brunches, and people who actually stick to plans.",
    interests: ["Lifting", "Running", "Recovery", "Smoothies"],
    matchScore: 76,
    online: true,
    verified: false,
    image: "https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=1200&q=90",
  },
  {
    id: 14,
    name: "Naomi",
    age: 24,
    location: "Aventura",
    intent: "friends",
    subGenre: "New to Miami",
    bio: "Just moved from NYC. Looking for friends to explore neighborhoods, try restaurants, and build a Miami crew.",
    interests: ["Foodie", "Concerts", "Shopping", "Brunch"],
    matchScore: 89,
    online: true,
    verified: true,
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=1200&q=90",
  },
  {
    id: 15,
    name: "Kenji",
    age: 28,
    location: "Wynwood",
    intent: "friends",
    subGenre: "Events",
    bio: "Always know about the cool events. Looking for friends who say yes to gallery nights, pop-ups, and underground shows.",
    interests: ["Art", "Music", "Coffee", "Photography"],
    matchScore: 80,
    online: false,
    verified: true,
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=1200&q=90",
  },
  {
    id: 16,
    name: "Bianca",
    age: 26,
    location: "Coral Gables",
    intent: "friends",
    subGenre: "Brunch",
    bio: "Sunday brunch is sacred. Looking for a girl gang who loves long breakfasts and even longer conversations.",
    interests: ["Brunch", "Wine", "Travel", "Books"],
    matchScore: 85,
    online: true,
    verified: true,
    image: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1200&q=90",
  },
  {
    id: 17,
    name: "Jordan",
    age: 32,
    location: "Brickell",
    intent: "networking",
    subGenre: "Investors",
    bio: "Backing bold South Florida founders in AI, fintech, and consumer social. I like people with edge and execution.",
    interests: ["Venture", "Fintech", "AI", "Founder Dinners"],
    matchScore: 90,
    online: true,
    verified: true,
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=1200&q=90",
  },
  {
    id: 18,
    name: "Selena",
    age: 31,
    location: "South Beach",
    intent: "networking",
    subGenre: "Real Estate",
    bio: "Luxury real estate broker. Connecting buyers, builders, and capital. Always down for a power lunch.",
    interests: ["Real Estate", "Architecture", "Yachts", "Capital"],
    matchScore: 86,
    online: true,
    verified: true,
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1200&q=90",
  },
  {
    id: 19,
    name: "Andre",
    age: 29,
    location: "Wynwood",
    intent: "networking",
    subGenre: "Nightlife Pros",
    bio: "Run two clubs and a hospitality group. Looking to meet promoters, DJs, brand reps, and operators.",
    interests: ["Nightlife", "Hospitality", "Brands", "Music"],
    matchScore: 84,
    online: false,
    verified: true,
    image: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=1200&q=90",
  },
  {
    id: 20,
    name: "Reema",
    age: 26,
    location: "Edgewater",
    intent: "networking",
    subGenre: "Founders",
    bio: "Building a women-led wellness startup. Looking for operators, marketers, and founders to swap notes with.",
    interests: ["Wellness", "Startups", "Branding", "Community"],
    matchScore: 93,
    online: true,
    verified: true,
    image: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=1200&q=90",
  },
  {
    id: 21,
    name: "Theo",
    age: 34,
    location: "Downtown Miami",
    intent: "networking",
    subGenre: "Creators",
    bio: "Director and content lead for nightlife and hospitality brands. Always down to meet photographers, editors, and founders.",
    interests: ["Content", "Film", "Brands", "Events"],
    matchScore: 81,
    online: false,
    verified: false,
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=1200&q=90",
  },
];

// ─── Empty State ───────────────────────────────────────────────────────────────
function EmptyState({ theme }: { theme: Theme }) {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIconWrap}>
        <LinearGradient
          colors={theme.accent}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
        />
        <Ionicons name="sparkles" size={36} color="#FFFFFF" />
      </View>
      <Text style={styles.emptyTitle}>Feed warming up</Text>
      <Text style={styles.emptySubtitle}>
        No profiles in this sub-category yet. Try another vibe or refresh your feed.
      </Text>
      <Pressable style={styles.emptyBtn}>
        <LinearGradient
          colors={theme.accent}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
        />
        <Text style={styles.emptyBtnText}>Refresh Feed</Text>
      </Pressable>
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 16 : insets.top;
  const bottomInset = Platform.OS === "web" ? 56 : 49 + insets.bottom;

  const allowedTabs =
    currentUserIntent === "all"
      ? tabs
      : tabs.filter((tab) => tab.id === currentUserIntent);

  const [activeIntent, setActiveIntent] = useState<IntentId>(allowedTabs[0]!.id);
  const [activeSubTab, setActiveSubTab] = useState("For You");
  const [cardIndex, setCardIndex] = useState(0);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);

  const theme = tabs.find((tab) => tab.id === activeIntent)!;

  const visibleProfiles = useMemo(() => {
    return profiles.filter((profile) => {
      const allowed =
        currentUserIntent === "all" ||
        profile.intent === currentUserIntent ||
        (profile.intent as string) === "all";
      const matchesIntent =
        profile.intent === activeIntent || (profile.intent as string) === "all";
      const matchesSub =
        activeSubTab === "For You" || profile.subGenre === activeSubTab;
      return allowed && matchesIntent && matchesSub;
    });
  }, [activeIntent, activeSubTab]);

  const profile =
    visibleProfiles.length > 0
      ? visibleProfiles[cardIndex % visibleProfiles.length]
      : null;

  const nextCard = () => setCardIndex((prev) => prev + 1);

  // Animation refs (horizontal Tinder-style swipe)
  const dragX = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const isAnimating = useRef(false);

  const cardRotate = dragX.interpolate({
    inputRange: [-300, 0, 300],
    outputRange: ["-15deg", "0deg", "15deg"],
    extrapolate: "clamp",
  });

  const animateExitAndAdvance = (direction: 1 | -1 = 1) => {
    if (isAnimating.current) return;
    isAnimating.current = true;
    Animated.parallel([
      Animated.timing(dragX, { toValue: direction * 600, duration: 240, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 0, duration: 240, useNativeDriver: true }),
      Animated.timing(cardScale, { toValue: 0.94, duration: 240, useNativeDriver: true }),
    ]).start(() => {
      dragX.setValue(0);
      cardOpacity.setValue(0);
      cardScale.setValue(0.94);
      nextCard();
      Animated.parallel([
        Animated.spring(cardOpacity, { toValue: 1, stiffness: 240, damping: 26, useNativeDriver: true }),
        Animated.spring(cardScale, { toValue: 1, stiffness: 240, damping: 26, useNativeDriver: true }),
      ]).start(() => { isAnimating.current = false; });
    });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderMove: Animated.event([null, { dx: dragX }], { useNativeDriver: false }),
        onPanResponderRelease: (_, g) => {
          if (Math.abs(g.dx) > 100) {
            animateExitAndAdvance(g.dx > 0 ? 1 : -1);
          } else {
            Animated.spring(dragX, { toValue: 0, useNativeDriver: true }).start();
          }
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dragX, cardOpacity, cardScale],
  );

  return (
    <View style={[styles.root, { paddingBottom: bottomInset }]}>
      {/* Background glow blobs */}
      <View style={styles.blob1} />
      <View style={styles.blob2} />
      <View style={styles.blob3} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: topInset + 4 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <View style={styles.headerCenter}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Discover </Text>
              <Text style={styles.titleMiami}>Miami</Text>
              <Text style={styles.titlePalm}>  🌴</Text>
            </View>
            <View style={styles.titleUnderlineRow}>
              <View style={styles.titleUnderline} />
              <Text style={styles.subtitleSmall}>DISCOVER. CONNECT. VIBE.</Text>
              <View style={styles.titleUnderline} />
            </View>
          </View>
          <Pressable style={styles.filterBtn}>
            <Ionicons name="options-outline" size={20} color="#FFF" />
          </Pressable>
        </View>

        {/* Intent Tabs */}
        <View style={styles.intentRow}>
          {tabs.map((tab, idx) => {
            const isActive = activeIntent === tab.id;
            const isAllowed = allowedTabs.some((a) => a.id === tab.id);
            return (
              <View key={tab.id} style={styles.intentSlot}>
                <Pressable
                  disabled={!isAllowed}
                  onPress={() => {
                    setActiveIntent(tab.id);
                    setActiveSubTab("For You");
                    setCardIndex(0);
                  }}
                  style={styles.intentBtn}
                >
                  {isActive ? (
                    <LinearGradient
                      colors={["#EC4899", "#F43F5E"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[StyleSheet.absoluteFill, styles.intentBtnActiveBg]}
                    />
                  ) : null}
                  <View style={styles.intentBtnInner}>
                    <Ionicons
                      name={tab.icon}
                      size={16}
                      color={isActive ? "#FFF" : isAllowed ? "#E4E4E7" : "#3F3F46"}
                    />
                    <Text
                      style={[
                        styles.intentBtnLabel,
                        {
                          color: isActive ? "#FFF" : isAllowed ? "#E4E4E7" : "#3F3F46",
                          opacity: !isAllowed ? 0.35 : 1,
                        },
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </View>
                </Pressable>
                {idx < tabs.length - 1 ? <View style={styles.intentSep} /> : null}
              </View>
            );
          })}
        </View>

        {/* Sub Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.subTabsContent}
          style={styles.subTabsScroll}
        >
          {subTabs[activeIntent].map((tab) => {
            const active = activeSubTab === tab;
            return (
              <Pressable
                key={tab}
                onPress={() => { setActiveSubTab(tab); setCardIndex(0); }}
                style={[styles.subTabBtn, active && styles.subTabBtnActive]}
              >
                {active ? (
                  <LinearGradient
                    colors={["#EC4899", "#D946EF", "#F43F5E"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
                  />
                ) : (
                  <View style={[StyleSheet.absoluteFill, styles.subTabInactive]} />
                )}
                <Text style={[styles.subTabLabel, { color: active ? "#FFF" : "#E4E4E7" }]}>
                  {tab}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Premium notice */}
        <Pressable
          style={({ pressed }) => [styles.notice, pressed && { opacity: 0.7 }]}
          onPress={() => setActiveSubTab("Active Tonight")}
          accessibilityRole="button"
          accessibilityLabel="Show people active tonight"
        >
          <View style={styles.noticeLeft}>
            <Ionicons name="flash" size={14} color="#FBBF24" />
            <Text style={styles.noticeText}>Showing people near you who are actually active tonight.</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#A1A1AA" />
        </Pressable>

        {/* Card area with stacked deck */}
        <View style={styles.cardArea}>
          {/* Stacked shadow cards behind */}
          <View style={[styles.deckCard, styles.deck3]} />
          <View style={[styles.deckCard, styles.deck2]} />

          {profile ? (
            <Animated.View
              key={`${profile.id}-${cardIndex}-${activeIntent}-${activeSubTab}`}
              {...panResponder.panHandlers}
              style={[
                styles.card,
                {
                  opacity: cardOpacity,
                  transform: [
                    { translateX: dragX },
                    { rotate: cardRotate },
                    { scale: cardScale },
                  ],
                },
              ]}
            >
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => setSelectedProfile(profile)}
              >
                <Image source={{ uri: profile.image }} style={styles.cardImage} resizeMode="cover" />

                {/* Dark gradient overlay */}
                <LinearGradient
                  colors={["rgba(0,0,0,0.15)", "rgba(0,0,0,0.55)", "#000"]}
                  locations={[0, 0.55, 1]}
                  style={StyleSheet.absoluteFill}
                />

                {/* Online / Offline pill top-left */}
                <View style={[styles.onlinePillTopLeft, !profile.online && styles.offlinePill]}>
                  <View style={[styles.onlineDot, !profile.online && styles.offlineDot]} />
                  <Text style={styles.onlinePillText}>{profile.online ? "Online" : "Offline"}</Text>
                </View>

                {/* Match badge top-right */}
                <View style={styles.matchBadge}>
                  <Text style={styles.matchBadgePct}>{profile.matchScore}%</Text>
                  <Text style={styles.matchBadgeWord}>Match</Text>
                </View>

              </Pressable>

              {/* Bottom info */}
              <View style={styles.cardBottom}>
                <View style={styles.nameRow}>
                  <Text style={styles.nameText}>
                    {profile.name}, {profile.age}
                  </Text>
                  {profile.verified ? (
                    <View style={styles.miniShield}>
                      <Ionicons name="shield-checkmark" size={14} color="#FFF" />
                    </View>
                  ) : null}
                </View>

                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={14} color="#E4E4E7" />
                  <Text style={styles.locationText}>{profile.location}</Text>
                  <View style={styles.greenDotSmall} />
                  <Text style={styles.locationText}>
                    {(((profile.id * 1.3) % 9) + 0.5).toFixed(1)} miles away
                  </Text>
                </View>

                <View style={styles.badgeRow}>
                  <View style={styles.intentBadge}>
                    <LinearGradient
                      colors={theme.accent}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
                    />
                    <Text style={styles.intentBadgeText}>{profile.intent}</Text>
                  </View>
                  <View style={styles.subBadge}>
                    <Text style={styles.subBadgeText}>{profile.subGenre}</Text>
                  </View>
                </View>

                <Text style={styles.bioText} numberOfLines={2}>
                  {profile.bio}
                </Text>

                <View style={styles.interestsRow}>
                  {profile.interests.slice(0, 4).map((interest) => (
                    <View key={interest} style={styles.interestChip}>
                      <Text style={styles.interestText}>{interest}</Text>
                    </View>
                  ))}
                </View>

                {/* Tiny 3-line swipe indicator */}
                <View style={styles.swipeIndicatorWrap}>
                  <View style={styles.swipeIndicatorLine} />
                  <View style={[styles.swipeIndicatorLine, styles.swipeIndicatorLineMid]} />
                  <View style={styles.swipeIndicatorLine} />
                </View>

                {/* Tinder-style swipe controls */}
                <View style={styles.tinderRow}>
                  <Pressable
                    onPress={() => animateExitAndAdvance(-1)}
                    style={({ pressed }) => [
                      styles.tinderBtnWrap,
                      pressed && { transform: [{ scale: 0.94 }] },
                    ]}
                  >
                    <View style={styles.tinderBtnPass}>
                      <Ionicons name="close" size={36} color="#FB7185" />
                    </View>
                    <Text style={styles.tinderBtnLabel}>PASS</Text>
                  </Pressable>

                  <View style={styles.swipeTextWrap}>
                    <Text style={styles.swipeText}>
                      <Text style={styles.swipeArrowPink}>← </Text>
                      SWIPE LEFT OR RIGHT
                      <Text style={styles.swipeArrowGreen}> →</Text>
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => animateExitAndAdvance(1)}
                    style={({ pressed }) => [
                      styles.tinderBtnWrap,
                      pressed && { transform: [{ scale: 0.94 }] },
                    ]}
                  >
                    <View style={styles.tinderBtnLike}>
                      <Ionicons name="heart" size={36} color="#10B981" />
                    </View>
                    <Text style={styles.tinderBtnLabel}>LIKE</Text>
                  </Pressable>
                </View>
              </View>
            </Animated.View>
          ) : (
            <EmptyState theme={theme} />
          )}
        </View>
      </ScrollView>

      <Modal
        visible={selectedProfile !== null}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setSelectedProfile(null)}
      >
        {selectedProfile ? (
          <ExpandedProfile
            profile={selectedProfile}
            theme={theme}
            intent={activeIntent}
            onClose={() => setSelectedProfile(null)}
            onAction={() => {
              setSelectedProfile(null);
              animateExitAndAdvance(-1);
            }}
          />
        ) : null}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#050007" },

  // Background blobs — subtle pink/purple haze (not covering header)
  blob1: {
    position: "absolute", top: 180, left: -120,
    width: 280, height: 280, borderRadius: 140,
    backgroundColor: "rgba(236,72,153,0.10)",
    opacity: 0.9,
  },
  blob2: {
    position: "absolute", top: 480, right: -140,
    width: 320, height: 320, borderRadius: 160,
    backgroundColor: "rgba(168,85,247,0.10)",
  },
  blob3: {
    position: "absolute", bottom: 140, left: "30%",
    width: 320, height: 320, borderRadius: 160,
    backgroundColor: "rgba(217,70,239,0.08)",
  },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 32 },

  // Header
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerSpacer: { width: 44, height: 44 },
  headerCenter: { flex: 1, alignItems: "center" },
  titleRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "center" },
  title: { color: "#FFF", fontSize: 32, fontWeight: "900", letterSpacing: -0.5 },
  titleMiami: {
    color: "#EC4899", fontSize: 34, fontWeight: "700",
    fontStyle: "italic",
    fontFamily: Platform.select({ ios: "Snell Roundhand", android: "cursive", default: "cursive" }),
    textShadowColor: "rgba(236,72,153,0.9)", textShadowRadius: 12, textShadowOffset: { width: 0, height: 0 },
  },
  titlePalm: { fontSize: 28 },
  titleUnderlineRow: {
    marginTop: 6, flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "center",
  },
  titleUnderline: {
    width: 36, height: 1, backgroundColor: "rgba(236,72,153,0.7)",
  },
  subtitleSmall: {
    color: "#FFF", fontSize: 11, fontWeight: "800", letterSpacing: 3,
  },
  filterBtn: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1, borderColor: "rgba(236,72,153,0.55)",
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#EC4899", shadowOpacity: 0.7, shadowRadius: 16, shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },

  // Intent tabs — black glass with pink glow on active
  intentRow: {
    marginTop: 22, flexDirection: "row", alignItems: "center",
    borderRadius: 999, borderWidth: 1, borderColor: "rgba(236,72,153,0.22)",
    backgroundColor: "rgba(0,0,0,0.55)",
    padding: 5,
    shadowColor: "#EC4899", shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 0 },
  },
  intentSlot: { flex: 1, flexDirection: "row", alignItems: "center" },
  intentBtn: { flex: 1, borderRadius: 999, overflow: "hidden", minHeight: 46, justifyContent: "center" },
  intentBtnActiveBg: {
    borderRadius: 999,
    shadowColor: "#EC4899", shadowOpacity: 0.95, shadowRadius: 24, shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  intentBtnInner: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 12, paddingHorizontal: 8,
  },
  intentBtnLabel: { fontSize: 13, fontWeight: "800" },
  intentSep: { width: 1, height: 22, backgroundColor: "rgba(255,255,255,0.12)" },

  // Sub tabs
  subTabsScroll: { marginTop: 14, flexGrow: 0 },
  subTabsContent: { gap: 8, paddingRight: 4, paddingBottom: 4 },
  subTabBtn: {
    borderRadius: 999, overflow: "hidden",
    paddingHorizontal: 16, paddingVertical: 9, justifyContent: "center",
    minHeight: 36,
  },
  subTabBtnActive: {
    shadowColor: "#EC4899", shadowOpacity: 0.7, shadowRadius: 16, shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  subTabInactive: {
    borderRadius: 999, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  subTabLabel: { fontSize: 12, fontWeight: "800" },

  // Notice — black glass with pink border
  notice: {
    marginTop: 14, borderRadius: 999,
    borderWidth: 1, borderColor: "rgba(236,72,153,0.4)",
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 16, paddingVertical: 11,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    shadowColor: "#EC4899", shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 0 },
  },
  noticeLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  noticeText: { color: "#FCE7F3", fontSize: 12, fontWeight: "700" },

  // Card area + deck
  cardArea: { marginTop: 18, minHeight: 760, alignItems: "stretch", justifyContent: "flex-start" },
  deckCard: {
    position: "absolute", left: 0, right: 0, top: 0,
    height: 760, borderRadius: 32,
    borderWidth: 1, borderColor: "rgba(236,72,153,0.18)",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  deck2: { left: 10, right: 10, top: 8, height: 752, opacity: 0.55 },
  deck3: { left: 20, right: 20, top: 16, height: 744, opacity: 0.3 },

  card: {
    minHeight: 760, borderRadius: 32, overflow: "hidden",
    borderWidth: 1.5, borderColor: "rgba(236,72,153,0.85)",
    backgroundColor: "#09090B",
    shadowColor: "#EC4899", shadowOpacity: 0.85, shadowRadius: 40, shadowOffset: { width: 0, height: 0 },
    elevation: 24,
  },
  cardImage: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },

  // Top overlays
  onlinePillTopLeft: {
    position: "absolute", top: 16, left: 16,
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1, borderColor: "rgba(52,211,153,0.4)",
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
  },
  offlinePill: { borderColor: "rgba(255,255,255,0.18)" },
  onlineDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: "#34D399",
    shadowColor: "#34D399", shadowOpacity: 1, shadowRadius: 5, shadowOffset: { width: 0, height: 0 },
  },
  offlineDot: { backgroundColor: "#71717A", shadowOpacity: 0 },
  onlinePillText: { color: "#FFF", fontSize: 12, fontWeight: "800" },
  matchBadge: {
    position: "absolute", top: 16, right: 16,
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 1.5, borderColor: "rgba(236,72,153,0.7)",
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#EC4899", shadowOpacity: 0.6, shadowRadius: 16, shadowOffset: { width: 0, height: 0 },
  },
  matchBadgePct: { color: "#FFF", fontSize: 16, fontWeight: "900" },
  matchBadgeWord: { color: "#FBCFE8", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  // Card bottom info
  cardBottom: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 20 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  nameText: { color: "#FFF", fontSize: 30, fontWeight: "900", letterSpacing: -0.5 },
  miniShield: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "#EC4899",
    alignItems: "center", justifyContent: "center",
  },
  locationRow: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 6 },
  locationText: { color: "#E4E4E7", fontSize: 13, fontWeight: "600" },
  greenDotSmall: {
    width: 7, height: 7, borderRadius: 4, backgroundColor: "#34D399",
    marginLeft: 4,
  },
  badgeRow: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  intentBadge: { borderRadius: 999, overflow: "hidden", paddingHorizontal: 14, paddingVertical: 5 },
  intentBadgeText: { color: "#FFF", fontSize: 12, fontWeight: "900", textTransform: "capitalize" },
  subBadge: {
    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 5,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  subBadgeText: { color: "#FFF", fontSize: 12, fontWeight: "700" },
  bioText: { marginTop: 12, color: "#F4F4F5", fontSize: 13, fontWeight: "500", lineHeight: 19 },
  interestsRow: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  interestChip: {
    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  interestText: { color: "#FFF", fontSize: 12, fontWeight: "700" },

  // Tiny 3-line swipe indicator above controls
  swipeIndicatorWrap: {
    marginTop: 18, flexDirection: "column", alignItems: "center", gap: 3,
  },
  swipeIndicatorLine: {
    width: 28, height: 2, borderRadius: 1,
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  swipeIndicatorLineMid: {
    width: 36, backgroundColor: "rgba(236,72,153,0.7)",
  },

  // Tinder action row
  tinderRow: {
    marginTop: 18, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  tinderBtnWrap: { alignItems: "center", gap: 8 },
  tinderBtnPass: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 1.5, borderColor: "rgba(244,63,94,0.55)",
    backgroundColor: "rgba(244,63,94,0.14)",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#F43F5E", shadowOpacity: 0.95, shadowRadius: 32, shadowOffset: { width: 0, height: 0 },
    elevation: 14,
  },
  tinderBtnLike: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 1.5, borderColor: "rgba(16,185,129,0.6)",
    backgroundColor: "rgba(16,185,129,0.14)",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#10B981", shadowOpacity: 0.95, shadowRadius: 32, shadowOffset: { width: 0, height: 0 },
    elevation: 14,
  },
  tinderBtnLabel: {
    color: "#FFF", fontSize: 11, fontWeight: "900", letterSpacing: 3,
  },
  swipeTextWrap: { paddingBottom: 28, flex: 1, alignItems: "center" },
  swipeText: {
    color: "#D4D4D8", fontSize: 11, fontWeight: "900", letterSpacing: 2, textAlign: "center",
  },
  swipeArrowPink: { color: "#F472B6" },
  swipeArrowGreen: { color: "#6EE7B7" },

  // Empty state
  emptyCard: {
    minHeight: 560, borderRadius: 30,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 32, alignItems: "center", justifyContent: "center",
  },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    overflow: "hidden", alignItems: "center", justifyContent: "center",
  },
  emptyTitle: { marginTop: 20, color: "#FFF", fontSize: 22, fontWeight: "900" },
  emptySubtitle: {
    marginTop: 8, color: "#A1A1AA", fontSize: 13, textAlign: "center", lineHeight: 20,
  },
  emptyBtn: {
    marginTop: 20, borderRadius: 999, overflow: "hidden",
    paddingHorizontal: 24, paddingVertical: 12,
    alignItems: "center", justifyContent: "center",
  },
  emptyBtnText: { color: "#FFF", fontSize: 14, fontWeight: "900" },
});

// ─── Expanded Profile Modal ────────────────────────────────────────────────────
function ExpandedProfile({
  profile,
  theme,
  intent,
  onClose,
  onAction,
}: {
  profile: Profile;
  theme: Theme;
  intent: IntentId;
  onClose: () => void;
  onAction: () => void;
}) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 16 : insets.top;
  const bottomPad = Platform.OS === "web" ? 24 : insets.bottom + 16;

  return (
    <View style={expStyles.root}>
      <ScrollView
        style={expStyles.scroll}
        contentContainerStyle={[expStyles.scrollContent, { paddingBottom: 160 + bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero image section */}
        <View style={expStyles.hero}>
          <Image source={{ uri: profile.image }} style={expStyles.heroImage} resizeMode="cover" />

          <LinearGradient
            colors={["rgba(0,0,0,0.2)", "rgba(0,0,0,0.3)", "#050505"]}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFill}
          />

          {/* Top buttons */}
          <View style={[expStyles.topBtnRow, { top: topPad + 4 }]}>
            <Pressable onPress={onClose} style={expStyles.iconBtn}>
              <Ionicons name="close" size={26} color="#FFF" />
            </Pressable>
            <Pressable style={expStyles.iconBtn}>
              <Ionicons name="options-outline" size={22} color="#FFF" />
            </Pressable>
          </View>

          {/* Hero bottom info */}
          <View style={expStyles.heroBottom}>
            <View style={expStyles.heroTopRow}>
              <View style={{ flex: 1 }}>
                <View style={expStyles.heroNameRow}>
                  <Text style={expStyles.heroName}>
                    {profile.name}, {profile.age}
                  </Text>
                  {profile.verified ? (
                    <Ionicons name="shield-checkmark" size={26} color="#EC4899" />
                  ) : null}
                </View>

                <View style={expStyles.heroSubRow}>
                  <Ionicons name="location-outline" size={14} color="#E4E4E7" />
                  <Text style={expStyles.heroSubText}>{profile.location}</Text>
                  <Text style={expStyles.heroSubDot}>•</Text>
                  <View style={expStyles.heroOnlineDot} />
                  <Text style={expStyles.heroSubText}>Online</Text>
                </View>
              </View>

              <View style={expStyles.matchBadge}>
                <Text style={expStyles.matchBadgeText}>{profile.matchScore}% Match</Text>
              </View>
            </View>

            <View style={expStyles.badgeRow}>
              <View style={expStyles.intentBadge}>
                <LinearGradient
                  colors={theme.accent}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
                />
                <Text style={expStyles.intentBadgeText}>{profile.intent}</Text>
              </View>
              <View style={expStyles.subBadge}>
                <Text style={expStyles.subBadgeText}>{profile.subGenre}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Body content */}
        <View style={expStyles.body}>
          <Text style={expStyles.bio}>{profile.bio}</Text>

          <View style={expStyles.divider} />

          <View>
            <Text style={expStyles.sectionTitle}>About Me</Text>
            <View style={expStyles.infoGrid}>
              <InfoPill label="Height" value="5'6&quot;" />
              <InfoPill label="Sign" value="Scorpio" />
              <InfoPill label="School" value="University of Miami" />
              <InfoPill label="Vibe" value="Social" />
            </View>
          </View>

          <View style={expStyles.section}>
            <Text style={expStyles.sectionTitle}>Interests</Text>
            <View style={expStyles.interestsRow}>
              {profile.interests.map((interest) => (
                <View key={interest} style={expStyles.interestChip}>
                  <Text style={expStyles.interestText}>{interest}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={expStyles.section}>
            <Text style={expStyles.sectionTitle}>My Vibe</Text>
            <View style={expStyles.vibeGrid}>
              <MiniPhoto image={profile.image} />
              <MiniPhoto image="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80" />
              <MiniPhoto image="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80" />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom action bar */}
      <View style={[expStyles.bottomBar, { paddingBottom: bottomPad }]}>
        <BigActionsBar intent={intent} theme={theme} onAction={onAction} />
      </View>
    </View>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={expStyles.infoPill}>
      <Text style={expStyles.infoPillLabel}>{label}</Text>
      <Text style={expStyles.infoPillValue}>{value}</Text>
    </View>
  );
}

function MiniPhoto({ image }: { image: string }) {
  return (
    <View style={expStyles.miniPhoto}>
      <Image source={{ uri: image }} style={expStyles.miniPhotoImage} resizeMode="cover" />
    </View>
  );
}

type BigActionDef = {
  label: string;
  iconLib: "ion" | "material";
  iconName: IoniconName | MaterialIconName;
  main?: boolean;
};

const datingBigActions: BigActionDef[] = [
  { label: "Pass", iconLib: "ion", iconName: "close" },
  { label: "Like", iconLib: "ion", iconName: "heart", main: true },
  { label: "Message", iconLib: "ion", iconName: "chatbubble" },
];
const friendsBigActions: BigActionDef[] = [
  { label: "Skip", iconLib: "ion", iconName: "close" },
  { label: "Add Friend", iconLib: "ion", iconName: "people", main: true },
  { label: "Invite", iconLib: "ion", iconName: "paper-plane" },
];
const networkingBigActions: BigActionDef[] = [
  { label: "Connect", iconLib: "material", iconName: "handshake", main: true },
  { label: "Save", iconLib: "ion", iconName: "person-add" },
  { label: "Message", iconLib: "ion", iconName: "chatbubble" },
];

function BigActionsBar({
  intent,
  theme,
  onAction,
}: {
  intent: IntentId;
  theme: Theme;
  onAction: () => void;
}) {
  const actions =
    intent === "dating"
      ? datingBigActions
      : intent === "friends"
      ? friendsBigActions
      : networkingBigActions;

  return (
    <View style={expStyles.bigActionsRow}>
      {actions.map((def) => (
        <BigAction key={def.label} def={def} theme={theme} onPress={onAction} />
      ))}
    </View>
  );
}

function BigAction({
  def,
  theme,
  onPress,
}: {
  def: BigActionDef;
  theme: Theme;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [expStyles.bigWrap, pressed && { transform: [{ scale: 0.93 }] }]}
    >
      <View style={expStyles.bigBtn}>
        {def.main ? (
          <LinearGradient
            colors={theme.accent}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, expStyles.bigBtnDefault]} />
        )}
        {def.iconLib === "ion" ? (
          <Ionicons name={def.iconName as IoniconName} size={30} color="#FFF" />
        ) : (
          <MaterialCommunityIcons name={def.iconName as MaterialIconName} size={30} color="#FFF" />
        )}
      </View>
      <Text style={expStyles.bigLabel}>{def.label}</Text>
    </Pressable>
  );
}

const expStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#050505" },
  scroll: { flex: 1 },
  scrollContent: {},

  hero: { position: "relative", minHeight: 470, height: 540, overflow: "hidden" },
  heroImage: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },

  topBtnRow: {
    position: "absolute", left: 16, right: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  iconBtn: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center", justifyContent: "center",
  },

  heroBottom: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 20 },
  heroTopRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 16 },
  heroNameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  heroName: { color: "#FFF", fontSize: 40, fontWeight: "900", letterSpacing: -1 },
  heroSubRow: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  heroSubText: { color: "#E4E4E7", fontSize: 13 },
  heroSubDot: { color: "#E4E4E7", fontSize: 13 },
  heroOnlineDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: "#34D399",
    shadowColor: "#34D399", shadowOpacity: 1, shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
  },

  matchBadge: {
    borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8,
    borderWidth: 1, borderColor: "rgba(244,114,182,0.3)",
    backgroundColor: "rgba(236,72,153,0.15)",
  },
  matchBadgeText: { color: "#FBCFE8", fontSize: 13, fontWeight: "900" },

  badgeRow: { marginTop: 16, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  intentBadge: { borderRadius: 999, overflow: "hidden", paddingHorizontal: 16, paddingVertical: 6 },
  intentBadgeText: { color: "#FFF", fontSize: 12, fontWeight: "900", textTransform: "capitalize" },
  subBadge: {
    borderRadius: 999, paddingHorizontal: 16, paddingVertical: 6,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  subBadgeText: { color: "#FFF", fontSize: 12, fontWeight: "700" },

  body: { paddingHorizontal: 20 },
  bio: { marginTop: 12, color: "#F4F4F5", fontSize: 15, lineHeight: 24 },
  divider: { marginVertical: 20, height: 1, backgroundColor: "rgba(255,255,255,0.1)" },
  section: { marginTop: 24 },
  sectionTitle: { color: "#F472B6", fontSize: 13, fontWeight: "900" },

  infoGrid: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 12 },
  infoPill: {
    flexBasis: "47%", flexGrow: 1,
    borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  infoPillLabel: { color: "#71717A", fontSize: 11, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  infoPillValue: { marginTop: 4, color: "#FFF", fontSize: 14, fontWeight: "900" },

  interestsRow: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  interestChip: {
    borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  interestText: { color: "#F4F4F5", fontSize: 14, fontWeight: "700" },

  vibeGrid: { marginTop: 12, flexDirection: "row", gap: 12 },
  miniPhoto: {
    flex: 1, height: 112, borderRadius: 16, overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  miniPhotoImage: { width: "100%", height: "100%" },

  bottomBar: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(0,0,0,0.85)",
    paddingHorizontal: 20, paddingTop: 16,
  },
  bigActionsRow: { flexDirection: "row", justifyContent: "space-around" },
  bigWrap: { alignItems: "center", gap: 8 },
  bigBtn: {
    width: 64, height: 64, borderRadius: 32, overflow: "hidden",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
  },
  bigBtnDefault: { backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 32 },
  bigLabel: { color: "#E4E4E7", fontSize: 12, fontWeight: "700" },
});
