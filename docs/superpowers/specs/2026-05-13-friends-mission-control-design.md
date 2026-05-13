# Friends Mission Control Design

## Goal

Make the Friends tab feel like a complete, launch-ready friend-making product inside ConnectSphere. The tab should be easy to understand, action-oriented, and alive without becoming a confusing social feed. A user should always know who to meet, why that person is a good fit, what action is available, and where the conversation or plan continues.

## Product Direction

Use a Mission Control structure rather than a feed-first structure. The top of the screen should guide the user toward the strongest next action, while the rest of the tab organizes people, moments, requests, and plans into clear sections.

The tab is for discovery, decisions, and lightweight social momentum. Connect is the permanent home for chat, plan coordination, and relationship follow-through. Every successful friend or plan action should either create, reveal, or open a Connect thread.

The final experience should feel like:

- Here are your best friend opportunities.
- Here is what is happening right now.
- Here is what needs your response.
- Here is how to turn a person or moment into a real plan.
- Here is where to continue in Connect.

## Engagement Model For Ages 18-50

The tab should feel useful for a broad 18-50 audience by avoiding overly young, trend-heavy social mechanics. The hook should come from clarity, relevance, and momentum:

- One best next move at the top so users do not have to think.
- Clear reasons for every suggested person.
- Low-pressure plan prompts that work for coffee, walks, gym, brunch, family-friendly outings, nightlife, events, and professional-adjacent hangouts.
- Lightweight live signals instead of a full stories product.
- Visible progress from stranger to request to friend to plan to Connect thread.
- Strong feedback after every action so the app feels responsive.

The product should not depend on users posting constantly. It should still feel active through suggested actions, nearby plans, incoming requests, and Connect handoffs.

## Existing Foundation

The current app already has the core plumbing needed for a strong Friends tab:

- People discovery, search, smart pick, relationship states, and profile sheets in `artifacts/connectsphere-mobile/components/FriendsTab.tsx`.
- Friend requests, outgoing requests, cancellation, accept, ignore, block, and report actions.
- Friend plans, plan feed, plan creation, join requests, plan details, sharing, and Connect handoff.
- Backend story/moment endpoints in `artifacts/api-server/src/routes/friends.ts`.
- Mobile story APIs in `artifacts/connectsphere-mobile/services/friendsApi.ts`: `getFriendStories`, `createFriendStory`, `reactToFriendStory`, and `replyToFriendStory`.
- Connect integration in `artifacts/connectsphere-mobile/app/(tabs)/matches.tsx`, including `openChatId` handoff and friend-plan chat support.

The main missing piece is not raw capability. It is final product structure, visible moment/status functionality, and clearer guidance across every state.

## Final Screen Structure

### 1. Today Command Center

The top section should show one primary recommendation based on current data.

Priority order:

1. Incoming friend request.
2. Incoming plan join request.
3. Upcoming plan with an available Connect thread.
4. Best smart pick from people discovery.
5. Nearby or live plan to join.
6. Create a plan when there is no stronger action.

Each command card should include:

- A short label, such as `Best next move`, `Needs reply`, or `Tonight`.
- One clear headline.
- One reason line.
- One primary action.
- One secondary action only when it is truly useful.

Examples:

- `Accept Nina's request` with `You both like parks, food, and calm daytime plans`.
- `Invite Maya to coffee` with `86% fit around Brickell`.
- `Open your plan thread` with `Dinner starts tonight at 8:00 PM`.

### 2. Live Friend Signals

Surface the existing stories/moments API as a compact horizontal section. This should make Friends feel alive while keeping the rest of the tab organized.

Supported signal types:

- Status: `Coffee later?`
- Photo: `Out in Wynwood tonight`
- Plan invite: `Who wants to join dinner?`

Each signal should support:

- React.
- Reply.
- Connect or request, depending on relationship status.
- Turn into a plan when appropriate.

The section should never feel like a full social feed. It is a lightweight radar of who is open to doing something. User-facing copy should call these `signals`, `moments`, or `open to plans`, not `stories`.

### 3. People To Meet

Keep the existing smart pick and people cards, but make each card more decision-ready.

Each person card should show:

- Name, age, image, and location.
- Relationship state.
- Compatibility score.
- One concrete reason they fit.
- Up to three shared interests or relevant interests.
- Suggested first plan.
- Primary relationship action: `Connect`, `Accept`, `Message`, or `Requested`.
- Secondary action: `Make Plan`.

Card copy should avoid vague labels. It should answer why this person belongs in the Friends tab.

### 4. Pending Inbox

The Pending section should behave like a simple inbox, not a mixed pile.

Request types:

- Incoming friend request.
- Outgoing friend request.
- Incoming plan join request.
- Outgoing plan join request.
- Plan invite.
- Story reply request.

Every pending item should answer:

- Who is involved.
- What kind of request it is.
- Why it exists.
- What the current status is.
- What action is available.

Actions:

- Incoming friend request: `Accept`, `Ignore`.
- Outgoing friend request: `Waiting`, `Cancel Request`.
- Incoming plan join: `Accept`, `Decline`.
- Outgoing plan join: `Waiting`, `Cancel Join`.
- Plan invite: show the plan context and allow cancellation when sent by the viewer.

### 5. Plans Hub

Plans should be organized into clear groups:

- `Tonight / Upcoming`
- `Plans to Join`
- `Your Plans`

Each plan card should show:

- Title.
- Time.
- Place.
- Host.
- People count.
- Live/upcoming status.
- Join/request state.
- Primary action: `Open Connect`, `Request to Join`, or `Create Plan`.
- Secondary action: `Share`.

Plan detail should continue to show the hero image, what/when/where, attendees, share action, join action, and Connect handoff.

### 6. Profile Detail

Keep the full-screen profile sheet, but make it more friendship-oriented.

Add or strengthen:

- Best next move.
- Friendship fit reason.
- Ideal first plan.
- Shared vibe or interests.
- Safety/preferences cues.

Bottom actions should stay simple:

- Primary: relationship action.
- Secondary: make a plan.

Report and block remain in the top safety menu.

## States and Empty Screens

Every major section needs its own ready state, loading state, empty state, and error state.

Examples:

- People empty: suggest inviting people or clearing search.
- Signals empty: suggest posting a status or creating a plan.
- Pending empty: explain that requests and plan joins will appear here.
- Plans empty: offer `Create Plan`.
- API error: keep existing data if possible and show a retry action.

The tab should never look broken when data is missing.

## Data Flow

Friends tab should load these resources together:

- People.
- Friend requests.
- User plans.
- Plan feed.
- Friend stories/signals.

Derived UI state:

- Today Command Center chooses its recommendation from loaded people, requests, plans, plan feed, and stories.
- Pending count comes from friend requests plus plan join requests.
- People cards use relationship status, compatibility, shared interests, and suggested plan fields.
- Signals use story relationship status to decide whether to reply, request, connect, or open chat.

Existing API methods should be reused where possible. New endpoints should only be added if the current story/request/plan APIs cannot support a needed state.

## Connect Relay Contract

Friends must consistently relay completed relationship actions into Connect:

- Existing friend + `Message` opens the direct Connect thread.
- Accepted friend request creates or opens a direct Connect thread.
- Story reply from an existing friend writes to the direct Connect thread and opens it.
- Story reply to a non-friend creates a pending request; once accepted, the resulting chat opens in Connect.
- Created plan creates a plan Connect thread.
- Joined plan opens the plan Connect thread.
- Accepted plan join opens the plan Connect thread for both sides.
- Today Command Center should prefer `Open Connect` when the highest-value action already has a chat.

Connect should be the only place for ongoing conversation. Friends should not introduce a separate chat surface.

## Error Handling

Actions should be optimistic only where rollback is already safe:

- Friend request send/cancel.
- Request accept/ignore.
- Plan join request/cancel.
- Plan creation.
- Story reaction.

Each action should show clear feedback:

- Success haptic where appropriate.
- Short toast/notice.
- Clear Connect handoff when a chat is created or opened.

Failure copy should be specific enough to recover:

- `Could not send request. Try again.`
- `Could not create plan. Pick a place and try again.`
- `Could not reply to this moment.`

## Implementation Boundaries

The current `FriendsTab.tsx` is doing too much. The implementation should split it into focused pieces:

- `FriendsTab` as the orchestrator.
- `TodayCommandCenter`.
- `FriendSignalsRow`.
- `PeopleToMeetSection`.
- `PendingInboxSection`.
- `PlansHubSection`.
- `FriendProfileSheet`.
- `PlanDetailSheet`.
- Shared helpers for labels, haptics, relationship action mapping, and plan labels.

This keeps launch work safer and makes future polish easier.

## Launch Readiness Checklist

The Friends tab is launch-ready when:

- A new user understands what to do within five seconds.
- Every visible action changes state, opens a sheet, opens share, or hands off to Connect.
- People, requests, plans, stories, profile, and plan detail states all have useful empty and error states.
- Accepting a friend request opens or creates a Connect thread.
- Creating or joining a plan opens or creates a plan thread.
- Every accepted friendship and joined plan is visible in Connect without requiring a manual refresh.
- Friend, signal, request, and plan success messages clearly tell the user when the next step is in Connect.
- Blocking removes the user from people, requests, plans, and plan feed.
- Reporting confirms submission without breaking the profile sheet.
- Stories can be reacted to, replied to, or converted into a request/plan flow.
- Typecheck passes for mobile.
- API build passes.

## Recommended Scope For First Implementation Pass

Build the launch-ready version in this order:

1. Split `FriendsTab.tsx` into sections without changing behavior.
2. Add Today Command Center using existing loaded data.
3. Surface Live Friend Signals using existing story APIs.
4. Add story reaction and reply flows.
5. Tighten Pending Inbox labels and request types.
6. Tighten Plans Hub grouping and empty states.
7. Add request message composer if time allows after the main flow is stable.
8. Run mobile typecheck and API build.

The first pass should prioritize clarity and complete flows over extra visual effects.
