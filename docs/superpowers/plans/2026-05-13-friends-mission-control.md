# Friends Mission Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current Friends tab into a launch-ready mission control experience with a clear next action, live friend signals, stronger people/request/plan organization, and complete Connect handoff behavior that keeps ongoing chat and coordination in the Connect tab.

**Architecture:** Keep `FriendsTab` as the screen orchestrator, but move decision logic and display sections into focused files under `artifacts/connectsphere-mobile/components/friends/`. Reuse the existing Friends API surface and keep Live Friend Signals compact, functional, and optional rather than a full social-story feed. Friends drives discovery and decisions; Connect owns every ongoing chat, accepted friendship, and plan thread.

**Tech Stack:** Expo Router, React Native, TypeScript, Clerk user identity, existing `friendsApi.ts`, existing Express friends routes, Ionicons, expo-image, expo-linear-gradient, expo-haptics.

---

## File Structure

- Create `artifacts/connectsphere-mobile/components/friends/friendsLabels.ts`
  - Pure label and formatting helpers for relationship actions, plan labels, request labels, and signal labels.
- Create `artifacts/connectsphere-mobile/components/friends/friendsMissionControl.ts`
  - Pure selection logic for the Today Command Center.
- Create `artifacts/connectsphere-mobile/components/friends/TodayCommandCenter.tsx`
  - Displays the single strongest next action.
- Create `artifacts/connectsphere-mobile/components/friends/FriendSignalsRow.tsx`
  - Displays compact Live Friend Signals from existing story APIs.
- Create `artifacts/connectsphere-mobile/components/friends/PendingInboxSection.tsx`
  - Displays clearer pending request cards.
- Create `artifacts/connectsphere-mobile/components/friends/PlansHubSection.tsx`
  - Displays plan groups: Tonight / Upcoming, Plans to Join, Your Plans.
- Modify `artifacts/connectsphere-mobile/components/FriendsTab.tsx`
  - Load signals, wire new sections, keep orchestration and modals.
- Modify `artifacts/connectsphere-mobile/services/friendsApi.ts`
  - Add small response types only if type gaps appear while wiring signals.
- Optional modify `artifacts/api-server/src/routes/friends.ts`
  - Only if signal response shape needs a field already present in the database but not returned.

Do not add a full feed. Live Friend Signals must stay lightweight and action-oriented.

The broad 18-50 hook is relevance and momentum, not trend-heavy posting. Every section should answer: who should I meet, why them, what can I do now, and where does it continue in Connect?

---

### Task 1: Create Shared Friends Labels

**Files:**
- Create: `artifacts/connectsphere-mobile/components/friends/friendsLabels.ts`
- Modify: `artifacts/connectsphere-mobile/components/FriendsTab.tsx`

- [ ] **Step 1: Create the helper file**

Add `artifacts/connectsphere-mobile/components/friends/friendsLabels.ts`:

```ts
import type { FriendPerson, FriendPlan, FriendRequest, FriendStory } from "@/services/friendsApi";

export function firstName(name?: string) {
  return (name ?? "Someone").split(" ")[0] || "Someone";
}

export function titleTag(value?: string) {
  return (value ?? "")
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function personLocation(person: Pick<FriendPerson, "location" | "neighborhood" | "city">) {
  return person.location ?? person.neighborhood ?? person.city ?? "Miami";
}

export function connectLabel(person: Pick<FriendPerson, "relationshipStatus">) {
  if (person.relationshipStatus === "friends") return "Message";
  if (person.relationshipStatus === "requested") return "Requested";
  if (person.relationshipStatus === "incoming") return "Accept";
  return "Connect";
}

export function requestKindLabel(request: FriendRequest) {
  if (request.requestType === "plan_join" || request.kind === "plan_join") return "Plan join";
  if (request.kind === "plan_invite") return "Plan invite";
  if (request.kind === "story_reply") return "Moment reply";
  return "Friend request";
}

export function planVenue(plan: FriendPlan) {
  return plan.sourceName ?? plan.location ?? "Miami";
}

export function planWhen(plan: FriendPlan) {
  return plan.timeLabel ?? plan.time ?? "Soon";
}

export function signalTitle(story: FriendStory) {
  if (story.type === "plan_invite") return story.planType ? `${story.planType} plan` : "Open plan";
  if (story.type === "photo") return "Out now";
  return "Friend signal";
}
```

- [ ] **Step 2: Run typecheck and confirm the new helper compiles**

Run:

```powershell
pnpm.cmd --filter @workspace/connectsphere-mobile typecheck
```

Expected: existing project typecheck result. If it fails because the file is not imported yet, fix the helper export/import issue before moving on.

- [ ] **Step 3: Replace duplicated helper definitions in `FriendsTab.tsx`**

In `artifacts/connectsphere-mobile/components/FriendsTab.tsx`, import:

```ts
import {
  connectLabel,
  firstName,
  personLocation,
  planVenue,
  planWhen,
  requestKindLabel,
  titleTag,
} from "@/components/friends/friendsLabels";
```

Remove the local duplicate implementations of `firstName`, `titleTag`, `personLocation`, `planVenue`, `planWhen`, and the local `connectLabel`.

- [ ] **Step 4: Run typecheck after the helper extraction**

Run:

```powershell
pnpm.cmd --filter @workspace/connectsphere-mobile typecheck
```

Expected: no new errors caused by helper extraction.

- [ ] **Step 5: Commit**

```powershell
git add -- artifacts/connectsphere-mobile/components/friends/friendsLabels.ts artifacts/connectsphere-mobile/components/FriendsTab.tsx
git commit -m "Refactor friends labels"
```

---

### Task 2: Add Today Command Selection Logic

**Files:**
- Create: `artifacts/connectsphere-mobile/components/friends/friendsMissionControl.ts`
- Modify: `artifacts/connectsphere-mobile/components/FriendsTab.tsx`

- [ ] **Step 1: Create the command model**

Add `artifacts/connectsphere-mobile/components/friends/friendsMissionControl.ts`:

```ts
import type { FriendPerson, FriendPlan, FriendRequest, FriendStory } from "@/services/friendsApi";
import { connectLabel, firstName, planVenue, planWhen } from "./friendsLabels";

export type TodayCommand =
  | { kind: "request"; label: string; title: string; reason: string; primaryLabel: string; request: FriendRequest }
  | { kind: "plan"; label: string; title: string; reason: string; primaryLabel: string; plan: FriendPlan }
  | { kind: "person"; label: string; title: string; reason: string; primaryLabel: string; person: FriendPerson }
  | { kind: "signal"; label: string; title: string; reason: string; primaryLabel: string; story: FriendStory }
  | { kind: "create_plan"; label: string; title: string; reason: string; primaryLabel: string };

function isPlanJoin(request: FriendRequest) {
  return request.requestType === "plan_join" || request.kind === "plan_join";
}

function incomingRequest(request: FriendRequest) {
  return request.direction !== "outgoing";
}

export function selectTodayCommand(input: {
  people: FriendPerson[];
  requests: FriendRequest[];
  plans: FriendPlan[];
  planFeed: FriendPlan[];
  stories: FriendStory[];
}): TodayCommand {
  const incoming = input.requests.find((request) => incomingRequest(request));
  if (incoming) {
    const actor = incoming.fromUser?.name ?? "Someone";
    return {
      kind: "request",
      label: isPlanJoin(incoming) ? "Plan request" : "Needs reply",
      title: isPlanJoin(incoming) ? `${firstName(actor)} wants to join` : `Accept ${firstName(actor)}?`,
      reason: incoming.plan?.title ?? incoming.message ?? "They want to connect with you.",
      primaryLabel: isPlanJoin(incoming) ? "Review" : "Accept",
      request: incoming,
    };
  }

  const upcomingPlan = input.plans.find((plan) => !!plan.chatId);
  if (upcomingPlan) {
    return {
      kind: "plan",
      label: "Upcoming plan",
      title: upcomingPlan.title,
      reason: `${planWhen(upcomingPlan)} at ${planVenue(upcomingPlan)}.`,
      primaryLabel: "Open Connect",
      plan: upcomingPlan,
    };
  }

  const smartPerson =
    input.people.find((person) => person.relationshipStatus === "incoming") ??
    input.people.find((person) => person.relationshipStatus === "none") ??
    input.people[0];
  if (smartPerson) {
    const reason =
      smartPerson.smartReason ??
      smartPerson.compatibility?.signals?.slice(0, 2).join(" • ") ??
      "Good local fit.";
    return {
      kind: "person",
      label: "Best next move",
      title: `${firstName(smartPerson.name)} looks like a fit`,
      reason,
      primaryLabel: connectLabel(smartPerson),
      person: smartPerson,
    };
  }

  const joinablePlan = input.planFeed.find((plan) => plan.joinRequestStatus !== "pending");
  if (joinablePlan) {
    return {
      kind: "plan",
      label: "Plan nearby",
      title: joinablePlan.title,
      reason: `${planWhen(joinablePlan)} at ${planVenue(joinablePlan)}.`,
      primaryLabel: "Request Join",
      plan: joinablePlan,
    };
  }

  const story = input.stories.find((item) => !item.isOwn);
  if (story) {
    return {
      kind: "signal",
      label: "Live signal",
      title: story.text ?? "Someone is open to plans",
      reason: `${firstName(story.user?.name)} posted a lightweight friend signal.`,
      primaryLabel: "Reply",
      story,
    };
  }

  return {
    kind: "create_plan",
    label: "Start something",
    title: "Make a friend plan",
    reason: "Pick a place, time, and invite someone low-pressure.",
    primaryLabel: "Create Plan",
  };
}
```

- [ ] **Step 2: Import and derive the command in `FriendsTab.tsx`**

Add imports:

```ts
import { selectTodayCommand, type TodayCommand } from "@/components/friends/friendsMissionControl";
import { getFriendStories, type FriendStory } from "@/services/friendsApi";
```

Add state:

```ts
const [stories, setStories] = useState<FriendStory[]>([]);
```

Update `loadFriends` Promise list to include stories:

```ts
const [peopleResult, requestResult, planResult, feedResult, storiesResult] = await Promise.all([
  getFriendPeople(userId, search),
  getFriendRequests(userId),
  getFriendPlans(userId),
  getFriendPlansFeed(userId),
  getFriendStories(userId),
]);
setStories(storiesResult.stories ?? []);
```

Add derived command:

```ts
const todayCommand = useMemo(
  () => selectTodayCommand({ people, requests, plans, planFeed, stories }),
  [people, requests, plans, planFeed, stories],
);
```

- [ ] **Step 3: Run typecheck**

Run:

```powershell
pnpm.cmd --filter @workspace/connectsphere-mobile typecheck
```

Expected: errors only if names conflict during integration. Fix by aligning imports and local state.

- [ ] **Step 4: Commit**

```powershell
git add -- artifacts/connectsphere-mobile/components/friends/friendsMissionControl.ts artifacts/connectsphere-mobile/components/FriendsTab.tsx
git commit -m "Add friends command selection"
```

---

### Task 3: Render Today Command Center

**Files:**
- Create: `artifacts/connectsphere-mobile/components/friends/TodayCommandCenter.tsx`
- Modify: `artifacts/connectsphere-mobile/components/FriendsTab.tsx`

- [ ] **Step 1: Create the component**

Add `artifacts/connectsphere-mobile/components/friends/TodayCommandCenter.tsx`:

```tsx
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { TodayCommand } from "./friendsMissionControl";

type Props = {
  command: TodayCommand;
  onPrimary: (command: TodayCommand) => void;
  onSecondary?: (command: TodayCommand) => void;
};

export default function TodayCommandCenter({ command, onPrimary, onSecondary }: Props) {
  const showSecondary = command.kind === "person" || command.kind === "plan";

  return (
    <LinearGradient colors={["rgba(255,45,168,0.24)", "rgba(255,255,255,0.06)"]} style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.icon}>
          <Ionicons name="sparkles" size={18} color="#0A0A0B" />
        </View>
        <Text style={styles.label}>{command.label}</Text>
      </View>
      <Text style={styles.title}>{command.title}</Text>
      <Text style={styles.reason}>{command.reason}</Text>
      <View style={styles.actions}>
        <Pressable onPress={() => onPrimary(command)} style={styles.primary}>
          <Text style={styles.primaryText}>{command.primaryLabel}</Text>
        </Pressable>
        {showSecondary && onSecondary ? (
          <Pressable onPress={() => onSecondary(command)} style={styles.secondary}>
            <Text style={styles.secondaryText}>{command.kind === "person" ? "Make Plan" : "Share"}</Text>
          </Pressable>
        ) : null}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderColor: "rgba(255,45,168,0.28)",
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  topRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  icon: {
    alignItems: "center",
    backgroundColor: "#FF2D8D",
    borderRadius: 15,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  label: { color: "#FFB6D9", fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  title: { color: "#FFFFFF", fontSize: 22, fontWeight: "900" },
  reason: { color: "#EDEDF2", fontSize: 13, fontWeight: "700", lineHeight: 19 },
  actions: { flexDirection: "row", gap: 10, marginTop: 2 },
  primary: {
    alignItems: "center",
    backgroundColor: "#FF2D8D",
    borderRadius: 16,
    flex: 1,
    justifyContent: "center",
    minHeight: 46,
  },
  primaryText: { color: "#0A0A0B", fontSize: 14, fontWeight: "900" },
  secondary: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.09)",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 16,
  },
  secondaryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
});
```

- [ ] **Step 2: Wire actions in `FriendsTab.tsx`**

Add import:

```ts
import TodayCommandCenter from "@/components/friends/TodayCommandCenter";
```

Add handlers:

```ts
const handleTodayPrimary = useCallback((command: TodayCommand) => {
  if (command.kind === "request") {
    setActiveTab("requests");
    return;
  }
  if (command.kind === "plan") {
    if (command.plan.chatId && (command.plan.isMember || command.plan.isCreator)) openConnectThread(command.plan.chatId);
    else setSelectedPlan(command.plan);
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
}, [handleConnect, openCreatePlan]);

const handleTodaySecondary = useCallback((command: TodayCommand) => {
  if (command.kind === "person") openPlanForPerson(command.person);
  if (command.kind === "plan") handleSharePlan(command.plan);
}, [handleSharePlan, openPlanForPerson]);
```

Render below the top action row and above search:

```tsx
<TodayCommandCenter command={todayCommand} onPrimary={handleTodayPrimary} onSecondary={handleTodaySecondary} />
```

- [ ] **Step 3: Run typecheck**

Run:

```powershell
pnpm.cmd --filter @workspace/connectsphere-mobile typecheck
```

Expected: pass after dependency arrays and imports are aligned.

- [ ] **Step 4: Commit**

```powershell
git add -- artifacts/connectsphere-mobile/components/friends/TodayCommandCenter.tsx artifacts/connectsphere-mobile/components/FriendsTab.tsx
git commit -m "Add friends today command center"
```

---

### Task 4: Add Live Friend Signals Without Full Stories UX

**Files:**
- Create: `artifacts/connectsphere-mobile/components/friends/FriendSignalsRow.tsx`
- Modify: `artifacts/connectsphere-mobile/components/FriendsTab.tsx`

- [ ] **Step 1: Create the compact signals row**

Add `artifacts/connectsphere-mobile/components/friends/FriendSignalsRow.tsx`:

```tsx
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { FriendStory } from "@/services/friendsApi";
import { firstName, signalTitle } from "./friendsLabels";

const FALLBACK_PHOTO =
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=85";

type Props = {
  stories: FriendStory[];
  onReact: (story: FriendStory) => void;
  onReply: (story: FriendStory) => void;
  onPlan: (story: FriendStory) => void;
};

export default function FriendSignalsRow({ stories, onReact, onReply, onPlan }: Props) {
  if (!stories.length) {
    return (
      <View style={styles.empty}>
        <Ionicons name="radio-outline" size={18} color="#FF8BC4" />
        <Text style={styles.emptyText}>No live friend signals yet. Create a plan or check back soon.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Live friend signals</Text>
        <Text style={styles.subtitle}>Lightweight moments, not a feed</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {stories.slice(0, 8).map((story) => (
          <View key={story.id} style={styles.card}>
            <Image source={{ uri: story.imageUrl ?? story.user?.photoUrl ?? FALLBACK_PHOTO }} style={styles.image} contentFit="cover" />
            <Text style={styles.cardLabel}>{signalTitle(story)}</Text>
            <Text style={styles.cardText} numberOfLines={2}>{story.text ?? `${firstName(story.user?.name)} is open to plans.`}</Text>
            <Text style={styles.cardMeta} numberOfLines={1}>{firstName(story.user?.name)}</Text>
            <View style={styles.actions}>
              <Pressable onPress={() => onReact(story)} style={styles.iconButton}>
                <Ionicons name="sparkles" size={14} color="#FFB6D9" />
              </Pressable>
              <Pressable onPress={() => onReply(story)} style={styles.actionButton}>
                <Text style={styles.actionText}>Reply</Text>
              </Pressable>
              {story.planType || story.planId ? (
                <Pressable onPress={() => onPlan(story)} style={styles.iconButton}>
                  <Ionicons name="calendar-outline" size={14} color="#FFB6D9" />
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  header: { gap: 2 },
  title: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  subtitle: { color: "#A1A1AA", fontSize: 12, fontWeight: "700" },
  row: { gap: 10, paddingRight: 4 },
  card: {
    backgroundColor: "#050505",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 18,
    borderWidth: 1,
    gap: 7,
    padding: 10,
    width: 176,
  },
  image: { backgroundColor: "#17171D", borderRadius: 14, height: 82, width: "100%" },
  cardLabel: { color: "#FF8BC4", fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  cardText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800", lineHeight: 18, minHeight: 36 },
  cardMeta: { color: "#A1A1AA", fontSize: 12, fontWeight: "700" },
  actions: { alignItems: "center", flexDirection: "row", gap: 7 },
  iconButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,45,168,0.1)",
    borderRadius: 13,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  actionButton: {
    alignItems: "center",
    backgroundColor: "#FF2D8D",
    borderRadius: 13,
    flex: 1,
    justifyContent: "center",
    minHeight: 30,
  },
  actionText: { color: "#0A0A0B", fontSize: 12, fontWeight: "900" },
  empty: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.045)",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    padding: 14,
  },
  emptyText: { color: "#A1A1AA", flex: 1, fontSize: 13, fontWeight: "700", lineHeight: 18 },
});
```

- [ ] **Step 2: Wire signal actions in `FriendsTab.tsx`**

Add imports:

```ts
import FriendSignalsRow from "@/components/friends/FriendSignalsRow";
import { reactToFriendStory, replyToFriendStory } from "@/services/friendsApi";
```

Add handlers:

```ts
const handleReactToSignal = useCallback(async (story: FriendStory) => {
  const key = `signal-react:${story.id}`;
  if (isActing(key)) return;
  beginAction(key);
  try {
    await reactToFriendStory(userId, story.id, "spark");
    successHaptic();
    showNotice("Signal reacted to.");
    await loadFriends();
  } catch {
    showNotice("Could not react to this signal.");
  } finally {
    endAction(key);
  }
}, [beginAction, endAction, isActing, loadFriends, showNotice, userId]);

const handleReplyToSignal = useCallback(async (story: FriendStory) => {
  const key = `signal-reply:${story.id}`;
  if (isActing(key)) return;
  beginAction(key);
  try {
    const result = await replyToFriendStory(userId, story.id, "I'm down. Want to make a plan?");
    showNotice(result.mode === "chat" ? "Reply sent in Connect." : "Reply sent as a request.");
    await loadFriends();
    if (result.chat?.id) openConnectThread(result.chat.id);
  } catch {
    showNotice("Could not reply to this signal.");
  } finally {
    endAction(key);
  }
}, [beginAction, endAction, isActing, loadFriends, showNotice, userId]);

const handlePlanFromSignal = useCallback((story: FriendStory) => {
  const person = story.user;
  if (person) openPlanForPerson(person);
  else openCreatePlan("event");
}, [openCreatePlan, openPlanForPerson]);
```

Render below Today Command Center:

```tsx
<FriendSignalsRow
  stories={stories}
  onReact={handleReactToSignal}
  onReply={handleReplyToSignal}
  onPlan={handlePlanFromSignal}
/>
```

- [ ] **Step 3: Confirm the UX language avoids full social-feed framing**

Search:

```powershell
rg -n "Stories|stories feed|story feed" artifacts\connectsphere-mobile\components\FriendsTab.tsx artifacts\connectsphere-mobile\components\friends
```

Expected: no visible user-facing phrase that frames this as an Instagram-style stories feed. `FriendStory` type names are fine.

- [ ] **Step 4: Run typecheck**

Run:

```powershell
pnpm.cmd --filter @workspace/connectsphere-mobile typecheck
```

Expected: pass after imports and callback dependencies are aligned.

- [ ] **Step 5: Commit**

```powershell
git add -- artifacts/connectsphere-mobile/components/friends/FriendSignalsRow.tsx artifacts/connectsphere-mobile/components/FriendsTab.tsx
git commit -m "Add live friend signals"
```

---

### Task 5: Split Pending Inbox Into A Focused Section

**Files:**
- Create: `artifacts/connectsphere-mobile/components/friends/PendingInboxSection.tsx`
- Modify: `artifacts/connectsphere-mobile/components/FriendsTab.tsx`

- [ ] **Step 1: Create the section component**

Add `artifacts/connectsphere-mobile/components/friends/PendingInboxSection.tsx`:

```tsx
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { FriendRequest } from "@/services/friendsApi";
import { firstName, personLocation, planVenue, requestKindLabel } from "./friendsLabels";

const FALLBACK_PHOTO =
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=85";

type Props = {
  requests: FriendRequest[];
  isActing: (key: string) => boolean;
  onOpenProfile: (request: FriendRequest) => void;
  onAccept: (request: FriendRequest) => void;
  onIgnore: (request: FriendRequest) => void;
  onCancel: (request: FriendRequest) => void;
  onFindPeople: () => void;
};

export default function PendingInboxSection({ requests, isActing, onOpenProfile, onAccept, onIgnore, onCancel, onFindPeople }: Props) {
  if (!requests.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>All clear</Text>
        <Text style={styles.emptyText}>Friend requests, plan joins, and replies will show here.</Text>
        <Pressable onPress={onFindPeople} style={styles.emptyAction}>
          <Text style={styles.emptyActionText}>Find People</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      {requests.map((request) => {
        const outgoing = request.direction === "outgoing";
        const displayUser = outgoing ? request.toUser ?? request.fromUser : request.fromUser;
        const isPlanJoin = request.requestType === "plan_join" || request.kind === "plan_join";
        const title = outgoing ? `Sent to ${firstName(displayUser?.name)}` : displayUser?.name ?? "Someone";
        const message = outgoing
          ? isPlanJoin
            ? `Waiting for ${firstName(request.toUser?.name)} to approve ${request.plan?.title ?? "the plan"}.`
            : "Waiting for their reply."
          : isPlanJoin
            ? `Wants to join ${request.plan?.title ?? "your plan"}.`
            : request.message ?? "Wants to connect.";
        const acceptKey = `request:accept:${request.id}`;
        const ignoreKey = `request:ignore:${request.id}`;
        const cancelKey = `cancel:${request.id}`;

        return (
          <Pressable key={request.id} onPress={() => onOpenProfile(request)} style={[styles.card, outgoing && styles.cardSent]}>
            <Image source={{ uri: displayUser?.photoUrl ?? FALLBACK_PHOTO }} style={styles.avatar} contentFit="cover" />
            <View style={styles.body}>
              <View style={styles.topRow}>
                <Text style={styles.name} numberOfLines={1}>{title}</Text>
                <View style={[styles.badge, outgoing && styles.badgeSent]}>
                  <Text style={styles.badgeText}>{outgoing ? "Waiting" : requestKindLabel(request)}</Text>
                </View>
              </View>
              <Text style={styles.meta}>{personLocation(displayUser ?? request.fromUser)}</Text>
              <Text style={styles.message} numberOfLines={2}>{message}</Text>
              {request.plan ? <Text style={styles.planMeta}>{request.plan.timeLabel ?? request.plan.time ?? "Soon"} at {planVenue(request.plan)}</Text> : null}
              {outgoing ? (
                <View style={styles.actions}>
                  <View style={styles.waitingPill}>
                    <Ionicons name="time-outline" size={14} color="#FFB6D9" />
                    <Text style={styles.waitingText}>Waiting</Text>
                  </View>
                  <Pressable onPress={() => onCancel(request)} disabled={isActing(cancelKey)} style={[styles.secondary, isActing(cancelKey) && styles.disabled]}>
                    <Text style={styles.secondaryText}>{isActing(cancelKey) ? "..." : isPlanJoin ? "Cancel Join" : "Cancel Request"}</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.actions}>
                  <Pressable onPress={() => onAccept(request)} disabled={isActing(acceptKey) || isActing(ignoreKey)} style={[styles.primary, isActing(acceptKey) && styles.disabled]}>
                    <Text style={styles.primaryText}>{isActing(acceptKey) ? "..." : "Accept"}</Text>
                  </Pressable>
                  <Pressable onPress={() => onIgnore(request)} disabled={isActing(acceptKey) || isActing(ignoreKey)} style={[styles.secondary, isActing(ignoreKey) && styles.disabled]}>
                    <Text style={styles.secondaryText}>{isActing(ignoreKey) ? "..." : isPlanJoin ? "Decline" : "Ignore"}</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  card: {
    backgroundColor: "#050505",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 12,
  },
  cardSent: { borderColor: "rgba(255,45,168,0.18)" },
  avatar: { backgroundColor: "#17171D", borderRadius: 24, height: 48, width: 48 },
  body: { flex: 1, gap: 7, minWidth: 0 },
  topRow: { alignItems: "flex-start", flexDirection: "row", gap: 8, justifyContent: "space-between" },
  name: { color: "#FFFFFF", flex: 1, fontSize: 17, fontWeight: "900" },
  badge: { backgroundColor: "rgba(255,45,168,0.14)", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  badgeSent: { backgroundColor: "rgba(255,255,255,0.09)" },
  badgeText: { color: "#FFB6D9", fontSize: 10, fontWeight: "900" },
  meta: { color: "#A1A1AA", fontSize: 12, fontWeight: "700" },
  message: { color: "#EDEDF2", fontSize: 13, fontWeight: "700", lineHeight: 18 },
  planMeta: { color: "#FFB6D9", fontSize: 12, fontWeight: "800" },
  actions: { flexDirection: "row", gap: 8 },
  primary: { alignItems: "center", backgroundColor: "#FF2D8D", borderRadius: 14, flex: 1, justifyContent: "center", minHeight: 40 },
  primaryText: { color: "#0A0A0B", fontSize: 13, fontWeight: "900" },
  secondary: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 40,
  },
  secondaryText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  waitingPill: { alignItems: "center", backgroundColor: "rgba(255,45,168,0.1)", borderRadius: 14, flexDirection: "row", flex: 1, gap: 7, justifyContent: "center" },
  waitingText: { color: "#FFB6D9", fontSize: 12, fontWeight: "900" },
  disabled: { opacity: 0.55 },
  empty: { alignItems: "center", backgroundColor: "#050505", borderRadius: 24, gap: 8, minHeight: 170, padding: 22 },
  emptyTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" },
  emptyText: { color: "#A1A1AA", fontSize: 14, lineHeight: 20, textAlign: "center" },
  emptyAction: { backgroundColor: "#FF2D8D", borderRadius: 15, marginTop: 8, paddingHorizontal: 14, paddingVertical: 10 },
  emptyActionText: { color: "#0A0A0B", fontSize: 13, fontWeight: "900" },
});
```

- [ ] **Step 2: Replace `renderRequests` internals in `FriendsTab.tsx`**

Import:

```ts
import PendingInboxSection from "@/components/friends/PendingInboxSection";
```

Replace the `renderRequests` return with:

```tsx
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
    onFindPeople={() => setActiveTab("people")}
  />
);
```

Keep the existing loading branch if `loading` is true.

- [ ] **Step 3: Run typecheck**

Run:

```powershell
pnpm.cmd --filter @workspace/connectsphere-mobile typecheck
```

Expected: pass after imported props align.

- [ ] **Step 4: Commit**

```powershell
git add -- artifacts/connectsphere-mobile/components/friends/PendingInboxSection.tsx artifacts/connectsphere-mobile/components/FriendsTab.tsx
git commit -m "Clarify friends pending inbox"
```

---

### Task 6: Group Plans Into A Launch-Ready Plans Hub

**Files:**
- Create: `artifacts/connectsphere-mobile/components/friends/PlansHubSection.tsx`
- Modify: `artifacts/connectsphere-mobile/components/FriendsTab.tsx`

- [ ] **Step 1: Create the plans section**

Add `artifacts/connectsphere-mobile/components/friends/PlansHubSection.tsx`:

```tsx
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { FriendPlan } from "@/services/friendsApi";
import { firstName, planVenue, planWhen } from "./friendsLabels";

type Props = {
  plans: FriendPlan[];
  planFeed: FriendPlan[];
  isActing: (key: string) => boolean;
  onCreatePlan: () => void;
  onOpenPlan: (plan: FriendPlan) => void;
  onJoinPlan: (plan: FriendPlan) => void;
  onOpenConnect: (plan: FriendPlan) => void;
  onSharePlan: (plan: FriendPlan) => void;
};

function isTonightOrUpcoming(plan: FriendPlan) {
  const time = new Date(plan.scheduledAt ?? plan.createdAt).getTime();
  if (!Number.isFinite(time)) return true;
  return time >= Date.now() - 90 * 60 * 1000;
}

function PlanCard({ plan, mode, isActing, onOpenPlan, onJoinPlan, onOpenConnect, onSharePlan }: {
  plan: FriendPlan;
  mode: "join" | "owned";
  isActing: (key: string) => boolean;
  onOpenPlan: (plan: FriendPlan) => void;
  onJoinPlan: (plan: FriendPlan) => void;
  onOpenConnect: (plan: FriendPlan) => void;
  onSharePlan: (plan: FriendPlan) => void;
}) {
  const joinBusy = isActing(`join:${plan.id}`);
  const joinPending = plan.joinRequestStatus === "pending";
  return (
    <Pressable onPress={() => onOpenPlan(plan)} style={styles.card}>
      {plan.sourceImageUrl ? (
        <Image source={{ uri: plan.sourceImageUrl }} style={styles.thumb} contentFit="cover" />
      ) : (
        <View style={styles.icon}><Ionicons name={plan.sourceType === "event" ? "calendar" : "location"} size={18} color="#FF2D8D" /></View>
      )}
      <View style={styles.body}>
        <Text style={styles.title}>{plan.title}</Text>
        <Text style={styles.meta}>{planWhen(plan)} at {planVenue(plan)}</Text>
        <Text style={styles.host}>Hosted by {firstName(plan.creator?.name)} · {plan.peopleGoing ?? plan.members?.length ?? 1} going</Text>
        {mode === "join" ? (
          <Pressable onPress={() => onJoinPlan(plan)} disabled={joinPending || joinBusy} style={[styles.primary, (joinPending || joinBusy) && styles.disabled]}>
            <Text style={styles.primaryText}>{joinBusy ? "..." : joinPending ? "Requested" : "Request to Join"}</Text>
          </Pressable>
        ) : (
          <View style={styles.actions}>
            <Pressable onPress={() => onOpenConnect(plan)} disabled={!plan.chatId} style={[styles.primary, !plan.chatId && styles.disabled]}>
              <Text style={styles.primaryText}>Open Connect</Text>
            </Pressable>
            <Pressable onPress={() => onSharePlan(plan)} style={styles.secondary}>
              <Text style={styles.secondaryText}>Share</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function PlansHubSection(props: Props) {
  const upcoming = props.plans.filter(isTonightOrUpcoming);
  const older = props.plans.filter((plan) => !isTonightOrUpcoming(plan));

  if (!props.plans.length && !props.planFeed.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No plans yet</Text>
        <Text style={styles.emptyText}>Create something easy, or join a nearby plan when one pops up.</Text>
        <Pressable onPress={props.onCreatePlan} style={styles.emptyAction}>
          <Text style={styles.emptyActionText}>Create Plan</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      <Pressable onPress={props.onCreatePlan} style={styles.create}>
        <Ionicons name="add" size={18} color="#0A0A0B" />
        <Text style={styles.createText}>Create Plan</Text>
      </Pressable>
      {upcoming.length ? <Text style={styles.sectionLabel}>Tonight / Upcoming</Text> : null}
      {upcoming.map((plan) => <PlanCard key={plan.id} plan={plan} mode="owned" {...props} />)}
      {props.planFeed.length ? <Text style={styles.sectionLabel}>Plans to Join</Text> : null}
      {props.planFeed.map((plan) => <PlanCard key={`feed-${plan.id}`} plan={plan} mode="join" {...props} />)}
      {older.length ? <Text style={styles.sectionLabel}>Your Plans</Text> : null}
      {older.map((plan) => <PlanCard key={plan.id} plan={plan} mode="owned" {...props} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  sectionLabel: { color: "#A1A1AA", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  create: { alignItems: "center", alignSelf: "flex-start", backgroundColor: "#FF2D8D", borderRadius: 18, flexDirection: "row", gap: 4, paddingHorizontal: 14, paddingVertical: 10 },
  createText: { color: "#0A0A0B", fontSize: 13, fontWeight: "900" },
  card: { backgroundColor: "#050505", borderColor: "rgba(255,255,255,0.1)", borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 12, padding: 12 },
  thumb: { backgroundColor: "#17171D", borderRadius: 18, height: 54, width: 54 },
  icon: { alignItems: "center", backgroundColor: "rgba(255,45,141,0.14)", borderRadius: 18, height: 44, justifyContent: "center", width: 44 },
  body: { flex: 1, gap: 7, minWidth: 0 },
  title: { color: "#FFFFFF", fontSize: 17, fontWeight: "900" },
  meta: { color: "#EDEDF2", fontSize: 13, fontWeight: "800" },
  host: { color: "#A1A1AA", fontSize: 12, fontWeight: "700" },
  actions: { flexDirection: "row", gap: 8 },
  primary: { alignItems: "center", backgroundColor: "#FF2D8D", borderRadius: 14, flex: 1, justifyContent: "center", minHeight: 40 },
  primaryText: { color: "#0A0A0B", fontSize: 13, fontWeight: "900" },
  secondary: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 14, justifyContent: "center", minHeight: 40, paddingHorizontal: 14 },
  secondaryText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  disabled: { opacity: 0.55 },
  empty: { alignItems: "center", backgroundColor: "#050505", borderRadius: 24, gap: 8, minHeight: 170, padding: 22 },
  emptyTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" },
  emptyText: { color: "#A1A1AA", fontSize: 14, lineHeight: 20, textAlign: "center" },
  emptyAction: { backgroundColor: "#FF2D8D", borderRadius: 15, marginTop: 8, paddingHorizontal: 14, paddingVertical: 10 },
  emptyActionText: { color: "#0A0A0B", fontSize: 13, fontWeight: "900" },
});
```

- [ ] **Step 2: Replace `renderPlans` body in `FriendsTab.tsx`**

Import:

```ts
import PlansHubSection from "@/components/friends/PlansHubSection";
```

Return from `renderPlans` after the loading branch:

```tsx
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
```

- [ ] **Step 3: Run typecheck**

Run:

```powershell
pnpm.cmd --filter @workspace/connectsphere-mobile typecheck
```

Expected: pass.

- [ ] **Step 4: Commit**

```powershell
git add -- artifacts/connectsphere-mobile/components/friends/PlansHubSection.tsx artifacts/connectsphere-mobile/components/FriendsTab.tsx
git commit -m "Group friends plans hub"
```

---

### Task 7: Remove Dead Profile Modal And Polish Empty/Error Copy

**Files:**
- Modify: `artifacts/connectsphere-mobile/components/FriendsTab.tsx`

- [ ] **Step 1: Remove the invisible old profile modal**

Delete the block:

```tsx
<Modal transparent visible={false} animationType="fade" onRequestClose={() => setSelectedPerson(null)}>
  ...
</Modal>
```

The active full-screen `FriendProfileSheet` modal must remain.

- [ ] **Step 2: Tighten tab titles and empty states**

Keep tabs as `People`, `Pending`, `Plans`.

Update the People empty copy to:

```tsx
<EmptyState
  title="No people yet"
  text="Try another interest, clear search, or invite someone into ConnectSphere."
  actionLabel="Invite People"
  onAction={handleInviteFriends}
/>
```

Update load error copy to:

```tsx
setLoadError("Friends could not load. Check the API server and try again.");
```

If this exact copy already exists, leave it unchanged.

- [ ] **Step 3: Run typecheck**

Run:

```powershell
pnpm.cmd --filter @workspace/connectsphere-mobile typecheck
```

Expected: pass.

- [ ] **Step 4: Commit**

```powershell
git add -- artifacts/connectsphere-mobile/components/FriendsTab.tsx
git commit -m "Polish friends empty states"
```

---

### Task 8: Verify API Compatibility And Build

**Files:**
- Modify only if required: `artifacts/api-server/src/routes/friends.ts`
- Modify only if required: `artifacts/connectsphere-mobile/services/friendsApi.ts`

- [ ] **Step 1: Verify friend stories route response supports the UI**

Check that `GET /friends/stories/:userId` returns:

```ts
{
  stories: Array<{
    id: string;
    userId: string;
    type: "status" | "photo" | "plan_invite";
    text?: string;
    imageUrl?: string;
    planType?: string;
    planId?: string;
    user: FriendPerson;
    relationshipStatus: RelationshipStatus;
    isOwn?: boolean;
    reactions?: Array<{ id: string; reaction: string; userId: string; createdAt: string }>;
  }>;
}
```

If the current route already returns this shape, do not modify the API.

- [ ] **Step 2: Build the API**

Run:

```powershell
pnpm.cmd --filter @workspace/api-server build
```

Expected: successful build.

- [ ] **Step 3: Typecheck mobile**

Run:

```powershell
pnpm.cmd --filter @workspace/connectsphere-mobile typecheck
```

Expected: successful typecheck.

- [ ] **Step 4: Smoke test the phone preview**

Start API:

```powershell
Start-Process -WindowStyle Hidden -FilePath powershell.exe -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File','C:\Users\fazer\Documents\Codex\2026-04-27\github-plugin-github-openai-curated-this\run-connectsphere-api-live.ps1') -WorkingDirectory 'C:\Users\fazer\Documents\Codex\2026-04-27\github-plugin-github-openai-curated-this'
```

Start Expo LAN preview:

```powershell
Start-Process -WindowStyle Hidden -FilePath powershell.exe -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File','C:\Users\fazer\Documents\Codex\2026-04-27\github-plugin-github-openai-curated-this\start-connectsphere-expo-lan-phone.ps1') -WorkingDirectory 'C:\Users\fazer\Documents\Codex\2026-04-27\github-plugin-github-openai-curated-this'
```

Expected:

- Friends tab opens.
- Today Command Center renders one action.
- Live Friend Signals renders compact cards or a compact empty state.
- People tab actions still work.
- Pending actions still work.
- Plans actions still work.
- Connect handoff opens the intended thread.

- [ ] **Step 5: Verify the Connect relay contract**

Manually exercise these flows in Expo Go:

1. Tap `Message` on an existing friend.
   - Expected: app routes to `/(tabs)/matches` with `openChatId`, then opens `/chat/[chatId]`.
2. Accept an incoming friend request.
   - Expected: success notice mentions Connect and the direct chat opens.
3. Create a friend plan.
   - Expected: success notice mentions the plan thread and the plan appears in Connect.
4. Request to join a plan that returns `status: "joined"`.
   - Expected: plan Connect thread opens.
5. Accept an incoming plan join request.
   - Expected: plan Connect thread opens.
6. Reply to a Live Friend Signal from a current friend.
   - Expected: reply writes to the direct Connect chat and opens it.
7. Reply to a Live Friend Signal from a non-friend.
   - Expected: a pending request appears; it does not create a separate chat surface in Friends.

If any flow leaves the user stranded inside Friends after a completed relationship action, update the relevant handler in `artifacts/connectsphere-mobile/components/FriendsTab.tsx` so it calls `openConnectThread(chat.id)` when the API returns a chat.

- [ ] **Step 6: Commit verification-only API/mobile type fixes if any were needed**

If no API/service code changed in this task, do not commit.

If fixes were needed:

```powershell
git add -- artifacts/api-server/src/routes/friends.ts artifacts/connectsphere-mobile/services/friendsApi.ts
git commit -m "Align friends signals API"
```

---

## Self-Review Notes

Spec coverage:

- Today Command Center is covered by Tasks 2 and 3.
- Live Friend Signals are covered by Task 4 and intentionally framed as compact signals rather than full stories.
- People To Meet remains in the existing screen and receives helper cleanup in Task 1.
- Pending Inbox is covered by Task 5.
- Plans Hub is covered by Task 6.
- Profile detail remains existing full-screen `FriendProfileSheet`; dead modal cleanup is covered by Task 7.
- Error and empty state polish is covered by Task 7.
- API, broad launch readiness, and Connect relay verification gates are covered by Task 8.

No separate backend task is required unless the existing story route response proves insufficient during Task 8.
