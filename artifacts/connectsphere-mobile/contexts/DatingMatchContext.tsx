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
import { useQueryClient } from "@tanstack/react-query";

import { DatingMatchModal } from "@/components/DatingMatchModal";
import {
  getIncomingShots,
  getSentShots,
  respondToShot as respondToShotApi,
  sendShot as sendShotApi,
  type DatingShotApi,
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
  datingGoal?: string;
  firstDateStyle?: string;
  dateIdeas?: string[];
  prompt?: string;
  promptAnswer?: string;
  openerIdeas?: string[];
  likedCurrentUser?: boolean;
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

export type SendShotResult = {
  success: boolean;
  shot?: DatingShot;
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
  recordVibe: (profile: DatingProfileSnapshot) => DatingMatch | null;
  recordSpark: (profile: DatingProfileSnapshot) => DatingMatch | null;
  recordPass: (profile: DatingProfileSnapshot) => void;
  recordPlan: (profile: DatingProfileSnapshot, plan: DatingPlanInput) => DatingPlan;
  refreshShots: () => Promise<void>;
  sendShot: (profile: DatingProfileSnapshot, message: string) => Promise<SendShotResult>;
  respondToShot: (shotId: string, action: ShotRespondAction) => Promise<SendShotResult>;
  hasInteracted: (profileId: string) => boolean;
  getChat: (chatId: string) => DatingChat | undefined;
  sendMessage: (chatId: string, text: string) => void;
};

const DatingMatchCtx = createContext<Ctx | null>(null);

const CURRENT_USER_ID = "user_self";
const FREE_SHOTS_PER_DAY = 3;

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

function matchFromApi(match: ApiMatch): DatingMatch | null {
  const profile = snapshotFromApiProfile(match.otherProfile as (ApiProfile & { modeData?: Record<string, unknown> }) | undefined);
  if (!profile) return null;
  return {
    id: `server:${match.id}`,
    userIds: [CURRENT_USER_ID, profile.id],
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

function errorMessage(error: unknown) {
  const data = (error as { data?: { error?: string; message?: string } })?.data;
  return data?.error ?? data?.message ?? (error instanceof Error ? error.message : "Something went wrong.");
}

function isPremiumLimit(error: unknown) {
  return (error as { data?: { code?: string; premiumRequired?: boolean } })?.data?.code === "SHOT_LIMIT_REACHED" ||
    (error as { data?: { code?: string; premiumRequired?: boolean } })?.data?.premiumRequired === true;
}

export function DatingMatchProvider({ children }: { children: ReactNode }) {
  const { getToken, isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const [likes, setLikes] = useState<DatingLike[]>([]);
  const [passes, setPasses] = useState<DatingPass[]>([]);
  const [matches, setMatches] = useState<DatingMatch[]>([]);
  const [chats, setChats] = useState<DatingChat[]>([]);
  const [plans, setPlans] = useState<DatingPlan[]>([]);
  const [incomingShots, setIncomingShots] = useState<DatingShot[]>([]);
  const [sentShots, setSentShots] = useState<DatingShot[]>([]);
  const [localShotUsage, setLocalShotUsage] = useState({ date: todayKey(), count: 0 });
  const [modalMatch, setModalMatch] = useState<DatingMatch | null>(null);


  const likesRef = useRef(likes);
  likesRef.current = likes;
  const matchesRef = useRef(matches);
  matchesRef.current = matches;
  const incomingShotsRef = useRef(incomingShots);
  incomingShotsRef.current = incomingShots;
  const sentShotsRef = useRef(sentShots);
  sentShotsRef.current = sentShots;

  useEffect(() => {
    if (!isSignedIn) return;
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
  }, [getToken, isSignedIn]);

  const refreshShots = useCallback(async () => {
    if (!isSignedIn) return;
    const token = await getToken();
    const headers = authHeaders(token);
    const [incoming, sent] = await Promise.all([
      getIncomingShots(CURRENT_USER_ID, { headers }),
      getSentShots(CURRENT_USER_ID, { headers }),
    ]);
    setIncomingShots((prev) => [
      ...incoming.shots.map((shot) => shotFromApi(shot)),
      ...prev.filter((shot) => shot.source !== "server"),
    ]);
    setSentShots((prev) => [
      ...sent.shots.map((shot) => shotFromApi(shot)),
      ...prev.filter((shot) => shot.source !== "server"),
    ]);
  }, [getToken, isSignedIn]);

  useEffect(() => {
    refreshShots().catch(() => {});
  }, [refreshShots]);

  const hasInteracted = useCallback(
    (profileId: string) => {
      const liked = likesRef.current.some(
        (l) => l.fromUserId === CURRENT_USER_ID && l.toUserId === profileId,
      );
      if (liked) return true;
      return passes.some(
        (p) => p.fromUserId === CURRENT_USER_ID && p.toUserId === profileId,
      );
    },
    [passes],
  );

  const createMatchInternal = useCallback(
    (profile: DatingProfileSnapshot, seedMessages: DatingChatMessage[] = []): DatingMatch => {
      const chatId = makeId();
      const opener =
        profile.openerIdeas?.[0] ??
        (profile.prompt ? `Ask about: ${profile.prompt}` : "Send a quick hello.");
      const newChat: DatingChat = {
        id: chatId,
        participantIds: [CURRENT_USER_ID, profile.id],
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
        userIds: [CURRENT_USER_ID, profile.id],
        profile,
        chatId,
        source: "local",
        createdAt: new Date().toISOString(),
      };
      setChats((prev) => [...prev, newChat]);
      setMatches((prev) => [...prev, newMatch]);
      return newMatch;
    },
    [],
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

      const already = likesRef.current.some(
        (l) => l.fromUserId === CURRENT_USER_ID && l.toUserId === profile.id,
      );
      if (already) return null;

      const newLike: DatingLike = {
        id: makeId(),
        fromUserId: CURRENT_USER_ID,
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
            queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
            if (result.matched && result.match) {
              const serverMatch = matchFromApi(result.match);
              if (serverMatch) setModalMatch(serverMatch);
            }
          })
          .catch(() => {});
        return null;
      }


      const reciprocated =
        profile.likedCurrentUser === true ||
        likesRef.current.some(
          (l) => l.fromUserId === profile.id && l.toUserId === CURRENT_USER_ID,
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
    [createMatchInternal, getToken, queryClient],
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
    setPasses((prev) => {
      if (
        prev.some(
          (p) => p.fromUserId === CURRENT_USER_ID && p.toUserId === profile.id,
        )
      ) {
        return prev;
      }
      return [
        ...prev,
        {
          id: makeId(),
          fromUserId: CURRENT_USER_ID,
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
        .then(() => queryClient.invalidateQueries({ queryKey: ["/api/discovery"] }))
        .catch(() => {});
    }
  }, [getToken, queryClient]);

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
                    senderId: CURRENT_USER_ID,
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
    [ensureMatchInternal, getToken, queryClient],
  );

  const sendShot = useCallback(
    async (profile: DatingProfileSnapshot, message: string): Promise<SendShotResult> => {
      const text = message.trim();
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
          const result = await sendShotApi(CURRENT_USER_ID, profile.id, text, {
            headers: authHeaders(token),
          });
          const shot = shotFromApi(result.shot, profile);
          setSentShots((prev) => [shot, ...prev.filter((item) => item.id !== shot.id)]);
          return { success: true, shot, remainingShots: result.remainingShots };
        } catch (error) {
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
        return {
          success: false,
          premiumRequired: true,
          remainingShots: 0,
          error: "You used your 3 free Shots today.",
        };
      }

      const shot: DatingShot = {
        id: makeId(),
        fromUserId: CURRENT_USER_ID,
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
    [getToken, localShotUsage],
  );

  const respondToShot = useCallback(
    async (shotId: string, action: ShotRespondAction): Promise<SendShotResult> => {
      const shot = incomingShotsRef.current.find((item) => item.id === shotId);
      if (!shot) return { success: false, error: "Shot not found." };

      if (shot.source === "server") {
        try {
          const token = await getToken();
          const result = await respondToShotApi(shotId, CURRENT_USER_ID, action, {
            headers: authHeaders(token),
          });
          const updated = shotFromApi(result.shot, shot.senderProfile);
          setIncomingShots((prev) => prev.map((item) => (item.id === shotId ? updated : item)).filter((item) => item.status === "pending"));
          queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
          if (result.match) {
            const match = matchFromApi(result.match);
            if (match) setMatches((prev) => [match, ...prev.filter((item) => item.serverMatchId !== match.serverMatchId)]);
          }
          return { success: true, shot: updated };
        } catch (error) {
          return { success: false, error: errorMessage(error) };
        }
      }

      const respondedAt = new Date().toISOString();
      const nextStatus: DatingShotStatus =
        action === "ignore" ? "ignored" : action === "spark_back" ? "sparked_back" : "accepted";
      const updated: DatingShot = { ...shot, status: nextStatus, respondedAt };
      setIncomingShots((prev) => prev.map((item) => (item.id === shotId ? updated : item)).filter((item) => item.status === "pending"));

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
        const match = createMatchInternal(sender, seedMessages);
        setModalMatch(match);
      }

      return { success: true, shot: updated };
    },
    [createMatchInternal, getToken, queryClient],
  );

  const getChat = useCallback(
    (chatId: string) => chats.find((c) => c.id === chatId),
    [chats],
  );

  const sendMessage = useCallback((chatId: string, text: string) => {
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId
          ? {
              ...c,
              messages: [
                ...c.messages,
                {
                  id: makeId(),
                  senderId: CURRENT_USER_ID,
                  text,
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : c,
      ),
    );
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      currentUserId: CURRENT_USER_ID,
      likes,
      passes,
      matches,
      chats,
      plans,
      incomingShots,
      sentShots,
      recordVibe,
      recordSpark,
      recordPass,
      recordPlan,
      refreshShots,
      sendShot,
      respondToShot,
      hasInteracted,
      getChat,
      sendMessage,
    }),
    [
      likes,
      passes,
      matches,
      chats,
      plans,
      incomingShots,
      sentShots,
      recordVibe,
      recordSpark,
      recordPass,
      recordPlan,
      refreshShots,
      sendShot,
      respondToShot,
      hasInteracted,
      getChat,
      sendMessage,
    ],
  );

  return (
    <DatingMatchCtx.Provider value={value}>
      {children}
      <DatingMatchModal
        match={modalMatch}
        onClose={() => setModalMatch(null)}
      />
    </DatingMatchCtx.Provider>
  );
}

export function useDatingMatches(): Ctx {
  const ctx = useContext(DatingMatchCtx);
  if (!ctx) {
    throw new Error("useDatingMatches must be used inside <DatingMatchProvider>");
  }
  return ctx;
}

