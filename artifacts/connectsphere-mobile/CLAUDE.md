# ConnectSphere / Discover Miami

React Native dating + social app for Miami. Expo SDK 54, Expo Router v6, Express 5 API on Render.com.

## Stack

- **Mobile:** React Native + Expo SDK 54, Expo Router v6 (file-based routing)
- **Auth:** Clerk (`@clerk/clerk-expo`)
- **Backend:** Express 5 on Render.com — source at `artifacts/api-server/` (NOT `connectsphere-mobile/server/`)
- **Database:** Firebase Firestore + local JSON mock (`artifacts/api-server/db.json`)
- **Payments:** Stripe Hosted Checkout (web) + RevenueCat (mobile IAP)
- **AI:** Anthropic Claude Haiku via `/api/ai-chat` proxy (key stays server-side only)
- **Animations:** react-native-reanimated v3
- **Crash:** Sentry | **Analytics:** PostHog | **Push:** Expo Notifications
- **Events:** Ticketmaster API | **GIFs:** GIPHY

## Security Rules (never break these)

- **Never ask the user to paste secret keys in chat.** Secret keys go directly into Render's Environment Variables tab.
- **ANTHROPIC_API_KEY is server-side only.** Never ship it to the client bundle or `.env.local`.
- **Stripe secret keys are server-side only.** Never in app.config.js, EAS public env, or source code.
- **Do not touch Stripe, payments, checkout, or webhook code** without explicit instruction.

## Expo Go — Dev Testing on Device

```bash
cd artifacts/connectsphere-mobile
npx expo start
```

Scan the QR code in Expo Go (iOS/Android). Hot-reloads instantly on save.

**Physical device requirement:** `.env.local` must contain:
```
EXPO_PUBLIC_API_URL=https://connectsphere-bukg.onrender.com
```
Without this, `getApiBaseUrl()` falls back to `http://localhost:8080` — unreachable from a phone. Simulator/emulator works without it.

**Render cold-start:** First API call after inactivity takes 10–30s. The AI chat layer handles this with a 15s timeout + "waking up… just a sec ☕" hint after 3s. Other Render calls use `withTimeout(promise, 5000)` — pull-to-refresh once it wakes up.

**EAS builds** (preview/production) hardcode the Render URL in `eas.json` — no `.env.local` needed.

**Deploying server changes:** Push to the connected GitHub branch — Render auto-deploys. Or hit **Manual Deploy** on the Render dashboard.

## API URL Resolution

`lib/apiBase.ts → getApiBaseUrl()` priority:
1. `EXPO_PUBLIC_API_URL` — always wins
2. `EXPO_PUBLIC_DOMAIN` — used as host
3. `http://localhost:8080` — simulator only

## Routing — Critical

Two separate chat files:

| Route | File | Used by |
|-------|------|---------|
| `/chat/dating/[id]` | `app/chat/dating/[id].tsx` | Connect tab — local dating chats (DatingMatchContext) |
| `/chat/[matchId]` | `app/chat/[matchId].tsx` | Inbox chats (server conversations, accepted Shots) |

Always check which file a feature opens before editing.

## Spark / Vibe AI Companions

`app/chat/ai-bot.tsx` + `lib/aiChat.ts` + `artifacts/api-server/src/routes/aiChat.ts`

Route: `/chat/ai-bot?mode=dating|friends`

### Behavior
Spark ✨ (dating) and Vibe 🌊 (friends) are **virtual best friends — not topic-locked coaches**. They answer whatever the user asks (food, life advice, anything). Dating/app features only surface when the user naturally raises them. This is the first rule of both system prompts: "Talk about whatever the user brings up."

### Cold-start UX (Render free tier sleeps after inactivity)
- Fetch wrapped in `withDeadline(15000)` — times out at 15s with a friendly retry message
- After 3s with no first streaming token → `slowHint` state shows "waking up… just a sec ☕" below typing dots
- `slowHint` clears immediately on first token — no impact on fast responses
- Error copy by kind: `timeout` → "waking up (cold server), tap Retry", `unavailable` → "starting up, tap Retry in a few seconds"

### Streaming architecture
- `sendAiChatMessageStreaming()` uses `expo/fetch` (WinterCG) for native SSE streaming
- Falls back to non-streaming `sendAiChatMessage()` if `expo/fetch` unavailable
- `parseSseLine()` never throws — malformed SSE frames are silently skipped
- `withDeadline(ms, callerSignal)` merges timeout + user abort so cleanup is always correct

### Action chips — `[GO:route:label]` token system
The AI can embed navigation tokens in replies:
```
[GO:/(tabs)/events:Browse Miami Events 🎉]
```
`parseActions()` in `ai-bot.tsx` strips tokens from display text and renders them as pink gradient chips below the bubble. Only parsed on **completed, non-streaming** messages — never mid-stream. Tapping navigates with haptic feedback; `premium` route → `/premium`.

Available routes: `/(tabs)/index`, `/(tabs)/matches`, `/(tabs)/events`, `/likes-you`, `premium`

### Subtitles & taglines
Both modes: `"your new virtual bestie, what's good? 👋"` — defined in `AI_BOT_SUBTITLES` in `lib/aiChat.ts`. Starter screen tagline matches. Intentionally lowercase/casual.

### Rate limiting
20 messages/hour per user via `aiChatRateLimit` middleware on both `/api/ai-chat` and `/api/ai-chat/stream`.

### Starter prompts
8 prompts per mode in `lib/aiChat.ts` — `DATING_STARTER_PROMPTS` and `FRIENDS_STARTER_PROMPTS`.

### Double-send guard
`inFlightRef` (sync ref) guards against rapid double-tap before React re-renders, complementing the `loading` state check.

## Key Data Flows

- **DatingMatchContext** (`contexts/DatingMatchContext.tsx`) — local matches, `chats`, `matches`, `sendMessage`, `currentUserId`. AsyncStorage-persisted.
- **Inbox chats** — fetched via `/api/connect/inbox` → `CsConversation` type (`services/connectApi.ts`).
- **Session cache** — `connectCache` module-level var in `matches.tsx` keyed by userId; tab re-entry renders instantly while background refresh runs.
- **Loading guard** — `lastLoadedAtRef` with 30s gate prevents triple-fetch on tab switch.

## Shots (Connect → Matches tab)

`app/(tabs)/matches.tsx` — `ShotCard` component (line ~754).

Layout is **stacked vertical** (not horizontal row):
1. Sender row (avatar + name/age + "shot their shot" + chevron) — entire row is `<Pressable onPress={onAvatarPress}>`
2. Message bubble — `flex: 1` text with pink/purple left accent bar — always full width, never crushed
3. Pass / Accept action row

Fallback message: `shot.message?.trim() || "Sent you a shot 🔥"`

`onAvatarPress` calls `navigateProfile(shot.fromUserId, "matches", { name, photoUrl, age })` → opens `app/user/[userId].tsx`.

## Profile View — modeData Fields

`app/user/[userId].tsx` — full-screen scrollable profile. Opened from Shots, Reactions, Likes You, matches, and deep links.

`GET /profiles/:userId` returns `modeData: Record<string, unknown>`. Extract with helpers:
```ts
mdStr(profile, "datingGoal")
mdStr(profile, "prompt") / mdStr(profile, "promptAnswer")
mdStr(profile, "firstDateStyle")
mdArr(profile, "dateIdeas")
mdStr(profile, "height") / mdStr(profile, "occupation") / mdStr(profile, "lifestyle")
```

Top-level: `displayName`, `age`, `photos[]`, `intent`, `location`, `bio`, `interests[]`, `isVerified`.

Every section is null-guarded — missing onboarding data never leaves a blank void.

**FlatList carousel:** `onViewableItemsChanged` and `viewabilityConfig` must be `useRef(...).current` — stable refs, not inline.

**Fallback params:** `navigateProfile(userId, source, { name, photoUrl, age })` passes display data so screen renders immediately before API responds.

## Events Pipeline

`artifacts/api-server/src/routes/events.ts`:
- `DISK_CACHE_VERSION = 2` — version mismatch → ignores disk, fetches fresh
- `isFutureOrLiveEvent()` — drops events ended more than 1 hour ago
- To force fresh fetch: reset `events-cache.json` to `{"events":[],"providers":[],"refreshedAt":"","version":0}`
- Cache TTL: 6h. Retry on failure: 5min.

Mobile (`app/(tabs)/events.tsx`): on `isError`, header pill goes red ("Reconnecting…") and shows retry button.

## Theming

Use `useColors()` hook — never hardcode hex values. Exception: `app/user/[userId].tsx` and dark-only screens that intentionally use `#0a0a0f`. The AI chat screen (`ai-bot.tsx`) uses intentional hardcoded Miami neon (`PINK = "#FF2DA8"`, `PURPLE = "#A855F7"`) — do not swap these to `useColors()`.

## Animations

reanimated v3:
- Entering cards: `FadeInDown.springify().damping(16).stiffness(100)`
- Exiting cards: `SlideOutLeft.duration(260)`
- Message bubbles: `FadeInDown.springify()` with `isFresh` guard (only animate if `createdAt` < 3s ago — prevents history springing in on load)
- Bottom sheets: `useSharedValue(800)` → `withSpring(0)` open, `withTiming(800)` + `runOnJS` close

## Feature Flags

`EXPO_PUBLIC_FEATURE_*` env vars via `lib/launchConfig.ts`. Current: `FEATURE_DOUBLE_DATE`, `FEATURE_PREMIUM`, `FEATURE_PUSH`, `FEATURE_EVENTS_LIVE_PROVIDERS`, `FEATURE_AI_BIO`, `FEATURE_RESUME_UPLOAD`.

## Folder Layout

```
artifacts/
  connectsphere-mobile/
    app/
      (tabs)/             discover, matches, events, games, profile
      chat/
        ai-bot.tsx        Spark ✨ / Vibe 🌊 AI companions
        dating/[id].tsx   Connect tab chats (DatingMatchContext)
        [matchId].tsx     Inbox/server chats
      user/[userId].tsx   Full-screen profile view
      likes-you.tsx       Premium gate
      onboarding/
    components/
    contexts/             DatingMatchContext, etc.
    hooks/                useColors, useSessionState, etc.
    lib/
      apiBase.ts          getApiBaseUrl()
      aiChat.ts           Claude proxy wrapper + starter prompts + subtitles
      routes.ts           openChat, openProfile, openPremium helpers
    services/             connectApi.ts, eventsApi.ts, etc.
  api-server/
    src/routes/
      aiChat.ts           Spark/Vibe system prompts + SSE streaming
      profiles.ts         GET /profiles/:userId, PATCH /profiles/me
      events.ts           GET /api/events
      discovery.ts        Swipe deck, likes, matches
      dating.ts           Shots, reactions, respond
    events-cache.json     Disk cache (version-gated)
    db.json               Local dev mock
```

## Common Patterns

**New screen:** file in `app/` → `useSafeAreaInsets()` → `useColors()` → default export function.

**New API route:** handler in `server/routes/` → `authMiddleware` if needed → wire into `server/routes/index.ts` → add env vars to `render.yaml`.

**Touch targets:** minimum 44pt. `padding: 11` on icon `Pressable` buttons, `hitSlop={8}` on small controls.
