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

type IntentTab = {
  id: IntentId;
  label: string;
  icon: IoniconName;
  accent: [string, string];
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
  image: string;
};

type ActionDef = {
  label: string;
  iconLib: "ion" | "material";
  iconName: IoniconName | MaterialIconName;
  hot?: boolean;
};

const currentUserIntent: IntentId | "all" = "all";

const intentTabs: IntentTab[] = [
  {
    id: "dating",
    label: "Dating",
    icon: "flame",
    accent: ["#EC4899", "#D946EF"],
  },
  {
    id: "friends",
    label: "Friends",
    icon: "people",
    accent: ["#8B5CF6", "#3B82F6"],
  },
  {
    id: "networking",
    label: "Networking",
    icon: "briefcase",
    accent: ["#10B981", "#FACC15"],
  },
];

const subTabs: Record<IntentId, string[]> = {
  dating: ["For You", "Active Tonight", "Double Dates", "Serious", "Casual", "Miami Nightlife"],
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
    interests: ["Nightlife", "Travel", "Yoga", "Foodie"],
    matchScore: 78,
    online: true,
    image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80",
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
    image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=80",
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
    image: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=900&q=80",
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
    matchScore: 81,
    online: false,
    image: "https://images.unsplash.com/photo-1524250502761-1ac6f2e30d43?auto=format&fit=crop&w=900&q=80",
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
    matchScore: 91,
    online: false,
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=900&q=80",
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
    image: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=900&q=80",
  },
  // --- Additional Dating profiles ---
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
    image: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=900&q=80",
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
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=80",
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
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 10,
    name: "Lucas",
    age: 30,
    location: "Coconut Grove",
    intent: "dating",
    subGenre: "Miami Nightlife",
    bio: "Bartender by night, surfer by morning. If you can keep up with both energies we'll get along.",
    interests: ["Surf", "Mixology", "House Music", "Sunsets"],
    matchScore: 83,
    online: true,
    image: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=900&q=80",
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
    image: "https://images.unsplash.com/photo-1521119989659-a83eee488004?auto=format&fit=crop&w=900&q=80",
  },
  // --- Additional Friends profiles ---
  {
    id: 12,
    name: "Zoe",
    age: 25,
    location: "South Beach",
    intent: "friends",
    subGenre: "Beach Day",
    bio: "Beach mornings, iced matcha runs, and a friend group that actually shows up. Down for spontaneous plans.",
    interests: ["Beach", "Yoga", "Matcha", "Sunsets"],
    matchScore: 82,
    online: true,
    image: "https://images.unsplash.com/photo-1500917293891-ef795e70e1f6?auto=format&fit=crop&w=900&q=80",
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
    image: "https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 14,
    name: "Naomi",
    age: 24,
    location: "Aventura",
    intent: "friends",
    subGenre: "New to Miami",
    bio: "Just moved from NYC. Looking for friends to explore new neighborhoods, try restaurants, and build a Miami crew with.",
    interests: ["Foodie", "Concerts", "Shopping", "Brunch"],
    matchScore: 89,
    online: true,
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=900&q=80",
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
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=900&q=80",
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
    image: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&q=80",
  },
  // --- Additional Networking profiles ---
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
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=900&q=80",
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
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 19,
    name: "Andre",
    age: 29,
    location: "Wynwood",
    intent: "networking",
    subGenre: "Nightlife Pros",
    bio: "Run two clubs and a hospitality group. Looking to meet promoters, DJs, brand reps, and operators who move things.",
    interests: ["Nightlife", "Hospitality", "Brands", "Music"],
    matchScore: 84,
    online: false,
    image: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=900&q=80&sat=-20",
  },
  {
    id: 20,
    name: "Reema",
    age: 26,
    location: "Edgewater",
    intent: "networking",
    subGenre: "Founders",
    bio: "Building a women-led wellness startup. Looking for operators, marketers, and other founders to swap notes with.",
    interests: ["Wellness", "Startups", "Branding", "Community"],
    matchScore: 93,
    online: true,
    image: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=900&q=80",
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
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=900&q=80&sat=-15",
  },
];

const datingActions: ActionDef[] = [
  { label: "Pass", iconLib: "ion", iconName: "close" },
  { label: "Like", iconLib: "ion", iconName: "heart", hot: true },
  { label: "Message", iconLib: "ion", iconName: "chatbubble" },
];

const friendsActions: ActionDef[] = [
  { label: "Skip", iconLib: "ion", iconName: "close" },
  { label: "Add Friend", iconLib: "ion", iconName: "person-add", hot: true },
  { label: "Invite", iconLib: "ion", iconName: "calendar" },
];

const networkingActions: ActionDef[] = [
  { label: "Connect", iconLib: "material", iconName: "handshake", hot: true },
  { label: "Save", iconLib: "ion", iconName: "bookmark" },
  { label: "Message", iconLib: "ion", iconName: "chatbubble" },
];

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 16 : insets.top;
  const bottomInset = Platform.OS === "web" ? 56 : 49 + insets.bottom;

  const allowedTabs =
    currentUserIntent === "all"
      ? intentTabs
      : intentTabs.filter((tab) => tab.id === currentUserIntent);

  const [activeIntent, setActiveIntent] = useState<IntentId>(allowedTabs[0]!.id);
  const [activeSubTab, setActiveSubTab] = useState("For You");
  const [cardIndex, setCardIndex] = useState(0);

  const activeTheme = intentTabs.find((tab) => tab.id === activeIntent)!;

  const filteredProfiles = useMemo(() => {
    return profiles.filter((profile) => {
      const userCanSee =
        currentUserIntent === "all" ||
        profile.intent === currentUserIntent ||
        (profile.intent as string) === "all";
      const matchesMainTab =
        profile.intent === activeIntent || (profile.intent as string) === "all";
      const matchesSubTab =
        activeSubTab === "For You" || profile.subGenre === activeSubTab;
      return userCanSee && matchesMainTab && matchesSubTab;
    });
  }, [activeIntent, activeSubTab]);

  const currentProfile =
    filteredProfiles.length > 0
      ? filteredProfiles[cardIndex % filteredProfiles.length]
      : null;

  const changeIntent = (intent: IntentId) => {
    setActiveIntent(intent);
    setActiveSubTab("For You");
    setCardIndex(0);
  };

  const nextCard = () => {
    setCardIndex((prev) => prev + 1);
  };

  const dragY = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const isAnimating = useRef(false);

  const animateExitAndAdvance = (direction: 1 | -1 = -1) => {
    if (isAnimating.current) return;
    isAnimating.current = true;
    Animated.parallel([
      Animated.timing(dragY, {
        toValue: direction * 400,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(cardScale, {
        toValue: 0.94,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Reset for the incoming card and swap content
      dragY.setValue(80);
      cardOpacity.setValue(0);
      cardScale.setValue(0.96);
      nextCard();
      Animated.parallel([
        Animated.spring(dragY, {
          toValue: 0,
          stiffness: 220,
          damping: 26,
          useNativeDriver: true,
        }),
        Animated.spring(cardOpacity, {
          toValue: 1,
          stiffness: 220,
          damping: 26,
          useNativeDriver: true,
        }),
        Animated.spring(cardScale, {
          toValue: 1,
          stiffness: 220,
          damping: 26,
          useNativeDriver: true,
        }),
      ]).start(() => {
        isAnimating.current = false;
      });
    });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: Animated.event([null, { dy: dragY }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: (_, gesture) => {
          if (Math.abs(gesture.dy) > 90) {
            animateExitAndAdvance(gesture.dy < 0 ? -1 : 1);
          } else {
            Animated.spring(dragY, {
              toValue: 0,
              useNativeDriver: true,
            }).start();
          }
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dragY, cardOpacity, cardScale]
  );

  const actionsForIntent =
    activeIntent === "dating"
      ? datingActions
      : activeIntent === "friends"
      ? friendsActions
      : networkingActions;

  return (
    <View style={[styles.root, { paddingBottom: bottomInset }]}>
      <View style={[styles.glow1]} />
      <View style={[styles.glow2]} />

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

          <Pressable style={styles.filterButton}>
            <Ionicons name="options-outline" size={20} color="#E4E4E7" />
          </Pressable>
        </View>

        {/* Intent tabs */}
        <View style={styles.intentTabsWrap}>
          <View style={styles.intentTabsRow}>
            {intentTabs.map((tab) => {
              const isAllowed = allowedTabs.some((allowed) => allowed.id === tab.id);
              const isActive = activeIntent === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  disabled={!isAllowed}
                  onPress={() => isAllowed && changeIntent(tab.id)}
                  style={styles.intentTabPressable}
                >
                  {isActive ? (
                    <LinearGradient
                      colors={tab.accent}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={StyleSheet.absoluteFill}
                    />
                  ) : null}
                  <View style={styles.intentTabInner}>
                    <Ionicons
                      name={tab.icon}
                      size={14}
                      color={
                        isActive ? "#FFFFFF" : isAllowed ? "#A1A1AA" : "#3F3F46"
                      }
                    />
                    <Text
                      style={[
                        styles.intentTabLabel,
                        {
                          color: isActive
                            ? "#FFFFFF"
                            : isAllowed
                            ? "#A1A1AA"
                            : "#3F3F46",
                          opacity: !isAllowed ? 0.4 : 1,
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

        {/* Sub tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.subTabsRow}
          style={styles.subTabsScroll}
        >
          {subTabs[activeIntent].map((tab) => {
            const active = activeSubTab === tab;
            return (
              <Pressable
                key={tab}
                onPress={() => {
                  setActiveSubTab(tab);
                  setCardIndex(0);
                }}
                style={styles.subTabPressable}
              >
                {active ? (
                  <LinearGradient
                    colors={activeTheme.accent}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
                  />
                ) : (
                  <View style={[StyleSheet.absoluteFill, styles.subTabInactiveBg]} />
                )}
                <Text
                  style={[
                    styles.subTabLabel,
                    { color: active ? "#FFFFFF" : "#A1A1AA" },
                  ]}
                >
                  {tab}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Mock notice */}
        <View style={styles.mockNotice}>
          <Text style={styles.mockNoticeText}>
            ✨ Showing mock profiles while your real feed is empty.
          </Text>
        </View>

        {/* Card area */}
        <View style={styles.cardArea}>
          {currentProfile ? (
            <Animated.View
              key={`${currentProfile.id}-${cardIndex}-${activeIntent}-${activeSubTab}`}
              {...panResponder.panHandlers}
              style={[
                styles.card,
                {
                  opacity: cardOpacity,
                  transform: [{ translateY: dragY }, { scale: cardScale }],
                },
              ]}
            >
              <Image
                source={{ uri: currentProfile.image }}
                style={styles.cardImage}
                resizeMode="cover"
              />

              <LinearGradient
                colors={["rgba(0,0,0,0.1)", "rgba(0,0,0,0.25)", "#000000"]}
                locations={[0, 0.55, 1]}
                style={StyleSheet.absoluteFill}
              />

              {/* Top pills */}
              <View style={styles.cardTopRow}>
                <View style={styles.statusPill}>
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor: currentProfile.online ? "#34D399" : "#71717A",
                      },
                    ]}
                  />
                  <Text style={styles.pillText}>
                    {currentProfile.online ? "Online" : "Offline"}
                  </Text>
                </View>
                <View style={styles.matchPill}>
                  <Text style={styles.pillText}>{currentProfile.matchScore}% Match</Text>
                </View>
              </View>

              {/* Bottom info */}
              <View style={styles.cardBottom}>
                <View style={styles.cardNameRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName}>
                      {currentProfile.name}, {currentProfile.age}
                    </Text>
                    <View style={styles.locationRow}>
                      <Ionicons name="location-outline" size={14} color="#E4E4E7" />
                      <Text style={styles.locationText}>{currentProfile.location}</Text>
                    </View>
                  </View>

                  <Pressable onPress={() => animateExitAndAdvance(-1)} style={styles.checkButton}>
                    <LinearGradient
                      colors={activeTheme.accent}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <Ionicons name="checkmark-circle" size={28} color="#FFFFFF" />
                  </Pressable>
                </View>

                {/* Tag badges */}
                <View style={styles.badgeRow}>
                  <View style={styles.intentBadge}>
                    <LinearGradient
                      colors={activeTheme.accent}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
                    />
                    <Text style={styles.intentBadgeText}>{currentProfile.intent}</Text>
                  </View>
                  <View style={styles.subBadge}>
                    <Text style={styles.subBadgeText}>{currentProfile.subGenre}</Text>
                  </View>
                </View>

                <Text style={styles.bioText} numberOfLines={2}>
                  {currentProfile.bio}
                </Text>

                {/* Interests chips */}
                <View style={styles.interestsRow}>
                  {currentProfile.interests.map((interest) => (
                    <View key={interest} style={styles.interestChip}>
                      <Text style={styles.interestText}>{interest}</Text>
                    </View>
                  ))}
                </View>

                {/* Action buttons */}
                <View style={styles.actionsRow}>
                  {actionsForIntent.map((action) => (
                    <Pressable
                      key={action.label}
                      onPress={() => animateExitAndAdvance(-1)}
                      style={({ pressed }) => [
                        styles.actionBtn,
                        action.hot ? styles.actionBtnHot : styles.actionBtnDefault,
                        pressed && { transform: [{ scale: 0.95 }] },
                      ]}
                    >
                      {action.iconLib === "ion" ? (
                        <Ionicons
                          name={action.iconName as IoniconName}
                          size={20}
                          color="#FFFFFF"
                        />
                      ) : (
                        <MaterialCommunityIcons
                          name={action.iconName as MaterialIconName}
                          size={20}
                          color="#FFFFFF"
                        />
                      )}
                      <Text style={styles.actionBtnLabel}>{action.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </Animated.View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No profiles here yet</Text>
              <Text style={styles.emptySubtitle}>
                Try another sub-tab or intent category.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#050505",
  },
  glow1: {
    position: "absolute",
    top: -120,
    left: -80,
    width: 320,
    height: 320,
    borderRadius: 320,
    backgroundColor: "rgba(236,72,153,0.16)",
    opacity: 0.9,
  },
  glow2: {
    position: "absolute",
    top: -120,
    right: -80,
    width: 320,
    height: 320,
    borderRadius: 320,
    backgroundColor: "rgba(16,185,129,0.12)",
    opacity: 0.9,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  subtitleRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  subtitleText: {
    color: "#A1A1AA",
    fontSize: 13,
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#34D399",
    shadowColor: "#34D399",
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  filterButton: {
    marginTop: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Intent tabs
  intentTabsWrap: {
    marginTop: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(9,9,11,0.8)",
    padding: 4,
  },
  intentTabsRow: {
    flexDirection: "row",
    gap: 4,
  },
  intentTabPressable: {
    flex: 1,
    borderRadius: 999,
    overflow: "hidden",
  },
  intentTabInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  intentTabLabel: {
    fontSize: 12,
    fontWeight: "800",
  },

  // Sub tabs
  subTabsScroll: {
    marginTop: 12,
    flexGrow: 0,
  },
  subTabsRow: {
    gap: 8,
    paddingRight: 4,
    paddingBottom: 4,
  },
  subTabPressable: {
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: "center",
  },
  subTabInactiveBg: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  subTabLabel: {
    fontSize: 12,
    fontWeight: "800",
  },

  // Mock notice
  mockNotice: {
    marginTop: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(244,114,182,0.2)",
    backgroundColor: "rgba(236,72,153,0.1)",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  mockNoticeText: {
    color: "#FBCFE8",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },

  // Card area
  cardArea: {
    marginTop: 16,
    minHeight: 590,
    position: "relative",
  },
  card: {
    minHeight: 590,
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "#18181B",
    shadowColor: "#000",
    shadowOpacity: 0.75,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 30 },
    elevation: 12,
  },
  cardImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },

  // Top pills
  cardTopRow: {
    position: "absolute",
    top: 16,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  matchPill: {
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },

  // Bottom card area
  cardBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
  },
  cardNameRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
  },
  cardName: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  locationRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    color: "#E4E4E7",
    fontSize: 13,
  },
  checkButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#EC4899",
    shadowOpacity: 0.55,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },

  // Badges
  badgeRow: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  intentBadge: {
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  intentBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },
  subBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  subBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },

  bioText: {
    marginTop: 12,
    color: "#F4F4F5",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },

  // Interests
  interestsRow: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  interestChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  interestText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },

  // Action row
  actionsRow: {
    marginTop: 20,
    flexDirection: "row",
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 1,
  },
  actionBtnDefault: {
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  actionBtnHot: {
    borderColor: "rgba(244,114,182,0.4)",
    backgroundColor: "rgba(236,72,153,0.2)",
  },
  actionBtnLabel: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },

  // Empty
  emptyCard: {
    minHeight: 590,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
  },
  emptySubtitle: {
    marginTop: 8,
    color: "#A1A1AA",
    fontSize: 14,
    textAlign: "center",
  },
});
