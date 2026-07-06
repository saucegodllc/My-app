import { Ionicons } from "@expo/vector-icons";
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
import { Circle, Ellipse, Path, Svg } from "react-native-svg";
import Purchases, { PurchasesPackage } from "react-native-purchases";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUser } from "@clerk/clerk-expo";

import { useColors } from "@/hooks/useColors";
import { Analytics, track } from "@/lib/analytics";
import { isPremiumFeatureKey, type PremiumFeatureKey } from "@/lib/routes";
import {
  getPremiumEntitlement,
  syncRevenueCatEntitlement,
  type PremiumEntitlement,
} from "@/services/launchReadyApi";

// ── Logo ──────────────────────────────────────────────────────────────────────
// SVG recreation of the ConnectSphere Plus icon:
//   4-pointed compass star inside a ring, hot-pink on transparent.
function PlusLogo({ size = 72, color = "#FF2DA8" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 72 72" accessibilityLabel="ConnectSphere Plus">
      {/* Ring */}
      <Circle cx={36} cy={36} r={31} stroke={color} strokeWidth={4.5} fill="none" />
      {/* 4-pointed star — concave curves between each tip */}
      <Path
        d="M36 6 C37 22 50 35 66 36 C50 37 37 50 36 66 C35 50 22 37 6 36 C22 35 35 22 36 6Z"
        fill={color}
      />
      {/* Center highlight */}
      <Ellipse cx={36} cy={36} rx={6} ry={6} fill="#ff85c8" opacity={0.85} />
    </Svg>
  );
}

// ── Perks ─────────────────────────────────────────────────────────────────────
const PERKS = [
  { icon: "return-up-back-outline", label: "Rewind — undo your last swipe" },
  { icon: "paper-plane-outline",    label: "More Sparks & Shots" },
  { icon: "rocket-outline",         label: "Daily Profile Boost" },
  { icon: "people-circle-outline",  label: "More Best Friend sends" },
  { icon: "eye-outline",            label: "Reveal Reactions — see who liked you" },
  { icon: "sparkles-outline",       label: "AI Spark — unlimited chats" },
  { icon: "pricetag-outline",       label: "Exclusive restaurant & retailer deals" },
] as const;

// ── Feature-specific hero subtitle ────────────────────────────────────────────
const FEATURE_SUBTITLES: Record<PremiumFeatureKey, string> = {
  rewind:    "Undo your last swipe — and unlock every\nother premium feature while you're at it.",
  boost:     "Put your profile at the top of the stack —\nplus every premium perk in one plan.",
  reactions: "See every reaction you're getting —\nplus unlimited AI chats, boosts, and more.",
  shots:     "Send unlimited Shots to anyone —\nplus every premium perk in one plan.",
  "best-friend": "Send Best Friend requests without limits —\nplus every premium feature included.",
  connect:   "See everyone who wants to connect with you —\nand unlock every premium feature.",
  moments:   "See who viewed your Moments —\nand unlock every premium feature.",
  "profile-views": "See everyone checking out your profile —\nand unlock every premium feature.",
  spark:     "Chat with Spark AI as much as you want —\nplus every other premium feature included.",
  swipes:    "Keep discovering without the daily swipe limit —\nplus every premium perk in one plan.",
};

type WebPlan = "monthly" | "sixmonth" | "yearly";

// ── Screen ────────────────────────────────────────────────────────────────────
export default function PremiumScreen() {
  const colors    = useColors();
  const insets    = useSafeAreaInsets();
  const { user }  = useUser();
  const params    = useLocalSearchParams<{ feature?: string }>();
  const feature   = params.feature && isPremiumFeatureKey(params.feature) ? params.feature : undefined;
  const topInset    = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const [packages, setPackages]               = useState<PurchasesPackage[]>([]);
  const [loadingPlan, setLoadingPlan]         = useState<WebPlan | null>(null);
  const [entitlement, setEntitlement]         = useState<PremiumEntitlement | null>(null);
  const [revenueCatReady, setRevenueCatReady] = useState(false);

  // ── Load RevenueCat offerings ──────────────────────────────────────────────
  useEffect(() => {
    async function loadOfferings() {
      try {
        track("paywall_viewed", { feature: feature ?? "plus" });
        getPremiumEntitlement().then(setEntitlement).catch(() => undefined);

        const apiKey =
          Platform.OS === "ios"
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
      } catch {
        setRevenueCatReady(false);
        setPackages([]);
      }
    }
    loadOfferings();
  }, [user?.id, feature]);

  // ── Sync RC entitlement to DB ──────────────────────────────────────────────
  async function syncFromCustomerInfo(
    info: Awaited<ReturnType<typeof Purchases.getCustomerInfo>>,
  ) {
    const plus = info.entitlements.active.plus;
    const synced = await syncRevenueCatEntitlement({
      appUserId:     user?.id ?? info.originalAppUserId,
      isPremium:     !!plus,
      entitlementId: plus?.identifier ?? "plus",
      productId:     plus?.productIdentifier,
      renewalDate:   plus?.expirationDate ?? undefined,
      managementUrl: info.managementURL ?? undefined,
      trialEligible: !plus,
    });
    setEntitlement(synced);
    return synced;
  }

  // ── Main purchase handler ─────────────────────────────────────────────────
  const loading = loadingPlan !== null;

  async function handleCheckout(plan: WebPlan) {
    if (loading) return;

    if (!revenueCatReady || packages.length === 0) {
      Alert.alert(
        "Purchases unavailable",
        "ConnectSphere Plus is available through App Store purchases. Please try again once in-app purchases finish loading.",
      );
      return;
    }

    // RC available → try in-app purchase (uses first matching package)
    const pkg = packages.find((p) => {
      const interval = p.product.subscriptionPeriod;
      if (plan === "yearly")    return interval?.includes("P1Y") ?? false;
      if (plan === "sixmonth")  return interval?.includes("P6M") ?? false;
      return true; // biweekly — fallback to first
    }) ?? packages[0];

    setLoadingPlan(plan);
    Analytics.purchaseStarted("plus");
    try {
      const result = await Purchases.purchasePackage(pkg);
      const synced = await syncFromCustomerInfo(result.customerInfo);
      Analytics.purchaseSucceeded("plus");
      Alert.alert(
        "Welcome to ConnectSphere Plus!",
        "You now have full access to all premium features.",
        [{ text: synced.isPremium ? "Let's Go! 🚀" : "Done", onPress: () => router.back() }],
      );
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        "userCancelled" in err &&
        (err as { userCancelled: boolean }).userCancelled
      ) {
        setLoadingPlan(null);
        return;
      }
      Analytics.purchaseFailed("plus", err instanceof Error ? err.message : "unknown");
      Alert.alert("Purchase unavailable", "Please try again through the App Store purchase flow.");
    } finally {
      setLoadingPlan(null);
    }
  }

  // ── Restore ────────────────────────────────────────────────────────────────
  async function handleRestore() {
    if (!revenueCatReady) {
      Alert.alert(
        "Restore unavailable",
        "ConnectSphere Plus purchases are restored through the App Store. Please try again once in-app purchases finish loading.",
      );
      return;
    }
    setLoadingPlan("yearly"); // use any plan key — just blocks UI during restore
    track("purchase_restore_started", { tier: "plus" });
    try {
      const info   = await Purchases.restorePurchases();
      const synced = await syncFromCustomerInfo(info);
      track("purchase_restore_succeeded", { tier: "plus", isPremium: synced.isPremium });
      Alert.alert(
        synced.isPremium ? "Plus restored ✓" : "No active purchase found",
        synced.isPremium
          ? "Your premium access is active."
          : "We couldn't find an active Plus subscription on this account.",
      );
    } catch {
      Alert.alert("Restore failed", "Please try again.");
    } finally {
      setLoadingPlan(null);
    }
  }

  // ── Manage subscription ────────────────────────────────────────────────────
  async function handleManage() {
    const url = entitlement?.managementUrl;
    if (!url) {
      Alert.alert(
        "Manage subscription",
        "Open your App Store or Google Play subscriptions to manage ConnectSphere Plus.",
      );
      return;
    }
    await Linking.openURL(url);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const PRIMARY = colors.primary;
  const alreadyPremium = entitlement?.isPremium === true;
  const heroSub = (feature && FEATURE_SUBTITLES[feature])
    ?? "Unlock every feature. Meet more people.\nGet exclusive deals in your city.";

  // Already a member — show a simple "you're covered" screen instead of the paywall
  if (alreadyPremium) {
    return (
      <View style={[styles.container, styles.alreadyContainer, { backgroundColor: colors.background }]}>
        <Pressable onPress={() => router.back()} style={[styles.closeBtn, { alignSelf: "flex-end", marginTop: topInset + 8, marginRight: 16 }]} accessibilityLabel="Close">
          <Ionicons name="close" size={24} color={colors.mutedForeground} />
        </Pressable>
        <View style={styles.alreadyInner}>
          <PlusLogo size={64} color={PRIMARY} />
          <Text style={[styles.heroTitle, { color: colors.foreground, marginTop: 16 }]}>You're on Plus ⭐</Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground, marginTop: 8 }]}>
            You already have full access to every premium feature.
          </Text>
          <Pressable
            onPress={handleManage}
            style={[styles.ctaButton, { backgroundColor: PRIMARY, marginTop: 28, paddingHorizontal: 32 }]}
          >
            <Text style={styles.ctaText}>Manage Subscription</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
            <Text style={[styles.footerLink, { color: colors.mutedForeground }]}>Go back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn} accessibilityLabel="Close">
          <Ionicons name="close" size={24} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomInset + 110 }}
      >
        {/* ── Hero ── */}
        <View style={styles.hero}>
          <PlusLogo size={76} color={PRIMARY} />
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>ConnectSphere Plus</Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
            {heroSub}
          </Text>
        </View>

        {/* ── Perks ── */}
        <Text style={[styles.sectionLabel, { color: PRIMARY }]}>WHAT YOU GET</Text>
        <View style={styles.perksContainer}>
          {PERKS.map((perk) => (
            <View
              key={perk.label}
              style={[styles.perkRow, { backgroundColor: colors.card + "90" }]}
            >
              <View style={[styles.perkIcon, { backgroundColor: PRIMARY + "22" }]}>
                <Ionicons name={perk.icon as any} size={14} color={PRIMARY} />
              </View>
              <Text style={[styles.perkLabel, { color: colors.foreground }]}>{perk.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Plan picker ── */}
        <Text style={[styles.sectionLabel, { color: PRIMARY }]}>CHOOSE A PLAN</Text>
        <View style={styles.plansContainer}>

          {/* Yearly — hero card */}
          <Pressable
            onPress={() => handleCheckout("yearly")}
            disabled={loading}
            style={({ pressed }) => [
              styles.heroPlan,
              {
                backgroundColor: PRIMARY + "18",
                borderColor: PRIMARY,
                opacity: pressed ? 0.88 : 1,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <View style={styles.heroPlanTop}>
                <Text style={[styles.heroPlanName, { color: colors.foreground }]}>Yearly</Text>
                <View style={[styles.flashBadge, { backgroundColor: PRIMARY }]}>
                  <Text style={styles.flashBadgeText}>🔥 BEST DEAL — 23% OFF</Text>
                </View>
              </View>
              <View style={styles.heroPriceRow}>
                <Text style={[styles.heroPriceWas, { color: colors.mutedForeground }]}>$390 / yr</Text>
                <Text style={[styles.heroPriceSale, { color: PRIMARY }]}>$300</Text>
                <Text style={[styles.heroPriceUnit, { color: PRIMARY }]}>/ yr</Text>
              </View>
              <Text style={[styles.heroPlanNote, { color: colors.mutedForeground }]}>
                Just $5.77/week · Save $90 vs. biweekly
              </Text>
            </View>
            <View style={[styles.heroPlanArrow, { backgroundColor: PRIMARY }]}>
              {loadingPlan === "yearly"
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="arrow-forward" size={15} color="#fff" />
              }
            </View>
          </Pressable>

          {/* 6-month + biweekly row */}
          <View style={styles.smallRow}>

            <Pressable
              onPress={() => handleCheckout("sixmonth")}
              disabled={loading}
              style={({ pressed }) => [
                styles.smallPlan,
                { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Text style={[styles.smallLabel, { color: colors.mutedForeground }]}>6 MONTHS</Text>
              {loadingPlan === "sixmonth"
                ? <ActivityIndicator color={PRIMARY} style={{ marginTop: 14 }} />
                : <>
                    <Text style={[styles.smallWas, { color: colors.mutedForeground }]}>$180</Text>
                    <Text style={[styles.smallPrice, { color: colors.foreground }]}>$150</Text>
                    <Text style={[styles.smallSave, { color: PRIMARY }]}>Save $30</Text>
                  </>
              }
            </Pressable>

            <Pressable
              onPress={() => handleCheckout("monthly")}
              disabled={loading}
              style={({ pressed }) => [
                styles.smallPlan,
                { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Text style={[styles.smallLabel, { color: colors.mutedForeground }]}>BIWEEKLY</Text>
              {loadingPlan === "monthly"
                ? <ActivityIndicator color={PRIMARY} style={{ marginTop: 14 }} />
                : <>
                    <Text style={[styles.smallPrice, { color: colors.foreground, marginTop: 18 }]}>$14.99</Text>
                    <Text style={[styles.smallNote, { color: colors.mutedForeground }]}>every 2 weeks</Text>
                  </>
              }
            </Pressable>

          </View>
        </View>
      </ScrollView>

      {/* ── Footer CTA ── */}
      <View
        style={[
          styles.footer,
          {
            paddingBottom: bottomInset + 14,
            borderTopColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Pressable
          onPress={() => handleCheckout("yearly")}
          disabled={loading}
          style={({ pressed }) => [
            styles.ctaButton,
            { backgroundColor: PRIMARY, opacity: pressed || loading ? 0.85 : 1 },
          ]}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.ctaText}>🔥 Get Yearly · $300 / yr</Text>
          }
        </Pressable>

        <View style={styles.footerLinks}>
          {revenueCatReady && (
            <>
              <Pressable onPress={handleRestore} disabled={loading} accessibilityLabel="Restore Purchases">
                <Text style={[styles.footerLink, { color: PRIMARY }]}>Restore</Text>
              </Pressable>
              <Text style={[styles.footerDot, { color: colors.mutedForeground }]}>·</Text>
              <Pressable onPress={handleManage}>
                <Text style={[styles.footerLink, { color: PRIMARY }]}>Manage</Text>
              </Pressable>
            </>
          )}
        </View>

        <Text style={[styles.legalText, { color: colors.mutedForeground }]}>
          Subscriptions auto-renew until cancelled. Cancel anytime in App Store settings. Payment charged to your Apple ID at confirmation.
        </Text>
      </View>

    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  alreadyContainer: { flex: 1 },
  alreadyInner: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, paddingBottom: 60 },

  // Header
  header:   { paddingHorizontal: 16, paddingBottom: 4 },
  closeBtn: { padding: 4, alignSelf: "flex-end" },

  // Hero
  hero: {
    alignItems: "center",
    paddingHorizontal: 28,
    paddingTop: 6,
    paddingBottom: 20,
    gap: 10,
  },
  heroTitle: { fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: -0.5, textAlign: "center" },
  heroSub:   { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 21 },

  // Section label
  sectionLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.4,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },

  // Perks
  perksContainer: { paddingHorizontal: 12, gap: 3, marginBottom: 20 },
  perkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  perkIcon:  { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  perkLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 1 },

  // Plans
  plansContainer: { paddingHorizontal: 12, gap: 8, marginBottom: 8 },

  // Hero plan (yearly)
  heroPlan: {
    borderRadius: 16,
    borderWidth: 2,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  heroPlanTop: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 5 },
  heroPlanName: { fontSize: 15, fontFamily: "Inter_700Bold" },
  flashBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  flashBadgeText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 0.3 },
  heroPriceRow: { flexDirection: "row", alignItems: "baseline", gap: 7, marginBottom: 4 },
  heroPriceWas:  { fontSize: 13, fontFamily: "Inter_400Regular", textDecorationLine: "line-through" },
  heroPriceSale: { fontSize: 30, fontFamily: "Inter_700Bold", lineHeight: 34 },
  heroPriceUnit: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  heroPlanNote:  { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
  heroPlanArrow: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", flexShrink: 0 },

  // Small plan cards (6-month, biweekly)
  smallRow:  { flexDirection: "row", gap: 8 },
  smallPlan: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    gap: 3,
  },
  smallLabel: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.9 },
  smallWas:   { fontSize: 11, fontFamily: "Inter_400Regular", textDecorationLine: "line-through" },
  smallPrice: { fontSize: 18, fontFamily: "Inter_700Bold" },
  smallSave:  { fontSize: 11, fontFamily: "Inter_700Bold" },
  smallNote:  { fontSize: 11, fontFamily: "Inter_400Regular" },

  // Footer
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  ctaButton: { height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  ctaText:   { color: "#fff", fontSize: 17, fontFamily: "Inter_700Bold" },
  footerLinks: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  footerLink: { fontSize: 13, fontFamily: "Inter_700Bold" },
  footerDot:  { fontSize: 14 },
  legalText:  { fontSize: 11, textAlign: "center", lineHeight: 16 },
});
