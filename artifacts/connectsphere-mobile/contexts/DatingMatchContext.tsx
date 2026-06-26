import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@clerk/clerk-expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";

import { getApp } from "firebase/app";
import { doc, getDoc, getFirestore } from "firebase/firestore";

import { DatingMatchModal } from "@/components/DatingMatchModal";
import type { VibeCheckAnswers } from "@/components/VibeCheckQuiz";
import { useSessionState } from "@/hooks/useSessionState";
import { isDiscoverySwipeLimitError, remainingSwipesFromDiscoveryResult } from "@/lib/discoverySwipeAuthority";
import {
  getDatingReactions,
  getIncomingShots,
  getSentShots,
  respondToReaction as respondToReactionApi,
  respondToShot as respondToShotApi,
  sendShot as sendShotApi,
  type DatingReactionApi,
  type DatingReactionsResponse,
  type DatingShotApi,
  type ReactionRespondAction,
  type ShotRespondAction,
} from "@/services/datingShotsApi";
import {
  customFetch,
  performDiscoveryAction,
  type Match as ApiMatch,
  type Profile as ApiProfile,
} from "@workspace/api-client-react";

export type DatingProfileSnapshot = {
  id: string;
  name: string;
  age?: number | null;
  location?: string | null;
  intent: string;
  photos: string[];
  interests?: string[];
  datingGoal?: string;
  firstDateStyle?: string;
  dateIdeas?: string[];
  prompt?: string;
  promptAnswer?: string;
  openerIdeas?: string[];
  likedCurrentUser?: boolean;
  vibeCheck?: { answers: VibeCheckAnswers; completedAt: string } | null;
};

export type DatingLike = {
  id: string;
  fromUserId: string;
  toUserId: string;
  type: "vibe" | "spark";
  createdAt: string;
};

export type DatingPass = {
  id: string;
  fromUserId: string;
  toUserId: string;
  createdAt: string;
};

export type DatingChatMessage = {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
};

export type DatingChat = {
  id: string;
  participantIds: string[];
  type: "dating_match";
  messages: DatingChatMessage[];
};

export type DatingPlanInput = {
  title: string;
  place?: string;
  time?: string;
  reason?: string;
};

export type DatingPlan = DatingPlanInput & {
  id: string;
  matchId: string;
  chatId: string;
  profile: DatingProfileSnapshot;
  createdAt: string;
  status: "suggested" | "active";
  source?: "local" | "server";
};

export type DatingMatch = {
  id: string;
  userIds: [string, string];
  profile: DatingProfileSnapshot;
  chatId: string;
  createdAt: string;
  /** ISO timestamp when the match hard-expires (from server status endpoint, 7-day window) */
  expiresAt?: string;
  source?: "local" | "server";
  serverMatchId?: string;
};

export type DatingShotStatus = "pending" | "accepted" | "sparked_back" | "ignored";

export type DatingShot = {
  id: string;
  fromUserId: string;
  toUserId: string;
  message: string;
  status: DatingShotStatus;
  createdAt: string;
  respondedAt?: string;
  senderProfile?: DatingProfileSnapshot;
  receiverProfile?: DatingProfileSnapshot;
  source?: "local" | "server";
};

export type DatingReaction = {
  id: string;
  sourceId: string;
  type: "like" | "spark" | "shot";
  createdAt: string;
  locked: boolean;
  displayText: string;
  fromUserId?: string;
  toUserId?: string;
  message?: string;
  senderProfile?: DatingProfileSnapshot;
};

export type SendShotResult = {
  success: boolean;
  shot?: DatingShot;
  match?: DatingMatch;
  chatId?: string;
  remainingShots?: number | null;
  premiumRequired?: boolean;
  error?: string;
};

type Ctx = {
  currentUserId: string;
  likes: DatingLike[];
  passes: DatingPass[];
  matches: DatingMatch[];
  chats: DatingChat[];
  plans: DatingPlan[];
  incomingShots: DatingShot[];
  sentShots: DatingShot[];
  reactions: DatingReaction[];
  reactionCounts: DatingReactionsResponse["counts"];
  reactionsPremiumRequired: boolean;
  premiumPrompt: "shot" | "spark" | null;
  clearPremiumPrompt: () => void;
  serverRemainingSwipes: number | null;
  swipeLimitNoticeId: number;
  clearSwipeLimitNotice: () => void;
  recordVibe: (profile: DatingProfileSnapshot) => DatingMatch | null;
  recordSpark: (profile: DatingProfileSnapshot) => DatingMatch | null;
  recordPass: (profile: DatingProfileSnapshot) => void;
  recordPlan: (profile: DatingProfileSnapshot, plan: DatingPlanInput) => DatingPlan;
  refreshShots: () => Promise<void>;
  refreshReactions: () => Promise<void>;
  sendShot: (profile: DatingProfileSnapshot, message: string) => Promise<SendShotResult>;
  respondToShot: (shotId: string, action: ShotRespondAction) => Promise<SendShotResult>;
  respondToReaction: (reactionId: string, action: ReactionRespondAction, message?: string) => Promise<{ success: boolean; matched?: boolean; premiumRequired?: boolean; error?: string }>;
  hasInteracted: (profileId: string) => boolean;
  getChat: (chatId: string) => DatingChat | undefined;
  sendMessage: (chatId: string, text: string) => void;
};

const DatingMatchCtx = createContext<Ctx | null>(null);

const FREE_SHOTS_PER_DAY = 1;

type ServerDatingPlan = DatingPlanInput & {
  id: string;
  matchId: string;
  chatId: string;
  profile?: ApiProfile & { modeData?: Record<string, unknown> };
  createdAt: string;
  status: "suggested" | "active";
};

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isServerBackedProfile(profile: DatingProfileSnapshot) {
  return profile.id.length > 0 && !profile.id.startsWith("mock_");
}

function authHeaders(token: string | null) {
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function snapshotFromApiProfile(profile?: ApiProfile & { modeData?: Record<string, unknown> }): DatingProfileSnapshot | null {
  if (!profile) return null;
  const modeData = profile.modeData ?? {};
  const photos = profile.photos ?? [];
  return {
    id: profile.userId,
    name: profile.displayName,
    age: profile.age,
    location: profile.location,
    intent: profile.intent,
    photos,
    datingGoal: typeof modeData.datingGoal === "string" ? modeData.datingGoal : profile.connectionSubtype,
    firstDateStyle: typeof modeData.firstDateStyle === "string" ? modeData.firstDateStyle : undefined,
    dateIdeas: typeof modeData.firstDateStyle === "string" ? [modeData.firstDateStyle] : undefined,
    openerIdeas: typeof modeData.firstDateStyle === "string" ? [`Ask ${profile.displayName} about ${modeData.firstDateStyle}.`] : undefined,
  };
}

function matchFromApi(match: ApiMatch, currentUserId: string): DatingMatch | null {
  const profile = snapshotFromApiProfile(match.otherProfile as (ApiProfile & { modeData?: Record<string, unknown> }) | undefined);
  if (!profile) return null;
  return {
    id: `server:${match.id}`,
    userIds: [currentUserId, profile.id],
    profile,
    chatId: match.id,
    serverMatchId: match.id,
    source: "server",
    createdAt: match.matchedAt,
  };
}

function planFromApi(plan: ServerDatingPlan): DatingPlan | null {
  const profile = snapshotFromApiProfile(plan.profile);
  if (!profile) return null;
  return {
    id: `server:${plan.id}`,
    matchId: plan.matchId,
    chatId: plan.chatId,
    profile,
    title: plan.title,
    place: plan.place,
    time: plan.time,
    reason: plan.reason,
    status: plan.status,
    createdAt: plan.createdAt,
    source: "server",
  };
}

function fallbackProfile(userId: string, name = "Someone"): DatingProfileSnapshot {
  return {
    id: userId,
    name,
    intent: "dating",
    photos: [],
  };
}

function shotFromApi(shot: DatingShotApi, fallback?: DatingProfileSnapshot): DatingShot {
  const senderProfile =
    snapshotFromApiProfile(shot.senderProfile as (ApiProfile & { modeData?: Record<string, unknown> }) | undefined) ??
    (fallback?.id === shot.fromUserId ? fallback : undefined);
  const receiverProfile =
    snapshotFromApiProfile(shot.receiverProfile as (ApiProfile & { modeData?: Record<string, unknown> }) | undefined) ??
    (fallback?.id === shot.toUserId ? fallback : undefined);

  return {
    id: shot.id,
    fromUserId: shot.fromUserId,
    toUserId: shot.toUserId,
    message: shot.message,
    status: shot.status,
    createdAt: shot.createdAt,
    respondedAt: shot.respondedAt,
    senderProfile,
    receiverProfile,
    source: "server",
  };
}

function reactionFromApi(reaction: DatingReactionApi): DatingReaction {
  return {
    id: reaction.id,
    sourceId: reaction.sourceId,
    type: reaction.type,
    createdAt: reaction.createdAt,
    locked: reaction.locked,
    displayText: reaction.displayText,
    fromUserId: reaction.fromUserId,
    toUserId: reaction.toUserId,
    message: reaction.message,
    senderProfile: snapshotFromApiProfile(reaction.senderProfile as (ApiProfile & { modeData?: Record<string, unknown> }) | undefined) ?? undefined,
  };
}

function errorMessage(error: unknown) {
  const data = (error as { data?: { error?: string; message?: string } })?.data;
  return data?.error ?? data?.message ?? (error instanceof Error ? error.message : "Something went wrong.");
}

function isPremiumLimit(error: unknown) {
  return (error as { data?: { code?: string; premiumRequired?: boolean } })?.data?.code === "SHOT_LIMIT_REACHED" ||
    (error as { data?: { code?: string; premiumRequired?: boolean } })?.data?.code === "SPARK_LIMIT_REACHED" ||
    (error as { data?: { code?: string; premiumRequired?: boolean } })?.data?.premiumRequired === true;
}

export function DatingMatchProvider({ children }: { children: ReactNode }) {
  const { getToken, isSignedIn } = useAuth();
  const { userId } = useSessionState();
  const queryClient = useQueryClient();
  const currentUserId = userId ?? "";
  const [likes, setLikes] = useState<DatingLike[]>([]);
  const [passes, setPasses] = useState<DatingPass[]>([]);
  const [matches, setMatches] = useState<DatingMatch[]>([]);
  const [chats, setChats] = useState<DatingChat[]>([]);
  const [plans, setPlans] = useState<DatingPlan[]>([]);
  const [incomingShots, setIncomingShots] = useState<DatingShot[]>([]);
  const [sentShots, setSentShots] = useState<DatingShot[]>([]);
  const [reactions, setReactions] = useState<DatingReaction[]>([]);
  const [reactionCounts, setReactionCounts] = useState<DatingReactionsResponse["counts"]>({ total: 0, like: 0, spark: 0, shot: 0 });
  const [reactionsPremiumRequired, setReactionsPremiumRequired] = useState(false);
  const [premiumPrompt, setPremiumPrompt] = useState<"shot" | "spark" | null>(null);
  const [serverRemainingSwipes, setServerRemainingSwipes] = useState<number | null>(null);
  const [swipeLimitNoticeId, setSwipeLimitNoticeId] = useState(0);
  const [localShotUsage, setLocalShotUsage] = useState({ date: todayKey(), count: 0 });
  const [modalMatch, setModalMatch] = useState<DatingMatch | null>(null);
  const [myVibeAnswers, setMyVibeAnswers] = useState<VibeCheckAnswers | null>(null);

  // Load current user's vibe answers once so the match modal can show the breakdown.
  useEffect(() => {
    if (!currentUserId) return;
    try {
      const db = getFirestore(getApp());
      void getDoc(doc(db, "users", currentUserId)).then((snap) => {
        const vibeCheck = (snap.data() as { vibeCheck?: { answers: VibeCheckAnswers } } | undefined)?.vibeCheck;
        if (vibeCheck?.answers) setMyVibeAnswers(vibeCheck.answers);
      });
    } catch {
      // Non-critical — breakdown simply won't render
    }
  }, [currentUserId]);


  const likesRef = useRef(likes);
  likesRef.current = likes;
  const matchesRef = useRef(matches);
  matchesRef.current = matches;
  const incomingShotsRef = useRef(incomingShots);
  incomingShotsRef.current = incomingShots;
  const sentShotsRef = useRef(sentShots);
  sentShotsRef.current = sentShots;
  const reactionsRef = useRef(reactions);
  reactionsRef.current = reactions;

  useEffect(() => {
    if (!isSignedIn || !currentUserId) return;
    let mounted = true;
    (async () => {
      try {
        const token = await getToken();
        const data = await customFetch<{ plans: ServerDatingPlan[] }>("/api/dating/plans", {
          headers: authHeaders(token),
        });
        if (!mounted) return;
        const serverPlans = data.plans.map(planFromApi).filter((plan): plan is DatingPlan => Boolean(plan));
        setPlans((prev) => [...serverPlans, ...prev.filter((plan) => plan.source !== "server")]);
      } catch {}
    })();

    return () => {
      mounted = false;
    };
  }, [currentUserId, getToken, isSignedIn]);

  // ── AsyncStorage persistence ────────────────────────────────────────────────
  // Persist local matches + chats per user so the inbox survives app restarts.
  // Only local-sourced data is saved; server data is always re-fetched fresh.
  const hydratedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!currentUserId) return;
    hydratedRef.current = false;
    void (async () => {
      try {
        const [rawMatches, rawChats] = await Promise.all([
          AsyncStorage.getItem(`cs:dating:matches:${currentUserId}`),
          AsyncStorage.getItem(`cs:dating:chats:${currentUserId}`),
        ]);
        const storedMatches: DatingMatch[] = rawMatches ? JSON.parse(rawMatches) : [];
        const storedChats: DatingChat[] = rawChats ? JSON.parse(rawChats) : [];
        if (storedMatches.length > 0) {
          setMatches((prev) => [
            ...prev,
            ...storedMatches.filter((m) => !prev.some((p) => p.id === m.id)),
          ]);
        }
        if (storedChats.length > 0) {
          setChats((prev) => [
            ...prev,
            ...storedChats.filter((c) => !prev.some((p) => p.id === c.id)),
          ]);
        }
      } catch {
        // Non-critical — inbox starts empty if storage is unavailable
      } finally {
        hydratedRef.current = true;
      }
    })();
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (!hydratedRef.current) return; // don't save before we've loaded
      const localMatches = matches.filter((m) => m.source !== "server");
      const localChatIds = new Set(localMatches.map((m) => m.chatId));
      const localChats = chats.filter((c) => localChatIds.has(c.id));
      void AsyncStorage.setItem(
        `cs:dating:matches:${currentUserId}`,
        JSON.stringify(localMatches),
      );
      void AsyncStorage.setItem(
        `cs:dating:chats:${currentUserId}`,
        JSON.stringify(localChats),
      );
    }, 800);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [currentUserId, matches, chats]);

  // ── DEV mock simulation ────────────────────────────────────────────────────
  // Seeds 1 incoming shot ("Sofia, 22") so the Accept/Decline flow can be
  // tested without a backend.  Guarded by __DEV__ so it never runs in prod.
  useEffect(() => {
    if (!__DEV__ || !currentUserId) return;
    const MOCK_ID = "mock-shot-sofia-001";
    setIncomingShots((prev) => {
      if (prev.some((s) => s.id === MOCK_ID)) return prev; // idempotent
      const mockShot: DatingShot = {
        id: MOCK_ID,
        fromUserId: "mock-user-sofia",
        toUserId: currentUserId,
        message: "Hey! You seem really interesting 👀 let's connect",
        status: "pending",
        createdAt: new Date(Date.now() - 1000 * 60 * 4).toISOString(), // 4 min ago
        source: "local",
        senderProfile: {
          id: "mock-user-sofia",
          name: "Sofia",
          age: 22,
          location: "Brickell, Miami",
          intent: "dating",
          photos: ["https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80"],
          datingGoal: "Something real",
          prompt: "The way to my heart…",
          promptAnswer: "Rooftop views and good conversation",
        },
      };
      return [mockShot, ...prev];
    });
  }, [currentUserId]);

  const refreshShots = useCallback(async () => {
    if (!isSignedIn || !currentUserId) return;
    const token = await getToken();
    const headers = authHeaders(token);
    const [incoming, sent] = await Promise.all([
      getIncomingShots(currentUserId, { headers }),
      getSentShots(currentUserId, { headers }),
    ]);
    setIncomingShots((prev) => [
      ...incoming.shots.map((shot) => shotFromApi(shot)),
      ...prev.filter((shot) => shot.source !== "server"),
    ]);
    setSentShots((prev) => [
      ...sent.shots.map((shot) => shotFromApi(shot)),
      ...prev.filter((shot) => shot.source !== "server"),
    ]);
  }, [currentUserId, getToken, isSignedIn]);

  useEffect(() => {
    refreshShots().catch(() => {});
  }, [refreshShots]);

  const refreshReactions = useCallback(async () => {
    if (!isSignedIn || !currentUserId) return;
    const token = await getToken();
    const result = await getDatingReactions(currentUserId, { headers: authHeaders(token) });
    setReactions(result.reactions.map(reactionFromApi));
    setReactionCounts(result.counts);
    setReactionsPremiumRequired(result.isPremiumRequired);
  }, [currentUserId, getToken, isSignedIn]);

  useEffect(() => {
    refreshReactions().catch(() => {});
  }, [refreshReactions]);

  const hasInteracted = useCallback(
    (profileId: string) => {
      const liked = likesRef.current.some(
        (l) => l.fromUserId === currentUserId && l.toUserId === profileId,
      );
      if (liked) return true;
      return passes.some(
        (p) => p.fromUserId === currentUserId && p.toUserId === profileId,
      );
    },
    [currentUserId, passes],
  );

  const createMatchInternal = useCallback(
    (profile: DatingProfileSnapshot, seedMessages: DatingChatMessage[] = []): DatingMatch => {
      const chatId = makeId();
      const opener =
        profile.openerIdeas?.[0] ??
        (profile.prompt ? `Ask about: ${profile.prompt}` : "Send a quick hello.");
      const newChat: DatingChat = {
        id: chatId,
        participantIds: [currentUserId, profile.id],
        type: "dating_match",
        messages: [
          {
            id: makeId(),
            senderId: "system",
            text: `You matched with ${profile.name}. ${opener}`,
            createdAt: new Date().toISOString(),
          },
          ...seedMessages,
        ],
      };
      const newMatch: DatingMatch = {
        id: makeId(),
        userIds: [currentUserId, profile.id],
        profile,
        chatId,
        source: "local",
        createdAt: new Date().toISOString(),
      };
      setChats((prev) => [...prev, newChat]);
      setMatches((prev) => [...prev, newMatch]);
      return newMatch;
    },
    [currentUserId],
  );

  const ensureMatchInternal = useCallback(
    (profile: DatingProfileSnapshot): DatingMatch => {
      const existing = matchesRef.current.find((m) => m.userIds.includes(profile.id));
      if (existing) return existing;
      return createMatchInternal(profile);
    },
    [createMatchInternal],
  );

  const recordLike = useCallback(
    (profile: DatingProfileSnapshot, type: "vibe" | "spark"): DatingMatch | null => {
      if (!currentUserId) return null;

      const already = likesRef.current.some(
        (l) => l.fromUserId === currentUserId && l.toUserId === profile.id,
      );
      if (already) return null;

      const newLike: DatingLike = {
        id: makeId(),
        fromUserId: currentUserId,
        toUserId: profile.id,
        type,
        createdAt: new Date().toISOString(),
      };
      setLikes((prev) => [...prev, newLike]);

      if (isServerBackedProfile(profile)) {
        getToken()
          .then((token) =>
            performDiscoveryAction(
              {
                targetUserId: profile.id,
                action: type === "spark" ? "superlike" : "like",
              },
              { headers: authHeaders(token) },
            ),
          )
          .then((result) => {
            const remaining = remainingSwipesFromDiscoveryResult(result);
            if (remaining !== null) setServerRemainingSwipes(remaining);
            queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
            if (result.matched && result.match) {
              const serverMatch = matchFromApi(result.match, currentUserId);
              if (serverMatch) setModalMatch(serverMatch);
            }
          })
          .catch((error) => {
            if (isDiscoverySwipeLimitError(error)) {
              setServerRemainingSwipes(0);
              setSwipeLimitNoticeId((value) => value + 1);
            } else if (isPremiumLimit(error)) {
              setPremiumPrompt(type === "spark" ? "spark" : "shot");
            }
          });
        return null;
      }


      const reciprocated =
        profile.likedCurrentUser === true ||
        likesRef.current.some(
          (l) => l.fromUserId === profile.id && l.toUserId === currentUserId,
        );


      const existing = matchesRef.current.find(
        (m) => m.userIds.includes(profile.id),
      );
      if (existing) return null;

      if (reciprocated) {
        const created = createMatchInternal(profile);
        setModalMatch(created);
        return created;
      }
      return null;
    },
    [createMatchInternal, currentUserId, getToken, queryClient],
  );

  const recordVibe = useCallback(
    (profile: DatingProfileSnapshot) => recordLike(profile, "vibe"),
    [recordLike],
  );
  const recordSpark = useCallback(
    (profile: DatingProfileSnapshot) => recordLike(profile, "spark"),
    [recordLike],
  );

  const recordPass = useCallback((profile: DatingProfileSnapshot) => {
    if (!currentUserId) return;
    setPasses((prev) => {
      if (
        prev.some(
          (p) => p.fromUserId === currentUserId && p.toUserId === profile.id,
        )
      ) {
        return prev;
      }
      return [
        ...prev,
        {
          id: makeId(),
          fromUserId: currentUserId,
          toUserId: profile.id,
          createdAt: new Date().toISOString(),
        },
      ];
    });

    if (isServerBackedProfile(profile)) {
      getToken()
        .then((token) =>
          performDiscoveryAction(
            { targetUserId: profile.id, action: "pass" },
            { headers: authHeaders(token) },
          ),
        )
        .then((result) => {
          const remaining = remainingSwipesFromDiscoveryResult(result);
          if (remaining !== null) setServerRemainingSwipes(remaining);
          queryClient.invalidateQueries({ queryKey: ["/api/discovery"] });
        })
        .catch((error) => {
          if (isDiscoverySwipeLimitError(error)) {
            setServerRemainingSwipes(0);
            setSwipeLimitNoticeId((value) => value + 1);
          }
        });
    }
  }, [currentUserId, getToken, queryClient]);

  const recordPlan = useCallback(
    (profile: DatingProfileSnapshot, plan: DatingPlanInput): DatingPlan => {
      if (isServerBackedProfile(profile)) {
        const optimisticPlan: DatingPlan = {
          id: `pending:${makeId()}`,
          matchId: `pending:${profile.id}`,
          chatId: `pending:${profile.id}`,
          profile,
          title: plan.title,
          place: plan.place,
          time: plan.time,
          reason: plan.reason,
          status: "active",
          createdAt: new Date().toISOString(),
          source: "server",
        };
        setPlans((prev) => [optimisticPlan, ...prev]);
        getToken()
          .then((token) =>
            customFetch<{ plan: ServerDatingPlan }>("/api/dating/plans/create", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(authHeaders(token) ?? {}),
              },
              body: JSON.stringify({
                targetUserId: profile.id,
                title: plan.title,
                place: plan.place,
                time: plan.time,
                reason: plan.reason,
              }),
            }),
          )
          .then((result) => {
            const serverPlan = planFromApi(result.plan);
            if (serverPlan) {
              setPlans((prev) => [serverPlan, ...prev.filter((item) => item.id !== optimisticPlan.id)]);
            }
            queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
          })
          .catch(() => {});
        return optimisticPlan;
      }

      const match = ensureMatchInternal(profile);
      const createdAt = new Date().toISOString();
      const newPlan: DatingPlan = {
        id: makeId(),
        matchId: match.id,
        chatId: match.chatId,
        profile,
        title: plan.title,
        place: plan.place,
        time: plan.time,
        reason: plan.reason,
        status: "active",
        createdAt,
        source: "local",
      };
      setPlans((prev) => [newPlan, ...prev]);
      setChats((prev) =>
        prev.map((c) =>
          c.id === match.chatId
            ? {
                ...c,
                messages: [
                  ...c.messages,
                  {
                    id: makeId(),
                    senderId: currentUserId,
                    text: `Date idea: ${plan.title}${plan.place ? ` at ${plan.place}` : ""}${plan.time ? ` ${plan.time}` : ""}`,
                    createdAt,
                  },
                  ...(plan.reason
                    ? [
                        {
                          id: makeId(),
                          senderId: "system",
                          text: plan.reason,
                          createdAt,
                        },
                      ]
                    : []),
                ],
              }
            : c,
        ),
      );
      return newPlan;
    },
    [currentUserId, ensureMatchInternal, getToken, queryClient],
  );

  const sendShot = useCallback(
    async (profile: DatingProfileSnapshot, message: string): Promise<SendShotResult> => {
      const text = message.trim();
      if (!currentUserId) return { success: false, error: "Sign in again to send a Shot." };
      if (!text) return { success: false, error: "Write a Shot first." };
      if (text.length > 120) return { success: false, error: "Shots are limited to 120 characters." };

      const duplicate = sentShotsRef.current.find(
        (shot) => shot.toUserId === profile.id && shot.status === "pending",
      );
      if (duplicate) {
        return { success: false, shot: duplicate, error: "You already have a pending Shot with this person." };
      }

      if (isServerBackedProfile(profile)) {
        try {
          const token = await getToken();
          const result = await sendShotApi(currentUserId, profile.id, text, {
            headers: authHeaders(token),
          });
          const shot = shotFromApi(result.shot, profile);
          setSentShots((prev) => [shot, ...prev.filter((item) => item.id !== shot.id)]);
          refreshReactions().catch(() => {});
          return { success: true, shot, remainingShots: result.remainingShots };
        } catch (error) {
          if (isPremiumLimit(error)) setPremiumPrompt("shot");
          return {
            success: false,
            premiumRequired: isPremiumLimit(error),
            error: errorMessage(error),
          };
        }
      }

      const date = todayKey();
      const normalizedUsage = localShotUsage.date === date ? localShotUsage : { date, count: 0 };
      if (normalizedUsage.count >= FREE_SHOTS_PER_DAY) {
        setLocalShotUsage(normalizedUsage);
        setPremiumPrompt("shot");
        return {
          success: false,
          premiumRequired: true,
          remainingShots: 0,
          error: "You used your free Shot today.",
        };
      }

      const shot: DatingShot = {
        id: makeId(),
        fromUserId: currentUserId,
        toUserId: profile.id,
        message: text,
        status: "pending",
        createdAt: new Date().toISOString(),
        receiverProfile: profile,
        source: "local",
      };
      setLocalShotUsage({ date, count: normalizedUsage.count + 1 });
      setSentShots((prev) => [shot, ...prev]);
      return { success: true, shot, remainingShots: FREE_SHOTS_PER_DAY - (normalizedUsage.count + 1) };
    },
    [currentUserId, getToken, localShotUsage, refreshReactions],
  );

  const respondToShot = useCallback(
    async (shotId: string, action: ShotRespondAction): Promise<SendShotResult> => {
      const shot = incomingShotsRef.current.find((item) => item.id === shotId);
      if (!shot) return { success: false, error: "Shot not found." };

      if (shot.source === "server") {
        try {
          const token = await getToken();
          const result = await respondToShotApi(shotId, currentUserId, action, {
            headers: authHeaders(token),
          });
          const updated = shotFromApi(result.shot, shot.senderProfile);
          setIncomingShots((prev) => prev.map((item) => (item.id === shotId ? updated : item)).filter((item) => item.status === "pending"));
          queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
          if (result.match) {
            const match = matchFromApi(result.match, currentUserId);
            if (match) setMatches((prev) => [match, ...prev.filter((item) => item.serverMatchId !== match.serverMatchId)]);
            return { success: true, shot: updated, match: match ?? undefined, chatId: result.chatId ?? result.chat?.id ?? result.match.chatId ?? result.match.id };
          }
          return { success: true, shot: updated, chatId: result.chatId ?? result.chat?.id };
        } catch (error) {
          return { success: false, error: errorMessage(error) };
        }
      }

      const respondedAt = new Date().toISOString();
      const nextStatus: DatingShotStatus =
        action === "ignore" ? "ignored" : action === "spark_back" ? "sparked_back" : "accepted";
      const updated: DatingShot = { ...shot, status: nextStatus, respondedAt };
      setIncomingShots((prev) => prev.map((item) => (item.id === shotId ? updated : item)).filter((item) => item.status === "pending"));

      let createdMatch: DatingMatch | undefined;
      if (action !== "ignore") {
        const sender = shot.senderProfile ?? fallbackProfile(shot.fromUserId);
        const seedMessages: DatingChatMessage[] = [
          {
            id: `shot-${shot.id}`,
            senderId: shot.fromUserId,
            text: shot.message,
            createdAt: shot.createdAt,
          },
          ...(action === "spark_back"
            ? [
                {
                  id: makeId(),
                  senderId: "system",
                  text: "Sparked back ⚡",
                  createdAt: respondedAt,
                },
              ]
            : []),
        ];
        createdMatch = createMatchInternal(sender, seedMessages);
        setModalMatch(createdMatch);
      }

      return { success: true, shot: updated, chatId: createdMatch?.chatId, match: createdMatch };
    },
    [createMatchInternal, currentUserId, getToken, queryClient],
  );

  const respondToReaction = useCallback(
    async (reactionId: string, action: ReactionRespondAction, message?: string) => {
      const reaction = reactionsRef.current.find((item) => item.id === reactionId);
      if (!reaction) return { success: false, error: "Reaction not found." };
      if (reaction.locked) return { success: false, premiumRequired: true, error: "Unlock ConnectSphere Plus to reveal reactions." };

      try {
        const token = await getToken();
        const result = await respondToReactionApi(reactionId, currentUserId, action, message, {
          headers: authHeaders(token),
        });
        setReactions((prev) => prev.filter((item) => item.id !== reactionId));
        setReactionCounts((prev) => ({
          total: Math.max(0, prev.total - 1),
          like: reaction.type === "like" ? Math.max(0, prev.like - 1) : prev.like,
          spark: reaction.type === "spark" ? Math.max(0, prev.spark - 1) : prev.spark,
          shot: reaction.type === "shot" ? Math.max(0, prev.shot - 1) : prev.shot,
        }));
        refreshShots().catch(() => {});
        queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
        if (result.match) {
          const match = matchFromApi(result.match, currentUserId);
          if (match) {
            setMatches((prev) => [match, ...prev.filter((item) => item.serverMatchId !== match.serverMatchId)]);
            setModalMatch(match);
          }
        }
        return { success: true, matched: result.matched };
      } catch (error) {
        return {
          success: false,
          premiumRequired: isPremiumLimit(error),
          error: errorMessage(error),
        };
      }
    },
    [currentUserId, getToken, queryClient, refreshShots],
  );

  const getChat = useCallback(
    (chatId: string) => chats.find((c) => c.id === chatId),
    [chats],
  );

  const sendMessage = useCallback((chatId: string, text: string) => {
    if (!currentUserId) return;
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId
          ? {
              ...c,
              messages: [
                ...c.messages,
                {
                  id: makeId(),
                  senderId: currentUserId,
                  text,
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : c,
      ),
    );
  }, [currentUserId]);

  const value = useMemo<Ctx>(
    () => ({
      currentUserId,
      likes,
      passes,
      matches,
      chats,
      plans,
      incomingShots,
      sentShots,
      reactions,
      reactionCounts,
      reactionsPremiumRequired,
      premiumPrompt,
      clearPremiumPrompt: () => setPremiumPrompt(null),
      serverRemainingSwipes,
      swipeLimitNoticeId,
      clearSwipeLimitNotice: () => setSwipeLimitNoticeId(0),
      recordVibe,
      recordSpark,
      recordPass,
      recordPlan,
      refreshShots,
      refreshReactions,
      sendShot,
      respondToShot,
      respondToReaction,
      hasInteracted,
      getChat,
      sendMessage,
    }),
    [
      currentUserId,
      likes,
      passes,
      matches,
      chats,
      plans,
      incomingShots,
      sentShots,
      reactions,
      reactionCounts,
      reactionsPremiumRequired,
      premiumPrompt,
      serverRemainingSwipes,
      swipeLimitNoticeId,
      recordVibe,
      recordSpark,
      recordPass,
      recordPlan,
      refreshShots,
      refreshReactions,
      sendShot,
      respondToShot,
      respondToReaction,
      hasInteracted,
      getChat,
      sendMessage,
    ],
  );

  return (
    <DatingMatchCtx.Provider value={value}>
      {children}
      {modalMatch && (
        <DatingMatchModal
          match={modalMatch}
          onClose={() => setModalMatch(null)}
          myVibeAnswers={myVibeAnswers ?? undefined}
          theirVibeAnswers={modalMatch.profile.vibeCheck?.answers ?? undefined}
        />
      )}
    </DatingMatchCtx.Provider>
  );
}

export function useDatingMatches(): Ctx {
  const ctx = useContext(DatingMatchCtx);
  if (!ctx) throw new Error("useDatingMatches must be used inside DatingMatchProvider");
  return ctx;
}
