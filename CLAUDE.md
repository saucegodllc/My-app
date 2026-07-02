# CLAUDE.md — ConnectSphere Session Notes

> Before making changes, read `AGENTS.md` and
> `docs/agent-handoffs/CURRENT.md`. Shared project state and branch ownership
> live there. This file contains Claude-specific implementation history only.

Project overview and conventions are in `replit.md`. This file tracks non-obvious decisions, gotchas, and recent changes so future sessions (and future Claude contexts) don't repeat the same mistakes.

---

## Shoot Your Shot — suggestion buttons + celebration (2026-06)

### Bug fixed: dead suggestion buttons in ExpandedProfileCard

**Root cause:** `openShotSheet` in `app/(tabs)/index.tsx` had a guard:
```ts
if (activeIntent !== "dating") return;
```
`activeIntent` is the screen-level Dating/Friends toggle — which can be "friends" even when viewing a dating-intent expanded profile. This silently blocked all suggestion row taps.

**Fix:** Changed the guard to check the **target profile's intent** instead:
```ts
if ((target.intent ?? "dating") !== "dating") return;
```
This means: only block shots if you're trying to shoot at a friends-intent profile. Dating profiles always open the sheet.

**Files changed:**
- `artifacts/connectsphere-mobile/app/(tabs)/index.tsx` — `openShotSheet` guard fix; removed `activeIntent` from its `useCallback` dependency array

### Shot Sent! celebration upgrade

**Before:** `ShotToast` showed "Shot's live 🔥" with a paper-plane icon.
**After:** Shows "Shot Sent! 🏀" with basketball emoji, hot-pink emphasis line "Damn, you just shot your shot.", and updated sub copy.

**Files changed:**
- `artifacts/connectsphere-mobile/components/ShotBottomSheet.tsx` — `ShotToast` title, emphasis line, sub copy, icon, and `shotSentEmphasis` style added

### Flow (complete, verified)

```
Tap suggestion row in ExpandedProfileCard
  → onShotIdea(idea) → onShot(idea)
  → openShotSheet(selectedProfile, idea)  ← now unblocked
  → ShotBottomSheet opens with ghost pre-fill from suggestion
  → User edits / accepts → Send Shot
  → sendShotToProfile() succeeds
  → setShotToastVisible(true)
  → ShotToast: "Shot Sent! 🏀 / Damn, you just shot your shot."
  → Auto-dismisses after 3.6s, advances deck
```

---

## Spark / Vibe AI Companions — major upgrade (2026-06)

All changes live in **`artifacts/api-server/src/routes/aiChat.ts`** and the new DB schema file below. The routes are:

- `POST /api/ai-chat` — full JSON response `{ reply: string }`
- `POST /api/ai-chat/stream` — SSE stream, events `{ delta }` → `{ done: true }`

### What changed

| Area | Before | After |
|---|---|---|
| Model | `claude-haiku-*` | `claude-sonnet-4-6` (main), `claude-haiku-4-5-20251001` (fast pre-pass) |
| Rate limit | 20 msg/hr, all users | 5 msg/hr free; unlimited for `isPremium === true` |
| User context | None | Profile fetched from DB, injected into system prompt |
| Mood detection | None | Haiku pre-pass classifies last 2 user messages |
| Session memory | None | DB-backed summaries in `spark_memory` table |
| Paywall nudge | None | Msg 5 → soft nudge in reply; msg 6+ → HTTP 402 |

### Architecture of each request

```
1. Check ANTHROPIC_API_KEY → 503 if missing
2. userId from req.auth (Clerk)
3. Parse + validate body
4. sanitizeMessages() → last 20, capped at 2000 chars each; 400 if empty or first msg not from user
5. Promise.all([fetchProfile(userId), detectMood(sanitized, apiKey)])   ← parallel, ~200ms saved
6. buildContextBlock(profile)   ← plain text USER PROFILE block
7. isPremium = profile?.isPremium === true
8. Paywall check (free users only):
     isOverLimit  → return 402 { error: "free_limit_reached", paywallPrompt: true }
     isLastFree   → set paywallNudge = true (soft mention in reply)
9. await getMemoryBlock(userId)   ← top 3 DB summaries, oldest-first
10. buildSystemPrompt(mode, userContext, memory, mood, paywallNudge)
11. Anthropic fetch (MODEL / stream mode)
12. maybeSummarizeAndStore() — fire-and-forget after response
13. Return reply / stream
```

**Critical for the stream route:** SSE headers are flushed **after** the paywall check, so HTTP 402 can still be returned before the response is committed. Do not move `res.flushHeaders()` above the paywall block.

### Free-user rate limiting

In-process `Map<userId, { count, resetAt }>`. Resets per 1-hour window. This is intentionally in-process (not Redis) — it's a soft limit, not a hard billing gate. On server restart it resets, which is acceptable for free-tier abuse prevention.

### DB-backed memory (`sparkMemoryTable`)

- **Schema:** `lib/db/src/schema/sparkMemory.ts` — `id`, `userId`, `summary`, `createdAt`
- **Export:** already added to `lib/db/src/schema/index.ts`
- **Write:** `maybeSummarizeAndStore()` — fires when conversation reaches 10+ messages, uses Haiku to produce a 1-sentence summary, inserts it, then prunes to keep only the 5 most recent rows per user
- **Read:** `getMemoryBlock()` — fetches last 3 summaries (reversed to chronological), formats as bullet list injected into system prompt

### Paywall flow (mobile client must handle)

- **Message 5 (isLastFree):** Spark naturally mentions Plus at end of its reply. The system prompt injects `[GO:premium:Unlock Plus ⚡]` which the client renders as a tappable chip.
- **Message 6+ (isOverLimit):** API returns `HTTP 402` with body:
  ```json
  { "error": "free_limit_reached", "paywallPrompt": true, "message": "..." }
  ```
  `ai-bot.tsx` catches HTTP 402, sets `paywallHit` state, replaces input bar with upsell banner → `/premium`. ✅ implemented.

### DB migration — MUST run before deploying

The `spark_memory` table doesn't exist in production yet. Run this from the **Render Shell** (dashboard.render.com → API server service → Shell tab):

```bash
pnpm --filter @workspace/db push
```

`DATABASE_URL` is already set in Render's environment. Do not try to run this locally without it.

---

## Drizzle ORM — correct query pattern

Always use the select builder, never `db.query.*`:

```ts
// ✅ correct
const rows = await db.select().from(profilesTable)
  .where(eq(profilesTable.userId, userId)).limit(1);
const profile = rows[0] ?? null;

// ❌ wrong — requires relational API config not set up in this project
const profile = await db.query.profilesTable.findFirst({ where: ... });
```

---

## Security constraints (permanent)

- `ANTHROPIC_API_KEY` is server-side only. Never reference it in app.config.js, EAS config, or any client bundle.
- Stripe secret keys are server-side only. Same rule.
- Never ask the user to paste secret keys in chat. Secrets go directly into Render's Environment Variables tab.
- Do not touch Stripe, payments, checkout, or webhook code without explicit instruction.

---

## Navigation token format

When Spark/Vibe wants to send the user somewhere in the app:

```
[GO:/route:Button Label]
```

Examples:
- `[GO:/(tabs)/events:Browse Miami Events 🎉]`
- `[GO:/(tabs)/index:Start Discovering 🔥]`
- `[GO:/likes-you:See Who Likes You 💖]`
- `[GO:premium:Unlock Plus ⚡]`

The mobile client strips these from display text and renders them as tappable chips. One per reply max, only when naturally relevant.

---

## Launch-readiness audit (2026-06)

Audit covered: premium CTAs, settings rows, dead buttons, back nav, auth guards, onboarding redirect.

### Status

| Check | Status | Notes |
|---|---|---|
| Every premium CTA → `/premium` | ✅ | Verified in index, matches, settings, profile, likes-you, profile-views, ai-bot |
| Every settings row opens a real screen | ✅ | All rows wired — legal (in-app or Linking), blocked-users, discovery filters, export/deletion |
| No button silently does nothing | ✅ fixed | See fixes below |
| Back nav from every nested screen | ✅ | `router.back()` present in all stack screens |
| Logged-out → auth | ✅ | `app/index.tsx` redirects to `/(auth)/welcome` |
| New users → onboarding | ✅ | `app/index.tsx` checks `user.unsafeMetadata.onboardingComplete`, redirects to `/onboarding` |

### Dead-button fixes applied

- **`moments.tsx` Echo button** — previously called `onClose()` with no feedback. Now shows `Alert("Echo coming soon 🔜", ...)` and closes on "Got it".
- **`moments.tsx` handleLike** — previously only fired haptics. Now calls `setSentFlash("❤️ Liked …!")` for visible confirmation.
- **`matches.tsx` accept()** — previously removed the request and showed a flash but left the user stranded. Now navigates to the accepted user's profile after 800 ms so the user can immediately start a conversation.

---

## Pending work

- [x] **Wire Moments API client calls** — `moments.tsx`: feed fetch, `handleLike`, `handleReply`, `handlePost` all wired to real server endpoints. `matches.tsx`: `decline()` wired via new `declineMomentRequest()` helper in `connectApi.ts`. Auth via `customFetch` (moments/matches) and `useAuth().getToken()` (moments.tsx). All fire-and-forget on failure — UI is optimistic.
- [ ] **Run DB migration** — `render.yaml` buildCommand includes `pnpm --filter @workspace/db push`. Will run automatically on next Render deploy. Creates `spark_memory` table. Until this runs, Spark memory will throw a DB error on conversations 10+ messages.
- [x] **Mobile paywall handling** — `ai-bot.tsx` catches HTTP 402, sets `paywallHit` state, replaces input bar with upsell banner → `/premium`
- [x] **Fix routing blockers** — All 4 missing Stack.Screen entries added to `_layout.tsx`: `chat/ai-bot`, `communities/[id]`, `communities/create`, `communities/thread/[postId]`.
- [x] **Fix `profile-views.tsx` navigation** — Confirmed already using correct `pathname` + `params` pattern. No change needed.
- [x] **Add Stripe price env vars to `render.yaml`** — Already present as `sync: false` entries.
- [x] **Fix `communities/[id].tsx` nav bugs** — 3 string interpolation patterns replaced with `pathname` + `params`.
- [x] **Fix `communities/thread/[postId].tsx` nav bugs** — 2 string interpolation patterns replaced with `pathname` + `params`.
- [x] **No remaining string interpolation nav bugs** — Smoke test confirmed zero `router.push(\`/...\`)` patterns remaining.

### Remaining before launch (manual steps required)

- [x] **Clerk live key in eas.json** — `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` is set in both `preview` and `production` EAS profiles from Clerk Dashboard → API Keys.
- [x] **EAS internal auth config** — `preview` builds now include the Clerk publishable key, so internal EAS builds can authenticate.
- [ ] **App Store Connect IDs in eas.json** — Replace `REPLACE_WITH_APP_STORE_CONNECT_APP_ID` and `REPLACE_WITH_APPLE_TEAM_ID` placeholders.
- [ ] **Firebase push files** — Add `GoogleService-Info.plist` (iOS) and `google-services.json` (Android) for push notifications. Get from Firebase Console → Project Settings.
- [ ] **Play Store service account** — Add `google-play-service-account.json` for `eas submit` to Android.
- [ ] **Trigger Render deploy** — Runs DB migration automatically via buildCommand. Spark memory needs the `spark_memory` table created.

### EAS internal testing notes

- Internal iOS testing should use `artifacts/connectsphere-mobile/eas.json` profile `preview`.
- Command from `artifacts/connectsphere-mobile`: `eas build --platform ios --profile preview`.
- iOS ad hoc internal installs require tester devices to be registered with EAS/Apple first (`eas device:create`).
- Firebase config files are still pending before push-notification QA: `GoogleService-Info.plist` for iOS and `google-services.json` for Android.

---

## Moments API wiring (2026-06)

All previously client-side-only TODO stubs now hit real server endpoints. Server was already complete (`artifacts/api-server/src/routes/moments.ts`) — only the client needed wiring.

### Files changed

| File | What changed |
|---|---|
| `artifacts/connectsphere-mobile/app/(tabs)/moments.tsx` | Feed fetch, handleLike, handleReply, handlePost wired |
| `artifacts/connectsphere-mobile/app/(tabs)/matches.tsx` | decline() wired via declineMomentRequest |
| `artifacts/connectsphere-mobile/services/connectApi.ts` | Added `declineMomentRequest()` helper |

### Auth pattern used

`moments.tsx` uses `useAuth()` directly (the hook is added to both `useMoments` and the main `MomentsScreen` component):

```ts
const { getToken } = useAuth();
const token = await getToken();
// then:
headers: { Authorization: `Bearer ${token}` }
```

`matches.tsx` decline uses `customFetch` from `@workspace/api-client-react` — this auto-injects the token via the global getter set in `_layout.tsx`'s `AuthTokenSetter`. No hook needed.

### Call map

| Handler | Method + Endpoint | Body fields |
|---|---|---|
| `useMoments.load()` | `GET /api/moments/feed?filter=<f>` | — |
| `handleLike` | `POST /api/moments/:id/like` | `{ userDisplayName, userPhotoUrl }` |
| `handleReply` | `POST /api/moments/:id/reply` | `{ message, userDisplayName, userPhotoUrl }` |
| `handlePost` | `POST /api/moments` | `{ text, location?, userDisplayName, userPhotoUrl }` |
| `decline()` (matches.tsx) | `DELETE /api/moments/requests/:rid` | — |

### Failure strategy

All calls are **fire-and-forget** on error — UI updates optimistically. Feed fetch falls back to `buildMockMoments()` if API returns non-OK or throws. This means the experience is identical to before on cold starts or offline.

---

## Routing fixes (2026-06)

### Match cards — `app/(tabs)/matches.tsx`

`MatchesSpotlightRow.onPress` previously checked `peerId` first, so every new match card opened the profile screen instead of chat. Fixed to check `chatId` first:
- Local dating chats (`chatId.startsWith("local:")`) → `router.push("/chat/dating/[id]")`
- Server chats → `openChat(chatId)`
- Fallback (no chatId) → `navigateProfile(peerId)` as before

### Event cards — `app/(tabs)/events.tsx`

Already correct — `EventDetailSheet` bottom-sheet modal opens on every card press. No change needed.

### Notification routing — `components/PushTokenRegistrar.tsx`

Expanded `routeFromNotification` to handle all three notification data shapes:

| Notification | `data` shape | Routes to |
|---|---|---|
| message, friend_accept, plan_invite, plan_join, double_date_match | `{ chatId, matchId, url, type }` | `openChat(chatId)` |
| Anti-ghost nudge | `{ route: "/chat/dating/<id>" }` | `router.push("/chat/dating/[id]")` |
| Daily spark | `{ route: "/(tabs)/index" \| "/(tabs)/matches" }` | `router.push(route)` |

Also imported `router` from `expo-router` (was missing — only `openChat` was imported before).

---

## Premium paywall — full rebuild (2026-06)

**File:** `artifacts/connectsphere-mobile/app/premium.tsx`

### What changed

- **SVG logo** — `PlusLogo` component using `react-native-svg` (`Circle`, `Path`, `Ellipse`) recreates the pink 4-pointed compass star in a ring. No PNG dependency.
- **3-plan layout** — Yearly hero card (full width, pink border, flash sale badge ~~$390~~ → $300) + two small cards side-by-side (6-month ~~$180~~ → $150, biweekly $14.99).
- **Tap-to-checkout** — every plan card calls `handleCheckout(plan)` directly. RC attempted first if available; falls through to Stripe web checkout otherwise.
- **Per-plan loading state** — `loadingPlan: "monthly" | "sixmonth" | "yearly" | null`. Spinner only appears on the tapped card, not all three.
- **Already-premium guard** — if `entitlement.isPremium === true` on load, paywall is replaced with a "You're on Plus ⭐" screen + Manage Subscription button.
- **Restore when RC not ready** — shows Alert with "Open Billing" button → `/api/stripe/portal` instead of silently doing nothing.
- **"Manage on Web" footer link** — when RC is unavailable (current state), the footer shows "Manage on Web" (muted, links to portal) rather than redundant "Subscribe on Web".
- **`user.id` as auth authority** — `syncFromCustomerInfo` uses Clerk `user.id` as primary `appUserId`, RC's `originalAppUserId` as fallback.

### Stripe prices (live mode — confirmed via Stripe MCP)

| Plan | Price ID | Amount |
|---|---|---|
| `monthly` (biweekly) | `price_1TkBuZCnolnhP5uucFOtK1Cl` | $14.99 / 2 weeks |
| `sixmonth` | `price_1TkCMsCnolnhP5uuYmFBKUbn` | $150 / 6 months |
| `yearly` | `price_1TkCMwCnolnhP5uu2yybQk1h` | $300 / year |

### Render env vars required

Set in Render → API server → Environment (all `sync: false`):
- `STRIPE_PRICE_MONTHLY=price_1TkBuZCnolnhP5uucFOtK1Cl`
- `STRIPE_PRICE_SIXMONTH=price_1TkCMsCnolnhP5uuYmFBKUbn`
- `STRIPE_PRICE_YEARLY=price_1TkCMwCnolnhP5uu2yybQk1h`

### Webhook plan detection (`artifacts/api-server/src/routes/stripe.ts`)

`checkout.session.completed` reads `session.metadata.plan` → months: yearly=12, sixmonth=6, monthly=1.
`invoice.payment_succeeded` reads `price.recurring.interval` + `interval_count`: year→yearly, month+6→sixmonth, else monthly.
`setDbPremium()` writes to DB first (primary); RC grant is fire-and-forget (non-fatal).

---

## Routing audit — resolved (2026-06)

### ✅ All Stack.Screen registrations confirmed

All navigated routes have Stack.Screen entries in `app/_layout.tsx`. Smoke-tested clean.

### ✅ No string interpolation navigation bugs

All `router.push()` calls use `{ pathname, params }` pattern. Verified with grep — zero backtick-interpolated paths remain.

### ✅ Premium CTAs

All 8 premium push calls route correctly to `/premium`.
