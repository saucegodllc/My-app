# ConnectSphere — Testing Strategy

**Stack:** React Native · Expo SDK 54 · Expo Router v6 · Express 5 (Render.com) · Drizzle ORM + PostgreSQL · Clerk auth · Stripe Hosted Checkout · RevenueCat  
**Last updated:** 2026-06-08

---

## Testing Pyramid

```
          /    E2E (Detox / Maestro)  \    3–5 critical flows — slow, high confidence
         /   Integration (supertest)   \   ~55 routes — medium speed, --runInBand
        /     Unit (Jest / RTL)         \  ~110 cases — fast, focused
```

Coverage targets:

| Layer       | Target | Rationale                                              |
|-------------|--------|--------------------------------------------------------|
| Unit        | 80%    | Pure functions are cheap to test and critical to trust |
| Integration | 90% route coverage | API routes; catches contract drift     |
| E2E         | Core 5 | Revenue paths + match flow; slow, run on CI nightly    |

---

## What We Have (as of 2026-06-08)

| File | Type | Cases | Status |
|------|------|-------|--------|
| `__tests__/inboxEndpoints.test.ts` | Unit (mock fetch) | 15 | ✅ Written |
| `__tests__/buildLocalConvs.test.ts` | Unit (pure fn) | 15 | ✅ Written |
| `src/inboxRoutes.test.ts` | Integration (supertest) | 40 | ✅ Written |
| `src/friendsMatchRouting.test.ts` | Integration (supertest) | 4 | ✅ Written |
| `__tests__/retentionFeatures.test.ts` | Unit | 8 | ✅ Written |
| `__tests__/workflowsAB.test.ts` | Unit | 10 | ✅ Written |

**Total: ~92 test cases across 6 files.**

---

## Priority Areas

Ranked by **launch risk** — if these break silently, revenue or user trust is directly harmed.

1. **Boost daily-limit enforcement** (free users, Plus users)
2. **Swipe counter** (decrement, lock, paywall trigger)
3. **Premium gating** (RevenueCat entitlement → feature unlock)
4. **Stripe webhook → entitlement chain**
5. **"It's a Match!" trigger + animation cleanup**
6. **Rewind** (premium-only, correct deck undo)
7. **Firestore security rules** (users can't write each other's boost)
8. **Clerk authentication** (sign up, sign in, session expiry)

---

## Unit Tests

**Tool:** Jest + `@testing-library/react-native`  
**Location:** `__tests__/unit/`

### 1. `canUseDailyBoost` — `lib/retentionFeatures.ts`

This is the gate that prevents free-riding on the boost. Every branch must be covered.

```ts
// __tests__/unit/retentionFeatures.test.ts
import { canUseDailyBoost } from "@/lib/retentionFeatures";

describe("canUseDailyBoost", () => {
  const TODAY = "2026-06-05";
  const YESTERDAY = "2026-06-04";

  it("returns false when user is not premium", () => {
    expect(canUseDailyBoost(false, null, TODAY)).toBe(false);
  });

  it("returns true when premium and never boosted", () => {
    expect(canUseDailyBoost(true, null, TODAY)).toBe(true);
  });

  it("returns true when premium and last boost was yesterday", () => {
    expect(canUseDailyBoost(true, YESTERDAY, TODAY)).toBe(true);
  });

  it("returns false when premium but already boosted today", () => {
    expect(canUseDailyBoost(true, TODAY, TODAY)).toBe(false);
  });
});
```

**Coverage target: 100%** — no branch left untested.

---

### 2. Swipe counter logic

The counter drives the paywall. Off-by-one errors here lose revenue.

```ts
// __tests__/unit/swipeCounter.test.ts

describe("swipesLeft derivation", () => {
  it("starts at FREE_DAILY_LIMIT for free users", () => { ... });
  it("shows Infinity / unlimited sentinel for premium", () => { ... });
  it("decrements by 1 on each swipe right or super", () => { ... });
  it("does not decrement on pass (left swipe)", () => { ... });
  it("clamps at 0, never goes negative", () => { ... });
  it("resets to limit at midnight (date boundary)", () => { ... });
});
```

---

### 3. Deck advancement & rewind

```ts
// __tests__/unit/deckLogic.test.ts

describe("advanceDeck", () => {
  it("increments cardIndex by 1", () => { ... });
  it("does not exceed unpassed.length", () => { ... });
});

describe("markPassed", () => {
  it("adds profileId to passedIds set", () => { ... });
  it("filters the profile out of unpassed immediately", () => { ... });
});

describe("handleRewind", () => {
  it("decrements cardIndex to previous", () => { ... });
  it("removes last passed id from passedIds", () => { ... });
  it("is a no-op when canRewind is false", () => { ... });
  it("is blocked for non-premium users", () => { ... });
});
```

---

### 4. Route helpers — `lib/routes.ts`

```ts
// __tests__/unit/routes.test.ts

describe("openChat", () => {
  it("pushes /chat/dating/[id] with serverMatchId when source is 'server'", () => { ... });
  it("uses chatId as fallback when serverMatchId is null", () => { ... });
});

describe("openConnectChat", () => {
  it("navigates to /connect/chat/[id]", () => { ... });
});
```

---

### 5. `ProfileBoostBanner` — isolated component test

```ts
// __tests__/unit/ProfileBoostBanner.test.tsx

describe("ProfileBoostBanner (inactive)", () => {
  it("renders 'Boost' label when no active boost", () => { ... });
  it("calls router.push to /premium when non-premium taps", () => { ... });
  it("shows alert 'Boost used today' when canUseDailyBoost returns false", () => { ... });
});

describe("ProfileBoostBanner (active)", () => {
  it("renders 'BOOSTED · MM:SS' countdown when boost is active", () => { ... });
  it("shows alert with remaining time on tap", () => { ... });
  it("clears expiresAt state when countdown reaches 0", () => { ... });
});
```

---

### 6. DatingMatchModal — animation state

These are smoke-level tests; the Reanimated worklets run headless in Jest via mocks.

```ts
// __tests__/unit/DatingMatchModal.test.tsx

describe("DatingMatchModal", () => {
  it("renders null when match prop is null", () => { ... });
  it("renders the match name in the subtitle", () => { ... });
  it("shows interest pills (up to 3)", () => { ... });
  it("calls onClose when backdrop is pressed", () => { ... });
  it("calls onClose when 'Keep Swiping' is pressed", () => { ... });
  it("calls openChat with wave=true when 'Say Hey!' is pressed", () => { ... });
  it("calls openConnectChat when 'View in Connect' is pressed", () => { ... });
});
```

Mock `react-native-reanimated` with the official Jest mock:
```js
// jest.setup.js
jest.mock("react-native-reanimated", () =>
  require("react-native-reanimated/mock")
);
```

---

## Integration Tests

**Tool:** Jest + `supertest` (API) · Firebase Emulator Suite (Firestore rules)  
**Location:** `__tests__/integration/`

---

### 7. Express API — Discovery feed endpoint

```ts
// __tests__/integration/api/discover.test.ts
// Run against local server with test Firebase project

describe("GET /api/discover", () => {
  it("returns 401 without Clerk session token", async () => { ... });
  it("returns 200 with valid token and profile array", async () => { ... });
  it("excludes profiles in the user's passedIds list", async () => { ... });
  it("returns boosted profiles 3× more frequently when boost is active", async () => { ... });
  it("respects intent param: dating vs friends filters", async () => { ... });
  it("applies rate limiting after 60 requests / minute", async () => { ... });
});
```

---

### 8. Express API — Boost endpoint

```ts
// __tests__/integration/api/boost.test.ts

describe("POST /api/boost/activate", () => {
  it("writes boostExpiresAt +30 min to Firestore for the authed user", async () => { ... });
  it("returns 403 when user is not premium", async () => { ... });
  it("returns 429 when boost already used today", async () => { ... });
  it("cannot activate boost for a different userId than the session owner", async () => { ... });
});
```

---

### 9. Stripe webhook chain

This is the revenue-critical path. Test with Stripe CLI event fixtures.

```ts
// __tests__/integration/webhooks/stripe.test.ts

describe("POST /webhooks/stripe", () => {
  it("returns 400 when webhook signature is invalid", async () => { ... });
  it("grants RevenueCat entitlement on checkout.session.completed", async () => { ... });
  it("revokes entitlement on customer.subscription.deleted", async () => { ... });
  it("is idempotent — duplicate events do not double-grant", async () => { ... });
});
```

```bash
# Replay fixtures locally:
stripe trigger checkout.session.completed
stripe trigger customer.subscription.deleted
```

---

### 10. Firestore security rules

Use the Firebase Emulator (`firebase emulators:start`) + `@firebase/rules-unit-testing`.

```ts
// __tests__/integration/firestore/rules.test.ts

describe("users/{userId} — boost fields", () => {
  it("allows the authenticated user to write their own boostExpiresAt", async () => { ... });
  it("denies a different user writing to someone else's boostExpiresAt", async () => { ... });
  it("denies unauthenticated writes", async () => { ... });
  it("denies client-side writes to boostActivatedAt (server-only field)", async () => { ... });
});

describe("users/{userId} — read access", () => {
  it("allows user to read their own document", async () => { ... });
  it("denies reading another user's full document", async () => { ... });
  it("allows discovery endpoint service account to read any profile", async () => { ... });
});
```

---

### 11. RevenueCat entitlement check

```ts
// __tests__/integration/revenueCat.test.ts

describe("subscription entitlement", () => {
  it("isPremium is true when ConnectSphere_Plus entitlement is active", async () => { ... });
  it("isPremium is false when entitlement is expired", async () => { ... });
  it("boost and rewind are blocked when isPremium is false", async () => { ... });
  it("swipe limit is Infinity when isPremium is true", async () => { ... });
});
```

---

## E2E Tests

**Tool:** Maestro (recommended — YAML-based, no Xcode/Android Studio setup required) or Detox  
**Location:** `e2e/`  
**Run:** Nightly on CI against a staging build, not production

---

### E2E-1: New user onboarding → first swipe

```yaml
# e2e/onboarding.yaml
- launchApp
- tapOn: "Sign Up"
- inputText:
    id: emailInput
    text: "test+e2e@connectsphere.app"
- tapOn: "Continue"
# ... complete Clerk OTP verification
- assertVisible: "Discover"          # lands on Discover tab
- assertVisible: "Boost"             # boost pill visible
- swipeRight: { element: "CardStack" }
```

---

### E2E-2: Match reveal + Say Hey!

```yaml
# e2e/match.yaml
# Pre-seed a mutual like so the match modal fires on next swipe
- launchApp
- swipeRight: { element: "CardStack" }
- assertVisible: "It's a Match!"
- assertVisible: "💗"                # heart badge rendered
- tapOn: "Say Hey!"
- assertVisible: "ChatInput"         # lands in chat
```

---

### E2E-3: Free user hits swipe limit → paywall

```yaml
# e2e/swipeLimit.yaml
# Start with swipesLeft = 0 in test state
- launchApp
- swipeRight: { element: "CardStack" }
- assertVisible: "Out of swipes"
- tapOn: "Out of swipes"
- assertVisible: "ConnectSphere Plus" # paywall modal
```

---

### E2E-4: Plus purchase flow

```yaml
# e2e/purchase.yaml
# Use Stripe test card in Hosted Checkout
- launchApp
- tapOn: "Boost"           # redirects non-premium to /premium
- assertVisible: "ConnectSphere Plus"
- tapOn: "Get Plus"        # opens Stripe Hosted Checkout
- inputText: { id: "cardNumber", text: "4242 4242 4242 4242" }
- tapOn: "Subscribe"
- assertVisible: "Boost"   # boost banner now active post-purchase
- assertNotVisible: "Out of swipes"
```

---

### E2E-5: Boost activation and countdown

```yaml
# e2e/boost.yaml
# User is already premium
- launchApp
- tapOn: "Boost"
- assertVisible: "BOOSTED ·"      # active pill visible
- wait: 60000                      # 1 min
- assertVisible: "BOOSTED ·"      # still counting
# Attempt second tap same day
- tapOn: "BOOSTED ·"
- assertVisible: "Boost Active"   # alert not "Boost used today"
```

---

## Gap Analysis — Current Coverage

| Area                              | Current state          | Risk    | Action                           |
|-----------------------------------|------------------------|---------|----------------------------------|
| **Inbox v2 — all 12 routes**      | ✅ 40 supertest cases  | —       | Done                             |
| **`buildLocalConvs` race window** | ✅ 15 unit cases       | —       | Done                             |
| **Inbox client API (connectApi)** | ✅ 15 unit cases       | —       | Done                             |
| Cron auth guard (`x-cron-secret`) | ❌ No tests            | 🔴 High | Unit test 401 on missing/wrong secret |
| Dating swipe routes               | ❌ No tests            | 🔴 High | `src/datingRoutes.test.ts` — like/pass/shot/rewind |
| Stripe webhook signature          | ❌ No tests            | 🔴 High | Integration test with stripe fixtures |
| `canUseDailyBoost`                | ❌ No tests            | 🔴 High | Unit test all branches           |
| Swipe counter decrement           | ❌ No tests            | 🔴 High | Unit test all branches           |
| User onboarding DOB (age gate)    | ❌ No tests            | 🟠 Med  | `POST /api/users` — under-18 → 400 |
| `openChat` routing branches       | ❌ No tests            | 🟠 Med  | Unit: `isLocal` true/false paths |
| DatingMatchModal render           | ❌ No tests            | 🟠 Med  | Unit smoke + Reanimated mock     |
| RevenueCat entitlement gating     | ❌ No tests            | 🟠 Med  | Mock RC SDK, assert feature gates |
| Rewind deck state                 | ❌ No tests            | 🟠 Med  | Unit test                        |
| E2E match reveal                  | ❌ No tests            | 🟡 Low  | Maestro scenario on CI           |
| Animation frame rate (match modal)| ⚠️ Manual QA only     | 🟡 Low  | Perfetto trace on Pixel 6        |

---

## CI Configuration

```yaml
# .github/workflows/test.yml (or EAS CI equivalent)

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - run: pnpm test --coverage --passWithNoTests

  integration:
    runs-on: ubuntu-latest
    services:
      firebase-emulator:
        image: firebase-tools-docker
    steps:
      - run: firebase emulators:exec "pnpm test:integration"

  e2e:
    runs-on: macos-latest    # iOS requires macOS
    if: github.event_name == 'schedule'   # nightly only
    steps:
      - run: eas build --platform ios --profile preview
      - run: maestro test e2e/
```

---

## Tooling Recommendations

| Need                        | Recommended tool                     | Notes                                         |
|-----------------------------|--------------------------------------|-----------------------------------------------|
| Unit + component tests      | Jest + `@testing-library/react-native` | Already the Expo default                     |
| Reanimated mocking          | `react-native-reanimated/mock`       | Official Jest mock — add to `jest.setup.js`   |
| API integration             | Jest + supertest                     | Test Express routes without a live server     |
| Firestore security rules    | `@firebase/rules-unit-testing` v4    | Works with Firebase Emulator                  |
| Stripe webhook testing      | `stripe` CLI + event fixtures        | `stripe trigger <event>`                      |
| E2E                         | Maestro                              | No Xcode/AS setup; YAML flows easy to write   |
| Code coverage               | Jest `--coverage` + Codecov          | Block PRs below 80% unit coverage             |
| Android perf tracing        | Perfetto / Android GPU Inspector     | Validate Reanimated worklet frame budget      |

---

## Quick Start — First 3 Tests to Write

Getting these three done blocks the highest launch risks:

1. `__tests__/unit/retentionFeatures.test.ts` — `canUseDailyBoost` all branches  
2. `__tests__/integration/webhooks/stripe.test.ts` — checkout.session.completed grants entitlement  
3. `__tests__/integration/firestore/rules.test.ts` — user can't write another user's boost fields  
