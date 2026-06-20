export type RetentionMoment = {
  id: string;
  authorId: string;
  authorName: string;
  authorPhotoUrl: string;
  mediaUrl: string;
  mediaType: "photo" | "video";
  caption?: string;
  createdAt: string;
  expiresAt: string;
  viewCount: number;
  viewerIds: string[];
  viewedByMe?: boolean;
};

export type RetentionVibeAnswers = {
  loveLanguage: string;
  energyType: string;
  conflictStyle: string;
  datePace: string;
  adventureLevel: number;
};

export type WhyWorkProfileInput = {
  name?: string;
  interests?: string[];
  chemistrySignals?: string[];
  prompt?: string;
  promptAnswer?: string;
  firstDateStyle?: string;
  dateIdeas?: string[];
  vibeCheck?: {
    answers?: Partial<RetentionVibeAnswers> | null;
  } | null;
};

export const STORIES_ADD_CTA_LABEL = "Add your story";
export const FRESH_CHAT_OPENER_LABEL = "✨ Send an opener";
export const FRESH_CHAT_DOUBLE_DATE_LABEL = "🍻 Double date?";
export const SHOT_TOOLTIP_STORAGE_KEY = "cs:onboarding:shot-tooltip-seen";
export const SHOT_TOOLTIP_COPY = "A Shot is a bold first move — send a message before you even match.";

export const DISCOVER_FREE_ACTION_LIMIT = 5;

export type DiscoverIntent = "dating" | "friends";
export type DiscoverAction =
  | "vibe"
  | "spark"
  | "pass"
  | "shot"
  | "create_plan"
  | "create_group"
  | "best_friend";

export const DATING_SUB_TABS = [
  "For You",
  "Active Tonight",
  "Hookup",
  "Intentional",
  "Curious",
  "Having Fun",
] as const;

const HOUR_MS = 3600_000;

export function buildCuratedSeedStories(nowMs = Date.now()): RetentionMoment[] {
  const base = [
    {
      id: "seed-story-rooftop",
      authorName: "Maya",
      authorPhotoUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&q=80",
      mediaUrl: "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=900&q=82",
      caption: "Rooftop sunsets are undefeated.",
      createdOffsetHours: 0.5,
    },
    {
      id: "seed-story-market",
      authorName: "Noah",
      authorPhotoUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=240&q=80",
      mediaUrl: "https://images.unsplash.com/photo-1533900298318-6b8da08a523e?auto=format&fit=crop&w=900&q=82",
      caption: "Found the best little market crawl.",
      createdOffsetHours: 2,
    },
    {
      id: "seed-story-trivia-night",
      authorName: "Jules",
      authorPhotoUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=240&q=80",
      mediaUrl: "https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?auto=format&fit=crop&w=900&q=82",
      caption: "Trivia night chaos, respectfully.",
      createdOffsetHours: 4,
    },
    {
      id: "seed-story-sunset",
      authorName: "Ari",
      authorPhotoUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=240&q=80",
      mediaUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=82",
      caption: "Quick reset before plans.",
      createdOffsetHours: 6,
    },
  ];

  return base.map((story) => {
    const createdAtMs = nowMs - story.createdOffsetHours * HOUR_MS;
    return {
      id: story.id,
      authorId: `seed:${story.id}`,
      authorName: story.authorName,
      authorPhotoUrl: story.authorPhotoUrl,
      mediaUrl: story.mediaUrl,
      mediaType: "photo" as const,
      caption: story.caption,
      createdAt: new Date(createdAtMs).toISOString(),
      expiresAt: new Date(createdAtMs + 24 * HOUR_MS).toISOString(),
      viewCount: 0,
      viewerIds: [],
      viewedByMe: false,
    };
  });
}

export function getDisplayMoments(
  firestoreMoments: RetentionMoment[],
  currentUserId: string,
  nowMs = Date.now(),
): RetentionMoment[] {
  if (firestoreMoments.length > 0) return firestoreMoments;
  return buildCuratedSeedStories(nowMs).filter((moment) => moment.authorId !== currentUserId);
}

export function shouldShowFreshChatFallbackCtas(isFreshChat: boolean, opener?: string | null): boolean {
  return isFreshChat && !opener?.trim();
}

export function buildFreshChatOpenerInvite(name: string, topic: string): string {
  return `${firstName(name)}, quick opener: two truths and a lie about ${cleanTopic(topic)} - I'll guess first.`;
}

export function buildFreshChatDoubleDateInvite(name: string, topic: string): string {
  return `${firstName(name)}, low-pressure idea: double date over ${cleanTopic(topic)} sometime? Bring your funniest friend and I'll bring mine.`;
}

export function shouldShowShotTooltip(intent: string, seen: boolean): boolean {
  return !seen && (intent === "dating" || intent === "all");
}

export function shouldConsumeDiscoverAction(_intent: DiscoverIntent, _action: DiscoverAction): boolean {
  return true;
}

export function shouldBypassVibeGate(): boolean {
  return true;
}

export function getRailPopLabel(label: string): string {
  if (label === "SHOT" || label === "SHOOT") return "Shoot";
  const lower = label.toLowerCase();
  return lower ? `${lower[0]?.toUpperCase() ?? ""}${lower.slice(1)}` : label;
}

export function buildDatingSubTabs(): string[] {
  return [...DATING_SUB_TABS];
}

export function getDiscoverySubtypeForDatingTab(
  activeSubTab: string,
  viewerDatingIntent?: string | null,
): string | undefined {
  if (activeSubTab === "For You") {
    return isPersonalDatingIntent(viewerDatingIntent) ? viewerDatingIntent! : undefined;
  }
  if (activeSubTab === "Intentional") return "Long Term";
  if (activeSubTab === "Hookup" || activeSubTab === "Curious" || activeSubTab === "Having Fun") {
    return activeSubTab;
  }
  return undefined;
}

export function canUseDailyBoost(isPremium: boolean, lastActivatedDate?: string | null, today?: string): boolean {
  if (!isPremium) return false;
  const todayIso = today ?? new Date().toISOString().slice(0, 10);
  return lastActivatedDate !== todayIso;
}

export type BoostPressDecision =
  | { type: "active" }
  | { type: "paywall"; feature: "boost" }
  | { type: "used-today" }
  | { type: "activate" };

export function getBoostPressDecision({
  isActive,
  isPremium,
  lastActivatedDate,
  today,
}: {
  isActive: boolean;
  isPremium: boolean;
  lastActivatedDate?: string | null;
  today?: string;
}): BoostPressDecision {
  if (isActive) return { type: "active" };
  if (!isPremium) return { type: "paywall", feature: "boost" };
  if (!canUseDailyBoost(isPremium, lastActivatedDate, today)) return { type: "used-today" };
  return { type: "activate" };
}

export function buildWhyWeWouldWorkCopy(
  profile: WhyWorkProfileInput,
  myVibeAnswers?: Partial<RetentionVibeAnswers> | null,
): string {
  const name = firstName(profile.name ?? "them");
  const interests = compact(profile.interests).slice(0, 2);
  const signal = compact(profile.chemistrySignals)[0];
  const promptAnswer = cleanSentence(profile.promptAnswer);
  const dateIdea = cleanSentence(profile.dateIdeas?.[0] ?? profile.firstDateStyle);
  const vibeOverlap = getVibeOverlap(myVibeAnswers, profile.vibeCheck?.answers);

  const firstDetails = [
    interests.length > 0 ? `over ${joinHuman(interests)}` : null,
    signal ? `with ${signal} energy` : null,
    !signal && dateIdea ? `starting with ${dateIdea}` : null,
  ].filter(Boolean);

  if (firstDetails.length === 0 && !promptAnswer && !vibeOverlap) {
    return `You and ${name} both give low-pressure, curious energy, so starting with one simple question should feel natural.`;
  }

  const firstSentence =
    firstDetails.length > 0
      ? `You and ${name} would probably click ${firstDetails.join(", ")}.`
      : `You and ${name} have an easy opening lane${promptAnswer ? ` around "${promptAnswer}"` : ""}.`;

  const secondSentence = vibeOverlap
    ? `Your VibeCheck also lines up on ${vibeOverlap}, so the pace should feel natural instead of forced.`
    : promptAnswer
      ? `Their prompt gives you a natural place to start: "${promptAnswer}".`
      : dateIdea
        ? `A simple invite around ${dateIdea} would make the first move feel specific.`
        : "";

  return secondSentence ? `${firstSentence} ${secondSentence}` : firstSentence;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || "there";
}

function cleanTopic(topic: string): string {
  return cleanSentence(topic).toLowerCase() || "something fun";
}

function cleanSentence(value?: string | null): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function compact(values?: Array<string | null | undefined>): string[] {
  return (values ?? []).map(cleanSentence).filter(Boolean);
}

function joinHuman(values: string[]): string {
  if (values.length <= 1) return values[0] ?? "";
  return `${values[0]} and ${values[1]}`;
}

function getVibeOverlap(
  mine?: Partial<RetentionVibeAnswers> | null,
  theirs?: Partial<RetentionVibeAnswers> | null,
): string | null {
  if (!mine || !theirs) return null;
  const labels: Array<[keyof RetentionVibeAnswers, string]> = [
    ["loveLanguage", "love language"],
    ["energyType", "energy type"],
    ["conflictStyle", "conflict style"],
    ["datePace", "date pace"],
  ];
  const exactMatch = labels.find(([key]) => mine[key] && theirs[key] && mine[key] === theirs[key]);
  if (exactMatch) return exactMatch[1];
  if (
    typeof mine.adventureLevel === "number" &&
    typeof theirs.adventureLevel === "number" &&
    Math.abs(mine.adventureLevel - theirs.adventureLevel) <= 1
  ) {
    return "adventure level";
  }
  return null;
}

function isPersonalDatingIntent(value?: string | null): value is string {
  return value === "Hookup" || value === "Long Term" || value === "Curious" || value === "Having Fun";
}
