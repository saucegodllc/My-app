/**
 * ConnectSphere Permission Flows
 *
 * Centralised permission management for iOS App Store compliance.
 * Call the appropriate function at the right lifecycle point:
 *
 *   requestCameraPermission()     — before opening LivenessCamera or selfie capture
 *   requestPhotoLibraryPermission() — before ImagePicker
 *   requestNotificationPermission() — after onboarding completes
 *   requestTrackingPermission()    — before any analytics/ad SDKs fire (iOS 14.5+)
 *
 * All functions return a boolean: true = permission granted.
 *
 * App Store requirements addressed:
 *   • NSCameraUsageDescription     — camera with explicit rationale
 *   • NSPhotoLibraryUsageDescription — photo library with explicit rationale
 *   • NSUserNotificationsUsageDescription — push notifications
 *   • NSUserTrackingUsageDescription — ATT (App Tracking Transparency)
 */
import { Alert, Linking, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";

// ATT is iOS-only — dynamically import to avoid Android build errors
async function getTrackingPermission(): Promise<"granted" | "denied" | "not-determined" | "restricted"> {
  if (Platform.OS !== "ios") return "granted";
  try {
    // expo-tracking-transparency if installed; otherwise soft-fail
    const mod = await import("expo-tracking-transparency").catch(() => null);
    if (!mod) return "granted"; // library not installed — skip
    const { status } = await mod.requestTrackingPermissionsAsync();
    return status as "granted" | "denied" | "not-determined" | "restricted";
  } catch {
    return "granted";
  }
}

// ── Camera ────────────────────────────────────────────────────────────────────
/**
 * Request camera access.
 * Called before opening the liveness / selfie camera in onboarding.
 */
export async function requestCameraPermission(): Promise<boolean> {
  const { status, canAskAgain } = await ImagePicker.requestCameraPermissionsAsync();
  if (status === "granted") return true;

  if (!canAskAgain) {
    Alert.alert(
      "Camera Access Needed",
      "ConnectSphere uses your camera for the liveness check that verifies your profile photos are real. Please enable camera access in Settings.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Open Settings",
          onPress: () => Linking.openURL("app-settings:"),
        },
      ]
    );
    return false;
  }

  // Already asked once, show rationale before re-asking
  Alert.alert(
    "Camera Access",
    "We use your camera to verify that your profile photos are genuine. This protects you and everyone on ConnectSphere.",
    [{ text: "Got it" }]
  );
  return false;
}

// ── Photo Library ─────────────────────────────────────────────────────────────
/**
 * Request photo library access.
 * Called before ImagePicker.launchImageLibraryAsync().
 */
export async function requestPhotoLibraryPermission(): Promise<boolean> {
  const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status === "granted") return true;

  if (!canAskAgain) {
    Alert.alert(
      "Photo Library Access Needed",
      "ConnectSphere needs access to your photos so you can add profile pictures. Please enable Photos access in Settings.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Open Settings",
          onPress: () => Linking.openURL("app-settings:"),
        },
      ]
    );
    return false;
  }

  return false;
}

// ── Notifications ─────────────────────────────────────────────────────────────
/**
 * Request push notification permission.
 * Call after the user completes onboarding — don't ask cold on first launch.
 *
 * Returns the Expo push token if granted, or null.
 */
export async function requestNotificationPermission(): Promise<string | null> {
  if (Platform.OS === "web") return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    finalStatus = status;
  }

  if (finalStatus !== "granted") return null;

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });
    return tokenData.data;
  } catch {
    return null;
  }
}

// ── App Tracking Transparency (iOS 14.5+) ─────────────────────────────────────
/**
 * Request ATT permission before initialising any analytics / ad SDKs.
 * Must be called from a user interaction context (e.g. a button press or
 * after onboarding flow), NOT on cold launch.
 *
 * If the user denies, fall back to anonymous/aggregated analytics only.
 */
export async function requestTrackingPermission(): Promise<boolean> {
  if (Platform.OS !== "ios") return true;

  const status = await getTrackingPermission();

  if (status === "granted") return true;

  if (status === "denied") {
    // Respect user choice — disable personalised analytics
    return false;
  }

  return false;
}

// ── Composite: onboarding permission bundle ───────────────────────────────────
/**
 * Run all required permission requests in sequence after onboarding.
 * Stagger them so the user doesn't see a flood of dialogs.
 *
 * Returns a map of which permissions were granted.
 */
export async function runOnboardingPermissions(): Promise<{
  notifications: boolean;
  tracking: boolean;
}> {
  // 1. Notifications — most important for retention
  const notifToken = await requestNotificationPermission();

  // 2. ATT — only on iOS, run 1s after notifications dialog dismisses
  await new Promise((resolve) => setTimeout(resolve, 800));
  const tracking = await requestTrackingPermission();

  return {
    notifications: !!notifToken,
    tracking,
  };
}

// ── Age gate ──────────────────────────────────────────────────────────────────
/**
 * Enforce the 18+ age requirement (App Store guideline 1.3 for dating apps).
 * Returns true if the birthdate represents a user who is 18 or older.
 */
export function isAgeEligible(birthDateIso: string): boolean {
  const birthDate = new Date(birthDateIso);
  if (isNaN(birthDate.getTime())) return false;
  const today = new Date();
  const age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  const dayDiff = today.getDate() - birthDate.getDate();
  const adjustedAge = age - (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? 1 : 0);
  return adjustedAge >= 18;
}

export function showAgeGateAlert() {
  Alert.alert(
    "Age Requirement",
    "ConnectSphere is for users aged 18 and older. You must be at least 18 to create an account.",
    [{ text: "OK" }]
  );
}
