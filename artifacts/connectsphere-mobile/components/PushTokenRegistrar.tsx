/**
 * PushTokenRegistrar — mounts inside ClerkProvider & QueryClientProvider.
 * On sign-in it requests Expo push permission, gets the token, and POSTs
 * it to the backend so the server can send push notifications on
 * match / message / connection accepted.
 *
 * Usage: drop <PushTokenRegistrar /> anywhere inside your provider tree.
 */
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { customFetch } from "@workspace/api-client-react";
import { openChat } from "@/lib/routes";
import { router } from "expo-router";
import { updateDevPushSmokeState } from "@/lib/devPushSmoke";

// How the OS should show a notification when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function shouldLogPushRegistration() {
  return process.env.EXPO_PUBLIC_PUSH_DEBUG === "true" || process.env.NODE_ENV !== "production";
}

function pushRegistrationEnabled() {
  return (
    process.env.EXPO_PUBLIC_ENABLE_PUSH_REGISTRATION !== "false" &&
    process.env.EXPO_PUBLIC_FEATURE_PUSH !== "false"
  );
}

function getExpoProjectId() {
  return (
    process.env.EXPO_PUBLIC_PROJECT_ID ??
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId
  );
}

function logPushRegistration(message: string, data?: unknown) {
  if (!shouldLogPushRegistration()) return;
  if (data === undefined) console.warn(`[push] ${message}`);
  else console.warn(`[push] ${message}`, data);
}

async function registerForPushNotifications(): Promise<string | null> {
  if (!pushRegistrationEnabled()) {
    logPushRegistration("registration disabled by env");
    updateDevPushSmokeState({
      registrationStatus: "disabled",
      registeredWithApi: false,
      lastMessage: "Push registration disabled by env",
      lastError: null,
    });
    return null;
  }

  if (Platform.OS === "web") {
    logPushRegistration("registration skipped on web");
    updateDevPushSmokeState({
      registrationStatus: "unsupported",
      registeredWithApi: false,
      lastMessage: "Push registration skipped on web",
      lastError: null,
    });
    return null;
  }

  if (Constants.appOwnership === "expo") {
    logPushRegistration("remote push tokens require a development build; Expo Go is not supported");
    updateDevPushSmokeState({
      registrationStatus: "unsupported",
      registeredWithApi: false,
      lastMessage: "Remote push tokens require a development build; Expo Go is not supported",
      lastError: null,
    });
    return null;
  }

  // Request / check permission
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    logPushRegistration("notification permission not granted", finalStatus);
    updateDevPushSmokeState({
      registrationStatus: "permission-denied",
      registeredWithApi: false,
      lastMessage: "Notification permission not granted",
      lastError: String(finalStatus),
    });
    return null;
  }

  // Android foreground channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "ConnectSphere",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF0080",
    });
  }

  const projectId = getExpoProjectId();
  if (!projectId) {
    logPushRegistration("missing Expo project id; set EXPO_PUBLIC_PROJECT_ID or run from an EAS dev build");
    updateDevPushSmokeState({
      registrationStatus: "missing-project-id",
      registeredWithApi: false,
      lastMessage: "Missing Expo project id",
      lastError: "Set EXPO_PUBLIC_PROJECT_ID or run from an EAS dev build",
    });
    return null;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  logPushRegistration("received Expo push token");
  updateDevPushSmokeState({
    token: tokenData.data ?? null,
    registrationStatus: "token-received",
    registeredWithApi: false,
    lastMessage: "Received Expo push token",
    lastError: null,
  });
  return tokenData.data ?? null;
}

async function trySendToken(token: string) {
  try {
    updateDevPushSmokeState({
      token,
      registrationStatus: "registering",
      registeredWithApi: false,
      lastMessage: "Registering token with API",
      lastError: null,
    });
    const result = await customFetch("/api/users/push-token", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
    logPushRegistration("registered token with API", result);
    updateDevPushSmokeState({
      token,
      registrationStatus: "registered",
      registeredWithApi: true,
      registeredAt: new Date().toISOString(),
      lastMessage: "Registered token with API",
      lastError: null,
    });
    return true;
  } catch (err) {
    logPushRegistration("token registration failed", err instanceof Error ? err.message : err);
    updateDevPushSmokeState({
      token,
      registrationStatus: "failed",
      registeredWithApi: false,
      lastMessage: "Token registration failed",
      lastError: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

export default function PushTokenRegistrar() {
  const { isSignedIn } = useAuth();
  const registered = useRef(false);

  // Handle notification taps — deep-link to the exact related screen.
  // Also handles cold-start (app opened from a tapped notification).
  useEffect(() => {
    const routeFromNotification = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data ?? {};

      // ── 1. Connect-thread notifications (message, friend_accept, plan_invite,
      //       plan_join, double_date_match) — always include chatId/matchId.
      const chatId =
        typeof data.chatId === "string" ? data.chatId
        : typeof data.matchId === "string" ? data.matchId
        : undefined;
      if (chatId) {
        openChat(chatId);
        return;
      }

      // ── 2. URL-based routing — legacy or future: "/chat/xxx"
      const url = typeof data.url === "string" ? data.url : undefined;
      if (url) {
        const chatMatch = url.match(/\/chat\/([^/?#]+)/);
        if (chatMatch?.[1]) {
          openChat(decodeURIComponent(chatMatch[1]));
          return;
        }
      }

      // ── 3. Route-based routing — daily spark & anti-ghost nudge send data.route.
      //       Anti-ghost:  route = "/chat/dating/<chatId>"
      //       Daily spark: route = "/(tabs)/index" or "/(tabs)/matches"
      const route = typeof data.route === "string" ? data.route : undefined;
      if (route) {
        const datingChatMatch = route.match(/^\/chat\/dating\/([^/?#]+)/);
        if (datingChatMatch?.[1]) {
          // Anti-ghost nudge — open the specific stale dating chat.
          router.push({
            pathname: "/chat/dating/[id]",
            params: { id: datingChatMatch[1] },
          } as never);
          return;
        }
        // Tab-level routes (daily spark re-engagement).
        router.push(route as never);
      }
    };

    const subscription = Notifications.addNotificationResponseReceivedListener(routeFromNotification);
    // Handle cold-start: app launched from a killed state via notification tap.
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) routeFromNotification(response);
    });
    return () => subscription.remove();
  }, []);

  // Register the push token on sign-in. Re-attempt when the app re-foregrounds
  // (e.g. user grants permission during onboarding then returns to the app).
  useEffect(() => {
    if (!isSignedIn) {
      registered.current = false; // reset on sign-out so next sign-in re-registers
      return;
    }

    const tryRegister = async () => {
      if (registered.current) return;
      try {
        const token = await registerForPushNotifications();
        if (!token) return;
        const ok = await trySendToken(token);
        if (ok) registered.current = true;
      } catch (err) {
        updateDevPushSmokeState({
          registrationStatus: "failed",
          registeredWithApi: false,
          lastMessage: "Push registration failed",
          lastError: err instanceof Error ? err.message : String(err),
        });
        logPushRegistration("push registration failed", err instanceof Error ? err.message : err);
      }
    };

    void tryRegister();

    // Re-try when the user returns from Settings (they may have just granted permission)
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") void tryRegister();
    });
    return () => appStateSub.remove();
  }, [isSignedIn]);

  return null;
}
