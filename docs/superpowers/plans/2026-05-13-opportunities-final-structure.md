# Opportunities Final Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the final Opportunities tab structure with onboarding personalization, mock opportunity profiles, full filters/search/saved/post/detail behavior, and Connect-tab relay for RSVP, claim, apply, join, and connect actions.

**Architecture:** Split the current large `NetworkingTab.tsx` into focused Opportunities modules. Keep live `/api/opportunities` as the external feed, map it into a unified `OpportunityItem` model with mock people/groups/events/side hustles, and add an API relay endpoint that creates or opens `opportunity` chats in the existing Connect store. The Connect tab already handles `opportunity` chats from `GET /api/connect/:userId`, so client actions should call the relay endpoint and navigate to `/(tabs)/matches` with `openChatId`.

**Tech Stack:** Expo React Native, TypeScript, Express API, local JSON Connect store, existing `@workspace/api-client-react` custom fetch, native `Share`, `Linking`, and Expo Router.

---

## File Structure

- Create `artifacts/connectsphere-mobile/components/opportunities/opportunityTypes.ts`
  Shared UI model types: `OpportunityKind`, `OpportunityAction`, `OpportunityItem`, `OpportunityProfile`, `OpportunityGroup`.

- Create `artifacts/connectsphere-mobile/components/opportunities/opportunityData.ts`
  Mock people, groups, pop-ups, events, side hustles, and mapper from live `/api/opportunities` items to `OpportunityItem`.

- Create `artifacts/connectsphere-mobile/components/opportunities/opportunityActions.ts`
  Pure helpers for URL validation, filtering, search, action labels, spotlight selection, saved/joined/connected state updates, and Connect relay payload building.

- Create `artifacts/connectsphere-mobile/components/opportunities/opportunityActions.test.mjs`
  Node test runner file that transpiles the TypeScript helper module and verifies the behavior before implementation.

- Create `artifacts/connectsphere-mobile/services/opportunitiesApi.ts`
  Client API wrapper for `GET /api/opportunities` and `POST /api/opportunities/relay`.

- Modify `artifacts/api-server/src/routes/friends.ts`
  Add `POST /opportunities/relay` because this file owns the JSON Connect store used by `GET /connect/:userId`, `/chats/:chatId`, and `/messages/send`.

- Modify `artifacts/connectsphere-mobile/app/onboarding.tsx`
  Replace single `careerStage` for Opportunities with `opportunityPreferences` and `opportunityRoles`, while keeping compatibility fields in `modeData`.

- Replace `artifacts/connectsphere-mobile/components/NetworkingTab.tsx`
  Make it the orchestrator for the final Opportunities structure: header, filters, spotlight, feed, detail sheet, saved sheet, post sheet, and search overlay.

- Keep `artifacts/connectsphere-mobile/app/(tabs)/matches.tsx`
  No structural change expected. It already reads `opportunity` chats and honors `openChatId`.

- Modify `artifacts/connectsphere-mobile/app/chat/[matchId].tsx`
  Add opportunity quick prompts for `opportunity` chat type.

---

### Task 1: Pure Opportunity Helpers

**Files:**
- Create: `artifacts/connectsphere-mobile/components/opportunities/opportunityTypes.ts`
- Create: `artifacts/connectsphere-mobile/components/opportunities/opportunityActions.ts`
- Create: `artifacts/connectsphere-mobile/components/opportunities/opportunityActions.test.mjs`

- [ ] **Step 1: Write failing helper tests**

Create `artifacts/connectsphere-mobile/components/opportunities/opportunityActions.test.mjs`:

```js
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import ts from "typescript";

const root = resolve("artifacts/connectsphere-mobile/components/opportunities");
const outDir = mkdtempSync(join(tmpdir(), "opportunity-actions-"));

for (const file of ["opportunityTypes.ts", "opportunityActions.ts"]) {
  const sourcePath = join(root, file);
  const source = readFileSync(sourcePath, "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Node10,
    },
  }).outputText.replace(/from "\.\/opportunityTypes"/g, 'from "./opportunityTypes.mjs"');
  writeFileSync(join(outDir, file.replace(".ts", ".mjs")), js);
}

const actions = await import(join(outDir, "opportunityActions.mjs").replaceAll("\\", "/"));

const baseItem = {
  id: "opp-1",
  kind: "sideHustle",
  title: "Weekend brand ambassador",
  subtitle: "Local paid gig",
  description: "Help a brand run a public pop-up.",
  location: "Wynwood",
  timing: "Saturday",
  source: "ConnectSphere",
  trustCue: "Public opportunity",
  tags: ["Side Hustles", "Pop-Ups", "Miami"],
  primaryAction: "Claim",
  actionUrl: "https://example.com/apply",
  relevanceReason: "Matches your Side Hustles interest",
};

test("validateOpportunityUrl only allows safe https links", () => {
  assert.equal(actions.validateOpportunityUrl("https://example.com/apply"), "https://example.com/apply");
  assert.equal(actions.validateOpportunityUrl("http://example.com"), null);
  assert.equal(actions.validateOpportunityUrl("mailto:test@example.com"), null);
  assert.equal(actions.validateOpportunityUrl("https://connectsphere.app/placeholder"), null);
  assert.equal(actions.validateOpportunityUrl("#"), null);
});

test("filterOpportunityItems matches the final filter categories", () => {
  const items = [
    baseItem,
    { ...baseItem, id: "opp-2", kind: "person", title: "Maya, mentor", primaryAction: "Connect", tags: ["People", "Mentor"] },
    { ...baseItem, id: "opp-3", kind: "group", title: "Creator circle", primaryAction: "Join", tags: ["Groups"] },
  ];
  assert.deepEqual(actions.filterOpportunityItems(items, "Side Hustles").map((i) => i.id), ["opp-1"]);
  assert.deepEqual(actions.filterOpportunityItems(items, "People").map((i) => i.id), ["opp-2"]);
  assert.deepEqual(actions.filterOpportunityItems(items, "Groups").map((i) => i.id), ["opp-3"]);
  assert.equal(actions.filterOpportunityItems(items, "For You").length, 3);
});

test("searchOpportunityItems searches title, tags, source, location, and profile text", () => {
  const items = [
    baseItem,
    {
      ...baseItem,
      id: "opp-4",
      kind: "person",
      title: "Nina Patel",
      primaryAction: "Connect",
      profile: {
        label: "Mentor",
        lookingFor: "Junior designers",
        offers: "Portfolio feedback",
        suggestedOpener: "Ask for one portfolio tip.",
      },
      tags: ["People", "Design"],
    },
  ];
  assert.deepEqual(actions.searchOpportunityItems(items, "portfolio").map((i) => i.id), ["opp-4"]);
  assert.deepEqual(actions.searchOpportunityItems(items, "wynwood").map((i) => i.id), ["opp-1", "opp-4"]);
  assert.deepEqual(actions.searchOpportunityItems(items, "").map((i) => i.id), ["opp-1", "opp-4"]);
});

test("buildOpportunityRelayPayload records action context for Connect", () => {
  const payload = actions.buildOpportunityRelayPayload(baseItem, "claim", "user_self");
  assert.equal(payload.userId, "user_self");
  assert.equal(payload.action, "claim");
  assert.equal(payload.opportunity.id, "opp-1");
  assert.equal(payload.opportunity.title, "Weekend brand ambassador");
  assert.equal(payload.opportunity.actionUrl, "https://example.com/apply");
});
```

- [ ] **Step 2: Run helper tests and verify they fail**

Run:

```bash
node --test artifacts/connectsphere-mobile/components/opportunities/opportunityActions.test.mjs
```

Expected: FAIL because `opportunityTypes.ts` and `opportunityActions.ts` do not exist yet.

- [ ] **Step 3: Add opportunity types**

Create `artifacts/connectsphere-mobile/components/opportunities/opportunityTypes.ts`:

```ts
export type OpportunityFilter =
  | "For You"
  | "Hiring"
  | "Side Hustles"
  | "Pop-Ups"
  | "Events"
  | "People"
  | "Groups";

export type OpportunityKind = "hiring" | "sideHustle" | "popup" | "event" | "person" | "group";

export type OpportunityPrimaryAction = "Apply" | "Claim" | "RSVP" | "Connect" | "Join";

export type OpportunityRelayAction = "apply" | "claim" | "rsvp" | "connect" | "join" | "message";

export type OpportunityProfile = {
  label: "Looking to connect" | "Needs help" | "Hiring" | "Mentor" | "Collaborator" | "Professional" | "Local plug";
  age?: number;
  role?: string;
  lookingFor: string;
  offers: string;
  suggestedOpener: string;
  photoUrl?: string;
};

export type OpportunityGroup = {
  memberCount: string;
  activeNow: string;
  theme: string;
  examples: string[];
};

export type OpportunityItem = {
  id: string;
  kind: OpportunityKind;
  title: string;
  subtitle: string;
  description: string;
  location: string;
  timing: string;
  source: string;
  trustCue: string;
  tags: string[];
  primaryAction: OpportunityPrimaryAction;
  actionUrl?: string | null;
  image?: string;
  profile?: OpportunityProfile;
  group?: OpportunityGroup;
  relevanceReason: string;
  isRemote?: boolean;
};

export type OpportunityRelayPayload = {
  userId: string;
  action: OpportunityRelayAction;
  opportunity: {
    id: string;
    kind: OpportunityKind;
    title: string;
    subtitle: string;
    location: string;
    source: string;
    actionUrl?: string | null;
  };
};
```

- [ ] **Step 4: Add opportunity helper implementation**

Create `artifacts/connectsphere-mobile/components/opportunities/opportunityActions.ts`:

```ts
import type { OpportunityFilter, OpportunityItem, OpportunityRelayAction, OpportunityRelayPayload } from "./opportunityTypes";

const filterToKinds: Record<Exclude<OpportunityFilter, "For You">, OpportunityItem["kind"][]> = {
  Hiring: ["hiring"],
  "Side Hustles": ["sideHustle"],
  "Pop-Ups": ["popup"],
  Events: ["event"],
  People: ["person"],
  Groups: ["group"],
};

export function validateOpportunityUrl(url: string | undefined | null): string | null {
  const trimmed = url?.trim();
  if (!trimmed || trimmed === "#") return null;
  if (/^https?:\/\/(www\.)?connectsphere\.app\//i.test(trimmed)) return null;
  if (!/^https:\/\//i.test(trimmed)) return null;
  return trimmed;
}

export function filterOpportunityItems(items: OpportunityItem[], filter: OpportunityFilter): OpportunityItem[] {
  if (filter === "For You") return items;
  const kinds = filterToKinds[filter];
  return items.filter((item) => kinds.includes(item.kind));
}

export function searchOpportunityItems(items: OpportunityItem[], query: string): OpportunityItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    const profileText = item.profile
      ? [item.profile.label, item.profile.role, item.profile.lookingFor, item.profile.offers, item.profile.suggestedOpener].join(" ")
      : "";
    const groupText = item.group ? [item.group.theme, ...item.group.examples].join(" ") : "";
    return [
      item.title,
      item.subtitle,
      item.description,
      item.location,
      item.timing,
      item.source,
      item.trustCue,
      item.relevanceReason,
      ...item.tags,
      profileText,
      groupText,
    ]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
}

export function selectOpportunitySpotlight(items: OpportunityItem[]): OpportunityItem | null {
  return (
    items.find((item) => item.kind === "popup" || item.kind === "event") ??
    items.find((item) => validateOpportunityUrl(item.actionUrl)) ??
    items.find((item) => item.kind === "person") ??
    items[0] ??
    null
  );
}

export function actionToRelayAction(label: OpportunityItem["primaryAction"]): OpportunityRelayAction {
  if (label === "Apply") return "apply";
  if (label === "RSVP") return "rsvp";
  if (label === "Connect") return "connect";
  if (label === "Join") return "join";
  return "claim";
}

export function buildOpportunityRelayPayload(
  item: OpportunityItem,
  action: OpportunityRelayAction,
  userId: string,
): OpportunityRelayPayload {
  return {
    userId,
    action,
    opportunity: {
      id: item.id,
      kind: item.kind,
      title: item.title,
      subtitle: item.subtitle,
      location: item.location,
      source: item.source,
      actionUrl: validateOpportunityUrl(item.actionUrl),
    },
  };
}
```

- [ ] **Step 5: Run helper tests and verify they pass**

Run:

```bash
node --test artifacts/connectsphere-mobile/components/opportunities/opportunityActions.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit helper layer**

```bash
git add artifacts/connectsphere-mobile/components/opportunities/opportunityTypes.ts artifacts/connectsphere-mobile/components/opportunities/opportunityActions.ts artifacts/connectsphere-mobile/components/opportunities/opportunityActions.test.mjs
git commit -m "Add opportunity helper model"
```

---

### Task 2: Opportunity Data And Live Mapping

**Files:**
- Create: `artifacts/connectsphere-mobile/components/opportunities/opportunityData.ts`
- Modify: `artifacts/connectsphere-mobile/components/opportunities/opportunityActions.test.mjs`

- [ ] **Step 1: Add failing mapper test**

Append this test to `opportunityActions.test.mjs`:

```js
test("mapApiOpportunity creates opportunity feed items from live API shape", () => {
  const apiItem = {
    id: "native-gig",
    title: "Brand ambassador",
    company: "Local Market",
    location: "Miami",
    type: "Collab",
    source: "ConnectSphere",
    applyUrl: "https://example.com/gig",
    tags: ["Weekend", "Creator"],
    postedAt: new Date().toISOString(),
    isRemote: false,
    groupChatId: "group-creators",
  };
  const item = actions.mapApiOpportunity(apiItem);
  assert.equal(item.id, "native-gig");
  assert.equal(item.kind, "sideHustle");
  assert.equal(item.primaryAction, "Claim");
  assert.equal(item.source, "ConnectSphere");
});
```

- [ ] **Step 2: Run mapper test and verify it fails**

Run:

```bash
node --test artifacts/connectsphere-mobile/components/opportunities/opportunityActions.test.mjs
```

Expected: FAIL because `mapApiOpportunity` is not exported.

- [ ] **Step 3: Add mock data and mapper**

Create `artifacts/connectsphere-mobile/components/opportunities/opportunityData.ts`:

```ts
import type { OpportunityItem } from "./opportunityTypes";

export type ApiOpportunity = {
  id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  source: "ConnectSphere" | "Adzuna" | "USAJOBS" | "Greenhouse" | "Lever";
  applyUrl?: string;
  tags?: string[];
  postedAt?: string;
  isRemote?: boolean;
  groupChatId?: string | null;
};

export const MOCK_OPPORTUNITY_ITEMS: OpportunityItem[] = [
  {
    id: "person-mentor-nina",
    kind: "person",
    title: "Nina Patel",
    subtitle: "Senior Product Designer · Mentor",
    description: "Open to helping junior designers polish portfolios and talk through first design roles.",
    location: "Coral Gables",
    timing: "Usually replies evenings",
    source: "ConnectSphere",
    trustCue: "Verified profile",
    tags: ["People", "Mentor", "Design"],
    primaryAction: "Connect",
    relevanceReason: "Good fit for mentors and creative careers.",
    profile: {
      label: "Mentor",
      age: 34,
      role: "Senior Product Designer",
      lookingFor: "Junior designers and career switchers",
      offers: "Portfolio feedback and interview prep",
      suggestedOpener: "Ask Nina for one portfolio improvement.",
      photoUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=800&q=85",
    },
  },
  {
    id: "person-hiring-marco",
    kind: "person",
    title: "Marco Alvarez",
    subtitle: "Hospitality operator · Hiring",
    description: "Looking for reliable weekend event staff, hosts, and brand ambassadors for public venues.",
    location: "Miami Beach",
    timing: "Hiring this week",
    source: "ConnectSphere",
    trustCue: "Public venues only",
    tags: ["People", "Hiring", "Side Hustles"],
    primaryAction: "Connect",
    relevanceReason: "Matches side hustles and hiring opportunities.",
    profile: {
      label: "Hiring",
      age: 41,
      role: "Hospitality operator",
      lookingFor: "Event staff and hosts",
      offers: "Paid weekend shifts",
      suggestedOpener: "Ask Marco what shifts are open this weekend.",
      photoUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=85",
    },
  },
  {
    id: "popup-wynwood-market",
    kind: "popup",
    title: "Wynwood Maker Market vendor call",
    subtitle: "Local pop-up · Vendor spots",
    description: "A public weekend market is looking for food, fashion, art, and wellness vendors.",
    location: "Wynwood",
    timing: "This Saturday",
    source: "ConnectSphere",
    trustCue: "Public event",
    tags: ["Pop-Ups", "Side Hustles", "Miami"],
    primaryAction: "RSVP",
    actionUrl: "https://example.com/wynwood-market",
    relevanceReason: "Good fit for pop-ups and local opportunities.",
  },
  {
    id: "event-career-mixer",
    kind: "event",
    title: "South Florida career mixer",
    subtitle: "Networking event · Public venue",
    description: "Meet recruiters, founders, operators, and people looking for their next move.",
    location: "Brickell",
    timing: "Thursday 6 PM",
    source: "ConnectSphere",
    trustCue: "Public event",
    tags: ["Events", "Hiring", "People"],
    primaryAction: "RSVP",
    actionUrl: "https://example.com/career-mixer",
    relevanceReason: "Matches events and career opportunities.",
  },
  {
    id: "group-creator-circle",
    kind: "group",
    title: "Miami Creator Circle",
    subtitle: "Creators, editors, brand deals",
    description: "Find collaborators, paid content gigs, and people building brands around Miami.",
    location: "Miami",
    timing: "47 active now",
    source: "ConnectSphere",
    trustCue: "Community moderated",
    tags: ["Groups", "People", "Side Hustles"],
    primaryAction: "Join",
    relevanceReason: "Good fit for creator and collaboration opportunities.",
    group: {
      memberCount: "928",
      activeNow: "47",
      theme: "Creator work and brand deals",
      examples: ["UGC gigs", "videographer needs", "brand activations"],
    },
  },
];

export function mapApiOpportunity(item: ApiOpportunity): OpportunityItem {
  const type = item.type.toLowerCase();
  const tags = item.tags ?? [];
  const tagText = tags.join(" ").toLowerCase();
  const kind: OpportunityItem["kind"] =
    type.includes("intern") || type.includes("job") || type.includes("full-time") || type.includes("part-time")
      ? "hiring"
      : type.includes("event") || tagText.includes("event")
        ? "event"
        : "sideHustle";
  const primaryAction: OpportunityItem["primaryAction"] =
    kind === "hiring" ? "Apply" : kind === "event" ? "RSVP" : "Claim";

  return {
    id: item.id,
    kind,
    title: item.title,
    subtitle: `${item.company} · ${item.type}`,
    description: `${item.title} at ${item.company}. Save it, act on it, or continue in Connect.`,
    location: item.location || (item.isRemote ? "Remote" : "Miami"),
    timing: item.postedAt ? "Recently posted" : "Active now",
    source: item.source,
    trustCue: item.source === "ConnectSphere" ? "ConnectSphere post" : "Verified source",
    tags: tags.length ? tags : [item.type],
    primaryAction,
    actionUrl: item.applyUrl,
    relevanceReason: `Matches ${primaryAction === "Apply" ? "hiring" : primaryAction === "RSVP" ? "events" : "side hustle"} opportunities.`,
    isRemote: item.isRemote,
  };
}

export function buildOpportunityFeed(apiItems: ApiOpportunity[]): OpportunityItem[] {
  const liveItems = apiItems.map(mapApiOpportunity);
  const seen = new Set<string>();
  return [...MOCK_OPPORTUNITY_ITEMS, ...liveItems].filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
```

- [ ] **Step 4: Re-export mapper for the test runner**

At the bottom of `opportunityActions.ts`, add:

```ts
export { mapApiOpportunity } from "./opportunityData";
```

Update the test transpiler file list in `opportunityActions.test.mjs`:

```js
for (const file of ["opportunityTypes.ts", "opportunityData.ts", "opportunityActions.ts"]) {
```

Also add this replacement:

```js
.replace(/from "\.\/opportunityData"/g, 'from "./opportunityData.mjs"')
```

- [ ] **Step 5: Run mapper test and verify it passes**

Run:

```bash
node --test artifacts/connectsphere-mobile/components/opportunities/opportunityActions.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit data layer**

```bash
git add artifacts/connectsphere-mobile/components/opportunities/opportunityData.ts artifacts/connectsphere-mobile/components/opportunities/opportunityActions.ts artifacts/connectsphere-mobile/components/opportunities/opportunityActions.test.mjs
git commit -m "Add opportunity feed data"
```

---

### Task 3: Connect Relay API And Client Service

**Files:**
- Create: `artifacts/connectsphere-mobile/services/opportunitiesApi.ts`
- Modify: `artifacts/api-server/src/routes/friends.ts`
- Modify: `artifacts/connectsphere-mobile/components/opportunities/opportunityActions.test.mjs`

- [ ] **Step 1: Add failing relay payload test**

Append to `opportunityActions.test.mjs`:

```js
test("opportunityChatTitle creates readable Connect thread titles", () => {
  assert.equal(actions.opportunityChatTitle(baseItem), "Opportunity: Weekend brand ambassador");
});
```

- [ ] **Step 2: Run relay helper test and verify it fails**

Run:

```bash
node --test artifacts/connectsphere-mobile/components/opportunities/opportunityActions.test.mjs
```

Expected: FAIL because `opportunityChatTitle` is not implemented.

- [ ] **Step 3: Add title helper**

Add to `opportunityActions.ts`:

```ts
export function opportunityChatTitle(item: OpportunityItem): string {
  return `Opportunity: ${item.title}`;
}
```

- [ ] **Step 4: Run relay helper test and verify it passes**

Run:

```bash
node --test artifacts/connectsphere-mobile/components/opportunities/opportunityActions.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Add API relay route**

In `artifacts/api-server/src/routes/friends.ts`, add this route before `router.get("/connect/:userId", ...)`:

```ts
router.post("/opportunities/relay", (req, res) => {
  const db = readDb();
  const userId = authUserId(req, req.body.userId);
  const action = String(req.body.action ?? "connect");
  const opportunity = req.body.opportunity as {
    id?: string;
    kind?: string;
    title?: string;
    subtitle?: string;
    location?: string;
    source?: string;
    actionUrl?: string | null;
  };

  if (!opportunity?.id || !opportunity.title) {
    return res.status(400).json({ error: "Opportunity id and title are required." });
  }

  const chatId = `opportunity-${userId}-${opportunity.id}`.replace(/[^a-zA-Z0-9_-]/g, "-");
  let chat = db.chats.find((item) => item.id === chatId);
  const now = new Date().toISOString();
  const actionLabel =
    action === "rsvp" ? "RSVP'd to" :
    action === "claim" ? "claimed" :
    action === "apply" ? "started applying to" :
    action === "join" ? "joined" :
    action === "connect" ? "connected around" :
    "saved";

  if (!chat) {
    chat = {
      id: chatId,
      type: "opportunity",
      participantIds: [userId],
      title: `Opportunity: ${opportunity.title}`,
      createdAt: now,
    };
    db.chats.unshift(chat);
    db.chatMembers.push({ id: randomUUID(), chatId, userId });
    db.messages.push({
      id: randomUUID(),
      chatId,
      senderUserId: "system",
      senderId: "system",
      system: true,
      text: `You ${actionLabel} ${opportunity.title}${opportunity.location ? ` in ${opportunity.location}` : ""}. Keep notes, intros, and next steps here in Connect.${opportunity.actionUrl ? ` Source: ${opportunity.actionUrl}` : ""}`,
      createdAt: now,
    });
  } else {
    db.messages.push({
      id: randomUUID(),
      chatId,
      senderUserId: "system",
      senderId: "system",
      system: true,
      text: `Opportunity updated: ${action} · ${opportunity.title}`,
      createdAt: now,
    });
  }

  writeDb(db);
  return res.status(201).json({ chat });
});
```

- [ ] **Step 6: Add mobile opportunities API service**

Create `artifacts/connectsphere-mobile/services/opportunitiesApi.ts`:

```ts
import { customFetch } from "@workspace/api-client-react";

import type { ApiOpportunity } from "@/components/opportunities/opportunityData";
import type { OpportunityRelayPayload } from "@/components/opportunities/opportunityTypes";

export type OpportunitiesResponse = {
  updatedAt: string | null;
  count: number;
  opportunities: ApiOpportunity[];
};

export type OpportunityRelayResponse = {
  chat: {
    id: string;
    type?: "opportunity" | string;
    title?: string;
    createdAt: string;
  };
};

export function getOpportunities() {
  return customFetch<OpportunitiesResponse>("/api/opportunities");
}

export function relayOpportunityAction(payload: OpportunityRelayPayload) {
  return customFetch<OpportunityRelayResponse>("/api/opportunities/relay", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
```

- [ ] **Step 7: Run API and mobile typecheck**

Run:

```bash
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/connectsphere-mobile run typecheck
```

Expected: both pass.

- [ ] **Step 8: Commit relay API**

```bash
git add artifacts/api-server/src/routes/friends.ts artifacts/connectsphere-mobile/services/opportunitiesApi.ts artifacts/connectsphere-mobile/components/opportunities/opportunityActions.ts artifacts/connectsphere-mobile/components/opportunities/opportunityActions.test.mjs
git commit -m "Relay opportunities into Connect"
```

---

### Task 4: Onboarding Personalization

**Files:**
- Modify: `artifacts/connectsphere-mobile/app/onboarding.tsx`

- [ ] **Step 1: Write failing type expectation by adding state usage first**

In `onboarding.tsx`, add references in the submit payload to `opportunityPreferences` and `opportunityRoles` before defining them:

```ts
opportunityPreferences,
opportunityRoles,
```

Run:

```bash
pnpm --filter @workspace/connectsphere-mobile run typecheck
```

Expected: FAIL with missing names `opportunityPreferences` and `opportunityRoles`.

- [ ] **Step 2: Add constants and state**

Replace `OPPORTUNITY_TYPES` with:

```ts
const OPPORTUNITY_PREFERENCES = [
  { value: "Hiring", icon: "briefcase-outline" as const, label: "Hiring" },
  { value: "Side Hustles", icon: "cash-outline" as const, label: "Side Hustles" },
  { value: "Pop-Ups", icon: "storefront-outline" as const, label: "Pop-Ups" },
  { value: "Events", icon: "calendar-outline" as const, label: "Events" },
  { value: "People", icon: "people-outline" as const, label: "People" },
  { value: "Groups", icon: "chatbubbles-outline" as const, label: "Groups" },
];

const OPPORTUNITY_ROLES = [
  { value: "Looking", icon: "search-outline" as const, label: "Looking" },
  { value: "Hiring", icon: "person-add-outline" as const, label: "Hiring" },
  { value: "Mentor", icon: "school-outline" as const, label: "Mentor" },
  { value: "Collaborator", icon: "git-network-outline" as const, label: "Collaborator" },
  { value: "Professional", icon: "ribbon-outline" as const, label: "Professional" },
  { value: "Local Plug", icon: "location-outline" as const, label: "Local Plug" },
];
```

Replace:

```ts
const [careerStage, setCareerStage] = useState("");
```

With:

```ts
const [opportunityPreferences, setOpportunityPreferences] = useState<string[]>([]);
const [opportunityRoles, setOpportunityRoles] = useState<string[]>([]);
```

Add helper:

```ts
function toggleLimited(value: string, setter: React.Dispatch<React.SetStateAction<string[]>>, limit: number) {
  setter((prev) =>
    prev.includes(value)
      ? prev.filter((item) => item !== value)
      : prev.length < limit ? [...prev, value] : prev,
  );
}
```

- [ ] **Step 3: Restore/save progress**

Replace saved progress handling for `careerStage` with:

```ts
if (Array.isArray(saved.opportunityPreferences)) setOpportunityPreferences(saved.opportunityPreferences as string[]);
if (Array.isArray(saved.opportunityRoles)) setOpportunityRoles(saved.opportunityRoles as string[]);
```

Replace save metadata field:

```ts
intent, datingGoal, datingPace, firstDateStyle, datingEnergy, datingComforts, friendshipTypes, opportunityPreferences, opportunityRoles,
```

- [ ] **Step 4: Update validation and submit modeData**

Replace networking validation:

```ts
intent === "networking" ? opportunityPreferences.length > 0 && opportunityRoles.length > 0 :
```

Replace `connectionSubtype` networking branch:

```ts
intent === "networking" ? (opportunityRoles[0] || opportunityPreferences[0] || undefined) :
```

Replace networking `modeData`:

```ts
{
  opportunityPreferences,
  opportunityRoles,
  networkingSubtype: opportunityRoles[0] || opportunityPreferences[0] || undefined,
  networkingGoals: opportunityPreferences,
  opportunityType: opportunityPreferences[0] || undefined,
}
```

- [ ] **Step 5: Update Opportunities onboarding UI**

Replace the `intent === "networking"` block with two groups:

```tsx
{intent === "networking" && (
  <View style={{ gap: 12 }}>
    <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 2, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>
      What kind of opportunities do you want?
    </Text>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {OPPORTUNITY_PREFERENCES.map((item) => {
        const sel = opportunityPreferences.includes(item.value);
        return (
          <Pressable
            key={item.value}
            onPress={() => toggleLimited(item.value, setOpportunityPreferences, 4)}
            style={{
              flexDirection: "row", alignItems: "center", gap: 8,
              borderRadius: 12, borderWidth: 1.5,
              paddingHorizontal: 14, paddingVertical: 10,
              backgroundColor: sel ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.05)",
              borderColor: sel ? "#A78BFA" : "rgba(255,255,255,0.12)",
            }}
          >
            <Ionicons name={item.icon} size={14} color={sel ? "#A78BFA" : "rgba(255,255,255,0.4)"} />
            <Text style={{ fontSize: 13, fontFamily: sel ? "Inter_600SemiBold" : "Inter_400Regular", color: sel ? "#DDD6FE" : "#fff" }}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>

    <Text style={{ marginTop: 4, fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 2, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>
      How do you want to show up?
    </Text>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {OPPORTUNITY_ROLES.map((item) => {
        const sel = opportunityRoles.includes(item.value);
        return (
          <Pressable
            key={item.value}
            onPress={() => toggleLimited(item.value, setOpportunityRoles, 3)}
            style={{
              flexDirection: "row", alignItems: "center", gap: 8,
              borderRadius: 12, borderWidth: 1.5,
              paddingHorizontal: 14, paddingVertical: 10,
              backgroundColor: sel ? "rgba(52,211,153,0.14)" : "rgba(255,255,255,0.05)",
              borderColor: sel ? "#6EE7B7" : "rgba(255,255,255,0.12)",
            }}
          >
            <Ionicons name={item.icon} size={14} color={sel ? "#6EE7B7" : "rgba(255,255,255,0.4)"} />
            <Text style={{ fontSize: 13, fontFamily: sel ? "Inter_600SemiBold" : "Inter_400Regular", color: sel ? "#D1FAE5" : "#fff" }}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  </View>
)}
```

- [ ] **Step 6: Typecheck and commit onboarding**

Run:

```bash
pnpm --filter @workspace/connectsphere-mobile run typecheck
```

Expected: PASS.

Commit:

```bash
git add artifacts/connectsphere-mobile/app/onboarding.tsx
git commit -m "Personalize opportunity onboarding"
```

---

### Task 5: Final Opportunities Tab Structure

**Files:**
- Replace: `artifacts/connectsphere-mobile/components/NetworkingTab.tsx`

- [ ] **Step 1: Add failing import references to prove required modules exist**

At the top of `NetworkingTab.tsx`, import the new helpers:

```ts
import { buildOpportunityFeed } from "@/components/opportunities/opportunityData";
import { actionToRelayAction, buildOpportunityRelayPayload, filterOpportunityItems, searchOpportunityItems, selectOpportunitySpotlight, validateOpportunityUrl } from "@/components/opportunities/opportunityActions";
import { getOpportunities, relayOpportunityAction } from "@/services/opportunitiesApi";
```

Run:

```bash
pnpm --filter @workspace/connectsphere-mobile run typecheck
```

Expected: PASS if prior tasks are complete. If it fails, fix missing exports before UI work.

- [ ] **Step 2: Replace section-heavy UI with Opportunities state**

In `NetworkingTab`, keep imports for React Native, `Ionicons`, `LinearGradient`, `Share`, `Linking`, `router`, `useUser`, and new opportunity helpers. State should include:

```ts
const [filter, setFilter] = useState<OpportunityFilter>("For You");
const [query, setQuery] = useState("");
const [items, setItems] = useState<OpportunityItem[]>(MOCK_OPPORTUNITY_ITEMS);
const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());
const [selected, setSelected] = useState<OpportunityItem | null>(null);
const [savedOpen, setSavedOpen] = useState(false);
const [postOpen, setPostOpen] = useState(false);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
```

Load live opportunities:

```ts
useEffect(() => {
  let cancelled = false;
  (async () => {
    try {
      const result = await getOpportunities();
      if (!cancelled) {
        setItems(buildOpportunityFeed(result.opportunities ?? []));
        setError(null);
      }
    } catch (e) {
      if (!cancelled) setError(e instanceof Error ? e.message : "Could not load live opportunities");
    } finally {
      if (!cancelled) setLoading(false);
    }
  })();
  return () => {
    cancelled = true;
  };
}, []);
```

- [ ] **Step 3: Add Connect relay handler**

Inside `NetworkingTab`, add:

```ts
const currentUserId = user?.id ?? "user_self";

async function handlePrimaryAction(item: OpportunityItem) {
  const relayAction = actionToRelayAction(item.primaryAction);
  if (item.primaryAction === "Join") setJoinedIds((prev) => new Set(prev).add(item.id));
  if (item.primaryAction === "Connect") setConnectedIds((prev) => new Set(prev).add(item.id));

  try {
    const payload = buildOpportunityRelayPayload(item, relayAction, currentUserId);
    const result = await relayOpportunityAction(payload);
    if (result.chat?.id) {
      router.push({ pathname: "/(tabs)/matches", params: { openChatId: result.chat.id } } as never);
    }
  } catch {
    setSelected(item);
  }
}
```

This is the core relay requirement: RSVP, claim, apply, join, and connect actions all go to Connect through an `opportunity` chat.

- [ ] **Step 4: Add card rendering**

Use a unified card component:

```tsx
function OpportunityCard({ item, saved, joined, connected, onPress, onPrimary, onSave, onShare }: OpportunityCardProps) {
  const primaryLabel =
    item.primaryAction === "Join" && joined ? "Joined" :
    item.primaryAction === "Connect" && connected ? "Requested" :
    item.primaryAction;

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.typePill}>
          <Text style={styles.typePillText}>{item.kind === "sideHustle" ? "Side Hustle" : item.kind}</Text>
        </View>
        <Text style={styles.trustText}>{item.trustCue}</Text>
      </View>
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
      <Text style={styles.cardDescription}>{item.description}</Text>
      <Text style={styles.relevance}>{item.relevanceReason}</Text>
      <View style={styles.tagRow}>
        {item.tags.slice(0, 3).map((tag) => (
          <View key={tag} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>
        ))}
      </View>
      <View style={styles.actionRow}>
        <Pressable onPress={onPrimary} style={styles.primaryAction}><Text style={styles.primaryActionText}>{primaryLabel}</Text></Pressable>
        <Pressable onPress={onSave} style={styles.iconAction}><Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={17} color="#fff" /></Pressable>
        <Pressable onPress={onShare} style={styles.iconAction}><Ionicons name="share-outline" size={17} color="#fff" /></Pressable>
      </View>
    </Pressable>
  );
}
```

- [ ] **Step 5: Add filter/search/spotlight composition**

Derived values:

```ts
const visibleItems = useMemo(() => {
  return searchOpportunityItems(filterOpportunityItems(items, filter), query);
}, [filter, items, query]);

const spotlight = useMemo(() => selectOpportunitySpotlight(visibleItems), [visibleItems]);
const savedItems = useMemo(() => items.filter((item) => savedIds.has(item.id)), [items, savedIds]);
```

Top-level content order:

1. Header with title `Opportunities`, search, saved, post.
2. Search input.
3. Horizontal filter chips.
4. Opportunity Spotlight.
5. Loading/error notice if needed.
6. Unified feed cards.
7. Empty state.
8. Detail sheet.
9. Saved sheet.
10. Post sheet.

- [ ] **Step 6: Add saved, share, and post behavior**

Save toggle:

```ts
function toggleSave(id: string) {
  setSavedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
}
```

Share:

```ts
async function shareItem(item: OpportunityItem) {
  await Share.share({ message: `${item.title}\n${item.subtitle}\n${item.location}` });
}
```

Post local item:

```ts
function addLocalOpportunity(input: { title: string; details: string; type: OpportunityKind; location: string }) {
  const item: OpportunityItem = {
    id: `local-${Date.now()}`,
    kind: input.type,
    title: input.title,
    subtitle: "Posted by you",
    description: input.details,
    location: input.location || "Miami",
    timing: "Just now",
    source: "ConnectSphere",
    trustCue: "Your post",
    tags: [input.type],
    primaryAction: input.type === "person" ? "Connect" : input.type === "group" ? "Join" : input.type === "event" || input.type === "popup" ? "RSVP" : input.type === "hiring" ? "Apply" : "Claim",
    relevanceReason: "You posted this opportunity.",
  };
  setItems((prev) => [item, ...prev]);
}
```

- [ ] **Step 7: Typecheck and commit Opportunities UI**

Run:

```bash
pnpm --filter @workspace/connectsphere-mobile run typecheck
```

Expected: PASS.

Commit:

```bash
git add artifacts/connectsphere-mobile/components/NetworkingTab.tsx
git commit -m "Build final opportunities tab"
```

---

### Task 6: Opportunity Chat Polish In Connect

**Files:**
- Modify: `artifacts/connectsphere-mobile/app/chat/[matchId].tsx`

- [ ] **Step 1: Add failing opportunity chat type branch**

Add:

```ts
const isOpportunityChat = jsonChat?.chat?.type === "opportunity";
```

Change quick prompt logic to reference `isOpportunityChat` before it is used in full:

```ts
const quickPromptTitle = isOpportunityChat ? "Move this opportunity forward" : isDoubleDateChat ? "Plan the double date" : "Plan together";
```

Run:

```bash
pnpm --filter @workspace/connectsphere-mobile run typecheck
```

Expected: PASS after adding the constant. This confirms the chat screen recognizes opportunity type.

- [ ] **Step 2: Add opportunity quick prompts**

Replace quick action logic with:

```ts
const quickPromptTitle = isOpportunityChat ? "Move this opportunity forward" : isDoubleDateChat ? "Plan the double date" : "Plan together";
const quickActions = isOpportunityChat
  ? jsonChat?.quickActions ?? ["Next step", "Ask for details", "Set reminder", "Share contact"]
  : isDoubleDateChat
    ? jsonChat?.quickActions ?? ["Drinks", "Dinner", "Event Tonight", "Pick a Spot"]
    : isFriendPlanChat
      ? ["Coffee", "Dinner", "Event Tonight", "Pick a Spot"]
      : [];
```

- [ ] **Step 3: API quick prompts**

In `friends.ts`, update `/chats/:chatId` response:

```ts
quickActions:
  chat?.type === "double_date"
    ? ["Drinks", "Dinner", "Event Tonight", "Pick a Spot"]
    : chat?.type === "opportunity"
      ? ["Next step", "Ask for details", "Set reminder", "Share contact"]
      : [],
```

- [ ] **Step 4: Typecheck and commit chat polish**

Run:

```bash
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/connectsphere-mobile run typecheck
```

Expected: PASS.

Commit:

```bash
git add artifacts/connectsphere-mobile/app/chat/[matchId].tsx artifacts/api-server/src/routes/friends.ts
git commit -m "Polish opportunity chats"
```

---

### Task 7: Final Verification

**Files:**
- Verify only unless failures require fixes.

- [ ] **Step 1: Run helper tests**

Run:

```bash
node --test artifacts/connectsphere-mobile/components/opportunities/opportunityActions.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run mobile typecheck**

Run:

```bash
pnpm --filter @workspace/connectsphere-mobile run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run API build**

Run:

```bash
pnpm --filter @workspace/api-server run build
```

Expected: PASS.

- [ ] **Step 4: Manual relay verification**

Start API and Expo using the existing project scripts. Open Discover, switch to Opportunities, then:

- Tap `RSVP` on an event or pop-up. Expected: app navigates to Connect and opens an opportunity chat.
- Tap `Claim` on a side hustle. Expected: app navigates to Connect and opens an opportunity chat.
- Tap `Connect` on a person. Expected: app navigates to Connect and opens an opportunity chat.
- Tap `Join` on a group. Expected: app navigates to Connect and opens an opportunity chat.
- Reopen Connect. Expected: opportunity chats appear with networking intent styling.
- Open an opportunity chat. Expected: system message contains the opportunity context and quick prompts appear.

- [ ] **Step 5: Final commit if verification fixes were needed**

If verification required code fixes:

```bash
git add artifacts/connectsphere-mobile artifacts/api-server
git commit -m "Verify opportunities final structure"
```

If no fixes were needed, do not create an empty commit.

---

## Spec Coverage Self-Review

- Full Opportunities structure: Tasks 1, 2, and 5.
- Onboarding personalization: Task 4.
- Mock people looking to connect, needing help, and professionals: Task 2.
- Filters for Hiring, Side Hustles, Pop-Ups, Events, People, Groups: Tasks 1 and 5.
- User friendliness, safety, and fun: Tasks 2 and 5, with safety copy and URL validation in Task 1.
- Saved, post, search, detail behavior: Task 5.
- RSVP, claim, apply, join, connect relay back to Connect: Task 3 and Task 5.
- Connect tab as chat hub: Task 3 uses existing `opportunity` chat type consumed by `matches.tsx`; Task 6 polishes chat quick prompts.
- Verification: Task 7.

No spec requirement is intentionally deferred.
