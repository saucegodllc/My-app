# ConnectSphere — Security Routing Flows
**For review by cybersecurity engineer**
*Generated from source: `artifacts/connectsphere-mobile` + `artifacts/api-server`*

---

## 1. Auth Architecture (All Tabs)

### Client → Server Auth Pattern
Every API call from the mobile app goes through one of two paths:

**Path A — `customFetch` (all standard API calls)**
```
Mobile client
  → customFetch() [lib/api-client-react/custom-fetch.ts]
    → Reads _authTokenGetter (set once in _layout.tsx via setAuthTokenGetter)
    → Calls Clerk getToken() → short-lived JWT
    → Attaches: Authorization: Bearer <clerk_jwt>
  → API server [Render]
    → requireAuth middleware (Clerk SDK verifies JWT)
    → req.auth.userId extracted from verified token
    → Handler runs with verified userId
```

**Path B — `aiChat.ts` (Spark / Vibe AI only)**
```
Mobile client
  → sendAiChatMessageStreaming() / sendAiChatMessage() [lib/aiChat.ts]
    → Reads _tokenGetter (set separately via setAiChatTokenGetter in _layout.tsx)
    → Calls Clerk getToken() → short-lived JWT
    → Attaches: Authorization: Bearer <clerk_jwt>
  → POST /api/ai-chat OR POST /api/ai-chat/stream
    → requireAuth middleware (same Clerk verification)
```

### Auth Guards (Client-side routing)
| Guard | File | Behavior |
|---|---|---|
| Not signed in | `app/(tabs)/_layout.tsx` | `Redirect → /(auth)/welcome` |
| Signed in, no onboarding | `app/(tabs)/_layout.tsx` | `Redirect → /onboarding` |
| e2e smoke mode | `app/(tabs)/_layout.tsx` | Bypasses auth guards entirely (test flag) |

### External Auth Services
- **Clerk** — identity provider, JWT issuer, user metadata store
- `user.unsafeMetadata.onboardingComplete` — client-readable field controls onboarding gate
- `user.imageUrl` — Clerk CDN, displayed as profile photo throughout app

---

## 2. Tab: Discover (`/(tabs)/index`)

### Entry Point
Tab tap or `router.push("/(tabs)")` → renders `DiscoverScreen`

### What It Loads on Mount
| Data | Endpoint | Auth |
|---|---|---|
| Discovery feed (dating) | `GET /api/discovery?mode=dating` | Bearer JWT |
| Discovery feed (friends) | `GET /api/friends/people/:userId` | Bearer JWT |
| My profile | `GET /api/profiles/me` | Bearer JWT |
| Swipe streak | `AsyncStorage @swipeStreak:*` | Local only |
| Swipe count remaining | `AsyncStorage @swipeCounter:*` | Local only |

### User Actions → Routes / API Calls
| Action | Route or Endpoint | Auth | Notes |
|---|---|---|---|
| Swipe right (like) | `POST /api/discovery/action` body: `{action:"like", targetId}` | Bearer JWT | Decrements local swipe counter |
| Swipe left (pass) | `POST /api/discovery/action` body: `{action:"pass", targetId}` | Bearer JWT | |
| Match fires | `GET /api/chats/:chatId` then `openChat(chatId)` | Bearer JWT | |
| Send Shot | `POST /api/dating/shots/send` | Bearer JWT | body: `{toUserId, message, opener}` |
| Rewind last swipe | `POST /api/discovery/undo` | Bearer JWT | Premium gated |
| Swipe limit hit | `router.push({pathname:"/premium", params:{feature:"swipes"}})` | — | Free users: 20 swipes/day |
| Boost profile | `router.push({pathname:"/premium", params:{feature:"boost"}})` | — | |
| Rewind button | `router.push({pathname:"/premium", params:{feature:"rewind"}})` | — | |
| Double Date tab | `GET /api/dating/double-date/pair/:userId` | Bearer JWT | |
| Double Date swipe | `POST /api/dating/double-date/swipe` | Bearer JWT | body: `{pairId, targetPairId, action}` |
| Empty deck — go to Spaces | `router.push("/(tabs)/communities")` | — | |
| Empty deck — go to Events | `router.push("/(tabs)/events")` | — | |
| Empty deck — edit profile | `router.push("/(tabs)/profile")` | — | |

### Security Notes for Reviewer
- `targetId` in swipe actions: verify server enforces that userId ≠ targetId (no self-like)
- Swipe counter is **client-side only** (AsyncStorage). Free limit is soft — not enforced server-side until premium paywall check
- `user.unsafeMetadata` is readable by the client — onboarding gate can be bypassed by a client-side edit

---

## 3. Tab: Connect (`/(tabs)/matches`)

### Entry Point
Tab tap → renders `MatchesScreen`. Unread badge driven by `useUnreadCount` hook polling `/api/matches`.

### What It Loads on Mount
| Data | Endpoint | Auth |
|---|---|---|
| Server match threads | `GET /api/matches?page=1&limit=100` | Bearer JWT |
| Incoming shots (dating) | `GET /api/dating/shots/incoming/:userId` | Bearer JWT |
| Incoming reactions | `GET /api/dating/reactions/:userId` | Bearer JWT |
| Inbox requests (social) | `GET /api/inbox/requests/:userId` | Bearer JWT |
| Inbox reactions (social) | `GET /api/inbox/reactions/:userId` | Bearer JWT |
| Moment requests | Via `connectApi.ts` | Bearer JWT |

### User Actions → Routes / API Calls
| Action | Route or Endpoint | Auth | Notes |
|---|---|---|---|
| Open match chat (local ID) | `router.push({pathname:"/chat/dating/[id]", params:{id}})` | — | chatId starts with `"local:"` |
| Open match chat (server ID) | `openChat(chatId)` → `router.push("/chat/[matchId]")` | — | |
| Accept Shot | `POST /api/dating/shots/respond` body: `{shotId, action:"accept"}` | Bearer JWT | Returns chatId → openChat |
| Decline Shot | `POST /api/dating/shots/respond` body: `{shotId, action:"decline"}` | Bearer JWT | |
| Accept inbox request | `POST /api/inbox/requests/accept/:requestId` | Bearer JWT | Then navigateProfile after 800ms |
| Decline inbox request | `POST /api/inbox/requests/decline/:requestId` | Bearer JWT | |
| Like back a reaction | `POST /api/inbox/reactions/like-back/:reactionId` | Bearer JWT | |
| Ignore a reaction | `POST /api/inbox/reactions/ignore/:reactionId` | Bearer JWT | |
| Accept Moment request | `POST /api/moments/requests/:requestId/accept` | Bearer JWT | |
| Decline Moment request | `DELETE /api/moments/requests/:requestId` | Bearer JWT | |
| Open Spark AI | `router.push({pathname:"/chat/ai-bot", params:{mode:"dating"}})` | — | |
| Open Vibe AI (friends tab) | `router.push({pathname:"/chat/ai-bot", params:{mode:"friends"}})` | — | |
| Reveal who liked you (premium) | `openPremium("connect")` → `/premium` | — | Paywall gate |
| Empty state → Discover | `router.push("/(tabs)")` | — | |
| Empty state → Spaces | `router.push("/(tabs)/communities")` | — | |
| Empty state → Events | `router.push("/(tabs)/events")` | — | |
| Deep link open chat | `?openChatId=<id>` query param → `openChat(id)` on mount | — | |

### Security Notes for Reviewer
- `:userId` and `:requestId` in endpoints: verify server validates that the authenticated user owns or is party to the resource (IDOR risk)
- `?openChatId` query param is parsed unvalidated on mount and passed to `openChat()` — verify routing handler sanitizes this
- Shot/reaction accept flows return a `chatId` — server should verify no duplicate conversations are created

---

## 4. Tab: Events (`/(tabs)/events`)

### Entry Point
Tab tap → renders `EventsScreen` with Ticketmaster-sourced Miami events.

### What It Loads on Mount
| Data | Endpoint | Auth | Source |
|---|---|---|---|
| Events feed | `GET /api/events?city=Miami&...` | Bearer JWT | Server proxies Ticketmaster API |
| Event attendee context | `GET /api/events/context/:userId?sourceIds=<ids>` | Bearer JWT | ConnectSphere DB |

### User Actions → Routes / API Calls
| Action | Route or Endpoint | Auth | Notes |
|---|---|---|---|
| Tap event card | Opens `EventDetailSheet` (bottom modal, in-screen) | — | No route change |
| Toggle interest / RSVP | `POST /api/events/interest/toggle` body: `{sourceId, status}` | Bearer JWT | status: "interested" or "saved" |
| Message attendee | `openChat(chatId)` | — | If connected; else show connect prompt |
| View attendee profile | `openProfile(userId)` → `/user/[userId]` | — | |
| Locked RSVP (free user) | `openPremium(...)` → `/premium` | — | Premium gated |

### Security Notes for Reviewer
- Ticketmaster API key is server-side only — not exposed to client
- `sourceIds` in context endpoint is a comma-joined list of strings passed as query param — verify server sanitizes/limits length
- `status` field in toggle is untyped from client — server should validate enum

---

## 5. Tab: Spaces (`/(tabs)/communities`)

### Entry Point
Tab tap → `CommunitiesScreen` → list of communities

### Full Screen Stack from This Tab
```
/(tabs)/communities          (list)
  → communities/[id]         (detail — card presentation)
      → communities/create   (modal)
      → communities/thread/[postId]  (card)
```

### What It Loads on Mount
| Data | Endpoint | Auth |
|---|---|---|
| Community list | `GET /api/communities` | Bearer JWT |
| Community detail | `GET /api/communities/:slug` | Bearer JWT |
| Community feed | `GET /api/communities/:id/posts?sort=hot&cursor=` | Bearer JWT |
| Single post | `GET /api/communities/posts/:id` | Bearer JWT |
| Post replies | `GET /api/communities/posts/:id/replies` | Bearer JWT |

### User Actions → Routes / API Calls
| Action | Route or Endpoint | Auth | Notes |
|---|---|---|---|
| Tap community card | `router.push(\`/communities/${encodeURIComponent(slug)}\`)` | — | Uses slug in URL |
| Join community | `POST /api/communities/:id/membership` | Bearer JWT | |
| Leave community | `DELETE /api/communities/:id/membership` | Bearer JWT | |
| Create community | `router.push("/communities/create")` modal | — | |
| Submit new community | `POST /api/communities` body: `{name, description, ...}` | Bearer JWT | |
| Create post | `POST /api/communities/posts` | Bearer JWT | body: `{communityId, content, ...}` |
| Like post | `POST /api/communities/posts/:id/like` | Bearer JWT | |
| Unlike post | `DELETE /api/communities/posts/:id/like` | Bearer JWT | |
| Open thread | `router.push({pathname:"/communities/thread/[postId]", params:{postId}})` | — | |
| Create reply | `POST /api/communities/posts/:id/replies` | Bearer JWT | body: `{postId, content}` |
| Like reply | `POST /api/communities/replies/:id/like` | Bearer JWT | |
| Unlike reply | `DELETE /api/communities/replies/:id/like` | Bearer JWT | |

### Security Notes for Reviewer
- Community slugs are used in URL paths — verify `encodeURIComponent` is applied on client (it is, in `communitiesApi.ts`) and that server decodes/validates slugs before DB query
- Post content is user-generated text — server should sanitize for XSS / injection before storing
- Reply content same concern
- No visible rate limiting on post or reply creation — potential spam/flooding vector
- `DELETE` membership endpoint: verify server checks that the authenticated user is the membership owner

---

## 6. Tab: Profile (`/(tabs)/profile`)

### Entry Point
Floating pink avatar button in tab bar corner → `router.push("/(tabs)/profile")`
(Profile is **not** a registered tab — it's a hidden tab accessed via avatar button)

### What It Loads on Mount
| Data | Endpoint | Auth |
|---|---|---|
| My profile | `GET /api/profiles/me` | Bearer JWT |
| Profile views count | Embedded in profile response | Bearer JWT |
| Match connections | `ConnectionsContext` (pre-loaded) | Bearer JWT |

### User Actions → Routes / API Calls
| Action | Route or Endpoint | Auth | Notes |
|---|---|---|---|
| Edit settings | `router.push("/settings")` | — | |
| View profile views | `router.push("/profile-views")` | — | |
| View who liked you | `router.push("/likes-you")` | — | Premium gated |
| View a connection's profile | `router.push({pathname:"/user/[userId]", params:{userId}})` | — | |
| Referral program | `router.push("/referral")` | — | |
| Go to settings (edit button) | `router.push("/settings")` | — | |

### Settings Sub-Routes (from `/settings`)
| Screen | Route | Notes |
|---|---|---|
| Discovery filters | In-settings modal | `PATCH /api/profiles/me/preferences` |
| Blocked users | `/blocked-users` | `GET /api/reports/blocked` |
| Unblock user | — | `DELETE /api/reports/blocked/:blockedId` |
| Privacy policy | `/legal/privacy` | In-app WebView |
| Terms of service | `/legal/terms` | In-app WebView |
| Delete account | In-settings | Calls Clerk delete + server cleanup |
| Export data | In-settings | `GET /api/profiles/me/export` |

### Security Notes for Reviewer
- `userId` values in `/user/[userId]` routes: server must verify requesting user has permission to view (e.g. not blocked, not restricted)
- `/api/reports/blocked` — verify server returns only the authenticated user's own block list
- `DELETE /api/reports/blocked/:blockedId` — verify server checks that authenticated user owns the block entry (IDOR)
- Data export endpoint should be rate-limited and scoped to authenticated user only
- Account deletion must cascade: Clerk identity + all DB records (messages, matches, profile, spark_memory, etc.)

---

## 7. Stack Screens (Accessible from All Tabs)

### AI Chat (`/chat/ai-bot`)
```
Entry: router.push({pathname:"/chat/ai-bot", params:{mode:"dating"|"friends"}})

On send message:
  → POST /api/ai-chat/stream (SSE)  OR  POST /api/ai-chat
  → Authorization: Bearer <clerk_jwt>  (via aiChat.ts token getter)
  → Server: requireAuth → Anthropic Claude API (server-side key)
  → Rate limit: 5 msg/hr (free), unlimited (premium) — in-process Map, resets on server restart
  → HTTP 402 if over limit → client shows paywall banner → /premium

Memory:
  → After 10+ messages: server calls Haiku, inserts to spark_memory table
  → On each request: server reads last 3 spark_memory rows, injects into system prompt
```

**Security Notes:**
- `ANTHROPIC_API_KEY` is server-side only — correct
- Rate limiting is in-process (not Redis) — resets on Render restart, soft limit only
- System prompt includes user profile data fetched from DB — verify no PII leakage through the AI response
- SSE stream: `res.flushHeaders()` is called after paywall check — HTTP 402 can still be returned before response is committed

### Premium Paywall (`/premium`)
```
Entry: openPremium() from any screen OR HTTP 402 from AI chat

Plans:
  monthly  → price_1TkBuZCnolnhP5uucFOtK1Cl ($14.99/2wk)
  sixmonth → price_1TkCMsCnolnhP5uuYmFBKUbn ($150/6mo)
  yearly   → price_1TkCMwCnolnhP5uu2yybQk1h ($300/yr)

Flow:
  → handleCheckout(plan)
  → RevenueCat (if available) OR
  → POST /api/stripe/checkout body: {plan, userId}
  → Server creates Stripe Checkout session
  → Client opens Stripe web checkout URL
  → Stripe webhook: POST /api/stripe/webhook
    → checkout.session.completed → setDbPremium()
    → invoice.payment_succeeded → setDbPremium()
```

**Security Notes:**
- Stripe secret key is server-side only — correct
- Stripe webhook must validate `stripe-signature` header — verify this is implemented
- `setDbPremium()` writes `isPremium: true` to DB — verify this endpoint is not callable directly by clients
- `isPremium` check in AI rate limiting uses DB value, not client claim — correct

### Chat Screens
| Route | Entry | API | Auth |
|---|---|---|---|
| `/chat/[matchId]` | `openChat(chatId)` | `GET /api/chats/:chatId`, `GET /api/inbox/messages/:convId`, `POST /api/messages/send` | Bearer JWT |
| `/chat/dating/[id]` | `router.push` with local: ID | Local AsyncStorage messages | None (local) |
| `/chat/ai-bot` | From Connect tab | `POST /api/ai-chat/stream` | Bearer JWT |

**Security Note on local dating chat:** Messages in `/chat/dating/[id]` are stored in AsyncStorage only — no server backup. No auth required to read them on the device.

---

## 8. Deep Links & Push Notification Routing

### Deep Links
| URL Pattern | Handler | Notes |
|---|---|---|
| `connectsphere.app/u/:username` | `app/u/[username].tsx` | Public profile — verify auth not required but data is appropriately scoped |
| `connectsphere.app/invite/:code` | `app/invite/[code].tsx` | Redeem referral — verify code is single-use and validated server-side |

### Push Notification → Route Map (`PushTokenRegistrar.tsx`)
| Notification type | Data shape | Routed to |
|---|---|---|
| `message`, `friend_accept`, `plan_invite`, `plan_join`, `double_date_match` | `{chatId, matchId, url, type}` | `openChat(chatId)` |
| Anti-ghost nudge | `{route: "/chat/dating/<id>"}` | `router.push("/chat/dating/[id]")` |
| Daily spark | `{route: "/(tabs)/index" or "/(tabs)/matches"}` | `router.push(route)` |

**Security Notes:**
- Push notification `data.route` value is used directly in `router.push()` — verify this is validated/allowlisted before use to prevent open redirect via crafted push payload
- Push tokens are registered with Expo / Firebase — verify token is associated to authenticated userId server-side

---

## 9. Summary: API Endpoint Inventory

### Endpoints Requiring `requireAuth` (Clerk JWT)
```
GET    /api/discovery
GET    /api/friends/people/:userId
GET    /api/profiles/me
PATCH  /api/profiles/me/preferences
GET    /api/matches
POST   /api/discovery/action
POST   /api/discovery/undo
POST   /api/dating/shots/send
GET    /api/dating/shots/incoming/:userId
GET    /api/dating/shots/sent/:userId
POST   /api/dating/shots/respond
GET    /api/dating/reactions/:userId
POST   /api/dating/reactions/respond
GET    /api/dating/double-date/pair/:userId
POST   /api/dating/double-date/pair/create
POST   /api/dating/double-date/pair/pause
GET    /api/dating/double-date/feed/:pairId
POST   /api/dating/double-date/swipe
POST   /api/dating/double-date/shot
DELETE /api/dating/double-date/undo
GET    /api/inbox/primary/:userId
GET    /api/inbox/requests/:userId
POST   /api/inbox/requests/send
POST   /api/inbox/requests/accept/:requestId
POST   /api/inbox/requests/decline/:requestId
GET    /api/inbox/reactions/:userId
POST   /api/inbox/reactions/send
POST   /api/inbox/reactions/like-back/:reactionId
POST   /api/inbox/reactions/ignore/:reactionId
POST   /api/inbox/reactions/withdraw
GET    /api/inbox/messages/:conversationId
POST   /api/inbox/messages/send
POST   /api/messages/send
GET    /api/chats/:chatId
GET    /api/connect/:userId
GET    /api/communities
GET    /api/communities/:slug
POST   /api/communities
POST   /api/communities/:id/membership
DELETE /api/communities/:id/membership
GET    /api/communities/:id/posts
POST   /api/communities/posts
GET    /api/communities/posts/:id
POST   /api/communities/posts/:id/like
DELETE /api/communities/posts/:id/like
GET    /api/communities/posts/:id/replies
POST   /api/communities/posts/:id/replies
POST   /api/communities/replies/:id/like
DELETE /api/communities/replies/:id/like
GET    /api/events
GET    /api/events/context/:userId
POST   /api/events/interest/toggle
GET    /api/reports/blocked
DELETE /api/reports/blocked/:blockedId
POST   /api/moments
POST   /api/moments/:id/like
POST   /api/moments/:id/reply
GET    /api/moments/feed
DELETE /api/moments/requests/:requestId
POST   /api/moments/requests/:requestId/accept
POST   /api/ai-chat
POST   /api/ai-chat/stream
POST   /api/stripe/checkout
GET    /api/stripe/portal
```

### Endpoints NOT Requiring User Auth
```
POST   /api/stripe/webhook     (Stripe signature validation instead)
GET    /api/health             (server health check)
```

---

## 10. Key Security Areas to Review

| Area | Priority | Detail |
|---|---|---|
| IDOR on `:userId` params | High | Multiple endpoints accept userId as URL param — verify server always uses `req.auth.userId`, not the URL param, as the authoritative identity |
| Push notification routing | High | `data.route` passed to `router.push()` — needs allowlist validation |
| Stripe webhook signature | High | Must verify `stripe-signature` header on `/api/stripe/webhook` |
| User-generated content (posts, replies, messages) | Medium | Sanitize for XSS/injection before DB storage |
| `user.unsafeMetadata` onboarding gate | Medium | Client-readable — onboarding bypass possible from compromised client |
| Soft rate limiting (AI chat) | Medium | In-process Map resets on server restart — Redis recommended for production |
| Local dating chat (AsyncStorage) | Low | No encryption at rest on device — sensitive if device is compromised |
| Invite code single-use validation | Medium | Verify `/api/invite/:code` marks code as used server-side |
| `sourceIds` query param (events) | Low | Comma-joined list — verify server limits length and sanitizes |
| e2e smoke mode bypass | Low | `e2eSmokeEnabled` flag bypasses all auth guards — ensure not shippable in production build |
