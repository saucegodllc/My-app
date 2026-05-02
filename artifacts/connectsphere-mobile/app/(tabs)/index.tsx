import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useMemo, useRef, useState, type ComponentProps } from "react";
import {
  Animated,
  Image,
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
  dating: ["For You", "Active Tonight", "Double Dates", "Serious", "Casual", "Nightlife Pros"],
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

// ─── Circle Action Button ──────────────────────────────────────────────────────
type CircleActionDef = {
  label: string;
  iconLib: "ion" | "material";
  iconName: IoniconName | MaterialIconName;
  main?: boolean;
};

function CircleAction({
  def,
  theme,
  onPress,
}: {
  def: CircleActionDef;
  theme: Theme;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.circleWrap, pressed && { transform: [{ scale: 0.93 }] }]}
    >
      <View style={styles.circleBtn}>
        {def.main ? (
          <LinearGradient
            colors={def.main ? theme.accent : ["transparent", "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.circleBtnDefault]} />
        )}
        {def.iconLib === "ion" ? (
          <Ionicons name={def.iconName as IoniconName} size={24} color="#FFFFFF" />
        ) : (
          <MaterialCommunityIcons name={def.iconName as MaterialIconName} size={24} color="#FFFFFF" />
        )}
      </View>
      <Text style={styles.circleLabel}>{def.label}</Text>
    </Pressable>
  );
}

// ─── Intent Actions ────────────────────────────────────────────────────────────
const datingActions: CircleActionDef[] = [
  { label: "Pass", iconLib: "ion", iconName: "close" },
  { label: "Like", iconLib: "ion", iconName: "heart", main: true },
  { label: "Message", iconLib: "ion", iconName: "chatbubble" },
];
const friendsActions: CircleActionDef[] = [
  { label: "Skip", iconLib: "ion", iconName: "close" },
  { label: "Add Friend", iconLib: "ion", iconName: "people", main: true },
  { label: "Invite", iconLib: "ion", iconName: "paper-plane" },
];
const networkingActions: CircleActionDef[] = [
  { label: "Connect", iconLib: "material", iconName: "handshake", main: true },
  { label: "Save Contact", iconLib: "ion", iconName: "person-add" },
  { label: "Message", iconLib: "ion", iconName: "chatbubble" },
];

function IntentActions({
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
      ? datingActions
      : intent === "friends"
      ? friendsActions
      : networkingActions;

  return (
    <View style={styles.actionsRow}>
      {actions.map((def) => (
        <CircleAction key={def.label} def={def} theme={theme} onPress={onAction} />
      ))}
    </View>
  );
}

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

  // Animation refs
  const dragY = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const isAnimating = useRef(false);

  const animateExitAndAdvance = (direction: 1 | -1 = -1) => {
    if (isAnimating.current) return;
    isAnimating.current = true;
    Animated.parallel([
      Animated.timing(dragY, { toValue: direction * 400, duration: 220, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(cardScale, { toValue: 0.94, duration: 220, useNativeDriver: true }),
    ]).start(() => {
      dragY.setValue(90);
      cardOpacity.setValue(0);
      cardScale.setValue(0.94);
      nextCard();
      Animated.parallel([
        Animated.spring(dragY, { toValue: 0, stiffness: 240, damping: 26, useNativeDriver: true }),
        Animated.spring(cardOpacity, { toValue: 1, stiffness: 240, damping: 26, useNativeDriver: true }),
        Animated.spring(cardScale, { toValue: 1, stiffness: 240, damping: 26, useNativeDriver: true }),
      ]).start(() => { isAnimating.current = false; });
    });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: Animated.event([null, { dy: dragY }], { useNativeDriver: false }),
        onPanResponderRelease: (_, g) => {
          if (Math.abs(g.dy) > 80) {
            animateExitAndAdvance(g.dy < 0 ? -1 : 1);
          } else {
            Animated.spring(dragY, { toValue: 0, useNativeDriver: true }).start();
          }
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dragY, cardOpacity, cardScale],
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
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Discover</Text>
            <View style={styles.subtitleRow}>
              <Ionicons name="flame" size={14} color="#EC4899" />
              <Text style={styles.subtitleText}>9 people waiting</Text>
              <View style={styles.greenDot} />
            </View>
          </View>
          <Pressable style={styles.filterBtn}>
            <Ionicons name="options-outline" size={20} color="#E4E4E7" />
          </Pressable>
        </View>

        {/* Intent Tabs */}
        <View style={styles.intentWrap}>
          <View style={styles.intentRow}>
            {tabs.map((tab) => {
              const isActive = activeIntent === tab.id;
              const isAllowed = allowedTabs.some((a) => a.id === tab.id);
              return (
                <Pressable
                  key={tab.id}
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
                      colors={tab.accent}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
                    />
                  ) : null}
                  <View style={styles.intentBtnInner}>
                    <Ionicons
                      name={tab.icon}
                      size={14}
                      color={isActive ? "#FFF" : isAllowed ? "#FFF" : "#3F3F46"}
                    />
                    <Text
                      style={[
                        styles.intentBtnLabel,
                        {
                          color: isActive ? "#FFF" : isAllowed ? "#FFF" : "#3F3F46",
                          opacity: !isAllowed ? 0.35 : 1,
                        },
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
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
                style={styles.subTabBtn}
              >
                {active ? (
                  <LinearGradient
                    colors={theme.accent}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
                  />
                ) : (
                  <View style={[StyleSheet.absoluteFill, styles.subTabInactive]} />
                )}
                <Text style={[styles.subTabLabel, { color: active ? "#FFF" : "#A1A1AA" }]}>
                  {tab}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Mock notice */}
        <View style={styles.notice}>
          <Text style={styles.noticeText}>✨ Showing mock profiles while your real feed is empty.</Text>
        </View>

        {/* Card */}
        <View style={styles.cardArea}>
          {profile ? (
            <Animated.View
              key={`${profile.id}-${cardIndex}-${activeIntent}-${activeSubTab}`}
              {...panResponder.panHandlers}
              style={[
                styles.card,
                { opacity: cardOpacity, transform: [{ translateY: dragY }, { scale: cardScale }] },
              ]}
            >
              <Image source={{ uri: profile.image }} style={styles.cardImage} resizeMode="cover" />

              {/* Dark overlay */}
              <LinearGradient
                colors={["rgba(0,0,0,0.15)", "rgba(0,0,0,0.35)", "#000"]}
                locations={[0, 0.5, 1]}
                style={StyleSheet.absoluteFill}
              />

              {/* Gradient top bar */}
              <LinearGradient
                colors={theme.accent}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.cardTopBar}
              />

              {/* Online + Match pills */}
              <View style={styles.cardPillRow}>
                <View style={styles.pill}>
                  <View style={styles.onlineDot} />
                  <Text style={styles.pillText}>Online</Text>
                </View>
                <View style={styles.pill}>
                  <Text style={styles.pillText}>{profile.matchScore}% Match</Text>
                </View>
              </View>

              {/* Bottom info */}
              <View style={styles.cardBottom}>
                <View style={styles.nameRow}>
                  <Text style={styles.nameText}>
                    {profile.name}, {profile.age}
                  </Text>
                  {profile.verified ? (
                    <Ionicons name="shield-checkmark" size={22} color="#EC4899" />
                  ) : null}
                </View>

                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={14} color="#E4E4E7" />
                  <Text style={styles.locationText}>{profile.location}</Text>
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
                  {profile.interests.map((interest) => (
                    <View key={interest} style={styles.interestChip}>
                      <Text style={styles.interestText}>{interest}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.actionsWrap}>
                  <IntentActions intent={activeIntent} theme={theme} onAction={() => animateExitAndAdvance(-1)} />
                </View>
              </View>
            </Animated.View>
          ) : (
            <EmptyState theme={theme} />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#030303" },

  // Background blobs
  blob1: {
    position: "absolute", top: -96, left: -80,
    width: 288, height: 288, borderRadius: 144,
    backgroundColor: "rgba(236,72,153,0.25)",
    transform: [{ scaleX: 1.2 }],
  },
  blob2: {
    position: "absolute", top: 48, right: -100,
    width: 320, height: 320, borderRadius: 160,
    backgroundColor: "rgba(45,212,191,0.15)",
  },
  blob3: {
    position: "absolute", bottom: 80, left: "25%",
    width: 384, height: 384, borderRadius: 192,
    backgroundColor: "rgba(217,70,239,0.10)",
  },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 32 },

  // Header
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  title: { color: "#FFF", fontSize: 34, fontWeight: "900", letterSpacing: -0.5 },
  subtitleRow: { marginTop: 4, flexDirection: "row", alignItems: "center", gap: 8 },
  subtitleText: { color: "#D4D4D8", fontSize: 13 },
  greenDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: "#34D399",
    shadowColor: "#34D399", shadowOpacity: 1, shadowRadius: 7, shadowOffset: { width: 0, height: 0 },
  },
  filterBtn: {
    marginTop: 8, width: 48, height: 48, borderRadius: 24,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center",
  },

  // Intent tabs
  intentWrap: {
    marginTop: 20, borderRadius: 999,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(0,0,0,0.4)",
    padding: 4,
  },
  intentRow: { flexDirection: "row", gap: 4 },
  intentBtn: { flex: 1, borderRadius: 999, overflow: "hidden" },
  intentBtnInner: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 12, paddingHorizontal: 8,
  },
  intentBtnLabel: { fontSize: 12, fontWeight: "800" },

  // Sub tabs
  subTabsScroll: { marginTop: 12, flexGrow: 0 },
  subTabsContent: { gap: 8, paddingRight: 4, paddingBottom: 4 },
  subTabBtn: {
    borderRadius: 999, overflow: "hidden",
    paddingHorizontal: 16, paddingVertical: 8, justifyContent: "center",
  },
  subTabInactive: {
    borderRadius: 999, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  subTabLabel: { fontSize: 12, fontWeight: "800" },

  // Notice
  notice: {
    marginTop: 12, borderRadius: 999,
    borderWidth: 1, borderColor: "rgba(244,114,182,0.2)",
    backgroundColor: "rgba(236,72,153,0.1)",
    paddingHorizontal: 16, paddingVertical: 8,
  },
  noticeText: { color: "#FCE7F3", fontSize: 12, fontWeight: "700", textAlign: "center" },

  // Card area
  cardArea: { marginTop: 16, minHeight: 560 },
  card: {
    minHeight: 560, borderRadius: 30, overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "#09090B",
    shadowColor: "#000", shadowOpacity: 0.85, shadowRadius: 35, shadowOffset: { width: 0, height: 35 },
    elevation: 14,
  },
  cardImage: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  cardTopBar: { position: "absolute", top: 0, left: 0, right: 0, height: 4 },
  cardPillRow: {
    position: "absolute", top: 16, left: 16, right: 16,
    flexDirection: "row", justifyContent: "space-between",
  },
  pill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
  },
  onlineDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: "#34D399",
    shadowColor: "#34D399", shadowOpacity: 1, shadowRadius: 5, shadowOffset: { width: 0, height: 0 },
  },
  pillText: { color: "#FFF", fontSize: 12, fontWeight: "800" },

  // Card bottom
  cardBottom: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 20 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  nameText: { color: "#FFF", fontSize: 32, fontWeight: "900", letterSpacing: -0.5 },
  locationRow: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 4 },
  locationText: { color: "#E4E4E7", fontSize: 13 },
  badgeRow: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  intentBadge: { borderRadius: 999, overflow: "hidden", paddingHorizontal: 12, paddingVertical: 4 },
  intentBadgeText: { color: "#FFF", fontSize: 12, fontWeight: "900", textTransform: "capitalize" },
  subBadge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: "rgba(255,255,255,0.15)" },
  subBadgeText: { color: "#FFF", fontSize: 12, fontWeight: "700" },
  bioText: { marginTop: 12, color: "#F4F4F5", fontSize: 13, fontWeight: "500", lineHeight: 19 },
  interestsRow: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  interestChip: {
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  interestText: { color: "#FFF", fontSize: 12, fontWeight: "700" },
  actionsWrap: { marginTop: 20 },

  // Circle action buttons
  actionsRow: { flexDirection: "row", justifyContent: "space-around" },
  circleWrap: { alignItems: "center", gap: 8 },
  circleBtn: {
    width: 56, height: 56, borderRadius: 28, overflow: "hidden",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  circleBtnDefault: {
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 28,
  },
  circleLabel: { color: "#E4E4E7", fontSize: 11, fontWeight: "800" },

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
