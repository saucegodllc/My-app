import { useAuth, useUser } from "@clerk/clerk-expo";
import { BlurView } from "expo-blur";
import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { useColors } from "@/hooks/useColors";
export default function TabLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user, isLoaded: isUserLoaded } = useUser();
  const colors = useColors();
  const { t } = useTranslation();

  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const safeAreaInsets = useSafeAreaInsets();

  if (isLoaded && !isSignedIn) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (isSignedIn && isUserLoaded && user?.unsafeMetadata?.onboardingComplete !== true) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: "fade",
        tabBarActiveTintColor: "#EC4899",
        tabBarInactiveTintColor: "#71717A",
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : "rgba(5,0,7,0.85)",
          borderTopWidth: 1,
          borderTopColor: "rgba(236,72,153,0.18)",
          elevation: 0,
          paddingBottom: isWeb ? 0 : safeAreaInsets.bottom,
          height: isWeb ? 56 : 49 + safeAreaInsets.bottom,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={80}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(5,0,7,0.85)" }]} />
          ),
        tabBarLabelStyle: {
          fontFamily: "Inter_500Medium",
          fontSize: 11,
          fontWeight: "700",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.discover"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "flame" : "flame-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: "Connect",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "chatbubbles" : "chatbubbles-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: "Events",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "calendar" : "calendar-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: "Map",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "location" : "location-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="network"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tabs.profile"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "person-circle" : "person-circle-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
