import { useAuth, useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect, Tabs } from "expo-router";
import { ComponentProps } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// `@react-navigation/bottom-tabs` is an internal expo-router dep — no direct
// export — so derive the tabBar render-prop signature from `<Tabs>` itself.
type BottomTabBarProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>["tabBar"]>
>[0];
type TabRoute = BottomTabBarProps["state"]["routes"][number];

type IconPair = {
  active: keyof typeof Ionicons.glyphMap;
  inactive: keyof typeof Ionicons.glyphMap;
};

// Lucide-equivalent glyph mapping requested by the user. `lucide-react-native`
// isn't installed, so we use the closest Ionicons visual matches:
//   Compass → compass, Users → people, Calendar → calendar,
//   MapPin → location, User → person.
const ICONS: Record<string, IconPair> = {
  index: { active: "compass", inactive: "compass-outline" },
  matches: { active: "people", inactive: "people-outline" },
  events: { active: "calendar", inactive: "calendar-outline" },
  map: { active: "location", inactive: "location-outline" },
  profile: { active: "person", inactive: "person-outline" },
};

const LABELS: Record<string, string> = {
  index: "Discover",
  matches: "Connect",
  events: "Events",
  map: "Map",
  profile: "Profile",
};

const TAB_ORDER = ["index", "matches", "events", "map", "profile"];

function GlassTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

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
            intensity={60}
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

        <View style={styles.grid}>
          {visibleRoutes.map((route) => {
            const focused = activeRouteName === route.name;
            const icon = ICONS[route.name];
            const label = LABELS[route.name] ?? route.name;

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
                  <Ionicons
                    name={focused ? icon.active : icon.inactive}
                    size={18}
                    color={focused ? "#F472B6" : "#A1A1AA"}
                  />
                  {focused && <View style={styles.dot} />}
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

export default function TabLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user, isLoaded: isUserLoaded } = useUser();

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

  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        animation: "fade",
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Discover" }} />
      <Tabs.Screen name="matches" options={{ title: "Connect" }} />
      <Tabs.Screen name="events" options={{ title: "Events" }} />
      <Tabs.Screen name="map" options={{ title: "Map" }} />
      <Tabs.Screen name="network" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // Web spec: `fixed bottom-0 left-1/2 w-full max-w-[430px] -translate-x-1/2
  // px-4 pb-[calc(env(safe-area-inset-bottom)+12px)]`. Implemented as an
  // absolute-positioned wrapper that centers via `alignItems: "center"`.
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  // Web spec: `relative rounded-[32px] border border-white/10 bg-black/65
  // px-3 py-3 shadow-[0_0_35px_rgba(236,72,153,0.22)] backdrop-blur-2xl`.
  bar: {
    width: "100%",
    maxWidth: 430,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    paddingHorizontal: 12,
    paddingVertical: 12,
    shadowColor: "#EC4899",
    shadowOpacity: 0.22,
    shadowRadius: 35,
    shadowOffset: { width: 0, height: 0 },
    overflow: "hidden",
  },
  barBackdrop: {
    borderRadius: 32,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  // Android can't blur, so paint a slightly more opaque black instead.
  barBackdropAndroid: {
    borderRadius: 32,
    backgroundColor: "rgba(0,0,0,0.78)",
  },
  // Web spec: `absolute inset-x-8 bottom-0 h-px bg-gradient-to-r
  // from-transparent via-pink-500/70 to-transparent`.
  bottomLine: {
    position: "absolute",
    left: 32,
    right: 32,
    bottom: 0,
    height: 1,
  },
  // Web spec: `grid grid-cols-5 items-end`.
  grid: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  // Web spec: `relative flex flex-col items-center gap-1.5 transition
  // active:scale-95`.
  item: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    position: "relative",
    paddingBottom: 4,
  },
  itemPressed: {
    transform: [{ scale: 0.95 }],
  },
  // Web spec: `relative grid h-11 w-11 place-items-center rounded-full
  // transition bg-white/5`.
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    position: "relative",
  },
  // Web spec active: `bg-gradient-to-br from-pink-500/25 to-fuchsia-500/10
  // shadow-[0_0_22px_rgba(236,72,153,0.45)]`. RN can't do gradient
  // backgrounds inline, so a flat pink tint at 0.20 reads as the same hue.
  iconWrapActive: {
    backgroundColor: "rgba(236,72,153,0.20)",
    shadowColor: "#EC4899",
    shadowOpacity: 0.45,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
  },
  // Web spec: `absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full
  // bg-pink-400 shadow-[0_0_12px_rgba(236,72,153,1)]`.
  dot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#F472B6",
    shadowColor: "#EC4899",
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  // Web spec: `text-[10px] font-bold`. Bumped inactive color from zinc-400
  // to pure white so the labels stay legible against the dark glass pill.
  label: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: "Inter_500Medium",
  },
  labelActive: {
    color: "#F472B6",
  },
  // Web spec: `absolute -bottom-1 h-1 w-8 rounded-full bg-pink-500
  // shadow-[0_0_12px_rgba(236,72,153,0.9)]`.
  underline: {
    position: "absolute",
    bottom: -4,
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#EC4899",
    shadowColor: "#EC4899",
    shadowOpacity: 0.9,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
});
