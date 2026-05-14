import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react";

import DoubleDateTab from "@/components/DoubleDateTab";
import FriendsHubTab from "@/components/FriendsTab";
import { ShotBottomSheet, ShotToast } from "@/components/ShotBottomSheet";
import { useDatingMatches, type DatingPlanInput, type DatingProfileSnapshot } from "@/contexts/DatingMatchContext";
import { useGetDiscoveryFeed, type Profile as ApiProfile } from "@workspace/api-client-react";
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
  TextInput,
  View,
  useWindowDimensions,
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
  userId?: string;
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
  datingGoal?: string;
  datingPace?: string;
  firstDateStyle?: string;
  dateIdeas?: string[];
  chemistrySignals?: string[];
  comfortBadges?: string[];
  prompt?: string;
  promptAnswer?: string;
  hotTake?: string;
  poll?: {
    question: string;
    options: [string, string];
    votes: [number, number];
  };
  replyTime?: string;
  intentions?: string;
  openerIdeas?: string[];
  likedCurrentUser?: boolean;
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
];

const subTabs: Record<IntentId, string[]> = {
  dating: ["For You", "Active Tonight", "Intentional", "Double Dates", "Date Ideas", "Miami Local"],
  friends: ["People", "Requests", "Plans"],
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
    datingGoal: "Active Tonight",
    datingPace: "Tonight",
    firstDateStyle: "Rooftop drinks",
    dateIdeas: ["Rooftop drinks", "Salsa night", "Late dessert"],
    chemistrySignals: ["Nightlife overlap", "Fast plans", "High-energy dates"],
    comfortBadges: ["Public place first", "Share plans with friends"],
    prompt: "Best Miami night starts with...",
    promptAnswer: "A sunset drink, good music, and no endless texting.",
    hotTake: "Dinner is better after dancing.",
    poll: { question: "Choose the first move", options: ["Rooftop", "Salsa"], votes: [64, 36] },
    replyTime: "Usually replies fast",
    intentions: "Spontaneous but respectful",
    openerIdeas: ["Ask Maya for her sunset rooftop shortlist.", "Pick rooftop or salsa and make it easy."],
    likedCurrentUser: true,
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
    datingGoal: "Double Date",
    datingPace: "This week",
    firstDateStyle: "Group dinner",
    dateIdeas: ["Double-date sushi", "Rooftop lounge", "Friend-group brunch"],
    chemistrySignals: ["Group-date friendly", "Social confidence", "Plans over pen pals"],
    comfortBadges: ["Friend-friendly", "Public place first"],
    prompt: "A green flag I notice fast...",
    promptAnswer: "Someone who makes plans and checks in without being asked.",
    hotTake: "The best chemistry is calm and hilarious.",
    poll: { question: "Better date energy?", options: ["Dinner", "Dancing"], votes: [42, 58] },
    replyTime: "Active tonight",
    intentions: "Fun plans with real follow-through",
    openerIdeas: ["Ask Sofia what group dinner spot never misses.", "Suggest sushi or a rooftop plan."],
  },
  {
    id: 3,
    name: "Ari",
    age: 26,
    location: "South Beach",
    intent: "friends",
    subGenre: "For You",
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
    subGenre: "For You",
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
    subGenre: "Intentional",
    bio: "Soft life energy with real intention. Looking for chemistry, consistency, and someone who actually dates with purpose.",
    interests: ["Pilates", "Wine", "Travel", "Reading"],
    matchScore: 92,
    online: true,
    verified: true,
    image: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=1200&q=90",
    datingGoal: "Intentional",
    datingPace: "Slow burn",
    firstDateStyle: "Wine bar",
    dateIdeas: ["Wine bar", "Museum night", "Dinner with a view"],
    chemistrySignals: ["Intentional dating", "Deep conversation", "Quality-time overlap"],
    comfortBadges: ["Clear intentions", "Public place first", "Low-pressure pace"],
    prompt: "I know the date is going well when...",
    promptAnswer: "We lose track of time and nobody reaches for their phone.",
    hotTake: "Consistency is more attractive than mystery.",
    poll: { question: "First date vibe?", options: ["Wine bar", "Museum"], votes: [57, 43] },
    replyTime: "Thoughtful responder",
    intentions: "Chemistry, consistency, and real dates",
    openerIdeas: ["Ask Isabella about her favorite wine bar.", "Start with a calm dinner plan."],
  },
  {
    id: 8,
    name: "Diego",
    age: 28,
    location: "Brickell, Miami",
    intent: "dating",
    subGenre: "Date Ideas",
    bio: "Big on chemistry, late dinners, and people who can hold a real conversation past midnight.",
    interests: ["Restaurants", "Live Music", "Boxing", "Beach"],
    matchScore: 79,
    online: false,
    verified: false,
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=90",
    datingGoal: "Casual but clear",
    datingPace: "This week",
    firstDateStyle: "Late dinner",
    dateIdeas: ["Late dinner", "Live music", "Boxing class then smoothies"],
    chemistrySignals: ["Night-owl overlap", "Foodie energy", "Conversation-first"],
    comfortBadges: ["Clear expectations", "Public place first"],
    prompt: "My toxic trait is...",
    promptAnswer: "I will find the best late-night food spot in any neighborhood.",
    hotTake: "A great playlist can save a mediocre date.",
    poll: { question: "After-dark date?", options: ["Dinner", "Live music"], votes: [48, 52] },
    replyTime: "Replies after work",
    intentions: "Chemistry without confusion",
    openerIdeas: ["Ask Diego for the best late-night food in Brickell.", "Choose dinner or live music."],
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
    datingGoal: "Active Tonight",
    datingPace: "Tonight",
    firstDateStyle: "Dancing",
    dateIdeas: ["Wynwood art walk", "Salsa dancing", "Cocktails and tacos"],
    chemistrySignals: ["Active tonight", "Art and music overlap", "Spontaneous plans"],
    comfortBadges: ["Meet in public", "Share-the-plan friendly"],
    prompt: "My ideal Saturday is...",
    promptAnswer: "Art, tacos, dancing, and one story worth retelling.",
    hotTake: "A bad dancer with confidence is still a good date.",
    poll: { question: "Tonight's move?", options: ["Art walk", "Salsa"], votes: [39, 61] },
    replyTime: "Online now",
    intentions: "Fun, flirty, and easy to plan",
    openerIdeas: ["Ask Aaliyah what the move is tonight.", "Pick art walk or salsa."],
    likedCurrentUser: true,
  },
  {
    id: 10,
    name: "Lucas",
    age: 30,
    location: "Coconut Grove",
    intent: "dating",
    subGenre: "Miami Local",
    bio: "Bartender by night, surfer by morning. If you can keep up with both energies we'll get along.",
    interests: ["Surf", "Mixology", "House Music", "Sunsets"],
    matchScore: 83,
    online: true,
    verified: false,
    image: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=1200&q=90",
    datingGoal: "Miami Local",
    datingPace: "Weekend",
    firstDateStyle: "Sunset walk",
    dateIdeas: ["Sunset walk", "Beach morning", "Cocktails after shift"],
    chemistrySignals: ["Miami local", "Outdoors overlap", "Balanced day/night energy"],
    comfortBadges: ["Daytime date friendly", "Public place first"],
    prompt: "The fastest way to my heart is...",
    promptAnswer: "A beach morning, a strong coffee, and someone who laughs easily.",
    hotTake: "Sunrise dates are underrated.",
    poll: { question: "Better first plan?", options: ["Beach", "Cocktails"], votes: [55, 45] },
    replyTime: "Night-shift replies",
    intentions: "Easygoing chemistry",
    openerIdeas: ["Ask Lucas sunrise or sunset.", "Suggest a Grove walk."],
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
    datingGoal: "Double Date",
    datingPace: "This weekend",
    firstDateStyle: "Brunch",
    dateIdeas: ["Double-date brunch", "Tennis and smoothies", "Beach picnic"],
    chemistrySignals: ["Double-date friendly", "Travel overlap", "Social but grounded"],
    comfortBadges: ["Friend-friendly", "Daytime plans", "Public place first"],
    prompt: "I am weirdly good at...",
    promptAnswer: "Planning the brunch spot everyone ends up loving.",
    hotTake: "Double dates should be normal, not awkward.",
    poll: { question: "Weekend plan?", options: ["Brunch", "Beach"], votes: [62, 38] },
    replyTime: "Checks in daily",
    intentions: "Group-friendly dating with chemistry",
    openerIdeas: ["Ask Priya for her best brunch pick.", "Suggest brunch or tennis."],
    likedCurrentUser: true,
  },
  {
    id: 12,
    name: "Zoe",
    age: 25,
    location: "South Beach",
    intent: "friends",
    subGenre: "For You",
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
    subGenre: "Events",
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
    subGenre: "For You",
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

// ─── Animated neon "Miami" wordmark (pulsing pink glow) ──────────────────────
const defaultDateIdeas = ["Coffee with a view", "Walk by the water", "Low-key dinner"];
const defaultChemistrySignals = ["Shared interests", "Similar pace", "Nearby plans"];
const defaultComfortBadges = ["Public place first", "Respectful pace"];

function apiProfileToDatingProfile(profile: ApiProfile & { modeData?: Record<string, unknown> }, index: number): Profile {
  const modeData = profile.modeData ?? {};
  const firstDateStyle = typeof modeData.firstDateStyle === "string" ? modeData.firstDateStyle : undefined;
  const datingGoal = typeof modeData.datingGoal === "string" ? modeData.datingGoal : profile.connectionSubtype;
  const datingPace = typeof modeData.datingPace === "string" ? modeData.datingPace : undefined;
  const datingEnergy = typeof modeData.datingEnergy === "string" ? modeData.datingEnergy : undefined;
  const comfortBadges = Array.isArray(modeData.comfortBadges) ? modeData.comfortBadges.filter((item): item is string => typeof item === "string") : undefined;
  const image = profile.photos?.[0] ?? "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=90";

  return {
    id: 10_000 + index,
    userId: profile.userId,
    name: profile.displayName,
    age: profile.age ?? 25,
    location: profile.location ?? "South Florida",
    intent: "dating",
    subGenre: datingGoal === "1-on-1" ? "Intentional" : datingGoal ?? "For You",
    bio: profile.bio ?? "Open to real chemistry, easy plans, and a first date that feels natural.",
    interests: profile.interests?.length ? profile.interests : ["Coffee", "Dinner", "Miami", "Music"],
    matchScore: Math.min(96, 80 + ((profile.interests?.length ?? 0) * 2)),
    online: false,
    verified: profile.isVerified,
    image,
    datingGoal,
    datingPace,
    firstDateStyle,
    dateIdeas: firstDateStyle ? [firstDateStyle, "Coffee with a view", "Walk by the water"] : defaultDateIdeas,
    chemistrySignals: [
      datingGoal ? `${datingGoal} energy` : "Dating intent overlap",
      datingEnergy ?? "Easy conversation",
      profile.location ? `Also around ${profile.location}` : "Nearby plans",
    ],
    comfortBadges,
    prompt: "A first date I would actually say yes to...",
    promptAnswer: firstDateStyle ? `${firstDateStyle}, good conversation, and clear follow-through.` : "Something simple, public, and easy to enjoy.",
    replyTime: datingPace ?? "Ready for good plans",
    intentions: datingGoal ?? "Clear chemistry and real follow-through",
    openerIdeas: firstDateStyle ? [`Ask ${profile.displayName} about ${firstDateStyle}.`] : [`Ask ${profile.displayName} what kind of first date feels easy.`],
  };
}

function getDatingDateIdeas(profile: Profile) {
  return profile.dateIdeas?.length ? profile.dateIdeas : defaultDateIdeas;
}

function getDatingSignals(profile: Profile) {
  return profile.chemistrySignals?.length ? profile.chemistrySignals : defaultChemistrySignals;
}

function getDatingComfort(profile: Profile) {
  return profile.comfortBadges?.length ? profile.comfortBadges : defaultComfortBadges;
}

function datingSnapshot(profile: Profile): DatingProfileSnapshot {
  return {
    id: profile.userId ?? `mock_${profile.id}`,
    name: profile.name,
    age: profile.age,
    location: profile.location,
    intent: profile.intent,
    photos: [profile.image],
    datingGoal: profile.datingGoal ?? profile.subGenre,
    firstDateStyle: profile.firstDateStyle,
    dateIdeas: getDatingDateIdeas(profile),
    prompt: profile.prompt,
    promptAnswer: profile.promptAnswer,
    openerIdeas: profile.openerIdeas,
    likedCurrentUser: profile.likedCurrentUser === true,
  };
}

function MiamiNeon() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1300,
          // textShadow* properties are JS-only, can't use native driver here.
          useNativeDriver: false,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1300,
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const radius = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 22],
  });

  return (
    <Animated.Text style={[styles.titleMiami, { textShadowRadius: radius }]}>
      Miami
    </Animated.Text>
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
type FriendStory = {
  label: string;
  icon: IoniconName;
  colors: [string, string];
};

type FriendPerson = {
  id: string;
  name: string;
  age: number;
  city: string;
  avatar: string;
  image: string;
  interests: string[];
  badges: string[];
  energy: string;
  signal: string;
};

type FriendFeedItem = {
  id: string;
  type: "post" | "profile" | "plan" | "signal";
  person: FriendPerson;
  text: string;
  timestamp: string;
  tag: string;
  image?: string;
  socialSignals: string[];
  icebreaker: string;
};

const friendStories: FriendStory[] = [
  { label: "Coffee", icon: "cafe", colors: ["#FBBF24", "#EC4899"] },
  { label: "Gym", icon: "barbell", colors: ["#A3E635", "#22C55E"] },
  { label: "Going Out", icon: "sparkles", colors: ["#EC4899", "#8B5CF6"] },
  { label: "Chill", icon: "moon", colors: ["#38BDF8", "#6366F1"] },
  { label: "New to Miami", icon: "location", colors: ["#FB923C", "#EC4899"] },
  { label: "Study", icon: "book", colors: ["#A78BFA", "#EC4899"] },
  { label: "Accessible", icon: "accessibility", colors: ["#22D3EE", "#3B82F6"] },
  { label: "Active Tonight", icon: "flash", colors: ["#EC4899", "#F43F5E"] },
];

const friendPostTags = ["Coffee", "Gym", "Walk", "Brunch", "Chill", "Going Out", "Study", "Food", "Creative", "Movie"];

const friendPeople: FriendPerson[] = [
  {
    id: "maya",
    name: "Maya",
    age: 29,
    city: "Brickell",
    avatar: "MJ",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=90",
    interests: ["Coffee", "Design", "Beach Walks", "Brunch"],
    badges: ["Active Tonight", "Coffee Person", "Accessible Friendly", "Fast Responder"],
    energy: "Exploring Miami",
    signal: "Trying a new coffee spot after work.",
  },
  {
    id: "omar",
    name: "Omar",
    age: 35,
    city: "Wynwood",
    avatar: "OE",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=90",
    interests: ["Gym", "Food", "Nightlife", "Music"],
    badges: ["Gym Energy", "LGBTQ+ Friendly", "Social Weekend", "Fast Responder"],
    energy: "Looking for Plans",
    signal: "Open to a group dinner or gallery night.",
  },
  {
    id: "nina",
    name: "Nina",
    age: 42,
    city: "Coral Gables",
    avatar: "NP",
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=900&q=90",
    interests: ["Family Plans", "Learning", "Parks", "Food"],
    badges: ["Family-Friendly", "Chill Personality", "50+", "Accessible Friendly"],
    energy: "Chill Mode",
    signal: "Weekend park walk with coffee nearby.",
  },
  {
    id: "jules",
    name: "Jules",
    age: 24,
    city: "Downtown",
    avatar: "JR",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=900&q=90",
    interests: ["Study", "Creative", "Movies", "New to Miami"],
    badges: ["New to Miami", "Study Mode", "LGBTQ+ Friendly", "Low-Noise Plans"],
    energy: "Study Mode",
    signal: "Looking for a quiet cafe to co-work.",
  },
];

const friendFeedItems: FriendFeedItem[] = [
  {
    id: "coffee-post",
    type: "post",
    person: friendPeople[0]!,
    text: "Down for an iced latte and a walk by the water around 6. Low-key, good conversation, no pressure.",
    timestamp: "12m",
    tag: "Coffee",
    image: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=90",
    socialSignals: ["Similar interests", "Also active around Brickell", "Usually joins coffee plans"],
    icebreaker: "Favorite coffee spot in Miami?",
  },
  {
    id: "omar-profile",
    type: "profile",
    person: friendPeople[1]!,
    text: "Building a gym-to-food crew. Morning lifts, weekend markets, live music when the week allows it.",
    timestamp: "Active now",
    tag: "Gym",
    socialSignals: ["Same energy", "Into the same things", "Mutual creative circles"],
    icebreaker: "Gym or beach walk?",
  },
  {
    id: "nina-plan",
    type: "plan",
    person: friendPeople[2]!,
    text: "Mini plan: family-friendly Saturday brunch, then a shaded park walk. Easy pace and accessible seating preferred.",
    timestamp: "Today",
    tag: "Brunch",
    socialSignals: ["Your kind of people", "Shared safety preferences", "Low-noise friendly"],
    icebreaker: "Best calm brunch place in Coral Gables?",
  },
  {
    id: "jules-signal",
    type: "signal",
    person: friendPeople[3]!,
    text: "New to Miami and trying to find study friends, movie people, and quiet creative spaces.",
    timestamp: "28m",
    tag: "Study",
    image: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=90",
    socialSignals: ["You'd probably get along", "Similar plan style", "Also likes quiet places"],
    icebreaker: "Favorite chill place in Brickell?",
  },
];

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ intent?: string; subtab?: string }>();
  const { height: winH } = useWindowDimensions();
  const topInset = Platform.OS === "web" ? 14 : Math.max(insets.top, 12);
  // Web spec: `pb-[calc(env(safe-area-inset-bottom)+78px)]` — 78px clears the
  // glass tab bar (49pt height + a hair of breathing room).
  const bottomInset = Platform.OS === "web" ? 96 : 98 + insets.bottom;
  // Measured cardArea height (set by onLayout). Falls back to a windowH-based
  // estimate so the very first frame still renders correctly.
  const [measuredCardH, setMeasuredCardH] = useState(0);
  const cardHeight =
    measuredCardH > 0 ? measuredCardH : Math.max(420, winH - 340);

  const allowedTabs =
    currentUserIntent === "all"
      ? tabs
      : tabs.filter((tab) => tab.id === currentUserIntent);

  const [activeIntent, setActiveIntent] = useState<IntentId>(
    currentUserIntent === "all" ? "friends" : allowedTabs[0]!.id,
  );
  const [activeSubTab, setActiveSubTab] = useState("For You");
  const [cardIndex, setCardIndex] = useState(0);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [shotProfile, setShotProfile] = useState<Profile | null>(null);
  const [shotError, setShotError] = useState<string | null>(null);
  const [shotPremiumRequired, setShotPremiumRequired] = useState(false);
  const [shotSending, setShotSending] = useState(false);
  const [shotToastVisible, setShotToastVisible] = useState(false);

  useEffect(() => {
    if (params.intent === "dating") {
      setActiveIntent("dating");
      if (params.subtab === "Double Dates") setActiveSubTab("Double Dates");
      setCardIndex(0);
    } else if (params.intent === "friends") {
      setActiveIntent("friends");
      setActiveSubTab("For You");
      setCardIndex(0);
    }
  }, [params.intent, params.subtab]);

  const theme = tabs.find((tab) => tab.id === activeIntent)!;
  const { data: datingFeed } = useGetDiscoveryFeed(
    { page: 1, limit: 30, intent: "dating" },
    { query: { enabled: activeIntent === "dating" } },
  );

  const serverDatingProfiles = useMemo(
    () => (datingFeed?.profiles ?? []).map((item, index) => apiProfileToDatingProfile(item as ApiProfile & { modeData?: Record<string, unknown> }, index)),
    [datingFeed?.profiles],
  );

  const visibleProfiles = useMemo(() => {
    const profilePool = activeIntent === "dating" && serverDatingProfiles.length > 0 ? serverDatingProfiles : profiles;
    return profilePool.filter((profile) => {
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
  }, [activeIntent, activeSubTab, serverDatingProfiles]);

  const profile =
    visibleProfiles.length > 0
      ? visibleProfiles[cardIndex % visibleProfiles.length]
      : null;

  // Advance the deck. Called by SwipeDeck after a gesture-driven exit, and by
  // ExpandedProfile when the user uses the bottom action bar.
  const advanceDeck = () => setCardIndex((prev) => prev + 1);

  // ─── Premium tap-reaction system ──────────────────────────────────────
  // Tapping a rail button (VIBE / SPARK / PASS) doesn't just advance — it
  // fires a Raya/Hinge-style reaction: the active card scales/tilts/glows,
  // the ghost stack lifts, particles burst on SPARK, then the deck moves
  // forward. Mirrors the web spec's `actionState` pattern.
  const [actionState, setActionState] = useState<SwipeAction | null>(null);
  const reactionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (reactionTimeoutRef.current) clearTimeout(reactionTimeoutRef.current);
    };
  }, []);




  const dating = useDatingMatches();
  const recordDatingAction = (action: SwipeAction) => {
    if (activeIntent !== "dating") return;
    if (!profile) return;
    const snapshot = datingSnapshot(profile);
    if (action === "vibe") dating.recordVibe(snapshot);
    else if (action === "spark") dating.recordSpark(snapshot);
    else if (action === "pass") dating.recordPass(snapshot);
  };

  const createDatingPlan = (target: Profile, plan: DatingPlanInput) => {
    dating.recordPlan(datingSnapshot(target), plan);
    setSelectedProfile(null);
    advanceDeck();
    router.push("/(tabs)/matches" as never);
  };

  const openShotSheet = (target: Profile) => {
    if (activeIntent !== "dating") return;
    setShotError(null);
    setShotPremiumRequired(false);
    setShotProfile(target);
  };

  const sendShotToProfile = async (message: string) => {
    if (!shotProfile) return false;
    setShotSending(true);
    setShotError(null);
    setShotPremiumRequired(false);
    const result = await dating.sendShot(datingSnapshot(shotProfile), message);
    setShotSending(false);
    if (!result.success) {
      setShotError(result.error ?? "Shot could not be sent.");
      setShotPremiumRequired(result.premiumRequired === true);
      return false;
    }
    setShotToastVisible(true);
    setTimeout(() => setShotToastVisible(false), 2400);
    return true;
  };

  const handleReaction = (action: SwipeAction) => {
    // If a reaction is already in flight, ignore — prevents the deck from
    // skipping two profiles on a rapid double-tap.
    if (actionState !== null) return;


    recordDatingAction(action);
    setActionState(action);
    if (reactionTimeoutRef.current) clearTimeout(reactionTimeoutRef.current);
    // Two-phase timing so the card actually plays both halves of its spring:
    //   Phase 1 (`holdDuration`): card holds the action pose (forward spring).
    //   Phase 2 (`SPRING_BACK_MS`): clear actionState → SAME card springs
    //     back to neutral. Then advance the deck so the next profile mounts
    //     at rest. If we cleared and advanced in the same tick, the SwipeCard
    //     would unmount before the spring-back ever rendered (its key
    //     includes cardIndex), and the user would see a hard snap.
    const holdDuration = action === "spark" ? 650 : 420;
    const SPRING_BACK_MS = 280;
    reactionTimeoutRef.current = setTimeout(() => {
      setActionState(null);
      reactionTimeoutRef.current = setTimeout(() => {
        advanceDeck();
        reactionTimeoutRef.current = null;
      }, SPRING_BACK_MS);
    }, holdDuration);
  };

  // Drives the ghost-stack lift behind the card. Springs to 1 the instant a
  // reaction starts and back to 0 when it clears.
  const ghostLift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(ghostLift, {
      toValue: actionState ? 1 : 0,
      stiffness: 260,
      damping: 20,
      mass: 1,
      useNativeDriver: true,
    }).start();
  }, [actionState, ghostLift]);
  const ghost1Y = ghostLift.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const ghost1Scale = ghostLift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.01] });
  const ghost2Y = ghostLift.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const ghost2Scale = ghostLift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.015] });

  return (
    // Root only owns the dark backdrop + ambient blobs. The bottom inset
    // for the glass tab bar lives on `main` below — applying it here too
    // would double-pad and leave a ~115px dead band under the card.
    <View style={styles.root}>
      {/* Premium ambient background glow — two soft pink blobs centered
          top and bottom, fading off the edges to fake the web spec's
          `blur-[130-150px]`. `pointerEvents="none"` mirrors the spec's
          `pointer-events-none` so taps always fall through. */}
      <View pointerEvents="none" style={styles.blob1} />
      <View pointerEvents="none" style={styles.blob2} />

      {/* Single-screen flex column — no scrolling. Mirrors the web spec
          `<main className="flex h-full flex-col px-4 pt-[safe-top+18] pb-[safe-bottom+86]">`.
          The card section is `flex: 1` and fills whatever space remains
          between the header/tabs above and the fixed glass tab bar below. */}
      <View
        style={[
          styles.main,
          // Web spec: `pt-[calc(env(safe-area-inset-top)+54px)]` — extra
          // breathing room below the status bar / dynamic island.
          { paddingTop: topInset + 16, paddingBottom: bottomInset },
        ]}
      >
        {/* Header — minimalist per the latest spec. Flex-row with gap-2 so
            "Discover" (Sora sans-serif) and "Miami" (serif italic) sit side
            by side on a shared baseline. No neon line, no subtitle. */}
        <View style={styles.header}>
          <LinearGradient
            colors={["rgba(236,72,153,0)", "rgba(236,72,153,0.95)", "rgba(236,72,153,0)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.headerTopLine}
          />
          <View style={styles.titleHeadlineRow}>
            <Text style={styles.titleHeadlineWord}>Discover</Text>
            <Text style={styles.titleHeadlineMiami}>Miami</Text>
            <MaterialCommunityIcons name="palm-tree" size={28} color="#F9A8D4" style={styles.titlePalm} />
          </View>
          <View style={styles.taglineRow}>
            <View style={styles.taglineLine} />
            <Text style={styles.taglineText}>SWIPE. CONNECT. VIBE.</Text>
            <View style={styles.taglineLine} />
          </View>
        </View>

        {/* Intent Tabs */}
        <View style={styles.intentRow}>
          {tabs.map((tab, idx) => {
            const isActive = activeIntent === tab.id;
            const isAllowed = allowedTabs.some((a) => a.id === tab.id);
            return (
              <View key={tab.id} style={[styles.intentSlot, tab.id === "networking" && styles.intentSlotWide]}>
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
                        tab.id === "networking" && styles.intentBtnLabelLong,
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

        {/* Dating keeps swipe filters here. Friends owns
            their simpler controls inside their dedicated tab UIs. */}
        {activeIntent === "dating" && (
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
        )}

        {/* Friends uses its social hub; Dating keeps the swipe deck. */}
        {activeIntent === "friends" ? (
          <View style={{ flex: 1, marginHorizontal: -16 }}>
            <FriendsHubTab bottomInset={bottomInset} />
          </View>
        ) : activeSubTab === "Double Dates" ? (
          <View style={styles.cardArea}>
            <DoubleDateTab />
          </View>
        ) : (
          /* Card area — flex:1 so it fills the rest of the viewport. Height
             is captured via onLayout and forwarded to SwipeDeck so the inner
             cards/shadows stay pixel-perfect at any device size. */
          <View
            style={styles.cardArea}
            onLayout={(e) => {
              const h = Math.round(e.nativeEvent.layout.height);
              if (h > 0 && h !== measuredCardH) setMeasuredCardH(h);
            }}
          >
            {/* Stack ghosts behind the active card for depth (mirrors web
                `inset-x-3 bottom-[-14px]` and `inset-x-6 bottom-[-26px]`).
                Animated so they lift slightly during a tap reaction — adds
                the "the whole stack reacted" feel. */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.ghostCard,
                styles.ghostCard1,
                { transform: [{ translateY: ghost1Y }, { scale: ghost1Scale }] },
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.ghostCard,
                styles.ghostCard2,
                { transform: [{ translateY: ghost2Y }, { scale: ghost2Scale }] },
              ]}
            />

            {profile ? (
              <SwipeDeck
                key={`deck-${activeIntent}-${activeSubTab}`}
                profile={profile}
                cardKey={`${profile.id}-${cardIndex}`}
                theme={theme}
                cardHeight={cardHeight}
                onOpenProfile={() => setSelectedProfile(profile)}
                onAction={(action) => {
                  recordDatingAction(action);
                  advanceDeck();
                }}
                actionState={actionState}
                onReaction={handleReaction}
                onShot={() => openShotSheet(profile)}
              />
            ) : (
              <EmptyState theme={theme} />
            )}
          </View>
        )}
      </View>

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
            onAction={(action) => {
              if (action) recordDatingAction(action);
              setSelectedProfile(null);
              advanceDeck();
            }}
            onCreatePlan={(plan) => createDatingPlan(selectedProfile, plan)}
            onShot={() => openShotSheet(selectedProfile)}
          />
        ) : null}
      </Modal>

      <ShotBottomSheet
        visible={shotProfile !== null}
        target={shotProfile}
        sending={shotSending}
        error={shotError}
        premiumRequired={shotPremiumRequired}
        onClose={() => setShotProfile(null)}
        onSend={sendShotToProfile}
      />
      <ShotToast visible={shotToastVisible} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#020003" },

  // Background blobs — subtle pink/purple haze
  // Premium ambient glow blobs — match the web spec exactly. Two centered
  // pink halos (top & bottom). RN can't blur a backgroundColor, so we
  // lean on big radii + low alpha + the dark backdrop to fake the
  // 130–150px CSS blur.
  // Web: `-top-40 left-1/2 -translate-x-1/2 h-80 w-80 bg-pink-500/15`.
  blob1: {
    position: "absolute", top: -160, left: "50%",
    marginLeft: -160,
    width: 320, height: 320, borderRadius: 160,
    backgroundColor: "rgba(236,72,153,0.15)",
  },
  // Web: `bottom-[-120px] left-1/2 -translate-x-1/2 h-96 w-96 bg-pink-500/10`.
  blob2: {
    position: "absolute", bottom: -120, left: "50%",
    marginLeft: -192,
    width: 384, height: 384, borderRadius: 192,
    backgroundColor: "rgba(236,72,153,0.10)",
  },

  // Top-level main column. Replaces the old ScrollView so the screen fits
  // exactly one viewport (h-screen overflow-hidden in the web spec).
  main: { flex: 1, paddingHorizontal: 20 },

  // Header — minimalist single headline (web spec: `shrink-0 pb-3 text-center`).
  header: {
    alignItems: "center",
    paddingBottom: 14,
    position: "relative",
  },
  // Web spec: `flex items-center justify-center gap-2`. Baseline alignment
  // keeps the sans-serif and serif italic words sitting on the same line.
  // (Renamed from `titleRow` to avoid colliding with the legacy `titleRow`
  // style still referenced by the unused `MiamiNeon` helper.)
  titleHeadlineRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 9,
  },
  // Web spec: `font-[Sora] text-[30px] font-black tracking-[-0.05em] text-white`.
  titleHeadlineWord: {
    color: "#FFF",
    fontFamily: "Sora_800ExtraBold",
    fontWeight: "900",
    fontSize: 38,
    lineHeight: 44,
    letterSpacing: -1.8,
    textShadowColor: "rgba(255,255,255,0.35)",
    textShadowRadius: 16,
    textShadowOffset: { width: 0, height: 0 },
  },
  // Web spec: `font-serif text-[30px] italic text-pink-300
  // drop-shadow-[0_0_18px_rgba(236,72,153,0.9)]`. RN doesn't ship Sora-Italic
  // and there's no serif font loaded, so we lean on the system serif
  // (Georgia on iOS, Noto Serif on Android) which gives the same elegant
  // italic feel as the web mockup.
  titleHeadlineMiami: {
    color: "#F9A8D4",
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    fontStyle: "italic",
    fontSize: 40,
    lineHeight: 46,
    textShadowColor: "rgba(236,72,153,0.9)",
    textShadowRadius: 18,
    textShadowOffset: { width: 0, height: 0 },
  },
  titlePalm: {
    marginLeft: 2,
    textShadowColor: "rgba(236,72,153,0.9)",
    textShadowRadius: 18,
    textShadowOffset: { width: 0, height: 0 },
  },
  // Thin neon top line above the title (web `w-24 h-[2px]`).
  headerTopLineWrap: {
    width: 96,
    height: 2,
    marginBottom: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTopLine: {
    width: 160,
    height: 2,
    borderRadius: 1,
    marginBottom: 12,
    shadowColor: "#EC4899",
    shadowOpacity: 0.9,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  // Title row — Discover · Miami inline, no pill (matches the new minimalist spec).
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#FFF",
    fontSize: 32,
    fontFamily: "Sora_800ExtraBold",
    letterSpacing: -1.6,
    lineHeight: 34,
    textShadowColor: "rgba(255,255,255,0.22)",
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 0 },
  },
  titleMiami: {
    marginLeft: 8,
    color: "#F9A8D4",
    // Yellowtail script — visually scaled to match the 32pt sans-serif beside it.
    fontSize: 36,
    lineHeight: 38,
    fontFamily: "Yellowtail_400Regular",
    textShadowColor: "rgba(236,72,153,1)",
    textShadowOffset: { width: 0, height: 0 },
  },
  // Legacy/unused — header no longer renders the gradient underlines or pill.
  _legacyTitleUnderlineRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    justifyContent: "center",
  },
  titleUnderlineLeft: {
    width: 40,
    height: 1,
  },
  titleUnderlineRight: {
    width: 40,
    height: 1,
  },
  subtitleSmall: {
    marginTop: 8,
    color: "#D4D4D8",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 3,
  },
  filterBtn: {
    position: "absolute", right: 0, top: 24,
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 1, borderColor: "rgba(244,114,182,0.35)",
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#EC4899", shadowOpacity: 0.5, shadowRadius: 25, shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  taglineRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  taglineLine: {
    width: 52,
    height: 1,
    backgroundColor: "#EC4899",
    opacity: 0.9,
  },
  taglineText: {
    color: "#F4F4F5",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 4,
  },

  // Intent tabs — slim glossy black glass with pink border (~50px). Tightened
  // top margin (mt-3) and reduced inner py-2 per latest spec.
  intentRow: {
    marginTop: 10, flexDirection: "row", alignItems: "center",
    height: 58,
    borderRadius: 999, borderWidth: 1, borderColor: "rgba(236,72,153,0.34)",
    backgroundColor: "rgba(0,0,0,0.55)",
    padding: 5,
    shadowColor: "#EC4899", shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 0 },
  },
  intentSlot: { flex: 1, flexDirection: "row", alignItems: "center" },
  intentSlotWide: { flex: 1.32 },
  intentBtn: { flex: 1, borderRadius: 999, overflow: "hidden", height: "100%", justifyContent: "center" },
  intentBtnActiveBg: {
    borderRadius: 999,
    shadowColor: "#EC4899", shadowOpacity: 0.95, shadowRadius: 24, shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  intentBtnInner: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 8, paddingHorizontal: 7,
  },
  intentBtnLabel: { fontSize: 13, fontWeight: "800" },
  intentBtnLabelLong: { fontSize: 12.25 },
  intentSep: { width: 1, height: 22, backgroundColor: "rgba(255,255,255,0.12)" },

  // Sub tabs — tightened to fit single-screen layout
  subTabsScroll: { marginTop: 14, flexGrow: 0 },
  subTabsContent: { gap: 12, paddingRight: 4, paddingBottom: 4 },
  subTabBtn: {
    borderRadius: 999, overflow: "hidden",
    paddingHorizontal: 18, paddingVertical: 10, justifyContent: "center",
    minHeight: 42,
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

  // Notice — clean black glass pill with pink border
  notice: {
    marginTop: 10, borderRadius: 999,
    borderWidth: 1, borderColor: "rgba(236,72,153,0.4)",
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 18, paddingVertical: 13,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    shadowColor: "#EC4899", shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 0 },
  },
  noticeLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  noticeText: { color: "#FCE7F3", fontSize: 12, fontWeight: "700" },
  noticeBolt: { color: "#FB923C", fontSize: 16, fontWeight: "900" },

  // Card area + deck. flex:1 so it fills the rest of the viewport in the
  // no-scroll layout. Web spec: `mt-3 flex-1 pl-1 pr-[86px]` with the card
  // sitting at left-0 and width=section-88, so the inner deck spans the
  // section minus an 88px right gutter for the larger 66×66 rail.
  // Web spec: `mt-2 flex-1 min-h-0 pl-0 pr-[90px]`. The 90px right gutter
  // holds the 68×68 action rail with breathing room.
  cardArea: {
    flex: 1,
    minHeight: 0,
    // Equal margins above and below so the card sits perfectly centered
    // between the intent tabs and the glass tab bar. Bumped from 16/8 → 22/22
    // which also shrinks the card by ~20px ("teeny bit smaller").
    marginTop: 12,
    marginBottom: 36,
    paddingLeft: 0,
    paddingRight: 90,
    position: "relative",
    alignItems: "stretch",
    justifyContent: "center",
  },
  // Two faint pink "ghost" cards stacked behind the live deck. They peek out
  // below the main card to give the feed real physical depth.
  ghostCard: {
    position: "absolute",
    height: "100%",
    borderRadius: 36,
    borderWidth: 1,
    backgroundColor: "rgba(236,72,153,0.05)",
  },
  ghostCard1: {
    left: 12,
    right: 12,
    bottom: -14,
    borderColor: "rgba(236,72,153,0.15)",
  },
  ghostCard2: {
    left: 24,
    right: 24,
    bottom: -26,
    borderColor: "rgba(236,72,153,0.10)",
  },
  deckCard: {
    position: "absolute",
    borderRadius: 32,
    borderWidth: 1, borderColor: "rgba(236,72,153,0.18)",
    backgroundColor: "rgba(0,0,0,0.55)",
  },

  card: {
    borderRadius: 36, overflow: "hidden",
    // Web spec: `border border-pink-400/45 shadow-[0_0_75px_rgba(236,72,153,0.38)]`
    borderWidth: 1, borderColor: "rgba(244,114,182,0.45)",
    backgroundColor: "#000",
    shadowColor: "#EC4899", shadowOpacity: 0.38, shadowRadius: 38, shadowOffset: { width: 0, height: 0 },
    elevation: 26,
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
  // Card bottom info — preview only (bio/interests live in expanded profile)
  cardBottom: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 20 },
  cardBottomInfo: { marginBottom: 20 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  nameText: { color: "#FFF", fontSize: 36, fontWeight: "900", letterSpacing: -0.5, lineHeight: 38 },
  locationRow: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 6 },
  locationText: { color: "#E4E4E7", fontSize: 14, fontWeight: "600" },
  greenDotSmall: {
    width: 7, height: 7, borderRadius: 4, backgroundColor: "#34D399",
    marginLeft: 4,
  },
  badgeRow: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  intentBadge: { borderRadius: 999, overflow: "hidden", paddingHorizontal: 16, paddingVertical: 6 },
  intentBadgeText: { color: "#FFF", fontSize: 12, fontWeight: "900", textTransform: "capitalize" },
  subBadge: {
    borderRadius: 999, paddingHorizontal: 16, paddingVertical: 6,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  subBadgeText: { color: "#FFF", fontSize: 12, fontWeight: "700" },
  tapHintText: {
    marginTop: 12, color: "#D4D4D8", fontSize: 12, fontWeight: "600",
  },

  // Swipe action row — refined per spec
  swipeActionsRow: {
    flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between",
    paddingHorizontal: 28,
  },
  swipeActionBtnWrap: { alignItems: "center", gap: 8 },
  swipeActionBtnPass: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 1, borderColor: "rgba(251,113,133,0.3)",
    backgroundColor: "rgba(244,63,94,0.10)",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#F43F5E", shadowOpacity: 0.45, shadowRadius: 35, shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  swipeActionBtnLike: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 1, borderColor: "rgba(110,231,183,0.3)",
    backgroundColor: "rgba(52,211,153,0.10)",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#34D399", shadowOpacity: 0.45, shadowRadius: 35, shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  swipeActionLabel: {
    color: "#FFF", fontSize: 12, fontWeight: "900", letterSpacing: 2.4,
  },
  swipeActionsCenterText: { paddingBottom: 28, alignItems: "center", justifyContent: "flex-end" },
  swipeActionsCenterLabel: {
    color: "#D4D4D8", fontSize: 10, fontWeight: "900", letterSpacing: 2, textAlign: "center",
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
  onCreatePlan,
  onShot,
}: {
  profile: Profile;
  theme: Theme;
  intent: IntentId;
  onClose: () => void;
  onAction: (action?: SwipeAction) => void;
  onCreatePlan: (plan: DatingPlanInput) => void;
  onShot: () => void;
}) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 16 : insets.top;
  const bottomPad = Platform.OS === "web" ? 24 : insets.bottom + 16;
  const [planSheetOpen, setPlanSheetOpen] = useState<false | string>(false);
  const [pollChoice, setPollChoice] = useState<0 | 1 | null>(null);

  const handleAction = (action: SwipeAction | "plan" | "shot" | "generic") => {
    if (intent === "dating" && action === "plan") {
      setPlanSheetOpen("plan");
      return;
    }
    if (intent === "dating" && action === "shot") {
      onShot();
      return;
    }
    onAction(action === "generic" || action === "plan" || action === "shot" ? undefined : action);
  };

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

          {intent === "dating" ? (
            <DatingProfileUpgrade
              profile={profile}
              pollChoice={pollChoice}
              onPollChoice={setPollChoice}
              onPlan={(plan) => setPlanSheetOpen(plan)}
            />
          ) : null}

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

        </View>
      </ScrollView>

      {/* Bottom action bar */}
      <View style={[expStyles.bottomBar, { paddingBottom: bottomPad }]}>
        <BigActionsBar intent={intent} theme={theme} onAction={handleAction} />
      </View>

      <DatingPlanSheet
        visible={planSheetOpen !== false}
        profile={profile}
        initialTitle={typeof planSheetOpen === "string" ? planSheetOpen : undefined}
        onClose={() => setPlanSheetOpen(false)}
        onCreate={(plan) => {
          setPlanSheetOpen(false);
          onCreatePlan(plan);
        }}
      />
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

function DatingProfileUpgrade({
  profile,
  pollChoice,
  onPollChoice,
  onPlan,
}: {
  profile: Profile;
  pollChoice: 0 | 1 | null;
  onPollChoice: (choice: 0 | 1) => void;
  onPlan: (title: string) => void;
}) {
  const signals = getDatingSignals(profile);
  const comfort = getDatingComfort(profile);
  const ideas = getDatingDateIdeas(profile);
  const poll = profile.poll;
  const totalVotes = poll ? poll.votes[0] + poll.votes[1] : 0;

  return (
    <View style={datingStyles.wrap}>
      <View style={datingStyles.card}>
        <View style={datingStyles.cardHeader}>
          <View>
            <Text style={datingStyles.eyebrow}>Date card</Text>
            <Text style={datingStyles.title}>{profile.intentions ?? "Clear, easy chemistry"}</Text>
          </View>
        </View>

        <View style={datingStyles.statsRow}>
          <MiniStat icon="flash" label="Pace" value={profile.datingPace ?? "This week"} />
          <MiniStat icon="wine-outline" label="First date" value={profile.firstDateStyle ?? ideas[0]!} />
        </View>

        <View style={datingStyles.signalRow}>
          {signals.map((signal) => (
            <View key={signal} style={datingStyles.signalChip}>
              <Ionicons name="sparkles" size={12} color="#F9A8D4" />
              <Text style={datingStyles.signalText}>{signal}</Text>
            </View>
          ))}
        </View>
      </View>

      {profile.prompt || profile.promptAnswer ? (
        <View style={datingStyles.promptCard}>
          <Text style={datingStyles.eyebrow}>Prompt</Text>
          <Text style={datingStyles.promptQuestion}>{profile.prompt ?? "Ask me about..."}</Text>
          <Text style={datingStyles.promptAnswer}>{profile.promptAnswer ?? "A date that feels natural and fun."}</Text>
        </View>
      ) : null}

      {poll ? (
        <View style={datingStyles.pollCard}>
          <View style={datingStyles.pollHeader}>
            <Text style={datingStyles.eyebrow}>This or that</Text>
            <Text style={datingStyles.pollVotes}>{totalVotes} votes</Text>
          </View>
          <Text style={datingStyles.pollQuestion}>{poll.question}</Text>
          <View style={datingStyles.pollOptions}>
            {poll.options.map((option, idx) => {
              const selected = pollChoice === idx;
              const pct = totalVotes ? Math.round((poll.votes[idx] / totalVotes) * 100) : 50;
              return (
                <Pressable
                  key={option}
                  onPress={() => onPollChoice(idx as 0 | 1)}
                  style={[datingStyles.pollOption, selected && datingStyles.pollOptionActive]}
                >
                  <Text style={[datingStyles.pollOptionText, selected && datingStyles.pollOptionTextActive]}>{option}</Text>
                  <Text style={datingStyles.pollPct}>{selected ? `${pct}% picked` : `${pct}%`}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={datingStyles.planCard}>
        <View style={datingStyles.pollHeader}>
          <Text style={datingStyles.eyebrow}>Make the date easy</Text>
          <Ionicons name="calendar" size={16} color="#F472B6" />
        </View>
        {ideas.map((idea) => (
          <Pressable key={idea} onPress={() => onPlan(idea)} style={datingStyles.planRow}>
            <View style={datingStyles.planIcon}>
              <Ionicons name="sparkles" size={15} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={datingStyles.planTitle}>{idea}</Text>
              <Text style={datingStyles.planSub}>Fits your overlap and their first-date style.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#A1A1AA" />
          </Pressable>
        ))}
      </View>

      <View style={datingStyles.comfortCard}>
        <Text style={datingStyles.eyebrow}>Comfort and safety</Text>
        <View style={datingStyles.signalRow}>
          {comfort.map((badge) => (
            <View key={badge} style={datingStyles.comfortChip}>
              <Ionicons name="shield-checkmark" size={12} color="#6EE7B7" />
              <Text style={datingStyles.comfortText}>{badge}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function MiniStat({ icon, label, value }: { icon: IoniconName; label: string; value: string }) {
  return (
    <View style={datingStyles.miniStat}>
      <Ionicons name={icon} size={16} color="#F472B6" />
      <Text style={datingStyles.miniStatLabel}>{label}</Text>
      <Text style={datingStyles.miniStatValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function DatingPlanSheet({
  visible,
  profile,
  initialTitle,
  onClose,
  onCreate,
}: {
  visible: boolean;
  profile: Profile;
  initialTitle?: string;
  onClose: () => void;
  onCreate: (plan: DatingPlanInput) => void;
}) {
  const ideas = getDatingDateIdeas(profile);
  const options = [
    ...(initialTitle && !ideas.includes(initialTitle) ? [initialTitle] : []),
    ...ideas,
    "Coffee with a view",
    "Walk by the water",
  ].filter((item, idx, arr) => arr.indexOf(item) === idx);

  const makePlan = (title: string) => {
    onCreate({
      title,
      place: profile.location,
      time: profile.datingPace ?? "This week",
      reason: `${title} fits ${profile.name}'s ${profile.firstDateStyle ?? "first-date"} style and your shared interests.`,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={datingStyles.sheetBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={datingStyles.sheet}>
          <View style={datingStyles.sheetHandle} />
          <View style={datingStyles.sheetHeader}>
            <View>
              <Text style={datingStyles.eyebrow}>Plan with {profile.name}</Text>
              <Text style={datingStyles.sheetTitle}>Pick a date idea</Text>
            </View>
            <Pressable onPress={onClose} style={datingStyles.sheetClose}>
              <Ionicons name="close" size={20} color="#FFF" />
            </Pressable>
          </View>
          <Text style={datingStyles.sheetCopy}>
            Creating a plan opens a chat and sends it to Connect so you can follow through.
          </Text>
          {options.map((idea) => (
            <Pressable key={idea} onPress={() => makePlan(idea)} style={datingStyles.sheetOption}>
              <LinearGradient colors={["#EC4899", "#8B5CF6"]} style={datingStyles.sheetOptionIcon}>
                <Ionicons name="calendar" size={16} color="#FFF" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={datingStyles.planTitle}>{idea}</Text>
                <Text style={datingStyles.planSub}>{profile.datingPace ?? "This week"} - {profile.location}</Text>
              </View>
              <Text style={datingStyles.createText}>Create</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
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
  action: SwipeAction | "plan" | "shot" | "generic";
  main?: boolean;
};

const datingBigActions: BigActionDef[] = [
  { label: "Pass", iconLib: "ion", iconName: "close", action: "pass" },
  { label: "Shot", iconLib: "ion", iconName: "send", action: "shot" },
  { label: "Like", iconLib: "ion", iconName: "heart", action: "vibe", main: true },
  { label: "Plan", iconLib: "ion", iconName: "calendar", action: "plan" },
];
const friendsBigActions: BigActionDef[] = [
  { label: "Skip", iconLib: "ion", iconName: "close", action: "generic" },
  { label: "Add Friend", iconLib: "ion", iconName: "people", action: "generic", main: true },
  { label: "Invite", iconLib: "ion", iconName: "paper-plane", action: "generic" },
];
const networkingBigActions: BigActionDef[] = [
  { label: "Connect", iconLib: "material", iconName: "handshake", action: "generic", main: true },
  { label: "Save", iconLib: "ion", iconName: "person-add", action: "generic" },
  { label: "Message", iconLib: "ion", iconName: "chatbubble", action: "generic" },
];

function BigActionsBar({
  intent,
  theme,
  onAction,
}: {
  intent: IntentId;
  theme: Theme;
  onAction: (action: SwipeAction | "plan" | "shot" | "generic") => void;
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
        <BigAction key={def.label} def={def} theme={theme} onPress={() => onAction(def.action)} />
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

// ─── SwipeDeck (3-direction gesture system) ───────────────────────────────────
const datingStyles = StyleSheet.create({
  wrap: { gap: 14, marginBottom: 6 },
  card: { borderRadius: 24, borderWidth: 1, borderColor: "rgba(244,114,182,0.24)", backgroundColor: "rgba(236,72,153,0.08)", padding: 14 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
  eyebrow: { color: "#F9A8D4", fontSize: 11, fontWeight: "900", letterSpacing: 1.4, textTransform: "uppercase" },
  title: { marginTop: 4, color: "#FFF", fontSize: 18, fontWeight: "900", letterSpacing: -0.2, flexShrink: 1 },
  statsRow: { marginTop: 14, flexDirection: "row", gap: 10 },
  miniStat: { flex: 1, minHeight: 86, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: "rgba(0,0,0,0.24)", padding: 12, justifyContent: "space-between" },
  miniStatLabel: { color: "#A1A1AA", fontSize: 10, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" },
  miniStatValue: { color: "#FFF", fontSize: 13, fontWeight: "900" },
  signalRow: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  signalChip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, borderWidth: 1, borderColor: "rgba(244,114,182,0.20)", backgroundColor: "rgba(255,255,255,0.06)", paddingHorizontal: 10, paddingVertical: 7 },
  signalText: { color: "#FCE7F3", fontSize: 11, fontWeight: "800" },
  promptCard: { borderRadius: 22, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: "rgba(255,255,255,0.055)", padding: 14 },
  promptQuestion: { marginTop: 6, color: "#FFF", fontSize: 17, fontWeight: "900" },
  promptAnswer: { marginTop: 8, color: "#D4D4D8", fontSize: 14, lineHeight: 21, fontWeight: "600" },
  pollCard: { borderRadius: 22, borderWidth: 1, borderColor: "rgba(244,114,182,0.18)", backgroundColor: "rgba(0,0,0,0.28)", padding: 14 },
  pollHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  pollVotes: { color: "#A1A1AA", fontSize: 11, fontWeight: "800" },
  pollQuestion: { marginTop: 6, color: "#FFF", fontSize: 16, fontWeight: "900" },
  pollOptions: { marginTop: 12, flexDirection: "row", gap: 10 },
  pollOption: { flex: 1, borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: "rgba(255,255,255,0.055)", padding: 12 },
  pollOptionActive: { borderColor: "rgba(244,114,182,0.72)", backgroundColor: "rgba(236,72,153,0.20)" },
  pollOptionText: { color: "#F4F4F5", fontSize: 13, fontWeight: "900" },
  pollOptionTextActive: { color: "#FFF" },
  pollPct: { marginTop: 4, color: "#A1A1AA", fontSize: 11, fontWeight: "700" },
  planCard: { borderRadius: 22, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: "rgba(255,255,255,0.04)", padding: 14, gap: 10 },
  planRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  planIcon: { width: 34, height: 34, borderRadius: 13, backgroundColor: "rgba(236,72,153,0.85)", alignItems: "center", justifyContent: "center" },
  planTitle: { color: "#FFF", fontSize: 14, fontWeight: "900" },
  planSub: { marginTop: 2, color: "#A1A1AA", fontSize: 12, fontWeight: "600" },
  comfortCard: { borderRadius: 22, borderWidth: 1, borderColor: "rgba(110,231,183,0.16)", backgroundColor: "rgba(16,185,129,0.055)", padding: 14 },
  comfortChip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, borderWidth: 1, borderColor: "rgba(110,231,183,0.18)", backgroundColor: "rgba(16,185,129,0.08)", paddingHorizontal: 10, paddingVertical: 7 },
  comfortText: { color: "#D1FAE5", fontSize: 11, fontWeight: "800" },
  sheetBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.68)" },
  sheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, borderWidth: 1, borderColor: "rgba(244,114,182,0.28)", backgroundColor: "#070006", paddingHorizontal: 18, paddingTop: 10, paddingBottom: 28, shadowColor: "#EC4899", shadowOpacity: 0.45, shadowRadius: 30, shadowOffset: { width: 0, height: 0 } },
  sheetHandle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.18)", marginBottom: 14 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  sheetTitle: { marginTop: 3, color: "#FFF", fontSize: 24, fontWeight: "900", letterSpacing: -0.4 },
  sheetClose: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" },
  sheetCopy: { marginTop: 10, marginBottom: 10, color: "#A1A1AA", fontSize: 13, lineHeight: 19, fontWeight: "600" },
  sheetOption: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.09)", backgroundColor: "rgba(255,255,255,0.045)", padding: 12, marginTop: 9 },
  sheetOptionIcon: { width: 38, height: 38, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  createText: { color: "#F9A8D4", fontSize: 12, fontWeight: "900" },
  toolRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.09)", backgroundColor: "rgba(255,255,255,0.045)", padding: 12, marginTop: 9 },
  toolRowActive: { borderColor: "rgba(244,114,182,0.6)", backgroundColor: "rgba(236,72,153,0.13)" },
});

type SwipeAction = "pass" | "vibe" | "spark";

function SwipeDeck({
  profile,
  cardKey,
  theme,
  cardHeight,
  onOpenProfile,
  onAction,
  actionState,
  onReaction,
  onShot,
}: {
  profile: Profile;
  cardKey: string;
  theme: Theme;
  cardHeight: number;
  onOpenProfile: () => void;
  onAction: (action: SwipeAction) => void;
  // Tap-reaction state owned by DiscoverScreen. Drives the card-level
  // scale/tilt/glow on tap and the spark-burst overlay.
  actionState: SwipeAction | null;
  onReaction: (action: SwipeAction) => void;
  onShot: () => void;
}) {
  // Gesture-driven spark burst still uses an incrementing token so rapid
  // upward swipes always retrigger a fresh explosion. Tap-driven sparks
  // come in via `actionState === "spark"` and render a separate burst.
  const [sparkToken, setSparkToken] = useState(0);
  const sparkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (sparkTimeoutRef.current) clearTimeout(sparkTimeoutRef.current);
    };
  }, []);

  // Gesture path — SwipeCard.triggerExit calls back here after the card has
  // animated off-screen. We just fire the spark burst (if applicable) and
  // advance the deck. Tap path bypasses this entirely via `onReaction`.
  const handleGestureAction = (action: SwipeAction) => {
    if (action === "spark") {
      setSparkToken((n) => n + 1);
      if (sparkTimeoutRef.current) clearTimeout(sparkTimeoutRef.current);
      sparkTimeoutRef.current = setTimeout(() => {
        setSparkToken((n) => -Math.abs(n));
        sparkTimeoutRef.current = null;
      }, 650);
    }
    onAction(action);
  };

  const gestureSparkBurst = sparkToken > 0;
  const tapSparkBurst = actionState === "spark";

  return (
    <View style={[deckStyles.deckRoot, { height: cardHeight }]}>
      {/* Stacked shadow cards behind the active card */}
      <View
        style={[
          deckStyles.deckShadow,
          {
            top: 16,
            left: 20,
            right: 20,
            height: cardHeight - 16,
            opacity: 0.3,
          },
        ]}
      />
      <View
        style={[
          deckStyles.deckShadow,
          {
            top: 8,
            left: 10,
            right: 10,
            height: cardHeight - 8,
            opacity: 0.55,
          },
        ]}
      />

      <SwipeCard
        key={cardKey}
        profile={profile}
        theme={theme}
        cardHeight={cardHeight}
        onOpenProfile={onOpenProfile}
        onAction={handleGestureAction}
        actionState={actionState}
      />

      {/* Two SparkExplosion paths — one per trigger source. They never run
          simultaneously in practice (gesture vs tap are mutually exclusive
          in time). The `key` ensures each burst gets a fresh particle field. */}
      {gestureSparkBurst ? <SparkExplosion key={`g-${sparkToken}`} /> : null}
      {tapSparkBurst ? <SparkExplosion key="tap-spark" /> : null}

      {/* Side rail of tap-to-act buttons (VIBE / SPARK / PASS). Routes
          through `onReaction` (DiscoverScreen) so taps trigger the full
          premium reaction sequence instead of an instant advance. */}
      <CardActionsRail
        onVibe={() => onReaction("vibe")}
        onShot={onShot}
        onSpark={() => onReaction("spark")}
        onPass={() => onReaction("pass")}
      />
    </View>
  );
}

// ─── Card actions rail (VIBE / SPARK / PASS tap buttons) ─────────────────────
function CardActionsRail({
  onVibe,
  onShot,
  onSpark,
  onPass,
}: {
  onVibe: () => void;
  onShot: () => void;
  onSpark: () => void;
  onPass: () => void;
}) {
  return (
    <View style={railStyles.rail} pointerEvents="box-none">
      <RailButton
        icon="heart"
        label="LIKE"
        sub="Energy"
        color="pink"
        onPress={onVibe}
      />
      <RailButton
        icon="send"
        label="SHOT"
        sub="Opener"
        color="shot"
        onPress={onShot}
      />
      <RailButton
        icon="sparkles"
        label="SPARK"
        sub="Boost"
        color="purple"
        onPress={onSpark}
      />
      <RailButton
        icon="close"
        label="PASS"
        sub="Skip"
        color="rose"
        onPress={onPass}
      />
    </View>
  );
}

type RailColor = "pink" | "shot" | "purple" | "rose";

const RAIL_PALETTE: Record<
  RailColor,
  { bg: string; border: string; text: string; shadow: string }
> = {
  pink: {
    bg: "rgba(236,72,153,0.15)",
    border: "rgba(244,114,182,0.5)",
    text: "#F9A8D4",
    shadow: "#EC4899",
  },
  shot: {
    bg: "rgba(217,70,239,0.16)",
    border: "rgba(236,72,153,0.58)",
    text: "#FBCFE8",
    shadow: "#D946EF",
  },
  purple: {
    bg: "rgba(168,85,247,0.15)",
    border: "rgba(192,132,252,0.5)",
    text: "#D8B4FE",
    shadow: "#A855F7",
  },
  rose: {
    bg: "rgba(244,63,94,0.15)",
    border: "rgba(251,113,133,0.5)",
    text: "#FDA4AF",
    shadow: "#F43F5E",
  },
};

function RailButton({
  icon,
  label,
  sub,
  color,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  color: RailColor;
  onPress: () => void;
}) {
  const palette = RAIL_PALETTE[color];
  // `pulse` drives the glow reaction. 0 = resting state, 1 = peak glow.
  // We animate it 0 → 1 → 0 on every tap so the button visibly "pops"
  // and the colored shadow swells. shadowOpacity needs the JS driver,
  // so we keep the whole sequence on JS for consistency.
  const pulse = useRef(new Animated.Value(0)).current;
  // Resting press feedback uses the native driver so the squish is buttery.
  const pressScale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.84,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();
  };
  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 18,
      bounciness: 12,
    }).start();
  };
  const handlePress = () => {
    pulse.setValue(0);
    Animated.sequence([
      Animated.timing(pulse, {
        toValue: 1,
        duration: 180,
        useNativeDriver: false,
      }),
      Animated.timing(pulse, {
        toValue: 0,
        duration: 520,
        useNativeDriver: false,
      }),
    ]).start();
    onPress();
  };

  // Map the pulse to a swelling outer halo + brighter shadow.
  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] });
  const shadowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] });
  const shadowRadius = pulse.interpolate({ inputRange: [0, 1], outputRange: [18, 38] });

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      hitSlop={6}
      style={railStyles.button}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Animated.View style={{ transform: [{ scale: pressScale }] }}>
        {/* Outer reactive halo — invisible at rest, blooms on tap. */}
        <Animated.View
          pointerEvents="none"
          style={[
            railStyles.halo,
            {
              backgroundColor: palette.bg,
              borderColor: palette.border,
              opacity: haloOpacity,
              transform: [{ scale: haloScale }],
            },
          ]}
        />
        <Animated.View
          style={[
            railStyles.circle,
            {
              backgroundColor: palette.bg,
              borderColor: palette.border,
              shadowColor: palette.shadow,
              shadowOpacity,
              shadowRadius,
            },
          ]}
        >
          <View pointerEvents="none" style={railStyles.circleInner} />
          <Ionicons name={icon} size={28} color={palette.text} />
        </Animated.View>
      </Animated.View>
      <Text style={railStyles.label}>{label}</Text>
    </Pressable>
  );
}

const railStyles = StyleSheet.create({
  // Sits in the 88px right gutter created by `cardArea.paddingRight`. Web
  // spec: `right-2` (8px from section edge) + 66×66 buttons with `gap-6`
  // (24px) between them. Anchored via `right: -76` so the rail's right
  // edge lands ~8px inside the section's outer right edge.
  // Sits in the 92px right gutter created by `cardArea.paddingRight`. Web
  // spec: `right-1` (4px from section edge) + 68×68 buttons with `gap-6`
  // (24px) between them. Anchored via `right: -88` so the rail's right
  // edge lands ~4px inside the section's outer right edge.
  rail: {
    position: "absolute",
    right: -88,
    top: 0,
    bottom: 0,
    width: 68,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  button: {
    alignItems: "center",
  },
  circle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.65,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  // Inner translucent ring (web spec: `absolute inset-1 rounded-full bg-white/10`)
  // — gives each button a glassy, tactile inner highlight.
  circleInner: {
    position: "absolute",
    top: 4, left: 4, right: 4, bottom: 4,
    borderRadius: 25,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  // Reactive outer halo — sits behind the circle and blooms on tap.
  halo: {
    position: "absolute",
    top: 0, left: 0,
    width: 58, height: 58, borderRadius: 29,
    borderWidth: 1,
  },
  label: {
    marginTop: 8,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
    color: "#FFF",
  },
  sub: {
    marginTop: 2,
    textAlign: "center",
    fontSize: 9,
    fontWeight: "600",
    color: "#A1A1AA",
    lineHeight: 11,
  },
});

const friendStyles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: "#050005" },
  content: { paddingHorizontal: 16, paddingTop: 10, gap: 14 },
  hero: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
    paddingHorizontal: 4,
    paddingTop: 2,
  },
  heroTitle: { color: "#FFF", fontSize: 38, fontWeight: "900", letterSpacing: 0 },
  heroSubtitle: { marginTop: 4, color: "#A1A1AA", fontSize: 14, fontWeight: "700" },
  heroIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#EC4899",
    shadowOpacity: 0.5,
    shadowRadius: 24,
  },
  storyRow: { gap: 12, paddingVertical: 4 },
  storyItem: { width: 74, alignItems: "center" },
  storyRing: { width: 64, height: 64, borderRadius: 32, padding: 2 },
  storyInner: {
    flex: 1,
    borderRadius: 30,
    backgroundColor: "#09090B",
    alignItems: "center",
    justifyContent: "center",
  },
  storyLabel: { marginTop: 7, width: 72, textAlign: "center", color: "#D4D4D8", fontSize: 11, fontWeight: "800" },
  searchBar: {
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.06)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 15,
  },
  searchInput: { flex: 1, color: "#FFF", fontSize: 14, fontWeight: "700", paddingVertical: 0 },
  creator: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.06)",
    padding: 14,
    shadowColor: "#EC4899",
    shadowOpacity: 0.14,
    shadowRadius: 28,
  },
  creatorTop: { flexDirection: "row", gap: 12 },
  myAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#FFF", fontSize: 13, fontWeight: "900" },
  postInput: { flex: 1, minHeight: 72, color: "#FFF", fontSize: 15, fontWeight: "700", textAlignVertical: "top", paddingTop: 2 },
  tagRow: { gap: 8, paddingTop: 12, paddingBottom: 2 },
  tagChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(0,0,0,0.28)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tagChipActive: { borderColor: "#EC4899", backgroundColor: "#EC4899" },
  tagText: { color: "#D4D4D8", fontSize: 11, fontWeight: "900" },
  tagTextActive: { color: "#FFF" },
  creatorFooter: { marginTop: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.10)", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  imageBtn: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10, paddingVertical: 8 },
  imageBtnText: { color: "#D4D4D8", fontSize: 12, fontWeight: "900" },
  postBtn: { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 999, backgroundColor: "#EC4899", paddingHorizontal: 18, paddingVertical: 10 },
  postBtnText: { color: "#FFF", fontSize: 12, fontWeight: "900" },
  smartCard: {
    flexDirection: "row",
    gap: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.045)",
    padding: 14,
  },
  smartTitle: { color: "#FFF", fontSize: 13, fontWeight: "900" },
  smartText: { marginTop: 3, color: "#A1A1AA", fontSize: 12, fontWeight: "600", lineHeight: 17 },
  feedCard: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(9,9,11,0.96)",
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.32,
    shadowRadius: 30,
  },
  postHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" },
  name: { color: "#FFF", fontSize: 16, fontWeight: "900" },
  age: { color: "#A1A1AA", fontSize: 12, fontWeight: "800" },
  meta: { marginTop: 2, color: "#71717A", fontSize: 12, fontWeight: "700" },
  postText: { marginTop: 12, color: "#F4F4F5", fontSize: 15, fontWeight: "600", lineHeight: 22 },
  postImage: { marginTop: 14, height: 220, borderRadius: 24, backgroundColor: "#18181B" },
  profileImageWrap: { marginTop: 14, height: 260, borderRadius: 24, overflow: "hidden", backgroundColor: "#18181B" },
  profileImage: { width: "100%", height: "100%" },
  profileOverlay: { position: "absolute", left: 14, right: 14, bottom: 14 },
  energyPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  energyText: { color: "#FFF", fontSize: 12, fontWeight: "900" },
  badgeWrap: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 7 },
  badge: { overflow: "hidden", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.16)", color: "#FFF", paddingHorizontal: 10, paddingVertical: 6, fontSize: 11, fontWeight: "900" },
  interestWrap: { marginTop: 13, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  primaryTag: { overflow: "hidden", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.12)", color: "#FFF", paddingHorizontal: 11, paddingVertical: 7, fontSize: 11, fontWeight: "900" },
  interest: { overflow: "hidden", borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", color: "#D4D4D8", paddingHorizontal: 11, paddingVertical: 7, fontSize: 11, fontWeight: "800" },
  signalWrap: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  signal: { overflow: "hidden", borderRadius: 999, borderWidth: 1, borderColor: "rgba(244,114,182,0.22)", backgroundColor: "rgba(236,72,153,0.10)", color: "#FCE7F3", paddingHorizontal: 10, paddingVertical: 6, fontSize: 11, fontWeight: "900" },
  icebreaker: { marginTop: 13, borderRadius: 22, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: "rgba(255,255,255,0.045)", padding: 12, flexDirection: "row", gap: 9 },
  icebreakerLabel: { color: "#FCE7F3", fontSize: 11, fontWeight: "900" },
  icebreakerText: { marginTop: 2, color: "#D4D4D8", fontSize: 13, fontWeight: "700" },
  actionRow: { marginTop: 13, flexDirection: "row", gap: 7 },
  feedAction: { flex: 1, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: "rgba(255,255,255,0.05)", alignItems: "center", paddingVertical: 11 },
  feedActionText: { color: "#E4E4E7", fontSize: 11, fontWeight: "900" },
  connectAction: { flex: 1, borderRadius: 999, backgroundColor: "#EC4899", alignItems: "center", paddingVertical: 11 },
  requestedAction: { backgroundColor: "#FFF" },
  connectActionText: { color: "#FFF", fontSize: 11, fontWeight: "900" },
  requestedText: { color: "#09090B" },
  planAction: { flex: 1, borderRadius: 999, borderWidth: 1, borderColor: "rgba(244,114,182,0.34)", backgroundColor: "rgba(236,72,153,0.12)", alignItems: "center", paddingVertical: 11 },
  planActionText: { color: "#FCE7F3", fontSize: 11, fontWeight: "900" },
  sheetBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.72)", padding: 12 },
  planSheet: { borderRadius: 34, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: "#09090B", padding: 18 },
  sheetHandle: { alignSelf: "center", width: 48, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.22)", marginBottom: 16 },
  sheetHead: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  sheetTitle: { color: "#FFF", fontSize: 24, fontWeight: "900" },
  sheetSub: { marginTop: 3, color: "#A1A1AA", fontSize: 13, fontWeight: "700" },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  planOption: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 22, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: "rgba(255,255,255,0.045)", padding: 12, marginBottom: 10 },
  planIcon: { width: 42, height: 42, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  planTitle: { color: "#FFF", fontSize: 14, fontWeight: "900" },
  planReason: { marginTop: 2, color: "#A1A1AA", fontSize: 12, fontWeight: "600" },
  createPlanBtn: { marginTop: 4, borderRadius: 999, backgroundColor: "#EC4899", alignItems: "center", paddingVertical: 15 },
  createPlanText: { color: "#FFF", fontSize: 14, fontWeight: "900" },
  heroAction: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EC4899",
    shadowColor: "#EC4899",
    shadowOpacity: 0.55,
    shadowRadius: 24,
  },
  sectionTabs: {
    flexDirection: "row",
    gap: 8,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.045)",
    padding: 5,
  },
  sectionTab: {
    flex: 1,
    minHeight: 42,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  sectionTabActive: {
    backgroundColor: "#EC4899",
    shadowColor: "#EC4899",
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  sectionTabText: { color: "#A1A1AA", fontSize: 11, fontWeight: "900" },
  sectionTabTextActive: { color: "#FFF" },
  storyRowCompact: { gap: 8, paddingVertical: 2 },
  storyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.055)",
    paddingLeft: 4,
    paddingRight: 12,
    paddingVertical: 4,
  },
  storyPillIcon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  storyPillText: { color: "#E4E4E7", fontSize: 12, fontWeight: "900" },
  creatorCompact: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.055)",
    padding: 13,
  },
  postInputCompact: {
    flex: 1,
    minHeight: 48,
    maxHeight: 86,
    color: "#FFF",
    fontSize: 15,
    fontWeight: "700",
    textAlignVertical: "top",
    paddingTop: 2,
  },
  tagRowCompact: { gap: 8, paddingRight: 10, alignItems: "center" },
  postBtnSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EC4899",
    alignItems: "center",
    justifyContent: "center",
  },
  gridSection: { gap: 12 },
  sectionTitle: { color: "#FFF", fontSize: 20, fontWeight: "900", letterSpacing: 0 },
  sectionHint: { marginTop: -6, color: "#A1A1AA", fontSize: 13, fontWeight: "700", lineHeight: 18 },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(9,9,11,0.94)",
    padding: 10,
  },
  personPhoto: { width: 74, height: 86, borderRadius: 20, backgroundColor: "#18181B" },
  personBody: { flex: 1, minWidth: 0 },
  personName: { color: "#FFF", fontSize: 15, fontWeight: "900" },
  personMeta: { marginTop: 2, color: "#A1A1AA", fontSize: 12, fontWeight: "800" },
  personSignal: { marginTop: 5, color: "#E4E4E7", fontSize: 12, fontWeight: "700" },
  miniSignalRow: { marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  miniSignal: {
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "rgba(236,72,153,0.12)",
    color: "#FCE7F3",
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 10,
    fontWeight: "900",
  },
  personActions: { gap: 7, alignItems: "center" },
  personConnect: {
    borderRadius: 999,
    backgroundColor: "#EC4899",
    paddingHorizontal: 12,
    paddingVertical: 9,
    minWidth: 74,
    alignItems: "center",
  },
  personRequested: { backgroundColor: "#FFF" },
  personConnectText: { color: "#FFF", fontSize: 11, fontWeight: "900" },
  personRequestedText: { color: "#09090B" },
  personPlan: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(244,114,182,0.34)",
    backgroundColor: "rgba(236,72,153,0.12)",
  },
  importCard: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(236,72,153,0.25)",
    backgroundColor: "rgba(236,72,153,0.10)",
    padding: 14,
  },
  importIcon: { width: 48, height: 48, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  importTitle: { color: "#FFF", fontSize: 15, fontWeight: "900" },
  importText: { marginTop: 3, color: "#FCE7F3", fontSize: 12, fontWeight: "700", lineHeight: 17 },
  knownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.045)",
    padding: 12,
  },
  knownConnect: {
    borderRadius: 999,
    backgroundColor: "#EC4899",
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  planQuickCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 13,
  },
  planQuickIcon: { width: 46, height: 46, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  planQuickTitle: { color: "#FFF", fontSize: 15, fontWeight: "900" },
  planQuickMeta: { marginTop: 2, color: "#A1A1AA", fontSize: 12, fontWeight: "700" },
});

function SwipeCard({
  profile,
  theme,
  cardHeight,
  onOpenProfile,
  onAction,
  actionState,
}: {
  profile: Profile;
  theme: Theme;
  cardHeight: number;
  onOpenProfile: () => void;
  onAction: (action: SwipeAction) => void;
  // When non-null, the card runs its premium tap-reaction (scale / tilt /
  // translate / glow swap) before the deck advances. Owned by DiscoverScreen.
  actionState: SwipeAction | null;
}) {
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const isExiting = useRef(false);

  // Mirror `actionState` into a ref so the panResponder closure (built once
  // via useMemo) can read the live value and refuse to claim the gesture
  // while a tap reaction is mid-flight. Without this, a tap+swipe could
  // double-advance the deck.
  const actionStateRef = useRef<SwipeAction | null>(null);
  useEffect(() => {
    actionStateRef.current = actionState;
  }, [actionState]);

  // ─── Tap-reaction animation ───────────────────────────────────────────
  // A single 0→1 spring drives scale / rotate / translateX. The "track"
  // remembers which action launched the spring so the interpolator knows
  // which output to drive towards even after `actionState` is cleared
  // (the spring back to 0 happens via the same interpolator).
  const reaction = useRef(new Animated.Value(0)).current;
  const reactionTrack = useRef<SwipeAction | null>(null);
  const [reactionTrackState, setReactionTrackState] =
    useState<SwipeAction | null>(null);
  useEffect(() => {
    if (actionState) {
      reactionTrack.current = actionState;
      setReactionTrackState(actionState);
      Animated.spring(reaction, {
        toValue: 1,
        stiffness: 260,
        damping: 20,
        mass: 1,
        useNativeDriver: true,
      }).start();
    } else if (reactionTrack.current) {
      Animated.spring(reaction, {
        toValue: 0,
        stiffness: 260,
        damping: 20,
        mass: 1,
        useNativeDriver: true,
      }).start(() => {
        reactionTrack.current = null;
        setReactionTrackState(null);
      });
    }
  }, [actionState, reaction]);
  // Resolve targets from whichever action is currently in flight (live state
  // first, falls back to the most recent track during the spring-back).
  const activeAction = actionState ?? reactionTrackState;
  const reactionScaleTarget =
    activeAction === "spark"
      ? 1.035
      : activeAction === "vibe"
        ? 1.015
        : activeAction === "pass"
          ? 0.985
          : 1;
  const reactionRotateTarget =
    activeAction === "vibe" ? "3deg" : activeAction === "pass" ? "-3deg" : "0deg";
  const reactionTxTarget =
    activeAction === "vibe" ? 18 : activeAction === "pass" ? -18 : 0;
  const reactionScale = reaction.interpolate({
    inputRange: [0, 1],
    outputRange: [1, reactionScaleTarget],
  });
  const reactionRotate = reaction.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", reactionRotateTarget],
  });
  const reactionTx = reaction.interpolate({
    inputRange: [0, 1],
    outputRange: [0, reactionTxTarget],
  });

  // Dynamic shadow per action — the boxShadow swap from the web spec.
  // shadowColor isn't reliably animatable so we hard-swap the style block;
  // the spring on transforms carries the visual energy.
  const reactionShadow =
    activeAction === "spark"
      ? {
          shadowColor: "#A855F7",
          shadowOpacity: 0.75,
          shadowRadius: 45,
        }
      : activeAction === "vibe"
        ? {
            shadowColor: "#EC4899",
            shadowOpacity: 0.65,
            shadowRadius: 40,
          }
        : activeAction === "pass"
          ? {
              shadowColor: "#F43F5E",
              shadowOpacity: 0.55,
              shadowRadius: 35,
            }
          : null;

  // Ambient parallax breathing on the portrait. A slow 1 → 1.04 → 1 loop
  // running on the native driver so it stays free even during pan gestures.
  const parallax = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(parallax, {
          toValue: 1,
          duration: 7000,
          useNativeDriver: true,
        }),
        Animated.timing(parallax, {
          toValue: 0,
          duration: 7000,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [parallax]);
  const parallaxScale = parallax.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.04],
  });
  // Real parallax: as the deck pans, the portrait drifts slightly opposite
  // (max ~14px) so it feels like the face is on a deeper plane than the
  // card frame. Native-driver friendly because we only use translate.
  const parallaxX = pan.x.interpolate({
    inputRange: [-220, 0, 220],
    outputRange: [14, 0, -14],
    extrapolate: "clamp",
  });
  const parallaxY = pan.y.interpolate({
    inputRange: [-200, 0, 200],
    outputRange: [10, 0, -10],
    extrapolate: "clamp",
  });

  const rotate = pan.x.interpolate({
    inputRange: [-220, 0, 220],
    outputRange: ["-12deg", "0deg", "12deg"],
    extrapolate: "clamp",
  });
  const liftScale = pan.y.interpolate({
    inputRange: [-180, 0, 100],
    outputRange: [1.04, 1, 1],
    extrapolate: "clamp",
  });
  const passOpacity = pan.x.interpolate({
    inputRange: [-160, -60, 0],
    outputRange: [1, 0.45, 0],
    extrapolate: "clamp",
  });
  const vibeOpacity = pan.x.interpolate({
    inputRange: [0, 60, 160],
    outputRange: [0, 0.45, 1],
    extrapolate: "clamp",
  });
  const sparkOpacity = pan.y.interpolate({
    inputRange: [-170, -70, 0],
    outputRange: [1, 0.5, 0],
    extrapolate: "clamp",
  });

  const triggerExit = (action: SwipeAction) => {
    if (isExiting.current) return;
    isExiting.current = true;
    const exitTo =
      action === "pass"
        ? { x: -520, y: 40 }
        : action === "vibe"
          ? { x: 520, y: 40 }
          : { x: 0, y: -640 };
    Animated.timing(pan, {
      toValue: exitTo,
      duration: 280,
      useNativeDriver: true,
    }).start(() => {
      onAction(action);
    });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Don't claim on touch start — let child Pressable handle taps
        onStartShouldSetPanResponder: () => false,
        // Require a clear directional gesture (>= 12px) AND axis dominance
        // before stealing the responder, so finger jitter on a tap doesn't
        // hijack the press. Also refuse while a tap reaction is in flight
        // so the user can't tap a rail button and then swipe to advance the
        // same card twice.
        onMoveShouldSetPanResponder: (_, g) => {
          if (actionStateRef.current !== null) return false;
          const ax = Math.abs(g.dx);
          const ay = Math.abs(g.dy);
          if (ax < 12 && ay < 12) return false;
          // Horizontal-dominant OR vertical-dominant by a clear margin
          return ax > ay * 1.2 || ay > ax * 1.2;
        },
        onPanResponderMove: Animated.event(
          [null, { dx: pan.x, dy: pan.y }],
          { useNativeDriver: false },
        ),
        onPanResponderRelease: (_, g) => {
          const ax = Math.abs(g.dx);
          const ay = Math.abs(g.dy);
          const avx = Math.abs(g.vx);
          const avy = Math.abs(g.vy);

          // SPARK — strong upward swipe, must be vertically dominant
          if ((g.dy < -120 || g.vy < -1.5) && (ay > ax || avy > avx)) {
            triggerExit("spark");
            return;
          }
          // VIBE — right swipe, must be horizontally dominant
          if ((g.dx > 130 || g.vx > 1.5) && (ax > ay || avx > avy)) {
            triggerExit("vibe");
            return;
          }
          // PASS — left swipe, must be horizontally dominant
          if ((g.dx < -130 || g.vx < -1.5) && (ax > ay || avx > avy)) {
            triggerExit("pass");
            return;
          }
          // Not enough — spring back
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            friction: 6,
            tension: 80,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
          }).start();
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pan],
  );

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        deckStyles.card,
        { height: cardHeight },
        reactionShadow,
        {
          transform: [
            // Pan + tap-reaction translate combine on the same axis.
            { translateX: Animated.add(pan.x, reactionTx) },
            { translateY: pan.y },
            // RN composes multiple rotate transforms in order — pan rotation
            // and tap-reaction tilt stack cleanly.
            { rotate },
            { rotate: reactionRotate },
            // Pan-driven lift × tap-reaction scale.
            { scale: Animated.multiply(liftScale, reactionScale) },
          ],
        },
      ]}
    >
      {/* Tap surface for the image area — tap-to-expand. PanResponder will
          take over once the user moves, leaving taps to fall through. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onOpenProfile}>
        {/* Subtle parallax breathing — the portrait gently scales between
            1.00 and 1.04 over 7s, mimicking the web's hover zoom but as an
            ambient effect. Native driver keeps it free on the GPU. */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              transform: [
                { translateX: parallaxX },
                { translateY: parallaxY },
                { scale: parallaxScale },
              ],
            },
          ]}
        >
          {/* expo-image's `contentPosition` mirrors CSS `object-position: center 25%`,
              anchoring the focal point near the top so faces stay visible. */}
          <ExpoImage
            source={{ uri: profile.image }}
            style={deckStyles.cardImage}
            contentFit="cover"
            contentPosition={{ top: "25%", left: "50%" }}
            transition={150}
          />
        </Animated.View>

        {/* Cinematic dark gradient — web spec: from-black via-black/40 to-transparent.
            Strong base for legible text, soft middle, fully clear at the top. */}
        <LinearGradient
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.40)", "rgba(0,0,0,1)"]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />

        {/* Thin neon top edge — web spec:
            `h-[2px] bg-gradient-to-r from-transparent via-pink-400 to-transparent`. */}
        <LinearGradient
          colors={["rgba(244,114,182,0)", "rgba(244,114,182,0.95)", "rgba(244,114,182,0)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={deckStyles.cardTopEdge}
        />

        {/* Online / Offline pill — top left */}
        <View
          style={[
            deckStyles.onlinePill,
            !profile.online && deckStyles.offlinePill,
          ]}
        >
          <View
            style={[
              deckStyles.onlineDot,
              !profile.online && deckStyles.offlineDot,
            ]}
          />
          <Text style={deckStyles.onlinePillText}>
            {profile.online ? "Online" : "Offline"}
          </Text>
        </View>

        {/* Match badge — top right */}
        <View style={deckStyles.matchBadge}>
          <Text style={deckStyles.matchBadgePct}>{profile.matchScore}%</Text>
          <Text style={deckStyles.matchBadgeWord}>Match</Text>
        </View>
      </Pressable>

      {/* Swipe direction overlays — driven by gesture position */}
      <Animated.View
        pointerEvents="none"
        style={[deckStyles.overlayPass, { opacity: passOpacity }]}
      >
        <Ionicons name="close" size={48} color="#FB7185" />
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[deckStyles.overlayVibe, { opacity: vibeOpacity }]}
      >
        <Ionicons name="heart" size={48} color="#F472B6" />
      </Animated.View>

      <View pointerEvents="none" style={deckStyles.overlaySparkWrap}>
        <Animated.View
          style={[deckStyles.overlaySpark, { opacity: sparkOpacity }]}
        >
          <Ionicons name="sparkles" size={56} color="#D8B4FE" />
        </Animated.View>
      </View>

      {/* Bottom info — also tap-to-expand */}
      <View style={deckStyles.cardBottom}>
        <Pressable onPress={onOpenProfile} style={deckStyles.cardBottomInfo}>
          <View style={deckStyles.nameRow}>
            <Text style={deckStyles.nameText}>
              {profile.name}, {profile.age}
            </Text>
            {profile.verified ? (
              <MaterialCommunityIcons
                name="shield-check"
                size={22}
                color="#EC4899"
              />
            ) : null}
          </View>

          {/* Web spec: `mt-1 text-sm text-zinc-300` — single tidy line
              `{location} • {distance}`. No icon, no green dot, no duplicate row. */}
          <Text style={deckStyles.locationText}>
            {profile.location} • {(((profile.id * 1.3) % 9) + 0.5).toFixed(1)} mi
          </Text>

          <View style={deckStyles.badgeRow}>
            {/* Web spec: solid `bg-pink-500` pill — no gradient. Keeps the
                intent label feeling like a single confident accent. */}
            <View style={deckStyles.intentBadge}>
              <Text style={deckStyles.intentBadgeText}>{profile.intent}</Text>
            </View>
            <View style={deckStyles.subBadge}>
              <Text style={deckStyles.subBadgeText}>{profile.subGenre}</Text>
            </View>
          </View>

          <Text style={deckStyles.tapHintText}>Tap to view full profile</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

// ─── SPARK particle burst ─────────────────────────────────────────────────────
function SparkExplosion() {
  const PARTICLE_COUNT = 22;
  const particles = useRef(
    Array.from({ length: PARTICLE_COUNT }, () => ({
      anim: new Animated.Value(0),
      angle: 0,
      distance: 0,
    })),
  ).current;

  const burstAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    particles.forEach((p, i) => {
      p.angle = (i / PARTICLE_COUNT) * Math.PI * 2;
      p.distance = 90 + Math.random() * 90;
      Animated.timing(p.anim, {
        toValue: 1,
        duration: 650,
        useNativeDriver: true,
      }).start();
    });
    Animated.timing(burstAnim, {
      toValue: 1,
      duration: 550,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View pointerEvents="none" style={deckStyles.sparkBurstRoot}>
      {particles.map((p, i) => {
        const tx = p.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.cos(p.angle) * p.distance],
        });
        const ty = p.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.sin(p.angle) * p.distance],
        });
        const scale = p.anim.interpolate({
          inputRange: [0, 0.4, 1],
          outputRange: [0, 1.2, 0],
        });
        const opacity = p.anim.interpolate({
          inputRange: [0, 0.7, 1],
          outputRange: [1, 1, 0],
        });
        return (
          <Animated.View
            key={i}
            style={[
              deckStyles.sparkParticle,
              {
                opacity,
                transform: [{ translateX: tx }, { translateY: ty }, { scale }],
              },
            ]}
          />
        );
      })}

      <Animated.View
        style={[
          deckStyles.sparkBurstCenter,
          {
            opacity: burstAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0],
            }),
            transform: [
              {
                scale: burstAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1.6],
                }),
              },
            ],
          },
        ]}
      >
        <Ionicons name="sparkles" size={48} color="#D8B4FE" />
      </Animated.View>
    </View>
  );
}

const deckStyles = StyleSheet.create({
  deckRoot: { position: "relative", width: "100%" },

  deckShadow: {
    position: "absolute",
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(236,72,153,0.18)",
    backgroundColor: "rgba(236,72,153,0.05)",
  },

  // Active card — pink-400/45 border, premium pink outer glow.
  // Web spec: `rounded-[36px] border border-pink-400/45 shadow-[0_0_70px_rgba(236,72,153,0.35)]`.
  card: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    borderRadius: 36,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(244,114,182,0.45)",
    backgroundColor: "#000",
    shadowColor: "#EC4899",
    shadowOpacity: 0.35,
    shadowRadius: 35,
    shadowOffset: { width: 0, height: 0 },
    elevation: 24,
  },
  cardImage: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  // Thin neon top-edge highlight (web spec: `h-[2px] bg-gradient-to-r ...`).
  // Sits flush with the card's top edge so it reads as a glowing seam.
  cardTopEdge: {
    position: "absolute",
    top: 0, left: 0, right: 0, height: 2,
  },

  // Top pills
  onlinePill: {
    position: "absolute",
    top: 16,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(52,211,153,0.3)",
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#34D399",
    shadowColor: "#34D399",
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  offlinePill: {
    borderColor: "rgba(161,161,170,0.35)",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  offlineDot: {
    backgroundColor: "#A1A1AA",
    shadowOpacity: 0,
  },
  onlinePillText: { color: "#FFF", fontSize: 11, fontWeight: "900" },

  matchBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 1,
    borderColor: "rgba(236,72,153,0.5)",
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#EC4899",
    shadowOpacity: 0.55,
    shadowRadius: 16,
  },
  matchBadgePct: { color: "#FBCFE8", fontSize: 18, fontWeight: "900" },
  matchBadgeWord: {
    color: "#E4E4E7",
    fontSize: 10,
    fontWeight: "800",
    marginTop: -2,
  },

  // Direction overlays
  overlayPass: {
    position: "absolute",
    top: 96,
    left: 24,
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    borderColor: "rgba(251,113,133,0.4)",
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#F43F5E",
    shadowOpacity: 0.6,
    shadowRadius: 28,
  },

  overlayVibe: {
    position: "absolute",
    top: 96,
    right: 24,
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    borderColor: "rgba(244,114,182,0.4)",
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#EC4899",
    shadowOpacity: 0.7,
    shadowRadius: 28,
  },

  overlaySparkWrap: {
    position: "absolute",
    top: 64,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  overlaySpark: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 1,
    borderColor: "rgba(192,132,252,0.5)",
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#A855F7",
    shadowOpacity: 0.85,
    shadowRadius: 36,
  },

  // Bottom info — web spec: `absolute inset-x-0 bottom-0 p-6`. The 24px
  // pad gives the headline real breathing room over the dark gradient.
  cardBottom: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 22 },
  cardBottomInfo: { marginBottom: 0 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  // Web spec: `text-[36px] font-black`. Big, confident headline.
  nameText: {
    color: "#FFF",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -0.6,
    lineHeight: 36,
  },
  // Web spec: `mt-1 text-sm text-zinc-300`. Single tidy meta line.
  locationText: {
    marginTop: 4,
    color: "#D4D4D8",
    fontSize: 13,
    fontWeight: "600",
  },
  // Web spec: `mt-3 flex gap-2`.
  badgeRow: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  // Web spec: `bg-pink-500 px-3 py-1 rounded-full text-xs`.
  intentBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: "#EC4899",
  },
  intentBadgeText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  // Web spec: `border border-white/20 px-3 py-1 rounded-full text-xs`.
  subBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
    backgroundColor: "transparent",
  },
  subBadgeText: { color: "#FFF", fontSize: 12, fontWeight: "700" },
  bioText: {
    marginTop: 14,
    color: "#F4F4F5",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22,
  },
  interestsRow: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  interestChip: {
    overflow: "hidden",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
    backgroundColor: "rgba(0,0,0,0.32)",
    color: "#FFF",
    paddingHorizontal: 12,
    paddingVertical: 7,
    fontSize: 12,
    fontWeight: "700",
  },
  // Web spec: `mt-3 text-xs text-zinc-400`.
  tapHintText: {
    marginTop: 10,
    color: "#A1A1AA",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    textAlign: "center",
  },

  // SPARK particle burst
  sparkBurstRoot: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  },
  sparkParticle: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#D8B4FE",
    shadowColor: "#A855F7",
    shadowOpacity: 1,
    shadowRadius: 12,
  },
  sparkBurstCenter: {
    position: "absolute",
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 1,
    borderColor: "rgba(192,132,252,0.7)",
    backgroundColor: "rgba(168,85,247,0.12)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#A855F7",
    shadowOpacity: 0.8,
    shadowRadius: 35,
  },
});
