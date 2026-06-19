import * as SecureStore from "expo-secure-store";

const CONSENT_KEY = "connectsphere.analytics.consent";

type PostHogLike = {
  init?: (key: string, options?: Record<string, unknown>) => void;
  capture?: (event: string, properties?: Record<string, unknown>) => void;
  identify?: (userId: string, traits?: Record<string, unknown>) => void;
  reset?: () => void;
};

let analyticsConsent: boolean | null = null;
let posthog: PostHogLike | null = null;
let loadStarted = false;
let pendingIdentify: { userId: string; traits?: Record<string, unknown> } | null = null;

async function hasConsent(): Promise<boolean> {
  if (analyticsConsent !== null) return analyticsConsent;
  analyticsConsent = (await SecureStore.getItemAsync(CONSENT_KEY).catch(() => null)) === "granted";
  return analyticsConsent;
}

async function loadPostHog(): Promise<PostHogLike | null> {
  if (posthog || loadStarted) return posthog;
  loadStarted = true;
  const key = process.env.EXPO_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  try {
    const moduleName = "posthog-react-native";
    const mod = (await import(moduleName)) as { PostHog?: new (key: string, options?: Record<string, unknown>) => PostHogLike; default?: PostHogLike };
    posthog = mod.PostHog ? new mod.PostHog(key, { host: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com" }) : mod.default ?? null;
    posthog?.init?.(key, { host: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com" });
    if (pendingIdentify) posthog?.identify?.(pendingIdentify.userId, pendingIdentify.traits);
    return posthog;
  } catch {
    return null;
  }
}

export async function setAnalyticsConsent(granted: boolean) {
  analyticsConsent = granted;
  await SecureStore.setItemAsync(CONSENT_KEY, granted ? "granted" : "denied").catch(() => {});
  if (!granted) posthog?.reset?.();
}

export function identifyUser(userId: string, traits?: Record<string, unknown>) {
  pendingIdentify = { userId, traits };
  void hasConsent().then((allowed) => {
    if (!allowed) return;
    void loadPostHog().then((client) => client?.identify?.(userId, traits));
  });
}

export function track(event: string, properties?: Record<string, unknown>) {
  void hasConsent().then((allowed) => {
    if (!allowed) return;
    void loadPostHog().then((client) => client?.capture?.(event, properties));
  });
}

export function resetAnalytics() {
  pendingIdentify = null;
  posthog?.reset?.();
}

export const Analytics = {
  // ── Onboarding ──────────────────────────────────────────────────────────
  onboardingCompleted: () => track("onboarding_completed"),

  // ── Invites ─────────────────────────────────────────────────────────────
  inviteSent: (flow: string) => track("invite_sent", { flow }),
  inviteOpened: (flow: string) => track("invite_opened", { flow }),
  inviteJoined: (flow: string) => track("invite_joined", { flow }),

  // ── Permissions ─────────────────────────────────────────────────────────
  pushOptIn: (granted: boolean) => track("push_opt_in", { granted }),

  // ── Safety ──────────────────────────────────────────────────────────────
  reportSubmitted: (reason: string) => track("report_submitted", { reason }),
  blockUser: () => track("block_user"),

  // ── Purchases ───────────────────────────────────────────────────────────
  purchaseStarted: (tier: string) => track("purchase_started", { tier }),
  purchaseSucceeded: (tier: string) => track("purchase_succeeded", { tier }),
  purchaseFailed: (tier: string, reason?: string) => track("purchase_failed", { tier, reason }),
  premiumUpgrade: (tier: string) => track("premium_upgrade", { tier }),
  boostStarted: () => track("boost_started"),
  boostExpired: () => track("boost_expired"),

  // ── Core Swipe Funnel ────────────────────────────────────────────────────
  /** Fire on every swipe. direction mirrors SwipeAction. */
  swipe: (
    direction: "vibe" | "pass" | "spark",
    props: { profileId: string | number; intent: "dating" | "friends"; deckIndex: number; subTab?: string },
  ) => track("swipe", { direction, ...props }),

  /** Fire the moment a mutual match is detected. */
  match: (
    matchId: string,
    props: { type: "dating" | "double_date" | "friend"; profileId?: string | number },
  ) => track("match", { matchId, ...props }),

  /** Deck exhausted — critical for radius / seed-count debugging. */
  deckExhausted: (props: { intent: "dating" | "friends"; profilesSeen: number }) =>
    track("deck_exhausted", props),

  // ── Messaging Funnel ─────────────────────────────────────────────────────
  /** Fire when the user sends any message. */
  messageSent: (
    matchId: string,
    props: { chatType?: string; messageType?: "text" | "voice" | "gif" | "image"; isFirstMessage?: boolean },
  ) => track("message_sent", { matchId, ...props }),

  /** Fire when first message is sent in a fresh match thread. */
  firstMessageSent: (matchId: string) =>
    track("first_message_sent", { matchId }),

  /** Fire when the other user replies — confirms two-way conversation. */
  conversationActivated: (matchId: string) =>
    track("conversation_activated", { matchId }),

  // ── Voice Notes ──────────────────────────────────────────────────────────
  voiceNoteRecorded: (durationSeconds: number) => track("voice_note_recorded", { durationSeconds }),
  voiceNotePlayed: (matchId: string) => track("voice_note_played", { matchId }),

  // ── Stories / Moments ────────────────────────────────────────────────────
  storyPosted: (momentType: "photo" | "video") => track("story_posted", { momentType }),
  storyViewed: (authorId: string) => track("story_viewed", { authorId }),

  // ── Live Drop ────────────────────────────────────────────────────────────
  liveDropActivated: (durationMinutes: number) => track("live_drop_activated", { durationMinutes }),
  liveDropTapped: (authorId: string) => track("live_drop_tapped", { authorId }),

  // ── Vibe Check ───────────────────────────────────────────────────────────
  vibeCheckCompleted: (compatScore: number) => track("vibe_check_completed", { compatScore }),

  // ── AI Shot Assist ───────────────────────────────────────────────────────
  shotAssistRequested: () => track("shot_assist_requested"),
  shotAssistCompleted: (score: number) => track("shot_assist_completed", { score }),

  // ── Profile / Discovery ──────────────────────────────────────────────────
  profileView: (targetUserId: string, source: string) => track("profile_view", { targetUserId, source }),
  videoMomentViewed: (authorId: string) => track("video_moment_viewed", { authorId }),

  // ── Connections ──────────────────────────────────────────────────────────
  connectionAccepted: () => track("connection_accepted"),

  // ── Retention critical-path ───────────────────────────────────────────────
  /**
   * User hit their daily swipe limit.
   * Monitor to measure free→paid conversion pressure.
   */
  swipeLimitHit: (props: { intent: "dating" | "friends"; swipesUsed: number }) =>
    track("swipe_limit_hit", props),

  /**
   * Paywall screen became visible.
   * `feature` = what triggered it: "swipes" | "boost" | "rewind" | "shots" | etc.
   */
  paywallSeen: (feature: string, props?: Record<string, unknown>) =>
    track("paywall_seen", { feature, ...props }),

  /**
   * User opened a chat thread.
   * Measures match→conversation conversion; surfaces cold matches.
   */
  chatOpened: (
    matchId: string,
    props: {
      source: "match_modal" | "matches_list" | "notification" | "other";
      isFirstOpen?: boolean;
    },
  ) => track("chat_opened", { matchId, ...props }),

  /**
   * React error boundary caught a render crash.
   * `screen` identifies which boundary fired (e.g. "discover").
   * Fires to PostHog in parallel with Sentry so spikes surface
   * even if the Sentry DSN is misconfigured in production.
   */
  errorBoundaryTriggered: (screen: string, props?: { message?: string }) =>
    track("error_boundary_triggered", { screen, ...props }),

  /**
   * Boost timer restored from AsyncStorage cache on cold start
   * because Firestore was slow or unavailable.
   * Monitor Firestore cold-start reliability at launch.
   */
  boostRestoredFromCache: () => track("boost_restored_from_cache"),
};
