# ConnectSphere Routing Contract

This is the authoritative routing reference for the Expo mobile app. Claude and
Codex must read it before changing navigation.

The root HTML routing maps are visual companions. When they disagree with this
document or the code, update them in the same commit.

## Routing ownership

| Concern | Source of truth |
| --- | --- |
| Root stack and presentation | `artifacts/connectsphere-mobile/app/_layout.tsx` |
| Tabs and visibility | `artifacts/connectsphere-mobile/app/(tabs)/_layout.tsx` |
| Shared route builders | `artifacts/connectsphere-mobile/lib/routes.ts` |
| App-start auth decision | `artifacts/connectsphere-mobile/app/index.tsx` |
| Auth-group guard | `artifacts/connectsphere-mobile/app/(auth)/_layout.tsx` |
| Tab auth/onboarding guard | `artifacts/connectsphere-mobile/app/(tabs)/_layout.tsx` |
| Notification routing | `artifacts/connectsphere-mobile/components/PushTokenRegistrar.tsx` |
| AI navigation tokens | `artifacts/connectsphere-mobile/app/chat/ai-bot.tsx` |

Do not introduce another route helper or duplicate route constants inside a
feature.

## Startup decision tree

The root `/` route is a splash controller. It replaces itself after animation
and auth state are ready:

```text
E2E smoke → /(tabs)
Signed out → /(auth)/welcome
Signed in + onboardingComplete === true → /(tabs)
Signed in + onboarding incomplete → /onboarding
```

Auth and tab layouts repeat these guards intentionally to protect direct links.
Use `replace` for startup/auth transitions so Back cannot return to an invalid
state.

## Tabs

| Label | Route | Visibility |
| --- | --- | --- |
| Discover | `/(tabs)` or `/(tabs)/index` | Visible |
| Connect | `/(tabs)/matches` | Visible |
| Events | `/(tabs)/events` | Visible |
| Spaces | `/(tabs)/communities` | Visible |
| Moments | `/(tabs)/moments` | Hidden (`href: null`) |
| Profile | `/(tabs)/profile` | Hidden (`href: null`), opened by avatar |

Only the first four routes belong in the visible tab order. Moments and Profile
remain valid tab screens without tab buttons.

## Root stack inventory

| Route | Presentation | Primary entry |
| --- | --- | --- |
| `/onboarding` | Card, gesture disabled | Startup/auth guards |
| `/chat/[matchId]` | Card | Server chat and `openChat()` |
| `/chat/dating/[id]` | Card | Local dating chat |
| `/chat/ai-bot` | Card | Spark/Vibe CTAs |
| `/communities/[id]` | Card | Space card |
| `/communities/create` | Modal | Create Space |
| `/communities/thread/[postId]` | Card | Space post/reply |
| `/user/[userId]` | Card | `openProfile()` and profile taps |
| `/premium` | Full-screen modal | Feature gates |
| `/settings` | Card | Profile |
| `/congrats` | Gesture disabled | Celebration flow |
| `/success` | Fade, gesture disabled | Onboarding intent completion |
| `/resume` | Card | Resume/onboarding |
| `/likes-you` | Modal | Reactions discovery |
| `/blocked-users` | Card | Settings |
| `/referral` | Card | Profile referral |
| `/profile-views` | Card | Profile analytics |
| `/legal/privacy` | Card | Auth/settings |
| `/legal/terms` | Card | Auth/settings |
| `/u/[username]` | Deep-link resolver | Public username URL |
| `/invite/[code]` | Deep-link resolver | Referral URL |
| `+not-found` | Fallback | Unknown route |

`/success` is not payment success. It completes onboarding intent selection and
routes to Discover, Friends intent, or Spaces. Purchase completion stays inside
`/premium` through RevenueCat/Stripe synchronization.

## Shared route builders

Prefer helpers from `lib/routes.ts`:

| Helper | Destination |
| --- | --- |
| `openChat(chatId, params?)` | `/chat/[matchId]`, with optional `wave`/`openPlan` |
| `openProfile(userId, from?, fallback?)` | `/user/[userId]` |
| `openPremium(feature?)` | `/premium?feature=...` |
| `openConnectChat(chatId)` | `/(tabs)/matches?openChatId=...` |
| `openConnect()` | `/(tabs)/matches` |

Add repeated destinations here rather than copying route construction.

## Critical chat invariant

```text
chatId starts with "local:"
  → /chat/dating/[id]
  → id is chatId without "local:"

server match/conversation ID
  → /chat/[matchId]
  → use openChat(chatId)
```

Never send a `local:` ID through `openChat()`. Never manufacture a local route
for a server chat. If both `chatId` and `peerId` exist, chat wins; profile is the
fallback only when no chat exists.

Connect accepts:

- `openChatId`: enter Connect and open a server chat.
- `segment`: select a supported Connect segment such as `matches` or `moments`.

## Profile routing

Use `openProfile()` where possible. It may carry:

- `from`;
- `fallbackName`;
- `fallbackPhoto`;
- `fallbackAge`;
- `fallbackNeighborhood`.

Fallbacks render identity while the canonical profile loads.

`/u/[username]` resolves as follows:

```text
signed out → /(auth)/welcome
resolved username → /user/[userId]
lookup failure → /(tabs)
```

## Spaces

```text
/(tabs)/communities
  ├─ /communities/[id]
  │   ├─ /communities/thread/[postId]
  │   └─ /user/[userId]
  └─ /communities/create
```

Detail and thread screens normally return with `router.back()`.

## Events, plans, and Moments

- Event taps open an in-screen `EventDetailSheet`, not a stack route.
- Created plan chats use `openChat()` or Connect's `openChatId` handoff.
- Event profile taps use `openProfile(..., "events", ...)`.
- Moments is a hidden tab reached from Discover, chat, or Connect.
- Moment profile taps use `openProfile(..., "moments", ...)`.
- Moment requests open Connect with `segment=moments`.

## Premium

All premium gates end at `/premium`. Preserve the triggering `feature`:

| Value | Source |
| --- | --- |
| `rewind` | Discover undo |
| `boost` | Boost CTA |
| `shots` | Shot/settings gate |
| `best-friend` | Friends/settings gate |
| `reactions` | Likes/reactions gate |
| `connect` | Connect incoming-list gate |
| `moments` | Moments viewer-list gate |
| `profile-views` | Profile Views visitor-list gate |
| `spark` | Spark AI chat gate |
| `swipes` | Discover daily swipe limit gate |

AI chat can route to premium through `[GO:premium:...]` or HTTP 402. Confirmed
purchase/restore returns with `router.back()`. Do not route payment completion
to onboarding `/success`.

## Notifications

Notification taps are resolved in order:

1. `data.chatId` or `data.matchId` → `openChat(id)`.
2. Legacy `data.url` matching `/chat/<id>` → decoded `openChat(id)`.
3. `data.route` matching `/chat/dating/<id>` → local dating chat.
4. Other trusted `data.route` values → internal tab route.

This handles foreground taps and cold starts. New notification types require a
documented payload, destination, and routing test.

## AI navigation tokens

Spark/Vibe replies may contain:

```text
[GO:/route:Button Label]
```

The client removes the token and renders a navigation chip. Server-emitted
routes must be valid internal routes. `premium` is shorthand for `/premium`.
Use at most one token per reply.

## Navigation semantics

- `replace`: startup, auth, onboarding completion, invalid deep-link recovery.
- `push`: user-initiated screen navigation.
- `back`: close stack cards/modals and restore prior context.
- In-screen sheets remain state, not routes, unless product design changes.

## Required routing change checklist

1. Update the route file and root/tab registration when needed.
2. Update `lib/routes.ts` for reused destinations.
3. Update guards when access rules change.
4. Update notification/deep-link parsing for external entry.
5. Add or update focused routing tests.
6. Update this contract and both HTML maps.
7. Update `docs/agent-handoffs/CURRENT.md`.

Run:

```powershell
pnpm.cmd --filter @workspace/connectsphere-mobile run audit:taps
pnpm.cmd --filter @workspace/connectsphere-mobile exec jest --runInBand
```

## Known routing-adjacent debt

The 2026-06-23 baseline tap audit found five controls without handlers in
Matches and Community screens. These are interaction gaps, not missing route
registrations. Decide each control's destination or disabled state before
implementing fixes on a dedicated quality-gates branch.
