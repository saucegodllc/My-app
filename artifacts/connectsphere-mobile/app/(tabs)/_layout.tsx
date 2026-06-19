/**
 * Tab layout — glass morphism tab bar.
 *
 * Upgrades from v1:
 *   ✓ Live unread badge on Connect tab (from useUnreadCount)
 *   ✓ BlurView intensity bumped from 60 → 80 (richer frosted glass)
 *   ✓ Active dot replaced with animated pulse ring on new-message activity
 *   ✓ Badge capped at 99+
 */
import { useAuth, useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect, Tabs, router } from "expo-router";
import { ComponentProps, useEffect, useRef } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useUnreadCount } from "@/hooks/useUnreadCount";
import { e2eSmokeEnabled } from "@/hooks/useSessionState";
import { BRAND, NEUTRAL, RADIUS, SPACE, TYPE } from "@/constants/tokens";

type BottomTabBarProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>["tabBar"]>
>[0];
type TabRoute = BottomTabBarProps["state"]["routes"][number];

type IconPair = {
  active: keyof typeof Ionicons.glyphMap;
  inactive: keyof typeof Ionicons.glyphMap;
};

const ICONS: Record<string, IconPair> = {
  index:        { active: "compass",          inactive: "compass-outline" },
  matches:      { active: "people",           inactive: "people-outline" },
  events:       { active: "calendar",         inactive: "calendar-outline" },
  communities:  { active: "planet",           inactive: "planet-outline" },
  moments:      { active: "sparkles",         inactive: "sparkles-outline" },
};

const LABELS: Record<string, string> = {
  index:        "Discover",
  matches:      "Connect",
  events:       "Events",
  communities:  "Spaces",
  moments:      "Moments",
};

// Profile is no longer a tab — it lives as a floating avatar button in the tab bar.
const TAB_ORDER = ["index", "matches", "events", "communities", "moments"];

// ── Unread badge ──────────────────────────────────────────────────────────────
function UnreadBadge({ count }: { count: number }) {
  if (count === 0) return null;
  const label = count > 99 ? "99+" : String(count);
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

// ── Pulse ring (shows on new unread activity) ─────────────────────────────────
function PulseRing({ active, hasActivity }: { active: boolean; hasActivity: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (active && hasActivity) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.35, duration: 600, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulse.setValue(1);
    }
    return () => { pulseLoop.current?.stop(); };
  }, [active, hasActivity]);

  if (!active) return null;

  return (
    <Animated.View
      style={[
        styles.pulseRing,
        { transform: [{ scale: pulse }] },
      ]}
    />
  );
}

// ── Floating profile avatar button ────────────────────────────────────────────
function ProfileAvatar() {
  const { user } = useUser();
  const photo = user?.imageUrl;
  return (
    <Pressable
      onPress={() => router.push("/(tabs)/profile" as never)}
      style={({ pressed }) => [styles.profileAvatar, { opacity: pressed ? 0.75 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel="My Profile"
      hitSlop={6}
    >
      {photo ? (
        <Image source={{ uri: photo }} style={styles.profileAvatarImg} contentFit="cover" />
      ) : (
        <Ionicons name="person" size={16} color="#fff" />
      )}
      {/* Pink ring */}
      <View style={styles.profileAvatarRing} />
    </Pressable>
  );
}

// ── Glass tab bar ─────────────────────────────────────────────────────────────
function GlassTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const unreadCount = useUnreadCount();

  const visibleRoutes = TAB_ORDER
    .map((name) => state.routes.find((r: TabRoute) => r.name === name))
    .filter((r): r is TabRoute => Boolean(r) && Boolean(ICONS[r!.name]));

  const activeRouteName = state.routes[state.index]?.name;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: insets.bottom + 12 }]}
    >
      <View style={styles.bar}>
        {Platform.OS === "ios" ? (
          <BlurView
            intensity={80}
            tint="dark"
            style={[StyleSheet.absoluteFill, styles.barBackdrop]}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.barBackdropAndroid]} />
        )}

        <LinearGradient
          colors={["transparent", "rgba(236,72,153,0.7)", "transparent"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.bottomLine}
        />

        {/* Floating profile avatar — top-right corner of the tab bar */}
        <ProfileAvatar />

        <View style={styles.grid}>
          {visibleRoutes.map((route) => {
            const focused = activeRouteName === route.name;
            const icon = ICONS[route.name];
            const label = LABELS[route.name] ?? route.name;
            const isConnect = route.name === "matches";
            const hasUnread = isConnect && unreadCount > 0;

            const onPress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name as never);
              }
            };

            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                accessibilityLabel={label}
                style={({ pressed }) => [
                  styles.item,
                  pressed && styles.itemPressed,
                ]}
              >
                <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                  <PulseRing active={focused} hasActivity={hasUnread} />
                  <Ionicons
                    name={focused ? icon.active : icon.inactive}
                    size={18}
                    color={focused ? BRAND.pink : NEUTRAL.textMuted}
                  />
                  {/* Unread badge */}
                  {isConnect && !focused && (
                    <UnreadBadge count={unreadCount} />
                  )}
                </View>
                <Text
                  style={[styles.label, focused && styles.labelActive]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
                {focused && <View style={styles.underline} />}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ── Tab layout root ───────────────────────────────────────────────────────────
export default function TabLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user, isLoaded: isUserLoaded } = useUser();

  if (e2eSmokeEnabled) {
    return <AuthenticatedTabs />;
  }

  if (isLoaded && !isSignedIn) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (
    isSignedIn &&
    isUserLoaded &&
    user?.unsafeMetadata?.onboardingComplete !== true
  ) {
    return <Redirect href="/onboarding" />;
  }

  return <AuthenticatedTabs />;
}

function AuthenticatedTabs() {
  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        animation: "fade",
      }}
    >
      <Tabs.Screen name="index"        options={{ title: "Discover" }} />
      <Tabs.Screen name="matches"      options={{ title: "Connect" }} />
      <Tabs.Screen name="events"       options={{ title: "Events" }} />
      <Tabs.Screen name="communities"  options={{ title: "Spaces" }} />
      {/* Moments: 5th tab — ephemeral story-style posts */}
      <Tabs.Screen name="moments"      options={{ title: "Moments" }} />
      {/* Profile: no longer a tab — accessed via avatar button in tab bar */}
      <Tabs.Screen name="profile"      options={{ title: "Profile", href: null }} />
    </Tabs>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: SPACE.lg,
    alignItems: "center",
  },
  bar: {
    width: "100%",
    maxWidth: 430,
    borderRadius: RADIUS["3xl"],
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.md,
    shadowColor: "#EC4899",
    shadowOpacity: 0.22,
    shadowRadius: 35,
    shadowOffset: { width: 0, height: 0 },
    overflow: "hidden",
  },
  barBackdrop: {
    borderRadius: RADIUS["3xl"],
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  barBackdropAndroid: {
    borderRadius: RADIUS["3xl"],
    backgroundColor: "rgba(0,0,0,0.82)",
  },
  bottomLine: {
    position: "absolute",
    left: 32,
    right: 32,
    bottom: 0,
    height: 1,
  },
  grid: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  item: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    position: "relative",
    paddingBottom: 4,
  },
  itemPressed: {
    transform: [{ scale: 0.93 }],
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    position: "relative",
  },
  iconWrapActive: {
    backgroundColor: "rgba(236,72,153,0.20)",
    shadowColor: BRAND.pink,
    shadowOpacity: 0.45,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
  },
  pulseRing: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: BRAND.pink,
    opacity: 0.6,
  },
  badge: {
    position: "absolute",
    top: -3,
    right: -5,
    minWidth: 17,
    height: 17,
    borderRadius: RADIUS.pill,
    backgroundColor: BRAND.pink,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: "#000",
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    lineHeight: 11,
  },
  label: {
    ...TYPE.micro,
    color: NEUTRAL.text,
  },
  labelActive: {
    color: BRAND.pink,
  },
  underline: {
    position: "absolute",
    bottom: -4,
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: BRAND.pink,
    shadowColor: BRAND.pink,
    shadowOpacity: 0.9,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  // Profile avatar — floating in top-right corner of the tab bar
  profileAvatar: {
    position: "absolute",
    top: -14,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    zIndex: 20,
  },
  profileAvatarImg: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  profileAvatarRing: {
    position: "absolute",
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: BRAND.pink,
  },
});
