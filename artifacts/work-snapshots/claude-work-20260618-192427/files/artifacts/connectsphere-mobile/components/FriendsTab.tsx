import { useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  connectLabel,
  firstName,
  personLocation,
  planVenue,
  planWhen,
  titleTag,
} from "@/components/friends/friendsLabels";
import FriendSignalsRow from "@/components/friends/FriendSignalsRow";
import JoinedBurst from "@/components/friends/JoinedBurst";
import { useSessionState } from "@/hooks/useSessionState";
import { openConnectChat } from "@/lib/routes";
import PendingInboxSection from "@/components/friends/PendingInboxSection";
import PlansHubSection from "@/components/friends/PlansHubSection";
import TodayCommandCenter from "@/components/friends/TodayCommandCenter";
import { selectTodayCommand, type TodayCommand } from "@/components/friends/friendsMissionControl";
import {
  blockFriendUser,
  cancelFriendRequest,
  cancelPlanJoinRequest,
  createFriendPlan,
  generateFriendIcebreakers,
  getFriendPeople,
  getFriendPlans,
  getFriendPlansFeed,
  getFriendRequests,
  getFriendStories,
  reportFriendUser,
  requestJoinFriendPlan,
  reactToFriendStory,
  replyToFriendStory,
  respondPlanJoinRequest,
  respondFriendRequest,
  sendFriendIcebreaker,
  sendFriendRequest,
  sharePlanLink,
  type FriendIcebreakerInput,
  type FriendIcebreakerSuggestion,
  type FriendPerson,
  type FriendPlan,
  type FriendRequest,
  type FriendStory,
} from "@/services/friendsApi";
import CreateFriendPlanSheet from "@/components/CreateFriendPlanSheet";

type FriendsTabProps = {
  bottomInset?: number;
};

type FriendsView = "people" | "requests" | "plans";
type PlanSourceTab = "map" | "event";
type IcebreakerTarget =
  | { title: string; subtitle?: string; input: FriendIcebreakerInput }
  | null;
const FRIENDS_PINK = "#ff2da8";
const FRIENDS_BLACK = "#000000";
const FRIENDS_TEXT = "#f4f4f5";
const FRIENDS_MUTED = "#a1a1aa";
const APP_SHARE_URL = "https://connectsphere.app";

const FALLBACK_PHOTO =
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=85";

function openConnectThread(chatId?: string) {
  if (!chatId) return;
  openConnectChat(chatId);
}

function shareOut(message: string, url = APP_SHARE_URL) {
  return Share.share({ message: `${message}\n${url}` });
}

function uniqueTags(values: Array<string | undefined | false | null>) {
  return Array.from(new Set(values.filter(Boolean).map((value) => titleTag(String(value)))));
}

function personProfileLine(person: FriendPerson) {
  const interests = (person.interests ?? []).map(titleTag).filter(Boolean);
  const topInterests = interests.slice(0, 3).join(", ");
  if (topInterests) {
    return `${firstName(person.name)} is ${person.energy?.toLowerCase() ?? "ready for plans"} around ${personLocation(person)}. Into ${topInterests}.`;
  }
  return `${firstName(person.name)} is ${person.energy?.toLowerCase() ?? "ready for plans"} around ${personLocation(person)}.`;
}

function seededCount(seed: string, min: number, max: number) {
  const chars = seed.split("");
  const hash = chars.reduce((total, char, index) => total + char.charCodeAt(0) * (index + 7), 0);
  return min + (hash % Math.max(1, max - min + 1));
}

function planPeopleCount(plan: FriendPlan) {
  const actual = plan.peopleGoing ?? plan.members?.length ?? 1;
  return Math.max(actual, seededCount(plan.id, 5, 18));
}

function planIsLive(plan: FriendPlan) {
  const time = new Date(plan.scheduledAt ?? plan.createdAt).getTime();
  if (!Number.isFinite(time)) return false;
  const diff = time - Date.now();
  return diff > -90 * 60 * 1000 && diff < 6 * 60 * 60 * 1000;
}

function planSocialLabel(plan: FriendPlan) {
  if (planIsLive(plan)) return "Live now";
  return `${planPeopleCount(plan)} going`;
}

function planInterestLabel(plan: FriendPlan) {
  return `${planPeopleCount(plan) + seededCount(`${plan.id}-watch`, 3, 11)} interested`;
}

function planWhatLine(plan: FriendPlan) {
  const type = titleTag(plan.type || plan.sourceType || "plan");
  return `${type} at ${planVenue(plan)}. Meet there, use the plan thread in Connect, and keep the details in one place.`;
}

function bestNextMove(person: FriendPerson) {
  if (person.relationshipStatus === "friends") return "Message in Connect";
  if (person.relationshipStatus === "requested") return "Wait for their reply";
  if (person.relationshipStatus === "incoming") return "Accept and say hi";
  if (person.suggestedPlanType) return `Invite to ${person.suggestedPlanType.toLowerCase()}`;
  const interests = (person.sharedInterests?.length ? person.sharedInterests : person.interests ?? []).map((item) => item.toLowerCase());
  if (interests.some((item) => item.includes("coffee"))) return "Invite to coffee";
  if (person.activeTonight || (person.energy ?? "").toLowerCase().includes("plan")) return "Plan something tonight";
  return "Start with a low-pressure plan";
}

function matchScore(person: FriendPerson) {
  const score = person.compatibility?.score ?? seededCount(person.id, 52, 91);
  return Math.max(52, Math.min(98, Math.round(score)));
}

function smartReason(person: FriendPerson) {
  return person.smartReason ?? person.compatibility?.signals?.slice(0, 2).join(" • ") ?? "Good local fit";
}

function buttonLabel(label: string, busy: boolean) {
  return busy ? "..." : label;
}

function successHaptic() {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export default function FriendsTab({ bottomInset = 0 }: FriendsTabProps) {
  const { user } = useUser();
  const { userId: sessionUserId } = useSessionState();
  const userId = sessionUserId ?? user?.id ?? "";

  const [activeTab, setActiveTab] = useState<FriendsView>("people");
  const [search, setSearch] = useState("");
  const [people, setPeople] = useState<FriendPerson[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [plans, setPlans] = useState<FriendPlan[]>([]);
  const [planFeed, setPlanFeed] = useState<FriendPlan[]>([]);
  const [stories, setStories] = useState<FriendStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeActions, setActiveActions] = useState<string[]>([]);
  const activeActionsRef = useRef(new Set<string>());
  const loadSeqRef = useRef(0);

  const [planSheetOpen, setPlanSheetOpen] = useState(false);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [planSourceTab, setPlanSourceTab] = useState<PlanSourceTab>("event");
  const [planInviteIds, setPlanInviteIds] = useState<string[]>([]);
  const [planInitialTitle, setPlanInitialTitle] = useState("");
  const [planTargetPerson, setPlanTargetPerson] = useState<FriendPerson | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<FriendPerson | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<FriendPlan | null>(null);
  const [joinedBurst, setJoinedBurst] = useState<{ plan: FriendPlan; chatId?: string } | null>(null);
  const [icebreakerTarget, setIcebreakerTarget] = useState<IcebreakerTarget>(null);
  const [icebreakerSuggestions, setIcebreakerSuggestions] = useState<FriendIcebreakerSuggestion[]>([]);
  const [icebreakerText, setIcebreakerText] = useState("");
  const [icebreakerLoading, setIcebreakerLoading] = useState(false);
  const [icebreakerSending, setIcebreakerSending] = useState(false);
  const [icebreakerError, setIcebreakerError] = useState("");

  const friends = useMemo(() => people.filter((person) => person.relationshipStatus === "friends"), [people]);
  const smartPick = useMemo(
    () => people.find((person) => person.relationshipStatus === "incoming") ?? people.find((person) => person.relationshipStatus === "none") ?? people[0],
    [people],
  );
  const todayCommand: TodayCommand = useMemo(
    () => selectTodayCommand({ people, requests, plans, planFeed, stories }),
    [people, requests, plans, planFeed, stories],
  );
  const pendingCount = requests.length;

  const isActing = useCallback((key: string) => activeActionsRef.current.has(key) || activeActions.includes(key), [activeActions]);
  const beginAction = useCallback((key: string) => {
    if (activeActionsRef.current.has(key)) return false;
    activeActionsRef.current.add(key);
    setActiveActions((current) => (current.includes(key) ? current : [...current, key]));
    return true;
  }, []);
  const endAction = useCallback((key: string) => {
    activeActionsRef.current.delete(key);
    setActiveActions((current) => current.filter((item) => item !== key));
  }, []);

  const loadFriends = useCallback(async () => {
    if (!userId) {
      setPeople([]);
      setRequests([]);
      setPlans([]);
      setPlanFeed([]);
      setStories([]);
      setLoading(false);
      return;
    }
    const sequence = loadSeqRef.current + 1;
    loadSeqRef.current = sequence;
    setLoading(true);
    setLoadError("");
    try {
      const [peopleResult, requestResult, planResult, feedResult, storiesResult] = await Promise.all([
        getFriendPeople(userId, search),
        getFriendRequests(userId),
        getFriendPlans(userId),
        getFriendPlansFeed(userId),
        getFriendStories(userId).catch(() => ({ stories: [] })),
      ]);
      if (sequence !== loadSeqRef.current) return;
      setPeople(peopleResult.people ?? []);
      setRequests(requestResult.requests ?? []);
      setPlans(planResult.plans ?? []);
      setPlanFeed(feedResult.plans ?? []);
      setStories(storiesResult.stories ?? []);
    } catch {
      if (sequence !== loadSeqRef.current) return;
      setLoadError("Friends could not load. Check the API server and try again.");
    } finally {
      if (sequence === loadSeqRef.current) {
        setLoading(false);
      }
    }
  }, [search, userId]);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  useFocusEffect(
    useCallback(() => {
      loadFriends();
    }, [loadFriends]),
  );

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(""), 2400);
  }, []);

  const loadIcebreakers = useCallback(async (target: Exclude<IcebreakerTarget, null>) => {
    setIcebreakerLoading(true);
    setIcebreakerError("");
    try {
      const result = await generateFriendIcebreakers(target.input);
      const suggestions = result.suggestions ?? [];
      setIcebreakerSuggestions(suggestions);
      setIcebreakerText(suggestions[0]?.text ?? "");
    } catch {
      setIcebreakerError("Could not generate ideas. Try again in a second.");
      setIcebreakerSuggestions([]);
      setIcebreakerText("");
    } finally {
      setIcebreakerLoading(false);
    }
  }, []);

  const openIcebreaker = useCallback(
    (target: Exclude<IcebreakerTarget, null>) => {
      setIcebreakerTarget(target);
      setIcebreakerSuggestions([]);
      setIcebreakerText("");
      void loadIcebreakers(target);
    },
    [loadIcebreakers],
  );

  const sendIcebreaker = useCallback(async () => {
    if (!icebreakerTarget || !icebreakerText.trim()) return;
    setIcebreakerSending(true);
    setIcebreakerError("");
    try {
      const result = await sendFriendIcebreaker({ ...icebreakerTarget.input, text: icebreakerText.trim() });
      setIcebreakerTarget(null);
      setIcebreakerSuggestions([]);
      setIcebreakerText("");
      await loadFriends();
      successHaptic();
      if (result.chat?.id) {
        showNotice("Sent in Connect.");
        openConnectThread(result.chat.id);
      } else {
        showNotice("Icebreaker sent.");
        setActiveTab("requests");
      }
    } catch {
      setIcebreakerError("Could not send that icebreaker.");
    } finally {
      setIcebreakerSending(false);
    }
  }, [icebreakerTarget, icebreakerText, loadFriends, showNotice]);

  const handleConnect = useCallback(
    async (person: FriendPerson) => {
      if (person.relationshipStatus === "requested") return;
      const key = `connect:${person.id}`;
      if (!beginAction(key)) return;
      const previousPeople = people;
      const previousRequests = requests;
      try {
        if (person.relationshipStatus === "friends") {
          if (person.chatId) openConnectThread(person.chatId);
          return;
        }
        if (person.relationshipStatus === "incoming" && person.requestId) {
          setRequests((current) => current.filter((request) => request.id !== person.requestId));
          setPeople((current) =>
            current.map((item) => (item.id === person.id ? { ...item, relationshipStatus: "friends" as const } : item)),
          );
          const result = await respondFriendRequest(person.requestId, "accept");
          successHaptic();
          showNotice("They'll see you in Connect.");
          if (result.chat?.id) openConnectThread(result.chat.id);
        } else {
          const optimisticRequest: FriendRequest = {
            id: `optimistic-${person.id}`,
            fromUserId: userId,
            toUserId: person.id,
            direction: "outgoing",
            status: "pending",
            kind: "friend",
            createdAt: new Date().toISOString(),
            fromUser: { id: userId, name: user?.fullName ?? "You", relationshipStatus: "self" },
            toUser: { ...person, relationshipStatus: "requested" },
            sharedInterests: person.sharedInterests,
          };
          setPeople((current) =>
            current.map((item) =>
              item.id === person.id ? { ...item, relationshipStatus: "requested" as const, requestId: optimisticRequest.id } : item,
            ),
          );
          setRequests((current) => [optimisticRequest, ...current]);
          const result = await sendFriendRequest(userId, person.id);
          if (result.relationshipStatus === "friends" && result.chat?.id) {
            // Mutual match or already-friends — flip optimistic state and jump to Connect.
            setPeople((current) =>
              current.map((item) =>
                item.id === person.id ? { ...item, relationshipStatus: "friends" as const, chatId: result.chat?.id } : item,
              ),
            );
            setRequests((current) => current.filter((request) => request.id !== optimisticRequest.id));
            successHaptic();
            showNotice(`It's mutual with ${firstName(person.name)}. Say hi.`);
            openConnectThread(result.chat.id);
          } else {
            showNotice(`Request sent to ${firstName(person.name)}.`);
            setActiveTab("requests");
          }
        }
        await loadFriends();
      } catch {
        setPeople(previousPeople);
        setRequests(previousRequests);
        showNotice("Could not update this connection.");
      } finally {
        endAction(key);
      }
    },
    [beginAction, endAction, loadFriends, people, requests, showNotice, user, userId],
  );

  const handleRequest = useCallback(
    async (request: FriendRequest, action: "accept" | "ignore") => {
      const key = `request:${action}:${request.id}`;
      if (!beginAction(key)) return;
      const previousPeople = people;
      const previousRequests = requests;
      const previousPlans = plans;
      try {
        setRequests((current) => current.filter((item) => item.id !== request.id));
        if (request.requestType === "plan_join" || request.kind === "plan_join") {
          const result = await respondPlanJoinRequest(request.id, userId, action === "accept" ? "accept" : "decline");
          if (action === "accept") {
            setPlans((current) => current.map((plan) => (plan.id === request.plan?.id && result.plan ? result.plan : plan)));
            successHaptic();
            showNotice("You're in. Plan thread is in Connect.");
            if (result.chat?.id) openConnectThread(result.chat.id);
          } else {
            showNotice("Plan request declined.");
          }
        } else {
          const result = await respondFriendRequest(request.id, action);
          if (action === "accept") {
            const friendId = request.fromUserId === userId ? request.toUserId : request.fromUserId;
            setPeople((current) =>
              current.map((person) => (person.id === friendId ? { ...person, relationshipStatus: "friends" as const } : person)),
            );
            successHaptic();
            showNotice("They'll see you in Connect.");
            if (result.chat?.id) openConnectThread(result.chat.id);
          } else {
            showNotice("Request ignored.");
          }
        }
        await loadFriends();
      } catch {
        setPeople(previousPeople);
        setRequests(previousRequests);
        setPlans(previousPlans);
        showNotice("Could not update that request.");
      } finally {
        endAction(key);
      }
    },
    [beginAction, endAction, loadFriends, people, plans, requests, showNotice, userId],
  );

  const handleCancelRequest = useCallback(
    async (request: FriendRequest) => {
      const key = `cancel:${request.id}`;
      if (!beginAction(key)) return;
      const previousPeople = people;
      const previousRequests = requests;
      const previousPlanFeed = planFeed;
      try {
        setRequests((current) => current.filter((item) => item.id !== request.id));
        if (request.requestType === "plan_join" || request.kind === "plan_join") {
          const planId = request.plan?.id ?? request.planId;
          setPlanFeed((current) =>
            current.map((plan) =>
              plan.id === planId ? { ...plan, joinRequestStatus: null, joinRequestId: undefined } : plan,
            ),
          );
          await cancelPlanJoinRequest(request.id, userId);
          showNotice("Join request canceled.");
        } else {
          const otherUserId = request.toUserId === userId ? request.fromUserId : request.toUserId;
          setPeople((current) =>
            current.map((person) =>
              person.id === otherUserId ? { ...person, relationshipStatus: "none" as const, requestId: undefined } : person,
            ),
          );
          await cancelFriendRequest(request.id, userId);
          showNotice("Friend request canceled.");
        }
        await loadFriends();
      } catch {
        setPeople(previousPeople);
        setRequests(previousRequests);
        setPlanFeed(previousPlanFeed);
        showNotice("Could not cancel that request.");
      } finally {
        endAction(key);
      }
    },
    [beginAction, endAction, loadFriends, people, planFeed, requests, showNotice, userId],
  );

  const openCreatePlan = useCallback((sourceTab: PlanSourceTab = "event") => {
    setPlusMenuOpen(false);
    setPlanTargetPerson(null);
    setPlanInviteIds([]);
    setPlanInitialTitle("");
    setPlanSourceTab(sourceTab);
    setPlanSheetOpen(true);
  }, []);

  const openPlanForPerson = useCallback((person: FriendPerson) => {
    setPlusMenuOpen(false);
    setPlanTargetPerson(person);
    setPlanInviteIds([person.id]);
    const type = person.suggestedPlanType ?? "Plan";
    setPlanInitialTitle(`${type} with ${firstName(person.name)}`);
    setPlanSourceTab("event");
    setPlanSheetOpen(true);
  }, []);

  const closePlanSheet = useCallback(() => {
    setPlanSheetOpen(false);
    setPlanTargetPerson(null);
    setPlanInviteIds([]);
    setPlanInitialTitle("");
  }, []);

  const handlePlanCreated = useCallback(
    (result: Awaited<ReturnType<typeof createFriendPlan>>) => {
      void (async () => {
        try {
          if (planTargetPerson && planTargetPerson.relationshipStatus !== "friends") {
            await sendFriendRequest(userId, planTargetPerson.id, {
              kind: "plan_invite",
              planId: result.plan.id,
              message: `Plan invite: ${result.plan.title}`,
            });
            showNotice(`Plan invite sent to ${firstName(planTargetPerson.name)}.`);
          } else {
            successHaptic();
            showNotice("Plan's live. Opening Connect...");
          }
          await loadFriends();
          setActiveTab("plans");
          openConnectThread(result.chat?.id);
        } catch {
          showNotice("Plan was created, but the invite could not be sent.");
        } finally {
          setPlanTargetPerson(null);
          setPlanInviteIds([]);
          setPlanInitialTitle("");
        }
      })();
    },
    [loadFriends, planTargetPerson, showNotice, userId],
  );

  const handleInviteFriends = useCallback(async () => {
    setPlusMenuOpen(false);
    try {
      await shareOut("Join me on ConnectSphere. Find people, make plans, and meet up around Miami.");
    } catch {
      showNotice("Could not open the share sheet.");
    }
  }, [showNotice]);

  const openFindDuoBuddy = useCallback(() => {
    setPlusMenuOpen(false);
    router.push({ pathname: "/(tabs)", params: { intent: "dating", subtab: "Double Dates" } } as never);
  }, []);

  const openCreateGroup = useCallback(() => {
    setPlusMenuOpen(false);
    setPlanTargetPerson(null);
    setPlanInviteIds(friends.slice(0, 3).map((friend) => friend.id));
    setPlanInitialTitle("Friend group plan");
    setPlanSourceTab("event");
    setPlanSheetOpen(true);
  }, [friends]);

  const handleRequestJoinPlan = useCallback(
    async (plan: FriendPlan) => {
      if (plan.joinRequestStatus === "pending") return;
      const key = `join:${plan.id}`;
      if (!beginAction(key)) return;
      const previousPlanFeed = planFeed;
      try {
        setPlanFeed((current) =>
          current.map((item) =>
            item.id === plan.id ? { ...item, joinRequestStatus: "pending" as const, joinRequestId: item.joinRequestId ?? `optimistic-${plan.id}` } : item,
          ),
        );
        const result = await requestJoinFriendPlan(userId, plan.id);
        if (result.status === "joined") {
          successHaptic();
          await loadFriends();
          // Fire the celebration; routing to Connect happens when the burst dismisses.
          setJoinedBurst({ plan: result.plan ?? plan, chatId: result.chat?.id });
        } else {
          showNotice("Request sent to the creator.");
          await loadFriends();
        }
      } catch {
        setPlanFeed(previousPlanFeed);
        showNotice("Could not request to join.");
      } finally {
        endAction(key);
      }
    },
    [beginAction, endAction, loadFriends, planFeed, showNotice, userId],
  );

  const handleBlockPerson = useCallback(
    async (person: FriendPerson) => {
      const key = `block:${person.id}`;
      if (!beginAction(key)) return;
      const previousPeople = people;
      const previousRequests = requests;
      const previousPlans = plans;
      const previousPlanFeed = planFeed;
      setSelectedPerson(null);
      try {
        setPeople((current) => current.filter((item) => item.id !== person.id));
        setRequests((current) => current.filter((request) => request.fromUserId !== person.id && request.toUserId !== person.id));
        setPlans((current) => current.filter((plan) => (plan.creatorId ?? plan.creatorUserId) !== person.id));
        setPlanFeed((current) => current.filter((plan) => (plan.creatorId ?? plan.creatorUserId) !== person.id));
        await blockFriendUser(userId, person.id);
        showNotice(`${firstName(person.name)} is blocked.`);
        await loadFriends();
      } catch {
        setPeople(previousPeople);
        setRequests(previousRequests);
        setPlans(previousPlans);
        setPlanFeed(previousPlanFeed);
        showNotice("Could not block this person.");
      } finally {
        endAction(key);
      }
    },
    [beginAction, endAction, loadFriends, people, planFeed, plans, requests, showNotice, userId],
  );

  const handleReportPerson = useCallback(
    async (person: FriendPerson) => {
      const key = `report:${person.id}`;
      if (!beginAction(key)) return;
      try {
        await reportFriendUser(userId, person.id, { reason: "profile_review", context: "friends_profile" });
        showNotice("Thanks. We saved your report.");
      } catch {
        showNotice("Could not send that report.");
      } finally {
        endAction(key);
      }
    },
    [beginAction, endAction, showNotice, userId],
  );

  const handleSharePlan = useCallback(
    async (plan: FriendPlan) => {
      const whenLabel = plan.timeLabel ?? plan.time ?? "soon";
      const placeLabel = plan.sourceName ?? plan.location ?? "Miami";
      try {
        // Mint (or reuse) a tokenized share link the recipient can tap to
        // jump straight into the plan + group chat — anyone with the link
        // can RSVP, no friend gate.
        const link = await sharePlanLink(plan.id, userId);
        const message = `Join my ConnectSphere plan: ${plan.title}\n${whenLabel} · ${placeLabel}`;
        await shareOut(message, link.url);
      } catch {
        // Fallback: link mint failed (offline, server down) — share without it.
        try {
          await shareOut(`Join my ConnectSphere plan: ${plan.title} at ${whenLabel} near ${placeLabel}.`);
        } catch {
          showNotice("Could not open the share sheet.");
        }
      }
    },
    [showNotice, userId],
  );

  const handleTodayPrimary = useCallback(
    (command: TodayCommand) => {
      if (command.kind === "request") {
        setActiveTab("requests");
        return;
      }
      if (command.kind === "plan") {
        if (command.plan.chatId && (command.plan.isMember || command.plan.isCreator)) {
          openConnectThread(command.plan.chatId);
        } else {
          setSelectedPlan(command.plan);
        }
        return;
      }
      if (command.kind === "person") {
        handleConnect(command.person);
        return;
      }
      if (command.kind === "signal") {
        setActiveTab("people");
        return;
      }
      openCreatePlan();
    },
    [handleConnect, openCreatePlan],
  );

  const handleTodaySecondary = useCallback(
    (command: TodayCommand) => {
      if (command.kind === "person") {
        openPlanForPerson(command.person);
      }
      if (command.kind === "plan") {
        handleSharePlan(command.plan);
      }
    },
    [handleSharePlan, openPlanForPerson],
  );

  const handleSignalReact = useCallback(
    async (story: FriendStory) => {
      const key = `signal:react:${story.id}`;
      if (!beginAction(key)) return;
      try {
        await reactToFriendStory(userId, story.id, "spark");
        successHaptic();
        showNotice("Signal sparked.");
        await loadFriends();
      } catch {
        showNotice("Could not react to that signal.");
      } finally {
        endAction(key);
      }
    },
    [beginAction, endAction, loadFriends, showNotice, userId],
  );

  const handleSignalReply = useCallback(
    async (story: FriendStory) => {
      const key = `signal:reply:${story.id}`;
      if (!beginAction(key)) return;
      try {
        const result = await replyToFriendStory(userId, story.id, "I'm down. Want to make a plan?");
        await loadFriends();
        if (result.chat?.id) {
          successHaptic();
          showNotice("Reply sent in Connect.");
          openConnectThread(result.chat.id);
        } else {
          showNotice("Reply sent as a request.");
          setActiveTab("requests");
        }
      } catch {
        showNotice("Could not reply to that signal.");
      } finally {
        endAction(key);
      }
    },
    [beginAction, endAction, loadFriends, showNotice, userId],
  );

  const handleSignalPlan = useCallback(
    (story: FriendStory) => {
      const key = `signal:plan:${story.id}`;
      if (!beginAction(key)) return;
      if (story.user) {
        openPlanForPerson(story.user);
      } else {
        openCreatePlan();
      }
      setTimeout(() => endAction(key), 300);
    },
    [beginAction, endAction, openCreatePlan, openPlanForPerson],
  );

  const renderPeople = (showEmpty = true) => {
    if (loading) return <LoadingState />;
    if (!people.length) {
      return showEmpty ? (
        <EmptyState
          title="No people yet"
          text="Try another interest, invite someone in, or check back soon."
          actionLabel="Invite People"
          onAction={handleInviteFriends}
        />
      ) : null;
    }
    return (
      <View style={styles.stack}>
        {smartPick ? (
          <Pressable onPress={() => setSelectedPerson(smartPick)} style={styles.smartPickCard}>
            <View style={styles.smartPickIcon}>
              <Ionicons name="sparkles" size={18} color="#0A0A0B" />
            </View>
            <View style={styles.smartPickCopy}>
              <Text style={styles.smartPickLabel}>Smart pick</Text>
              <Text style={styles.smartPickTitle} numberOfLines={1}>{firstName(smartPick.name)} • {matchScore(smartPick)}% fit</Text>
              <Text style={styles.smartPickText} numberOfLines={2}>
                {smartReason(smartPick)}. {bestNextMove(smartPick)}.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={19} color="#FFB6D9" />
          </Pressable>
        ) : null}
        {people.map((person) => (
          <Pressable key={person.id} onPress={() => setSelectedPerson(person)} style={styles.personCard}>
            <Image source={{ uri: person.photoUrl ?? FALLBACK_PHOTO }} style={styles.avatar} contentFit="cover" />
            <View style={styles.personMain}>
              <View style={styles.nameRow}>
                <Text style={styles.personName} numberOfLines={1}>
                  {person.name}
                  {person.age ? `, ${person.age}` : ""}
                </Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>{person.statusBadge ?? "Looking for Plans"}</Text>
                </View>
                <View style={styles.matchBadge}>
                  <Ionicons name="sparkles" size={11} color="#0A0A0B" />
                  <Text style={styles.matchBadgeText}>{matchScore(person)}%</Text>
                </View>
              </View>
              <Text style={styles.personCity}>{person.location ?? person.city ?? "Miami"}</Text>
              <View style={styles.smartReasonRow}>
                <Ionicons name="bulb-outline" size={13} color="#FF8BC4" />
                <Text style={styles.smartReasonText} numberOfLines={2}>{smartReason(person)}</Text>
              </View>
              <View style={styles.interestRow}>
                {(person.interests ?? []).slice(0, 3).map((interest) => (
                  <View key={interest} style={styles.interestChip}>
                    <Text style={styles.interestText}>{interest}</Text>
                  </View>
                ))}
              </View>
              {person.suggestedPlanType ? (
                <View style={styles.suggestedPlanPill}>
                  <Ionicons name="calendar-outline" size={13} color="#FFB6D9" />
                  <Text style={styles.suggestedPlanText} numberOfLines={1}>
                    {person.suggestedPlanType}: {person.suggestedPlanReason ?? "Easy first plan"}
                  </Text>
                </View>
              ) : null}
              <View style={styles.profileCue}>
                <Ionicons name="sparkles" size={13} color="#FF8BC4" />
                <Text style={styles.profileCueText}>Tap to see profile</Text>
                <Ionicons name="chevron-forward" size={13} color="#FF8BC4" />
              </View>
              <View style={styles.buttonRow}>
                <Pressable
                  onPress={(event) => {
                    event.stopPropagation();
                    handleConnect(person);
                  }}
                  style={[styles.primaryButton, (person.relationshipStatus === "requested" || isActing(`connect:${person.id}`)) && styles.disabledButton]}
                  disabled={person.relationshipStatus === "requested" || isActing(`connect:${person.id}`)}
                >
                  <Text style={styles.primaryButtonText}>{buttonLabel(connectLabel(person), isActing(`connect:${person.id}`))}</Text>
                </Pressable>
                <Pressable
                  onPress={(event) => {
                    event.stopPropagation();
                    openPlanForPerson(person);
                  }}
                  style={[styles.secondaryButton, isActing(`plan:${person.id}`) && styles.disabledButton]}
                  disabled={isActing(`plan:${person.id}`)}
                >
                  <Text style={styles.secondaryButtonText}>{buttonLabel("Plan", isActing(`plan:${person.id}`))}</Text>
                </Pressable>
                <Pressable
                  onPress={(event) => {
                    event.stopPropagation();
                    openIcebreaker({
                      title: `Break the ice with ${firstName(person.name)}`,
                      subtitle: personProfileLine(person),
                      input: { userId, kind: "person", targetUserId: person.id },
                    });
                  }}
                  style={styles.aiButton}
                >
                  <Ionicons name="sparkles" size={14} color="#0A0A0B" />
                  <Text style={styles.aiButtonText}>AI</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    );
  };

  const renderRequests = (showEmpty = true) => {
    if (loading) return <LoadingState />;
    if (!requests.length && !showEmpty) return null;
    return (
      <PendingInboxSection
        requests={requests}
        isActing={isActing}
        onOpenProfile={(request) => {
          const outgoing = request.direction === "outgoing";
          const displayUser = outgoing ? request.toUser ?? request.fromUser : request.fromUser;
          if (displayUser) setSelectedPerson(displayUser);
        }}
        onAccept={(request) => handleRequest(request, "accept")}
        onIgnore={(request) => handleRequest(request, "ignore")}
        onCancel={handleCancelRequest}
        onIcebreaker={(request) => {
          const outgoing = request.direction === "outgoing";
          const displayUser = outgoing ? request.toUser ?? request.fromUser : request.fromUser;
          openIcebreaker({
            title: `Reply to ${firstName(displayUser?.name)}`,
            subtitle: request.message ?? request.plan?.title ?? "Keep it simple and friendly.",
            input: {
              userId,
              kind: "request",
              requestId: request.id,
              targetUserId: displayUser?.id,
              planId: request.plan?.id ?? request.planId,
            },
          });
        }}
        onFindPeople={() => setActiveTab("people")}
      />
    );
  };

  const renderPlans = (showEmpty = true) => {
    if (loading) return <LoadingState />;
    if (!showEmpty && !plans.length && !planFeed.length) return null;
    return (
      <PlansHubSection
        plans={plans}
        planFeed={planFeed}
        isActing={isActing}
        onCreatePlan={() => openCreatePlan()}
        onOpenPlan={setSelectedPlan}
        onJoinPlan={handleRequestJoinPlan}
        onOpenConnect={(plan) => openConnectThread(plan.chatId)}
        onSharePlan={handleSharePlan}
      />
    );
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset + 30 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topBar}>
          <View>
            <Text style={styles.title}>Friends</Text>
            <Text style={styles.subtitle}>Invite, connect, plan.</Text>
          </View>
          <Pressable onPress={() => setPlusMenuOpen(true)} style={styles.headerButton}>
            <Ionicons name="add" size={22} color="#0A0A0B" />
          </Pressable>
        </View>

        <CreateFirstPanel
          onCreatePlan={() => openCreatePlan()}
          onInviteFriend={handleInviteFriends}
          onCreateGroup={openCreateGroup}
          onFindDuoBuddy={openFindDuoBuddy}
        />

        {!loading ? (
          <TonightsPeople
            people={people}
            onOpenPerson={setSelectedPerson}
            onPlanForPerson={openPlanForPerson}
            onFindDuoBuddy={openFindDuoBuddy}
          />
        ) : null}

        {!loading ? (
          <TodayCommandCenter command={todayCommand} onPrimary={handleTodayPrimary} onSecondary={handleTodaySecondary} />
        ) : null}

        {!loading ? (
          <FriendSignalsRow
            stories={stories}
            onReact={handleSignalReact}
            onReply={handleSignalReply}
            onPlan={handleSignalPlan}
            onIcebreaker={(story) =>
              openIcebreaker({
                title: `Reply to ${firstName(story.user?.name)}`,
                subtitle: story.text ?? "Turn this signal into a simple plan.",
                input: { userId, kind: "story", storyId: story.id, targetUserId: story.userId },
              })
            }
            isBusy={(story, action) => isActing(`signal:${action}:${story.id}`)}
          />
        ) : null}

        <View style={styles.searchBox}>
          <Ionicons name="search" size={17} color="#8E8E99" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search people or interests..."
            placeholderTextColor="#777783"
            style={styles.searchInput}
          />
        </View>

        <View style={styles.tabs}>
          {(["people", "requests", "plans"] as FriendsView[]).map((tab) => (
            <Pressable key={tab} onPress={() => setActiveTab(tab)} style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}>
              <View style={styles.tabContent}>
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab === "people" ? "People" : tab === "requests" ? "Pending" : "Plans"}
                </Text>
                {tab === "requests" && pendingCount > 0 ? (
                  <View style={[styles.tabBadge, activeTab === tab && styles.tabBadgeActive]}>
                    <Text style={[styles.tabBadgeText, activeTab === tab && styles.tabBadgeTextActive]}>{pendingCount}</Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>

        {loadError && !loading ? (
          <EmptyState title="Could not load Friends" text={loadError} actionLabel="Retry" onAction={loadFriends} />
        ) : loading ? (
          <LoadingState />
        ) : activeTab === "people" ? (
          renderPeople()
        ) : activeTab === "requests" ? (
          renderRequests()
        ) : (
          renderPlans()
        )}
      </ScrollView>

      {notice ? (
        <View pointerEvents="none" style={styles.noticeOverlay}>
          <View style={[styles.notice, { marginBottom: bottomInset + 18 }]}>
            <View style={styles.noticeIcon}>
              <Ionicons name="checkmark" size={24} color="#0A0A0B" />
            </View>
            <Text style={styles.noticeTitle}>Done</Text>
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        </View>
      ) : null}

      <Modal transparent visible={plusMenuOpen} animationType="fade" onRequestClose={() => setPlusMenuOpen(false)}>
        <Pressable style={styles.plusOverlay} onPress={() => setPlusMenuOpen(false)}>
          <Pressable style={styles.plusMenu} onPress={(event) => event.stopPropagation()}>
            <View style={styles.plusMenuHeader}>
              <View>
                <Text style={styles.plusTitle}>Make something happen</Text>
                <Text style={styles.plusSubtitle}>Plans, invites, groups, or a duo buddy.</Text>
              </View>
              <Pressable onPress={() => setPlusMenuOpen(false)} style={styles.plusClose}>
                <Ionicons name="close" size={18} color="#FFFFFF" />
              </Pressable>
            </View>
            <PlusAction icon="calendar" title="Create Plan" text="Pick a place, time, and invite people." onPress={() => openCreatePlan("event")} />
            <PlusAction icon="share-social" title="Invite Friend" text="Share ConnectSphere outside the app." onPress={handleInviteFriends} />
            <PlusAction icon="people" title="Create Group" text="Start a small friend group around a plan." onPress={openCreateGroup} />
            <PlusAction icon="heart" title="Find a Duo Buddy" text="Jump to Dating > Double Dates." onPress={openFindDuoBuddy} />
          </Pressable>
        </Pressable>
      </Modal>

      <JoinedBurst
        visible={!!joinedBurst}
        planTitle={joinedBurst?.plan.title}
        whenLabel={joinedBurst?.plan.timeLabel ?? joinedBurst?.plan.time}
        locationLabel={joinedBurst?.plan.location ?? joinedBurst?.plan.sourceName}
        ctaLabel={joinedBurst?.chatId ? "open the chat" : undefined}
        onCtaPress={() => {
          const chatId = joinedBurst?.chatId;
          setJoinedBurst(null);
          if (chatId) openConnectThread(chatId);
        }}
        onDismiss={() => {
          const chatId = joinedBurst?.chatId;
          setJoinedBurst(null);
          if (chatId) openConnectThread(chatId);
        }}
      />

      <IcebreakerSheet
        visible={!!icebreakerTarget}
        title={icebreakerTarget?.title ?? "AI Icebreaker"}
        subtitle={icebreakerTarget?.subtitle}
        suggestions={icebreakerSuggestions}
        text={icebreakerText}
        loading={icebreakerLoading}
        sending={icebreakerSending}
        error={icebreakerError}
        bottomInset={bottomInset}
        onChangeText={setIcebreakerText}
        onPick={(text) => setIcebreakerText(text)}
        onRegenerate={() => {
          if (icebreakerTarget) void loadIcebreakers(icebreakerTarget);
        }}
        onSend={sendIcebreaker}
        onClose={() => {
          setIcebreakerTarget(null);
          setIcebreakerError("");
        }}
      />

      <CreateFriendPlanSheet
        visible={planSheetOpen}
        userId={userId}
        friends={friends}
        initialSourceTab={planSourceTab}
        initialInviteIds={planInviteIds}
        initialTitle={planInitialTitle}
        onClose={closePlanSheet}
        onCreated={handlePlanCreated}
      />

      <Modal visible={!!selectedPerson} animationType="slide" onRequestClose={() => setSelectedPerson(null)}>
        {selectedPerson ? (
          <FriendProfileSheet
            person={selectedPerson}
            connectLabel={connectLabel(selectedPerson)}
            connectBusy={isActing(`connect:${selectedPerson.id}`)}
            reportBusy={isActing(`report:${selectedPerson.id}`)}
            blockBusy={isActing(`block:${selectedPerson.id}`)}
            onClose={() => setSelectedPerson(null)}
            onConnect={() => {
              const person = selectedPerson;
              setSelectedPerson(null);
              handleConnect(person);
            }}
            onIcebreaker={() => {
              const person = selectedPerson;
              setSelectedPerson(null);
              openIcebreaker({
                title: `Break the ice with ${firstName(person.name)}`,
                subtitle: personProfileLine(person),
                input: { userId, kind: "person", targetUserId: person.id },
              });
            }}
            onPlan={() => {
              const person = selectedPerson;
              setSelectedPerson(null);
              openPlanForPerson(person);
            }}
            onReport={() => handleReportPerson(selectedPerson)}
            onBlock={() => handleBlockPerson(selectedPerson)}
          />
        ) : null}
      </Modal>

      <Modal transparent visible={!!selectedPlan} animationType="slide" onRequestClose={() => setSelectedPlan(null)}>
        {selectedPlan ? (
          <PlanDetailSheet
            plan={selectedPlan}
            bottomInset={bottomInset}
            joinBusy={isActing(`join:${selectedPlan.id}`)}
            onClose={() => setSelectedPlan(null)}
            onOpenConnect={() => {
              const chatId = selectedPlan.chatId;
              setSelectedPlan(null);
              openConnectThread(chatId);
            }}
            onShare={() => handleSharePlan(selectedPlan)}
            onIcebreaker={() =>
              openIcebreaker({
                title: selectedPlan.title,
                subtitle: planWhatLine(selectedPlan),
                input: { userId, kind: "plan", planId: selectedPlan.id },
              })
            }
            onJoin={() => handleRequestJoinPlan(selectedPlan)}
          />
        ) : null}
      </Modal>

      <Modal transparent visible={false} animationType="fade" onRequestClose={() => setSelectedPerson(null)}>
        <Pressable style={styles.profileOverlay} onPress={() => setSelectedPerson(null)}>
          {selectedPerson ? (
            <Pressable style={styles.profileCard} onPress={(event) => event.stopPropagation()}>
              <View style={styles.profileImageWrap}>
                <Image source={{ uri: selectedPerson.photoUrl ?? FALLBACK_PHOTO }} style={styles.profileImage} contentFit="cover" />
                <Pressable onPress={() => setSelectedPerson(null)} style={styles.profileClose}>
                  <Ionicons name="close" size={18} color="#FFFFFF" />
                </Pressable>
              </View>
              <View style={styles.profileBody}>
                <View style={styles.profileNameRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.profileName} numberOfLines={1}>
                      {selectedPerson.name}
                      {selectedPerson.age ? `, ${selectedPerson.age}` : ""}
                    </Text>
                    <Text style={styles.profileMeta} numberOfLines={1}>
                      {selectedPerson.location ?? selectedPerson.neighborhood ?? selectedPerson.city ?? "Miami"}
                    </Text>
                  </View>
                  <View style={styles.profileStatusBadge}>
                    <Text style={styles.profileStatusText}>{selectedPerson.statusBadge ?? selectedPerson.energy ?? "Open to plans"}</Text>
                  </View>
                </View>

                <View style={styles.profileSection}>
                  <Text style={styles.profileSectionTitle}>Interests</Text>
                  <View style={styles.interestRow}>
                    {(selectedPerson.interests?.length ? selectedPerson.interests : ["Plans", "Friends", "Miami"]).slice(0, 6).map((interest) => (
                      <View key={interest} style={styles.interestChip}>
                        <Text style={styles.interestText}>{interest}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {selectedPerson.sharedInterests?.length ? (
                  <View style={styles.profileSection}>
                    <Text style={styles.profileSectionTitle}>Why they fit</Text>
                    <Text style={styles.profileCopy}>{selectedPerson.sharedInterests.slice(0, 3).join(" · ")}</Text>
                  </View>
                ) : (
                  <Text style={styles.profileCopy}>Send a request, then keep the conversation in Connect.</Text>
                )}

                <View style={styles.profileActions}>
                  <Pressable
                    onPress={() => {
                      const person = selectedPerson;
                      setSelectedPerson(null);
                      handleConnect(person);
                    }}
                    style={[styles.primaryButton, selectedPerson.relationshipStatus === "requested" && styles.disabledButton]}
                    disabled={selectedPerson.relationshipStatus === "requested"}
                  >
                    <Text style={styles.primaryButtonText}>{connectLabel(selectedPerson)}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      const person = selectedPerson;
                      setSelectedPerson(null);
                      openPlanForPerson(person);
                    }}
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryButtonText}>Make Plan</Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>

    </View>
  );
}

function IcebreakerSheet({
  visible,
  title,
  subtitle,
  suggestions,
  text,
  loading,
  sending,
  error,
  bottomInset,
  onChangeText,
  onPick,
  onRegenerate,
  onSend,
  onClose,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  suggestions: FriendIcebreakerSuggestion[];
  text: string;
  loading: boolean;
  sending: boolean;
  error: string;
  bottomInset: number;
  onChangeText: (value: string) => void;
  onPick: (value: string) => void;
  onRegenerate: () => void;
  onSend: () => void;
  onClose: () => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.iceOverlay} onPress={onClose}>
        <Pressable style={[styles.iceSheet, { paddingBottom: bottomInset + 20 }]} onPress={(event) => event.stopPropagation()}>
          <View style={styles.iceHandle} />
          <View style={styles.iceHeader}>
            <View style={styles.iceIcon}>
              <Ionicons name="sparkles" size={20} color="#0A0A0B" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.iceTitle}>{title}</Text>
              {subtitle ? <Text style={styles.iceSubtitle} numberOfLines={2}>{subtitle}</Text> : null}
            </View>
            <Pressable onPress={onClose} style={styles.iceClose}>
              <Ionicons name="close" size={18} color="#FFFFFF" />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.iceLoading}>
              <ActivityIndicator color="#FF8BC4" />
              <Text style={styles.iceLoadingText}>Writing easy openers...</Text>
            </View>
          ) : (
            <View style={styles.iceSuggestionStack}>
              {suggestions.map((item) => (
                <Pressable key={item.id} onPress={() => onPick(item.text)} style={[styles.iceSuggestion, text === item.text && styles.iceSuggestionActive]}>
                  <Text style={styles.iceSuggestionText}>{item.text}</Text>
                  <Text style={styles.iceSuggestionReason}>{item.reason}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <TextInput
            value={text}
            onChangeText={onChangeText}
            placeholder="Edit your icebreaker..."
            placeholderTextColor="#777783"
            multiline
            maxLength={180}
            style={styles.iceInput}
          />
          {error ? <Text style={styles.iceError}>{error}</Text> : null}

          <View style={styles.iceActions}>
            <Pressable onPress={onRegenerate} disabled={loading || sending} style={[styles.iceSecondary, (loading || sending) && styles.disabledButton]}>
              <Ionicons name="refresh" size={17} color="#FFFFFF" />
              <Text style={styles.iceSecondaryText}>Regenerate</Text>
            </Pressable>
            <Pressable onPress={onSend} disabled={!text.trim() || loading || sending} style={[styles.icePrimary, (!text.trim() || loading || sending) && styles.disabledButton]}>
              <Text style={styles.icePrimaryText}>{sending ? "Sending..." : "Send in Connect"}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function FriendProfileSheet({
  person,
  connectLabel,
  connectBusy,
  reportBusy,
  blockBusy,
  onClose,
  onConnect,
  onIcebreaker,
  onPlan,
  onReport,
  onBlock,
}: {
  person: FriendPerson;
  connectLabel: string;
  connectBusy: boolean;
  reportBusy: boolean;
  blockBusy: boolean;
  onClose: () => void;
  onConnect: () => void;
  onIcebreaker: () => void;
  onPlan: () => void;
  onReport: () => void;
  onBlock: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [safetyOpen, setSafetyOpen] = useState(false);
  const bottomPad = Math.max(insets.bottom, 8) + 8;
  const location = personLocation(person);
  const interests = uniqueTags(person.interests?.length ? person.interests : ["plans", "friends", "miami"]);
  const sharedInterests = uniqueTags(person.sharedInterests ?? []);
  const planStyle = uniqueTags(person.activityStyle?.length ? person.activityStyle : [person.energy ?? "ready for plans"]);
  const comfort = uniqueTags([
    ...(person.safety ?? []),
    ...(person.accessibility ?? []),
    person.familyFriendly ? "family friendly" : null,
    person.lgbtqFriendly ? "lgbtq friendly" : null,
  ]);
  const mutualConnections = uniqueTags(person.mutualConnections ?? []);
  const primaryDisabled = person.relationshipStatus === "requested";

  return (
    <View style={styles.profileScreen}>
      <ScrollView
        style={styles.profileScroll}
        contentContainerStyle={[styles.profileScrollContent, { paddingBottom: bottomPad + 112 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileHero}>
          <Image source={{ uri: person.photoUrl ?? FALLBACK_PHOTO }} style={styles.profileHeroImage} contentFit="cover" />
          <LinearGradient
            colors={["rgba(0,0,0,0.04)", "rgba(0,0,0,0.34)", FRIENDS_BLACK]}
            locations={[0, 0.56, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.profileTopButtons, { top: insets.top + 12 }]}>
            <Pressable onPress={onClose} style={styles.profileIconButton}>
              <Ionicons name="close" size={25} color="#FFFFFF" />
            </Pressable>
            <View style={styles.profileTopRight}>
              <View style={styles.profileHeroPill}>
                <Ionicons name="people" size={14} color="#FF8BC4" />
                <Text style={styles.profileHeroPillText}>Friends</Text>
              </View>
              <Pressable onPress={() => setSafetyOpen((current) => !current)} style={styles.profileIconButton}>
                <Ionicons name="ellipsis-horizontal" size={24} color="#FFFFFF" />
              </Pressable>
            </View>
            {safetyOpen ? (
              <View style={styles.safetyMenu}>
                <Pressable
                  onPress={() => {
                    setSafetyOpen(false);
                    onReport();
                  }}
                  style={[styles.safetyAction, reportBusy && styles.disabledButton]}
                  disabled={reportBusy}
                >
                  <Ionicons name="flag-outline" size={17} color="#FFFFFF" />
                  <Text style={styles.safetyActionText}>{buttonLabel("Report", reportBusy)}</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setSafetyOpen(false);
                    onBlock();
                  }}
                  style={[styles.safetyAction, styles.safetyActionDanger, blockBusy && styles.disabledButton]}
                  disabled={blockBusy}
                >
                  <Ionicons name="ban-outline" size={17} color="#FFFFFF" />
                  <Text style={styles.safetyActionText}>{buttonLabel("Block", blockBusy)}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          <View style={styles.profileHeroBottom}>
            <View style={styles.profileBadgeRow}>
              <View style={styles.profileStatusBadge}>
                <Text style={styles.profileStatusText}>{person.statusBadge ?? person.energy ?? "Open to plans"}</Text>
              </View>
              {person.activeTonight ? (
                <View style={styles.profileLiveBadge}>
                  <View style={styles.profileLiveDot} />
                  <Text style={styles.profileLiveText}>Active tonight</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.profileHeroName}>
              {person.name}
              {person.age ? `, ${person.age}` : ""}
            </Text>
            <View style={styles.profileLocationRow}>
              <Ionicons name="location-outline" size={15} color="#E4E4E7" />
              <Text style={styles.profileLocationText}>{location}</Text>
            </View>
          </View>
        </View>

        <View style={styles.profileContent}>
          <Text style={styles.profileBio}>{personProfileLine(person)}</Text>

          <View style={styles.bestMoveCard}>
            <View style={styles.bestMoveIcon}>
              <Ionicons name="sparkles" size={17} color="#0A0A0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileHighlightTitle}>Best next move</Text>
              <Text style={styles.profileHighlightText}>{bestNextMove(person)}</Text>
            </View>
          </View>

          <View style={styles.profileStatsRow}>
            <ProfileStat icon="sparkles" label="Energy" value={person.energy ?? "Ready for plans"} />
            <ProfileStat icon="analytics-outline" label="Match" value={`${matchScore(person)}% fit`} />
            <ProfileStat icon="navigate" label="Area" value={location} />
          </View>

          {sharedInterests.length ? (
            <View style={styles.profileHighlightCard}>
              <View style={styles.profileHighlightIcon}>
                <Ionicons name="checkmark" size={16} color="#0A0A0B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileHighlightTitle}>Why they fit</Text>
                <Text style={styles.profileHighlightText}>You both like {sharedInterests.slice(0, 4).join(", ")}.</Text>
              </View>
            </View>
          ) : null}

          <ProfileTagGroup title="Interests" icon="heart-outline" tags={interests} />
          <ProfileTagGroup title="Plan Style" icon="calendar-outline" tags={planStyle} />
          {comfort.length ? <ProfileTagGroup title="Comfort" icon="shield-checkmark-outline" tags={comfort} /> : null}
          {mutualConnections.length ? (
            <ProfileTagGroup title="Mutuals" icon="people-outline" tags={mutualConnections} />
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.profileBottomBar, { paddingBottom: bottomPad }]}>
        <Pressable
          onPress={onConnect}
          style={[styles.profilePrimaryAction, (primaryDisabled || connectBusy) && styles.disabledButton]}
          disabled={primaryDisabled || connectBusy}
        >
          <Ionicons name={person.relationshipStatus === "friends" ? "chatbubble" : "person-add"} size={18} color="#0A0A0B" />
          <Text style={styles.profilePrimaryActionText}>{buttonLabel(connectLabel, connectBusy)}</Text>
        </Pressable>
        <Pressable onPress={onIcebreaker} style={styles.profileSecondaryAction}>
          <Ionicons name="sparkles" size={18} color="#FFFFFF" />
          <Text style={styles.profileSecondaryActionText}>AI</Text>
        </Pressable>
        <Pressable onPress={onPlan} style={styles.profileSecondaryAction}>
          <Ionicons name="calendar" size={18} color="#FFFFFF" />
          <Text style={styles.profileSecondaryActionText}>Make Plan</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ProfileStat({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.profileStat}>
      <Ionicons name={icon} size={17} color="#FF8BC4" />
      <Text style={styles.profileStatLabel}>{label}</Text>
      <Text style={styles.profileStatValue} numberOfLines={1}>{titleTag(value)}</Text>
    </View>
  );
}

function ProfileTagGroup({
  title,
  icon,
  tags,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  tags: string[];
}) {
  if (!tags.length) return null;
  return (
    <View style={styles.profileSectionCard}>
      <View style={styles.profileSectionHeader}>
        <Ionicons name={icon} size={16} color="#FF8BC4" />
        <Text style={styles.profileSectionTitle}>{title}</Text>
      </View>
      <View style={styles.profileTagWrap}>
        {tags.map((tag) => (
          <View key={tag} style={styles.profileTag}>
            <Text style={styles.profileTagText}>{tag}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function PlanDetailSheet({
  plan,
  bottomInset,
  joinBusy,
  onClose,
  onOpenConnect,
  onShare,
  onIcebreaker,
  onJoin,
}: {
  plan: FriendPlan;
  bottomInset: number;
  joinBusy: boolean;
  onClose: () => void;
  onOpenConnect: () => void;
  onShare: () => void;
  onIcebreaker: () => void;
  onJoin: () => void;
}) {
  const insets = useSafeAreaInsets();
  const isJoinableFeedPlan = plan.joinRequestStatus !== undefined && !plan.isCreator && !plan.isMember;
  const canOpenConnect = !!plan.chatId && !isJoinableFeedPlan;
  const joinPending = plan.joinRequestStatus === "pending";
  const bottomPad = Math.max(bottomInset, insets.bottom) + 18;

  return (
    <View style={styles.planDetailOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.planDetailSheet, { paddingBottom: bottomPad }]}>
        <View style={styles.planDetailHandle} />
        <View style={styles.planDetailHero}>
          {plan.sourceImageUrl ? (
            <Image source={{ uri: plan.sourceImageUrl }} style={styles.planDetailImage} contentFit="cover" />
          ) : (
            <LinearGradient colors={["rgba(255,45,168,0.32)", "rgba(255,255,255,0.06)"]} style={styles.planDetailImageFallback}>
              <Ionicons name={plan.sourceType === "event" ? "calendar" : "location"} size={38} color="#FFFFFF" />
            </LinearGradient>
          )}
          <LinearGradient colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.88)"]} style={StyleSheet.absoluteFill} />
          <Pressable onPress={onClose} style={styles.planDetailClose}>
            <Ionicons name="close" size={20} color="#FFFFFF" />
          </Pressable>
          <View style={styles.planDetailHeroText}>
            <View style={styles.planSocialRow}>
              <View style={[styles.planPulsePill, planIsLive(plan) && styles.planPulsePillLive]}>
                <View style={[styles.planPulseDot, planIsLive(plan) && styles.planPulseDotLive]} />
                <Text style={styles.planPulseText}>{planSocialLabel(plan)}</Text>
              </View>
              <View style={styles.planMiniPill}>
                <Text style={styles.planMiniPillText}>{planInterestLabel(plan)}</Text>
              </View>
            </View>
            <Text style={styles.planDetailTitle}>{plan.title}</Text>
            <Text style={styles.planDetailVenue}>{planVenue(plan)}</Text>
          </View>
        </View>

        <View style={styles.planDetailBody}>
          <View style={styles.planDetailInfoGrid}>
            <PlanInfo icon="time-outline" label="When" value={planWhen(plan)} />
            <PlanInfo icon="location-outline" label="Where" value={planVenue(plan)} />
          </View>

          <View style={styles.planDetailCard}>
            <Text style={styles.profileSectionTitle}>What you're doing</Text>
            <Text style={styles.planDetailCopy}>{planWhatLine(plan)}</Text>
          </View>

          <View style={styles.planDetailCard}>
            <Text style={styles.profileSectionTitle}>Who's going</Text>
            <Text style={styles.planDetailCopy}>
              {planPeopleCount(plan)} people are in the mix. Hosted by {firstName(plan.creator?.name)}.
            </Text>
          </View>

          <View style={styles.planDetailActions}>
            {canOpenConnect ? (
              <Pressable onPress={onOpenConnect} style={styles.profilePrimaryAction}>
                <Ionicons name="chatbubbles" size={18} color="#0A0A0B" />
                <Text style={styles.profilePrimaryActionText}>Open Connect</Text>
              </Pressable>
            ) : (
              <Pressable onPress={onJoin} disabled={joinPending || joinBusy} style={[styles.profilePrimaryAction, (joinPending || joinBusy) && styles.disabledButton]}>
                <Ionicons name="person-add" size={18} color="#0A0A0B" />
                <Text style={styles.profilePrimaryActionText}>{buttonLabel(joinPending ? "Requested" : "Request Join", joinBusy)}</Text>
              </Pressable>
            )}
            <Pressable onPress={onShare} style={styles.profileSecondaryAction}>
              <Ionicons name="share-social" size={18} color="#FFFFFF" />
              <Text style={styles.profileSecondaryActionText}>Share</Text>
            </Pressable>
            <Pressable onPress={onIcebreaker} style={styles.profileSecondaryAction}>
              <Ionicons name="sparkles" size={18} color="#FFFFFF" />
              <Text style={styles.profileSecondaryActionText}>AI</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

function PlanInfo({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.planInfoBox}>
      <Ionicons name={icon} size={17} color="#FF8BC4" />
      <Text style={styles.profileStatLabel}>{label}</Text>
      <Text style={styles.profileStatValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function CreateFirstPanel({
  onCreatePlan,
  onInviteFriend,
  onCreateGroup,
  onFindDuoBuddy,
}: {
  onCreatePlan: () => void;
  onInviteFriend: () => void;
  onCreateGroup: () => void;
  onFindDuoBuddy: () => void;
}) {
  return (
    <View style={styles.createPanel}>
      <Text style={styles.createPanelEyebrow}>Create first</Text>
      <View style={styles.createGrid}>
        <CreateTile icon="calendar" label="Create Plan" onPress={onCreatePlan} primary />
        <CreateTile icon="share-social" label="Invite Friend" onPress={onInviteFriend} />
        <CreateTile icon="people" label="Create Group" onPress={onCreateGroup} />
        <CreateTile icon="heart" label="Find a Duo Buddy" onPress={onFindDuoBuddy} />
      </View>
    </View>
  );
}

function CreateTile({ icon, label, onPress, primary }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.createTile, primary && styles.createTilePrimary]}>
      <View style={[styles.createTileIcon, primary && styles.createTileIconPrimary]}>
        <Ionicons name={icon} size={17} color={primary ? "#0A0A0B" : "#FF8BC4"} />
      </View>
      <Text style={[styles.createTileText, primary && styles.createTileTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

function TonightsPeople({
  people,
  onOpenPerson,
  onPlanForPerson,
  onFindDuoBuddy,
}: {
  people: FriendPerson[];
  onOpenPerson: (person: FriendPerson) => void;
  onPlanForPerson: (person: FriendPerson) => void;
  onFindDuoBuddy: () => void;
}) {
  const picks = people
    .filter((person) => person.relationshipStatus !== "self")
    .sort((a, b) => Number(b.activeTonight === true) - Number(a.activeTonight === true) || matchScore(b) - matchScore(a))
    .slice(0, 6);
  if (!picks.length) return null;
  return (
    <View style={styles.tonightWrap}>
      <View style={styles.tonightHeader}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.tonightEyebrow}>Tonight's People</Text>
          <Text style={styles.tonightTitle} numberOfLines={1}>Active friends, planners, and duo fits</Text>
        </View>
        <Pressable onPress={onFindDuoBuddy} style={styles.tonightDuoBtn}>
          <Ionicons name="heart" size={14} color="#FF8BC4" />
          <Text style={styles.tonightDuoText}>Duo</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tonightList}>
        {picks.map((person) => (
          <Pressable key={person.id} onPress={() => onOpenPerson(person)} style={styles.tonightCard}>
            <Image source={{ uri: person.photoUrl ?? FALLBACK_PHOTO }} style={styles.tonightAvatar} contentFit="cover" />
            <Text style={styles.tonightName} numberOfLines={1}>{firstName(person.name)}</Text>
            <Text style={styles.tonightMeta} numberOfLines={1}>
              {person.activeTonight ? "Active tonight" : person.suggestedPlanType ?? "Good planner"}
            </Text>
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                onPlanForPerson(person);
              }}
              style={styles.tonightPlanBtn}
            >
              <Text style={styles.tonightPlanText}>Plan</Text>
            </Pressable>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function LoadingState() {
  return (
    <View style={styles.emptyState}>
      <ActivityIndicator color="#FF2D8D" />
      <Text style={styles.emptyText}>Loading friends...</Text>
    </View>
  );
}

function EmptyState({ title, text, actionLabel, onAction }: { title: string; text: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={styles.emptyAction}>
          <Text style={styles.emptyActionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function PlusAction({
  icon,
  title,
  text,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.plusAction}>
      <View style={styles.plusActionIcon}>
        <Ionicons name={icon} size={18} color="#0A0A0B" />
      </View>
      <View style={styles.plusActionCopy}>
        <Text style={styles.plusActionTitle}>{title}</Text>
        <Text style={styles.plusActionText}>{text}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#777783" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: FRIENDS_BLACK,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 12,
    gap: 18,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 0,
  },
  subtitle: {
    color: FRIENDS_MUTED,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 3,
  },
  headerButton: {
    alignItems: "center",
    backgroundColor: FRIENDS_PINK,
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    shadowColor: FRIENDS_PINK,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    width: 44,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionPrimary: {
    alignItems: "center",
    backgroundColor: FRIENDS_PINK,
    borderRadius: 16,
    flex: 1,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    minHeight: 46,
  },
  actionPrimaryText: {
    color: "#0A0A0B",
    fontSize: 14,
    fontWeight: "900",
  },
  actionSecondary: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    minHeight: 46,
  },
  actionSecondaryText: {
    color: FRIENDS_TEXT,
    fontSize: 14,
    fontWeight: "900",
  },
  createPanel: {
    backgroundColor: "#08080A",
    borderColor: "rgba(255,45,168,0.22)",
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  createPanelEyebrow: {
    color: "#FF8BC4",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  createGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  createTile: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.065)",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 18,
    borderWidth: 1,
    flexBasis: "47%",
    flexDirection: "row",
    flexGrow: 1,
    gap: 9,
    minHeight: 56,
    paddingHorizontal: 11,
  },
  createTilePrimary: {
    backgroundColor: "#FF2D8D",
    borderColor: "#FF2D8D",
  },
  createTileIcon: {
    alignItems: "center",
    backgroundColor: "rgba(255,45,168,0.12)",
    borderRadius: 14,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  createTileIconPrimary: {
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  createTileText: {
    color: "#FFFFFF",
    flex: 1,
    fontSize: 13,
    fontWeight: "900",
  },
  createTileTextPrimary: {
    color: "#0A0A0B",
  },
  tonightWrap: {
    backgroundColor: "rgba(255,255,255,0.045)",
    borderColor: "rgba(255,255,255,0.09)",
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    paddingVertical: 14,
  },
  tonightHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingHorizontal: 14,
  },
  tonightEyebrow: {
    color: "#FF8BC4",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  tonightTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 2,
  },
  tonightDuoBtn: {
    alignItems: "center",
    borderColor: "rgba(255,45,168,0.22)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  tonightDuoText: {
    color: "#FFB6D9",
    fontSize: 11,
    fontWeight: "900",
  },
  tonightList: {
    gap: 10,
    paddingHorizontal: 14,
  },
  tonightCard: {
    backgroundColor: "#050505",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 18,
    borderWidth: 1,
    padding: 10,
    width: 122,
  },
  tonightAvatar: {
    borderRadius: 16,
    height: 72,
    width: "100%",
  },
  tonightName: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 8,
  },
  tonightMeta: {
    color: "#A1A1AA",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  tonightPlanBtn: {
    alignItems: "center",
    backgroundColor: "rgba(255,45,168,0.12)",
    borderColor: "rgba(255,45,168,0.2)",
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
    paddingVertical: 7,
  },
  tonightPlanText: {
    color: "#FFB6D9",
    fontSize: 11,
    fontWeight: "900",
  },
  searchBox: {
    alignItems: "center",
    backgroundColor: "#050505",
    borderColor: "rgba(255,45,168,0.3)",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
  },
  searchInput: {
    color: "#FFFFFF",
    flex: 1,
    fontSize: 15,
    minHeight: 48,
  },
  tabs: {
    backgroundColor: "#050505",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    padding: 5,
  },
  tabButton: {
    alignItems: "center",
    borderRadius: 14,
    flex: 1,
    paddingVertical: 10,
  },
  tabButtonActive: {
    backgroundColor: FRIENDS_PINK,
  },
  tabContent: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
  },
  tabText: {
    color: "#B7B7C2",
    fontSize: 13,
    fontWeight: "800",
  },
  tabTextActive: {
    color: "#0A0A0B",
  },
  tabBadge: {
    alignItems: "center",
    backgroundColor: FRIENDS_PINK,
    borderRadius: 999,
    justifyContent: "center",
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tabBadgeActive: {
    backgroundColor: "#0A0A0B",
  },
  tabBadgeText: {
    color: "#0A0A0B",
    fontSize: 11,
    fontWeight: "900",
  },
  tabBadgeTextActive: {
    color: "#FFFFFF",
  },
  stack: {
    gap: 12,
  },
  sectionLabel: {
    color: FRIENDS_TEXT,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 4,
  },
  smartPickCard: {
    alignItems: "center",
    backgroundColor: "rgba(255,45,168,0.12)",
    borderColor: "rgba(255,45,168,0.28)",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  smartPickIcon: {
    alignItems: "center",
    backgroundColor: FRIENDS_PINK,
    borderRadius: 17,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  smartPickCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  smartPickLabel: {
    color: "#FFB6D9",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  smartPickTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
  },
  smartPickText: {
    color: "#EDEDF2",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  personCard: {
    backgroundColor: "#050505",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 12,
  },
  requestCard: {
    backgroundColor: "#070707",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 12,
  },
  requestCardSent: {
    borderColor: "rgba(255,45,168,0.22)",
  },
  avatar: {
    backgroundColor: "#141419",
    borderRadius: 24,
    height: 64,
    width: 64,
  },
  personMain: {
    flex: 1,
    gap: 7,
    minWidth: 0,
  },
  nameRow: {
    alignItems: "flex-start",
    gap: 8,
  },
  personName: {
    color: FRIENDS_TEXT,
    flexShrink: 1,
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0,
  },
  personCity: {
    color: "#d4d4d8",
    fontSize: 13,
    fontWeight: "600",
  },
  statusBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,45,141,0.14)",
    borderColor: "rgba(255,45,141,0.28)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  statusText: {
    color: "#FF8BC4",
    fontSize: 11,
    fontWeight: "900",
  },
  matchBadge: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#FF2D8D",
    borderRadius: 999,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  matchBadgeText: {
    color: "#0A0A0B",
    fontSize: 11,
    fontWeight: "900",
  },
  sentBadge: {
    backgroundColor: "rgba(255,255,255,0.09)",
    borderColor: "rgba(255,255,255,0.14)",
  },
  sentBadgeText: {
    color: "#EDEDF2",
  },
  requestTopRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  interestRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  smartReasonRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  smartReasonText: {
    color: "#EDEDF2",
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  interestChip: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderColor: "rgba(255,255,255,0.09)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  interestText: {
    color: "#D7D7DE",
    fontSize: 11,
    fontWeight: "700",
  },
  suggestedPlanPill: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,45,168,0.1)",
    borderColor: "rgba(255,45,168,0.2)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    maxWidth: "100%",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  suggestedPlanText: {
    color: "#FFB6D9",
    flexShrink: 1,
    fontSize: 11,
    fontWeight: "900",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  profileCue: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,45,168,0.09)",
    borderColor: "rgba(255,45,168,0.18)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  profileCueText: {
    color: "#FFB6D9",
    fontSize: 11,
    fontWeight: "900",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#FF2D8D",
    borderRadius: 14,
    flex: 1,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 12,
  },
  primaryButtonText: {
    color: "#0A0A0B",
    fontSize: 13,
    fontWeight: "900",
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  aiButton: {
    alignItems: "center",
    backgroundColor: "#FBBF24",
    borderRadius: 14,
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 11,
  },
  aiButtonText: {
    color: "#0A0A0B",
    fontSize: 12,
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.55,
  },
  requestMessage: {
    color: "#E7E7EF",
    fontSize: 13,
    lineHeight: 18,
  },
  pendingSentRow: {
    alignItems: "center",
    backgroundColor: "rgba(255,45,168,0.1)",
    borderColor: "rgba(255,45,168,0.18)",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    flex: 1,
    gap: 7,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 10,
  },
  pendingSentText: {
    color: "#FFB6D9",
    fontSize: 12,
    fontWeight: "900",
  },
  planCard: {
    backgroundColor: "#050505",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 12,
  },
  planIcon: {
    alignItems: "center",
    backgroundColor: "rgba(255,45,141,0.14)",
    borderRadius: 18,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  planThumb: {
    backgroundColor: "#17171D",
    borderRadius: 18,
    height: 54,
    width: 54,
  },
  planTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
  },
  planMeta: {
    color: "#EDEDF2",
    fontSize: 13,
    fontWeight: "800",
  },
  planSocialRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  planPulsePill: {
    alignItems: "center",
    backgroundColor: "rgba(255,45,168,0.13)",
    borderColor: "rgba(255,45,168,0.25)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  planPulsePillLive: {
    backgroundColor: "rgba(52,211,153,0.13)",
    borderColor: "rgba(52,211,153,0.28)",
  },
  planPulseDot: {
    backgroundColor: "#FF2D8D",
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  planPulseDotLive: {
    backgroundColor: "#34D399",
  },
  planPulseText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },
  planMiniPill: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  planMiniPillText: {
    color: "#D7D7DE",
    fontSize: 11,
    fontWeight: "800",
  },
  createPlanInline: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#FF2D8D",
    borderRadius: 18,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  createPlanInlineText: {
    color: "#0A0A0B",
    fontSize: 13,
    fontWeight: "900",
  },
  emptyState: {
    alignItems: "center",
    backgroundColor: "#050505",
    borderColor: "rgba(255,45,168,0.18)",
    borderRadius: 28,
    borderWidth: 1,
    gap: 8,
    justifyContent: "center",
    minHeight: 190,
    padding: 22,
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
  },
  emptyText: {
    color: "#A1A1AA",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  emptyAction: {
    backgroundColor: "#FF2D8D",
    borderRadius: 15,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  emptyActionText: {
    color: "#0A0A0B",
    fontSize: 13,
    fontWeight: "900",
  },
  noticeOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.24)",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  notice: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#101014",
    borderColor: "rgba(255,45,168,0.34)",
    borderRadius: 26,
    borderWidth: 1,
    gap: 7,
    maxWidth: 330,
    minWidth: 260,
    paddingHorizontal: 20,
    paddingVertical: 20,
    shadowColor: "#FF2D8D",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.34,
    shadowRadius: 36,
  },
  noticeIcon: {
    alignItems: "center",
    backgroundColor: FRIENDS_PINK,
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    marginBottom: 2,
    width: 48,
  },
  noticeTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
  },
  noticeText: {
    color: "#EDEDF2",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    textAlign: "center",
  },
  profileScreen: {
    backgroundColor: FRIENDS_BLACK,
    flex: 1,
  },
  profileScroll: {
    flex: 1,
  },
  profileScrollContent: {
    backgroundColor: FRIENDS_BLACK,
  },
  profileHero: {
    backgroundColor: "#111114",
    height: 500,
    overflow: "hidden",
    position: "relative",
  },
  profileHeroImage: {
    height: "100%",
    width: "100%",
  },
  profileTopButtons: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    left: 16,
    position: "absolute",
    right: 16,
  },
  profileTopRight: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  profileIconButton: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.48)",
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 24,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  profileHeroPill: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 13,
  },
  profileHeroPillText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },
  safetyMenu: {
    backgroundColor: "rgba(10,10,12,0.94)",
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    padding: 8,
    position: "absolute",
    right: 0,
    top: 56,
    width: 164,
  },
  safetyAction: {
    alignItems: "center",
    borderRadius: 13,
    flexDirection: "row",
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 10,
  },
  safetyActionDanger: {
    backgroundColor: "rgba(239,68,68,0.18)",
  },
  safetyActionText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  profileHeroBottom: {
    bottom: 0,
    left: 0,
    padding: 20,
    position: "absolute",
    right: 0,
  },
  profileBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  profileLiveBadge: {
    alignItems: "center",
    backgroundColor: "rgba(52,211,153,0.14)",
    borderColor: "rgba(52,211,153,0.28)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  profileLiveDot: {
    backgroundColor: "#34D399",
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  profileLiveText: {
    color: "#D1FAE5",
    fontSize: 11,
    fontWeight: "900",
  },
  profileHeroName: {
    color: "#FFFFFF",
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: 0,
  },
  profileLocationRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
  },
  profileLocationText: {
    color: "#E4E4E7",
    fontSize: 14,
    fontWeight: "800",
  },
  profileContent: {
    gap: 16,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  profileBio: {
    color: FRIENDS_TEXT,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 23,
  },
  profileStatsRow: {
    flexDirection: "row",
    gap: 10,
  },
  profileStat: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    minHeight: 92,
    padding: 12,
  },
  profileStatLabel: {
    color: "#A1A1AA",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  profileStatValue: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  profileHighlightCard: {
    alignItems: "center",
    backgroundColor: "rgba(255,45,168,0.11)",
    borderColor: "rgba(255,45,168,0.28)",
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  bestMoveCard: {
    alignItems: "center",
    backgroundColor: "rgba(255,45,168,0.11)",
    borderColor: "rgba(255,45,168,0.28)",
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  bestMoveIcon: {
    alignItems: "center",
    backgroundColor: FRIENDS_PINK,
    borderRadius: 16,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  profileHighlightIcon: {
    alignItems: "center",
    backgroundColor: FRIENDS_PINK,
    borderRadius: 16,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  profileHighlightTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  profileHighlightText: {
    color: "#EDEDF2",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 3,
  },
  profileSectionCard: {
    backgroundColor: "rgba(255,255,255,0.045)",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  profileSectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  profileTagWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  profileTag: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  profileTagText: {
    color: "#F4F4F5",
    fontSize: 13,
    fontWeight: "800",
  },
  profileBottomBar: {
    backgroundColor: "rgba(0,0,0,0.92)",
    borderTopColor: "rgba(255,255,255,0.1)",
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: "row",
    gap: 10,
    left: 0,
    paddingHorizontal: 18,
    paddingTop: 14,
    position: "absolute",
    right: 0,
  },
  profilePrimaryAction: {
    alignItems: "center",
    backgroundColor: FRIENDS_PINK,
    borderRadius: 18,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 54,
  },
  profilePrimaryActionText: {
    color: "#0A0A0B",
    fontSize: 15,
    fontWeight: "900",
  },
  profileSecondaryAction: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.09)",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 54,
  },
  profileSecondaryActionText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  planDetailOverlay: {
    backgroundColor: "rgba(0,0,0,0.74)",
    flex: 1,
    justifyContent: "flex-end",
  },
  planDetailSheet: {
    backgroundColor: "#07070A",
    borderColor: "rgba(255,45,168,0.24)",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    maxHeight: "88%",
    overflow: "hidden",
  },
  planDetailHandle: {
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.24)",
    borderRadius: 3,
    height: 5,
    marginTop: 10,
    position: "absolute",
    width: 42,
    zIndex: 3,
  },
  planDetailHero: {
    backgroundColor: "#141419",
    height: 240,
    overflow: "hidden",
    position: "relative",
  },
  planDetailImage: {
    height: "100%",
    width: "100%",
  },
  planDetailImageFallback: {
    alignItems: "center",
    height: "100%",
    justifyContent: "center",
    width: "100%",
  },
  planDetailClose: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.56)",
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 18,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    position: "absolute",
    right: 14,
    top: 16,
    width: 38,
  },
  planDetailHeroText: {
    bottom: 0,
    gap: 9,
    left: 0,
    padding: 18,
    position: "absolute",
    right: 0,
  },
  planDetailTitle: {
    color: "#FFFFFF",
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: 0,
  },
  planDetailVenue: {
    color: "#E4E4E7",
    fontSize: 14,
    fontWeight: "800",
  },
  planDetailBody: {
    gap: 13,
    padding: 16,
  },
  planDetailInfoGrid: {
    flexDirection: "row",
    gap: 10,
  },
  planInfoBox: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    minHeight: 96,
    padding: 12,
  },
  planDetailCard: {
    backgroundColor: "rgba(255,255,255,0.045)",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
    borderWidth: 1,
    gap: 7,
    padding: 14,
  },
  planDetailCopy: {
    color: "#D7D7DE",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
  },
  planDetailActions: {
    flexDirection: "row",
    gap: 10,
  },
  profileOverlay: {
    backgroundColor: "rgba(0,0,0,0.76)",
    flex: 1,
    justifyContent: "flex-end",
    padding: 16,
  },
  profileCard: {
    backgroundColor: "#08080A",
    borderColor: "rgba(255,45,168,0.26)",
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
  },
  profileImageWrap: {
    backgroundColor: "#141419",
    height: 220,
    position: "relative",
  },
  profileImage: {
    height: "100%",
    width: "100%",
  },
  profileClose: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.52)",
    borderRadius: 18,
    height: 38,
    justifyContent: "center",
    position: "absolute",
    right: 12,
    top: 12,
    width: 38,
  },
  profileBody: {
    gap: 14,
    padding: 16,
  },
  profileNameRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
  },
  profileName: {
    color: FRIENDS_TEXT,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 0,
  },
  profileMeta: {
    color: FRIENDS_MUTED,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 3,
  },
  profileStatusBadge: {
    backgroundColor: "rgba(255,45,168,0.14)",
    borderColor: "rgba(255,45,168,0.3)",
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 130,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  profileStatusText: {
    color: "#FF8BC4",
    fontSize: 11,
    fontWeight: "900",
  },
  profileSection: {
    gap: 8,
  },
  profileSectionTitle: {
    color: FRIENDS_TEXT,
    fontSize: 13,
    fontWeight: "900",
  },
  profileCopy: {
    color: "#D7D7DE",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  profileActions: {
    flexDirection: "row",
    gap: 10,
  },
  plusOverlay: {
    backgroundColor: "rgba(0,0,0,0.72)",
    flex: 1,
    justifyContent: "flex-start",
    paddingHorizontal: 16,
    paddingTop: 90,
  },
  plusMenu: {
    alignSelf: "stretch",
    backgroundColor: "#101014",
    borderColor: "rgba(255,45,141,0.28)",
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    padding: 14,
    shadowColor: "#FF2D8D",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.28,
    shadowRadius: 30,
  },
  plusMenuHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  plusTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
  },
  plusSubtitle: {
    color: "#A1A1AA",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  plusClose: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  plusAction: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 11,
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  plusActionIcon: {
    alignItems: "center",
    backgroundColor: "#FF2D8D",
    borderRadius: 16,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  plusActionCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  plusActionTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  plusActionText: {
    color: "#A1A1AA",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  iceOverlay: {
    backgroundColor: "rgba(0,0,0,0.72)",
    flex: 1,
    justifyContent: "flex-end",
  },
  iceSheet: {
    backgroundColor: "#09090B",
    borderColor: "rgba(255,45,168,0.28)",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  iceHandle: {
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 999,
    height: 4,
    width: 42,
  },
  iceHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  iceIcon: {
    alignItems: "center",
    backgroundColor: "#FBBF24",
    borderRadius: 18,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  iceTitle: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "900",
  },
  iceSubtitle: {
    color: "#A1A1AA",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 2,
  },
  iceClose: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  iceLoading: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    flexDirection: "row",
    gap: 10,
    padding: 14,
  },
  iceLoadingText: {
    color: "#EDEDF2",
    fontSize: 13,
    fontWeight: "800",
  },
  iceSuggestionStack: {
    gap: 8,
  },
  iceSuggestion: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    borderWidth: 1,
    gap: 5,
    padding: 12,
  },
  iceSuggestionActive: {
    backgroundColor: "rgba(251,191,36,0.16)",
    borderColor: "rgba(251,191,36,0.46)",
  },
  iceSuggestionText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19,
  },
  iceSuggestionReason: {
    color: "#FFB6D9",
    fontSize: 11,
    fontWeight: "800",
  },
  iceInput: {
    backgroundColor: "#050505",
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 16,
    borderWidth: 1,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19,
    minHeight: 84,
    padding: 12,
    textAlignVertical: "top",
  },
  iceError: {
    color: "#FCA5A5",
    fontSize: 12,
    fontWeight: "800",
  },
  iceActions: {
    flexDirection: "row",
    gap: 10,
  },
  iceSecondary: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 12,
  },
  iceSecondaryText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  icePrimary: {
    alignItems: "center",
    backgroundColor: "#FF2D8D",
    borderRadius: 16,
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
  },
  icePrimaryText: {
    color: "#0A0A0B",
    fontSize: 14,
    fontWeight: "900",
  },
});
