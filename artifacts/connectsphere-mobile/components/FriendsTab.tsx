import { useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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

import {
  createFriendPlan,
  createFriendStory,
  getFriendPeople,
  getFriendPlans,
  getFriendPlansFeed,
  getFriendRequests,
  getFriendStories,
  requestJoinFriendPlan,
  reactToFriendStory,
  replyToFriendStory,
  respondPlanJoinRequest,
  respondFriendRequest,
  sendFriendRequest,
  type FriendPerson,
  type FriendPlan,
  type FriendRequest,
  type FriendStory,
} from "@/services/friendsApi";
import CreateFriendPlanSheet from "@/components/CreateFriendPlanSheet";

type FriendsTabProps = {
  bottomInset?: number;
};

type FriendsView = "all" | "people" | "requests" | "plans";
type StoryType = "status" | "photo" | "plan_invite";
type PlanSourceTab = "map" | "event";

const PLAN_TYPES = ["Coffee", "Gym", "Walk", "Brunch", "Study", "Night Out", "Movie", "Custom"];
const STORY_TYPES: Array<{ id: StoryType; label: string }> = [
  { id: "status", label: "Status" },
  { id: "photo", label: "Photo" },
  { id: "plan_invite", label: "Plan Invite" },
];
const FRIENDS_PINK = "#ff2da8";
const FRIENDS_BLACK = "#000000";
const FRIENDS_SURFACE = "#0a0a0a";
const FRIENDS_TEXT = "#f4f4f5";
const FRIENDS_MUTED = "#a1a1aa";
const APP_SHARE_URL = "https://connectsphere.app";

const FALLBACK_PHOTO =
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=85";

function firstName(name?: string) {
  return (name ?? "Someone").split(" ")[0] || "Someone";
}

function openConnectThread(chatId?: string) {
  if (!chatId) return;
  router.push({ pathname: "/(tabs)/matches", params: { openChatId: chatId } } as never);
}

function shareOut(message: string, url = APP_SHARE_URL) {
  return Share.share({ message: `${message}\n${url}` });
}

function successHaptic() {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export default function FriendsTab({ bottomInset = 0 }: FriendsTabProps) {
  const { user } = useUser();
  const userId = user?.id ?? "user_self";

  const [activeTab, setActiveTab] = useState<FriendsView>("all");
  const [search, setSearch] = useState("");
  const [people, setPeople] = useState<FriendPerson[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [plans, setPlans] = useState<FriendPlan[]>([]);
  const [planFeed, setPlanFeed] = useState<FriendPlan[]>([]);
  const [stories, setStories] = useState<FriendStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const [planSheetOpen, setPlanSheetOpen] = useState(false);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [planSourceTab, setPlanSourceTab] = useState<PlanSourceTab>("event");
  const [planInviteIds, setPlanInviteIds] = useState<string[]>([]);
  const [planInitialTitle, setPlanInitialTitle] = useState("");
  const [planTargetPerson, setPlanTargetPerson] = useState<FriendPerson | null>(null);
  const [storyComposerOpen, setStoryComposerOpen] = useState(false);
  const [viewingStory, setViewingStory] = useState<FriendStory | null>(null);

  const [storyType, setStoryType] = useState<StoryType>("status");
  const [storyText, setStoryText] = useState("");
  const [storyImageUrl, setStoryImageUrl] = useState("");
  const [storyPlanType, setStoryPlanType] = useState("Coffee");
  const [storyReplyText, setStoryReplyText] = useState("");

  const friends = useMemo(() => people.filter((person) => person.relationshipStatus === "friends"), [people]);
  const hubStats = useMemo(
    () => [
      { label: "People", value: String(people.length) },
      { label: "Pending", value: String(requests.length) },
      { label: "Plans", value: String(plans.length + planFeed.length) },
    ],
    [people.length, planFeed.length, plans.length, requests.length],
  );

  const loadFriends = useCallback(async () => {
    setLoading(true);
    try {
      const [peopleResult, requestResult, planResult, feedResult, storyResult] = await Promise.all([
        getFriendPeople(userId, search),
        getFriendRequests(userId),
        getFriendPlans(userId),
        getFriendPlansFeed(userId),
        getFriendStories(userId),
      ]);
      setPeople(peopleResult.people ?? []);
      setRequests(requestResult.requests ?? []);
      setPlans(planResult.plans ?? []);
      setPlanFeed(feedResult.plans ?? []);
      setStories(storyResult.stories ?? []);
    } catch {
      setNotice("Friends could not load. Check the API server and try again.");
    } finally {
      setLoading(false);
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

  const handleConnect = useCallback(
    async (person: FriendPerson) => {
      if (person.relationshipStatus === "requested") return;
      try {
        if (person.relationshipStatus === "friends") {
          if (person.chatId) openConnectThread(person.chatId);
          return;
        }
        if (person.relationshipStatus === "incoming" && person.requestId) {
          const result = await respondFriendRequest(person.requestId, "accept");
          successHaptic();
          showNotice("They'll see you in Connect.");
          if (result.chat?.id) openConnectThread(result.chat.id);
        } else {
          await sendFriendRequest(userId, person.id);
          showNotice(`Request sent to ${firstName(person.name)}.`);
        }
        await loadFriends();
      } catch {
        showNotice("Could not update this connection.");
      }
    },
    [loadFriends, showNotice, userId],
  );

  const handleRequest = useCallback(
    async (request: FriendRequest, action: "accept" | "ignore") => {
      try {
        if (request.requestType === "plan_join" || request.kind === "plan_join") {
          const result = await respondPlanJoinRequest(request.id, userId, action === "accept" ? "accept" : "decline");
          if (action === "accept") {
            successHaptic();
            showNotice("You're in. Plan thread is in Connect.");
            if (result.chat?.id) openConnectThread(result.chat.id);
          } else {
            showNotice("Plan request declined.");
          }
        } else {
          const result = await respondFriendRequest(request.id, action);
          if (action === "accept") {
            successHaptic();
            showNotice("They'll see you in Connect.");
            if (result.chat?.id) openConnectThread(result.chat.id);
          } else {
            showNotice("Request ignored.");
          }
        }
        await loadFriends();
      } catch {
        showNotice("Could not update that request.");
      }
    },
    [loadFriends, showNotice, userId],
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
    setPlanInitialTitle(`Plan with ${firstName(person.name)}`);
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
            showNotice("Plan's live. Thread is in Connect.");
          }
          await loadFriends();
          setActiveTab("plans");
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

  const handleCreateStory = useCallback(async () => {
    try {
      await createFriendStory({
        userId,
        type: storyType,
        text: storyText.trim() || (storyType === "plan_invite" ? `${storyPlanType} later?` : "Going out tonight"),
        imageUrl: storyType === "photo" ? storyImageUrl.trim() : undefined,
        planType: storyType === "plan_invite" ? storyPlanType : undefined,
      });
      setStoryComposerOpen(false);
      setStoryText("");
      setStoryImageUrl("");
      setStoryType("status");
      successHaptic();
      showNotice("Story's live for 24 hours.");
      await loadFriends();
    } catch {
      showNotice("Could not post story.");
    }
  }, [loadFriends, showNotice, storyImageUrl, storyPlanType, storyText, storyType, userId]);

  const handleStoryReply = useCallback(async () => {
    if (!viewingStory) return;
    if (viewingStory.isOwn) {
      showNotice("This is your story.");
      return;
    }
    try {
      const result = await replyToFriendStory(userId, viewingStory.id, storyReplyText.trim() || "I am interested.");
      setStoryReplyText("");
      setViewingStory(null);
      if (result.mode === "chat" && result.chat?.id) {
        showNotice("Reply is in Connect.");
        openConnectThread(result.chat.id);
      } else {
        showNotice("Reply sent as a connection request.");
      }
      await loadFriends();
    } catch {
      showNotice("Could not send reply.");
    }
  }, [loadFriends, showNotice, storyReplyText, userId, viewingStory]);

  const handleStoryConnect = useCallback(async () => {
    if (!viewingStory) return;
    if (viewingStory.isOwn) {
      showNotice("This is your story.");
      return;
    }
    try {
      const result = await sendFriendRequest(userId, viewingStory.userId, { storyId: viewingStory.id });
      setViewingStory(null);
      if (result.chat?.id) openConnectThread(result.chat.id);
      else showNotice("Connection request sent.");
      await loadFriends();
    } catch {
      showNotice("Could not send request.");
    }
  }, [loadFriends, showNotice, userId, viewingStory]);

  const handleStoryPlan = useCallback(() => {
    if (!viewingStory) return;
    setViewingStory(null);
    if (viewingStory.isOwn) {
      openCreatePlan("event");
      return;
    }
    openPlanForPerson({ ...viewingStory.user, relationshipStatus: viewingStory.relationshipStatus });
  }, [openCreatePlan, openPlanForPerson, viewingStory]);

  const handleJoinStoryPlan = useCallback(async () => {
    if (!viewingStory?.planId) {
      handleStoryPlan();
      return;
    }
    try {
      const result = await requestJoinFriendPlan(userId, viewingStory.planId);
      setViewingStory(null);
      if (result.status === "joined") successHaptic();
      showNotice(result.status === "joined" ? "You're in. Plan thread is in Connect." : "Request sent to join.");
      await loadFriends();
      if (result.chat?.id) openConnectThread(result.chat.id);
    } catch {
      showNotice("Could not join that plan.");
    }
  }, [handleStoryPlan, loadFriends, showNotice, userId, viewingStory]);

  const handleRequestJoinPlan = useCallback(
    async (plan: FriendPlan) => {
      if (plan.joinRequestStatus === "pending") return;
      try {
        const result = await requestJoinFriendPlan(userId, plan.id);
        if (result.status === "joined") successHaptic();
        showNotice(result.status === "joined" ? "You're in. Plan thread is in Connect." : "Request sent to the creator.");
        await loadFriends();
        if (result.chat?.id) openConnectThread(result.chat.id);
      } catch {
        showNotice("Could not request to join.");
      }
    },
    [loadFriends, showNotice, userId],
  );

  const handleSharePlan = useCallback(
    async (plan: FriendPlan) => {
      try {
        await shareOut(
          `Join my ConnectSphere plan: ${plan.title} at ${plan.timeLabel ?? plan.time ?? "soon"} near ${
            plan.sourceName ?? plan.location ?? "Miami"
          }.`,
        );
      } catch {
        showNotice("Could not open the share sheet.");
      }
    },
    [showNotice],
  );

  const connectLabel = (person: FriendPerson) => {
    if (person.relationshipStatus === "friends") return "Message";
    if (person.relationshipStatus === "requested") return "Requested";
    if (person.relationshipStatus === "incoming") return "Accept";
    return "Connect";
  };

  const renderPeople = (showEmpty = true) => {
    if (loading) return <LoadingState />;
    if (!people.length) {
      return showEmpty ? <EmptyState title="No people yet" text="Try searching another interest or check back soon." /> : null;
    }
    return (
      <View style={styles.stack}>
        {people.map((person) => (
          <View key={person.id} style={styles.personCard}>
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
              </View>
              <Text style={styles.personCity}>{person.location ?? person.city ?? "Miami"}</Text>
              <View style={styles.interestRow}>
                {(person.interests ?? []).slice(0, 3).map((interest) => (
                  <View key={interest} style={styles.interestChip}>
                    <Text style={styles.interestText}>{interest}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.buttonRow}>
                <Pressable
                  onPress={() => handleConnect(person)}
                  style={[styles.primaryButton, person.relationshipStatus === "requested" && styles.disabledButton]}
                  disabled={person.relationshipStatus === "requested"}
                >
                  <Text style={styles.primaryButtonText}>{connectLabel(person)}</Text>
                </Pressable>
                <Pressable onPress={() => openPlanForPerson(person)} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Plan</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderRequests = (showEmpty = true) => {
    if (loading) return <LoadingState />;
    if (!requests.length) {
      return showEmpty ? <EmptyState title="No requests" text="New friend requests and story replies will show here." /> : null;
    }
    return (
      <View style={styles.stack}>
        {requests.map((request) => (
          <View key={request.id} style={styles.requestCard}>
            <Image source={{ uri: request.fromUser.photoUrl ?? FALLBACK_PHOTO }} style={styles.avatar} contentFit="cover" />
            <View style={styles.personMain}>
              <Text style={styles.personName}>
                {request.fromUser.name}
                {request.fromUser.age ? `, ${request.fromUser.age}` : ""}
              </Text>
              <Text style={styles.personCity}>{request.fromUser.location ?? request.fromUser.city ?? "Miami"}</Text>
              <Text style={styles.requestMessage} numberOfLines={2}>
                {request.requestType === "plan_join" || request.kind === "plan_join"
                  ? `Wants to join ${request.plan?.title ?? "your plan"}`
                  : request.message ?? "Wants to connect"}
              </Text>
              <View style={styles.interestRow}>
                {((request.requestType === "plan_join" || request.kind === "plan_join"
                  ? [request.plan?.timeLabel ?? request.plan?.time ?? "Soon", request.plan?.location ?? request.plan?.sourceName ?? "Miami"]
                  : request.sharedInterests ?? [])).filter(Boolean).slice(0, 3).map((interest) => (
                  <View key={interest} style={styles.interestChip}>
                    <Text style={styles.interestText}>{interest}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.buttonRow}>
                <Pressable onPress={() => handleRequest(request, "accept")} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Accept</Text>
                </Pressable>
                <Pressable onPress={() => handleRequest(request, "ignore")} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>{request.requestType === "plan_join" || request.kind === "plan_join" ? "Decline" : "Ignore"}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderPlans = (showEmpty = true) => {
    if (loading) return <LoadingState />;
    if (!plans.length && !planFeed.length) {
      return showEmpty ? (
        <EmptyState
          title="No plans yet"
          text="Create a plan or request to join one nearby."
          actionLabel="+ Create Plan"
          onAction={() => openCreatePlan()}
        />
      ) : null;
    }
    return (
      <View style={styles.stack}>
        <Pressable onPress={() => openCreatePlan()} style={styles.createPlanInline}>
          <Ionicons name="add" size={18} color="#0A0A0B" />
          <Text style={styles.createPlanInlineText}>Create Plan</Text>
        </Pressable>
        {planFeed.length ? (
          <>
            <Text style={styles.sectionLabel}>Plans to join</Text>
            {planFeed.map((plan) => (
              <View key={`feed-${plan.id}`} style={styles.planCard}>
                {plan.sourceImageUrl ? (
                  <Image source={{ uri: plan.sourceImageUrl }} style={styles.planThumb} contentFit="cover" />
                ) : (
                  <View style={styles.planIcon}>
                    <Ionicons name={plan.sourceType === "event" ? "calendar" : "location"} size={18} color="#FF2D8D" />
                  </View>
                )}
                <View style={styles.personMain}>
                  <Text style={styles.planTitle}>{plan.title}</Text>
                  <Text style={styles.planMeta}>
                    {plan.timeLabel ?? plan.time ?? "Soon"} - {plan.sourceName ?? plan.location ?? "Miami"}
                  </Text>
                  <Text style={styles.personCity}>
                    {plan.peopleGoing ?? plan.members?.length ?? 1} going - Created by {firstName(plan.creator?.name)}
                  </Text>
                  <Pressable
                    onPress={() => handleRequestJoinPlan(plan)}
                    style={[styles.primaryButton, plan.joinRequestStatus === "pending" && styles.disabledButton]}
                    disabled={plan.joinRequestStatus === "pending"}
                  >
                    <Text style={styles.primaryButtonText}>
                      {plan.joinRequestStatus === "pending" ? "Requested" : "Request to Join"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        ) : null}
        {plans.length ? <Text style={styles.sectionLabel}>Your plans</Text> : null}
        {plans.map((plan) => (
          <View key={plan.id} style={styles.planCard}>
            <View style={styles.planIcon}>
              <Ionicons name="calendar" size={18} color="#FF2D8D" />
            </View>
            <View style={styles.personMain}>
              <Text style={styles.planTitle}>{plan.title}</Text>
              <Text style={styles.planMeta}>
                {plan.time ?? "Soon"} · {plan.location ?? "Miami"}
              </Text>
              <Text style={styles.personCity}>
                {plan.peopleGoing ?? plan.members?.length ?? 1} going · Created by {firstName(plan.creator?.name)}
              </Text>
              <Pressable
                onPress={() => openConnectThread(plan.chatId)}
                style={[styles.primaryButton, !plan.chatId && styles.disabledButton]}
                disabled={!plan.chatId}
              >
                <Text style={styles.primaryButtonText}>Open in Connect</Text>
              </Pressable>
              <Pressable onPress={() => handleSharePlan(plan)} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Share Plan</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
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
            <Text style={styles.subtitle}>Discover here. Continue in Connect.</Text>
          </View>
          <View style={styles.topBarActions}>
            <Pressable onPress={handleInviteFriends} style={styles.topIconButton}>
              <Ionicons name="share-social" size={18} color={FRIENDS_TEXT} />
            </Pressable>
            <Pressable onPress={() => setPlusMenuOpen(true)} style={styles.headerButton}>
              <Ionicons name="add" size={22} color="#0A0A0B" />
            </Pressable>
          </View>
        </View>

        <View style={styles.heroPanel}>
          <View style={styles.heroGlow} />
          <View style={styles.heroHeaderRow}>
            <Text style={styles.heroEyebrow}>Friends Discover</Text>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.livePillText}>Miami live</Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>Find the people. Build the plan.</Text>
          <Text style={styles.heroCopy}>Stories, suggestions, requests, and plans stay here. Every real thread lands in Connect.</Text>
          <View style={styles.heroActionRow}>
            <Pressable onPress={() => openCreatePlan()} style={styles.heroPrimary}>
              <Ionicons name="calendar" size={17} color="#0A0A0B" />
              <Text style={styles.heroPrimaryText}>New Plan</Text>
            </Pressable>
            <Pressable onPress={() => setStoryComposerOpen(true)} style={styles.heroSecondary}>
              <Ionicons name="add-circle" size={17} color={FRIENDS_PINK} />
              <Text style={styles.heroSecondaryText}>Story</Text>
            </Pressable>
          </View>
          <View style={styles.statsRow}>
            {hubStats.map((stat) => (
              <StatPill key={stat.label} label={stat.label} value={stat.value} />
            ))}
          </View>
        </View>

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

        <View style={styles.storyBand}>
          <View style={styles.storyBandHeader}>
            <Text style={styles.storyBandTitle}>24h stories</Text>
            <Text style={styles.storyBandMeta}>{stories.length} live</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storyRow}>
            <Pressable onPress={() => setStoryComposerOpen(true)} style={styles.storyPill}>
              <View style={styles.storyAddCircle}>
                <Ionicons name="add" size={18} color="#0A0A0B" />
              </View>
              <Text style={styles.storyLabel}>Your Story</Text>
            </Pressable>
            {stories.map((story) => (
              <Pressable key={story.id} onPress={() => setViewingStory(story)} style={styles.storyPill}>
                <Image source={{ uri: story.imageUrl || story.user.photoUrl || FALLBACK_PHOTO }} style={styles.storyPhoto} contentFit="cover" />
                <View style={styles.storyTypeDot}>
                  <Ionicons
                    name={story.type === "plan_invite" ? "calendar" : story.type === "photo" ? "camera" : "chatbubble"}
                    size={10}
                    color="#0A0A0B"
                  />
                </View>
                <Text style={styles.storyLabel} numberOfLines={1}>
                  {story.isOwn ? "You" : firstName(story.user.name)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.tabs}>
          {(["all", "people", "requests", "plans"] as FriendsView[]).map((tab) => (
            <Pressable key={tab} onPress={() => setActiveTab(tab)} style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}>
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === "all" ? "Discover" : tab === "people" ? "People" : tab === "requests" ? "Pending" : "Plans"}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <LoadingState />
        ) : activeTab === "all" ? (
          <View style={styles.stack}>
            <SectionHeader title="Suggested people" subtitle="Send requests here. Threads continue in Connect." />
            {renderPeople(false) ?? <EmptyState title="No people yet" text="Try another interest or check back soon." actionLabel="Find people" onAction={() => setActiveTab("people")} />}
            <SectionHeader title="Pending" subtitle="Friend requests and plan joins that need an answer." />
            {renderRequests(false) ?? <EmptyState title="No pending requests" text="New requests will show here." />}
            <SectionHeader title="Your plans" subtitle="Plan chats live in Connect after they are created." />
            {renderPlans(false) ?? <EmptyState title="No plans yet" text="Create one and keep the group thread in Connect." actionLabel="Create plan" onAction={() => openCreatePlan()} />}
          </View>
        ) : activeTab === "people" ? (
          renderPeople()
        ) : activeTab === "requests" ? (
          renderRequests()
        ) : (
          renderPlans()
        )}
      </ScrollView>

      {notice ? (
        <View style={[styles.notice, { bottom: bottomInset + 18 }]}>
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}

      <Modal transparent visible={plusMenuOpen} animationType="fade" onRequestClose={() => setPlusMenuOpen(false)}>
        <Pressable style={styles.plusOverlay} onPress={() => setPlusMenuOpen(false)}>
          <Pressable style={styles.plusMenu} onPress={(event) => event.stopPropagation()}>
            <View style={styles.plusMenuHeader}>
              <View>
                <Text style={styles.plusTitle}>Make something happen</Text>
                <Text style={styles.plusSubtitle}>Plans, invites, and stories from Friends.</Text>
              </View>
              <Pressable onPress={() => setPlusMenuOpen(false)} style={styles.plusClose}>
                <Ionicons name="close" size={18} color="#FFFFFF" />
              </Pressable>
            </View>
            <PlusAction icon="calendar" title="Create Plan" text="Pick a place, time, and invite people." onPress={() => openCreatePlan("event")} />
            <PlusAction icon="map" title="Plan from Map Spot" text="Build around a nearby venue or place." onPress={() => openCreatePlan("map")} />
            <PlusAction icon="calendar" title="Plan from Ticketmaster Event" text="Turn a live event into a group plan." onPress={() => openCreatePlan("event")} />
            <PlusAction icon="share-social" title="Invite Friends" text="Share ConnectSphere like a link." onPress={handleInviteFriends} />
            <PlusAction
              icon="add-circle"
              title="Post Story"
              text="Share a people-only story that starts action."
              onPress={() => {
                setPlusMenuOpen(false);
                setStoryComposerOpen(true);
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>

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

      <Modal transparent visible={storyComposerOpen} animationType="slide" onRequestClose={() => setStoryComposerOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <SheetHeader title="Add Story" onClose={() => setStoryComposerOpen(false)} />
            <View style={styles.storyTypeRow}>
              {STORY_TYPES.map((item) => (
                <Pressable key={item.id} onPress={() => setStoryType(item.id)} style={[styles.storyTypeButton, storyType === item.id && styles.storyTypeButtonActive]}>
                  <Text style={[styles.storyTypeText, storyType === item.id && styles.storyTypeTextActive]}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={storyText}
              onChangeText={setStoryText}
              placeholder={storyType === "plan_invite" ? "Who wants to join?" : "Going out tonight"}
              placeholderTextColor="#777783"
              style={styles.field}
            />
            {storyType === "photo" ? (
              <TextInput value={storyImageUrl} onChangeText={setStoryImageUrl} placeholder="Photo URL" placeholderTextColor="#777783" style={styles.field} />
            ) : null}
            {storyType === "plan_invite" ? <ChipGrid values={PLAN_TYPES} selected={storyPlanType} onSelect={setStoryPlanType} /> : null}
            <Pressable onPress={handleCreateStory} style={styles.sheetPrimary}>
              <Text style={styles.sheetPrimaryText}>Post Story</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={!!viewingStory} animationType="fade" onRequestClose={() => setViewingStory(null)}>
        {viewingStory ? (
          <View style={styles.storyViewer}>
            <Pressable onPress={() => setViewingStory(null)} style={styles.closeViewer}>
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </Pressable>
            <Image source={{ uri: viewingStory.imageUrl || viewingStory.user.photoUrl || FALLBACK_PHOTO }} style={styles.viewerImage} contentFit="cover" />
            <View style={styles.viewerOverlay} />
            <View style={styles.viewerBody}>
              <Text style={styles.viewerKicker}>
                {viewingStory.type === "plan_invite" ? `${viewingStory.planType ?? "Plan"} invite` : firstName(viewingStory.user.name)}
              </Text>
              <Text style={styles.viewerText}>{viewingStory.text || "Ready to make plans."}</Text>
              <View style={styles.viewerActions}>
                <Pressable onPress={() => reactToFriendStory(userId, viewingStory.id).then(() => showNotice("Reaction sent."))} style={styles.viewerAction}>
                  <Ionicons name="heart" size={18} color="#FF2D8D" />
                  <Text style={styles.viewerActionText}>React</Text>
                </Pressable>
                <Pressable onPress={handleStoryReply} style={styles.viewerAction}>
                  <Ionicons name="chatbubble" size={18} color="#FF2D8D" />
                  <Text style={styles.viewerActionText}>Reply</Text>
                </Pressable>
                <Pressable onPress={handleStoryConnect} style={styles.viewerAction}>
                  <Ionicons name={viewingStory.relationshipStatus === "friends" ? "checkmark-circle" : "person-add"} size={18} color="#FF2D8D" />
                  <Text style={styles.viewerActionText}>{viewingStory.relationshipStatus === "friends" ? "Friends" : "Connect"}</Text>
                </Pressable>
                <Pressable onPress={handleStoryPlan} style={styles.viewerAction}>
                  <Ionicons name="calendar" size={18} color="#FF2D8D" />
                  <Text style={styles.viewerActionText}>Plan</Text>
                </Pressable>
              </View>
              {viewingStory.type === "plan_invite" ? (
                <Pressable onPress={handleJoinStoryPlan} style={styles.joinPlanButton}>
                  <Text style={styles.joinPlanText}>Join Plan</Text>
                </Pressable>
              ) : null}
              <View style={styles.replyBox}>
                <TextInput
                  value={storyReplyText}
                  onChangeText={setStoryReplyText}
                  placeholder="Reply..."
                  placeholderTextColor="#777783"
                  style={styles.replyInput}
                />
                <Pressable onPress={handleStoryReply} style={styles.replyButton}>
                  <Ionicons name="send" size={17} color="#0A0A0B" />
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
    </View>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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

function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <View style={styles.sheetHeader}>
      <Text style={styles.sheetTitle}>{title}</Text>
      <Pressable onPress={onClose} style={styles.sheetClose}>
        <Ionicons name="close" size={19} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

function ChipGrid({ values, selected, onSelect }: { values: string[]; selected: string; onSelect: (value: string) => void }) {
  return (
    <View style={styles.chipGrid}>
      {values.map((value) => (
        <Pressable key={value} onPress={() => onSelect(value)} style={[styles.typeChip, selected === value && styles.typeChipActive]}>
          <Text style={[styles.typeChipText, selected === value && styles.typeChipTextActive]}>{value}</Text>
        </Pressable>
      ))}
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
  topBarActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  topIconButton: {
    alignItems: "center",
    backgroundColor: "#0f0f12",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
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
  heroPanel: {
    backgroundColor: "#060006",
    borderColor: "rgba(255,45,168,0.42)",
    borderRadius: 30,
    borderWidth: 1,
    gap: 14,
    overflow: "hidden",
    padding: 18,
    position: "relative",
    shadowColor: FRIENDS_PINK,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.28,
    shadowRadius: 28,
  },
  heroGlow: {
    backgroundColor: "rgba(255,45,168,0.18)",
    borderRadius: 120,
    height: 210,
    position: "absolute",
    right: -86,
    top: -88,
    width: 210,
  },
  heroHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  heroEyebrow: {
    color: FRIENDS_PINK,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  livePill: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  liveDot: {
    backgroundColor: "#22c55e",
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  livePillText: {
    color: FRIENDS_TEXT,
    fontSize: 11,
    fontWeight: "900",
  },
  heroTitle: {
    color: FRIENDS_TEXT,
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 36,
    maxWidth: 290,
  },
  heroCopy: {
    color: "#d4d4d8",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
    maxWidth: 310,
  },
  heroActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  heroPrimary: {
    alignItems: "center",
    backgroundColor: FRIENDS_PINK,
    borderRadius: 18,
    flex: 1,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    minHeight: 48,
  },
  heroPrimaryText: {
    color: "#0A0A0B",
    fontSize: 14,
    fontWeight: "900",
  },
  heroSecondary: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    minHeight: 48,
  },
  heroSecondaryText: {
    color: FRIENDS_TEXT,
    fontSize: 14,
    fontWeight: "900",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statPill: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  statValue: {
    color: FRIENDS_TEXT,
    fontSize: 20,
    fontWeight: "900",
  },
  statLabel: {
    color: FRIENDS_MUTED,
    fontSize: 11,
    fontWeight: "900",
    marginTop: 2,
    textTransform: "uppercase",
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
  storyBand: {
    backgroundColor: "#050505",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  storyBandHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  storyBandTitle: {
    color: FRIENDS_TEXT,
    fontSize: 16,
    fontWeight: "900",
  },
  storyBandMeta: {
    color: FRIENDS_PINK,
    fontSize: 12,
    fontWeight: "900",
  },
  storyRow: {
    gap: 12,
    paddingRight: 4,
  },
  storyPill: {
    alignItems: "center",
    gap: 7,
    position: "relative",
    width: 74,
  },
  storyAddCircle: {
    alignItems: "center",
    backgroundColor: FRIENDS_PINK,
    borderRadius: 28,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  storyPhoto: {
    borderColor: FRIENDS_PINK,
    borderRadius: 28,
    borderWidth: 2,
    height: 56,
    width: 56,
  },
  storyTypeDot: {
    alignItems: "center",
    backgroundColor: FRIENDS_PINK,
    borderColor: FRIENDS_BLACK,
    borderRadius: 10,
    borderWidth: 2,
    height: 20,
    justifyContent: "center",
    position: "absolute",
    right: 7,
    top: 36,
    width: 20,
  },
  storyPromptCircle: {
    alignItems: "center",
    backgroundColor: "rgba(255,45,141,0.14)",
    borderColor: "rgba(255,45,141,0.34)",
    borderRadius: 28,
    borderWidth: 1,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  storyPromptInitial: {
    color: "#FF8BC4",
    fontSize: 18,
    fontWeight: "900",
  },
  storyLabel: {
    color: FRIENDS_TEXT,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    width: 74,
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
  tabText: {
    color: "#B7B7C2",
    fontSize: 13,
    fontWeight: "800",
  },
  tabTextActive: {
    color: "#0A0A0B",
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
  personCard: {
    backgroundColor: "#050505",
    borderColor: "rgba(255,45,168,0.2)",
    borderRadius: 28,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    padding: 14,
    shadowColor: FRIENDS_PINK,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
  },
  requestCard: {
    backgroundColor: "#070707",
    borderColor: "rgba(255,45,168,0.28)",
    borderRadius: 28,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    padding: 14,
  },
  avatar: {
    backgroundColor: "#141419",
    borderColor: "rgba(255,45,168,0.55)",
    borderRadius: 32,
    borderWidth: 2,
    height: 82,
    width: 82,
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
    fontSize: 19,
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
  interestRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
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
  buttonRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
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
  disabledButton: {
    opacity: 0.55,
  },
  requestMessage: {
    color: "#E7E7EF",
    fontSize: 13,
    lineHeight: 18,
  },
  planCard: {
    backgroundColor: "#050505",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 28,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 16,
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
  notice: {
    alignSelf: "center",
    backgroundColor: "#141419",
    borderColor: "rgba(255,45,141,0.32)",
    borderRadius: 18,
    borderWidth: 1,
    left: 18,
    paddingHorizontal: 14,
    paddingVertical: 11,
    position: "absolute",
    right: 18,
  },
  noticeText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
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
  modalOverlay: {
    backgroundColor: "rgba(0,0,0,0.68)",
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#101014",
    borderColor: "rgba(255,45,141,0.22)",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    gap: 12,
    padding: 18,
    paddingBottom: 26,
  },
  sheetHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sheetTitle: {
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "900",
  },
  sheetClose: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  sheetSubtitle: {
    color: "#A1A1AA",
    fontSize: 14,
    lineHeight: 20,
  },
  field: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    borderWidth: 1,
    color: "#FFFFFF",
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  typeChip: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  typeChipActive: {
    backgroundColor: "#FF2D8D",
    borderColor: "#FF2D8D",
  },
  typeChipText: {
    color: "#EDEDF2",
    fontSize: 13,
    fontWeight: "800",
  },
  typeChipTextActive: {
    color: "#0A0A0B",
  },
  sheetLabel: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  inviteList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  inviteChip: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inviteChipActive: {
    backgroundColor: "#FF2D8D",
    borderColor: "#FF2D8D",
  },
  inviteText: {
    color: "#EDEDF2",
    fontSize: 13,
    fontWeight: "800",
  },
  inviteTextActive: {
    color: "#0A0A0B",
  },
  mutedText: {
    color: "#A1A1AA",
    fontSize: 13,
  },
  sheetPrimary: {
    alignItems: "center",
    backgroundColor: "#FF2D8D",
    borderRadius: 17,
    justifyContent: "center",
    minHeight: 50,
  },
  sheetPrimaryText: {
    color: "#0A0A0B",
    fontSize: 15,
    fontWeight: "900",
  },
  storyTypeRow: {
    flexDirection: "row",
    gap: 8,
  },
  storyTypeButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 15,
    flex: 1,
    paddingVertical: 10,
  },
  storyTypeButtonActive: {
    backgroundColor: "#FF2D8D",
  },
  storyTypeText: {
    color: "#EDEDF2",
    fontSize: 12,
    fontWeight: "900",
  },
  storyTypeTextActive: {
    color: "#0A0A0B",
  },
  storyViewer: {
    backgroundColor: "#050506",
    flex: 1,
  },
  closeViewer: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 18,
    height: 38,
    justifyContent: "center",
    position: "absolute",
    right: 18,
    top: 54,
    width: 38,
    zIndex: 3,
  },
  viewerImage: {
    height: "100%",
    position: "absolute",
    width: "100%",
  },
  viewerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.48)",
  },
  viewerBody: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 20,
    paddingBottom: 34,
  },
  viewerKicker: {
    color: "#FF8BC4",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  viewerText: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 40,
    marginBottom: 18,
  },
  viewerActions: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  viewerAction: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.11)",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 44,
  },
  viewerActionText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  joinPlanButton: {
    alignItems: "center",
    backgroundColor: "#FF2D8D",
    borderRadius: 17,
    justifyContent: "center",
    marginBottom: 12,
    minHeight: 48,
  },
  joinPlanText: {
    color: "#0A0A0B",
    fontSize: 15,
    fontWeight: "900",
  },
  replyBox: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  replyInput: {
    color: "#FFFFFF",
    flex: 1,
    fontSize: 15,
    minHeight: 36,
  },
  replyButton: {
    alignItems: "center",
    backgroundColor: "#FF2D8D",
    borderRadius: 16,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  sectionHeader: {
    gap: 3,
    marginTop: 4,
  },
  sectionTitle: {
    color: FRIENDS_TEXT,
    fontSize: 18,
    fontWeight: "900",
  },
  sectionSubtitle: {
    color: FRIENDS_MUTED,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
});
