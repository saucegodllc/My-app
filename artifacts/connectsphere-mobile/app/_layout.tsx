import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
  useFonts,
} from "@expo-google-fonts/inter";
import {
  Sora_700Bold,
  Sora_800ExtraBold,
} from "@expo-google-fonts/sora";
import { Yellowtail_400Regular } from "@expo-google-fonts/yellowtail";
import { ClerkProvider, useAuth, useUser } from "@clerk/clerk-expo";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import PushTokenRegistrar from "@/components/PushTokenRegistrar";
import { initSentry, setSentryUser, clearSentryUser } from "@/lib/sentry";
import { identifyUser, resetAnalytics } from "@/lib/analytics";

// Init Sentry as early as possible (module load time)
initSentry();
import { CongratsVideoProvider } from "@/contexts/CongratsVideoContext";
import { ConnectionsProvider } from "@/contexts/ConnectionsContext";
import { DatingMatchProvider } from "@/contexts/DatingMatchContext";
import { DiscoveryModeProvider } from "@/contexts/DiscoveryModeContext";
import { SuccessVideoProvider } from "@/contexts/SuccessVideoContext";
import { TransitionOverlayProvider } from "@/contexts/TransitionOverlayContext";
import { WelcomeVideoProvider } from "@/contexts/WelcomeVideoContext";
import { getApiBaseUrl } from "@/lib/apiBase";
import { useSessionState } from "@/hooks/useSessionState";
import { tokenCache } from "@/lib/tokenCache";
import i18n, { getSavedLanguage } from "@/i18n";

// Set API base URL (absolute URL required for Expo bundles)
setBaseUrl(getApiBaseUrl());

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 },
  },
});

function AuthTokenSetter() {
  const { getToken } = useAuth();
  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);
  return null;
}

/** Keeps Sentry + PostHog in sync with the current auth state. */
function UserSessionTracker() {
  const { userId, isSignedIn } = useAuth();
  const { user } = useUser();
  useEffect(() => {
    if (isSignedIn && userId) {
      setSentryUser(userId, user?.firstName ?? undefined);
      identifyUser(userId, {
        displayName: user?.fullName ?? undefined,
        email: user?.primaryEmailAddress?.emailAddress ?? undefined,
      });
    } else {
      clearSentryUser();
      resetAnalytics();
    }
  }, [isSignedIn, userId, user]);
  return null;
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0a0a0a" }, animationDuration: 380 }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen
        name="chat/[matchId]"
        options={{ headerShown: false, presentation: "card" }}
      />
      <Stack.Screen
        name="chat/dating/[id]"
        options={{ headerShown: false, presentation: "card" }}
      />
      <Stack.Screen
        name="chat/ai-bot"
        options={{ headerShown: false, presentation: "card" }}
      />
      <Stack.Screen
        name="communities/[id]"
        options={{ headerShown: false, presentation: "card" }}
      />
      <Stack.Screen
        name="communities/create"
        options={{ headerShown: false, presentation: "modal" }}
      />
      <Stack.Screen
        name="communities/thread/[postId]"
        options={{ headerShown: false, presentation: "card" }}
      />
      <Stack.Screen
        name="user/[userId]"
        options={{ headerShown: false, presentation: "card" }}
      />
      <Stack.Screen
        name="premium"
        options={{ headerShown: false, presentation: "fullScreenModal" }}
      />
      <Stack.Screen
        name="settings"
        options={{ headerShown: false, presentation: "card" }}
      />
      <Stack.Screen
        name="congrats"
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="success"
        options={{
          headerShown: false,
          gestureEnabled: false,
          animation: "fade",
          animationDuration: 650,
        }}
      />
      <Stack.Screen
        name="resume"
        options={{ headerShown: false, presentation: "card" }}
      />
      <Stack.Screen
        name="likes-you"
        options={{ headerShown: false, presentation: "modal" }}
      />
      <Stack.Screen
        name="blocked-users"
        options={{ headerShown: false, presentation: "card" }}
      />
      <Stack.Screen
        name="referral"
        options={{ headerShown: false, presentation: "card" }}
      />
      <Stack.Screen
        name="profile-views"
        options={{ headerShown: false, presentation: "card" }}
      />
      {/* Legal — modal cards, no custom header needed */}
      <Stack.Screen
        name="legal/privacy"
        options={{ headerShown: false, presentation: "card" }}
      />
      <Stack.Screen
        name="legal/terms"
        options={{ headerShown: false, presentation: "card" }}
      />
      {/* Deep-link handlers */}
      <Stack.Screen name="u/[username]" options={{ headerShown: false }} />
      <Stack.Screen name="invite/[code]" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

function CurrentUserConnectionsProvider({ children }: { children: React.ReactNode }) {
  const { userId, isSignedIn } = useSessionState();
  return <ConnectionsProvider currentUserId={isSignedIn ? userId : null}>{children}</ConnectionsProvider>;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
    Sora_700Bold,
    Sora_800ExtraBold,
    Yellowtail_400Regular,
  });
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    getSavedLanguage().then((locale) => {
      i18n.changeLanguage(locale).finally(() => setI18nReady(true));
    });
  }, []);

  useEffect(() => {
    if ((fontsLoaded || fontError) && i18nReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, i18nReady]);

  if ((!fontsLoaded && !fontError) || !i18nReady) return null;

  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <KeyboardProvider>
                <DiscoveryModeProvider>
                  <CurrentUserConnectionsProvider>
                    <DatingMatchProvider>
                      <WelcomeVideoProvider>
                        <CongratsVideoProvider>
                          <SuccessVideoProvider>
                            <TransitionOverlayProvider>
                              <AuthTokenSetter />
                              <UserSessionTracker />
                              <PushTokenRegistrar />
                              <RootLayoutNav />
                            </TransitionOverlayProvider>
                          </SuccessVideoProvider>
                        </CongratsVideoProvider>
                      </WelcomeVideoProvider>
                    </DatingMatchProvider>
                  </CurrentUserConnectionsProvider>
                </DiscoveryModeProvider>
              </KeyboardProvider>
            </GestureHandlerRootView>
          </QueryClientProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </ClerkProvider>
  );
}
