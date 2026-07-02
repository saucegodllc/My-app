# ConnectSphere — Per-Flow Optimization Plan
**Routing + Backend · Launch Readiness**
*Based on source audit + Tinder/Hinge/Bumble architecture research*
*Pass this to Codex to implement*

---

## How to Read This

Each section = one flow. Each fix is labeled:

- 🔴 **BLOCKING** — app will behave broken or lose money without this
- 🟡 **POLISH** — noticeable gap that makes the app feel unfinished
- 🟢 **UPGRADE** — makes it feel professional and competitive

---

## FLOW 1: DISCOVER TAB

### What happens now
User opens Discover → swipe fires → server checks for a match, creates a chat thread, and responds — all in one blocking request before the next card appears.

---

### Backend Fixes

**🔴 Swipe limit is only enforced on the client**
The free swipe counter lives in AsyncStorage on the phone. Any user can clear their storage, reinstall the app, or use developer tools to reset it. The server never checks how many swipes a user has made today.
- Add a server-side daily swipe counter keyed to `userId` stored in the database
- `POST /api/discovery/action` should reject with 429 if the user has exceeded their free tier limit
- Client-side counter becomes the optimistic display; server is the authority

**🔴 Swipe action is synchronous — match check blocks the response**
Right now: you swipe → server saves like + checks for match + creates chat thread + sends push notification + responds. All of that happens before the next card appears.
- Split into two steps: (1) save the like and respond immediately, (2) run the match check + chat creation + push notification as a follow-up async job
- Immediate response means the next card appears in under 100ms
- Match notification arrives via push 1-2 seconds later rather than blocking the swipe

**🔴 No idempotency on swipe action**
If a swipe request times out and the client retries, two `like` records are created for the same target. This can produce ghost matches or duplicate notifications.
- Add a unique constraint on `(fromUserId, toUserId)` in the `likes` table
- `POST /api/discovery/action` should use `INSERT ... ON CONFLICT DO NOTHING` so duplicate swipes are silently ignored

**🟡 Discovery feed loads all swipe data in one query — no cursor**
The feed query currently excludes all already-seen users in a single `NOT IN` clause. As a user's swipe history grows, this query gets slower.
- Switch to cursor-based pagination: each response returns a `nextCursor` token
- Client passes the cursor on the next feed request instead of loading everything fresh

---

### Routing Fixes

**🔴 Congrats (match) screen has no direct path to the new chat**
When a match fires, `/congrats` plays. But after the animation, where does the user go? If they have to navigate manually to the Connect tab and find the conversation, the emotional high of the match dies.
- Pass the new `chatId` to the congrats screen as a route param
- Add one bold "Send Message" button on the congrats screen that calls `openChat(chatId)` directly
- This is how Tinder converts the match moment into a first message

**🟡 Deck-empty state doesn't suggest the most actionable fix**
The empty deck currently shows: go to Spaces, go to Events. It doesn't tell the user *why* their deck is empty or what to do about it.
- Add a third card: "Update your photos" → `/settings` (profile edit)
- Bad photos are the #1 cause of empty decks on dating apps — Hinge surfaces this directly
- Optional: show "Expand your distance" as a quick filter toggle inline

**🟡 Premium gate for Rewind/Boost sends to `/premium` but doesn't return to Discover after purchase**
User goes to premium, subscribes, hits the success screen — and lands on the success screen with no clear way back to where they were.
- After Stripe success, route to `/(tabs)/index` (Discover) with a `?unlocked=rewind` param
- Discover screen reads that param and briefly shows a toast: "Rewind unlocked ✓"

---

## FLOW 2: CONNECT TAB

### What happens now
Tab opens → fetches all 100 matches in one request → polling checks unread count on a timer → messages fetched on demand via REST GET.

---

### Backend Fixes

**🔴 Match list fetches 100 at once — no pagination**
`GET /api/matches?page=1&limit=100` loads all matches every time the tab opens. At 100+ matches this becomes a slow, heavy query.
- Add cursor-based pagination: `GET /api/matches?cursor=<timestamp>&limit=20`
- Tab loads the 20 most recent conversations; user scrolls down to load more
- Unread conversations always appear first (sort by `lastActivity DESC`)

**🔴 Chat messages use polling, not real-time delivery**
`GET /api/inbox/messages/:convId` is called on a timer. Between polling cycles, new messages sit unseen. Chat feels laggy.
- Implement Server-Sent Events (SSE) on `GET /api/messages/stream/:convId`
- SSE is a one-way push from server to client — simpler than WebSockets, works on Render, and delivers new messages the instant they're saved
- WebSockets are the eventual upgrade (Tinder uses Go-based WebSocket servers) but SSE fixes the immediate problem

**🔴 Unread count is polled — creates constant background traffic**
`useUnreadCount` fires on a timer for every user with the tab open. Every poll is a database query.
- Replace with SSE: server pushes unread count updates when a new message arrives for that user
- One persistent connection per active user instead of N polls per minute per user

**🟡 Two separate chat systems (local vs server) behave differently**
Local chats (`chatId.startsWith("local:")`) route to `/chat/dating/[id]` and use AsyncStorage. Server chats route to `/chat/[matchId]` and use Postgres. Users don't know which they're in but the experiences feel different.
- Consolidate: all new matches should create a server-backed chat thread in Postgres
- Local chats can remain for existing data but new matches always go to the server path
- One chat experience, one back-stack, one behaviour

**🟡 No message delivery states (sent / delivered / read)**
Messages have no status. The sender doesn't know if the message was delivered or seen. This is a baseline expectation on every messaging app since 2015.
- Add `status` field to messages table: `sent | delivered | read`
- `delivered` flips when the recipient's client fetches the message
- `read` flips when the recipient opens the conversation
- Show as single/double checkmarks in chat UI

**🟡 Shot accept drops user into chat with no context**
When you accept a Shot, you get routed to a new chat with that person. But the chat opens empty — the original Shot message they sent you isn't pre-loaded as the first message.
- On Shot accept, the Shot's original message should become the first message in the new chat thread
- Server should write it to the messages table when creating the chat on accept
- User opens chat and sees: their opener as the first bubble, ready to reply

---

### Routing Fixes

**🔴 `?openChatId` query param is unvalidated**
The Connect tab reads `?openChatId` on mount and calls `openChat(id)` with it. A crafted push notification or deep link could pass any string here.
- Server: when opening a chat, verify the authenticated user is a participant before returning messages
- Client: before calling `openChat`, verify the chatId exists in the user's loaded match list

**🟡 No "new activity" distinction within the Connect tab**
Everything — old conversations, new shots, new reactions — is in one mixed list. Users don't know where to look when something new happens.
- Split the tab into two sections: **Conversations** (existing chats) and **New** (shots, reactions, requests)
- "New" section has its own unread badge within the tab
- Conversations sort by last message time

**🟡 After declining a Shot, the list doesn't update cleanly**
Declining a shot removes it from the list, but depending on timing the list can briefly show the item then snap-remove it.
- Optimistic UI: remove the item immediately on decline tap before the server responds
- On server error, restore the item and show an error toast
- This is standard practice on Tinder and Hinge — the action feels instant

---

## FLOW 3: EVENTS TAB

### What happens now
Tab opens → server calls Ticketmaster for Miami events → returns list → user taps card → bottom sheet opens → RSVP toggle → interest saved.

---

### Backend Fixes

**🔴 No server-side caching of Ticketmaster responses**
Every time a user opens the Events tab, the server makes a live call to Ticketmaster. Ticketmaster's API has rate limits. If 50 users open Events at the same time, you fire 50 Ticketmaster requests.
- Cache Ticketmaster responses in the database or in-memory for 15 minutes
- Serve cached results to all users; refresh in the background when cache expires
- Reduces Ticketmaster API costs and eliminates cold-start delay on the Events tab

**🔴 `status` field on interest toggle is not validated server-side**
`POST /api/events/interest/toggle` accepts a `status` field from the client. If the client sends an invalid value, it goes straight to the database.
- Add server-side enum validation: `status` must be one of `"interested" | "saved" | null`
- Reject with 400 if any other value is sent

**🟡 `sourceIds` query param has no length limit**
`GET /api/events/context/:userId?sourceIds=<ids>` accepts a comma-joined list of event IDs. A client could theoretically send thousands of IDs in one request.
- Cap at 50 IDs per request server-side; return 400 if over limit
- Client should paginate its context requests to match

**🟡 No push notification when a match RSVPs to the same event**
This is ConnectSphere's biggest missed opportunity. Tinder and Hinge can't do this — they don't know what real-world events you're going to. ConnectSphere does.
- When a user RSVPs to an event, check if any of their matches have also RSVPd to the same event
- If yes, fire a push to both: "[Name] is also going to [Event] 🎉 — say something!"
- This is a conversation starter that feels organic, not forced

**🟡 Chat opened from Events has no event context**
When you tap "Message" on an attendee from the event detail sheet, a chat opens cold — no mention of the event that connected you.
- Pass `eventContext: {eventName, eventDate}` as part of the chat creation payload
- Server stores it as the first system message in the thread: "You both RSVP'd to [Event] on [Date]"
- This is the icebreaker — every Hinge conversation starts with a shared signal; Events can be that signal for ConnectSphere

---

### Routing Fixes

**🟡 Back navigation from attendee profile doesn't return to the event**
Tapping an event attendee → their profile → back. Currently back goes to the tab root, not back to the event detail sheet.
- Pass the event context as a param when navigating to `/user/[userId]` from Events
- The back button on the profile screen should restore the event detail sheet
- This keeps the user in the context of the event they were exploring

**🟡 RSVP state isn't persisted across app restarts**
If you tap "I'm Interested" on an event, close the app, and reopen it — the button might not show your RSVP state because the tab re-fetches from Ticketmaster (which doesn't know about your RSVP).
- Load user's RSVPs from `/api/events/interest` on mount
- Merge with Ticketmaster feed to pre-populate interest states
- User always sees their own RSVPs correctly even after restart

---

## FLOW 4: SPACES TAB

### What happens now
Tab opens → fetch community list → tap community → push to `/communities/[id]` using a template literal string → community detail loads.

---

### Backend Fixes

**🔴 No rate limiting on post and reply creation**
`POST /api/communities/posts` and `POST /api/communities/posts/:id/replies` have no rate limiting. A single user could spam hundreds of posts per minute.
- Add per-user rate limit: 5 posts per hour, 20 replies per hour
- Return 429 with a message: "You're posting too fast — slow down"
- This is spam prevention, not a UX feature

**🔴 No content sanitization on user-generated text**
Post content and reply content go from the client directly to the database without sanitization. A user could inject scripts or malicious content.
- Strip HTML tags from all post and reply content before saving
- Enforce max length: 500 chars for posts, 280 chars for replies
- These limits prevent database abuse and keep content readable

**🟡 No push notification when someone replies to your post**
You post in a community. Someone replies. You never know unless you open the app and navigate back to that post.
- When a reply is created, look up the original post author's userId
- Fire a push: "[Name] replied to your post in [Community]"
- Route the notification directly to `/communities/thread/[postId]`

**🟡 Community posts are not geo-scoped**
Every community shows content from all users everywhere. For a Miami-first app, this will dilute the local feel as the app grows.
- Add an optional `location` tag to communities (e.g. "Miami", "Miami Beach", "Brickell")
- Filter community list to show Miami-tagged communities first
- Users outside Miami can still join but Miami users see local content by default

---

### Routing Fixes

**🔴 communities.tsx line 258 uses template literal string interpolation**
```
router.push(`/communities/${encodeURIComponent(slug)}` as any)
```
This is the same pattern that was fixed in the community detail screen but was missed in the list screen. This is a known Expo Router bug trigger.
- Change to: `router.push({ pathname: "/communities/[id]", params: { id: slug } })`
- This is the only remaining string interpolation nav bug in the app

**🟡 After creating a community, user lands on the list — not inside the new community**
You fill out the create form, hit submit, the modal closes, you're back on the community list. You have to find and tap your new community to enter it.
- On successful community creation, the server returns the new community's slug
- Immediately navigate: close modal → `router.push` to the new community's detail page
- User lands inside their community ready to post

**🟡 Back stack from thread doesn't return to community**
`communities/thread/[postId]` → back → should return to `communities/[id]`. Currently depends on how the user got there.
- Ensure thread screen is always pushed on top of community detail (card presentation)
- Thread back button explicitly routes to `communities/[id]` with the community slug as param
- Never allows back to go to the tab root unless the user has navigated up the full stack

**🟡 Spaces tab has no unread/new content badge**
When new posts appear in communities you've joined, there's no indicator on the tab icon or within the tab.
- Track `lastReadAt` per user per community (one DB row per membership)
- On tab open, compare against latest post timestamps
- Show a dot badge on the Spaces tab icon when there are unread posts in joined communities

---

## FLOW 5: PROFILE TAB

### What happens now
User taps floating pink avatar button → `/(tabs)/profile` loads → shows their profile data → buttons to settings, profile views, referral.

---

### Backend Fixes

**🔴 Account deletion doesn't fully cascade**
When a user deletes their account, the deletion needs to remove: Clerk identity, profiles table, likes table, matches table, messages table, spark_memory table, push tokens in db.json, community memberships, community posts.
- Audit the account deletion handler — verify it hits all of these
- The push tokens in db.json are particularly easy to miss since they're in a flat file, not the database
- Incomplete deletion = GDPR violation for any EU users

**🔴 Profile view count doesn't deduplicate**
If the same user views your profile 10 times in one day, does that count as 10 views or 1?
- Add deduplication: one view per `(viewerId, profileOwnerId)` per 24-hour window
- Store in a `profile_views` table with `viewerId`, `profileOwnerId`, `viewedAt`
- Daily unique views only — same as how Instagram counts story views

**🟡 Data export endpoint has no rate limit**
`GET /api/profiles/me/export` can be called repeatedly. A profile export could be a large payload.
- Rate limit to 1 export per 24 hours per user
- Return 429 with `retryAfter` header if called too soon

**🟡 Profile update fields aren't validated server-side**
`PATCH /api/profiles/me` and `/api/profiles/me/preferences` accept user-controlled values. Bio, display name, and photo URLs come from the client.
- Max lengths: `bio` ≤ 300 chars, `displayName` ≤ 50 chars
- Photo URLs must be validated as actual URLs (not arbitrary strings)
- Age range in discovery preferences: minAge ≥ 18, maxAge ≤ 99, minAge ≤ maxAge
- Distance: must be a positive number with a reasonable cap (e.g. ≤ 500 miles)

---

### Routing Fixes

**🔴 Profile is a hidden tab — most users won't find it**
The floating avatar button is not where users look for their profile. It's non-standard, small, and easy to miss.
- Promote Profile to a real 4th tab: Discover → Connect → Events → Profile
- Remove the floating avatar button (or keep it as a secondary path)
- Spaces/Communities moves to href: null (accessible via discovery or Events context) or stays as tab 4 with Profile as tab 5 — but 4 tabs max

**🟡 After premium purchase, profile doesn't show Plus badge immediately**
User subscribes → Stripe → success screen → they navigate to their profile. The profile still shows the free tier until the next full reload because the local profile state isn't refreshed.
- After Stripe success route, trigger a profile data refresh before rendering the profile screen
- User sees their Plus badge the first time they look at their profile post-purchase

**🟡 Settings → Discovery Filters → Save has no clear return route**
After saving discovery preferences, where does the user go? Back to settings? Back to Discover?
- Save → close the filters modal → return to Discover tab with fresh feed loaded using new filters
- Show a brief toast: "Filters updated — refreshing your deck"
- The feed should reload automatically with the new parameters

**🟡 Profile edit (photo update) has no success feedback**
Uploading a new photo or changing your bio — what happens after? Is there a success state? Does it save automatically?
- Add explicit Save button with loading state
- On success: brief green toast "Profile updated ✓" then return to profile view
- On failure: show specific error (e.g. "Photo upload failed — try a smaller image")

---

## CROSS-CUTTING BACKEND ISSUES
*(These affect every flow, not just one tab)*

**🔴 Push tokens stored in db.json — not the database**
Push tokens are stored in a flat file on the Render server. Concurrent writes corrupt it. Server restarts can lose recent registrations. This is why push notifications are unreliable.
- Move push token storage to a `push_tokens` table in Postgres: `(userId, token, updatedAt)`
- All notification dispatch reads from Postgres, not the file
- Single fix, eliminates the root cause of most notification failures

**🔴 Dating shots + double date data stored in db.json — not the database**
`dating.ts` reads/writes `db.json` for shots, shot usage, and some match records. This runs parallel to the Drizzle/Postgres database, creating split state.
- Migrate: `datingShots`, `shotUsage`, `datingMatches` tables → Postgres schema
- Same for double date pair data
- One database. One source of truth. No more ghost matches.

**🔴 AI rate limit lives in server memory — resets on every deploy**
`Map<userId, {count, resetAt}>` in `aiChat.ts`. Render deploys (which happen on every code push) reset all counters. Every deploy gives every free user a fresh 5 messages.
- Move to a `ai_rate_limits` table in Postgres: `(userId, count, windowStart)`
- Or use the existing `spark_memory` table pattern — already in Postgres
- Server checks DB on every request instead of in-process memory

**🟡 Push notification `data.route` is not allowlisted**
When your app receives a push notification, `PushTokenRegistrar.tsx` reads `data.route` and passes it to `router.push()`. A crafted push payload could route the user to any screen.
- Define an allowlist of valid route values
- Before calling `router.push(route)`, verify `route` matches one of: `/(tabs)/index`, `/(tabs)/matches`, `/chat/dating/[id]` (with valid numeric ID)
- Reject any route not in the allowlist

**🟡 No retry logic on fire-and-forget API calls**
Moments likes, reactions, and other fire-and-forget calls in the client have no retry. If the network drops mid-request, the action is silently lost.
- Wrap fire-and-forget calls in a retry utility: 3 attempts with exponential backoff (500ms, 1000ms, 2000ms)
- Store failed actions in a local queue (AsyncStorage) and retry on next app foreground

---

## SUMMARY: WHAT TO FIX FIRST

| # | Fix | Impact | Effort |
|---|---|---|---|
| 1 | Move push tokens to Postgres | Notifications stop being unreliable | Low |
| 2 | Migrate db.json data to Postgres | Eliminates ghost matches and split state | Medium |
| 3 | Fix `communities.tsx` line 258 nav bug | Spaces routing works correctly | Very Low |
| 4 | Add congrats screen "Send Message" button | Match moment converts to conversation | Very Low |
| 5 | Move AI rate limit to Postgres | Stops revenue leak on every deploy | Low |
| 6 | Server-side swipe limit enforcement | Free limit can't be bypassed | Low |
| 7 | Idempotency on swipe action | No more ghost matches from retries | Low |
| 8 | Allowlist push notification routes | Security fix | Very Low |
| 9 | Ticketmaster API caching | Events tab stops hitting rate limits | Low |
| 10 | SSE for chat messages | Chat feels real-time instead of laggy | Medium |
| 11 | Profile as real tab (4th tab) | Users can actually find their profile | Low |
| 12 | Content sanitization on posts/replies | Security + spam prevention | Low |
| 13 | Rate limit post/reply creation | Spam prevention | Very Low |
| 14 | Profile view deduplication | Accurate view counts | Low |
| 15 | Match → chat event context (from Events) | Miami differentiator activated | Medium |
