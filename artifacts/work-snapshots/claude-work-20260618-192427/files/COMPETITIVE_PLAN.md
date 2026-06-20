# ConnectSphere — Path to Competitive

The gap is not features. It's five things: an existential age-policy problem, infrastructure that won't survive users, invisible trust, no density plan, and no data flywheel. This plan sequences all of it. Each task has a **Done when** so nothing stays vague.

**Phases overlap.** 0 is a blocker for everything. 1–2 are engineering. 3 is founder work. 4 is ongoing discipline.

---

## Phase 0 — Existential blockers (do first, ~1 week)

### 0.1 Age policy restructure: 18+ dating
Apple requires dating apps to be 17+; mixing 16–17s with adults in a romantic context is a safety catastrophe and a near-guaranteed rejection. Current docs say "open to users 16+".

- Decide: **(a)** 18+ for the whole app (simplest, recommended for launch), or **(b)** 18+ dating with friends mode as a hard-walled under-18 space (more work: separate discovery pools, no cross-age visibility, stricter moderation — do this later if ever).
- Enforce date-of-birth at onboarding (Clerk metadata + server-side check on every profile read, not just signup UI).
- Reject under-18 accounts at the API layer (`/profiles/me` upsert), not just the client.
- Set App Store age rating to 17+/18+, update all marketing copy, terms, and `replit.md`.
- **Done when:** an account with DOB < 18 years cannot complete onboarding or appear in any discovery/inbox response, verified by an integration test.

### 0.2 Legal & App Store table stakes
- In-app account deletion (Apple requirement) — full server-side cascade: profile, matches, messages, photos, JSON-db records.
- Privacy policy + terms hosted and linked in Settings (data collected, retention, contact).
- Data deletion/export request path (email is fine at launch; document the process).
- **Done when:** delete-account works end to end in prod and both legal docs are live and linked.

---

## Phase 1 — Infrastructure that survives success (~2–3 weeks, parallel with Phase 2)

### 1.1 Kill the JSON-file database
Friends, shots, plans, json-chats, reactions live in a JSON file on one Express instance (`readJsonDb`/`writeJsonDb` in `dating.ts`/`friends.ts`). Two concurrent writes = lost data. This is the scariest thing in the codebase.

- Design Drizzle tables for: shots, friend connections, plans + plan members, json-chats + messages, reactions. (Half the app — profiles, matches, chat_messages, likes — is already on Postgres.)
- Migrate route by route; keep response shapes identical so the mobile app doesn't change.
- **Done when:** `readJsonDb` has zero call sites in production routes.

### 1.2 Real-time chat
Chat is request/response + refetch-on-focus. Competitive chat is instant.

- Pick one transport: Firestore listeners (already in the stack for presence) or a websocket layer. Recommendation: Firestore for speed-to-ship — you already pay its complexity for presence.
- New-message push → in-conversation delivery without refetch; typing indicator already exists.
- **Done when:** two devices in the same chat see messages in <1s without backgrounding/foregrounding.

### 1.3 Fence dev mocks out of production
Mock events/venues/profile fallbacks are interleaved with production code paths.

- Every mock path behind a single `DEV_FAKE_DATA` env flag, off in prod. Seeded demo content (e.g. "Sofia" shot) must never reach a real user.
- **Done when:** grep for mock fixtures shows them only behind the flag, and a prod smoke test returns zero seeded entities.

### 1.4 Voice notes end to end (Pass 3 — spec already written)
- Schema columns, OpenAPI + codegen, presigned audio upload, send/receive/play. Per `SPEC_CHAT_SHOT_VOICE_UX.md` Pass 3.
- **Done when:** the Pass 3 acceptance test passes (record on A, play on B, survives restart).

### 1.5 Observability
- Crash reporting (Sentry RN + server), uptime monitor on `/health`, alert on error-rate spike.
- **Done when:** you get an alert within minutes of a prod 500 storm, with stack traces.

---

## Phase 2 — Trust as a visible product (~2 weeks, parallel with Phase 1)

### 2.1 Photo verification that gates
`LivenessCamera` exists — finish the loop.

- Liveness pass → `isVerified` on profile → visible badge (partially present) → **gating**: verified-only filter in discovery, and nudge unverified users ("verified profiles get 3× more matches").
- **Done when:** a user can complete verification in-app and filter discovery to verified-only.

### 2.2 Report handling SLA
A report that sits for a week is a liability and a churned user.

- Admin review surface (a simple protected web page over the reports table is enough at launch).
- Target SLA: review within 24h. Define the action ladder: warn → restrict → ban. Document it.
- Auto-restrict on N reports in 24h pending review (cheap, catches the worst fast).
- **Done when:** every report reaches a human decision within 24h and repeat offenders are auto-restricted.

### 2.3 Safety, visibly
- Safety sheet on first chat with a new match (location-sharing tips, report shortcut).
- Keep the safety copilot idea (pattern warnings) parked for post-launch — visible basics first.
- **Done when:** a new user encounters at least one deliberate safety touchpoint before their first IRL plan.

---

## Phase 3 — Miami density playbook (founder work, weeks 1–6 alongside everything)

Liquidity is the moat. The app must feel *full* in Miami before it exists anywhere else.

### 3.1 Positioning
- One sentence everywhere: **"Matches that turn into actual plans this weekend in Miami."** Onboarding, App Store listing, landing page, first push notification.
- UI follows: plan CTA in the match moment, labeled Plan button, shot count visible (from the design critique — small builds).

### 3.2 Seed density before launch
- Waitlist by neighborhood; open a neighborhood only when it has enough signups to feel alive (a few hundred). Empty discovery = instant churn.
- 10–20 campus/scene ambassadors (FIU, UM, Wynwood/Brickell service industry) with comp'd Plus + invite codes. The friends-invite system already in the app is the tool.
- Venue/event partnerships: your events tab already lists them — get 3–5 venues to honor "met on ConnectSphere" perks; launch-night events where the app is the RSVP.

### 3.3 Launch mechanics
- Soft launch (TestFlight, ambassadors only) → fix the funnel → public launch tied to one real event.
- Every week: one IRL event anchored in the app. The events system is the growth engine, not just a feature.
- **Done when:** week-1 public-launch users in target neighborhoods see a full deck (50+ real profiles) and at least one live local event.

---

## Phase 4 — The data flywheel (starts week 1, never ends)

### 4.1 Instrument the funnel
Pick eight events and live by them: signup_complete, profile_complete, first_swipe, match_created, first_message, conversation_active (3+ exchanges), plan_proposed, plan_accepted.

- Wire through the existing `lib/analytics` into a dashboard (Amplitude or PostHog).
- Watch weekly: D1/D7 retention, match→conversation rate, conversation→plan rate. These three numbers are the company.
- **Done when:** you can answer "what % of Tuesday's matches proposed a plan?" in 30 seconds.

### 4.2 Outcome-fed ranking v1
- Crude is fine: boost profiles whose shots/messages get replies; weight vibe-quiz overlap; decay inactive profiles. No ML needed yet — a scoring function over data you already store.
- The unique signal: **plan accepted** is ground truth nobody else has. Feed it back.
- **Done when:** discovery order differs measurably from recency order and reply-rate per shown profile improves.

### 4.3 Cut to focus
- Hide behind feature flags at launch: games tab, double dates, half the reaction types. Fewer, deeper loops; bring them back when the core funnel is healthy.
- **Done when:** the launch build has ≤3 primary loops (discover→shot/match, chat→plan, events) and each is instrumented.

---

## Sequence at a glance

| Week | Engineering | Founder |
|------|-------------|---------|
| 1 | 0.1 age gate, 0.2 deletion/legal, 4.1 events wiring | Positioning sentence, waitlist live, ambassador outreach |
| 2–3 | 1.1 JSON-db migration, 2.1 verification, 1.3 mock fences | Venue partnerships, soft-launch cohort |
| 3–4 | 1.2 real-time chat, 1.4 voice notes, 2.2 report tooling | TestFlight soft launch, funnel review weekly |
| 5–6 | 1.5 observability, 4.2 ranking v1, 4.3 flag cuts | Public launch event, weekly IRL events cadence |

## What I can build vs. what needs you

- **I can build:** everything in Phases 0–2 and 4 (age gating, migrations, real-time chat, verification loop, admin page, instrumentation, ranking v1, feature flags).
- **Needs you:** policy decisions (0.1a vs 0.1b), legal doc review, App Store account work, all of Phase 3 (people, venues, events), and the weekly discipline of reading the funnel and cutting what doesn't move it.

## Explicitly parked (good ideas, wrong moment)
Agentic date concierge, wingman memory, safety copilot, double-date matchmaker, post-date debrief ranking — all stronger *after* density, real-time chat, and instrumentation exist. They feed on data and liquidity you don't have yet.
