# Friends + Plans → Connect: Logic Revamp Plan

Branch suggestion: `friends-connect-logic`
Owner: Ricky
Drafted: 2026-05-14 · Revised: 2026-05-14 (pivot from rewrite to tweak)

## Scope pivot

The existing FriendsTab UI stays. No layout rewrite. No new sections. The job is to make the two flows that the tab is built around actually work end-to-end, every time, with smart handoffs into the Connect tab.

In scope:
- Plan creation from an event → group chat in Connect.
- Plan creation from a map venue → group chat in Connect.
- Friend connection (request → accept) → 1:1 chat in Connect.
- Public-plan RSVPs → group chat in Connect.
- Group chat auto-promotion when membership crosses 3.
- Idempotency, deduplication, optimistic UI with rollback, push notifications, deep links.

Out of scope (parked for later):
- Streak system
- Swipe-to-add deck
- Leaderboard
- Stories overhaul
- Visual redesign

Small UI tweaks that fall out of the logic work (e.g., a "source: event" chip on plan cards, a "pending" state on the Connect button, a hype banner inside a freshly-promoted group chat) are in scope. Full component rewrites are not.

---

## 1. Flow A — Plan from an event

### User path
1. User taps an event in the events feed (Discover → events) or in the Friends-tab "Start a plan from…" tile.
2. `CreateFriendPlanSheet` opens pre-filled: `sourceType: "event"`, `sourceId`, `sourceName`, `sourceImageUrl`, `latitude`, `longitude`, `title`, `scheduledAt`.
3. User picks invitees from a smart-suggested list (existing friends, sorted by shared interests + recent activity).
4. User taps "Create plan."
5. Plan + group chat are created server-side. Client gets `{ plan, chat: { id } }`.
6. Client posts a system message into the chat: `"🎟 plan from {eventName} · {date}"`.
7. Client routes to Connect: `router.push({ pathname: "/(tabs)/matches", params: { openChatId: chat.id } })`.
8. Connect tab consumes `openChatId` (already wired at `matches.tsx:153–204`) and opens the thread.
9. Invitees get a push: `"{creator} invited you to {planTitle} 🎟"`. Tapping it deep-links to the same chat in Connect.

### Server behavior (`POST /friends/plans/create`)
- Validates `sourceType === "event"` requires `sourceId` and `scheduledAt`.
- Creates `plans[]` row.
- Creates `planMembers[]` row for creator (`role: "host"`).
- For each `invitedUserId`:
  - Adds `planMembers[]` row (`role: "guest"`).
  - Adds `chatMembers[]` row.
- Creates `chats[]` row (`type: "friend_plan"`, `planId`).
- Returns `{ plan, chat: { id } }`.
- New: if `chatMembers.length >= 3`, marks `chats[].isGroup = true` and writes one system message `"🎉 group chat hype on"`.
- New: schedules two pre-event reminder system messages (via a lightweight server-side reminder queue):
  - At `scheduledAt - 60min`: `"{planTitle} in 1h — who's rolling in?"`
  - At `scheduledAt - 30min`: `"30 min out — last call to lock in 🔥"`
  - Each reminder also triggers a `plan_reminder` push to every `chatMembers` row that has push enabled.

### Smart bits
- If user has already created a plan from the same `sourceId` in the last 6h, surface a "you already have a plan for this event — open it?" CTA instead of creating a duplicate.
- Invitee suggestions = friends sorted by `compatibility.score DESC` filtered to those with `activeTonight=true` if the event is tonight.
- Optimistic UI: the new plan card appears in `MY GROUPS` immediately; if the POST fails, it rolls back with a red toast.

---

## 2. Flow B — Plan from a map venue

### User path
1. User taps a pin on the map (or "Open map" from Friends tab).
2. Bottom sheet shows venue info + "Drop a plan here."
3. Tap → `CreateFriendPlanSheet` opens pre-filled: `sourceType: "map"`, `sourceId: venueId`, `sourceName: venueName`, `latitude`, `longitude`, `title` ("Hang at {venueName}" default, editable).
4. Same invitee picker as Flow A.
5. Plan + group chat creation → Connect tab handoff. Identical to Flow A from this point on.

### Smart bits
- Map pins with ≥3 active plans get a hype glow (server-derived `viralBadge=true` on the pin payload).
- If the user already RSVP'd to a public plan at the same venue, the sheet says "join the existing plan instead?" — one tap joins.

---

## 3. Flow C — Friend connection → 1:1 chat

### User path
1. User taps "Connect" on a person card (FriendsTab / People grid).
2. UI optimistically flips the button to "Pending."
3. `POST /friends/request` returns one of three outcomes:
   - `relationshipStatus: "requested"` → request was sent, button stays "Pending."
   - `relationshipStatus: "friends"` → the other user already had a pending request to me; server auto-accepted and returned `{ chat: { id } }`. Client routes to Connect on that chat.
   - `relationshipStatus: "self" | error` → button rolls back with toast.
4. When recipient accepts via Pending tab: `POST /friends/request/respond` returns `{ chat: { id } }`. Client (the accepter) is routed to Connect on the new 1:1 chat. The original sender gets a push: `"{name} accepted — say hi"`, tapping it opens the same chat.

### Server behavior
- Existing endpoints stay; tighten the contract:
  - `POST /friends/request` is idempotent on `(fromUserId, toUserId)`. If a non-cancelled request already exists, return the existing one with `relationshipStatus: "requested"`. No duplicate rows.
  - On accept, `ensureDirectChat(userAId, userBId)` is called (already exists). Verify it returns the same chat on repeat calls.
  - `relationshipStatus` projection is computed from `connections[]` + `connectionRequests[]` consistently in all list endpoints (`GET /friends/people/:userId`, `GET /friends/requests/:userId`).

### Smart bits
- If the requester is blocked by recipient (or vice versa), `POST /friends/request` returns 403 with a generic toast on the client ("can't send right now"). No info leak.
- The People grid's Connect button reflects live `relationshipStatus`: `none → Connect`, `requested → Pending`, `incoming → Accept`, `friends → Message` (opens Connect on the chat).

---

## 4. Flow D — Public plan RSVP

### User path
1. User browses public plans in the plans feed (FriendsTab → Plans, or via map).
2. Taps "Join."
3. If already friends with creator: `POST /friends/plans/join` returns `{ plan, chat }`. Client routes to Connect on the plan chat.
4. If not friends: `POST /friends/plans/request-join` returns `{ plan, request }`. UI shows "Request sent." Creator gets a push and a pending row in their inbox.
5. Creator accepts → `POST /friends/plans/respond-join` returns `{ plan, chat }`. Joiner is added to `chatMembers`. Joiner gets a push: `"you're in {planTitle} — chat opened"`. Tap → Connect.
6. When `chatMembers.length` crosses 3 on accept, server flips `isGroup=true` and writes a hype system message.

### Smart bits — shareable plan link (anyone-can-join)

`POST /friends/plans/share-link` returns `{ url, token, planId }`. The URL is a universal/app link with two-tier routing:

1. **Anyone with the app installed** taps the link → app opens directly to the plan view (via universal-link handler) → "You're invited to {planTitle}" sheet → tap **Join** → `POST /friends/plans/rsvp-link { token, userId }` → plan member + chat member rows created → full-screen **JoinedBurst** celebration animation plays (≈1.4s) → routes to Connect on the plan chat. Animation = hot-pink burst, big "you're in" text, plan title + time, then a "say hi" CTA fading into the chat.
2. **Anyone without the app** lands on a web fallback page (`/p/{token}`) that auto-redirects to the App Store / Play Store based on UA. The page sets a deferred-deep-link cookie (or uses Branch / Adjust if already in stack). After the user installs, opens, and signs in (or signs up), the app reads the deferred deep link, fetches the plan by token, and runs the same Join sheet + JoinedBurst flow.

Server contract for `POST /friends/plans/rsvp-link`:
```
body: { token, userId }
→ {
    plan: FriendPlan,
    chat: { id, isGroup: boolean },
    joinedViaLink: true,
    isFirstJoinForThisUser: boolean   // true the first time a user redeems any link
  }
```
- Token never expires unless creator revokes it (`planShareLinks[].revokedAt`).
- Each `(token, userId)` pair is logged in `planShareLinkRedemptions[]` for analytics (who joined which plan via which link).
- If the user is already a plan member, return success idempotently with `joinedViaLink: true` so the client can still play the animation if they want to reshow it (but skip the membership write).

Trade-off note: anyone-can-join via link bypasses the `visibility: "friends_nearby"` filter on plans. That's intentional — share links are explicit consent from the creator to make the plan viral. Creator can revoke a link at any time from the plan settings (`POST /friends/plans/share-link/revoke`).

Cancel-join also kills the corresponding pending plan-join-request row (already supported).

### JoinedBurst animation (mobile component)

- File: `artifacts/connectsphere-mobile/components/friends/JoinedBurst.tsx` (new).
- Full-screen overlay, hot-pink (`#ff2da8`) accents on black.
- Sequence (1.4s total):
  - 0–300ms: pink particle burst from center, "YOU'RE IN" text scales from 0 → 1 with spring.
  - 300–800ms: plan title + when/where slide up from below.
  - 800–1100ms: "say hi in the chat" CTA fades in.
  - 1100–1400ms: overlay fades out → Connect tab focus on the plan chat (`openChatId` handoff).
- Trigger paths: tapping a share link, RSVP from the plans feed, accepting a plan-join request (creator side gets "you let {name} in" version), being auto-added to a plan via group plan creation.
- Built with `react-native-reanimated` (already in the workspace via expo).

---

## 4.5 Flow E — Standalone group chat / group plan

Today the only way to land in a group chat is to be added to a plan. Users have asked to start a group thread directly — sometimes you want the crew before you've decided where to go.

### Two entry points, one underlying mechanic

**Entry 1 — "Create group chat" (no plan attached).** Multi-select 2+ friends, give the thread an optional name, tap create. Lands in Connect tab as a group chat. A plan can be attached later.

**Entry 2 — "Create group plan" (plan + chat together).** Same multi-select picker, but the user proceeds into `CreateFriendPlanSheet` with all invitees pre-loaded. This is what the existing "CREATE GROUP +" link in the FriendsTab `MY GROUPS` header already gestures at — we just wire it up.

The picker is the same component used elsewhere; the only divergence is the final commit step (create-chat-only vs create-plan-with-chat).

### UI surfaces

- The existing `CREATE GROUP +` link in the FriendsTab MY GROUPS header opens a chooser sheet: "Just a group chat" / "A plan with the crew."
- The FriendsTab Connect-button on each PersonCard gets a long-press → "Add to new group..." menu item.
- The Connect tab adds a "+" button in its header → "New group chat" (same picker).

### Server behavior

New endpoint: `POST /friends/chats/create-group`
```
body: { creatorUserId, participantUserIds[], title?: string }
→ { chat: { id, isGroup: true, title?, participantIds[] } }
```
- Validates `participantUserIds.length >= 2` (creator + 2 = 3 → already passes group-promotion threshold).
- Validates every participant is a friend of the creator (mutual friendship in `connections[]`). Non-friends are dropped with a warning in the response.
- Creates `chats[]` row with `type: "friend_direct"` if 2 participants total, `type: "group"` if 3+. Sets `isGroup = participantIds.length >= 3`.
- Creates `chatMembers[]` rows for every participant.
- Writes the first system message: `"🎉 {creator} started this group · {N} people"`.
- Returns the chat. Client routes via `openChatId`.

New endpoint: `POST /friends/chats/:chatId/add-members`
```
body: { actorUserId, addUserIds[] }
→ { chat, added: [{ userId, status: "added" | "skipped_not_friend" | "skipped_already_member" }] }
```
- Only members of the chat can add others. Returns 403 otherwise.
- Only friends of the actor can be added.
- Writes a system message: `"{actor} added {names}"`.
- Re-runs `ensureGroupPromotion(chatId)` (covers 1:1 → group transition).

New endpoint: `POST /friends/chats/:chatId/leave`
```
body: { actorUserId }
→ { chat, removedUserId }
```
- Removes the leaver from `chatMembers[]`.
- Writes a system message: `"{name} left the group"`.
- If the leaver was the only host of an attached plan, transfers host to the longest-tenured remaining member.
- If `chatMembers.length === 0` after leave, soft-deletes the chat.

New endpoint: `POST /friends/chats/:chatId/rename`
```
body: { actorUserId, title }
→ { chat }
```
- Any member can rename. Writes a system message: `"{name} renamed the group to {title}"`.

New endpoint: `POST /friends/chats/:chatId/attach-plan`
```
body: { actorUserId, sourceType, sourceId?, sourceName?, sourceImageUrl?, latitude?, longitude?, title, scheduledAt? }
→ { chat, plan }
```
- Lets a group chat upgrade itself into a plan-attached chat. Creates a `plans[]` row + `planMembers[]` rows for every current `chatMembers[]` entry. Sets `chats[].planId`.
- System message: `"🎟 plan attached — {planTitle} · {when}"`.

### Smart bits

- The picker shows online dots and "active tonight" badges so users can pick the most likely-to-show-up crew.
- If the user has previously created a group with the same set of friends in the last 30 days, the picker offers "open existing group" instead of duplicating.
- Group chat rename, add members, and leave all post system messages so participants can scroll back and reconstruct what happened.
- Group chats with no messages in 14 days surface in Connect with a "still hyped on this group?" prompt; one tap archives.

### Files touched (additions to section 6)

Mobile:
- `artifacts/connectsphere-mobile/components/friends/CreateGroupChooserSheet.tsx` — NEW. Picks between "group chat" and "group plan."
- `artifacts/connectsphere-mobile/components/friends/FriendMultiSelectSheet.tsx` — NEW. Reusable multi-select picker with online/active-tonight signals.
- `artifacts/connectsphere-mobile/components/friends/GroupChatSettingsSheet.tsx` — NEW. Rename, add members, leave, attach plan.
- `artifacts/connectsphere-mobile/services/friendsApi.ts` — add `createGroupChat`, `addGroupMembers`, `leaveGroupChat`, `renameGroupChat`, `attachPlanToChat`.
- `artifacts/connectsphere-mobile/app/(tabs)/matches.tsx` — header "+" button → open chooser; render group header (title, member count, settings cog).

Backend:
- `artifacts/api-server/src/routes/friends.ts` — five new endpoints above. Reuse `ensureGroupPromotion`.

Push:
- `chat_group_added` notification when someone adds you to a group.
- `chat_group_message` already covered by existing message push path.

---

## 5. Connect tab — what it needs

The existing Connect tab (`app/(tabs)/matches.tsx`) already consumes `openChatId`. Adjustments:
- On `useFocusEffect`, if a new chat exists that wasn't there on last focus, scroll it to top and show a tiny "new chat" dot for 3s.
- Render a `🔥 hype on` ribbon at the top of chats where `isGroup === true` and the most recent message is the auto-generated `"🎉 group chat hype on"` system message. Ribbon dismisses on first user message.
- Group chats need a header that shows participant count and the plan title (read from the linked `planId`).
- 1:1 chats with a freshly-accepted friend show a small "👋 say hi" placeholder in the message composer.

---

## 6. Files touched

### Mobile
- `artifacts/connectsphere-mobile/components/FriendsTab.tsx` — tighten Connect-button state, add toasts, ensure every action that touches a chat routes via `openConnectThread`. No layout rewrite.
- `artifacts/connectsphere-mobile/components/CreateFriendPlanSheet.tsx` — accept event/venue prefill props; submit handler returns `chatId` and routes to Connect.
- `artifacts/connectsphere-mobile/components/friends/PendingInboxSection.tsx` — on accept, route to Connect on the returned chat.
- `artifacts/connectsphere-mobile/components/friends/PlansHubSection.tsx` — RSVP button routes to Connect; show "pending" state if join request outstanding.
- `artifacts/connectsphere-mobile/app/(tabs)/matches.tsx` — focus refresh, new-chat dot, group hype ribbon, plan title header.
- `artifacts/connectsphere-mobile/app/(tabs)/map.tsx` — wire pin-tap → `CreateFriendPlanSheet` open with map prefill.
- `artifacts/connectsphere-mobile/app/(tabs)/events.tsx` — wire event-tap → `CreateFriendPlanSheet` open with event prefill.
- `artifacts/connectsphere-mobile/services/friendsApi.ts` — no new exports; tighten error handling and shape guarantees.

### Backend
- `artifacts/api-server/src/routes/friends.ts`:
  - Make `POST /friends/request` idempotent on the pair.
  - Add the dedupe check on `POST /friends/plans/create` (same `sourceId` in 6h).
  - Add `ensureGroupPromotion(chatId)` helper, called after every chat-member add.
  - Add server-side reminder queue (in-process `setTimeout` registry persisted to `db.json` for restart-safety) that fires plan T-1h and T+1h system messages.
  - Add `POST /friends/plans/share-link` and `POST /friends/plans/rsvp-link` (token-gated).
  - Tighten `relationshipStatus` projection in `GET /friends/people/:userId` so the UI's Connect button is always in the right state.
- `artifacts/api-server/src/routes/connect.ts` (or wherever `/connect/:userId` lives) — include freshly-promoted group chats; include `isGroup` field on chats.

### Push notifications
- `artifacts/connectsphere-mobile/services/pushNotifications.ts` (or equivalent existing helper) — register handlers for: `friend_request_incoming`, `friend_request_accepted`, `plan_invite`, `plan_join_request`, `plan_join_accepted`, `plan_reminder`, `group_chat_hype`.
- Backend triggers these on the corresponding endpoint completions. Reuse existing push infra per FRIENDS_CONNECT_HANDOFF_NOTES.

---

## 7. Data shape additions (lightweight)

```ts
chats[]: + isGroup?: boolean
plans[]: + reminderSentAt?: ISODate, recapPromptSentAt?: ISODate
planShareLinks[]: { id, planId, token, createdByUserId, createdAt, revokedAt? }
reminderQueue[]: { id, kind: "plan_reminder" | "plan_recap", planId, chatId, fireAt }
```

No new tables for friends — the friendship and request tables already cover Flow C.

---

## 8. Idempotency + smart-state checklist

For every endpoint that mutates state, the implementation must satisfy:
- Repeat calls with the same payload return the same result (no duplicate rows).
- Optimistic UI on the client always has a rollback path with a toast.
- The button label / pill the user is staring at reflects the server truth within 1s of the response.
- When a chat is created or its membership changes, the response includes the chat id so the client never has to guess.
- Push notifications are sent exactly once per logical event (debounced by `(kind, userId, refId)`).

---

## 9. Phased implementation

### Phase 1 — Plan creation prefill plumbing (lowest risk) ✅ DONE 2026-05-14
- `CreateFriendPlanSheet` already accepts prefill via `initialSource: PlanLocationOption`, `initialSourceTab`, `initialInviteIds`, `initialTitle` — no new props needed.
- `events.tsx` was already wired to set `planSource` on event card tap and route to Connect on creation. No change.
- `map.tsx` was wired to set `planSource` on venue tap but did NOT route to Connect on creation. **Patched**: added `router` import, added `onCreated` handler that does `router.push({ pathname: "/(tabs)/matches", params: { openChatId: result.chat.id } })`.
- `FriendsTab.tsx` had `handlePlanCreated` that switched to the Plans tab but did not open Connect. **Patched**: calls `openConnectThread(result.chat?.id)` after loadFriends so the user lands directly in the new chat. Toast copy updated to "Plan's live. Opening Connect..."

### Phase 2 — Plan create → Connect handoff hardening ✅ DONE 2026-05-14
- Server: `POST /friends/plans/create` always returned `{ plan, chat }` via `createFriendPlanWithChat`. **Patched**: added 6h dedupe before the call — if creator made a plan with the same `(sourceType, sourceId)` in the last 6 hours, returns the existing plan + chat with `deduped: true` and status 200. Prevents accidental duplicate plans from a double-tap on an event card.
- Server: system message inside the new chat used to say `"Plan created: {title}."`. **Patched**: now reads `"🎟 plan from {sourceName} · {when}"` for event-sourced plans, `"📍 plan at {sourceName} · {when}"` for map-sourced plans, `"✨ plan {sourceName} · {when}"` for custom. Gives the new group thread immediate context.
- Client: routing already covered in Phase 1.

### Phase 3 — Friend request flow idempotency + handoff ✅ DONE 2026-05-14
- Server: `POST /friends/request` was idempotent at the data layer (via `ensurePendingRequest`) but always returned `201`. **Patched**: returns `200` when a same-direction pending request was reused (`reused: true`), `201` only on fresh insert.
- Server: added **mutual-match auto-accept**. If the other party already had a pending request to me when I send mine, server flips status to `accepted`, calls `ensureConnection` to create the friendship + 1:1 chat, and returns `{ relationshipStatus: "friends", chat, mutual: true }`. No second tap needed.
- Server: also blocks self-requests (`fromUserId === toUserId` → 400).
- Client (`FriendsTab.handleConnect`): captures the response. If `relationshipStatus === "friends" && chat.id` came back, flips optimistic state to friends, drops the optimistic request row, fires success haptic, shows "It's mutual with {name}. Say hi." toast, and `openConnectThread(chat.id)`. If it was a normal request, original flow continues (toast + switch to Pending tab).
- Push wire-up for `friend_request_*` events — **deferred to Phase 6** since the push helper isn't in this file path yet.

### Phase 4 — Public plan RSVP + share link + JoinedBurst ⏳ MOSTLY DONE 2026-05-14
- Server ✅: `POST /friends/plans/share-link` mints (or reuses) a tokenized link `/p/{token}` for the plan creator or any plan member. `POST /friends/plans/rsvp-link` redeems the token, adds the user as a plan member + chat member, writes a `"🔗 joined via share link"` system message, logs the redemption in `planShareLinkRedemptions[]`, and returns `{ plan, chat, joinedViaLink: true, isFirstJoinForThisUser }`. Idempotent on already-member. `POST /friends/plans/share-link/revoke` flips `revokedAt` so further redemptions return 404.
- Server ✅: new tables `planShareLinks[]` and `planShareLinkRedemptions[]` added to `FriendsDb`. `readDb` defaults both to `[]`.
- Mobile API ✅: `sharePlanLink`, `rsvpPlanViaLink`, `revokePlanShareLink` added to `services/friendsApi.ts`.
- Mobile UI ✅: `JoinedBurst.tsx` built at `components/friends/JoinedBurst.tsx`. Full-screen overlay, 16 colored particles bursting from center, "YOU'RE IN" title with spring, plan title + when/where sliding up, optional "open the chat" CTA fading in, ~1.4s auto-dismiss with success haptic. Pure RN Animated, no extra deps.
- Mobile UI ✅: `FriendsTab.handleRequestJoinPlan` triggers JoinedBurst on `status === "joined"`. Burst dismiss routes to Connect on the plan chat. Share button (`handleSharePlan`) now mints a real share link via `sharePlanLink` and drops it into the native share sheet.
- Mobile / app config ⏳ deferred: universal-link handler in `app/_layout.tsx` mapping `https://connectsphere.app/p/{token}` → Plan-Invite sheet → `rsvpPlanViaLink` → JoinedBurst. Requires updates to `app.json` (`scheme`, `associatedDomains`, `intentFilters`) plus AASA file on the web origin and `assetlinks.json` for Android. Flag for the next deploy cycle.
- Web fallback ⏳ deferred: `/p/{token}` page that UA-sniffs and redirects to App Store / Play Store with deferred-deep-link cookie. Needs a tiny separate web bundle — not in this workspace yet.
- Push: `plan_joined_via_link` notification to creator — deferred to Phase 6.

### Phase 4.5 — Standalone group chats / group plans
- Server: 5 new chat endpoints (`create-group`, `add-members`, `leave`, `rename`, `attach-plan`).
- Mobile: `CreateGroupChooserSheet`, `FriendMultiSelectSheet`, `GroupChatSettingsSheet`. Wire the existing `CREATE GROUP +` link to the chooser. Add Connect-tab header "+" button.
- Push: `chat_group_added`.
- Verify: typecheck, build, manual smoke (create group chat with 3 people, rename, add a 4th, leave, attach a plan to it).

### Phase 5 — Group chat promotion + Connect tab polish ⏳ SERVER DONE 2026-05-14
- Server ✅: `Chat` type gains `isGroup?: boolean` and `groupPromotedAt?: string`. New helper `ensureGroupPromotion(db, chatId)` flips the flag and posts a one-time `"🎉 group chat hype on"` system message when membership crosses 3. Wired into 4 sites: `createFriendPlanWithChat` (creator + invitees may already be 3+), `joinPlanAsMember`, plan join-request accept handler, and the new share-link RSVP redemption.
- Client ⏳ pending: `matches.tsx` rendering of a small `GROUP` pill + hype ribbon on group chats. Needs Conversation type to surface `isGroup` from the API response.
- Server: `ensureGroupPromotion(chatId)` after every member add. Returns the chat with `isGroup` flag.
- Client: `matches.tsx` hype ribbon + plan-title header + "new chat" dot on focus refresh.

### Phase 6 — Reminder queue
- Server: `reminderQueue[]` + `setTimeout` registry with restart recovery on boot.
- Plan T-1h and T+1h system messages.
- Push wire-up for `plan_reminder`.

### Phase 7 — Verification + cleanup
- Full mobile typecheck, full api-server build.
- Manual smoke through every flow on Expo Go (port 8083).
- Subagent cross-file review for orphan handlers, dead toasts, missing rollbacks.

---

## 10. Verification per phase

1. `pnpm.cmd --filter @workspace/connectsphere-mobile typecheck`
2. `pnpm.cmd --filter @workspace/api-server build`
3. Smoke endpoints with `curl` against local API (port 8080):
   - `POST /friends/plans/create` with `sourceType: "event"`
   - `POST /friends/plans/create` with `sourceType: "map"`
   - `POST /friends/request` (twice with same payload → confirm idempotency)
   - `POST /friends/plans/request-join` → `respond-join` → confirm chat membership and `isGroup`
4. Expo Go E2E: tap an event → create plan → Connect opens on the chat. Send a friend request → accept on second account → both land in Connect.
5. Final phase: code review subagent across all touched files.

---

## 11. Open items locked in

- ~~Streak window~~ — parked.
- ~~Leaderboard~~ — parked (Miami + Broward scope retained for when we ship it).
- ~~Vibe deck~~ — parked.
- ~~Stories overhaul~~ — parked.
- ~~Reminder window~~ — **DECIDED: T-1h and T-30min before plan.** No post-event recap message (parked).
- Group promotion threshold: 3+ members. Confirmed.
- Push notifications: reuse existing infra per handoff notes.
- ~~Share-link auth~~ — **DECIDED: anyone with the link can join.** No sign-in wall to tap. If the app is installed → opens app + Join sheet + JoinedBurst animation. If not → App Store / Play Store with deferred deep link so the join completes after install. Creators can revoke a link at any time.

---

## 12. What to confirm before I start Phase 1

Two quick ones:

1. **Reminder timing** — T-1h and T+1h on every plan, or only on plans where the creator opts in?
2. **Share-link auth** — should rsvp-via-link require the user to be signed in (recommended), or allow anonymous "open in app to RSVP"?

Say "go" and your answers, and I start Phase 1.
