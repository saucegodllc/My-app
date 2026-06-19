import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Purchases, { PurchasesPackage } from "react-native-purchases";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUser } from "@clerk/clerk-expo";

import { useColors } from "@/hooks/useColors";
import { Analytics, track } from "@/lib/analytics";
import { getPremiumEntitlement, syncRevenueCatEntitlement, type PremiumEntitlement } from "@/services/launchReadyApi";

const FEATURES = [
  { id: "swipes", icon: "infinite", title: "Unlimited swipes", desc: "Keep discovering after free daily limits." },
  { id: "rewind", icon: "return-up-back", title: "Rewind", desc: "Accidentally passed on someone great? Go back and undo your last swipe." },
  { id: "shots", icon: "paper-plane", title: "More Shots", desc: "Send more personalized openers that land in Reactions." },
  { id: "sparks", icon: "sparkles", title: "More Sparks", desc: "Stand out with premium interest when one tap is not enough." },
  { id: "boost", icon: "rocket", title: "Daily Boost", desc: "Get one profile Boost every day to show up with more momentum." },
  { id: "best-friend", icon: "people-circle", title: "More Best Friend sends", desc: "Send friendship-side premium badges with extra glow." },
  { id: "reactions", icon: "eye", title: "Reveal Reactions", desc: "See who liked, Sparked, Shot, or Best-Friended you." },
] as const;

type PremiumFeatureId = (typeof FEATURES)[number]["id"];

export default function PremiumScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ feature?: string }>();
  const { user } = useUser();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const selectedFeature = FEATURES.some((feature) => feature.id === params.feature)
    ? (params.feature as PremiumFeatureId)
    : undefined;
  const highlightedFeature = FEATURES.find((feature) => feature.id === selectedFeature);

  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selectedPkg, setSelectedPkg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingOffers, setLoadingOffers] = useState(true);
  const [entitlement, setEntitlement] = useState<PremiumEntitlement | null>(null);
  const [revenueCatReady, setRevenueCatReady] = useState(false);
  const [webPlan, setWebPlan] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    async function loadOfferings() {
      try {
        track("paywall_viewed", { feature: selectedFeature ?? "plus" });
        getPremiumEntitlement().then(setEntitlement).catch(() => undefined);
        const apiKey = Platform.OS === "ios"
          ? (process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY ?? "")
          : (process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY ?? "");

        if (!apiKey || Platform.OS === "web") {
          setRevenueCatReady(false);
          setPackages([]);
          return;
        }
        Purchases.configure({ apiKey, appUserID: user?.id });
        setRevenueCatReady(true);
        const offerings = await Purchases.getOfferings();
        const pkgs = offerings.current?.availablePackages ?? [];
        setPackages(pkgs);
        if (pkgs.length > 0) setSelectedPkg(pkgs[0].identifier);
      } catch {
        setRevenueCatReady(false);
        setPackages([]);
      } finally {
        setLoadingOffers(false);
      }
    }
    loadOfferings();
  }, [selectedFeature, user?.id]);

  async function syncFromCustomerInfo(info: Awaited<ReturnType<typeof Purchases.getCustomerInfo>>) {
    const plus = info.entitlements.active.plus;
    const synced = await syncRevenueCatEntitlement({
      appUserId: info.originalAppUserId ?? user?.id,
      isPremium: !!plus,
      entitlementId: plus?.identifier ?? "plus",
      productId: plus?.productIdentifier,
      renewalDate: plus?.expirationDate ?? undefined,
      managementUrl: info.managementURL ?? undefined,
      trialEligible: !plus,
    });
    setEntitlement(synced);
    return synced;
  }

  async function handlePurchase() {
    if (!selectedPkg) return;
    const pkg = packages.find((p) => p.identifier === selectedPkg);
    if (!pkg) return;
    setLoading(true);
    Analytics.purchaseStarted("plus");
    try {
      const result = await Purchases.purchasePackage(pkg);
      const synced = await syncFromCustomerInfo(result.customerInfo);
      Analytics.purchaseSucceeded("plus");
      Alert.alert("Welcome to ConnectSphere Plus!", "You now have access to premium features.", [
        { text: synced.isPremium ? "Let's Go!" : "Done", onPress: () => router.back() },
      ]);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "userCancelled" in err && (err as { userCancelled: boolean }).userCancelled) return;
      Analytics.purchaseFailed("plus", err instanceof Error ? err.message : "unknown");
      Alert.alert("Purchase Failed", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRestore() {
    setLoading(true);
    track("purchase_restore_started", { tier: "plus" });
    try {
      const info = await Purchases.restorePurchases();
      const synced = await syncFromCustomerInfo(info);
      track("purchase_restore_succeeded", { tier: "plus", isPremium: synced.isPremium });
      Alert.alert(synced.isPremium ? "Plus restored" : "No active purchase found", synced.isPremium ? "Your premium access is active." : "We could not find an active Plus subscription on this account.");
    } catch {
      Alert.alert("Restore failed", "We could not restore purchases. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Web Checkout (Stripe) ─────────────────────────────────────────────────
  // Opens Stripe Hosted Checkout in the system browser.
  // On return the deep link connectsphere://premium-success refreshes RC.
  async function handleWebCheckout(plan: "monthly" | "yearly") {
    if (!user?.id) return;
    const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "";
    const url = `${apiUrl}/api/stripe/subscribe?userId=${encodeURIComponent(user.id)}&plan=${plan}`;
    track("web_checkout_tapped", { plan });
    await Linking.openURL(url);
  }

  // Listen for the deep link that Stripe's success page fires back into the app.
  // When received, refresh RevenueCat entitlements so the UI updates immediately.
  useEffect(() => {
    async function handleDeepLink(event: { url: string }) {
      if (!event.url.includes("premium-success")) return;
      try {
        const info = await Purchases.getCustomerInfo();
        const synced = await syncFromCustomerInfo(info);
        if (synced.isPremium) {
          track("web_checkout_succeeded");
          Alert.alert("Welcome to Plus!", "Your premium access is now active.", [
            { text: "Let's Go!", onPress: () => router.back() },
          ]);
        }
      } catch {
        // silent — entitlement will sync on next app open
      }
    }

    const sub = Linking.addEventListener("url", handleDeepLink);
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function handleManageSubscription() {
    const url = entitlement?.managementUrl;
    if (!url) {
      Alert.alert("Subscription management", "Open your App Store or Google Play subscriptions to manage ConnectSphere Plus.");
      return;
    }
    await Linking.openURL(url);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={colors.foreground} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomInset + 20 }}>
        <LinearGradient
          colors={[colors.primary + "30", "transparent"]}
          style={styles.heroBanner}
        >
          <LinearGradient colors={[colors.primary, colors.accent]} style={styles.starIcon}>
            <Ionicons name="star" size={32} color="#fff" />
          </LinearGradient>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>ConnectSphere Plus</Text>
          <Text style={[styles.heroSubtitle, { color: colors.mutedForeground }]}>
            Unlock the extra momentum behind swipes, Shots, Sparks, Best Friend sends, and Reactions.
          </Text>
          {highlightedFeature ? (
            <View style={[styles.highlightPill, { borderColor: colors.primary, backgroundColor: colors.primary + "18" }]}>
              <Ionicons name={highlightedFeature.icon as any} size={15} color={colors.primary} />
              <Text style={[styles.highlightText, { color: colors.primary }]}>
                Opening checkout for {highlightedFeature.title}
              </Text>
            </View>
          ) : null}
        </LinearGradient>

        <View style={styles.featuresGrid}>
          {FEATURES.map((feature) => {
            const active = feature.id === selectedFeature;
            return (
            <View
              key={feature.title}
              style={[
                styles.featureCard,
                {
                  backgroundColor: active ? colors.primary + "16" : colors.card,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
            >
              <LinearGradient colors={[colors.primary + "25", colors.accent + "15"]} style={styles.featureIcon}>
                <Ionicons name={feature.icon as any} size={22} color={colors.primary} />
              </LinearGradient>
              <View style={styles.featureText}>
                <Text style={[styles.featureTitle, { color: colors.foreground }]}>{feature.title}</Text>
                <Text style={[styles.featureDesc, { color: colors.mutedForeground }]}>{feature.desc}</Text>
              </View>
              {active ? <Ionicons name="checkmark-circle" size={21} color={colors.primary} /> : null}
            </View>
          );
          })}
        </View>

        {loadingOffers ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
        ) : packages.length > 0 ? (
          <View style={styles.packagesSection}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Choose a plan</Text>
            {packages.map((pkg) => {
              const isSelected = selectedPkg === pkg.identifier;
              return (
                <Pressable
                  key={pkg.identifier}
                  onPress={() => setSelectedPkg(pkg.identifier)}
                  style={[
                    styles.packageCard,
                    {
                      backgroundColor: isSelected ? colors.primary + "15" : colors.card,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <View>
                    <Text style={[styles.packageTitle, { color: colors.foreground }]}>
                      {pkg.product.title || pkg.packageType}
                    </Text>
                    <Text style={[styles.packagePrice, { color: colors.mutedForeground }]}>
                      {pkg.product.priceString}
                    </Text>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                  )}
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={[styles.unavailableSection]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Choose a plan</Text>
            <View style={[styles.packageCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ gap: 4, flex: 1 }}>
                <Text style={[styles.packageTitle, { color: colors.foreground }]}>ConnectSphere Plus</Text>
                <Text style={[styles.packagePrice, { color: colors.mutedForeground }]}>
                  RevenueCat is required for live checkout. Configure the iOS/Android public SDK keys to enable $9.99/mo purchases.
                </Text>
              </View>
            </View>
          </View>
        )}
        {/* ── Web Checkout (Stripe) ── skip on web platform itself */}
        {Platform.OS !== "web" && (
          <View style={styles.webSection}>
            <View style={styles.webDivider}>
              <View style={[styles.webDividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.webDividerText, { color: colors.mutedForeground }]}>or subscribe on web</Text>
              <View style={[styles.webDividerLine, { backgroundColor: colors.border }]} />
            </View>

            <View style={styles.webToggle}>
              {(["monthly", "yearly"] as const).map((p) => (
                <Pressable
                  key={p}
                  onPress={() => setWebPlan(p)}
                  style={[
                    styles.webToggleBtn,
                    {
                      backgroundColor: webPlan === p ? colors.primary : colors.card,
                      borderColor: webPlan === p ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.webToggleBtnText, { color: webPlan === p ? "#fff" : colors.mutedForeground }]}>
                    {p === "monthly" ? "$9.99 / mo" : "$59.99 / yr"}
                  </Text>
                  {p === "yearly" && (
                    <View style={[styles.saveBadge, { backgroundColor: colors.primary }]}>
                      <Text style={styles.saveBadgeText}>Save 50%</Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </View>

            <Pressable onPress={() => handleWebCheckout(webPlan)} style={({ pressed }) => [styles.webCheckoutBtn, { borderColor: colors.primary, opacity: pressed ? 0.7 : 1 }]}>
              <Ionicons name="globe-outline" size={18} color={colors.primary} />
              <Text style={[styles.webCheckoutText, { color: colors.primary }]}>
                Subscribe on Web · Pay with card
              </Text>
            </Pressable>
            <Text style={[styles.webLegal, { color: colors.mutedForeground }]}>
              No App Store. Manage or cancel at{" "}
              <Text style={{ color: colors.primary }}>connectsphere.app/billing</Text>
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: bottomInset + 16, borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <Pressable
          onPress={packages.length > 0 ? handlePurchase : () => Alert.alert("Checkout unavailable", "RevenueCat is not configured on this build yet. Add the public SDK keys before production submission.")}
          disabled={loading}
        >
          {({ pressed }) => (
            <LinearGradient
              colors={[colors.primary, colors.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.ctaButton, { opacity: pressed || loading ? 0.85 : 1 }]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ctaText}>{packages.length > 0 ? "Unlock All Matches for $9.99/mo" : "Checkout Unavailable"}</Text>
              )}
            </LinearGradient>
          )}
        </Pressable>
        <View style={styles.footerActions}>
          {/* Restore Purchases — MANDATORY per App Store guideline 3.1.1 */}
          <Pressable
            onPress={handleRestore}
            disabled={loading}
            accessibilityLabel="Restore Purchases"
            accessibilityRole="button"
          >
            <Text style={[styles.footerActionText, { color: colors.primary }]}>
              Restore Purchases
            </Text>
          </Pressable>
          <Text style={[styles.footerDot, { color: colors.mutedForeground }]}>·</Text>
          <Pressable onPress={handleManageSubscription}>
            <Text style={[styles.footerActionText, { color: colors.primary }]}>Manage</Text>
          </Pressable>
        </View>
        <Text style={[styles.legalText, { color: colors.mutedForeground }]}>
          Subscriptions auto-renew until cancelled. Cancel anytime in App Store settings.
          Payment charged to your Apple ID account at confirmation of purchase.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  closeBtn: { padding: 4, alignSelf: "flex-end" },
  heroBanner: { alignItems: "center", paddingHorizontal: 24, paddingVertical: 32, gap: 14 },
  starIcon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  heroTitle: { fontSize: 26, fontFamily: "Inter_700Bold", textAlign: "center", letterSpacing: -0.3 },
  heroSubtitle: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  highlightPill: { flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  highlightText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  featuresGrid: { paddingHorizontal: 16, gap: 10 },
  featureCard: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, padding: 14, gap: 14 },
  featureIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  featureText: { flex: 1, gap: 2 },
  featureTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  featureDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  packagesSection: { paddingHorizontal: 16, paddingTop: 20, gap: 10 },
  unavailableSection: { paddingHorizontal: 16, paddingTop: 20, gap: 10 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  packageCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 14, borderWidth: 1.5, padding: 16 },
  packageTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  packagePrice: { fontSize: 14, fontFamily: "Inter_400Regular" },
  packageSave: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  ctaButton: { height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  ctaText: { color: "#fff", fontSize: 17, fontFamily: "Inter_600SemiBold" },
  footerActions: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  footerActionText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  footerDot: { fontSize: 14, fontFamily: "Inter_700Bold" },
  legalText: { fontSize: 12, textAlign: "center", lineHeight: 16 },
  // Web checkout section
  webSection: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, gap: 14 },
  webDivider: { flexDirection: "row", alignItems: "center", gap: 10 },
  webDividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  webDividerText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  webToggle: { flexDirection: "row", gap: 10 },
  webToggleBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, borderWidth: 1.5, paddingVertical: 12 },
  webToggleBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  saveBadge: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  saveBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#fff" },
  webCheckoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, borderWidth: 1.5, paddingVertical: 14 },
  webCheckoutText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  webLegal: { fontSize: 11, textAlign: "center", lineHeight: 16 },
});
