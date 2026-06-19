# Spec: Expanded Profile, Shot UX, Connect, Chat, Plans, Spark AI, Voice Notes

Status: ready for implementation — split into 4 passes (see Implementation Order).
Scope: `artifacts/connectsphere-mobile/` + minimal backend slices in `artifacts/api-server/` and `lib/`.

## Non-Goals

- Do NOT touch the web app (`artifacts/connectsphere/`).
- Do NOT change the API contract except where this spec explicitly adds fields (voice messages, plan requests).
- Do NOT restructure tab navigation.
- Do NOT suppress TypeScript errors anywhere (`@ts-ignore`, `any` casts to silence errors are forbidden).

## Implementation Order (4 passes, each independently shippable)

1. **Pass 1 — Bug fixes & crashes**: Spark AI crash, chat back/close loop, composer keyboard placement, incoming shot message text, Connect cached-load.
2. **Pass 2 — Plan requests in chat**: plan button wiring + plan request cards with pending/accepted/declined.
3. **Pass 3 — Voice notes end to end**: backend schema + upload + client record/send/play.
4. **Pass 4 — Polish**: ghost composer for shot prompts, ShotToast upgrade, action feedback, heart badge, report/block menu, chat header dead space.

Do not mix passes in one diff.

---

## Pass 1 — Bug fixes & crashes

### 1.1 Spark AI coach crash on send

- Repro: `<<PASTE EXACT REPRO STEPS / STACK TRACE HERE BEFORE STARTING>>` — if not provided, reproduce first and record it in the PR description before fixing.
- Server: `artifacts/api-server/src/routes/aiChat.ts` (Anthropic proxy, SSE stream + non-stream).
- Harden the client (`chat with Spark/Vibe` surfaces) for ALL of:
  - SSE stream interruption mid-response (network drop, app background) — abort cleanly, keep partial text, show retry affordance.
  - Malformed/non-JSON event payloads — skip frame, never throw to render.
  - **HTTP 429**: the route is rate-limited at 20 msgs/hour (`rateLimit({ key: "ai-chat", windowMs: 3600000, max: 20 })`). Show a distinct friendly message ("Spark needs a breather — back in a bit") — this is NOT the same as the API-down fallback.
  - HTTP 5xx / Anthropic outage: graceful fallback message, conversation remains usable, input not stuck in loading.
  - Double-send while a stream is open: disable send or queue, never crash.
- Acceptance: send 25 rapid messages → no crash, 429 path shows its distinct message; kill network mid-stream → no crash, retry works.

### 1.2 Chat close/back loading loop

- X/back out of chat must not trigger long loading loops.
- Re-entering a chat must render cached chat + profile data immediately, then hydrate in background.
- Re-entering must never show an expanded profile with missing details — if profile fields are absent, fetch by sender/user id and merge.
- Mechanism: use the existing react-query cache (Orval-generated hooks). Use `placeholderData`/`keepPreviousData` + background `refetch`; never invalidate-and-block on navigation events.
- Acceptance: enter chat → back → re-enter ×5 rapidly: no spinner longer than a frame when cache is warm, no profile-without-details state.

### 1.3 Message composer placement

- Composer must always sit above the keyboard AND above the bottom tab bar / safe area. It must never render underneath app navigation.
- Implement per-platform: iOS `KeyboardAvoidingView` (behavior `padding`) + safe-area insets; Android verify with `adjustResize` in app config.
- Acceptance: tested on iOS (notched device/simulator) and Android — keyboard open/close, rotate, emoji keyboard, voice recorder open. Composer never obscured in any state.

### 1.4 Incoming shots show the real message

- In Matches, an incoming shot WITH a message must display that exact message text. Never substitute a generic fallback when real text exists. (Fallback copy is only allowed when the shot truly has no message.)
- Tapping the sender's avatar/photo opens their full `ExpandedProfileCard` with real details; if the cached object is partial, hydrate by fetching the sender id, then merge.
- Acceptance: send a shot with a custom message between two test accounts → the exact text appears on the receiving side; tapping avatar shows complete profile.

### 1.5 Connect tab feels instant

- If cached matches/chats exist, render them immediately on tab focus; refresh in background.
- Full-screen skeletons only on cold start or true empty cache.
- Same react-query mechanism as 1.2 — no `isLoading`-gated blank screens when `data` exists.
- Acceptance: warm app → tap into Connect: content visible in <100ms perceived, no skeleton flash.

### 1.6 Cleanup in `matches.tsx`

- Fix any missing styles and TypeScript issues in `app/(tabs)/matches.tsx`. No error suppression.

---

## Pass 2 — Plan requests in chat

> The `plan_request` message/request type ALREADY EXISTS client-side: `services/connectApi.ts` (type union + render case) and `services/connectIncoming.ts` (handles `planTitle` etc.). EXTEND this flow — do not build a parallel system.

### 2.1 Chat plan button

- The calendar/plan button in chat must open the existing plan creation flow — reuse `CreateFriendPlanSheet` (or the shared plan creation route if one is registered).
- Creating a plan from chat sends a `plan_request` message into that conversation — it is a request, not a confirmed plan.

### 2.2 Plan request card in chat

- Render plan requests as a distinct card (not plain text): plan title, time/venue if set, and state.
- States: **pending** (recipient sees Accept / Decline buttons), **accepted**, **declined**. Sender sees current state.
- Accepting confirms the plan via the existing plans backend; declining notifies the sender in-thread.
- State transitions must survive app restart (persisted server-side, not local-only).
- Acceptance: A sends plan request → B sees pending card with Accept/Decline → B accepts → both see accepted card → plan exists in the Plans area. Repeat with decline.

---

## Pass 3 — Voice notes end to end

> **Backend does not exist yet.** `voiceUrl`/`voiceDurationSeconds` currently appear ONLY in `app/chat/[matchId].tsx`. The `chat_messages` table (`lib/db/src/schema/chatMessages.ts`) has no voice columns. This pass includes schema, API contract, and upload work.

### 3.1 Schema (lib/db)

- Add nullable columns to `chat_messages`: `voice_url` (text), `voice_duration_seconds` (integer).
- `content` stays NOT NULL — use empty string or a placeholder like `"[voice]"` for voice-only messages (pick one, document it, be consistent).
- Run the drizzle push/migration per repo convention.

### 3.2 API contract (lib/api-spec → codegen)

- Add `voiceUrl?` and `voiceDurationSeconds?` to the message schema in the OpenAPI spec.
- Extend POST message endpoint to accept them.
- Regenerate: `pnpm --filter @workspace/api-spec run codegen` — commit regenerated `lib/api-zod` + `lib/api-client-react`.

### 3.3 Upload path

- Reuse the existing presigned-upload flow: `POST /api/storage/uploads/request-url` → PUT audio bytes → store resulting URL as `voiceUrl`.
- Audio format: m4a/AAC from `expo-av` (whatever `VoiceNoteRecorder` already produces). Cap duration (suggest 60s) and file size server-side sanity check.

### 3.4 Client

- Use existing `components/VoiceNoteRecorder.tsx` to record/send; use the `VoiceNoteBubble` rendering (currently in `app/chat/[matchId].tsx`) to play.
- Receive + play must work for: server/inbox chats AND any local JSON/demo chat paths still used in development.
- Persist and render `voiceUrl` + `voiceDurationSeconds`; show duration on the bubble; playback progress indicator.
- Acceptance: record on device A → appears and plays on device B → kill and reopen both apps → voice message still loads and plays from server data.

---

## Pass 4 — Polish

### 4.1 Shot prompt → ghost composer (no literal automation)

- Tapping a suggested shot prompt must NOT send or prefill third-person copy like "Ask Maya about her sunset rooftop thing."
- Behavior, precisely:
  1. The suggestion is rewritten as a natural first-person opener (e.g. "okay your sunset rooftop pic — where is that??").
  2. It renders inside the composer as a dimmed/ghost type-over suggestion.
  3. Tapping the ghost text (or pressing send) accepts it as editable real text; typing anything replaces it; it NEVER auto-sends.
- Update `__tests__/shotUX.test.tsx` to encode the new behavior (the current tests assert the old flow — they must be updated, not deleted or skipped).

### 4.2 Shot sent feedback

- Remove any remaining tiny legacy "Shot sent" toast (check `components/ActionFeedback.tsx` — the legacy string lives there).
- Use/improve the richer `ShotToast` (already used in `app/(tabs)/index.tsx` and `ShotBottomSheet.tsx`): avatar, motion, haptics, elevated copy.
- Style baseline for "premium": match the energy of `UnlockToast`. (Subjective polish gets reviewed by hand — Ricky signs off on a screen recording.)

### 4.3 Expanded profile action buttons

- `Shot`, `Like`, `Spark`, `Skip`: behavior unchanged. Add action-specific animated feedback that never blocks or delays the underlying action (fire-and-forget animation).

### 4.4 Matches badge swap

- Replace the pink-circle "you two click"-style indicator in Matches with a small heart icon/badge.
- ⚠️ The literal string "You two click" does not exist in the mobile codebase. `<<RICKY: confirm the exact component/copy — likely a pink circle element in app/(tabs)/matches.tsx>>`. Identify the actual element before changing; do not guess.

### 4.5 Report/block UX in chat

- Remove the hazard/warning icon from the chat header.
- Report/block accessible via a polished three-dot header menu and/or the expanded profile menu — reuse/restyle `components/ReportBlockSheet.tsx` so it doesn't feel blocky.
- Report and block functionality must remain fully reachable (App Store review requirement — do not bury it more than one tap into the menu).

### 4.6 Chat header dead space

- Fill the large empty area below the chat header/presence with ONE compact, visually quiet contextual block. Pick the highest-signal option available for that conversation, in priority order: pending plan prompt → last shot/message context → suggested opener → mini profile preview.
- Must not push messages off-screen or animate distractingly.

---

## Global Acceptance Criteria

- `pnpm --filter @workspace/connectsphere-mobile typecheck` passes.
- `pnpm --filter @workspace/api-server build` passes.
- All existing tests pass; `shotUX.test.tsx` updated for new behavior; new tests added for: incoming shot real-message rendering, plan request state transitions, voice message field round-trip.
- No suppressed TS errors, no skipped tests.
- Each pass = its own PR with a screen recording of the affected flows.
