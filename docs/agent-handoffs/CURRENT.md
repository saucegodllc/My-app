# Current Claude ↔ Codex handoff

## Update - 2026-07-06 (Codex)

Branch: `codex/remove-stripe-payments`.

Removed Stripe from active ConnectSphere app, API, generated clients, deploy
configuration, and package dependencies. Premium purchases now stay on the
RevenueCat/App Store in-app purchase path, with no web checkout or billing
portal fallback.

**Files changed:**
- `artifacts/connectsphere-mobile/app/premium.tsx` - removed web checkout,
  browser/deep-link success handling, Stripe fallback, and web subscription
  footer links; purchase failures remain in the in-app purchase path.
- `artifacts/connectsphere/src/pages/premium.tsx` and
  `artifacts/connectsphere/src/pages/settings.tsx` - removed web checkout and
  customer portal usage.
- `artifacts/api-server/src/routes/subscriptions.ts`,
  `artifacts/api-server/src/routes/index.ts`, `artifacts/api-server/src/app.ts`,
  and `artifacts/api-server/src/index.ts` - removed Stripe checkout, portal,
  webhook, raw-body, startup sync, and product lookup behavior.
- Deleted Stripe-only API files:
  `artifacts/api-server/src/routes/stripe.ts`,
  `artifacts/api-server/src/routes/stripe.webhook.test.ts`,
  `artifacts/api-server/src/lib/stripeClient.ts`, and the old
  Stripe-grant RevenueCat helper.
- `lib/api-spec/openapi.yaml` plus generated API client/Zod outputs - removed
  checkout and portal endpoints/types.
- `package.json`, `artifacts/api-server/package.json`, `pnpm-lock.yaml`,
  `pnpm-workspace.yaml`, `render.yaml`, and `artifacts/render.yaml` - removed
  Stripe dependencies and Stripe env vars.
- `lib/db/src/schema/profiles.ts` and profile fallback types - removed Stripe
  customer/subscription fields from active app schema usage.

**Verification:**
- `pnpm.cmd --filter @workspace/api-spec run codegen` - generated clients, then
  failed at `typecheck:libs` until stale manual barrel exports were removed.
- `pnpm.cmd run typecheck:libs` - passed.
- `pnpm.cmd --filter @workspace/api-server run typecheck` - passed.
- `pnpm.cmd --filter @workspace/connectsphere-mobile run typecheck` - passed.
- `pnpm.cmd -r --filter "./artifacts/**" --filter "./scripts" --if-present run typecheck` - passed.
- `pnpm.cmd run typecheck` - passed.
- `rg -n "Stripe|stripe|STRIPE|@stripe|stripe-replit-sync|checkout\\.session|web_checkout|Subscribe on Web|Manage on Web|PaymentSheet|payment sheet" -S -g "!artifacts/work-snapshots/**" -g "!**/node_modules/**" -g "!**/.git/**"` - no matches.

**Visual changes:**
- Intentional: mobile premium footer no longer shows web subscription/manage
  links and web premium/settings pages no longer expose checkout/portal billing
  controls.
- Screenshots not captured in this pass.

**Unfinished work / next task:**
- Configure/verify RevenueCat Apple products and entitlement IDs in App Store
  Connect and RevenueCat before submission.

---

## Update - 2026-07-04 (Codex)

Branch: `codex/api-typecheck-fixes`.

Resolved the real API TypeScript failures that were hidden behind the earlier
working-tree corruption/truncation artifacts.

**Files changed:**
- `artifacts/api-server/src/lib/socialStorePersistence.ts` - imports
  `socialStoreTable` from the schema entrypoint so the API no longer depends on
  the root DB package export shape.
- `artifacts/api-server/src/routes/antiGhostNudge.ts` - removed references to
  non-existent `matches.status`, `matches.createdAt`, `matches.lastMessageAt`,
  `matches.lastSenderId`, and `matches.chatId`; derives silence windows from
  `matches.matchedAt` and `chat_messages`.
- `artifacts/api-server/src/routes/dailySpark.ts` - uses `likes` for pending
  reactions and `chat_messages`/`matchedAt` for stale matched chats instead of
  non-existent match columns; passes `Date` values to timestamp comparisons.
- `pnpm-workspace.yaml` - records pnpm 11 build-script approvals so `pnpm`
  commands reach TypeScript instead of stopping at `ERR_PNPM_IGNORED_BUILDS`.

**Verification:**
- `pnpm.cmd --filter @workspace/db exec tsc -p tsconfig.json` - passed.
- `pnpm.cmd --filter @workspace/api-server run typecheck` - passed.
- `pnpm.cmd run typecheck` - passed.
- `pnpm.cmd --filter @workspace/api-server exec jest --runInBand` - failed
  with pre-existing non-touched suite failures: `routes/icebreakers.test.ts`
  unauth expected 401 got 200; `inboxRoutes.test.ts` expected one message got
  zero; `routes/agegate.test.ts` profile/account-delete expectations fail due
  409/500/429 responses and a mocked `db.delete is not a function`. Passing
  suites included `stripe.webhook.test.ts`, `auth401.test.ts`,
  `events.test.ts`, `launchGuards.test.ts`, `discoveryActionHardening.test.ts`,
  `friendsMatchRouting.test.ts`, and `matchThreads.test.ts`.

**Visual changes:** none.

**Unfinished work / next task:**
- Baseline API Jest failures above remain and should be handled on a dedicated
  quality-gates branch; they are unrelated to the API typecheck repair.

---

## Update - 2026-07-03 (Codex)

Regression coverage + deploy guard for the Stripe webhook fix (2c5402e), plus
one webhook behavior guard restored by the re-enabled suite.

**Files changed:**
- `artifacts/api-server/src/routes/stripe.ts` - checkout sessions only grant
  premium when `payment_status === "paid"`.
- `artifacts/api-server/src/routes/stripe.webhook.test.ts` - fixed stale mocks
  for `getStripeClient`, DB premium writes, Stripe customer/subscription calls,
  and current Clerk user identity fields; added regression coverage for:
  1. missing `stripe-signature` header -> 400, `constructEvent`/grant never
     called (the exact bypass in 2c5402e).
  2. missing secret + `NODE_ENV=production` -> 500.
- `artifacts/api-server/jest.config.cjs` - removed `stripe.webhook.test.ts`
  from `testPathIgnorePatterns` so the suite actually runs.
- `artifacts/api-server/scripts/check-production-env.mjs` - already contains
  the production `STRIPE_WEBHOOK_SECRET` requirement on `origin/main`.

**Verification:**
- `pnpm.cmd --filter @workspace/api-server exec jest src/routes/stripe.webhook.test.ts`
  did not reach Jest locally; pnpm stopped on ignored dependency build approvals
  (`ERR_PNPM_IGNORED_BUILDS`).
- Direct package Jest succeeded:
  `artifacts/api-server/node_modules/.bin/jest.CMD src/routes/stripe.webhook.test.ts`
  -> 1 suite passed, 10 tests passed.
- Env guard succeeded: production with `DATABASE_URL` but no
  `STRIPE_WEBHOOK_SECRET` exits 1; adding `STRIPE_WEBHOOK_SECRET=whsec_test`
  exits 0.

**Visual changes:** none.

**Deploy note:** confirm `STRIPE_WEBHOOK_SECRET` is set in Render before the
next API deploy; the env guard intentionally blocks production boot without it.

---

## Update — 2026-07-03 (Claude · TDD follow-up)

Regression coverage + deploy guard for the Stripe webhook fix (2c5402e).

**Files changed (uncommitted on disk — see repo-repair note below):**
- `artifacts/api-server/src/routes/stripe.webhook.test.ts` — fixed the stale
  mock (route calls `getStripeClient`, not `getDirectStripeClient`; suite used
  to 503 on every request), set `STRIPE_WEBHOOK_SECRET` for the test env, and
  added two regression tests:
  1. missing `stripe-signature` header → 400, `constructEvent`/grant never
     called (the exact bypass in 2c5402e).
  2. missing secret + `NODE_ENV=production` → 500.
- `artifacts/api-server/jest.config.cjs` — removed `stripe.webhook.test.ts`
  from `testPathIgnorePatterns` so the suite actually runs.
- `artifacts/api-server/scripts/check-production-env.mjs` — require
  `STRIPE_WEBHOOK_SECRET` when `NODE_ENV=production` (fails boot fast).

**Test commands to run (could NOT execute locally — pnpm symlinks unresolved
in the sandbox):**
- `pnpm --filter @workspace/api-server exec jest src/routes/stripe.webhook.test.ts`
- Env guard (verified locally, plain node):
  `NODE_ENV=production DATABASE_URL=x node scripts/check-production-env.mjs` →
  exits 1 without the secret, 0 with it.

**Expected result:** webhook suite green, including the 2 new regression cases.
If the suite is red for environment reasons, re-add the file to
`testPathIgnorePatterns` and hand back.

**Pre-existing failures (NOT introduced here):** API typecheck errors in
`socialStorePersistence.ts`, `antiGhostNudge.ts`, `dailySpark.ts`. No remaining
`moments.ts` errors.

**Deploy note:** confirm `STRIPE_WEBHOOK_SECRET` is set in Render before the
next API deploy — the new env guard will otherwise block boot by design.

**Visual changes:** none.

---

## Update — 2026-07-02 (Claude)

- **Security fix pushed to shared `main`:** commit `2c5402e`
  `fix(api): reject unverified Stripe webhooks in production`.
- File: `artifacts/api-server/src/routes/stripe.ts` (webhook handler only).
- **What was wrong:** the handler fell through to unverified `JSON.parse`
  whenever the `stripe-signature` header was absent — even with
  `STRIPE_WEBHOOK_SECRET` set. An attacker could omit the header and POST a
  forged `checkout.session.completed` to self-grant premium.
- **Fix behavior now:** secret set + missing/invalid signature → `400`;
  secret missing in production → `500` (refuses to process); unverified parse
  is reachable only outside production (guarded by `isProductionEnv()`).
- **Codex action required:** confirm `STRIPE_WEBHOOK_SECRET` is set in Render
  for the API service. With this fix, a prod deploy WITHOUT the secret now
  hard-fails the webhook by design — subscriptions won't activate until it's
  present. This is the intended safe tradeoff vs. accepting forged events.
- Optional follow-up (not done): add `STRIPE_WEBHOOK_SECRET` to
  `scripts/check-production-env.mjs` so a misconfigured deploy fails at boot
  instead of at first webhook.
- Scope: only `stripe.ts` was committed. Other pre-existing dirty files in the
  working tree were left untouched.

---

## Update — 2026-07-01 (Claude)

- Branch: `main`, commit `2c62395` (`chore: checkpoint session work`) on top of `a35b43d`.
- Committed 29 real dirty files (Sentry wiring for mobile + API, Spark AI chat updates, premium/routing docs, launch audit docs, EAS projectId). No visual changes.
- Note: ~650 files appeared modified due to CRLF/LF line-ending differences only; `core.autocrlf=true` set in repo config, phantom diffs resolved, nothing mangled.
- Pushed `main` to GitHub as `unified-main` (origin/main NOT force-overwritten; it remains legacy history).
- Next: review `unified-main` on GitHub, set it as default branch, verify Render deploys from it, then archive legacy `origin/main`.

## Update - 2026-07-01 (Codex)

- Deployment target: `origin/unified-main` at commit `f47631b`
  (`fix(api): persist db.json social data via Postgres snapshot - survives deploys`).
- Render service to deploy: `connectsphere-api`.
- Render branch/source should be `unified-main`.
- Active deployment config is the root `render.yaml`, whose API build command is
  `pnpm install && pnpm --filter @workspace/db push && pnpm build`.
- That build command should push the `social_store` schema automatically before
  building the API.
- After deploy boot, confirm logs include
  `[socialStore] Backup loop started`. That is the proof that `db.json` social
  data backup/restore is active for plans, interests, and push tokens.
- Verification caveat: local `pnpm run typecheck` could not complete because
  pnpm dependency hydration timed out/missed tarballs before TypeScript ran.
  The commit was still pushed by user request after release-engineer judgment.
- Visual changes: none.

## Current checkpoint

- Branch: `main`
- Application commit: `933636c7c9ed23d5b654a991d40294bf80d232df`
- Workflow/routing commit: `b943ea5` (`docs: unify agent handoff and routing contract`)
- Claude checkpoint included: `4dac179` (`chore: checkpoint claude launch work`)
- Codex follow-up included: `933636c` (`fix: resolve connectsphere launch regressions`)
- Agent: Codex reconciliation
- Date: 2026-06-23

## Goal

Continue one shared ConnectSphere implementation. Claude's committed work is
Codex's starting state, and Codex's committed work is Claude's starting state.

## Changed files

This reconciliation adds shared workflow and handoff documentation. It does not
alter application source, styles, routes, API behavior, or assets.

Routing is now fully described in `docs/architecture/ROUTING.md`: auth guards,
visible and hidden tabs, root stack routes, chat-ID rules, profile fallbacks,
deep links, notifications, AI navigation tokens, premium parameters, and the
required routing-change checklist.

Two previously untracked visual references are preserved with this checkpoint:

- `connectsphere-routing-map.html`
- `connectsphere-plus-paywall-routing.html`

## Functionality

The canonical application remains at `933636c`. No old divergent branch was
merged. Claude checkpoint `4dac179` is an ancestor of the canonical state, so
its code is present rather than represented only by notes.

## Visual changes

None.

## Verification

Before reconciliation:

- The secondary `friends-connect-handoff` worktree was clean.
- `git merge-base --is-ancestor 4dac179 HEAD` passed.
- `git merge-base --is-ancestor 933636c HEAD` passed.

Post-change verification on 2026-06-23:

- `pnpm.cmd run typecheck` — failed in the existing mockup sandbox because two
  React type installations disagree in `calendar.tsx` and `spinner.tsx`.
- Mobile Jest — 30 suites passed, 10 failed, 1 skipped; 426 tests passed,
  59 failed, and 8 skipped. Existing failures include stale component
  assertions, router/AsyncStorage mocks, and analytics capture setup.
- API Jest — 5 suites passed and 2 failed; 55 tests passed and 2 failed.
  Existing failures are the inbox message fixture and unauthenticated
  icebreaker expectation.
- Firebase Functions Jest — 6 tests passed and 2 failed in the existing
  `withdrawReaction` suite.
- Tap audit — failed on five existing controls without handlers in Matches and
  Communities screens.

No failure is in a file changed by this reconciliation. These are now explicit
baseline debts; future agents must not claim they were introduced by the
handoff workflow.

## Unfinished work

- Publish unified `main` safely. Remote `origin/main` is an older divergent
  visual history and must not be force-overwritten.
- Change the GitHub default branch only after unified `main` is pushed and
  reviewed.
- Remove stale branches/worktrees only after archive refs are pushed.
- Future feature work must use `claude/<task>` or `codex/<task>`.

## Next task

Fix the documented baseline test and tap audit debt on a dedicated
`codex/baseline-quality-gates` or
`claude/baseline-quality-gates` branch. Push unified `main` as a reviewed branch
before changing the remote default branch.

## File ownership

- Active owner: Codex
- Owned files: shared workflow documentation and root repository index
- Protected files: all active application files listed in `AGENTS.md`
