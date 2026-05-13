import { useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  connectLabel,
  firstName,
  personLocation,
  planVenue,
  planWhen,
  requestKindLabel,
  titleTag,
} from "@/components/friends/friendsLabels";
import { selectTodayCommand, type TodayCommand } from "@/components/friends/friendsMissionControl";

import {
  createFriendPlan,
  getFriendPeople,
  getFriendPlans,
  getFriendPlansFeed,
  getFriendRequests,
  getFriendStories,
  requestJoinFriendPlan,
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

type FriendsView = "people" | "requests" | "plans";
type PlanSourceTab = "map" | "event";
const FRIENDS_PINK = "#ff2da8";
const FRIENDS_BLACK = "#000000";
const FRIENDS_TEXT = "#f4f4f5";
const FRIENDS_MUTED = "#a1a1aa";
const APP_SHARE_URL = "https://connectsphere.app";

const FALLBACK_PHOTO =
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=85";

function openConnectThread(chatId?: string) {
  if (!chatId) return;
  router.push({ pathname: "/(tabs)/matches", params: { openChatId: chatId } } as never);
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

function successHaptic() {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export default function FriendsTab({ bottomInset = 0 }: FriendsTabProps) {
  const { user } = useUser();
  const userId = user?.id ?? "user_self";

  const [activeTab, setActiveTab] = useState<FriendsView>("people");
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
  const [selectedPerson, setSelectedPerson] = useState<FriendPerson | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<FriendPlan | null>(null);

  const friends = useMemo(() => people.filter((person) => person.relationshipStatus === "friends"), [people]);
  const todayCommand: TodayCommand = useMemo(
    () => selectTodayCommand({ people, requests, plans, planFeed, stories }),
    [people, requests, plans, planFeed, stories],
  );

  const loadFriends = useCallback(async () => {
    setLoading(true);
    try {
      const [peopleResult, requestResult, planResult, feedResult, storiesResult] = await Promise.all([
        getFriendPeople(userId, search),
        getFriendRequests(userId),
        getFriendPlans(userId),
        getFriendPlansFeed(userId),
        getFriendStories(userId).catch(() => ({ stories: [] })),
      ]);
      setPeople(peopleResult.people ?? []);
      setRequests(requestResult.requests ?? []);
      setPlans(planResult.plans ?? []);
      setPlanFeed(feedResult.plans ?? []);
      setStories(storiesResult.stories ?? []);
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
          setActiveTab("requests");
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

  const renderPeople = (showEmpty = true) => {
    if (loading) return <LoadingState />;
    if (!people.length) {
      return showEmpty ? <EmptyState title="No people yet" text="Try searching another interest or check back soon." /> : null;
    }
    return (
      <View style={styles.stack}>
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
              </View>
              <Text style={styles.personCity}>{person.location ?? person.city ?? "Miami"}</Text>
              <View style={styles.interestRow}>
                {(person.interests ?? []).slice(0, 3).map((interest) => (
                  <View key={interest} style={styles.interestChip}>
                    <Text style={styles.interestText}>{interest}</Text>
                  </View>
                ))}
              </View>
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
                  style={[styles.primaryButton, person.relationshipStatus === "requested" && styles.disabledButton]}
                  disabled={person.relationshipStatus === "requested"}
                >
                  <Text style={styles.primaryButtonText}>{connectLabel(person)}</Text>
                </Pressable>
                <Pressable
                  onPress={(event) => {
                    event.stopPropagation();
                    openPlanForPerson(person);
                  }}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Plan</Text>
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
    if (!requests.length) {
      return showEmpty ? <EmptyState title="No requests" text="Friend requests and plan joins will show here." /> : null;
    }
    return (
      <View style={styles.stack}>
        {requests.map((request) => {
          const outgoing = request.direction === "outgoing";
          const displayUser = outgoing ? request.toUser ?? request.fromUser : request.fromUser;
          const isPlanJoin = request.requestType === "plan_join" || request.kind === "plan_join";
          const isPlanInvite = request.kind === "plan_invite";
          const title = outgoing ? `Sent to ${firstName(displayUser?.name)}` : displayUser?.name ?? "Someone";
          const message = outgoing
            ? isPlanJoin
              ? `Waiting on ${firstName(request.toUser?.name)} to approve ${request.plan?.title ?? "the plan"}.`
              : isPlanInvite
                ? `Plan invite sent for ${request.plan?.title ?? "your plan"}.`
                : "Friend request sent. They'll see it in Connect."
            : isPlanJoin
              ? `Wants to join ${request.plan?.title ?? "your plan"}`
              : request.message ?? "Wants to connect";
          const chips = (isPlanJoin
            ? [request.plan?.timeLabel ?? request.plan?.time ?? "Soon", request.plan ? planVenue(request.plan) : "Miami"]
            : request.sharedInterests ?? []).filter(Boolean).slice(0, 3);

          return (
            <View key={request.id} style={[styles.requestCard, outgoing && styles.requestCardSent]}>
              <Image source={{ uri: displayUser?.photoUrl ?? FALLBACK_PHOTO }} style={styles.avatar} contentFit="cover" />
              <View style={styles.personMain}>
                <View style={styles.requestTopRow}>
                  <Text style={styles.personName}>
                    {title}
                    {!outgoing && displayUser?.age ? `, ${displayUser.age}` : ""}
                  </Text>
                  <View style={[styles.statusBadge, outgoing && styles.sentBadge]}>
                    <Text style={[styles.statusText, outgoing && styles.sentBadgeText]}>{outgoing ? "Sent" : "New"}</Text>
                  </View>
                </View>
                <Text style={styles.personCity}>{personLocation(displayUser ?? request.fromUser)}</Text>
                <Text style={styles.requestMessage} numberOfLines={2}>{message}</Text>
                <View style={styles.interestRow}>
                  {chips.map((interest) => (
                    <View key={String(interest)} style={styles.interestChip}>
                      <Text style={styles.interestText}>{String(interest)}</Text>
                    </View>
                  ))}
                </View>
                {outgoing ? (
                  <View style={styles.pendingSentRow}>
                    <Ionicons name="time-outline" size={15} color="#FF8BC4" />
                    <Text style={styles.pendingSentText}>Waiting for them</Text>
                  </View>
                ) : (
                  <View style={styles.buttonRow}>
                    <Pressable onPress={() => handleRequest(request, "accept")} style={styles.primaryButton}>
                      <Text style={styles.primaryButtonText}>Accept</Text>
                    </Pressable>
                    <Pressable onPress={() => handleRequest(request, "ignore")} style={styles.secondaryButton}>
                      <Text style={styles.secondaryButtonText}>{isPlanJoin ? "Decline" : "Ignore"}</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          );
        })}
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
              <Pressable key={`feed-${plan.id}`} onPress={() => setSelectedPlan(plan)} style={styles.planCard}>
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
                    {planWhen(plan)} - {planVenue(plan)}
                  </Text>
                  <View style={styles.planSocialRow}>
                    <View style={[styles.planPulsePill, planIsLive(plan) && styles.planPulsePillLive]}>
                      <View style={[styles.planPulseDot, planIsLive(plan) && styles.planPulseDotLive]} />
                      <Text style={styles.planPulseText}>{planSocialLabel(plan)}</Text>
                    </View>
                    <View style={styles.planMiniPill}>
                      <Text style={styles.planMiniPillText}>{planInterestLabel(plan)}</Text>
                    </View>
                  </View>
                  <Text style={styles.personCity}>
                    Hosted by {firstName(plan.creator?.name)} - tap for details
                  </Text>
                  <Pressable
                    onPress={(event) => {
                      event.stopPropagation();
                      handleRequestJoinPlan(plan);
                    }}
                    style={[styles.primaryButton, plan.joinRequestStatus === "pending" && styles.disabledButton]}
                    disabled={plan.joinRequestStatus === "pending"}
                  >
                    <Text style={styles.primaryButtonText}>
                      {plan.joinRequestStatus === "pending" ? "Requested" : "Request to Join"}
                    </Text>
                  </Pressable>
                </View>
              </Pressable>
            ))}
          </>
        ) : null}
        {plans.length ? <Text style={styles.sectionLabel}>Your plans</Text> : null}
        {plans.map((plan) => (
          <Pressable key={plan.id} onPress={() => setSelectedPlan(plan)} style={styles.planCard}>
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
              <View style={styles.planSocialRow}>
                <View style={[styles.planPulsePill, planIsLive(plan) && styles.planPulsePillLive]}>
                  <View style={[styles.planPulseDot, planIsLive(plan) && styles.planPulseDotLive]} />
                  <Text style={styles.planPulseText}>{planSocialLabel(plan)}</Text>
                </View>
                <View style={styles.planMiniPill}>
                  <Text style={styles.planMiniPillText}>{planInterestLabel(plan)}</Text>
                </View>
              </View>
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  openConnectThread(plan.chatId);
                }}
                style={[styles.primaryButton, !plan.chatId && styles.disabledButton]}
                disabled={!plan.chatId}
              >
                <Text style={styles.primaryButtonText}>Open in Connect</Text>
              </Pressable>
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  handleSharePlan(plan);
                }}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Share Plan</Text>
              </Pressable>
            </View>
          </Pressable>
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
            <Text style={styles.subtitle}>Invite, connect, plan.</Text>
          </View>
          <Pressable onPress={() => setPlusMenuOpen(true)} style={styles.headerButton}>
            <Ionicons name="add" size={22} color="#0A0A0B" />
          </Pressable>
        </View>

        <View style={styles.actionRow}>
          <Pressable onPress={handleInviteFriends} style={styles.actionPrimary}>
            <Ionicons name="share-social" size={17} color="#0A0A0B" />
            <Text style={styles.actionPrimaryText}>Invite People</Text>
          </Pressable>
          <Pressable onPress={() => openCreatePlan()} style={styles.actionSecondary}>
            <Ionicons name="calendar" size={17} color={FRIENDS_PINK} />
            <Text style={styles.actionSecondaryText}>New Plan</Text>
          </Pressable>
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

        <View style={styles.tabs}>
          {(["people", "requests", "plans"] as FriendsView[]).map((tab) => (
            <Pressable key={tab} onPress={() => setActiveTab(tab)} style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}>
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === "people" ? "People" : tab === "requests" ? "Pending" : "Plans"}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
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
                <Text style={styles.plusSubtitle}>Invite people or create a plan.</Text>
              </View>
              <Pressable onPress={() => setPlusMenuOpen(false)} style={styles.plusClose}>
                <Ionicons name="close" size={18} color="#FFFFFF" />
              </Pressable>
            </View>
            <PlusAction icon="share-social" title="Invite People" text="Share ConnectSphere outside the app." onPress={handleInviteFriends} />
            <PlusAction icon="calendar" title="Create Plan" text="Pick a place, time, and invite people." onPress={() => openCreatePlan("event")} />
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

      <Modal visible={!!selectedPerson} animationType="slide" onRequestClose={() => setSelectedPerson(null)}>
        {selectedPerson ? (
          <FriendProfileSheet
            person={selectedPerson}
            connectLabel={connectLabel(selectedPerson)}
            onClose={() => setSelectedPerson(null)}
            onConnect={() => {
              const person = selectedPerson;
              setSelectedPerson(null);
              handleConnect(person);
            }}
            onPlan={() => {
              const person = selectedPerson;
              setSelectedPerson(null);
              openPlanForPerson(person);
            }}
          />
        ) : null}
      </Modal>

      <Modal transparent visible={!!selectedPlan} animationType="slide" onRequestClose={() => setSelectedPlan(null)}>
        {selectedPlan ? (
          <PlanDetailSheet
            plan={selectedPlan}
            bottomInset={bottomInset}
            onClose={() => setSelectedPlan(null)}
            onOpenConnect={() => {
              const chatId = selectedPlan.chatId;
              setSelectedPlan(null);
              openConnectThread(chatId);
            }}
            onShare={() => handleSharePlan(selectedPlan)}
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

function FriendProfileSheet({
  person,
  connectLabel,
  onClose,
  onConnect,
  onPlan,
}: {
  person: FriendPerson;
  connectLabel: string;
  onClose: () => void;
  onConnect: () => void;
  onPlan: () => void;
}) {
  const insets = useSafeAreaInsets();
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
            <View style={styles.profileHeroPill}>
              <Ionicons name="people" size={14} color="#FF8BC4" />
              <Text style={styles.profileHeroPillText}>Friends</Text>
            </View>
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

          <View style={styles.profileStatsRow}>
            <ProfileStat icon="sparkles" label="Energy" value={person.energy ?? "Ready for plans"} />
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
          style={[styles.profilePrimaryAction, primaryDisabled && styles.disabledButton]}
          disabled={primaryDisabled}
        >
          <Ionicons name={person.relationshipStatus === "friends" ? "chatbubble" : "person-add"} size={18} color="#0A0A0B" />
          <Text style={styles.profilePrimaryActionText}>{connectLabel}</Text>
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
  onClose,
  onOpenConnect,
  onShare,
  onJoin,
}: {
  plan: FriendPlan;
  bottomInset: number;
  onClose: () => void;
  onOpenConnect: () => void;
  onShare: () => void;
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
              <Pressable onPress={onJoin} disabled={joinPending} style={[styles.profilePrimaryAction, joinPending && styles.disabledButton]}>
                <Ionicons name="person-add" size={18} color="#0A0A0B" />
                <Text style={styles.profilePrimaryActionText}>{joinPending ? "Requested" : "Request Join"}</Text>
              </Pressable>
            )}
            <Pressable onPress={onShare} style={styles.profileSecondaryAction}>
              <Ionicons name="share-social" size={18} color="#FFFFFF" />
              <Text style={styles.profileSecondaryActionText}>Share</Text>
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
});
