import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useUser } from "@clerk/clerk-expo";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";
import Reanimated, {
  Extrapolation,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { DiscoverErrorBoundary } from "@/components/DiscoverErrorBoundary";
import { ExpandedProfileCard, type CardProfile } from "@/components/ExpandedProfileCard";
import CreateFriendPlanSheet from "@/components/CreateFriendPlanSheet";
import DeckExhaustedState from "@/components/DeckExhaustedState";
import FirstSessionGuide, { GUIDE_SEEN_KEY } from "@/components/FirstSessionGuide";
import DoubleDateTab from "@/components/DoubleDateTab";
import ProfileBoostBanner from "@/components/ProfileBoostBanner";
import { ShotBottomSheet, ShotToast } from "@/components/ShotBottomSheet";
import { rewriteOpenerToFirstPerson } from "@/components/ExpandedProfileCard";
import { computeCompatibility, type VibeCheckAnswers } from "@/components/VibeCheckQuiz";
import { VibeBreakdownCompact } from "@/components/VibeBreakdown";
import UnlockToast from "@/components/UnlockToast";
import { useFeatureUnlock } from "@/hooks/useFeatureUnlock";
import { MILESTONES } from "@/lib/featureUnlock";
import { Analytics } from "@/lib/analytics";
import { playSound } from "@/lib/sounds";
import { getSwipeStreak, recordSwipe } from "@/lib/swipeStreak";
import { DAILY_SWIPE_LIMIT, decrementSwipes, getSwipesLeft, refundSwipe } from "@/lib/swipeCounter";
import { getDiscoverRailActions, type DiscoverRailAction, type DiscoverRailColor } from "@/lib/discoverActionRail";
import { getRewindDecision, getRewindPillState, shouldShowRewindPill } from "@/lib/discoverRewind";
import {
  SHOT_TOOLTIP_COPY,
  SHOT_TOOLTIP_STORAGE_KEY,
  buildDatingSubTabs,
  buildWhyWeWouldWorkCopy,
  getDiscoverySubtypeForDatingTab,
  getRailPopLabel,
  shouldConsumeDiscoverAction,
  shouldShowShotTooltip,
  type DiscoverAction,
} from "@/lib/retentionFeatures";
import { useDatingMatches, type DatingProfileSnapshot } from "@/contexts/DatingMatchContext";
import { e2eSmokeEnabled, useSessionState } from "@/hooks/useSessionState";
import { shouldUseDemoSeeds } from "@/lib/launchConfig";
import { openChat, openPremium } from "@/lib/routes";
import {
  getFriendPeople,
  sendFriendDeckAction,
  type FriendPerson as ApiFriendPerson,
} from "@/services/friendsApi";
import { getGetDiscoveryFeedQueryKey, useGetDiscoveryFeed, useGetMyProfile, type Profile as ApiProfile } from "@workspace/api-client-react";
import {
  Animated,
  Easing,
  Image,
  Modal,
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
import { sendReaction as sendInboxReaction, sendRequest as sendInboxRequest, withdrawReaction } from "@/services/connectApi";

type IoniconName = ComponentProps<typeof Ionicons>["name"];
type MaterialIconName = ComponentProps<typeof MaterialCommunityIcons>["name"];
type IntentId = "dating" | "friends";

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
  photos?: string[]; // Up to 3 photos from onboarding
  datingGoal?: string;
  friendGoal?: string;
  sourceIntent?: "dating" | "friendship" | "all";
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
  videoMomentUrl?: string | null;
  vibeCheck?: { answers: VibeCheckAnswers; completedAt: string } | null;
  liveDropExpiresAt?: string | null;
  boostActive?: boolean;
  lastActiveAt?: string | null;
};

const DEFAULT_CURRENT_USER_INTENT: IntentId | "all" = "all";

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
  dating: buildDatingSubTabs(),
  friends: ["For You", "Active Tonight", "Casual Hangout", "Activity Partner", "Wing Person", "BFF Hunt"],
};

const personalDatingIntents = ["Hookup", "Long Term", "Curious", "Having Fun"] as const;
const friendIntentTabs = ["Casual Hangout", "Activity Partner", "Wing Person", "BFF Hunt"] as const;

function isPersonalDatingIntent(value?: string | null) {
  return personalDatingIntents.includes(value as (typeof personalDatingIntents)[number]);
}

function normalizedDatingIntentLabel(value?: string | null): string | undefined {
  if (!value) return undefined;
  if (value === "Longterm" || value === "Long-term" || value === "Long term") return "Long Term";
  if (value === "Having fun") return "Having Fun";
  return value;
}

function matchesIntentionalDating(profile: Profile) {
  return getSubIntentionLabel(profile) === "Long Term" || profile.subGenre === "Intentional";
}

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
    photos: [
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=90",
      "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=1200&q=90",
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=90",
    ],
    datingGoal: "Having Fun",
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
    vibeCheck: {
      answers: { loveLanguage: "acts", energyType: "adventurer", conflictStyle: "talk-it-out", datePace: "fast-sparks", adventureLevel: 5 },
      completedAt: "2025-01-15T10:00:00Z",
    },
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
    photos: [
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=90",
      "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=90",
      "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?auto=format&fit=crop&w=1200&q=90",
    ],
    datingGoal: "Long Term",
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
    vibeCheck: {
      answers: { loveLanguage: "time", energyType: "balanced", conflictStyle: "talk-it-out", datePace: "medium", adventureLevel: 3 },
      completedAt: "2025-01-14T18:30:00Z",
    },
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
    verified: true,
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
    intent: "friends",
    subGenre: "Plans",
    bio: "Always down for pickup soccer, food halls, and low-pressure group hangs after work.",
    interests: ["Soccer", "Food Halls", "Live Music", "Group Plans"],
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
    intent: "friends",
    subGenre: "People",
    bio: "Museum days, fashion pop-ups, coffee walks, and friends who enjoy making simple plans.",
    interests: ["Fashion", "Museums", "Coffee", "Events"],
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
    subGenre: "Long Term",
    bio: "Soft life energy with real intention. Looking for chemistry, consistency, and someone who actually dates with purpose.",
    interests: ["Pilates", "Wine", "Travel", "Reading"],
    matchScore: 92,
    online: true,
    verified: true,
    image: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=1200&q=90",
    photos: [
      "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=1200&q=90",
      "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=1200&q=90",
      "https://images.unsplash.com/photo-1476610182048-b716b8518aae?auto=format&fit=crop&w=1200&q=90",
    ],
    datingGoal: "Long Term",
    firstDateStyle: "Wine bar",
    dateIdeas: ["Wine bar", "Museum night", "Dinner with a view"],
    chemistrySignals: ["Long-term intent", "Deep conversation", "Quality-time overlap"],
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
    subGenre: "For You",
    bio: "Big on chemistry, late dinners, and people who can hold a real conversation past midnight.",
    interests: ["Restaurants", "Live Music", "Boxing", "Beach"],
    matchScore: 79,
    online: false,
    verified: true,
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=90",
    datingGoal: "Curious",
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
    photos: [
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=90",
      "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=1200&q=90",
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=1200&q=90",
    ],
    datingGoal: "Hookup",
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
    subGenre: "For You",
    bio: "Bartender by night, surfer by morning. If you can keep up with both energies we'll get along.",
    interests: ["Surf", "Mixology", "House Music", "Sunsets"],
    matchScore: 83,
    online: true,
    verified: true,
    image: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=1200&q=90",
    datingGoal: "Having Fun",
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
    datingGoal: "Long Term",
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
    vibeCheck: {
      answers: { loveLanguage: "time", energyType: "balanced", conflictStyle: "quick-fix", datePace: "slow-burn", adventureLevel: 2 },
      completedAt: "2025-01-13T09:15:00Z",
    },
  },
  {
    id: 22,
    name: "Nina",
    age: 25,
    location: "Miami Beach",
    intent: "dating",
    subGenre: "Active Tonight",
    bio: "Here for a fun night, good music, and honest chemistry without overcomplicating it.",
    interests: ["House Music", "Beach", "Cocktails", "Dancing"],
    matchScore: 84,
    online: true,
    verified: true,
    image: "https://images.unsplash.com/photo-1524503033411-c9566986fc8f?auto=format&fit=crop&w=1200&q=90",
    datingGoal: "Hookup",
    firstDateStyle: "Drinks",
    dateIdeas: ["Drinks", "Dancing", "Late tacos"],
    chemistrySignals: ["Direct intent", "Nightlife overlap", "Easy chemistry"],
    comfortBadges: ["Public place first", "Clear expectations"],
    prompt: "Tonight I am saying yes to...",
    promptAnswer: "Good music, a confident invite, and zero mixed signals.",
    hotTake: "Chemistry should be obvious.",
    poll: { question: "Tonight's vibe?", options: ["Dancing", "Drinks"], votes: [58, 42] },
    replyTime: "Online now",
    intentions: "Fun, direct, and respectful",
    openerIdeas: ["Ask Nina drinks or dancing.", "Keep it direct and respectful."],
  },
  {
    id: 23,
    name: "Mateo",
    age: 29,
    location: "Brickell",
    intent: "dating",
    subGenre: "For You",
    bio: "Looking for attraction, a little banter, and people who are clear about what they want.",
    interests: ["Boxing", "Rooftops", "Reggaeton", "Food"],
    matchScore: 81,
    online: true,
    verified: true,
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=1200&q=90",
    datingGoal: "Hookup",
    firstDateStyle: "Drinks",
    dateIdeas: ["Brickell drinks", "Late dinner", "Rooftop music"],
    chemistrySignals: ["Clear intent", "Flirty energy", "Nearby plans"],
    comfortBadges: ["Clear expectations", "Public place first"],
    prompt: "Best first message...",
    promptAnswer: "Something confident with an actual plan.",
    hotTake: "Vibes are better than essays.",
    poll: { question: "First move?", options: ["Rooftop", "Dinner"], votes: [54, 46] },
    replyTime: "Fast replies",
    intentions: "Chemistry without confusion",
    openerIdeas: ["Ask Mateo rooftop or dinner.", "Send a confident plan."],
  },
  {
    id: 24,
    name: "Elena",
    age: 27,
    location: "Coral Gables",
    intent: "dating",
    subGenre: "Long Term",
    bio: "Looking for something steady, warm, and actually consistent. Big on family, travel, and thoughtful dates.",
    interests: ["Travel", "Wine", "Books", "Dinner"],
    matchScore: 91,
    online: true,
    verified: true,
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=90",
    photos: [
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=90",
      "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=1200&q=90",
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=1200&q=90",
    ],
    datingGoal: "Long Term",
    firstDateStyle: "Dinner",
    dateIdeas: ["Dinner", "Wine bar", "Museum night"],
    chemistrySignals: ["Long-term intent", "Conversation-first", "Consistent energy"],
    comfortBadges: ["Public place first", "Clear intentions"],
    prompt: "A relationship green flag...",
    promptAnswer: "Someone who means what they say and follows through.",
    hotTake: "Effort is attractive.",
    poll: { question: "Date style?", options: ["Dinner", "Museum"], votes: [60, 40] },
    replyTime: "Thoughtful replies",
    intentions: "Long-term connection",
    openerIdeas: ["Ask Elena about her favorite dinner spot.", "Lead with something thoughtful."],
  },
  {
    id: 25,
    name: "Kai",
    age: 26,
    location: "Wynwood",
    intent: "dating",
    subGenre: "For You",
    bio: "Curious, open-minded, and here to see what clicks. I like easy first hangs and good conversation.",
    interests: ["Art", "Coffee", "Music", "Pop-ups"],
    matchScore: 83,
    online: false,
    verified: true,
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=90",
    datingGoal: "Curious",
    firstDateStyle: "Coffee",
    dateIdeas: ["Coffee", "Gallery walk", "Record shop"],
    chemistrySignals: ["Open-minded", "Low-pressure plans", "Creative overlap"],
    comfortBadges: ["Low-pressure pace", "Public place first"],
    prompt: "I am curious about...",
    promptAnswer: "People who surprise me in the first ten minutes.",
    hotTake: "Coffee dates are underrated when the conversation is good.",
    poll: { question: "First hang?", options: ["Coffee", "Gallery"], votes: [52, 48] },
    replyTime: "Usually replies daily",
    intentions: "Curious and open",
    openerIdeas: ["Ask Kai coffee or gallery.", "Keep it easy and specific."],
  },
  {
    id: 26,
    name: "Valeria",
    age: 24,
    location: "Edgewater",
    intent: "dating",
    subGenre: "Active Tonight",
    bio: "Having fun, meeting new people, and saying yes to plans that feel natural.",
    interests: ["Pilates", "Sushi", "Dancing", "Sunsets"],
    matchScore: 86,
    online: true,
    verified: true,
    image: "https://images.unsplash.com/photo-1524250502761-1ac6f2e30d43?auto=format&fit=crop&w=1200&q=90",
    datingGoal: "Having Fun",
    firstDateStyle: "Drinks",
    dateIdeas: ["Sunset drinks", "Sushi", "Dancing"],
    chemistrySignals: ["Playful intent", "Active tonight", "Social energy"],
    comfortBadges: ["Public place first", "Share-the-plan friendly"],
    prompt: "My ideal night is...",
    promptAnswer: "Sunset, sushi, music, and someone who makes it easy.",
    hotTake: "Good energy beats a perfect plan.",
    poll: { question: "Pick one", options: ["Sushi", "Dancing"], votes: [45, 55] },
    replyTime: "Active tonight",
    intentions: "Having fun and meeting people",
    openerIdeas: ["Ask Valeria sushi or dancing.", "Make the plan simple."],
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
    verified: true,
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
    verified: true,
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
    intent: "friends",
    subGenre: "Plans",
    bio: "Beach volleyball, trivia nights, and dinner plans where everyone actually shows up.",
    interests: ["Volleyball", "Trivia", "Dinner", "Live Events"],
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
    intent: "friends",
    subGenre: "People",
    bio: "Sunset walks, architecture tours, ocean days, and friends who love exploring the city.",
    interests: ["Architecture", "Beach", "Walks", "Brunch"],
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
    intent: "friends",
    subGenre: "Plans",
    bio: "Knows the best music nights and wants a crew for dancing, late food, and weekend events.",
    interests: ["Nightlife", "Music", "Food", "Events"],
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
    intent: "friends",
    subGenre: "People",
    bio: "Pilates, wellness walks, smoothie runs, and making a kind little city crew.",
    interests: ["Wellness", "Pilates", "Smoothies", "Community"],
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
    intent: "friends",
    subGenre: "Plans",
    bio: "Film screenings, photo walks, record shops, and casual hangs with creative friends.",
    interests: ["Film", "Photography", "Records", "Events"],
    matchScore: 81,
    online: false,
    verified: true,
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
  const rawDatingGoal = typeof modeData.datingGoal === "string" ? modeData.datingGoal : profile.connectionSubtype;
  const datingGoal = normalizedDatingIntentLabel(rawDatingGoal);
  const friendshipTypes = Array.isArray(modeData.friendshipTypes)
    ? modeData.friendshipTypes.filter((item): item is string => typeof item === "string")
    : [];
  const friendGoal = friendshipTypes[0];
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
    subGenre: isPersonalDatingIntent(datingGoal) ? datingGoal! : "For You",
    bio: profile.bio ?? "Open to real chemistry, easy plans, and a first date that feels natural.",
    interests: profile.interests?.length ? profile.interests : ["Coffee", "Dinner", "Miami", "Music"],
    matchScore: Math.min(96, 80 + ((profile.interests?.length ?? 0) * 2)),
    online: false,
    verified: profile.isVerified,
    image,
    datingGoal,
    friendGoal,
    sourceIntent: profile.intent === "all" ? "all" : profile.intent === "friendship" ? "friendship" : "dating",
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
    replyTime: "Ready for good plans",
    intentions: datingGoal ?? "Clear chemistry and real follow-through",
    openerIdeas: firstDateStyle ? [`Ask ${profile.displayName} about ${firstDateStyle}.`] : [`Ask ${profile.displayName} what kind of first date feels easy.`],
  };
}

function stableNumericId(value: string, offset = 20_000) {
  return (
    offset +
    value
      .split("")
      .reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1), 0)
  );
}

function buildProfilePhotos(primary: string | undefined, index: number) {
  const fallbackStart = index % friendFallbackImages.length;
  const candidates = [
    primary,
    friendFallbackImages[fallbackStart],
    friendFallbackImages[(fallbackStart + 1) % friendFallbackImages.length],
    friendFallbackImages[(fallbackStart + 2) % friendFallbackImages.length],
  ].filter((item): item is string => Boolean(item));
  return Array.from(new Set(candidates)).slice(0, 3);
}

function friendSubtypeFor(person: ApiFriendPerson, index: number) {
  const combined = [
    person.energy,
    person.statusBadge,
    person.suggestedPlanType,
    ...(person.activityStyle ?? []),
    ...(person.interests ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (combined.includes("wing") || combined.includes("nightlife") || combined.includes("going out")) return "Wing Person";
  if (combined.includes("gym") || combined.includes("active") || combined.includes("walk") || combined.includes("run")) return "Activity Partner";
  if (combined.includes("best") || combined.includes("bff") || combined.includes("community")) return "BFF Hunt";
  if (combined.includes("coffee") || combined.includes("brunch") || combined.includes("chill")) return "Casual Hangout";
  return friendIntentTabs[index % friendIntentTabs.length]!;
}

function friendPersonToProfile(person: ApiFriendPerson, index: number): Profile {
  const subtype = friendSubtypeFor(person, index);
  const interests = person.interests?.length ? person.interests : ["Coffee", "Walks", "Miami", "Plans"];
  const signals = person.compatibility?.signals?.length
    ? person.compatibility.signals
    : [person.smartReason, person.energy, person.suggestedPlanReason].filter((item): item is string => Boolean(item));
  const firstPlan = person.planSuggestions?.[0]?.type ?? person.suggestedPlanType ?? "Coffee";
  const image = person.photoUrl ?? friendFallbackImages[index % friendFallbackImages.length]!;
  return {
    id: stableNumericId(person.id, 30_000 + index),
    userId: person.id,
    name: person.name,
    age: person.age ?? 26,
    location: person.location ?? person.neighborhood ?? person.city ?? "Miami",
    intent: "friends",
    subGenre: subtype,
    bio:
      person.smartReason ??
      `${person.energy ?? "Looking for good people"} around ${person.neighborhood ?? person.city ?? "Miami"}. Down for ${firstPlan.toLowerCase()} and easy conversation.`,
    interests,
    matchScore: person.compatibility?.score ?? 84,
    online: person.activeTonight === true || person.statusBadge === "Active Now",
    verified: true,
    image,
    photos: buildProfilePhotos(image, index),
    firstDateStyle: firstPlan,
    dateIdeas: person.planSuggestions?.map((item: { type: string }) => item.type).slice(0, 3) ?? [firstPlan, "Coffee", "Walk"],
    chemistrySignals: signals.slice(0, 3),
    comfortBadges: [
      ...(person.safety ?? []).slice(0, 2),
      person.familyFriendly ? "Family-friendly" : "Public plans first",
      person.lgbtqFriendly ? "LGBTQ+ friendly" : "",
    ].filter(Boolean),
    prompt: "A friendship green flag...",
    promptAnswer: person.suggestedPlanReason ?? "Showing up, making it easy, and keeping the energy real.",
    intentions: subtype,
    openerIdeas: [
      `Invite ${person.name.split(" ")[0]} to ${firstPlan.toLowerCase()}.`,
      `Ask about ${interests[0] ?? "their Miami routine"}.`,
    ],
  };
}

const friendFallbackImages = [
  "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=1200&q=90",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=90",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=90",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=1200&q=90",
];

function getDatingDateIdeas(profile: Profile) {
  return profile.dateIdeas?.length ? profile.dateIdeas : defaultDateIdeas;
}

function getShotSuggestions(profile: Profile): string[] {
  const intent = getSubIntentionLabel(profile) ?? "Dating";
  const interest = profile.interests[0] ?? "your vibe";
  const secondInterest = profile.interests[1] ?? profile.firstDateStyle ?? "Miami nights";
  const style = profile.firstDateStyle ?? getDatingDateIdeas(profile)[0] ?? "something low-key";
  const promptAnswer = profile.promptAnswer?.trim();

  // Server openerIdeas can be third-person commands ("Ask Maya about X") —
  // rewrite to first person or drop, never show literal automation copy.
  const rawOpener = profile.openerIdeas?.[0]?.trim();
  const isThirdPerson = rawOpener
    ? /^(ask|tell|mention|talk\s+to|say\s+something)\s+\w/i.test(rawOpener)
    : false;
  const opener = rawOpener
    ? isThirdPerson
      ? rewriteOpenerToFirstPerson(rawOpener)
      : rawOpener
    : undefined;

  // Conversational, natural prompts — asking-style prompts are real questions.
  const raw = [
    opener,
    intent === "Hookup"
      ? `${interest} and no small talk?`
      : intent === "Long Term"
      ? `Your ${style} vibe sounds like my pace. Am I right?`
      : intent === "Curious"
      ? `Curious enough to trade a real first impression?`
      : `You seem fun. What do you like to do?`,
    promptAnswer
      ? `Your "${promptAnswer}" answer — what's the story there?`
      : `${style} with you sounds dangerously easy.`,
    `I had to shoot my shot: ${interest} or ${secondInterest}?`,
  ].filter((item): item is string => Boolean(item && item.length > 0));

  return raw
    .map((item) => item.slice(0, 120))
    .filter((item, index, arr) => arr.indexOf(item) === index)
    .slice(0, 3);
}

function getDatingSignals(profile: Profile) {
  return profile.chemistrySignals?.length ? profile.chemistrySignals : defaultChemistrySignals;
}

function getDatingComfort(profile: Profile) {
  return profile.comfortBadges?.length ? profile.comfortBadges : defaultComfortBadges;
}

function getIntentDisplayLabel(intent: IntentId) {
  return intent === "dating" ? "Dating" : "Friend";
}

function getIntentIcon(intent: IntentId): IoniconName {
  return intent === "dating" ? "flame" : "people";
}

function getActivityStatus(profile: Profile): { label: string; color: string } {
  if (profile.lastActiveAt) {
    const mins = (Date.now() - new Date(profile.lastActiveAt).getTime()) / 60000;
    if (mins < 5) return { label: "Active now", color: "#22C55E" };
    if (mins < 60) return { label: `Active ${Math.floor(mins)}m ago`, color: "#86EFAC" };
    if (mins < 1440) return { label: `Active ${Math.floor(mins / 60)}h ago`, color: "#94A3B8" };
    if (mins < 10080) return { label: "Active this week", color: "#64748B" };
    return { label: "Recently active", color: "#64748B" };
  }
  return profile.online
    ? { label: "Active now", color: "#22C55E" }
    : { label: "Offline", color: "#64748B" };
}

function getSubIntentionLabel(profile: Profile) {
  const preferred =
    profile.intent === "dating"
      ? normalizedDatingIntentLabel(profile.datingGoal ?? profile.subGenre)
      : profile.subGenre;
  if (profile.intent === "dating") return isPersonalDatingIntent(preferred) ? preferred : undefined;
  return preferred && preferred !== "For You" ? preferred : undefined;
}

function getCardSubIntentionLabel(profile: Profile) {
  if (profile.subGenre && profile.subGenre !== "For You") {
    return profile.subGenre === "Long Term" ? "Intentional" : profile.subGenre;
  }
  return getSubIntentionLabel(profile);
}

function datingSnapshot(profile: Profile): DatingProfileSnapshot {
  return {
    id: profile.userId ?? `mock_${profile.id}`,
    name: profile.name,
    age: profile.age,
    location: profile.location,
    intent: profile.intent,
    photos: [profile.image],
    datingGoal: getSubIntentionLabel(profile) ?? profile.datingGoal ?? profile.subGenre,
    firstDateStyle: profile.firstDateStyle,
    dateIdeas: getDatingDateIdeas(profile),
    prompt: profile.prompt,
    promptAnswer: profile.promptAnswer,
    openerIdeas: profile.openerIdeas,
    likedCurrentUser: profile.likedCurrentUser === true,
    vibeCheck: profile.vibeCheck ?? null,
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
function EmptyState({ theme, intent, exhausted, refreshing, onReset, onRefresh }: { theme: Theme; intent: IntentId; exhausted?: boolean; refreshing?: boolean; onReset?: () => void; onRefresh?: () => void }) {
  const handlePress = exhausted ? onReset : onRefresh;
  const noun = intent === "dating" ? "dates" : "friends";
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIconWrap}>
        <LinearGradient
          colors={theme.accent}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
        />
        <Ionicons name={exhausted ? "checkmark-done" : "sparkles"} size={36} color="#FFFFFF" />
      </View>
      <Text style={styles.emptyTitle}>{exhausted ? "You've seen everyone" : "Feed warming up"}</Text>
      <Text style={styles.emptySubtitle}>
        {exhausted
          ? `You've passed on everyone in this feed. Start over, explore Spaces, or turn tonight's events into a plan.`
          : `No ${noun} in this vibe yet. Spaces, events, and fresh filters can still get a real conversation started.`}
      </Text>
      {exhausted ? (
        <Pressable style={styles.emptyBtn} onPress={handlePress} disabled={!handlePress || refreshing}>
          <LinearGradient
            colors={theme.accent}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
          />
          <Text style={styles.emptyBtnText}>{refreshing ? "Refreshing..." : "Start Over"}</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.emptyBtn} onPress={handlePress} disabled={!handlePress || refreshing}>
          <LinearGradient
            colors={theme.accent}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
          />
          <Text style={styles.emptyBtnText}>{refreshing ? "Refreshing..." : "Refresh Feed"}</Text>
        </Pressable>
      )}
      <View style={styles.emptyQuickActions}>
        <Pressable style={styles.emptyQuickBtn} onPress={() => router.push("/(tabs)/communities" as never)}>
          <Ionicons name="planet-outline" size={15} color="#FFFFFF" />
          <Text style={styles.emptyQuickText}>Explore Spaces</Text>
        </Pressable>
        <Pressable style={styles.emptyQuickBtn} onPress={() => router.push("/(tabs)/events" as never)}>
          <Ionicons name="calendar-outline" size={15} color="#FFFFFF" />
          <Text style={styles.emptyQuickText}>Find events</Text>
        </Pressable>
        <Pressable style={styles.emptyQuickBtn} onPress={() => router.push("/(tabs)/profile" as never)}>
          <Ionicons name="person-circle-outline" size={15} color="#FFFFFF" />
          <Text style={styles.emptyQuickText}>Complete profile</Text>
        </Pressable>
      </View>
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

/**
 * Wrapped export — DiscoverErrorBoundary catches any render crash inside the
 * Discover screen and shows a recoverable UI instead of a white screen.
 * The inner component keeps the same name for stack traces.
 */
export default function DiscoverScreen() {
  return (
    <DiscoverErrorBoundary>
      <DiscoverScreenInner />
    </DiscoverErrorBoundary>
  );
}

function DiscoverScreenInner() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ intent?: string; subtab?: string }>();
  const { userId, premium } = useSessionState();
  const subscription = useMemo(
    () => ({ isActive: premium?.isPremium === true }),
    [premium?.isPremium],
  );
  const { user } = useUser();
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

  const { data: myProfile } = useGetMyProfile();
  const currentUserIntent: IntentId | "all" =
    myProfile?.intent === "dating"
      ? "dating"
      : myProfile?.intent === "friendship" || myProfile?.intent === "networking"
      ? "friends"
      : myProfile?.intent === "all"
      ? "all"
      : DEFAULT_CURRENT_USER_INTENT;
  // Memoized so the array reference is stable across renders — prevents any
  // useEffect that depends on allowedTabs from firing on every parent re-render.
  const allowedTabs = useMemo(
    () =>
      currentUserIntent === "all"
        ? tabs
        : tabs.filter((tab) => tab.id === currentUserIntent),
    [currentUserIntent],
  );

  const [activeIntent, setActiveIntent] = useState<IntentId>(
    currentUserIntent === "all" ? "friends" : allowedTabs[0]!.id,
  );
  const [activeSubTab, setActiveSubTab] = useState("For You");
  const [cardIndex, setCardIndex] = useState(0);
  // Rewind — stores the last swiped profile+action so Plus users can undo.
  const lastSwipeRef = useRef<{ profile: Profile; action: SwipeAction; index: number } | null>(null);
  const [canRewind, setCanRewind] = useState(false);
  const rewindPillState = getRewindPillState({
    isPremium: subscription?.isActive === true,
    canRewind,
  });
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const expandedProfileAnim = useRef(new Animated.Value(0)).current;
  const expandedProfileClosingRef = useRef(false);
  const [shotProfile, setShotProfile] = useState<Profile | null>(null);
  const [shotSentTarget, setShotSentTarget] = useState<Profile | null>(null);
  const [shotError, setShotError] = useState<string | null>(null);
  const [shotPremiumRequired, setShotPremiumRequired] = useState(false);
  const [shotSending, setShotSending] = useState(false);
  const [shotToastVisible, setShotToastVisible] = useState(false);
  const [shotInitialMessage, setShotInitialMessage] = useState<string | undefined>(undefined);
  // ─── Daily dating-swipe counter ─────────────────────────────────────────────
  // Free users get DAILY_SWIPE_LIMIT vibes/sparks per day.
  // Logic extracted to lib/swipeCounter.ts for testability.
  const [swipesLeft, setSwipesLeft] = useState<number>(DAILY_SWIPE_LIMIT);
  const [swipeLimitModalVisible, setSwipeLimitModalVisible] = useState(false);

  // ─── First-session guide ─────────────────────────────────────────────────────
  // Show the 3-step coach mark overlay once to every new user. We read the flag
  // asynchronously and default to false so existing users never see it again.
  const [showGuide, setShowGuide] = useState(false);
  useEffect(() => {
    if (e2eSmokeEnabled) return;
    void AsyncStorage.getItem(GUIDE_SEEN_KEY).then((val) => {
      if (!val) setShowGuide(true);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load today's remaining swipes on mount
  useEffect(() => {
    void getSwipesLeft().then(setSwipesLeft);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const decrementSwipeCount = useCallback(async () => {
    const left = await decrementSwipes().catch(() => null);
    if (left !== null) setSwipesLeft(left);
  }, []);

  // ─── Daily shot limit — free users get 1 shot per day. We persist the date+count
  // in AsyncStorage so it survives across app restarts within the same calendar day.
  const SHOT_STORAGE_KEY = "cs:shots:daily";
  const checkShotLimitReached = useCallback(async (): Promise<boolean> => {
    try {
      const raw = await AsyncStorage.getItem(SHOT_STORAGE_KEY);
      if (!raw) return false;
      const { date, count } = JSON.parse(raw) as { date: string; count: number };
      const today = new Date().toISOString().slice(0, 10);
      return date === today && count >= 1;
    } catch {
      return false;
    }
  }, []);
  const incrementShotCount = useCallback(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const raw = await AsyncStorage.getItem(SHOT_STORAGE_KEY);
      const prev = raw ? (JSON.parse(raw) as { date: string; count: number }) : null;
      const count = prev?.date === today ? prev.count + 1 : 1;
      await AsyncStorage.setItem(SHOT_STORAGE_KEY, JSON.stringify({ date: today, count }));
    } catch {
      // non-critical — silently ignore
    }
  }, []);
  const [friendPeopleState, setFriendPeopleState] = useState<ApiFriendPerson[]>([]);
  const [friendNotice, setFriendNotice] = useState<string | null>(null);
  const [friendPremiumVisible, setFriendPremiumVisible] = useState(false);
  const [friendPlanVisible, setFriendPlanVisible] = useState(false);
  const [friendPlanMode, setFriendPlanMode] = useState<"plan" | "group">("plan");
  const [friendPlanInviteIds, setFriendPlanInviteIds] = useState<string[]>([]);
  // Tracks which profile IDs the user has passed — filtered out of the deck
  // for the rest of the session, like Tinder. Reset when the intent tab changes.
  const [passedProfileIds, setPassedProfileIds] = useState<Set<number | string>>(new Set());
  const [streakCount, setStreakCount] = useState(0);
  const [streakToastVisible, setStreakToastVisible] = useState(false);
  // Progressive feature unlock — track toast message locally
  const { unlock } = useFeatureUnlock();
  const [unlockMessage, setUnlockMessage] = useState<string | null>(null);

  // Load streak on mount
  useEffect(() => {
    void getSwipeStreak().then(setStreakCount);
  }, []);

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

  useEffect(() => {
    if (allowedTabs.some((tab) => tab.id === activeIntent)) return;
    setActiveIntent(allowedTabs[0]?.id ?? "dating");
    setActiveSubTab("For You");
    setCardIndex(0);
    setPassedProfileIds(new Set());
  }, [activeIntent, allowedTabs]);

  const theme = tabs.find((tab) => tab.id === activeIntent)!;
  const allowDemoSeeds = shouldUseDemoSeeds();
  const currentUserId = userId ?? myProfile?.userId ?? null;

  // Load the current user's VibeCheck answers from Firestore once (for real compat scores).
  const [myVibeAnswers, setMyVibeAnswers] = useState<VibeCheckAnswers | null>(null);
  // Loading sentinel — true until we know whether the user completed the quiz.
  // Prevents a flash of the quiz gate on users who have already completed it.
  // Users may skip the quiz once per session; they'll see it again next launch
  // until they complete it. We track this in ephemeral state (not persisted).
  // After quiz completion we show a full-screen personality reveal ("Sorting Hat moment")
  // before the user sees the deck for the first time.
  useEffect(() => {
    if (!currentUserId) return;
    void (async () => {
      try {
        const { getFirestore, doc, getDoc } = await import("firebase/firestore");
        const { getApp } = await import("firebase/app");
        const db = getFirestore(getApp());
        const snap = await getDoc(doc(db, "users", currentUserId));
        const vibeCheck = (snap.data() as { vibeCheck?: { answers: VibeCheckAnswers } } | undefined)?.vibeCheck;
        if (vibeCheck?.answers) setMyVibeAnswers(vibeCheck.answers);
      } catch {
        // Non-critical
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  const myModeData = (((myProfile as { modeData?: Record<string, unknown> } | undefined)?.modeData) ?? {}) as Record<string, unknown>;
  const viewerDatingIntent = normalizedDatingIntentLabel(
    typeof myModeData.datingGoal === "string" ? myModeData.datingGoal : myProfile?.connectionSubtype,
  );
  const discoverySubtype = getDiscoverySubtypeForDatingTab(activeSubTab, viewerDatingIntent);
  const {
    data: datingFeed,
    refetch: refetchDatingFeed,
    isFetching: datingFeedFetching,
  } = useGetDiscoveryFeed(
    { page: 1, limit: 30, intent: "dating", ...(discoverySubtype ? { subtype: discoverySubtype } : {}) },
    {
      query: {
        queryKey: getGetDiscoveryFeedQueryKey({ page: 1, limit: 30, intent: "dating", ...(discoverySubtype ? { subtype: discoverySubtype } : {}) }),
        enabled: activeIntent === "dating" && activeSubTab !== "Double Dates",
      },
    },
  );

  const loadFriendPeople = useCallback(async () => {
    if (!currentUserId) {
      setFriendPeopleState([]);
      return;
    }
    const result = await getFriendPeople(currentUserId);
    setFriendPeopleState(result.people ?? []);
  }, [currentUserId]);

  useEffect(() => {
    if (activeIntent !== "friends") return;
    let cancelled = false;
    if (!currentUserId) {
      setFriendPeopleState([]);
      return;
    }
    getFriendPeople(currentUserId)
      .then((result) => {
        if (!cancelled) setFriendPeopleState(result.people ?? []);
      })
      .catch(() => {
        if (!cancelled) setFriendPeopleState([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeIntent, currentUserId]);

  const serverDatingProfiles = useMemo(
    () => (datingFeed?.profiles ?? []).map((item, index) => apiProfileToDatingProfile(item as ApiProfile & { modeData?: Record<string, unknown> }, index)),
    [datingFeed?.profiles],
  );

  const friendProfiles = useMemo(() => {
    const serverProfiles = friendPeopleState.map(friendPersonToProfile);
    const mockProfiles = profiles.filter((item) => item.intent === "friends").map((item, index) => ({
      ...item,
      subGenre: friendIntentTabs[index % friendIntentTabs.length]!,
      photos: item.photos?.length ? item.photos.slice(0, 3) : buildProfilePhotos(item.image, index),
    }));
    return serverProfiles.length > 0 ? serverProfiles : allowDemoSeeds ? mockProfiles : [];
  }, [allowDemoSeeds, friendPeopleState]);

  const visibleProfiles = useMemo(() => {
    const profilePool =
      activeIntent === "dating"
        ? serverDatingProfiles.length > 0
          ? serverDatingProfiles
          : allowDemoSeeds
          ? profiles.filter((item) => item.intent === "dating")
          : []
        : friendProfiles;
    const hasActiveFriend = profilePool.some((item) => item.intent === "friends" && item.online);
    return profilePool.filter((profile) => {
      const allowed =
        currentUserIntent === "all" ||
        profile.intent === currentUserIntent ||
        (profile.intent as string) === "all";
      const matchesIntent =
        profile.intent === activeIntent || (profile.intent as string) === "all";
      const personalIntent = getSubIntentionLabel(profile);
      const matchesSub =
        profile.intent === "friends"
          ? activeSubTab === "For You"
            ? true
            : activeSubTab === "Active Tonight"
            ? profile.online || !hasActiveFriend
            : profile.subGenre === activeSubTab
          : activeSubTab === "For You"
          ? !isPersonalDatingIntent(viewerDatingIntent) || personalIntent === viewerDatingIntent
          : activeSubTab === "Active Tonight"
          ? true
          : activeSubTab === "Intentional"
          ? matchesIntentionalDating(profile)
          : activeSubTab === "Hookup" || activeSubTab === "Curious" || activeSubTab === "Having Fun"
          ? personalIntent === activeSubTab
          : profile.subGenre === activeSubTab;
      return allowed && matchesIntent && matchesSub;
    });
  }, [activeIntent, activeSubTab, allowDemoSeeds, serverDatingProfiles, viewerDatingIntent, friendProfiles]);

  // Filter out any profile the user has already passed this session
  const unpassed = useMemo(
    () => visibleProfiles.filter((p) => !passedProfileIds.has(p.id)),
    [visibleProfiles, passedProfileIds],
  );

  // Direct index — no modulo cycling so passed profiles never resurface.
  // When cardIndex >= unpassed.length the deck shows EmptyState.
  const profile = unpassed[cardIndex] ?? null;
  const deckExhausted = visibleProfiles.length > 0 && (unpassed.length === 0 || cardIndex >= unpassed.length);

  // Advance the deck. Called by SwipeDeck after a gesture-driven exit, and by
  // ExpandedProfile when the user uses the bottom action bar.
  const advanceDeck = useCallback(() => {
    setCardIndex((prev) => Math.min(prev + 1, unpassed.length));
  }, [unpassed.length]);

  // Premium tap-reaction system for VIBE / SPARK / PASS rail actions.
  const [actionState, setActionState] = useState<SwipeAction | null>(null);
  const reactionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Stays true for the entire hold + spring-back window so a rapid second tap can't
  // cancel the pending advanceDeck() call and leave the deck stuck.
  const actionInFlightRef = useRef(false);
  const resetDeckMotion = useCallback(() => {
    if (reactionTimeoutRef.current) {
      clearTimeout(reactionTimeoutRef.current);
      reactionTimeoutRef.current = null;
    }
    setActionState(null);
    actionInFlightRef.current = false;
  }, []);
  useEffect(() => {
    return () => {
      if (reactionTimeoutRef.current) clearTimeout(reactionTimeoutRef.current);
    };
  }, []);

  // Rewind: undo the last swipe. Plus-only — free users are routed to premium.
  const handleRewind = useCallback(() => {
    const decision = getRewindDecision({
      isPremium: subscription?.isActive === true,
      lastSwipe: lastSwipeRef.current,
      currentUserId,
    });

    if (decision.type === "paywall") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      openPremium("rewind");
      return;
    }
    if (decision.type === "noop") return;

    if (!subscription?.isActive) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      openPremium("rewind");
      return;
    }
    const last = lastSwipeRef.current;
    if (!last) return;

    if (last.action === "pass") {
      // Un-hide the profile from the deck.
      setPassedProfileIds((prev) => {
        const next = new Set(prev);
        next.delete(last.profile.id);
        return next;
      });
    } else if ((last.action === "vibe" || last.action === "spark") && currentUserId) {
      // Withdraw the reaction from the backend so it doesn't ghost in their
      // Reactions tab. Fire-and-forget — UX doesn't block on this.
      const receiverId = last.profile.userId ?? String(last.profile.id);
      void withdrawReaction({
        senderId: currentUserId,
        receiverId,
        type: last.action === "spark" ? "spark" : "like",
      }).catch(() => undefined);
      // Give the swipe count back so free users don't lose their limit on a rewind.
      if (!subscription?.isActive) {
        void refundSwipe().then(setSwipesLeft).catch(() => undefined);
      }
    }

    setCardIndex(last.index);
    lastSwipeRef.current = null;
    setCanRewind(false);
    resetDeckMotion();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [subscription?.isActive, currentUserId, resetDeckMotion]);

  // Mark a profile as passed so it's filtered out of the deck immediately.
  const markPassed = (p: Profile | null) => {
    if (!p) return;
    setPassedProfileIds((prev) => new Set([...prev, p.id]));
  };

  // ─── Premium tap-reaction system ──────────────────────────────────────
  // Tapping a rail button (VIBE / SPARK / PASS) doesn't just advance — it
  // fires a Raya/Hinge-style reaction: the active card scales/tilts/glows,
  // the ghost stack lifts, particles burst on SPARK, then the deck moves
  // forward. Mirrors the web spec's `actionState` pattern.
  useEffect(() => {
    resetDeckMotion();
    setCardIndex(0);
    setPassedProfileIds(new Set());
    lastSwipeRef.current = null;
    setCanRewind(false);
  }, [activeIntent, activeSubTab, resetDeckMotion]);

  useEffect(() => {
    if (unpassed.length === 0) {
      if (cardIndex !== 0) setCardIndex(0);
      resetDeckMotion();
      return;
    }
    if (cardIndex > unpassed.length) {
      setCardIndex(Math.max(0, unpassed.length - 1));
      resetDeckMotion();
    }
  }, [cardIndex, resetDeckMotion, unpassed.length]);

  const [feedRefreshing, setFeedRefreshing] = useState(false);
  const refreshFeed = useCallback(async () => {
    resetDeckMotion();
    setPassedProfileIds(new Set());
    setCardIndex(0);
    setFeedRefreshing(true);
    try {
      if (activeIntent === "friends") {
        await loadFriendPeople();
      } else if (activeSubTab !== "Double Dates") {
        await refetchDatingFeed();
      }
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch {
      if (activeIntent === "friends") {
        flashFriendNotice("Could not refresh friends. Try again.");
      } else {
        setShotError("Could not refresh discovery. Try again.");
      }
    } finally {
      setFeedRefreshing(false);
    }
  }, [activeIntent, activeSubTab, loadFriendPeople, refetchDatingFeed, resetDeckMotion]);

  useEffect(() => {
    if (!selectedProfile) return;
    expandedProfileClosingRef.current = false;
    expandedProfileAnim.setValue(0);
    Animated.timing(expandedProfileAnim, {
      toValue: 1,
      duration: 230,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [expandedProfileAnim, selectedProfile]);

  const closeExpandedProfile = useCallback((afterClose?: () => void) => {
    if (expandedProfileClosingRef.current) return;
    expandedProfileClosingRef.current = true;
    Animated.timing(expandedProfileAnim, {
      toValue: 0,
      duration: 190,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setSelectedProfile(null);
      expandedProfileClosingRef.current = false;
      afterClose?.();
    });
  }, [expandedProfileAnim]);




  const dating = useDatingMatches();
  useEffect(() => {
    if (typeof dating.serverRemainingSwipes === "number") {
      setSwipesLeft(dating.serverRemainingSwipes);
    }
  }, [dating.serverRemainingSwipes]);

  useEffect(() => {
    if (dating.swipeLimitNoticeId <= 0) return;
    setSwipesLeft(0);
    setSwipeLimitModalVisible(true);
    Analytics.swipeLimitHit({ intent: "dating", swipesUsed: DAILY_SWIPE_LIMIT });
    Analytics.paywallSeen("swipes", { intent: "dating", source: "server_swipe_guard" });
    dating.clearSwipeLimitNotice();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dating.swipeLimitNoticeId]);

  const recordDatingAction = (action: SwipeAction) => {
    if (activeIntent !== "dating") return;
    if (!profile) return;
    if (!currentUserId) {
      setShotError("Sign in again to send likes.");
      return;
    }
    const snapshot = datingSnapshot(profile);
    const receiverId = profile.userId ?? String(profile.id);
    if (action === "vibe") {
      const match = dating.recordVibe(snapshot);
      if (match) {
        // Progressive unlock — first match and five-match milestones
        void unlock(MILESTONES.FIRST_MATCH).then((msg) => { if (msg) setUnlockMessage(msg); });
        if (dating.matches.length >= 5) {
          void unlock(MILESTONES.FIVE_MATCHES).then((msg) => { if (msg) setUnlockMessage(msg); });
        }
      }
      // Register as a "like" reaction → appears in the target's Reactions tab
      void sendInboxReaction({
        senderId: currentUserId,
        receiverId,
        type: "like",
        sourceType: "profile",
      }).catch(() => {});
    } else if (action === "spark") {
      const match = dating.recordSpark(snapshot);
      if (match) {
        void unlock(MILESTONES.FIRST_MATCH).then((msg) => { if (msg) setUnlockMessage(msg); });
        if (dating.matches.length >= 5) {
          void unlock(MILESTONES.FIVE_MATCHES).then((msg) => { if (msg) setUnlockMessage(msg); });
        }
      }
      // Register as a "spark" reaction → appears in the target's Reactions tab
      void sendInboxReaction({
        senderId: currentUserId,
        receiverId,
        type: "spark",
        sourceType: "profile",
      }).catch(() => {});
    } else if (action === "pass") {
      dating.recordPass(snapshot);
    }
  };

  const guardDiscoverAction = useCallback(async (action: DiscoverAction): Promise<boolean> => {
    if (subscription?.isActive) return true;
    if (!shouldConsumeDiscoverAction(activeIntent, action)) return true;
    if (swipesLeft <= 0) {
      setSwipeLimitModalVisible(true);
      // Analytics: record that the limit was hit and the paywall was shown
      Analytics.swipeLimitHit({ intent: activeIntent, swipesUsed: DAILY_SWIPE_LIMIT });
      Analytics.paywallSeen("swipes", { intent: activeIntent, source: "swipe_guard" });
      // NOTE: Do NOT call openPremium() here — the swipe-limit modal's CTA already
      // calls openPremium("swipes") when the user taps "Get Unlimited Likes →".
      // Calling it here too stacks multiple premium screens on rapid denials, freezing the app.
      return false;
    }
    await decrementSwipeCount();
    return true;
  }, [activeIntent, decrementSwipeCount, subscription?.isActive, swipesLeft]);

  // ── Shot flow orchestration (UX polish) ────────────────────────────────────
  // Where the shot started (expanded profile vs deck) decides what happens
  // after the toast: expanded-origin shots smoothly close the profile and
  // advance to the next person; cancelling the sheet returns to wherever the
  // user was — never dumps them back on Discover mid-flow.
  const shotFromExpandedRef = useRef(false);
  const shotJustSentRef = useRef(false);
  const shotToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissShotToast = useCallback(() => {
    if (shotToastTimerRef.current) {
      clearTimeout(shotToastTimerRef.current);
      shotToastTimerRef.current = null;
    }
    setShotToastVisible(false);
    setShotSentTarget(null);
    // Shot sent from the expanded profile → glide to the next person.
    if (shotFromExpandedRef.current && shotJustSentRef.current) {
      closeExpandedProfile(() => advanceDeck());
    }
    shotFromExpandedRef.current = false;
    shotJustSentRef.current = false;
  }, [advanceDeck, closeExpandedProfile]);

  const openShotSheet = useCallback(async (target: Profile, initialMessage?: string) => {
    // Check the TARGET profile's intent, not the screen toggle — the toggle can be
    // "friends" while the expanded profile is a dating-intent person, which was
    // silently blocking suggestion-row taps in ExpandedProfileCard.
    if ((target.intent ?? "dating") !== "dating") return;
    const allowed = await guardDiscoverAction("shot");
    if (!allowed) return;
    setShotError(null);
    setShotInitialMessage(initialMessage);
    // Check daily limit — if already used 1 shot today, surface CS Plus upsell immediately
    const limitReached = await checkShotLimitReached();
    setShotPremiumRequired(limitReached);
    setShotProfile(target);
  }, [checkShotLimitReached, guardDiscoverAction]);

  const sendShotToProfile = useCallback(async (message: string) => {
    if (!shotProfile) return false;
    if (!currentUserId) {
      setShotError("Sign in again to send a Shot.");
      return false;
    }
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
    // Track the shot so the next one today triggers CS Plus upsell
    void incrementShotCount();
    // Register as a shot_request in the Inbox so receiver sees it in Requests tab
    void sendInboxRequest({
      senderId: currentUserId,
      receiverId: shotProfile.userId ?? String(shotProfile.id),
      type: "shot_request",
      sourceType: "shot",
      message,
    }).catch(() => {/* non-fatal */});
    setShotSentTarget(shotProfile);
    shotJustSentRef.current = true;
    setShotToastVisible(true);
    // Self-dismiss on a comfortable timer; dismissal also advances the deck
    // when the shot came from an expanded profile.
    if (shotToastTimerRef.current) clearTimeout(shotToastTimerRef.current);
    shotToastTimerRef.current = setTimeout(dismissShotToast, 3600);
    return true;
  }, [shotProfile, dating, dismissShotToast, incrementShotCount, currentUserId]);

  const flashFriendNotice = (message: string) => {
    setFriendNotice(message);
    setTimeout(() => setFriendNotice((current) => (current === message ? null : current)), 2400);
  };

  const openFriendPlan = async (target?: Profile, mode: "plan" | "group" = "plan", skipLimit = false) => {
    if (!skipLimit) {
      const allowed = await guardDiscoverAction(mode === "group" ? "create_group" : "create_plan");
      if (!allowed) return;
    }
    if (!currentUserId) {
      flashFriendNotice("Sign in again to make plans.");
      return;
    }
    setFriendPlanMode(mode);
    setFriendPlanInviteIds(target?.userId ? [target.userId] : []);
    setFriendPlanVisible(true);
  };

  const handleFriendAction = async (target: Profile | null, action: "pass" | "connect" | "best_friend") => {
    if (!target?.userId) return false;
    if (!currentUserId) {
      flashFriendNotice("Sign in again to connect.");
      return false;
    }
    const discoverAction: DiscoverAction =
      action === "connect" ? "vibe" : action === "best_friend" ? "best_friend" : "pass";
    const allowedByLimit = await guardDiscoverAction(discoverAction);
    if (!allowedByLimit) return false;
    try {
      const result = await sendFriendDeckAction({ userId: currentUserId, targetUserId: target.userId, action });
      if (result.premiumRequired) {
        setFriendPremiumVisible(true);
        return false;
      }
      if (action === "connect") flashFriendNotice(result.relationshipStatus === "friends" ? "Friend chat moved to Primary" : "Friend request sent");
      if (action === "best_friend") flashFriendNotice("Besties sent");
      return true;
    } catch (error: any) {
      if (error?.status === 402 || error?.premiumRequired) {
        setFriendPremiumVisible(true);
        return false;
      }
      flashFriendNotice("That action did not go through. Try again.");
      return false;
    }
  };

  const handleReaction = useCallback(async (action: SwipeAction) => {
    // Guard against the 280ms gap window between setActionState(null) and the
    // nested advanceDeck() timeout. Without actionInFlightRef, a rapid tap
    // during that window passes the actionState check, then clearTimeout()
    // cancels advanceDeck and the deck freezes permanently on the current card.
    if (actionState !== null || actionInFlightRef.current) return;
    actionInFlightRef.current = true;

    // Haptic + sound feedback per action type
    if (action === "pass") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      void playSound("swipe_left");
    } else if (action === "vibe") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      void playSound("swipe_right");
    } else if (action === "spark") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void playSound("swipe_right");
    }

    if (activeIntent === "friends") {
      const friendAction = action === "vibe" ? "connect" : action === "spark" ? "best_friend" : "pass";
      const allowed = await handleFriendAction(profile, friendAction);
      if (!allowed) return;
    } else {
      const allowed = await guardDiscoverAction(action);
      if (!allowed) return;
      recordDatingAction(action);
    }

    // PostHog funnel — swipe event
    if (profile) {
      Analytics.swipe(action, {
        profileId: profile.userId ?? profile.id,
        intent: activeIntent,
        deckIndex: cardIndex,
        subTab: activeSubTab,
      });
    }

    // Swipe streak — record and show toast on milestone
    void recordSwipe().then((streak) => {
      setStreakCount(streak);
      if (streak > 0 && streak % 3 === 0) {
        setStreakToastVisible(true);
        setTimeout(() => setStreakToastVisible(false), 2800);
      }
    });

    // Progressive feature unlock — first swipe unlocks Stories Strip
    void unlock(MILESTONES.FIRST_SWIPE).then((msg) => {
      if (msg) setUnlockMessage(msg);
    });

    if (action === "pass") markPassed(profile);
    // Snapshot for Rewind — captured before the card exits.
    if (profile) {
      lastSwipeRef.current = { profile, action, index: cardIndex };
      setCanRewind(true);
    }
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
        if (action !== "pass") advanceDeck();
        reactionTimeoutRef.current = null;
        // Release the flight lock only after advanceDeck() — this is the latest
        // possible moment, ensuring no tap can interrupt the full hold → spring-back
        // → advance sequence.
        actionInFlightRef.current = false;
      }, SPRING_BACK_MS);
    }, holdDuration);
  }, [actionState, activeIntent, activeSubTab, advanceDeck, cardIndex, guardDiscoverAction,
      handleFriendAction, markPassed, playSound, profile, recordDatingAction, recordSwipe, unlock]);

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
            <Text style={styles.taglineText}>MEET. CONNECT. VIBE.</Text>
            <View style={styles.taglineLine} />
          </View>
          {/* Dating controls moved to cardActionsOverlay inside cardArea below
              so they don't consume header layout space — keeps card height
              identical between Dating and Friends modes. */}

          {/* Streak milestone toast */}
          {streakToastVisible ? (
            <View style={styles.streakToast}>
              <Text style={styles.streakToastText}>🔥 {streakCount}-day streak! You're on fire</Text>
            </View>
          ) : null}
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
                    setPassedProfileIds(new Set());
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
                    <View style={[styles.intentIconShell, isActive && styles.intentIconShellActive]}>
                      <Ionicons
                        name={tab.icon}
                        size={22}
                        color={isActive ? "#FFF" : isAllowed ? tab.glow : "#3F3F46"}
                      />
                      {isActive ? <View style={styles.intentIconDot} /> : null}
                    </View>
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

        {/* ── Controls strip: swipes left | ⚡ Boost | ↩ Rewind ── */}
        <View style={styles.controlsStrip}>
          {/* Left: swipes counter */}
          <Text style={styles.controlsSwipes}>
            {subscription?.isActive
              ? "Unlimited"
              : swipesLeft === 0
              ? "Out of swipes"
              : `${swipesLeft} swipes left`}
          </Text>
          {/* Center: Boost — plain text, no pill */}
          <Pressable
            onPress={() => {
              void Haptics.selectionAsync();
              openPremium("boost");
            }}
            style={styles.controlsBoost}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Boost profile"
          >
            <Ionicons name="flash" size={11} color="#FFA500" />
            <Text style={styles.controlsBoostLabel}>Boost</Text>
          </Pressable>
          {/* Right: Rewind (dating only) */}
          {shouldShowRewindPill(activeIntent) ? (
            <Pressable
              onPress={handleRewind}
              style={styles.controlsRewind}
              hitSlop={10}
              disabled={rewindPillState.disabled}
              accessibilityRole="button"
              accessibilityLabel="Rewind last swipe"
            >
              <Ionicons
                name={rewindPillState.icon as any}
                size={11}
                color={rewindPillState.tone === "active" ? "#A855F7" : "rgba(255,255,255,0.28)"}
              />
              <Text
                style={[
                  styles.controlsRewindLabel,
                  rewindPillState.tone === "active" && { color: "#A855F7" },
                ]}
              >
                Rewind
              </Text>
            </Pressable>
          ) : (
            <View style={{ flex: 1 }} />
          )}
        </View>

        {/* Intent-specific swipe lanes. Friends now uses the same deck as Dating
            with friendship-focused filters and rail actions. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.subTabsContent}
          style={styles.subTabsScroll}
        >
          {subTabs[activeIntent].map((tab) => {
            const active = activeSubTab === tab;
            return (
              <AnimatedTap
                key={tab}
                onPress={() => { setActiveSubTab(tab); setCardIndex(0); }}
                style={[styles.subTabBtn, active && styles.subTabBtnActive]}
                pressScale={0.96}
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
              </AnimatedTap>
            );
          })}
        </ScrollView>

        {activeIntent === "dating" && activeSubTab === "Double Dates" ? (
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
            {/* ── Overlay row (boost · swipes · rewind) ───────────────────
                Shown for BOTH dating and friends — boost + swipe counter
                create FOMO that nudges free users toward Plus. Rewind is
                dating-only since friend swipes don't have the same "undo"
                need. Floated absolute so neither mode loses card height. */}
            {currentUserId ? (
              <View style={styles.cardActionsOverlay} pointerEvents="box-none">
                {streakCount >= 2 ? (
                  <View style={styles.streakPill}>
                    <Text style={styles.streakText}>🔥 {streakCount}-day streak</Text>
                  </View>
                ) : null}
                <ProfileBoostBanner userId={currentUserId} isPremium={subscription?.isActive === true} />
              </View>
            ) : null}

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
                onAction={async (action) => {
                  const actionTarget = profile;
                  if (activeIntent === "friends") {
                    const friendAction = action === "vibe" ? "connect" : action === "spark" ? "best_friend" : "pass";
                    const allowed = await handleFriendAction(actionTarget, friendAction);
                    if (!allowed) return false;
                  } else {
                    const allowed = await guardDiscoverAction(action);
                    if (!allowed) return false;
                    recordDatingAction(action);
                  }
                  if (action === "pass") markPassed(actionTarget);
                  else advanceDeck();
                  return true;
                }}
                actionState={actionState}
                onReaction={handleReaction}
                onShot={() => {
                  shotFromExpandedRef.current = false; // deck-origin shot
                  void openShotSheet(profile);
                }}
                onFriendInvite={() => void handleReaction("vibe")}
                onFriendPlan={() => void openFriendPlan(profile, "plan")}
                onFriendBest={() => void handleReaction("spark")}
                myVibeAnswers={myVibeAnswers}
              />
            ) : deckExhausted ? (
              <DeckExhaustedState
                intent={activeIntent}
                profilesSeen={cardIndex}
                onExpandRadius={() => {
                  // Reset deck with a wider radius — backend will expand on next fetch
                  resetDeckMotion();
                  setPassedProfileIds(new Set());
                  setCardIndex(0);
                  void refreshFeed?.();
                }}
                onRefresh={() => {
                  resetDeckMotion();
                  setPassedProfileIds(new Set());
                  setCardIndex(0);
                  void refreshFeed?.();
                }}
              />
            ) : (
              <EmptyState
                theme={theme}
                intent={activeIntent}
                exhausted={false}
                refreshing={feedRefreshing || datingFeedFetching}
                onReset={() => {
                  resetDeckMotion();
                  setPassedProfileIds(new Set());
                  setCardIndex(0);
                }}
                onRefresh={refreshFeed}
              />
            )}
          </View>
        )}
      </View>

      <Modal
        visible={selectedProfile !== null}
        animationType="none"
        transparent
        statusBarTranslucent
        onRequestClose={() => closeExpandedProfile()}
      >
        {/* Dark splash wrapper eliminates the white flash as the modal slides up */}
        <Animated.View
          style={{
            flex: 1,
            backgroundColor: "#050505",
            opacity: expandedProfileAnim,
            transform: [
              {
                translateY: expandedProfileAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [26, 0],
                }),
              },
              {
                scale: expandedProfileAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.985, 1],
                }),
              },
            ],
          }}
        >
          {selectedProfile ? (
            <ExpandedProfileCard
              profile={selectedProfile}
              onClose={() => closeExpandedProfile()}
              onAction={async (action) => {
                // Validate only — guard check + record. Do NOT close the modal here.
                // Closing happens in onActionComplete, AFTER the overlay animation
                // finishes, so the animation is never cut short by the modal closing.
                const actionTarget = selectedProfile;
                if (activeIntent === "friends") {
                  if (action === "create_plan" || action === "create_group") {
                    const mode = action === "create_group" ? "group" : "plan";
                    const allowed = await guardDiscoverAction(mode === "group" ? "create_group" : "create_plan");
                    if (!allowed) return false;
                    return true; // close happens in onActionComplete below
                  }
                  const friendAction = action === "best_friend" ? "best_friend" : action === "vibe" ? "connect" : "pass";
                  const allowed = await handleFriendAction(actionTarget, friendAction);
                  if (!allowed) return false;
                  if (action === "pass") markPassed(actionTarget);
                  return true;
                } else if (action === "vibe" || action === "spark" || action === "pass") {
                  const allowed = await guardDiscoverAction(action);
                  if (!allowed) return false;
                  recordDatingAction(action);
                }
                if (action === "pass") markPassed(actionTarget);
                return true;
              }}
              onActionComplete={(action) => {
                // Called AFTER the in-card overlay animation completes (~720 ms).
                // This is when we close the expanded profile and advance the deck,
                // so the user sees the full animation before anything moves.
                if (activeIntent === "friends" && (action === "create_plan" || action === "create_group")) {
                  const mode = action === "create_group" ? "group" : "plan";
                  // selectedProfile is still non-null here — setSelectedProfile(null)
                  // only fires inside closeExpandedProfile's completion callback.
                  closeExpandedProfile(() => openFriendPlan(selectedProfile ?? undefined, mode, true));
                  return;
                }
                closeExpandedProfile(() => {
                  if (action !== "pass") advanceDeck();
                });
              }}
              onShot={(initialMessage) => {
                // Stay IN the expanded profile — the shot sheet floats above
                // it. Cancelling returns here; sending advances after the
                // toast (UX fix: no more dropping to Discover mid-flow).
                shotFromExpandedRef.current = true;
                if (selectedProfile) void openShotSheet(selectedProfile, initialMessage);
              }}
            />
          ) : null}
        </Animated.View>
      </Modal>

      <ShotBottomSheet
        visible={shotProfile !== null}
        target={shotProfile}
        sending={shotSending}
        error={shotError}
        premiumRequired={shotPremiumRequired}
        initialMessage={shotInitialMessage}
        suggestions={shotProfile ? getShotSuggestions(shotProfile) : undefined}
        onClose={() => {
          setShotProfile(null);
          setShotInitialMessage(undefined);
        }}
        onSend={sendShotToProfile}
      />
      <ShotToast
        visible={shotToastVisible}
        target={shotSentTarget}
        onClose={dismissShotToast}
      />
      {/* Progressive feature unlock toast — fires once per milestone */}
      <UnlockToast
        message={unlockMessage}
        onDismiss={() => setUnlockMessage(null)}
      />
      {friendNotice ? (
        <View pointerEvents="none" style={styles.friendToast}>
          <Ionicons name="people-circle" size={18} color="#BFDBFE" />
          <Text style={styles.friendToastText}>{friendNotice}</Text>
        </View>
      ) : null}
      <CreateFriendPlanSheet
        visible={friendPlanVisible}
        userId={currentUserId ?? ""}
        friends={friendPeopleState}
        initialInviteIds={friendPlanInviteIds}
        initialSourceTab="event"
        initialTitle={friendPlanMode === "group" ? "Group hang tonight" : undefined}
        onClose={() => setFriendPlanVisible(false)}
        onCreated={(result) => {
          setFriendPlanVisible(false);
          flashFriendNotice(friendPlanMode === "group" ? "Group invite sent to Requests" : "Plan created in Connect");
          if (result.chat?.id) openChat(result.chat.id);
        }}
      />
      <SenderPlusModal visible={dating.premiumPrompt !== null} feature="shots" onClose={dating.clearPremiumPrompt} />
      <SenderPlusModal visible={friendPremiumVisible} feature="best-friend" onClose={() => setFriendPremiumVisible(false)} />

      {/* Daily swipe limit modal */}
      <Modal
        visible={swipeLimitModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSwipeLimitModalVisible(false)}
      >
        <Pressable
          style={styles.swipeLimitOverlay}
          onPress={() => setSwipeLimitModalVisible(false)}
        >
          <Pressable style={styles.swipeLimitSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.swipeLimitEmoji}>💔</Text>
            <Text style={styles.swipeLimitTitle}>You're out of likes for today</Text>
            <Text style={styles.swipeLimitBody}>
              Upgrade to ConnectSphere Plus for unlimited likes.
            </Text>
            <Pressable
              onPress={() => {
                setSwipeLimitModalVisible(false);
                openPremium("swipes");
              }}
              style={styles.swipeLimitCta}
            >
              <LinearGradient
                colors={["#EC4899", "#A855F7"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.swipeLimitCtaGrad}
              >
                <Text style={styles.swipeLimitCtaText}>Get Unlimited Likes →</Text>
              </LinearGradient>
            </Pressable>
            <Pressable onPress={() => setSwipeLimitModalVisible(false)} style={styles.swipeLimitDismiss}>
              <Text style={styles.swipeLimitDismissText}>Maybe tomorrow</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* First-session 3-step coach mark guide — shown once per new user */}
      <FirstSessionGuide
        visible={showGuide}
        onDone={() => setShowGuide(false)}
      />

    </View>
  );
}

function SenderPlusModal({ visible, feature, onClose }: { visible: boolean; feature: "shots" | "best-friend"; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const copy =
    feature === "best-friend"
      ? {
          eyebrow: "Friend moves unlocked",
          title: "Make every friend request count.",
          text: "Unlock Besties, premium friend moves, and priority reactions so your invites land with more heat.",
          bullets: ["Unlimited premium friend actions", "Bestie badges in Reactions", "Priority plan and group invites"],
        }
      : {
          eyebrow: "Shot limit reached",
          title: "Keep the momentum going.",
          text: "Unlock more Shots, Sparks, and reveal power so one good profile never slows the feed down.",
          bullets: ["More daily Shots and Sparks", "Reveal premium reactions", "Hotter placement in Connect"],
        };
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.senderPlusBackdrop}>
        <LinearGradient
          colors={["#050006", "#12020C", "#000000"]}
          locations={[0, 0.48, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View pointerEvents="none" style={styles.senderPlusGlowTop} />
        <View pointerEvents="none" style={styles.senderPlusGlowBottom} />
        <View style={[styles.senderPlusFullScreen, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 24 }]}>
          <AnimatedTap onPress={onClose} style={[styles.senderPlusClose, { top: insets.top + 14 }]} hitSlop={10} pressScale={0.9}>
            <Ionicons name="close" size={18} color="#fff" />
          </AnimatedTap>

          <View style={styles.senderPlusHero}>
            <View style={styles.senderPlusIcon}>
              <Ionicons name="diamond" size={34} color="#FFFFFF" />
            </View>
            <Text style={styles.senderPlusEyebrow}>{copy.eyebrow}</Text>
            <Text style={styles.senderPlusTitle}>{copy.title}</Text>
            <Text style={styles.senderPlusText}>{copy.text}</Text>
          </View>

          <View style={styles.senderPlusBenefits}>
            {copy.bullets.map((item) => (
              <View key={item} style={styles.senderPlusBenefitRow}>
                <LinearGradient colors={["#EC4899", "#A855F7"]} style={styles.senderPlusBenefitIcon}>
                  <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                </LinearGradient>
                <Text style={styles.senderPlusBenefitText}>{item}</Text>
              </View>
            ))}
          </View>

          <AnimatedTap
            onPress={() => {
              onClose();
              openPremium(feature);
            }}
            style={styles.senderPlusButton}
            pressScale={0.96}
          >
            <LinearGradient colors={["#EC4899", "#A855F7"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.senderPlusButtonGrad}>
              <Text style={styles.senderPlusButtonText}>Unlock ConnectSphere Plus</Text>
            </LinearGradient>
          </AnimatedTap>
          <AnimatedTap onPress={onClose} style={styles.senderPlusSecondary} pressScale={0.97}>
            <Text style={styles.senderPlusSecondaryText}>Not now</Text>
          </AnimatedTap>
        </View>
      </View>
    </Modal>
  );
}

function AnimatedTap({
  children,
  disabled,
  hitSlop,
  onPress,
  pressScale = 0.96,
  style,
}: {
  children: ReactNode;
  disabled?: boolean;
  hitSlop?: number;
  onPress?: () => void;
  pressScale?: number;
  style?: any;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (toValue: number) => {
    Animated.spring(scale, {
      toValue,
      friction: 7,
      tension: 220,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        disabled={disabled}
        hitSlop={hitSlop}
        onPress={onPress}
        onPressIn={() => animateTo(pressScale)}
        onPressOut={() => animateTo(1)}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#020003" },
  senderPlusBackdrop: {
    flex: 1,
    backgroundColor: "#000000",
  },
  senderPlusFullScreen: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "space-between",
    overflow: "hidden",
  },
  senderPlusGlowTop: {
    position: "absolute",
    top: -120,
    alignSelf: "center",
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: "rgba(236,72,153,0.22)",
  },
  senderPlusGlowBottom: {
    position: "absolute",
    bottom: -150,
    right: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(168,85,247,0.18)",
  },
  senderPlusClose: {
    position: "absolute",
    top: 18,
    right: 22,
    zIndex: 2,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  senderPlusHero: {
    flex: 1,
    justifyContent: "center",
    alignItems: "flex-start",
    paddingTop: 44,
  },
  senderPlusIcon: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(236,72,153,0.24)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    marginBottom: 22,
    shadowColor: "#EC4899",
    shadowOpacity: 0.55,
    shadowRadius: 30,
  },
  senderPlusEyebrow: {
    color: "#F9A8D4",
    fontSize: 12,
    fontFamily: "Inter_900Black",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  senderPlusTitle: { color: "#fff", fontSize: 42, lineHeight: 46, fontFamily: "Sora_800ExtraBold", marginTop: 10, maxWidth: 330 },
  senderPlusText: { color: "rgba(255,255,255,0.72)", fontSize: 15, lineHeight: 22, fontFamily: "Inter_600SemiBold", marginTop: 14, maxWidth: 330 },
  senderPlusBenefits: {
    gap: 12,
    marginBottom: 22,
  },
  senderPlusBenefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.055)",
    padding: 13,
  },
  senderPlusBenefitIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  senderPlusBenefitText: { flex: 1, color: "#FFFFFF", fontSize: 14, lineHeight: 18, fontFamily: "Inter_800ExtraBold" },
  senderPlusButton: { borderRadius: 999, overflow: "hidden" },
  senderPlusButtonGrad: { alignItems: "center", paddingVertical: 17 },
  senderPlusButtonText: { color: "#fff", fontSize: 15, fontFamily: "Inter_900Black" },
  senderPlusSecondary: { alignItems: "center", paddingVertical: 16 },
  senderPlusSecondaryText: { color: "rgba(255,255,255,0.58)", fontSize: 13, fontFamily: "Inter_800ExtraBold" },
  friendToast: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 112,
    zIndex: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.46)",
    backgroundColor: "rgba(6,12,24,0.92)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#60A5FA",
    shadowOpacity: 0.35,
    shadowRadius: 18,
  },
  friendToastText: { color: "#EFF6FF", fontSize: 12, fontWeight: "900" },

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

  headerActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  streakPill: {
    backgroundColor: "rgba(251,146,60,0.18)",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(251,146,60,0.35)",
  },
  streakText: { color: "#FB923C", fontSize: 11, fontFamily: "Inter_700Bold" },
  streakToast: {
    position: "absolute",
    bottom: 0,
    left: 20,
    right: 20,
    backgroundColor: "#1C1917",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(251,146,60,0.4)",
    zIndex: 100,
  },
  streakToastText: { color: "#FB923C", fontFamily: "Inter_700Bold", fontSize: 14 },

  // Daily swipe counter pill
  swipesPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
  },
  swipesPillOk: {
    backgroundColor: "rgba(161,161,170,0.12)",
    borderColor: "rgba(161,161,170,0.25)",
  },
  swipesPillLow: {
    backgroundColor: "rgba(236,72,153,0.15)",
    borderColor: "rgba(236,72,153,0.35)",
  },
  swipesPillEmpty: {
    backgroundColor: "rgba(239,68,68,0.15)",
    borderColor: "rgba(239,68,68,0.40)",
  },
  swipesPillText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  rewindPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  rewindPillActive: {
    borderColor: "rgba(168,85,247,0.35)",
    backgroundColor: "rgba(168,85,247,0.08)",
  },
  rewindPillLocked: {
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  rewindPillDisabled: {
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  rewindPillText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  rewindPillTextActive: { color: "#A855F7" },
  rewindPillTextLocked: { color: "#52525B" },
  rewindPillTextDisabled: { color: "#3F3F46" },

  // Dating controls overlay — position:absolute so it floats above the card
  // stack without consuming any layout height. This keeps cardArea flex:1
  // the same size in both Dating and Friends modes.
  cardActionsOverlay: {
    position: "absolute",
    top: 8,
    left: 0,
    // Stop before the 90px action-rail gutter on the right
    right: 94,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 4,
    paddingHorizontal: 4,
  },

  // Swipe-limit modal
  swipeLimitOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "flex-end",
  },
  swipeLimitSheet: {
    backgroundColor: "#0F0F0F",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(236,72,153,0.25)",
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 44,
    alignItems: "center",
    gap: 10,
  },
  swipeLimitEmoji: { fontSize: 44 },
  swipeLimitTitle: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center" },
  swipeLimitBody: {
    color: "#A1A1AA",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 6,
  },
  swipeLimitCta: { width: "100%", borderRadius: 16, overflow: "hidden" },
  swipeLimitCtaGrad: {
    paddingVertical: 16,
    alignItems: "center",
  },
  swipeLimitCtaText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  swipeLimitDismiss: { paddingVertical: 10 },
  swipeLimitDismissText: { color: "#71717A", fontSize: 14, fontFamily: "Inter_400Regular" },

  controlsStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  controlsSwipes: {
    flex: 1,
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.28)",
  },
  controlsBoost: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  controlsBoostLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#FFA500",
  },
  controlsRewind: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 3,
  },
  controlsRewindLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.28)",
  },

  // Intent tabs — slim glossy black glass with pink border (~50px). Tightened
  // top margin (mt-3) and reduced inner py-2 per latest spec.
  intentRow: {
    marginTop: 10, flexDirection: "row", alignItems: "center",
    height: 70,
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
    gap: 9, paddingVertical: 6, paddingHorizontal: 8,
  },
  intentIconShell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  intentIconShellActive: {
    borderColor: "rgba(255,255,255,0.38)",
    backgroundColor: "rgba(255,255,255,0.18)",
    shadowColor: "#FFF",
    shadowOpacity: 0.32,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  intentIconDot: {
    position: "absolute",
    right: 5,
    top: 5,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFF",
  },
  intentBtnLabel: { fontSize: 15, fontWeight: "900" },
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
  emptyQuickActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  emptyQuickBtn: {
    minHeight: 40, borderRadius: 999, paddingHorizontal: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    backgroundColor: "rgba(255,255,255,0.10)", borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  emptyQuickText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
});

// ─── Expanded Profile Modal ────────────────────────────────────────────────────
function ExpandedProfile({
  profile,
  theme,
  intent,
  onClose,
  onAction,
  onShot,
}: {
  profile: Profile;
  theme: Theme;
  intent: IntentId;
  onClose: () => void;
  onAction: (action: ProfileAction) => boolean | void | Promise<boolean | void>;
  onShot: (initialMessage?: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 16 : insets.top;
  const bottomPad = Platform.OS === "web" ? 24 : insets.bottom + 16;
  const [photoIdx, setPhotoIdx] = useState(0);
  const [feedbackAction, setFeedbackAction] = useState<ProfileAction | null>(null);
  const feedbackAnim = useRef(new Animated.Value(0)).current;
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // All photos — prefer the photos[] array, fall back to single image
  const allPhotos: string[] = profile.photos?.length ? profile.photos : [profile.image];

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    };
  }, []);

  const playActionFeedback = (action: ProfileAction) =>
    new Promise<void>((resolve) => {
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      setFeedbackAction(action);
      feedbackAnim.setValue(0);
      Animated.sequence([
        Animated.spring(feedbackAnim, {
          toValue: 1,
          stiffness: 290,
          damping: 16,
          mass: 0.9,
          useNativeDriver: true,
        }),
        Animated.timing(feedbackAnim, {
          toValue: 0,
          duration: 180,
          delay: 380,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setFeedbackAction(null);
        resolve();
      });
      feedbackTimeoutRef.current = setTimeout(resolve, 720);
    });

  const handleAction = async (action: ProfileAction) => {
    if (feedbackAction) return;
    if (intent === "dating" && action === "shot") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      onShot();
      return;
    }
    const haptic =
      action === "pass"
        ? Haptics.ImpactFeedbackStyle.Light
        : action === "spark" || action === "best_friend"
          ? Haptics.ImpactFeedbackStyle.Heavy
          : Haptics.ImpactFeedbackStyle.Medium;
    void Haptics.impactAsync(haptic).catch(() => {});
    await playActionFeedback(action);
    const result = await onAction(action);
    if (result !== false) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const goNext = () => setPhotoIdx((i) => Math.min(allPhotos.length - 1, i + 1));
  const goPrev = () => setPhotoIdx((i) => Math.max(0, i - 1));

  return (
    <View style={expStyles.root}>
      <ScrollView
        style={expStyles.scroll}
        contentContainerStyle={[expStyles.scrollContent, { paddingBottom: 160 + bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero image section — swipeable photo carousel */}
        <View style={expStyles.hero}>
          <ExpoImage
            source={{ uri: allPhotos[photoIdx] ?? profile.image }}
            style={expStyles.heroImage}
            contentFit="cover"
            transition={220}
          />

          <LinearGradient
            colors={["rgba(0,0,0,0.15)", "rgba(0,0,0,0.25)", "#050505"]}
            locations={[0, 0.52, 1]}
            style={StyleSheet.absoluteFill}
          />

          {/* Tap zones for photo navigation */}
          {allPhotos.length > 1 ? (
            <>
              <Pressable
                onPress={goPrev}
                style={expStyles.photoZoneLeft}
                hitSlop={0}
              />
              <Pressable
                onPress={goNext}
                style={expStyles.photoZoneRight}
                hitSlop={0}
              />
            </>
          ) : null}

          {/* Photo progress dots */}
          {allPhotos.length > 1 ? (
            <View style={[expStyles.photoDots, { top: topPad + 6 }]}>
              {allPhotos.map((_, i) => (
                <View
                  key={i}
                  style={[
                    expStyles.photoDot,
                    i === photoIdx && expStyles.photoDotActive,
                  ]}
                />
              ))}
            </View>
          ) : null}

          {/* Close button */}
          <View style={[expStyles.topBtnRow, { top: topPad + 4 }]}>
            <AnimatedTap onPress={onClose} style={expStyles.iconBtn} pressScale={0.92}>
              <Ionicons name="close" size={26} color="#FFF" />
            </AnimatedTap>
          </View>

          {/* Hero bottom info */}
          <View style={expStyles.heroBottom}>
            <View style={expStyles.heroTopRow}>
              <View style={{ flex: 1 }}>
                <View style={expStyles.heroNameRow}>
                  <Text style={expStyles.heroName} numberOfLines={1}>
                    {profile.name}, {profile.age}
                  </Text>
                  {profile.verified ? (
                    <View style={expStyles.verifiedMark}>
                      <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                    </View>
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
                  colors={profile.sourceIntent === "all" && profile.friendGoal ? tabs[0]!.accent : theme.accent}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
                />
                <View style={expStyles.intentBadgeIcon}>
                  <Ionicons name={getIntentIcon(profile.intent)} size={18} color="#FFF" />
                </View>
                <Text style={expStyles.intentBadgeText}>{getIntentDisplayLabel(profile.intent)}</Text>
                {getSubIntentionLabel(profile) ? (
                  <>
                    <Text style={expStyles.intentBadgeDivider}>·</Text>
                    <Text style={expStyles.intentBadgeSubText} numberOfLines={1}>
                      {getSubIntentionLabel(profile)}
                    </Text>
                  </>
                ) : null}
              </View>
              {profile.sourceIntent === "all" && profile.friendGoal ? (
                <View style={expStyles.intentBadge}>
                  <LinearGradient
                    colors={tabs[1]!.accent}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
                  />
                  <View style={expStyles.intentBadgeIcon}>
                    <Ionicons name="people" size={18} color="#FFF" />
                  </View>
                  <Text style={expStyles.intentBadgeText}>Friend</Text>
                  <Text style={expStyles.intentBadgeDivider}>·</Text>
                  <Text style={expStyles.intentBadgeSubText} numberOfLines={1}>
                    {profile.friendGoal}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* Body content */}
        <View style={expStyles.body}>

          {/* Additional photo thumbnails strip (photo 2 and 3) */}
          {allPhotos.length > 1 ? (
            <View style={expStyles.photoStrip}>
              {allPhotos.map((uri, i) => (
                <Pressable key={i} onPress={() => setPhotoIdx(i)} style={[expStyles.photoThumb, i === photoIdx && expStyles.photoThumbActive]}>
                  <ExpoImage source={{ uri }} style={expStyles.photoThumbImg} contentFit="cover" />
                  {i === photoIdx ? <View style={expStyles.photoThumbOverlay} /> : null}
                </Pressable>
              ))}
            </View>
          ) : null}

          <Text style={expStyles.bio}>{profile.bio}</Text>

          <View style={expStyles.divider} />

          {intent === "dating" ? (
            <DatingProfileUpgrade
              profile={profile}
              onShotIdea={(message) => onShot(message)}
            />
          ) : (
            <FriendProfileUpgrade profile={profile} onAction={handleAction} />
          )}

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

      {feedbackAction ? <ExpandedActionFeedback action={feedbackAction} intent={intent} anim={feedbackAnim} /> : null}
    </View>
  );
}

function getExpandedActionFeedback(action: ProfileAction, intent: IntentId) {
  if (action === "spark") return { icon: "sparkles" as IoniconName, title: "Spark sent", subtitle: "They will feel that pop.", colors: ["#EC4899", "#A855F7", "#F472B6"] as [string, string, string] };
  if (action === "best_friend") return { icon: "people-circle" as IoniconName, title: "Besties sent", subtitle: "Premium friend energy delivered.", colors: ["#60A5FA", "#8B5CF6", "#EC4899"] as [string, string, string] };
  if (action === "create_plan") return { icon: "calendar" as IoniconName, title: "Opening plan", subtitle: "Make the invite feel easy.", colors: ["#22C55E", "#06B6D4", "#60A5FA"] as [string, string, string] };
  if (action === "create_group") return { icon: "people" as IoniconName, title: "Opening group", subtitle: "Bring the crew in.", colors: ["#38BDF8", "#6366F1", "#EC4899"] as [string, string, string] };
  if (action === "pass") return { icon: "close" as IoniconName, title: "Skipped", subtitle: "Next vibe loaded.", colors: ["#F43F5E", "#FB7185", "#EC4899"] as [string, string, string] };
  return {
    icon: intent === "friends" ? "person-add" as IoniconName : "heart" as IoniconName,
    title: intent === "friends" ? "Like sent" : "Like sent",
    subtitle: intent === "friends" ? "They can accept in Connect." : "You moved the match closer.",
    colors: ["#EC4899", "#F97316", "#FACC15"] as [string, string, string],
  };
}

function ExpandedActionFeedback({ action, intent, anim }: { action: ProfileAction; intent: IntentId; anim: Animated.Value }) {
  const config = getExpandedActionFeedback(action, intent);
  const scale = anim.interpolate({ inputRange: [0, 0.72, 1], outputRange: [0.7, 1.08, 1] });
  const opacity = anim.interpolate({ inputRange: [0, 0.12, 0.82, 1], outputRange: [0, 1, 1, 0] });
  const ringScale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 2.7] });
  const ringOpacity = anim.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 0.45, 0] });

  return (
    <Animated.View pointerEvents="none" style={[expStyles.feedbackOverlay, { opacity }]}>
      <Animated.View style={[expStyles.feedbackRing, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]} />
      <Animated.View style={[expStyles.feedbackCard, { transform: [{ scale }] }]}>
        <LinearGradient colors={config.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={expStyles.feedbackIcon}>
          <Ionicons name={config.icon} size={34} color="#FFFFFF" />
        </View>
        <Text style={expStyles.feedbackTitle}>{config.title}</Text>
        <Text style={expStyles.feedbackSubtitle}>{config.subtitle}</Text>
      </Animated.View>
    </Animated.View>
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
  onShotIdea,
}: {
  profile: Profile;
  onShotIdea: (message: string) => void;
}) {
  const signals = getDatingSignals(profile);
  const ideas = getDatingDateIdeas(profile);
  const shotIdeas = getShotSuggestions(profile);
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
          <MiniStat icon="flame" label="Intent" value={getSubIntentionLabel(profile) ?? "Dating"} />
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

      <View style={datingStyles.planCard}>
        <View style={datingStyles.pollHeader}>
          <Text style={datingStyles.eyebrow}>Shoot your shot</Text>
          <Ionicons name="send" size={16} color="#F472B6" />
        </View>
        {shotIdeas.map((idea) => (
          <AnimatedTap key={idea} onPress={() => onShotIdea(idea)} style={datingStyles.planRow} pressScale={0.97}>
            <View style={datingStyles.planIcon}>
              <Ionicons name="chatbubble-ellipses" size={15} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={datingStyles.planTitle}>{idea}</Text>
              <Text style={datingStyles.planSub}>Send this as a Shot before matching.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#A1A1AA" />
          </AnimatedTap>
        ))}
      </View>
    </View>
  );
}

function FriendProfileUpgrade({
  profile,
  onAction,
}: {
  profile: Profile;
  onAction: (action: ProfileAction) => void;
}) {
  const signals = getDatingSignals(profile);
  const ideas = profile.dateIdeas?.length ? profile.dateIdeas : ["Coffee", "Walk", "Local event"];

  return (
    <View style={datingStyles.wrap}>
      <View style={[datingStyles.card, friendUpgradeStyles.card]}>
        <View style={datingStyles.cardHeader}>
          <View>
            <Text style={[datingStyles.eyebrow, friendUpgradeStyles.eyebrow]}>Friend card</Text>
            <Text style={datingStyles.title}>{profile.intentions ?? getSubIntentionLabel(profile) ?? "Easy friend energy"}</Text>
          </View>
        </View>

        <View style={datingStyles.statsRow}>
          <MiniStat icon="people" label="Purpose" value={getSubIntentionLabel(profile) ?? "Friends"} />
          <MiniStat icon="calendar-outline" label="First hang" value={ideas[0]!} />
        </View>

        <View style={datingStyles.signalRow}>
          {signals.map((signal) => (
            <View key={signal} style={[datingStyles.signalChip, friendUpgradeStyles.signalChip]}>
              <Ionicons name="checkmark-circle" size={12} color="#BFDBFE" />
              <Text style={datingStyles.signalText}>{signal}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={datingStyles.planCard}>
        <View style={datingStyles.pollHeader}>
          <Text style={[datingStyles.eyebrow, friendUpgradeStyles.eyebrow]}>Start the friendship</Text>
          <Ionicons name="people-circle" size={18} color="#93C5FD" />
        </View>
        {[
          { title: `Like ${profile.name}`, sub: "Send a friend like. You match when they accept.", icon: "person-add" as IoniconName, action: "vibe" as ProfileAction },
          { title: `Make a ${ideas[0] ?? "hang"} plan`, sub: "Opens the shared plan creator.", icon: "calendar" as IoniconName, action: "create_plan" as ProfileAction },
          { title: "Mark Besties", sub: "A premium friend badge that lands in Reactions.", icon: "people-circle" as IoniconName, action: "best_friend" as ProfileAction },
        ].map((item) => (
          <AnimatedTap key={item.title} onPress={() => onAction(item.action)} style={datingStyles.planRow} pressScale={0.97}>
            <View style={[datingStyles.planIcon, friendUpgradeStyles.planIcon]}>
              <Ionicons name={item.icon} size={15} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={datingStyles.planTitle}>{item.title}</Text>
              <Text style={datingStyles.planSub}>{item.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#A1A1AA" />
          </AnimatedTap>
        ))}
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
  action: ProfileAction;
  main?: boolean;
};

const datingBigActions: BigActionDef[] = [
  { label: "Pass", iconLib: "ion", iconName: "close", action: "pass" },
  { label: "Shot", iconLib: "ion", iconName: "send", action: "shot" },
  { label: "Like", iconLib: "ion", iconName: "heart", action: "vibe", main: true },
  { label: "Spark", iconLib: "ion", iconName: "sparkles", action: "spark" },
];
const friendsBigActions: BigActionDef[] = [
  { label: "Like", iconLib: "ion", iconName: "person-add", action: "vibe" },
  { label: "Plan", iconLib: "ion", iconName: "calendar", action: "create_plan" },
  { label: "Besties", iconLib: "ion", iconName: "people-circle", action: "best_friend", main: true },
  { label: "Pass", iconLib: "ion", iconName: "close", action: "pass" },
];
function BigActionsBar({
  intent,
  theme,
  onAction,
}: {
  intent: IntentId;
  theme: Theme;
  onAction: (action: ProfileAction) => void;
}) {
  const actions = intent === "dating" ? datingBigActions : friendsBigActions;

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
    <AnimatedTap onPress={onPress} style={expStyles.bigWrap} pressScale={def.main ? 0.94 : 0.92}>
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
    </AnimatedTap>
  );
}

const expStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#050505" },
  scroll: { flex: 1 },
  scrollContent: {},
  feedbackOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 60,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  feedbackRing: {
    position: "absolute",
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 2,
    borderColor: "rgba(236,72,153,0.82)",
  },
  feedbackCard: {
    width: 190,
    minHeight: 190,
    borderRadius: 34,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    shadowColor: "#EC4899",
    shadowOpacity: 0.55,
    shadowRadius: 32,
    elevation: 22,
  },
  feedbackIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  feedbackTitle: { marginTop: 14, color: "#FFFFFF", fontSize: 21, fontFamily: "Sora_800ExtraBold", textAlign: "center" },
  feedbackSubtitle: { marginTop: 4, color: "rgba(255,255,255,0.78)", fontSize: 12, fontFamily: "Inter_800ExtraBold", textAlign: "center", lineHeight: 17 },

  hero: { position: "relative", minHeight: 470, height: 560, overflow: "hidden" },
  heroImage: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },

  // Photo carousel tap zones
  photoZoneLeft: { position: "absolute", left: 0, top: 0, bottom: 0, width: "45%" },
  photoZoneRight: { position: "absolute", right: 0, top: 0, bottom: 0, width: "45%" },

  // Progress dots across the top
  photoDots: {
    position: "absolute", left: 16, right: 16,
    flexDirection: "row", gap: 4, justifyContent: "center",
  },
  photoDot: {
    flex: 1, height: 3, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.35)",
    maxWidth: 80,
  },
  photoDotActive: { backgroundColor: "#FFF" },

  // Thumbnail strip in body
  photoStrip: {
    flexDirection: "row", gap: 8, marginBottom: 16,
  },
  photoThumb: {
    flex: 1, height: 100, borderRadius: 14, overflow: "hidden",
    borderWidth: 2, borderColor: "transparent",
  },
  photoThumbActive: { borderColor: "#EC4899" },
  photoThumbImg: { width: "100%", height: "100%" },
  photoThumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(236,72,153,0.18)",
  },

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
  heroNameRow: { flexDirection: "row", alignItems: "center", gap: 8, maxWidth: "100%" },
  heroName: { color: "#FFF", fontSize: 40, fontWeight: "900", letterSpacing: -1, flexShrink: 1 },
  verifiedMark: {
    width: 23,
    height: 23,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EC4899",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.86)",
    shadowColor: "#EC4899",
    shadowOpacity: 0.34,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    flexShrink: 0,
  },
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
  intentBadge: {
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
  },
  intentBadgeIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  intentBadgeText: { color: "#FFF", fontSize: 13, fontWeight: "900" },
  intentBadgeDivider: { color: "rgba(255,255,255,0.78)", fontSize: 13, fontWeight: "900" },
  intentBadgeSubText: { color: "#FFF", flexShrink: 1, fontSize: 13, fontWeight: "800" },

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
  pollHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  planCard: { borderRadius: 22, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: "rgba(255,255,255,0.04)", padding: 14, gap: 10 },
  planRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  planIcon: { width: 34, height: 34, borderRadius: 13, backgroundColor: "rgba(236,72,153,0.85)", alignItems: "center", justifyContent: "center" },
  planTitle: { color: "#FFF", fontSize: 14, fontWeight: "900" },
  planSub: { marginTop: 2, color: "#A1A1AA", fontSize: 12, fontWeight: "600" },
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

const friendUpgradeStyles = StyleSheet.create({
  card: { borderColor: "rgba(96,165,250,0.28)", backgroundColor: "rgba(59,130,246,0.08)" },
  eyebrow: { color: "#BFDBFE" },
  signalChip: { borderColor: "rgba(96,165,250,0.22)" },
  planIcon: { backgroundColor: "rgba(59,130,246,0.88)" },
});

type SwipeAction = "pass" | "vibe" | "spark";
type ProfileAction = SwipeAction | "shot" | "create_plan" | "create_group" | "best_friend";

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
  onFriendInvite,
  onFriendPlan,
  onFriendBest,
  myVibeAnswers,
}: {
  profile: Profile;
  cardKey: string;
  theme: Theme;
  cardHeight: number;
  onOpenProfile: () => void;
  onAction: (action: SwipeAction) => boolean | void | Promise<boolean | void>;
  // Tap-reaction state owned by DiscoverScreen. Drives the card-level
  // scale/tilt/glow on tap and the spark-burst overlay.
  actionState: SwipeAction | null;
  onReaction: (action: SwipeAction) => void;
  onShot: () => void;
  onFriendInvite: () => void;
  onFriendPlan: () => void;
  onFriendBest: () => void;
  myVibeAnswers?: VibeCheckAnswers | null;
}) {
  // Gesture-driven spark burst still uses an incrementing token so rapid
  // upward swipes always retrigger a fresh explosion. Tap-driven sparks
  // come in via `actionState === "spark"` and render a separate burst.
  const [sparkToken, setSparkToken] = useState(0);
  const sparkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ── Shot onboarding coach mark (shows once per install for dating intent) ──
  const [shotTooltipVisible, setShotTooltipVisible] = useState(false);
  useEffect(() => {
    if (profile.intent !== "dating") return;
    AsyncStorage.getItem(SHOT_TOOLTIP_STORAGE_KEY).then((val) => {
      if (shouldShowShotTooltip(profile.intent, val === "1")) {
        setShotTooltipVisible(true);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const dismissShotTooltip = useCallback(() => {
    setShotTooltipVisible(false);
    void AsyncStorage.setItem(SHOT_TOOLTIP_STORAGE_KEY, "1");
  }, []);

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
    <View testID="discover-card-stack" style={[deckStyles.deckRoot, { height: cardHeight }]}>
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
        myVibeAnswers={myVibeAnswers}
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
        intent={profile.intent}
        onVibe={() => onReaction("vibe")}
        onShot={onShot}
        onSpark={() => onReaction("spark")}
        onPass={() => onReaction("pass")}
        onFriendInvite={onFriendInvite}
        onFriendPlan={onFriendPlan}
        onFriendBest={onFriendBest}
      />

      {/* ── Shot onboarding coach mark ──────────────────────────────────────
          Appears once on the first dating card seen. Tapping anywhere or
          the "Got it" button marks it as seen in AsyncStorage.           */}
      {shotTooltipVisible && (
        <Pressable
          style={deckStyles.shotTooltipBackdrop}
          onPress={dismissShotTooltip}
        >
          <View style={deckStyles.shotTooltipBubble}>
            <View style={deckStyles.shotTooltipArrow} />
            <Text style={deckStyles.shotTooltipText}>{SHOT_TOOLTIP_COPY}</Text>
            <Pressable
              testID="discover-shot-tooltip-dismiss"
              onPress={dismissShotTooltip}
              style={deckStyles.shotTooltipDismiss}
            >
              <Text style={deckStyles.shotTooltipDismissText}>Got it ✓</Text>
            </Pressable>
          </View>
        </Pressable>
      )}
    </View>
  );
}

// ─── Card actions rail (VIBE / SPARK / PASS tap buttons) ─────────────────────
function CardActionsRail({
  intent,
  onVibe,
  onShot,
  onSpark,
  onPass,
  onFriendInvite,
  onFriendPlan,
  onFriendBest,
}: {
  intent: IntentId;
  onVibe: () => void;
  onShot: () => void;
  onSpark: () => void;
  onPass: () => void;
  onFriendInvite: () => void;
  onFriendPlan: () => void;
  onFriendBest: () => void;
}) {
  const handlers: Record<DiscoverRailAction, () => void> = {
    vibe: intent === "friends" ? onFriendInvite : onVibe,
    shot: onShot,
    spark: onSpark,
    pass: onPass,
    create_plan: onFriendPlan,
    best_friend: onFriendBest,
  };

  return (
    <View style={railStyles.rail} pointerEvents="box-none">
      {getDiscoverRailActions(intent).map((item) => (
        <RailButton
          key={item.action}
          icon={item.icon as keyof typeof Ionicons.glyphMap}
          label={item.label}
          sub={item.sub}
          color={item.color}
          action={item.action}
          onPress={handlers[item.action]}
        />
      ))}
    </View>
  );
}

type RailColor = DiscoverRailColor;

const RAIL_POP_LABELS: Record<string, string> = {
  LIKE: "Liked",
  SHOT: "Shoot",
  SHOOT: "Shoot",
  SPARK: "Spark",
  PASS: "Pass",
  PLAN: "Plan",
  BESTIES: "Besties",
};

const RAIL_PALETTE: Record<
  RailColor,
  { bg: string; border: string; text: string; shadow: string }
> = {
  // hot pink — VIBE / LIKE
  pink: {
    bg: "rgba(255,40,160,0.38)",
    border: "rgba(255,100,195,0.96)",
    text: "#FFD6EC",
    shadow: "#FF2DA8",
  },
  // vivid violet — SHOT
  shot: {
    bg: "rgba(168,85,247,0.42)",
    border: "rgba(220,60,255,0.98)",
    text: "#F5D0FE",
    shadow: "#D946EF",
  },
  // electric purple — SPARK / SUPER
  purple: {
    bg: "rgba(139,92,246,0.40)",
    border: "rgba(192,132,252,0.96)",
    text: "#E9D5FF",
    shadow: "#8B5CF6",
  },
  // vivid red-rose — PASS
  rose: {
    bg: "rgba(244,63,94,0.36)",
    border: "rgba(251,70,100,0.96)",
    text: "#FFE4E6",
    shadow: "#F43F5E",
  },
  // electric blue — generic blue actions
  blue: {
    bg: "rgba(59,130,246,0.38)",
    border: "rgba(147,197,253,0.96)",
    text: "#DBEAFE",
    shadow: "#3B82F6",
  },
  // cyan — sky actions
  sky: {
    bg: "rgba(6,182,212,0.38)",
    border: "rgba(34,211,238,0.96)",
    text: "#CFFAFE",
    shadow: "#06B6D4",
  },
  // vivid amber — BESTIES / gold
  gold: {
    bg: "rgba(245,158,11,0.38)",
    border: "rgba(251,191,36,0.96)",
    text: "#FEF3C7",
    shadow: "#F59E0B",
  },
};

function RailButton({
  action,
  icon,
  label,
  sub,
  color,
  onPress,
}: {
  action: DiscoverRailAction;
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
  const pop = useRef(new Animated.Value(0)).current;
  // Resting press feedback uses the native driver so the squish is buttery.
  const pressScale = useRef(new Animated.Value(1)).current;
  const popText = RAIL_POP_LABELS[label] ?? getRailPopLabel(label);

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
    pop.stopAnimation();
    pop.setValue(0);
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
    Animated.sequence([
      Animated.timing(pop, {
        toValue: 0.45,
        duration: 130,
        useNativeDriver: true,
      }),
      Animated.timing(pop, {
        toValue: 1,
        duration: 360,
        useNativeDriver: true,
      }),
    ]).start();
    onPress();
  };

  // Map the pulse to a swelling outer halo + brighter shadow.
  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] });
  const shadowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] });
  const shadowRadius = pulse.interpolate({ inputRange: [0, 1], outputRange: [18, 38] });
  const popOpacity = pop.interpolate({ inputRange: [0, 0.12, 0.72, 1], outputRange: [0, 1, 1, 0] });
  const popScale = pop.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0.85, 1.06, 1] });
  const popTranslateY = pop.interpolate({ inputRange: [0, 1], outputRange: [6, -22] });

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      hitSlop={6}
      style={railStyles.button}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={`discover-action-${action}`}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          railStyles.popBubble,
          {
            backgroundColor: palette.bg,
            borderColor: palette.border,
            opacity: popOpacity,
            shadowColor: palette.shadow,
            transform: [{ translateY: popTranslateY }, { scale: popScale }],
          },
        ]}
      >
        <Ionicons name={icon} size={11} color={palette.text} />
        <Text style={[railStyles.popText, { color: palette.text }]}>{popText}</Text>
      </Animated.View>
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
  popBubble: {
    position: "absolute",
    right: 52,
    top: 4,
    zIndex: 4,
    minWidth: 58,
    maxWidth: 86,
    minHeight: 28,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    shadowOpacity: 0.55,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  popText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  circle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.88,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    elevation: 14,
  },
  // Inner glassy ring — slightly brighter than before for that premium backlit look.
  circleInner: {
    position: "absolute",
    top: 4, left: 4, right: 4, bottom: 4,
    borderRadius: 25,
    backgroundColor: "rgba(255,255,255,0.16)",
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
  myVibeAnswers,
}: {
  profile: Profile;
  theme: Theme;
  cardHeight: number;
  onOpenProfile: () => void;
  onAction: (action: SwipeAction) => boolean | void | Promise<boolean | void>;
  // When non-null, the card runs its premium tap-reaction (scale / tilt /
  // translate / glow swap) before the deck advances. Owned by DiscoverScreen.
  actionState: SwipeAction | null;
  myVibeAnswers?: VibeCheckAnswers | null;
}) {
  const activityStatus = getActivityStatus(profile);
  const cardSubIntention = getCardSubIntentionLabel(profile);
  const realCompatibilityScore =
    myVibeAnswers && profile.vibeCheck?.answers
      ? computeCompatibility(myVibeAnswers, profile.vibeCheck.answers)
      : null;
  const displayedMatchScore = realCompatibilityScore ?? profile.matchScore;
  const hasRealCompatibilityScore = realCompatibilityScore !== null;
  const isExiting = useRef(false);
  // Vibe pill sheet — "Why we match" breakdown
  const [showVibeSheet, setShowVibeSheet] = useState(false);
  // "Why we'd work" sheet — AI-derived compatibility copy
  const [showWhySheet, setShowWhySheet] = useState(false);
  const whyWeWorkCopy = useMemo(
    () => buildWhyWeWouldWorkCopy(profile, myVibeAnswers),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile.id],
  );
  // ── Photo carousel ─────────────────────────────────────────────────────────
  const photos = useMemo(() => {
    const all = [profile.image, ...(profile.photos ?? [])].filter(Boolean) as string[];
    return all.length > 0 ? all : [profile.image];
  }, [profile.image, profile.photos]);

  // ── Reanimated shared values — all gesture math runs on the UI thread ──
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const exitScaleSV = useSharedValue(1);

  // Ambient parallax breathing — 1.00 → 1.04 → 1.00 over 14s, UI thread
  const breatheSV = useSharedValue(1);
  useEffect(() => {
    breatheSV.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 7000 }),
        withTiming(1.0, { duration: 7000 }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(breatheSV);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset all values when this card instance is replaced
  useEffect(() => {
    tx.value = 0;
    ty.value = 0;
    exitScaleSV.value = 1;
    isExiting.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  // ── Tap-reaction animation (button rail, stays on JS thread — fine) ────
  const reaction = useRef(new Animated.Value(0)).current;
  const reactionTrack = useRef<SwipeAction | null>(null);
  const [reactionTrackState, setReactionTrackState] = useState<SwipeAction | null>(null);
  const isActionActive = useSharedValue(false);

  useEffect(() => {
    isActionActive.value = actionState !== null;
    if (actionState) {
      reactionTrack.current = actionState;
      setReactionTrackState(actionState);
      Animated.spring(reaction, { toValue: 1, stiffness: 260, damping: 20, mass: 1, useNativeDriver: true }).start();
    } else if (reactionTrack.current) {
      Animated.spring(reaction, { toValue: 0, stiffness: 260, damping: 20, mass: 1, useNativeDriver: true }).start(() => {
        reactionTrack.current = null;
        setReactionTrackState(null);
      });
    }
  }, [actionState, reaction, isActionActive]);

  const activeAction = actionState ?? reactionTrackState;
  const reactionScaleTarget = activeAction === "spark" ? 1.035 : activeAction === "vibe" ? 1.015 : activeAction === "pass" ? 0.985 : 1;
  const reactionRotateTarget = activeAction === "vibe" ? "3deg" : activeAction === "pass" ? "-3deg" : "0deg";
  const reactionTxTarget = activeAction === "vibe" ? 18 : activeAction === "pass" ? -18 : 0;
  const reactionScale = reaction.interpolate({ inputRange: [0, 1], outputRange: [1, reactionScaleTarget] });
  const reactionRotate = reaction.interpolate({ inputRange: [0, 1], outputRange: ["0deg", reactionRotateTarget] });
  const reactionTx = reaction.interpolate({ inputRange: [0, 1], outputRange: [0, reactionTxTarget] });

  const reactionShadow =
    activeAction === "spark" ? { shadowColor: "#A855F7", shadowOpacity: 0.75, shadowRadius: 45 }
    : activeAction === "vibe" ? { shadowColor: "#EC4899", shadowOpacity: 0.65, shadowRadius: 40 }
    : activeAction === "pass" ? { shadowColor: "#F43F5E", shadowOpacity: 0.55, shadowRadius: 35 }
    : null;

  // ── Reanimated animated styles (UI thread) ────────────────────────────
  // Outer: card pan + rotate + lift + exit scale
  const panAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${interpolate(tx.value, [-220, 0, 220], [-12, 0, 12], Extrapolation.CLAMP)}deg` },
      { scale: interpolate(ty.value, [-180, 0, 100], [1.04, 1, 1], Extrapolation.CLAMP) * exitScaleSV.value },
    ],
  }));

  // Portrait: pan-driven depth parallax + ambient breathing — all UI thread
  const portraitStyle = useAnimatedStyle(() => ({
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    transform: [
      { translateX: interpolate(tx.value, [-220, 0, 220], [14, 0, -14], Extrapolation.CLAMP) },
      { translateY: interpolate(ty.value, [-200, 0, 200], [10, 0, -10], Extrapolation.CLAMP) },
      { scale: breatheSV.value },
    ],
  }));

  // Swipe indicator overlays
  const passOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [-160, -60, 0], [1, 0.45, 0], Extrapolation.CLAMP),
  }));
  const vibeOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [0, 60, 160], [0, 0.45, 1], Extrapolation.CLAMP),
  }));
  const sparkOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ty.value, [-170, -70, 0], [1, 0.5, 0], Extrapolation.CLAMP),
  }));

  // ── Exit trigger — velocity-aware, called from gesture or button ──────
  const triggerExit = (action: SwipeAction) => {
    if (isExiting.current) return;
    isExiting.current = true;
    const exitTo = action === "pass" ? { x: -520, y: 40 } : action === "vibe" ? { x: 520, y: 40 } : { x: 0, y: -640 };
    const dur = action === "spark" ? 340 : 310;
    tx.value = withTiming(exitTo.x, { duration: dur }, () => runOnJS(onAction)(action));
    ty.value = withTiming(exitTo.y, { duration: dur });
    exitScaleSV.value = withSequence(
      withSpring(1.025, { damping: 18, stiffness: 240 }),
      withTiming(0.94, { duration: 210 }),
    );
  };

  // ── Gesture (UI thread) — replaces PanResponder ───────────────────────
  const panGesture = Gesture.Pan()
    .minDistance(12)
    .onUpdate((e) => {
      "worklet";
      if (isActionActive.value) return;
      tx.value = e.translationX;
      ty.value = e.translationY;
    })
    .onEnd((e) => {
      "worklet";
      if (isActionActive.value) return;
      const ax = Math.abs(e.translationX);
      const ay = Math.abs(e.translationY);
      const avx = Math.abs(e.velocityX);
      const avy = Math.abs(e.velocityY);

      // SPARK — vertically dominant upward throw
      if ((e.translationY < -120 || e.velocityY < -1.5) && (ay > ax || avy > avx)) {
        runOnJS(triggerExit)("spark");
      // VIBE — horizontally dominant right throw
      } else if ((e.translationX > 130 || e.velocityX > 1.5) && (ax > ay || avx > avy)) {
        runOnJS(triggerExit)("vibe");
      // PASS — horizontally dominant left throw
      } else if ((e.translationX < -130 || e.velocityX < -1.5) && (ax > ay || avx > avy)) {
        runOnJS(triggerExit)("pass");
      } else {
        // Not enough — spring back with personality wobble
        tx.value = withSequence(
          withSpring(e.translationX * 0.15, { damping: 8, stiffness: 200 }),
          withSpring(0, { damping: 14, stiffness: 160 }),
        );
        ty.value = withSpring(0, { damping: 14, stiffness: 160 });
      }
    });

  return (
    <GestureDetector gesture={panGesture}>
      {/* Outer layer: Reanimated — pan transforms run on UI thread */}
      <Reanimated.View
        style={[
          deckStyles.card,
          { height: cardHeight },
          reactionShadow,
          panAnimStyle,
        ]}
      >
        {/* Inner layer: Old Animated - tap-reaction tilt/scale (button taps only) */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              transform: [
                { translateX: reactionTx },
                { rotate: reactionRotate },
                { scale: reactionScale },
              ],
            },
          ]}
        >
          <View style={StyleSheet.absoluteFill}>
            <Reanimated.View style={portraitStyle}>
              <ExpoImage
                source={{ uri: photos[0] ?? profile.image }}
                style={deckStyles.cardImage}
                contentFit="cover"
                contentPosition={{ top: "25%", left: "50%" }}
                transition={120}
              />
            </Reanimated.View>

            <LinearGradient
              colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.40)", "rgba(0,0,0,1)"]}
              locations={[0, 0.55, 1]}
              style={StyleSheet.absoluteFill}
            />

            <LinearGradient
              colors={["rgba(244,114,182,0)", "rgba(244,114,182,0.95)", "rgba(244,114,182,0)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={deckStyles.cardTopEdge}
            />

            <Pressable style={deckStyles.cardOpenTapZone} onPress={onOpenProfile} hitSlop={0} />

            <View style={[deckStyles.onlinePill, { backgroundColor: "rgba(0,0,0,0.55)" }]}>
              <View style={[deckStyles.onlineDot, { backgroundColor: activityStatus.color }]} />
              <Text style={deckStyles.onlinePillText}>{activityStatus.label}</Text>
            </View>

            <Pressable
              onPress={() => {
                if (hasRealCompatibilityScore) setShowVibeSheet(true);
              }}
              hitSlop={8}
              style={deckStyles.matchBadge}
            >
              <Text style={deckStyles.matchBadgePct}>{displayedMatchScore}%</Text>
              <Text style={deckStyles.matchBadgeWord}>Match</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Swipe overlay circles - Reanimated opacity, UI thread */}
        <Reanimated.View pointerEvents="none" style={[deckStyles.overlayPass, passOverlayStyle]}>
          <Ionicons name="close" size={46} color="#FF4458" />
        </Reanimated.View>
        <Reanimated.View pointerEvents="none" style={[deckStyles.overlayVibe, vibeOverlayStyle]}>
          <Ionicons name="heart" size={42} color="#FF2DA8" />
        </Reanimated.View>
        <View pointerEvents="none" style={deckStyles.overlaySparkWrap}>
          <Reanimated.View style={[deckStyles.overlaySpark, sparkOverlayStyle]}>
            <Ionicons name="flash" size={46} color="#C084FC" />
          </Reanimated.View>
        </View>

        {/* Bottom info */}
        <View style={deckStyles.cardBottom}>
          <Pressable onPress={onOpenProfile} style={deckStyles.cardBottomInfo}>
            <View style={deckStyles.nameRow}>
              <Text style={deckStyles.nameText} numberOfLines={1}>
                {profile.name}, {profile.age}
              </Text>
              {profile.verified ? (
                <View style={deckStyles.verifiedMark}>
                  <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />
                </View>
              ) : null}
            </View>

            <Text style={deckStyles.locationText}>
              {profile.location} · {(((profile.id * 1.3) % 9) + 0.5).toFixed(1)} mi
            </Text>

            <View style={deckStyles.badgeRow}>
              <View style={[deckStyles.intentBadge, profile.intent === "friends" && deckStyles.friendIntentBadge]}>
                <Text style={deckStyles.intentBadgeText}>{getIntentDisplayLabel(profile.intent)}</Text>
              </View>
              {cardSubIntention ? (
                <View style={deckStyles.subIntentBadge}>
                  <Text style={deckStyles.subIntentBadgeText} numberOfLines={1}>{cardSubIntention}</Text>
                </View>
              ) : null}
            </View>

            <Text style={deckStyles.tapHintText}>TAP TO VIEW FULL PROFILE</Text>
          </Pressable>
        </View>

        {/* ─── "Why we match" sheet ─────────────────────────────────────────
            Tapping the vibe pill opens this modal with a full-dimension
            breakdown so users understand what the % actually means.         */}
        <Modal
          visible={showVibeSheet}
          transparent
          animationType="slide"
          statusBarTranslucent
          onRequestClose={() => setShowVibeSheet(false)}
        >
          <Pressable style={deckStyles.vibeSheetBackdrop} onPress={() => setShowVibeSheet(false)}>
            <Pressable style={deckStyles.vibeSheetCard} onPress={() => {/* absorb taps */}}>
              <View style={deckStyles.vibeSheetHandle} />
              <Text style={deckStyles.vibeSheetTitle}>
                Why you and {profile.name.split(" ")[0]} match
              </Text>
              <Text style={deckStyles.vibeSheetScore}>{displayedMatchScore}% Vibe</Text>
              {myVibeAnswers && profile.vibeCheck?.answers ? (
                <VibeBreakdownCompact
                  mine={myVibeAnswers}
                  theirs={profile.vibeCheck.answers}
                  overall={realCompatibilityScore ?? displayedMatchScore}
                />
              ) : null}
              <Text style={deckStyles.vibeSheetHint}>
                Based on love language, energy type, conflict style, date pace, and adventure level.
              </Text>
              <Pressable
                onPress={() => setShowVibeSheet(false)}
                style={deckStyles.vibeSheetDismiss}
              >
                <Text style={deckStyles.vibeSheetDismissText}>Got it</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        {/* ─── "Why we'd work" sheet ───────────────────────────────────────
            Deterministic compatibility copy derived from profile + VibeCheck
            data. No AI call at runtime — pure template logic, instant.     */}
        <Modal
          visible={showWhySheet}
          transparent
          animationType="slide"
          statusBarTranslucent
          onRequestClose={() => setShowWhySheet(false)}
        >
          <Pressable style={deckStyles.vibeSheetBackdrop} onPress={() => setShowWhySheet(false)}>
            <Pressable style={deckStyles.vibeSheetCard} onPress={() => {/* absorb */}}>
              <View style={deckStyles.vibeSheetHandle} />
              <Text style={deckStyles.vibeSheetTitle}>
                Why you and {profile.name.split(" ")[0]} would work
              </Text>
              <Text style={deckStyles.whyWorkCopyText}>{whyWeWorkCopy}</Text>
              <Pressable
                onPress={() => setShowWhySheet(false)}
                style={deckStyles.vibeSheetDismiss}
              >
                <Text style={deckStyles.vibeSheetDismissText}>Got it</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </Reanimated.View>
    </GestureDetector>
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
  cardTopEdge: {
    position: "absolute",
    top: 0, left: 0, right: 0, height: 2,
  },
  onlinePill: {
    position: "absolute",
    top: 16,
    left: 16,
    zIndex: 5,
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
    zIndex: 5,
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

  // ── "Why we match" bottom sheet ──────────────────────────────────────────
  vibeSheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  vibeSheetCard: {
    backgroundColor: "#0F0A1A",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  vibeSheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "center",
    marginBottom: 20,
  },
  vibeSheetTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  vibeSheetScore: {
    color: "#EC4899",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 20,
  },
  vibeSheetHint: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    marginTop: 12,
    marginBottom: 20,
    lineHeight: 18,
  },
  vibeSheetDismiss: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  vibeSheetDismissText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },

  // ── Circular glow swipe badges — matches RailButton visual language ────────
  overlayPass: {
    position: "absolute",
    top: 88,
    left: 20,
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1.5,
    borderColor: "rgba(255,68,88,0.55)",
    backgroundColor: "rgba(0,0,0,0.62)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FF4458",
    shadowOpacity: 0.9,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 0 },
    elevation: 20,
  },

  overlayVibe: {
    position: "absolute",
    top: 88,
    right: 20,
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1.5,
    borderColor: "rgba(255,45,168,0.55)",
    backgroundColor: "rgba(0,0,0,0.62)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FF2DA8",
    shadowOpacity: 0.9,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 0 },
    elevation: 20,
  },

  overlaySparkWrap: {
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  overlaySpark: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: "rgba(192,132,252,0.6)",
    backgroundColor: "rgba(0,0,0,0.62)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#A855F7",
    shadowOpacity: 1,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 0 },
    elevation: 24,
  },

  cardBottom: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 22 },
  cardBottomInfo: { marginBottom: 0 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, maxWidth: "100%" },
  nameText: {
    color: "#FFF",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -0.6,
    lineHeight: 36,
    flexShrink: 1,
  },
  verifiedMark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EC4899",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.86)",
    shadowColor: "#EC4899",
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    flexShrink: 0,
  },
  locationText: {
    marginTop: 4,
    color: "#D4D4D8",
    fontSize: 13,
    fontWeight: "600",
  },
  badgeRow: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  intentBadge: {
    maxWidth: "48%",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#EC4899",
    shadowColor: "#EC4899",
    shadowOpacity: 0.32,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  friendIntentBadge: {
    backgroundColor: "#3B82F6",
    shadowColor: "#3B82F6",
  },
  intentBadgeText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "900",
  },
  subIntentBadge: {
    maxWidth: "52%",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    backgroundColor: "rgba(0,0,0,0.32)",
  },
  subIntentBadgeText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "800",
  },
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
  tapHintText: {
    marginTop: 10,
    color: "#A1A1AA",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    textAlign: "center",
  },
  cardOpenTapZone: {
    ...StyleSheet.absoluteFillObject,
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

  // ── Shot onboarding coach mark ─────────────────────────────────────────────
  shotTooltipBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    justifyContent: "center",
    alignItems: "flex-end",
    paddingRight: 100,
  },
  shotTooltipBubble: {
    maxWidth: 220,
    backgroundColor: "#1C1C2E",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(236,72,153,0.4)",
    padding: 16,
    shadowColor: "#EC4899",
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
  },
  shotTooltipArrow: {
    position: "absolute",
    right: -8,
    top: "50%",
    marginTop: -8,
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderLeftWidth: 8,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: "#1C1C2E",
  },
  shotTooltipText: {
    color: "#F4F4F5",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "500",
  },
  shotTooltipDismiss: {
    marginTop: 12,
    alignSelf: "flex-end",
    backgroundColor: "rgba(236,72,153,0.18)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  shotTooltipDismissText: {
    color: "#EC4899",
    fontSize: 13,
    fontWeight: "700",
  },

  // ── "Why we'd work" button + copy ─────────────────────────────────────────
  whyWorkBtn: {
    marginTop: 10,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(236,72,153,0.35)",
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  whyWorkBtnText: {
    color: "#FBCFE8",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  whyWorkCopyText: {
    color: "#E4E4E7",
    fontSize: 15,
    lineHeight: 24,
    fontWeight: "500",
    marginBottom: 8,
    marginTop: 4,
  },
});
