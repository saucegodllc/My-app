# ConnectSphere — Product Concept: Own the Real World
### The Miami Dating Map & the end of endless swiping

**For:** product designer + app engineer
**Premise:** Every major dating app optimizes time-in-app. ConnectSphere optimizes time-on-dates. The city is the product; the app is how you navigate it.

---

## 1. Core Product Strategy

**Positioning sentence (use everywhere):**
> *ConnectSphere is how Miami actually meets. Matches turn into real plans this weekend — not pen pals.*

**The strategic bet.** Tinder, Bumble, and Hinge are *inventory apps*: infinite profiles, infinite chats, no exit ramp into real life. Their business model needs you swiping; their users' goal is to stop swiping. That contradiction is the opening. ConnectSphere's unit of progress is not the match — it's the **accepted plan**. Every screen, notification, and premium feature pushes toward a date on a calendar at a real Miami venue.

**North-star metric:** plans accepted per active user per week.
**Supporting metrics:** match → conversation rate, conversation → plan-proposed rate, plan-proposed → accepted rate, date → "saw them again" rate.

**Three loops (everything ships into one of these, or it doesn't ship):**

1. **Discover loop** — expanded profiles + One Shot → high-intent matches. Scarcity over volume.
2. **Plan loop** — chat → date menu → plan request → accepted plan. The differentiator. *(Already built: plan_request envelopes, CreateFriendPlanSheet, plans backend.)*
3. **City loop** — map, events, venues → reasons to open the app even without a match. This is what no swipe app has: utility before romance.

**Why Miami-first wins.** A dating app with 5M thin users loses to one with 50k dense ones in a single city. Density makes the map feel alive, the events real, and "I'll be in Wynwood Friday" answerable. Own Miami completely; the playbook then copies to Austin, Atlanta, San Juan.

---

## 2. The Miami Dating Map ("The Pulse")

The centerpiece. Not a map of *people* (creepy, unsafe) — a live map of *dating energy*.

### What's on it
- **Neighborhood heat** — Wynwood, Brickell, South Beach, Little Havana, Coconut Grove, the Grove render as zones that glow by aggregated, anonymized activity: how many singles active tonight, plans happening, events on. Never individuals. Heat is the hook: "Brickell is on fire tonight" is a push notification people screenshot.
- **Date-ready venues** — partner venue pins with photos, price level, vibe tags ("first-date safe," "loud fun," "quiet talk"), and a one-tap **Propose here** action that drops a plan request into any of your chats. *(Builds on the existing venues API + saved venues.)*
- **Live events** — Ticketmaster + curated local events as pins; "12 singles interested" social proof (count only, profiles gated until matched). *(Builds on the events API + interest marks.)*
- **Flares** — the only user-generated signal on the map. A Flare is a zone-level, time-boxed intention: *"Wynwood, Friday night, gallery walk energy."* Your matches and likers see it and can respond with a plan proposal. Zone-level only, expires in 72h, off by default. This replaces a thousand boring "wyd this weekend" chats.
- **Tonight Mode** — a toggle that filters the whole map (and your discovery deck) to people, venues, and events live *tonight*. The app's adrenaline switch.

### What's deliberately NOT on it
- No real-time individual locations. Ever.
- No "people near you right now" grid (Grindr-pattern). Heat is aggregate; Flares are intentional and zone-level.
- No check-ins visible to non-matches.

### Engineering reality
`VenueMapView` (native + web variants), venues/events APIs, saved venues, and the map tab already exist. The Pulse is: a heat overlay computed server-side from activity counts by zone (cron, cheap), Flares as a small new table (userId, zone, window, note, audience), and "Propose here" wiring venue pins into the existing plan_request flow. The hardest part is already built.

---

## 3. Top 10 Features That Beat the Swipe Apps

1. **One Shot** *(built — promote it)* — one message before matching, 120 chars, daily limit, visible count. The anti-spam, anti-cheap mechanic. Hinge comments are infinite and ignorable; a Shot is spent. Market it as the signature: "You get one shot."
2. **The Pulse Map** *(section 2)* — the screen no competitor has. Open the app with zero matches and it's still useful.
3. **Date Menu** — in every chat, three concrete, tappable date proposals composed from live data: shared interests × venue tags × events this week × both schedules. "Thu: rooftop at Sugar · Fri: Wynwood art walk · Sun: arepas + river walk." Tap → plan request card. *(Composes existing icebreaker/venue/event/plan systems; later upgraded by AI.)*
4. **Flares** — broadcast intention, not availability-for-anything. Matches respond with plans, not "hey."
5. **Both-In** — one daily question pushed to both halves of a match; answers reveal only when both reply. Turns the dead daily-question pushes into a two-player game and gives dying chats a daily defibrillator. *(Daily Spark infra exists; add the pairing.)*
6. **Voice-first prompts** — profile prompts answerable by 20-second voice note; voice replies in chat. Chemistry is audible. *(VoiceNoteRecorder exists; Pass 3 finishes the pipe.)*
7. **Chemistry receipts** *(built — surface harder)* — vibe-quiz breakdown on match ("you're both plan-makers, both night owls") that feeds the Date Menu. Hinge says "you matched"; ConnectSphere says *why* and *what to do about it*.
8. **Tonight Mode** — spontaneity with guardrails: verified-only, public-venue proposals only.
9. **Afterglow** — 24h after a plan's scheduled time, both get a private, two-tap debrief ("Great / Fine / Not for me · see them again?"). Feeds matchmaking ranking with the one signal no competitor has: real-date outcomes. Mutual "again" auto-proposes date two.
10. **Date Concierge (premium, later)** — the AI layer over all of the above: reads both profiles + the live map and drafts the plan for you. *(Parked in COMPETITIVE_PLAN.md until density + data exist — listed here so design leaves room for it.)*

---

## 4. Visual Design Direction

**Theme: Miami Neon Noir.** Near-black canvas, one electric pink, purple accents, photography-forward. The app should feel like 11pm in Wynwood — not a pastel productivity tool (Hinge) and not a casino (Tinder).

- **Color:** ONE brand pink (recommend standardizing on `#EC4899` — already the most-used of the seven currently live) + soft tint `#F9A8D4`, purple `#A855F7`, single bg `#0A0A0B`, single card `#141414`. Friendship surfaces shift to cyan — same noir, different temperature. *(Token migration is item 1 in the design-critique priorities.)*
- **Type:** Sora ExtraBold for display moments, Inter 500–800 for everything else. Ban naked `fontWeight` (it silently renders system fonts).
- **Map aesthetic:** dark basemap, neon heat gradients, venue pins as glowing dots that bloom on tap. The Pulse should look like a nightlife poster, not Google Maps.
- **Motion:** celebrate outcomes, not actions. Swipes are quiet; Shots, matches, and accepted plans get the fireworks (ShotToast, divider-heart match moment, and plan-accept deserve equal energy). Physics springs (already the house style), 150–250ms, never blocking.
- **Haptics as language:** light = sent, medium = spent (a Shot), heavy + success = mutual (match, plan accepted). Already mostly true in code — document it and keep it consistent.
- **Photography:** prompts encourage doing-something photos ("you mid-activity") over mirror selfies; profile video moments (VideoMomentPicker exists) get first-class placement.
- **Accessibility floor:** muted text ≥55% white on black, touch targets ≥44pt, labels on all icon buttons. Premium feel dies the moment text is unreadable in sunlight.

---

## 5. User Journey: Match → Chat → Plan → Date

**T0 — The match.** Cinematic moment (built). CTAs: *Send a Message* / **Make a Plan** *(built)* / Keep Discovering. Chemistry receipt shows the why. If either user came via Shot, the original shot message is pinned as the chat's first context.

**T0+2min — The chat.** Opens with context, never blank: shot message, chemistry overlap chips, ghost-composer opener suggestion (built). Date Menu lives one tap away next to the composer. Voice note button equal to text.

**Day 1–2 — The nudge to plan.** If 6+ messages exchanged and no plan: quiet contextual strip "You two should pick a night — see 3 ideas." If a Flare overlaps ("you're both Wynwood Friday"), say so. Anti-ghost nudge (built) escalates to a Date Menu, not just "say something."

**The plan.** Either side proposes from Date Menu, venue pin, event page, or the Plan button (all built or specced). Plan request card with accept/decline (built). On accept: confetti moment + calendar add + the plan appears in both Plans tabs + venue perk unlocked if partnered.

**Day-of.** Morning: "Tonight: Maya, 8pm, Sugar 🥂" with venue details, outfit-weather note, and safety sheet (share plan with a friend — one tap). 2h before: confirm/reschedule prompt to kill no-shows.

**T+24h — Afterglow.** Two-tap debrief. Mutual positive → "Round two?" auto-suggests next plan. Negative → respectful close-out option ("end politely" sends a kind canned message — no ghosting needed). Either way, ranking learns.

**Dead-chat recovery.** 5 quiet days → Both-In question to both → still dead at day 10 → archive with dignity, slot opens in Connect.

---

## 6. Safety & Privacy Rules (non-negotiable)

1. **18+ only** for dating (App Store requires 17+; mixing minors with adults is existential — see COMPETITIVE_PLAN 0.1). DOB enforced server-side.
2. **Location is zonal, never precise.** Heat = aggregates with minimum thresholds (no zone renders under N active users — no inference attacks). Flares = neighborhood + time window only. Exact venue location is shared only inside a mutually accepted plan.
3. **Verification gates the fun.** Liveness-verified badge (camera flow exists); Tonight Mode, Flares, and plan proposals require verification. Unverified accounts can browse and chat — they cannot pull anyone toward real life.
4. **Plan-share.** Every accepted plan: one tap shares who/where/when with a trusted contact; optional auto-share for Tonight Mode plans.
5. **First-date-safe venues.** Partner venues are vetted, public, staff-aware ("Angel shot" protocol). Date Menu defaults to them for first dates.
6. **Report SLA: 24h human review** with an action ladder (warn → restrict → ban) and auto-restrict on report velocity. Block syncs everywhere instantly (block tables exist).
7. **Data rules:** chats E2E-ambition but at minimum encrypted at rest and never used for ads; Afterglow answers are private signals, never shown to the other person beyond mutual-positive; full account deletion in-app (Apple requirement).
8. **No screenshots of safety:** report/block stays one tap from every chat and profile (built — keep it through every redesign).

---

## 7. Monetization — premium that buys outcomes, not vanity

**Principle:** free users can complete the whole loop (match → plan → date) slowly. Plus makes it *faster and richer* — and includes things money can verify in the real world, which no swipe app offers.

**ConnectSphere Plus (single tier, keep it simple):**
- Unlimited Shots (free: 1/day) — the core upsell, already wired to a 402 paywall.
- See your admirers unblurred (reactions paywall — built; let the *first* one through free so the dopamine is real before the gate).
- 3 Flares/week (free: 1), Flare priority in matches' feeds.
- Date Menu+: more options, event pre-sale slots, reservation-style holds at partner venues.
- **Venue perks:** "ConnectSphere date" = waived cover / first-round deal at partners. Real-world value is the premium story competitors can't tell — and venues fund it as customer acquisition.
- Afterglow insights: your dating patterns over time ("you say lowkey, you accept rooftops").

**Not for sale, ever:** seeing someone's location, bypassing verification, boosting past safety filters, or anything that lets paying users impose on non-consenting ones. Premium spice ≠ premium creep.

**Secondary streams (later):** event ticketing affiliate, venue partnership fees, sponsored (clearly labeled) date ideas in the Menu.

---

## 8. Viral & Social Features

- **The plan is the share.** Accepted plans generate a beautiful share card (venue art, neon type, no last names) for stories: *"Friday. Wynwood. 🥂 — planned on ConnectSphere."* Every date is an ad.
- **Public plan pages.** A plan can spawn a web link (no app needed) — used for double-date invites and friend hangouts. Non-users hit a join wall. *(Friends invite system exists to build on.)*
- **"Met on ConnectSphere" at the bar.** The venue perk is redeemed by showing the plan screen — IRL marketing inside nightlife, exactly where the audience is.
- **Weekly Miami Pulse recap** — push + shareable card: "1,214 plans happened in Miami this week. Brickell won." City pride as growth loop.
- **Wing-friend mode.** Friends (friends mode is built) can co-sign a profile with a 10-second voice note ("she's actually this funny") and get notified when their co-signed friend lands a date. Yubo's social energy, pointed at dating outcomes.
- **Launch-night events** — app-RSVP'd parties at partner venues; attendance unlocks a limited profile badge. Scarcity + FOMO + density in one move.

---

## 9. Where Competitors Are Weak (and how to exploit it)

| Competitor | Weakness | ConnectSphere's exploit |
|---|---|---|
| **Tinder** | Volume slot machine; matches are cheap, 90% of chats die; brand = hookup chaos, low trust | Scarcity (One Shot), plan-centric loop, visible safety; "matches that go somewhere" |
| **Bumble** | One mechanic (women first) that adds friction without adding *direction*; chats still die at "hey" | Date Menu + Both-In give every chat a next move; the 24h timer is replaced by a reason to talk |
| **Hinge** | "Designed to be deleted" is marketing — the product still ends at chat; prompts are recycled; zero local utility | The exit ramp actually exists (plans, venues, events); city loop gives utility before/without matches |
| **Raya** | Exclusivity without utility; a velvet rope around the same dead chats; no local depth | Make *the city* the exclusive thing — Miami density as the club anyone can earn into by being real (verified) |
| **All of them** | National-thin; no real-world signal; monetize attention, not outcomes; location features are creepy or absent | Miami-dense; Afterglow outcome data; premium = real-world perks; zonal map that's alive but safe |

---

## 10. Premium, Spicy, Addictive — Without Cheap or Unsafe

**Spice comes from stakes, not skin.** A Shot you can spend once today is spicier than infinite likes. A Flare saying "Friday, Wynwood" is bolder than any bio. Tonight Mode is an adrenaline feature wrapped in verification. Design heat into *consequences*, not into lowering the floor.

**Addictive through anticipation, not interruption.** The dopamine schedule: morning (Both-In question) → evening (Pulse heat + Tonight) → moment-of (Shot landed, plan accepted) → next-day (Afterglow). Four meaningful touches a day beats forty hollow ones — and survives notification fatigue.

**Premium through restraint.** One pink, deep blacks, type discipline, haptic language, celebrations reserved for real moments. Empty states with personality ("Nothing tonight. Brickell's quiet. Thursday won't be."). Never: counters begging for taps, fake "someone liked you" ambiguity spam, streak-shame, or paywalls mid-emotional-moment (gate *before* the reveal, not during).

**The trust paradox, resolved:** the spicier the feature, the heavier the safety rail — Tonight Mode requires verification + public venues + plan-share. That pairing is what lets a 22-year-old's group chat say "it's actually fine, use it" — which is the only marketing that matters.

**The feeling, in one line:** *Tinder feels like scrolling. ConnectSphere should feel like getting ready to go out.*

---

## Appendix — What already exists in the codebase (engineer orientation)

| Concept piece | Existing foundation |
|---|---|
| Pulse Map | `VenueMapView.native/web`, venues + events APIs, saved venues, map tab |
| Plan loop | `plan_request` envelopes, `CreateFriendPlanSheet`, plans backend, plan cards w/ accept/decline, Plan CTAs at match moments |
| One Shot | Shot send/respond APIs, daily limit + 402 paywall, ghost composer, ShotToast |
| Chemistry | VibeCheckQuiz, `computeCompatibility`, VibeBreakdown, chemistry signals on profiles |
| Voice | `VoiceNoteRecorder`, bubble UI (backend = Pass 3 spec) |
| Both-In | Daily Spark notification infra (needs pairing logic) |
| Safety | LivenessCamera, ReportBlockSheet, blocks API, anti-ghost nudge |
| Sequencing | `COMPETITIVE_PLAN.md` Phase 0–2 are prerequisites (18+, JSON-db migration, real-time chat) before Pulse/Flares/Tonight ship |

**Build order recommendation:** Phase 0–1 hardening → Date Menu + Plan CTAs polish (smallest lift, biggest funnel impact) → Pulse heat overlay → Flares + Tonight Mode → Both-In → Afterglow → Concierge.
