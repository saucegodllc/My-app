import { router, type Href } from "expo-router";

export const PREMIUM_FEATURE_KEYS = [
  "rewind",
  "boost",
  "shots",
  "best-friend",
  "reactions",
  "connect",
  "moments",
  "profile-views",
  "spark",
  "swipes",
] as const;

export type PremiumFeatureKey = (typeof PREMIUM_FEATURE_KEYS)[number];

export function isPremiumFeatureKey(feature: string): feature is PremiumFeatureKey {
  return (PREMIUM_FEATURE_KEYS as readonly string[]).includes(feature);
}

export const routes = {
  discovery: "/(tabs)" as const,
  connect: "/(tabs)/matches" as const,
  settings: "/settings" as const,
  premium: "/premium" as const,
  chat(chatId: string, params?: { wave?: boolean; openPlan?: boolean }) {
    const query: string[] = [];
    if (params?.wave) query.push("wave=1");
    if (params?.openPlan) query.push("openPlan=1");
    const suffix = query.length ? `?${query.join("&")}` : "";
    return `/chat/${encodeURIComponent(chatId)}${suffix}` as Href;
  },
  profile(userId: string, from?: string, fallback?: { name?: string; photoUrl?: string; age?: number; neighborhood?: string }) {
    return {
      pathname: "/user/[userId]",
      params: {
        userId,
        ...(from ? { from } : {}),
        ...(fallback?.name ? { fallbackName: fallback.name } : {}),
        ...(fallback?.photoUrl ? { fallbackPhoto: fallback.photoUrl } : {}),
        ...(fallback?.age != null ? { fallbackAge: String(fallback.age) } : {}),
        ...(fallback?.neighborhood ? { fallbackNeighborhood: fallback.neighborhood } : {}),
      },
    } as Href;
  },
  connectWithChat(chatId: string) {
    return {
      pathname: "/(tabs)/matches",
      params: { openChatId: chatId },
    } as Href;
  },
  premiumFor(feature: PremiumFeatureKey) {
    return {
      pathname: "/premium",
      params: { feature },
    } as Href;
  },
};

export function openChat(chatId: string, params?: { wave?: boolean; openPlan?: boolean }) {
  router.push(routes.chat(chatId, params));
}

export function openProfile(
  userId: string,
  from?: string,
  fallback?: { name?: string; photoUrl?: string; age?: number; neighborhood?: string },
) {
  router.push(routes.profile(userId, from, fallback));
}

export function openPremium(feature?: PremiumFeatureKey) {
  if (feature) {
    router.push(routes.premiumFor(feature));
    return;
  }
  router.push(routes.premium);
}

export function openConnectChat(chatId: string) {
  router.push(routes.connectWithChat(chatId));
}

export function openConnect() {
  router.push(routes.connect);
}
