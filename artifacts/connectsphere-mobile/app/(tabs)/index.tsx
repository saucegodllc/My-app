import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
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
  friends: ["For You", "Events", "New to Miami"],
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
export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const topInset = Platform.OS === "web" ? 16 : Math.max(insets.top, 12);
  const bottomInset = Platform.OS === "web" ? 96 : 82 + insets.bottom;
  // Measured cardArea height (set by onLayout). Falls back to a windowH-based
  // estimate so the very first frame still renders correctly.
  const [measuredCardH, setMeasuredCardH] = useState(0);
  const cardHeight =
    measuredCardH > 0 ? measuredCardH : Math.max(420, winH - 320);

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

  // Advance the deck. Called by SwipeDeck after a gesture-driven exit, and by
  // ExpandedProfile when the user uses the bottom action bar.
  const advanceDeck = () => setCardIndex((prev) => prev + 1);

  return (
    <View style={[styles.root, { paddingBottom: bottomInset }]}>
      {/* Background glow blobs */}
      <View style={styles.blob1} />
      <View style={styles.blob2} />
      <View style={styles.blob3} />

      {/* Single-screen flex column — no scrolling. Mirrors the web spec
          `<main className="flex h-full flex-col px-4 pt-[safe-top+18] pb-[safe-bottom+86]">`.
          The card section is `flex: 1` and fills whatever space remains
          between the header/tabs above and the fixed glass tab bar below. */}
      <View
        style={[
          styles.main,
          { paddingTop: topInset + 18, paddingBottom: bottomInset + 16 },
        ]}
      >
        {/* Header — compact, no pill. Just the thin neon top line, the
            Discover · Miami title row, and the spaced uppercase subtitle. */}
        <View style={styles.header}>
          <View style={styles.headerTopLineWrap}>
            <LinearGradient
              colors={[
                "rgba(244,114,182,0)",
                "rgba(244,114,182,1)",
                "rgba(244,114,182,0)",
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.headerTopLine}
            />
          </View>

          <View style={styles.titleRow}>
            <Text style={styles.title}>Discover</Text>
            <MiamiNeon />
          </View>

          <Text style={styles.subtitleSmall}>DISCOVER YOUR CITY</Text>
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

        {/* Card area — flex:1 so it fills the rest of the viewport. Height
            is captured via onLayout and forwarded to SwipeDeck so the inner
            cards/shadows stay pixel-perfect at any device size. */}
        <View
          style={styles.cardArea}
          onLayout={(e) => {
            const h = Math.round(e.nativeEvent.layout.height);
            if (h > 0 && h !== measuredCardH) setMeasuredCardH(h);
          }}
        >
          {/* Stack ghosts behind the active card for depth (mirrors web
              `inset-x-3 bottom-[-14px]` and `inset-x-6 bottom-[-26px]`). */}
          <View pointerEvents="none" style={[styles.ghostCard, styles.ghostCard1]} />
          <View pointerEvents="none" style={[styles.ghostCard, styles.ghostCard2]} />

          {profile ? (
            <SwipeDeck
              key={`deck-${activeIntent}-${activeSubTab}`}
              profile={profile}
              cardKey={`${profile.id}-${cardIndex}`}
              theme={theme}
              cardHeight={cardHeight}
              onOpenProfile={() => setSelectedProfile(profile)}
              onAction={advanceDeck}
            />
          ) : (
            <EmptyState theme={theme} />
          )}
        </View>
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
            onAction={() => {
              setSelectedProfile(null);
              advanceDeck();
            }}
          />
        ) : null}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#050007" },

  // Background blobs — subtle pink/purple haze
  // Premium ambient glow blobs — match the web spec exactly so the screen
  // gets the same soft Miami-nightlife wash behind every layer. RN can't
  // blur a backgroundColor, so we lean on big radii + low alpha + the
  // overall dark backdrop to fake a 130–150px CSS blur.
  blob1: {
    position: "absolute", top: -144, left: "50%",
    marginLeft: -160,
    width: 320, height: 320, borderRadius: 160,
    backgroundColor: "rgba(236,72,153,0.18)",
  },
  blob2: {
    position: "absolute", top: "33%", right: -160,
    width: 384, height: 384, borderRadius: 192,
    backgroundColor: "rgba(217,70,239,0.12)",
  },
  blob3: {
    position: "absolute", bottom: 96, left: -160,
    width: 384, height: 384, borderRadius: 192,
    backgroundColor: "rgba(236,72,153,0.10)",
  },

  // Top-level main column. Replaces the old ScrollView so the screen fits
  // exactly one viewport (h-screen overflow-hidden in the web spec).
  main: { flex: 1, paddingHorizontal: 16 },

  // Header — compact, centered. Top neon line + title row + tracked subtitle.
  header: {
    alignItems: "center",
    paddingBottom: 12,
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
    width: "100%",
    height: 2,
    borderRadius: 1,
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
    position: "absolute", right: 0, top: 8,
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1, borderColor: "rgba(244,114,182,0.25)",
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#EC4899", shadowOpacity: 0.5, shadowRadius: 25, shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },

  // Intent tabs — slim glossy black glass with pink border (~50px). Tightened
  // top margin (mt-3) and reduced inner py-2 per latest spec.
  intentRow: {
    marginTop: 12, flexDirection: "row", alignItems: "center",
    height: 50,
    borderRadius: 999, borderWidth: 1, borderColor: "rgba(236,72,153,0.22)",
    backgroundColor: "rgba(0,0,0,0.55)",
    padding: 5,
    shadowColor: "#EC4899", shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 0 },
  },
  intentSlot: { flex: 1, flexDirection: "row", alignItems: "center" },
  intentBtn: { flex: 1, borderRadius: 999, overflow: "hidden", height: "100%", justifyContent: "center" },
  intentBtnActiveBg: {
    borderRadius: 999,
    shadowColor: "#EC4899", shadowOpacity: 0.95, shadowRadius: 24, shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  intentBtnInner: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 8, paddingHorizontal: 8,
  },
  intentBtnLabel: { fontSize: 13, fontWeight: "800" },
  intentSep: { width: 1, height: 22, backgroundColor: "rgba(255,255,255,0.12)" },

  // Sub tabs — tightened to fit single-screen layout
  subTabsScroll: { marginTop: 12, flexGrow: 0 },
  subTabsContent: { gap: 12, paddingRight: 4, paddingBottom: 4 },
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

  // Notice — clean black glass pill with pink border
  notice: {
    marginTop: 18, borderRadius: 999,
    borderWidth: 1, borderColor: "rgba(236,72,153,0.4)",
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 18, paddingVertical: 13,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    shadowColor: "#EC4899", shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 0 },
  },
  noticeLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  noticeText: { color: "#FCE7F3", fontSize: 12, fontWeight: "700" },

  // Card area + deck. flex:1 so it fills the rest of the viewport in the
  // no-scroll layout. Web spec: `mt-3 flex-1 pl-1 pr-[86px]` with the card
  // sitting at left-0 and width=section-88, so the inner deck spans the
  // section minus an 88px right gutter for the larger 66×66 rail.
  // Web spec: `mt-3 flex-1 pl-0 pr-[92px]`. The 92px right gutter holds the
  // larger 68×68 action rail with breathing room.
  cardArea: {
    flex: 1,
    minHeight: 0,
    marginTop: 12,
    paddingLeft: 0,
    paddingRight: 92,
    position: "relative",
    alignItems: "stretch",
    justifyContent: "flex-start",
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
    bottom: -28,
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

// ─── SwipeDeck (3-direction gesture system) ───────────────────────────────────
type SwipeAction = "pass" | "vibe" | "spark";

function SwipeDeck({
  profile,
  cardKey,
  theme,
  cardHeight,
  onOpenProfile,
  onAction,
}: {
  profile: Profile;
  cardKey: string;
  theme: Theme;
  cardHeight: number;
  onOpenProfile: () => void;
  onAction: () => void;
}) {
  // Drive the burst with an incrementing token so rapid sparks always retrigger
  // a fresh explosion (boolean state would no-op while still true).
  const [sparkToken, setSparkToken] = useState(0);
  const sparkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (sparkTimeoutRef.current) clearTimeout(sparkTimeoutRef.current);
    };
  }, []);

  const handleAction = (action: SwipeAction) => {
    if (action === "spark") {
      setSparkToken((n) => n + 1);
      if (sparkTimeoutRef.current) clearTimeout(sparkTimeoutRef.current);
      sparkTimeoutRef.current = setTimeout(() => {
        setSparkToken((n) => -Math.abs(n)); // flip sign to "off"
        sparkTimeoutRef.current = null;
      }, 650);
    }
    onAction();
  };

  const sparkBurst = sparkToken > 0;

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
        onAction={handleAction}
      />

      {sparkBurst ? <SparkExplosion key={sparkToken} /> : null}

      {/* Side rail of tap-to-act buttons (VIBE / SPARK / PASS).
          Lives in the 92px gutter created by `cardArea.paddingRight`. */}
      <CardActionsRail
        onVibe={() => handleAction("vibe")}
        onSpark={() => handleAction("spark")}
        onPass={() => handleAction("pass")}
      />
    </View>
  );
}

// ─── Card actions rail (VIBE / SPARK / PASS tap buttons) ─────────────────────
function CardActionsRail({
  onVibe,
  onSpark,
  onPass,
}: {
  onVibe: () => void;
  onSpark: () => void;
  onPass: () => void;
}) {
  return (
    <View style={railStyles.rail} pointerEvents="box-none">
      <RailButton
        icon="heart"
        label="VIBE"
        sub="Energy"
        color="pink"
        onPress={onVibe}
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

type RailColor = "pink" | "purple" | "rose";

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
          <Ionicons name={icon} size={32} color={palette.text} />
        </Animated.View>
      </Animated.View>
      <Text style={railStyles.label}>{label}</Text>
      <Text style={railStyles.sub}>{sub}</Text>
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
    gap: 24,
  },
  button: {
    alignItems: "center",
  },
  circle: {
    width: 68,
    height: 68,
    borderRadius: 34,
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
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  // Reactive outer halo — sits behind the circle and blooms on tap.
  halo: {
    position: "absolute",
    top: 0, left: 0,
    width: 68, height: 68, borderRadius: 34,
    borderWidth: 1,
  },
  label: {
    marginTop: 10,
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

function SwipeCard({
  profile,
  theme,
  cardHeight,
  onOpenProfile,
  onAction,
}: {
  profile: Profile;
  theme: Theme;
  cardHeight: number;
  onOpenProfile: () => void;
  onAction: (action: SwipeAction) => void;
}) {
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const isExiting = useRef(false);

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
        // hijack the press.
        onMoveShouldSetPanResponder: (_, g) => {
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
        {
          transform: [
            { translateX: pan.x },
            { translateY: pan.y },
            { rotate },
            { scale: liftScale },
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

        {/* Cinematic dark gradient — web spec: from-black via-black/45 to-transparent.
            Strong base for legible text, soft middle, fully clear at the top. */}
        <LinearGradient
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.45)", "rgba(0,0,0,1)"]}
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
          <Ionicons name="flash" size={56} color="#6EE7B7" />
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
                size={18}
                color="#EC4899"
              />
            ) : null}
          </View>

          <View style={deckStyles.locationRow}>
            <Ionicons name="location-outline" size={14} color="#E4E4E7" />
            <Text style={deckStyles.locationText}>{profile.location}</Text>
            <View style={deckStyles.locationGreenDot} />
            <Text style={deckStyles.locationText}>
              {(((profile.id * 1.3) % 9) + 0.5).toFixed(1)} miles away
            </Text>
          </View>

          <View style={deckStyles.badgeRow}>
            <View style={deckStyles.intentBadge}>
              <LinearGradient
                colors={theme.accent}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
              />
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
        <Ionicons name="sparkles" size={48} color="#6EE7B7" />
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

  // Active card — pink-400/45 border, big premium pink outer glow.
  // Web spec: `rounded-[36px] border border-pink-400/45 shadow-[0_0_75px_rgba(236,72,153,0.38)]`.
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
    shadowOpacity: 0.38,
    shadowRadius: 38,
    shadowOffset: { width: 0, height: 0 },
    elevation: 26,
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
    borderColor: "rgba(110,231,183,0.4)",
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#34D399",
    shadowOpacity: 0.85,
    shadowRadius: 36,
  },

  // Bottom info — tightened so more of the portrait stays visible above.
  cardBottom: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 16 },
  cardBottomInfo: { marginBottom: 6 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  nameText: {
    color: "#FFF",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  locationRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  locationText: { color: "#E4E4E7", fontSize: 11, fontWeight: "600" },
  locationGreenDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#34D399",
    marginLeft: 4,
  },
  badgeRow: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  intentBadge: {
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  intentBadgeText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  subBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  subBadgeText: { color: "#FFF", fontSize: 10, fontWeight: "700" },
  tapHintText: {
    marginTop: 8,
    color: "#A1A1AA",
    fontSize: 11,
    fontWeight: "600",
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
    backgroundColor: "#6EE7B7",
    shadowColor: "#34D399",
    shadowOpacity: 1,
    shadowRadius: 12,
  },
  sparkBurstCenter: {
    position: "absolute",
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 1,
    borderColor: "rgba(110,231,183,0.7)",
    backgroundColor: "rgba(52,211,153,0.10)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#34D399",
    shadowOpacity: 0.8,
    shadowRadius: 35,
  },
});
