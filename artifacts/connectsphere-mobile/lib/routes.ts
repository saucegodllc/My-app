import { router, type Href } from "expo-router";

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
  premiumFor(feature: string) {
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

export function openPremium(feature?: string) {
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
