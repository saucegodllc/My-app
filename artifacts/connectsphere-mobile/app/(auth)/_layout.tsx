import { useAuth, useUser } from "@clerk/clerk-expo";
import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useColors } from "@/hooks/useColors";

export default function AuthLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user, isLoaded: isUserLoaded } = useUser();
  const colors = useColors();

  // Wait for both auth state and user object to load
  if (!isLoaded || (isSignedIn && !isUserLoaded)) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isSignedIn) {
    const onboardingComplete = user?.unsafeMetadata?.onboardingComplete === true;
    return <Redirect href={onboardingComplete ? "/(tabs)/" : "/onboarding"} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="sign-in" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="sign-up" options={{ animation: "slide_from_right" }} />
    </Stack>
  );
}
