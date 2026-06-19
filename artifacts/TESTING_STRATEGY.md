# ConnectSphere — Testing Strategy

**Stack:** React Native (Expo SDK 54, Expo Router v6) · Express 5 API (Render.com) · Clerk auth · Stripe Hosted Checkout · RevenueCat · Ticketmaster API · Firebase Firestore

---

## Testing Pyramid

```
           /   E2E (Detox)   \          ~5% — critical user journeys only
          /  Integration Tests \        ~25% — API routes, service layer
         /    Unit Tests        \       ~70% — components, utils, adapters
```

---

## What We Already Have

| File | Tests | Status |
|------|-------|--------|
| `__tests__/ExpandedProfileCard.test.tsx` | 35 tests | ✅ Passing |

Everything else below is **what to add next**, prioritised by risk.

---

## 1. Unit Tests (Jest + @testing-library/react-native)

### 1a. Component Tests — HIGH PRIORITY

#### `ExpandedProfileCard` ✅ Already done (35 tests)

#### `BigActionsBar` — add standalone tests
- Renders correct actions for `dating` intent (pass, vibe, shot, spark)
- Renders correct actions for `friends` intent (pass, best_friend, create_plan, create_group)
- No shot button for friends mode
- `onAction` fires with correct action string on each button press
- Scale animation doesn't break `onPress` (jest-native `fireEvent.press`)

#### Chat / Conversation Inbox
```tsx
// Example
it('shows unread badge when hasMessages=true and no lastMessageSenderId matches self', ...)
it('orders conversations by lastMessageAt descending', ...)
it('renders "Say hi first 👋" placeholder when hasMessages=false', ...)
it('renders last message preview text', ...)
```

#### Events Tab
```tsx
it('shows "Loading live events..." when isServerLoading=true', ...)
it('shows fallback mock events when usingLocalEvents=true', ...)
it('renders "X Ticketmaster events" badge when tmCount > 0', ...)
it('renders "who\'s going" friends avatars for an event with friendInterestedUsers', ...)
it('toggleEventInterest fires POST with correct sourceId and status', ...)
```

#### Discover / Swipe Deck
```tsx
it('advances deck after vibe action', ...)
it('marks profile as passed after pass action', ...)
it('opens ShotSheet when onShot fires', ...)
it('shows ExpandedProfileCard when profile is selected', ...)
it('hides ExpandedProfileCard after close', ...)
```

#### toCardProfile adapter (DatingProfileSnapshot → CardProfile)
✅ Already covered in ExpandedProfileCard.test.tsx (9 adapter tests)

---

### 1b. Utility / Service Tests

#### `eventsApi.ts`
```ts
it('getEventContexts returns empty when sourceIds is empty array', ...)
it('getEventContexts deduplicates sourceIds before fetch', ...)
it('toggleEventInterest sends status="interested" by default', ...)
it('FALLBACK_EVENTS has 8 entries, all with valid ISO dates', ...)
it('FALLBACK_EVENTS sourceType is always "mock"', ...)
```

#### `friendsApi.ts` (wherever connection/plan helpers live)
```ts
it('getConnections returns friends sorted by recent activity', ...)
it('toggleConnection resolves with updated status', ...)
```

#### Date/time helpers
```ts
it('formatEventDate renders "Tonight" for same-day events', ...)
it('formatEventDate renders "Sat, Jun 7" for future events', ...)
```

---

## 2. API Integration Tests (Jest + Supertest)

These run against the Express 5 server with the file-backed `db.json` seeded from test fixtures. No real Ticketmaster, Clerk, or Stripe calls.

### Setup
```ts
// jest.config.api.ts — separate config targeting src/routes/**/*.test.ts
// beforeAll: load test db.json fixture
// afterAll: restore original db.json
```

### Events Routes — CRITICAL (most fragile external dep)

```ts
// GET /api/events
it('returns mock events when EVENTS_USE_MOCKS=true and no TM key', ...)
it('returns loading:true when refresh is in flight', ...)
it('returns loading:false once events are cached', ...)
it('includes tmCount, marlinsCount in response', ...)

// GET /api/events/context/:userId
it('returns friendInterestedUsers for an event with known interests', ...)
it('returns myPlan when user has a plan tied to that sourceId', ...)
it('returns joinablePlans for plans user is not already in', ...)
it('returns empty arrays for unknown sourceId', ...)

// POST /api/events/interest/toggle
it('creates new interest record when none exists', ...)
it('removes interest record when toggled off', ...)
it('rejects request missing userId or sourceId', ...)
```

### Match/Chat Routes — CRITICAL (core "Golden Rule" flow)

```ts
// GET /api/conversations/:userId
it('returns conversations sorted by lastMessageAt desc', ...)
it('includes peer profile (name, photoUrl, age)', ...)
it('returns empty array when user has no conversations', ...)

// GET /api/conversations/:conversationId/messages
it('returns messages in chronological order', ...)
it('returns empty array for new match with no messages', ...)

// POST /api/conversations/:conversationId/messages
it('saves message and updates conversation.lastMessageAt', ...)
it('updates lastMessageText on the conversation record', ...)
it('rejects empty text body', ...)
```

### Shots / Reactions Routes

```ts
// GET /api/shots/:userId
it('returns pending csReactions for the user', ...)
it('returns pending csRequests for the user', ...)
it('does not return dismissed/accepted items', ...)

// POST /api/shots/react
it('creates a csReaction with correct type and status', ...)
```

### Plans Routes

```ts
// POST /api/plans
it('creates plan with chatId and host planMember record', ...)
it('rejects plan without title or creatorId', ...)

// POST /api/plans/:planId/join
it('creates planJoinRequest with status=pending', ...)
it('prevents duplicate join requests from same user', ...)

// PATCH /api/plans/:planId/join/:requestId
it('approves join request and adds planMember record', ...)
it('rejects join request and removes record', ...)
```

### Auth Middleware

```ts
it('rejects requests without a valid Clerk session token (401)', ...)
it('passes requests with valid Bearer token', ...)
it('attaches userId to req.auth on valid token', ...)
```

---

## 3. Ticketmaster Reliability Tests

```ts
// scheduleFailRetry
it('schedules retry 15 min after TM returns 0 events', ...)
it('does not schedule duplicate retries', ...)
it('clears retry timer when a successful refresh runs', ...)

// Mock fallback guard
it('serves FALLBACK_EVENTS when TM key is missing', ...)
it('serves FALLBACK_EVENTS when TM returns HTTP 429', ...)
it('serves FALLBACK_EVENTS when TM returns empty _embedded', ...)
it('merges TM events on top of mocks when both are available', ...)
```

---

## 4. E2E Tests (Detox — add these before App Store submission)

Run on iOS Simulator / Android Emulator against the local API with `EVENTS_USE_MOCKS=true`.

### Critical Paths (must pass before every release)

| Journey | Steps |
|---------|-------|
| **Match → Chat** | Swipe vibe → match modal appears → tap "Message" → chat opens → send message → message appears in thread |
| **Events → Interest** | Open events tab → see mock events → tap "Interested" → friend count increments |
| **Events → Plan** | Tap event → tap "Make a plan" → plan created → plan chat opens |
| **Friends → Connect** | Swipe Besties on friend → connection request sent → appears in requests inbox |
| **Shots inbox** | Receive shot → tap "Accept" → conversation appears in Chats |
| **Double Date** | Create pair → match with another pair → double date chat opens |

### Auth Smoke Tests

| Test | Expected |
|------|----------|
| Fresh install → onboarding → sign up | Profile creation completes |
| Sign out → sign back in | All conversations restored |
| Expired session | App prompts re-auth, no crash |

---

## 5. Coverage Targets

| Layer | Target | Current Estimate |
|-------|--------|-----------------|
| Component unit tests | 80% | ~40% (ExpandedProfileCard done, rest missing) |
| API route integration | 75% | ~0% |
| Utility functions | 90% | ~20% |
| E2E critical paths | 6 journeys | 0 journeys |

---

## 6. What to Fix First (Priority Order)

**P0 — Before any public beta:**
1. API integration tests for `/api/conversations` (the "Golden Rule" chat inbox)
2. API integration tests for `/api/events/context` (who's going on events)
3. Ticketmaster reliability unit tests (scheduleFailRetry, mock fallback guard)

**P1 — Before App Store submission:**
4. E2E: Match → Chat journey (most common user path)
5. E2E: Events → Interest → Plan
6. Component tests for Events tab (isServerLoading states)

**P2 — Nice to have:**
7. Visual regression snapshots for ExpandedProfileCard
8. Accessibility audit (color contrast on dark glassmorphism cards)
9. Load test: 100 concurrent `/api/events` requests on Render free tier

---

## 7. Running Tests

```bash
# Unit + component tests (mobile)
cd artifacts/connectsphere-mobile
npx jest

# Run one specific test file
npx jest __tests__/ExpandedProfileCard.test.tsx --verbose

# API integration tests (when added)
cd artifacts/api-server
pnpm test

# E2E (Detox — when configured)
npx detox test -c ios.sim.debug
```

---

## 8. What's Solid Right Now ✅

- `ExpandedProfileCard` — 35 tests, all interactive elements have testIDs
- `toCardProfile` adapter — 9 edge case tests
- Ticketmaster mock fallback — always-on via `EVENTS_USE_MOCKS=true`
- 15-min retry-on-failure — logic written, needs unit test coverage
- db.json mock dataset — 16 users, 8 match conversations with full threads, 23 event interests, 5 dating matches

## 9. What Needs the Most Attention ⚠️

- Chat inbox route has **zero** API tests — critical because it's the core product promise
- Event context route (`/api/events/context`) drives "who's going" — untested
- No E2E tests at all — can't verify full journeys before shipping
- `datingMatches` and `csMessages` collections are new — need route-level tests to confirm they serialize correctly
