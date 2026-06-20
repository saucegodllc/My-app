# CLAUDE.md — ConnectSphere Session Notes

Project overview and conventions are in `replit.md`. This file tracks non-obvious decisions, gotchas, and recent changes so future sessions (and future Claude contexts) don't repeat the same mistakes.

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
  The mobile `ai-bot.tsx` screen needs to handle this status and show a ConnectSphere Plus upsell. **This client-side handling is not yet implemented.**

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

- [ ] **Run DB migration** — added to `render.yaml` buildCommand; will run on next Render deploy (Manual Deploy button). Creates `spark_memory` table.
- [x] **Mobile paywall handling** — `ai-bot.tsx` catches HTTP 402, sets `paywallHit` state, replaces input bar with upsell banner → `/premium`

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
