/**
 * Deep-link handler: connectsphere.app/u/{username}
 * ────────────────────────────────────────────────────
 * Resolves a username to a Firestore userId then redirects to /user/[userId].
 * If the lookup fails or the route is opened before auth is ready, it falls
 * back gracefully to the home tab.
 *
 * Deep-link examples:
 *   connectsphere://u/RICKY42
 *   https://connectsphere.app/u/RICKY42
 */
import { useAuth } from "@clerk/clerk-expo";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

async function resolveUsernameToId(username: string): Promise<string | null> {
  try {
    const { getFirestore, collection, query, where, getDocs, limit } = await import("firebase/firestore");
    const { getApp } = await import("firebase/app");
    const db = getFirestore(getApp());
    const q = query(
      collection(db, "users"),
      where("username", "==", username.toLowerCase()),
      limit(1),
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].id;
  } catch {
    return null;
  }
}

export default function UsernameDeepLink() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { isSignedIn, isLoaded } = useAuth();
  const [status, setStatus] = useState<"loading" | "not_found">("loading");

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      // Not authed — send to auth flow, then they'll be redirected back via deep link
      router.replace("/(auth)/welcome" as never);
      return;
    }

    if (!username) {
      router.replace("/(tabs)/" as never);
      return;
    }

    resolveUsernameToId(username).then((userId) => {
      if (userId) {
        router.replace({ pathname: "/user/[userId]", params: { userId } } as never);
      } else {
        setStatus("not_found");
        // Bounce back home after a beat
        setTimeout(() => router.replace("/(tabs)/" as never), 2000);
      }
    });
  }, [isLoaded, isSignedIn, username]);

  return (
    <View style={styles.root}>
      {status === "loading" ? (
        <ActivityIndicator color="#EC4899" size="large" />
      ) : (
        <Text style={styles.msg}>Profile not found</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0a0a0a", alignItems: "center", justifyContent: "center" },
  msg: { color: "rgba(255,255,255,0.6)", fontSize: 15, fontFamily: "Inter_500Medium", marginTop: 16 },
});
