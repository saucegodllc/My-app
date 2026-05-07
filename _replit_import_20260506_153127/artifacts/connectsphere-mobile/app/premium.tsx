import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Purchases, { PurchasesPackage } from "react-native-purchases";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const FEATURES = [
  { icon: "infinite", title: "Unlimited Likes", desc: "Like as many profiles as you want" },
  { icon: "eye", title: "See Who Liked You", desc: "Know exactly who's interested before you swipe" },
  { icon: "star", title: "Super Likes", desc: "Stand out with 5 super likes per day" },
  { icon: "location", title: "Global Discovery", desc: "See profiles from anywhere in the world" },
  { icon: "shield-checkmark", title: "Priority Profile", desc: "Get seen by more people in the feed" },
  { icon: "refresh", title: "Unlimited Rewinds", desc: "Undo accidental passes" },
];

export default function PremiumScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selectedPkg, setSelectedPkg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingOffers, setLoadingOffers] = useState(true);

  useEffect(() => {
    async function loadOfferings() {
      try {
        const apiKey = Platform.OS === "ios"
          ? (process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY ?? "")
          : (process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY ?? "");

        if (apiKey) Purchases.configure({ apiKey });
        const offerings = await Purchases.getOfferings();
        const pkgs = offerings.current?.availablePackages ?? [];
        setPackages(pkgs);
        if (pkgs.length > 0) setSelectedPkg(pkgs[0].identifier);
      } catch {
        // RevenueCat not configured, show mock packages
        setPackages([]);
      } finally {
        setLoadingOffers(false);
      }
    }
    loadOfferings();
  }, []);

  async function handlePurchase() {
    if (!selectedPkg) return;
    const pkg = packages.find((p) => p.identifier === selectedPkg);
    if (!pkg) return;
    setLoading(true);
    try {
      await Purchases.purchasePackage(pkg);
      Alert.alert("Welcome to Premium!", "You now have access to all premium features.", [
        { text: "Let's Go!", onPress: () => router.back() },
      ]);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "userCancelled" in err && (err as { userCancelled: boolean }).userCancelled) return;
      Alert.alert("Purchase Failed", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
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
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>ConnectSphere Premium</Text>
          <Text style={[styles.heroSubtitle, { color: colors.mutedForeground }]}>
            Find connections faster with premium features
          </Text>
        </LinearGradient>

        <View style={styles.featuresGrid}>
          {FEATURES.map((feature) => (
            <View key={feature.title} style={[styles.featureCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <LinearGradient colors={[colors.primary + "25", colors.accent + "15"]} style={styles.featureIcon}>
                <Ionicons name={feature.icon as any} size={22} color={colors.primary} />
              </LinearGradient>
              <View style={styles.featureText}>
                <Text style={[styles.featureTitle, { color: colors.foreground }]}>{feature.title}</Text>
                <Text style={[styles.featureDesc, { color: colors.mutedForeground }]}>{feature.desc}</Text>
              </View>
            </View>
          ))}
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
          <View style={[styles.mockPlansSection]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Choose a plan</Text>
            {[
              { label: "Monthly", price: "$14.99/month", id: "monthly" },
              { label: "Annual", price: "$89.99/year", sub: "Save 50%", id: "annual" },
            ].map((plan) => {
              const isSelected = selectedPkg === plan.id;
              return (
                <Pressable
                  key={plan.id}
                  onPress={() => setSelectedPkg(plan.id)}
                  style={[styles.packageCard, { backgroundColor: isSelected ? colors.primary + "15" : colors.card, borderColor: isSelected ? colors.primary : colors.border }]}
                >
                  <View style={{ gap: 2 }}>
                    <Text style={[styles.packageTitle, { color: colors.foreground }]}>{plan.label}</Text>
                    <Text style={[styles.packagePrice, { color: colors.mutedForeground }]}>{plan.price}</Text>
                    {plan.sub && <Text style={[styles.packageSave, { color: colors.primary }]}>{plan.sub}</Text>}
                  </View>
                  {isSelected && <Ionicons name="checkmark-circle" size={24} color={colors.primary} />}
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: bottomInset + 16, borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <Pressable
          onPress={packages.length > 0 ? handlePurchase : () => Alert.alert("Coming Soon", "Premium subscriptions will be available soon!")}
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
                <Text style={styles.ctaText}>Subscribe Now</Text>
              )}
            </LinearGradient>
          )}
        </Pressable>
        <Text style={[styles.legalText, { color: colors.mutedForeground }]}>
          Subscriptions renew automatically. Cancel anytime.
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
  featuresGrid: { paddingHorizontal: 16, gap: 10 },
  featureCard: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, padding: 14, gap: 14 },
  featureIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  featureText: { flex: 1, gap: 2 },
  featureTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  featureDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  packagesSection: { paddingHorizontal: 16, paddingTop: 20, gap: 10 },
  mockPlansSection: { paddingHorizontal: 16, paddingTop: 20, gap: 10 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  packageCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 14, borderWidth: 1.5, padding: 16 },
  packageTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  packagePrice: { fontSize: 14, fontFamily: "Inter_400Regular" },
  packageSave: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  ctaButton: { height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  ctaText: { color: "#fff", fontSize: 17, fontFamily: "Inter_600SemiBold" },
  legalText: { fontSize: 12, textAlign: "center", lineHeight: 16 },
});
