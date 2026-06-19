/**
 * Deep-link handler: connectsphere.app/invite/{code}
 * ────────────────────────────────────────────────────
 * When a new user taps a referral link:
 *   - Not signed in  → sends to sign-up with code stored in AsyncStorage
 *   - Signed in      → records referral use in Firestore (idempotent), shows toast
 *
 * AsyncStorage key "cs:pendingReferralCode" is read during onboarding completion
 * to credit the referrer.
 */
import { useAuth } from "@clerk/clerk-expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

const PENDING_CODE_KEY = "cs:pendingReferralCode";

async function recordReferralUse(code: string, userId: string): Promise<void> {
  try {
    const { getFirestore, doc, setDoc, serverTimestamp } = await import("firebase/firestore");
    const { getApp } = await import("firebase/app");
    const db = getFirestore(getApp());
    // Use userId as docId → naturally idempotent (can't claim twice)
    await setDoc(
      doc(db, "referrals", code, "uses", userId),
      { userId, createdAt: serverTimestamp() },
      { merge: true },
    );
  } catch (err) {
    console.warn("recordReferralUse failed", err);
  }
}

export default function InviteDeepLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { isSignedIn, isLoaded, userId } = useAuth();
  const [message, setMessage] = useState("Joining ConnectSphere…");

  useEffect(() => {
    if (!isLoaded || !code) return;

    const codeUpper = code.toUpperCase();

    if (!isSignedIn) {
      // Stash code so onboarding can credit it after signup
      AsyncStorage.setItem(PENDING_CODE_KEY, codeUpper).finally(() => {
        router.replace("/(auth)/sign-up" as never);
      });
      return;
    }

    // Already signed in — record use then bounce home
    if (userId) {
      recordReferralUse(codeUpper, userId).then(() => {
        setMessage("🎁 Referral credited! Welcome to ConnectSphere.");
        setTimeout(() => router.replace("/(tabs)/" as never), 1800);
      });
    } else {
      router.replace("/(tabs)/" as never);
    }
  }, [isLoaded, isSignedIn, userId, code]);

  return (
    <View style={styles.root}>
      <ActivityIndicator color="#EC4899" size="large" />
      <Text style={styles.msg}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0a0a0a", alignItems: "center", justifyContent: "center", gap: 16 },
  msg: { color: "rgba(255,255,255,0.7)", fontSize: 14, fontFamily: "Inter_500Medium", textAlign: "center", paddingHorizontal: 32 },
});
