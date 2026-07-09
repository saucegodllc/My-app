# ConnectSphere — Launch Readiness Checklist (v2)

**Updated:** 2026-07-04 · **Payments decision locked:** RevenueCat + Apple/Google In-App Purchase for launch; Stripe retired to post-launch web billing.
**How to use:** work top to bottom, phase by phase. Every item has numbered steps. Check off with `- [x]`.

Legend: 🔴 launch blocker · 🟡 should fix before launch · 🟢 post-launch OK

---

## Phase 1 — Environment & config (a few hours — do first)

### - [x] 🔴 1.1 ~~Set `STRIPE_WEBHOOK_SECRET` in Render~~ OBSOLETE 2026-07-06
Stripe was fully removed (`codex/remove-stripe-payments`, commit `eac62c9`) — no webhook, no boot-guard requirement, no Stripe env vars. Premium is RevenueCat/IAP-only. Once that branch deploys, DELETE any STRIPE_* vars from Render.

### - [ ] 🔴 1.2 Run the DB migration (creates `spark_memory`)
1. The Render buildCommand already includes `pnpm --filter @workspace/db push` — it runs on any deploy.
2. If 1.1 triggered a redeploy, this already ran. Otherwise: Render → `connectsphere-api` → Manual Deploy → "Deploy latest commit".
3. Verify: Render → service → Shell tab → run `pnpm --filter @workspace/db push` manually if unsure — it's idempotent.
4. Confirm: in the Shell, `psql $DATABASE_URL -c "SELECT 1 FROM spark_memory LIMIT 1;"` returns without "relation does not exist".

### - [ ] 🔴 1.3 Verify every Render env var is set with LIVE values
1. Render → `connectsphere-api` → Environment. Confirm each exists and is the production value (list updated 2026-07-06 post-Stripe-removal, matches render.yaml):
   - `DATABASE_URL`, `CLERK_SECRET_KEY` (live instance `sk_live_...`), `ANTHROPIC_API_KEY`, `TICKETMASTER_API_KEY`, `CRON_SECRET`, `REVENUECAT_API_SECRET_KEY`, `SENTRY_DSN` (optional but recommended), `EVENTS_USE_MOCKS=false`.
2. Delete any `STRIPE_*` vars once `codex/remove-stripe-payments` is deployed.
3. Any missing: add it. Never paste secrets into chat/code — only into Render's Environment tab.

### - [ ] 🔴 1.4 Verify cron job env vars
1. Render → `connectsphere-daily-spark` service → Environment: set `API_BASE_URL` (e.g. `https://connectsphere-api.onrender.com`) and `CRON_SECRET` (must equal the API server's).
2. Repeat for `connectsphere-anti-ghost`.
3. After next scheduled run, check each cron's Logs for a 200 response.

### - [ ] 🟡 1.5 Confirm health + crons are green
1. Open `https://<your-api>.onrender.com/api/healthz` in a browser → expect 200/OK.
2. Render → each cron → Events: last run succeeded.
3. Optional: trigger manually — `curl -X POST "$API_BASE_URL/api/notifications/daily-spark/broadcast" -H "x-cron-secret: $CRON_SECRET"`.

---

## Phase 2 — Media storage rewrite 🔴 (BROKEN IN PROD — days)

`artifacts/api-server/src/lib/objectStorage.ts` gets credentials from the Replit sidecar (`http://127.0.0.1:1106`), which doesn't exist on Render. Photo uploads fail in production.

### - [ ] 🔴 2.1 Pick a provider — recommended: Cloudflare R2
1. R2 is S3-compatible with $0 egress (photos get viewed a lot — egress is the cost that bites dating apps). Alternatives: AWS S3, GCS.
2. Create a Cloudflare account → R2 → Create bucket `connectsphere-media`.
3. R2 → Manage API Tokens → Create token with Object Read & Write on that bucket. Save the Access Key ID, Secret Access Key, and account endpoint URL.

### - [ ] 🔴 2.2 Rewrite `objectStorage.ts` to use the S3 SDK
1. `pnpm --filter @workspace/api-server add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`.
2. In `artifacts/api-server/src/lib/objectStorage.ts`: replace the sidecar credential code with an `S3Client` configured from env (`S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_REGION=auto` for R2).
3. Keep the same exported class/methods (`getObjectEntityUploadURL`, `normalizeObjectEntityPath`, download stream) so `src/routes/storage.ts` and the mobile client need zero changes.
4. Presigned PUT for uploads (15-min expiry); presigned GET (or public bucket path) for reads.
5. Delete all `REPLIT_SIDECAR_ENDPOINT` references.

### - [ ] 🔴 2.3 Set storage env vars in Render
1. Render → `connectsphere-api` → Environment: add `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_REGION`.
2. Add them to `render.yaml` as `sync: false` entries so the config is documented.
3. Remove/ignore old `PRIVATE_OBJECT_DIR` / `PUBLIC_OBJECT_SEARCH_PATHS` unless you reuse the names.

### - [ ] 🟡 2.4 Server-side upload validation
1. In `src/routes/storage.ts`, before issuing a presigned URL: validate requested `contentType` against an allowlist (`image/jpeg`, `image/png`, `image/webp`, `image/heic`) and reject others with 400.
2. Include `ContentLength`/size condition in the presigned URL (max 10 MB) so the storage layer enforces it.

### - [ ] 🟡 2.5 EXIF strip + resize pipeline
1. `pnpm --filter @workspace/api-server add sharp`.
2. Add a post-upload processing endpoint or background step: download original → `sharp().rotate().resize(1080, null).jpeg({ quality: 82 })` → re-upload; sharp drops EXIF (incl. GPS) by default unless `.withMetadata()` is used — do NOT use `.withMetadata()`.
3. Store the processed variant path on the profile; keep or delete the original per your retention policy.

### - [ ] 🟡 2.6 End-to-end test
1. TestFlight/dev build → onboarding → upload a photo.
2. Confirm: photo appears on your profile → appears in another account's Discover deck → survives a Render redeploy.
3. Download the served image and confirm EXIF GPS is gone (`exiftool photo.jpg`).

### - [ ] 🟢 2.7 CDN in front of public photos (R2 + Cloudflare CDN is nearly free).

---

## Phase 3 — Payments: RevenueCat + Apple/Google IAP ✅ DECIDED

**Why:** Apple requires IAP for digital subscriptions purchased in-app; this removes your biggest rejection risk. **Margin:** enroll in Apple's Small Business Program → 15% commission (not 30%) under $1M/yr. Stripe code stays for a post-launch web signup (web sales skip Apple's cut — long-term margin play).

### - [ ] 🔴 3.1 Enroll in the reduced-commission programs
1. App Store Connect → Business (Agreements) → App Store Small Business Program → enroll (requires active Paid Apps agreement + tax/banking done).
2. Google Play Console: the 15% tier on the first $1M is automatic once enrolled in Play's 15% service-fee tier — confirm in Play Console → Financial reports → service fee.

### - [ ] 🔴 3.2 Create subscription products in App Store Connect
1. App Store Connect → your app → Monetization → Subscriptions → create ONE subscription group "ConnectSphere Plus" (one group = upgrades/downgrades work).
2. Add three auto-renewable subscriptions:
   - `plus_biweekly` — $14.99 / 2 weeks
   - `plus_sixmonth` — $150 / 6 months
   - `plus_yearly` — $300 / year
3. Fill in localized display names + descriptions; add review screenshot for each; submit products with the app binary later.
4. Mirror in Google Play Console → Monetize → Subscriptions (same product IDs, base plans for each duration).

### - [ ] 🔴 3.3 Set up the RevenueCat project
1. app.revenuecat.com → create project "ConnectSphere".
2. Add iOS app (bundle ID from `app.json`) + Android app (package name). Upload the App Store Connect API key and Play service credentials RC asks for.
3. Products: import `plus_biweekly`, `plus_sixmonth`, `plus_yearly` from both stores.
4. Entitlements: create one entitlement `plus`; attach all products.
5. Offerings: create `default` offering with three packages (Annual, Six Month, Custom/biweekly) so the paywall can fetch them dynamically.

### - [ ] 🔴 3.4 Activate the RC-first path in the app
1. `artifacts/connectsphere-mobile/app/premium.tsx` already has an RC-first flow that falls through to Stripe — flip it to RC-only on iOS/Android:
   - Configure the SDK at app start (in `_layout.tsx`): `Purchases.configure({ apiKey: EXPO_PUBLIC_REVENUECAT_IOS_KEY, appUserID: user.id })` (Clerk `user.id` as appUserId — the file already treats it as the authority).
   - Fetch offerings → render the three plan cards from RC packages (prices come from the store, correctly localized).
   - `handleCheckout` → `Purchases.purchasePackage(pkg)` → on success `syncFromCustomerInfo()`.
2. **Remove the Stripe web-checkout fallback and the "Manage on Web" Stripe-portal link from the mobile build** — Apple must not see an external purchase path at review. Guard with platform check if you keep code for web.
3. Add `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `..._ANDROID_KEY` (public SDK keys — safe for client) to eas.json `preview` and `production` profiles.
4. Restore purchases button → `Purchases.restorePurchases()` (already scaffolded — verify it works without RC "not ready" fallback alerts).

### - [ ] 🔴 3.5 Wire RevenueCat webhooks → API (Postgres stays source of truth)
1. RevenueCat → Project → Integrations → Webhooks → URL: `https://<your-api>.onrender.com/api/revenuecat/webhook`; set an Authorization header value.
2. Create `artifacts/api-server/src/routes/revenuecat.ts`:
   - Verify the Authorization header against `REVENUECAT_WEBHOOK_AUTH` env var (add to Render + render.yaml).
   - Handle event types: `INITIAL_PURCHASE`, `RENEWAL`, `UNCANCELLATION` → set premium; `EXPIRATION`, `CANCELLATION` (at period end), `BILLING_ISSUE`, `REFUND` → schedule/remove premium.
   - Reuse the existing `setDbPremium()` logic from `stripe.ts` (extract to a shared lib) writing `isPremium` + expiry to `profilesTable`.
3. Register the route in `src/routes/index.ts`; add tests mirroring `stripe.webhook.test.ts` (auth header missing → 401, unknown event → 200 no-op, purchase event → premium granted).

### - [ ] 🔴 3.6 Remove fake strikethrough pricing
1. In `premium.tsx`, delete the "~~$390~~ → $300" and "~~$180~~ → $150" flash-sale strikethroughs and the "flash sale" badge — reference prices that were never charged risk rejection + FTC exposure.
2. Real promos later: use App Store intro offers / RC promotional offers instead.

### - [ ] 🔴 3.7 Sandbox test the full cycle (TestFlight)
1. Create a Sandbox tester in App Store Connect → Users and Access → Sandbox.
2. On a TestFlight build: purchase each plan → entitlement `plus` active in app → `isPremium=true` in Postgres (check via API `/api/subscriptions` or DB) → premium features unlock (likes-you, unlimited Spark).
3. Delete + reinstall the app → Restore Purchases → entitlement returns.
4. Cancel in Settings → subscription shows cancelled → expires at period end → `isPremium` flips false (sandbox renews in minutes, so this is testable same-day).

### - [ ] 🟡 3.8 "Manage subscription" for IAP users
1. Route to Apple's management screen: `Linking.openURL("https://apps.apple.com/account/subscriptions")` (or `Purchases.showManageSubscriptions()`), not the Stripe portal.

### Post-launch 🟢 (moved out of the critical path)
- [ ] 🟢 Stripe web billing — keep the hardened webhook + checkout for a future web signup (skips Apple's cut). Already secure; nothing to do now.
- [ ] 🟢 US external-purchase-link option (post-Epic ruling) — revisit at volume as a margin optimization.
- [ ] 🟢 RC promo codes / win-back offers.

---

## Phase 4 — Backend: facade features (cut or commit)

### Moments — backend is in-memory Maps; all data wiped every deploy

### - [x] 🔴 4.1 DECIDE: ship Moments in v1 or hide the tab
1. DECIDED 2026-07-06: SHIP — proceed with 4.2–4.5.

### - [ ] 🔴 4.2 Create Postgres tables for Moments
1. New file `lib/db/src/schema/moments.ts` with three tables:
   - `moments` (id, userId, text, location, userDisplayName, userPhotoUrl, createdAt, expiresAt)
   - `moment_likes` (id, momentId, userId, userDisplayName, userPhotoUrl, createdAt; unique on momentId+userId)
   - `moment_requests` (id, momentId, fromUserId, toUserId, message, status, createdAt)
2. Export from `lib/db/src/schema/index.ts`.
3. Migration runs on next deploy (buildCommand `db push`).

### - [ ] 🔴 4.3 Replace the Map stores in `moments.ts`
1. In `artifacts/api-server/src/routes/moments.ts`, replace `momentStore`, `requestStore`, `likeStore` Maps with Drizzle queries.
2. Use the select-builder pattern only (`db.select().from(...)`) — never `db.query.*` (per CLAUDE.md).
3. Keep every route's request/response shape identical — the mobile client is already wired and must not change.

### - [ ] 🟡 4.4 Smoke test Moments end-to-end
1. Post a moment → appears in another user's feed → like → reply → request → accept (navigates to profile) → decline.
2. Redeploy the API → confirm moments survive.

### - [ ] 🟡 4.5 Echo button — build or remove
1. It currently shows "coming soon". Apple rejects visible dead features: either implement reshare or delete the button in `app/(tabs)/moments.tsx` (keep the handler code commented on a branch).

### Communities — zero backend exists

### - [x] 🔴 4.6 DECIDE: build or hide — DECIDED 2026-07-06: BUILD (dedicated branch, after Phase 1–3 blockers)
1. Hide: remove the Communities tab from `app/(tabs)/_layout.tsx` and the `communities/*` Stack.Screen entries from `app/_layout.tsx`; branch the code.
2. Build (full product's worth of work): tables `communities`, `community_members`, `community_posts`, `community_replies`; CRUD routes; moderation hooks; replace `SEED_COMMUNITIES` in `app/(tabs)/communities.tsx` with API calls.

### Social store — db.json flat file

### - [ ] 🟡 4.7 Migrate db.json entities to Postgres
1. Scope: plans, plan members, join requests, event interests, push tokens (read/written by ~10 route files: dating, friends, events, matches, notifications, profiles, doubleDate, discovery, account, reports).
2. Do on a dedicated branch with the test suite green first (this was deliberately deferred — respect that sequencing).
3. Create proper tables in `lib/db/src/schema/`, write a one-time import script reading the current `social_store` snapshot row, convert routes file-by-file, keep the snapshot layer until the last route is converted, then delete it.

### Firestore consolidation — two databases, one half-configured

### - [ ] 🟡 4.8 DECIDE: consolidate on Postgres (recommended) or fully provision Firebase
1. Affected screens (silently empty without `EXPO_PUBLIC_FIREBASE_*` vars): `likes-you.tsx`, `profile-views.tsx`, `referral.tsx`, `invite/[code].tsx`, `u/[username].tsx`, `services/connections/`.
2. **Postgres path:** add API endpoints — `GET /api/likes-you` (query `likesTable` where target=me, no match yet), `GET /api/profile-views` (new `profile_views` table + record-view endpoint), referral/invite tables. Repoint each screen to `connectApi`; delete the Firestore read paths.
3. **Firebase path:** create the project, set all 6 `EXPO_PUBLIC_FIREBASE_*` vars in eas.json profiles, write Firestore security rules (locked to authed users), add Firestore to backup + deletion processes.
4. Note: you need a Firebase project anyway for push (Phase 7) — but that does NOT require using Firestore as a database.

---

## Phase 5 — Database

### - [ ] 🔴 5.1 Confirm `spark_memory` exists in prod (done in 1.2 — re-verify here).

### - [ ] 🟡 5.2 Add indexes on hot paths
1. In schema files, confirm/add: `likes` composite index (likedUserId, userId); `matches` indexes on userId1 and userId2; `messages` composite (matchId, createdAt).
2. Deploy (db push applies them). Verify with `\d messages` in psql.

### - [ ] 🟡 5.3 Add tables decided in Phase 4 (moments, social store, likes-you/profile-views if Postgres path).

### - [ ] 🟡 5.4 Check Postgres plan limits
1. Provider dashboard → max connections vs. your pool size; storage tier; connection pooling (pgBouncer) if on a small plan.

### - [ ] 🟢 5.5 Separate staging database.

---

## Phase 6 — Authentication (Clerk)

### - [ ] 🔴 6.1 Confirm live keys end-to-end
1. Render `CLERK_SECRET_KEY` starts `sk_live_` and belongs to the SAME Clerk instance as the `pk_live_` publishable key in eas.json (Clerk Dashboard → API Keys — instance name must match).

### - [ ] 🟡 6.2 Enable abuse protection
1. Clerk Dashboard → your instance → Attack protection: enable bot detection on sign-up, email verification requirements, and rate limits.

### - [ ] 🟡 6.3 Session policy
1. Clerk Dashboard → Sessions: set session lifetime + inactivity timeout appropriate for a consumer app (e.g., 7-day inactivity, 30-day max).

### - [ ] 🟡 6.4 Delete/re-signup cycle test
1. Create account → complete onboarding → Settings → delete account → confirm Clerk user gone (Clerk Dashboard → Users) → sign up again with the same email → clean onboarding, no orphaned profile data.

### - [ ] 🟢 6.5 Review Clerk MFA options.

---

## Phase 7 — Messaging & push notifications

### - [ ] 🔴 7.1 Add Firebase push config files
1. Firebase Console → create project (or reuse from 4.8) → add iOS app (your bundle ID) → download `GoogleService-Info.plist`.
2. Add Android app (package name) → download `google-services.json`.
3. Place both in `artifacts/connectsphere-mobile/` and reference them in `app.json` (`ios.googleServicesFile`, `android.googleServicesFile`).
4. Rebuild with EAS (config files bake in at build time).

### - [ ] 🔴 7.2 QA push end-to-end on real devices
1. Register devices: `eas device:create`; build: `eas build --platform ios --profile preview`.
2. Test each notification type lands AND routes correctly on tap (cold start + backgrounded): new message → chat; match → chat; plan invite → chat; daily spark (trigger cron manually per 1.5) → discover/matches; anti-ghost nudge → the silent chat.

### - [ ] 🟡 7.3 Restrict Socket.io CORS
1. `artifacts/api-server/src/socket.ts`: change `cors.origin: true` to an allowlist from env (native apps aren't CORS-bound, so this only needs your web origins — e.g., admin dashboard URL).

### - [ ] 🟡 7.4 Offline delivery test
1. Recipient force-quits app → sender sends message → push arrives → tap → correct chat with the message present → unread badge cleared.

### - [ ] 🟡 7.5 Unread-state persistence test (restart app; counts survive).

### - [ ] 🟢 7.6 Read receipts / typing indicator polish.

---

## Phase 8 — Moderation & trust/safety

### - [ ] 🔴 8.1 Verify the admin web UI actually works
1. Run `artifacts/connectsphere` (Vite app) locally; log in as an admin user.
2. Confirm you can: see the report queue (`/moderation/reports`), open a report, suspend a user, ban a user, view the audit log.
3. Anything not wired → wire it. Reports going unread is a real-world safety failure and an App Review question.

### - [ ] 🔴 8.2 Role-check all admin/moderation routes
1. In `src/routes/reports.ts`, audit `/moderation/*` and `/admin/*`: each must verify an admin role (e.g., Clerk `publicMetadata.role === "admin"` or an allowlist), not just `getAuth(req).userId`.
2. Add a test: normal authed user hitting `/admin/reports` → 403.

### - [ ] 🔴 8.3 Automated photo scanning at upload
1. Pick a scanner: AWS Rekognition (moderation labels), Hive, or Azure Content Safety.
2. Hook into the Phase 2.5 processing step: scan each uploaded image → nudity/sexual content → reject or quarantine + flag to admin queue; CSAM indicators → block + preserve evidence per NCMEC reporting obligations.
3. Store scan verdict with the photo record.

### - [ ] 🟡 8.4 Text screening on messages/moments
1. Minimum: keyword/slur blocklist filter server-side on message + moment create.
2. Better: async classifier (e.g., OpenAI moderation endpoint — already have OpenAI integration in `resume.ts`) flagging to the admin queue rather than hard-blocking.

### - [ ] 🟡 8.5 DECIDE: selfie/liveness verification in v1 (recommended: yes)
1. Schema `liveness_nonces` exists; flow doesn't. Options: build simple selfie-pose-match (issue nonce → user photographs pose → manual/AI compare) or integrate a vendor (Persona, Veriff).
2. Gate: verified badge on profile; optionally require verification before messaging.

### - [ ] 🟡 8.6 Write the moderation policy + SLA
1. One page: what's prohibited, report review target (24h), escalation path, ban criteria. App Review may request it; investors will.

### - [ ] 🟡 8.7 Verify the UGC trio end-to-end
1. Report a user → appears in admin queue. Block → they vanish from Discover/messages both directions. Ban via admin → banned user is signed out/blocked from the app (test what actually happens — likely needs a check on session/API).

---

## Phase 9 — Security controls

### - [ ] 🟡 9.1 Lock down Express CORS
1. `src/app.ts`: replace permissive `cors()` config with an env-driven origin allowlist (admin dashboard URL, marketing site). Native apps don't send Origin, so they're unaffected.

### - [ ] 🟡 9.2 Dependency audit
1. `pnpm audit` at repo root → fix high/critical (`pnpm audit --fix`, or targeted updates). Re-run tests.

### - [ ] 🟡 9.3 Secret scan + repo hygiene
1. Run gitleaks: `docker run -v $(pwd):/repo zricethezav/gitleaks detect -s /repo` (or the binary).
2. Rotate anything found (Clerk, Stripe, Ticketmaster keys).
3. Purge junk from git history: the ~300MB ZIPs and all `api-runner-*.log` / `*.transcript.log` files — use `git filter-repo`, then force-push (coordinate with Codex/other agents first per AGENTS.md).
4. Add `*.log`, `*.zip` to `.gitignore`.

### - [ ] 🟡 9.4 Fix pre-existing typecheck errors, gate CI
1. Fix TS errors in `socialStorePersistence.ts`, `antiGhostNudge.ts`, `dailySpark.ts`.
2. Add typecheck + tests to GitHub Actions so red builds can't deploy.

### - [ ] 🟡 9.5 Rate limiting: document or upgrade
1. Current limits are in-process Maps (reset on restart, per-instance). Fine for one Render instance — write that constraint down. If scaling to 2+ instances: move to Redis (Upstash free tier works).

### - [ ] 🟢 9.6 External pen test / structured security review before the marketing push.

---

## Phase 10 — Analytics & observability

### - [ ] 🔴 10.1 Configure Sentry + PostHog keys
1. sentry.io → create React Native project → copy DSN. posthog.com → project API key.
2. Add `EXPO_PUBLIC_SENTRY_DSN` and `EXPO_PUBLIC_POSTHOG_API_KEY` to eas.json `production` (and `preview`) env — SDKs are already installed and auth-synced in `_layout.tsx`.
3. Build → force a test crash + a test event → confirm both arrive in dashboards.

### - [ ] 🔴 10.2 Instrument the core funnel
1. Define events: `sign_up`, `onboarding_complete`, `first_swipe`, `match_created`, `first_message_sent`, `shot_sent`, `paywall_viewed`, `subscription_started`.
2. Fire each from the obvious spot (onboarding completion handler, swipe handler in `(tabs)/index.tsx`, `ShotBottomSheet` send, `premium.tsx` mount + purchase success).
3. Include `plan` property on subscription events. These are the numbers investors ask for — no funnel, no traction story.

### - [ ] 🟡 10.3 Sentry on the API server
1. `pnpm --filter @workspace/api-server add @sentry/node` → init in `src/index.ts` with `SENTRY_DSN` env var → add the error handler middleware after routes.

### - [ ] 🟡 10.4 PostHog dashboards: D1/D7/D30 retention, funnel conversion, paywall→subscribe rate.

### - [ ] 🟢 10.5 Uptime monitor on `/api/healthz` (UptimeRobot free) with email/SMS alert.

---

## Phase 11 — Backups & recovery

### - [ ] 🔴 11.1 Confirm Postgres backups exist
1. Check your provider + plan tier. Render Postgres: backups require a paid plan — verify Dashboard → your DB → Backups shows daily snapshots. If on free tier: upgrade or migrate (Neon/Supabase have PITR on cheap tiers).

### - [ ] 🔴 11.2 Do one test restore
1. Restore latest backup to a NEW database instance → connect psql → verify row counts on `profiles`, `matches`, `messages`. Never trust an unrestored backup.

### - [ ] 🟡 11.3 Media bucket versioning (after Phase 2): enable object versioning or scheduled bucket replication.

### - [ ] 🟡 11.4 Write the recovery runbook
1. One page: backup locations, restore steps (copy the exact commands from 11.2), who does it, RTO target (e.g., 4h), where env-var copies live.

### - [ ] 🟡 11.5 Reminder: `db.json`'s 30s snapshot is the ONLY social-store backup until 4.7 lands.

---

## Phase 12 — Privacy & legal

### - [ ] 🔴 12.1 Host lawyer-reviewed Privacy Policy + Terms at public URLs
1. Get the in-app drafts (`app/legal/privacy.tsx`, `terms.tsx`) reviewed by a lawyer (dating app + Florida + minors-exclusion language).
2. Host at e.g. `connectsphere.app/privacy` and `/terms` (a static page is fine).
3. App Store Connect requires the privacy URL at submission; link the hosted versions from the in-app screens too.

### - [ ] 🟡 12.2 Extend the account-deletion cascade
1. `/account/delete` in `src/routes/account.ts` currently removes: messages, matches, blocks, unreviewed reports, profile, db.json records, Clerk user.
2. Add: stored photos (delete objects from the bucket), moments + likes + requests (after 4.2), Stripe customer (`stripe.customers.del`) / RC subscriber deletion, Firestore docs (if Firebase path chosen), spark_memory rows, push tokens.
3. Test: delete an account → verify each store is empty for that userId.

### - [ ] 🟡 12.3 Data-retention policy
1. Document what `RETAINED_DATA` keeps after deletion (reviewed reports, audit log) and for how long (e.g., 12 months). Make the code and privacy policy say the same thing.

### - [ ] 🟡 12.4 Age gate verification
1. Confirm signup requires DOB and hard-blocks under-18 (agegate tests exist — run them: `jest src/routes/agegate.test.ts`).
2. Document the approach (self-attested DOB = industry floor for launch).

### - [ ] 🟡 12.5 Verify `/account/export` completeness
1. Export your own account → confirm it includes profile, matches, messages, moments, subscription status. Add anything missing.

### - [ ] 🟢 12.6 CCPA/FDUTPA review (Florida-based, Miami market).

---

## Phase 13 — App Store / Play Store submission

### - [ ] 🔴 13.1 Fill eas.json placeholders
1. App Store Connect → create the app record → copy the numeric App ID → replace `REPLACE_WITH_APP_STORE_CONNECT_APP_ID` in `artifacts/connectsphere-mobile/eas.json`.
2. developer.apple.com → Membership → copy Team ID → replace `REPLACE_WITH_APPLE_TEAM_ID`.

### - [ ] 🔴 13.2 Play Store service account
1. Google Cloud Console → create service account → grant Play Console access (Release manager) → download JSON key → save as `google-play-service-account.json` in the mobile dir (git-ignored!) → reference in eas.json submit profile.

### - [ ] 🔴 13.3 No facade features in the review build
1. Verify Phase 4 decisions are executed: Communities hidden or real; Echo built or removed; Moments persistent or hidden.

### - [ ] 🔴 13.4 IAP live in the review build (Phase 3 complete; subscription products submitted WITH the binary).

### - [ ] 🟡 13.5 App Privacy questionnaire
1. App Store Connect → App Privacy: declare exactly what's collected — identity (Clerk), photos, location, messages, usage data (PostHog), diagnostics (Sentry), purchases (RC). Under-declaring is a rejection + trust risk.

### - [ ] 🟡 13.6 Dating-app review prep
1. Create a reviewer demo account seeded with profiles, matches, and a conversation; put credentials in App Review notes.
2. Attach the moderation policy (8.6) and describe the report/block/ban flow in review notes — dating apps get the UGC interrogation.

### - [ ] 🟡 13.7 TestFlight round
1. `eas device:create` for each tester → `eas build --platform ios --profile preview` → full pass: onboarding, swipe, match, chat, shot, moments, events, purchase (sandbox), push.

### - [ ] 🟡 13.8 Accessibility pass
1. One session: add `accessibilityLabel` to all interactive elements (swipe rail, tab bar, sheets); test with VoiceOver enabled.

### - [ ] 🟡 13.9 Store assets: screenshots (6.7" + 5.5"), preview video, description, keywords, category (Lifestyle or Social Networking — dating requires 17+ rating).

### - [ ] 🟢 13.10 Google Play pre-launch report review.

---

## Business decisions (decide once, unblock many)

- [x] **Payments** — DECIDED 2026-07-04: RevenueCat + Apple/Google IAP for launch; Stripe → post-launch web billing (Phase 3 rewritten).
- [x] **Moments: ship or hide** — DECIDED 2026-07-06: SHIP. Move backend to Postgres (4.2–4.4).
- [x] **Communities: build or hide** — DECIDED 2026-07-06: BUILD. Full backend per 4.6 build path. ⚠️ Largest scope add in this checklist — sequence after Phases 1–3 blockers; do on a dedicated branch.
- [x] **Firestore vs Postgres** — DECIDED 2026-07-06: Postgres. Likes-you/profile-views/referral screens get API endpoints (4.8 Postgres path); Firebase remains push-only.
- [ ] **Selfie verification in v1?** (gates 8.5) — recommended: yes
- [ ] **Miami-only launch commitment** (stops multi-market abstraction work)
- [ ] **North-star metric** (gates 10.2) — suggested: shots sent → conversations started

---

## Quick-reference: file map

| Area | Key files |
|---|---|
| Media storage (broken) | `artifacts/api-server/src/lib/objectStorage.ts`, `src/routes/storage.ts` |
| Paywall / RC activation | `artifacts/connectsphere-mobile/app/premium.tsx`, `app/_layout.tsx`, `eas.json` |
| RC webhook (new) | `artifacts/api-server/src/routes/revenuecat.ts` (create), reuse `setDbPremium` from `stripe.ts` |
| Moments (in-memory) | `artifacts/api-server/src/routes/moments.ts`, new `lib/db/src/schema/moments.ts` |
| Communities (UI only) | `artifacts/connectsphere-mobile/app/(tabs)/communities.tsx`, `app/(tabs)/_layout.tsx` |
| Social store (db.json) | `artifacts/api-server/src/lib/socialStorePersistence.ts` |
| Firestore screens | `app/likes-you.tsx`, `app/profile-views.tsx`, `app/referral.tsx`, `app/invite/[code].tsx`, `app/u/[username].tsx`, `services/connections/` |
| Socket CORS | `artifacts/api-server/src/socket.ts` |
| Express CORS/headers | `artifacts/api-server/src/app.ts` |
| Admin/moderation | `artifacts/api-server/src/routes/reports.ts`, `artifacts/connectsphere` (web) |
| Account deletion/export | `artifacts/api-server/src/routes/account.ts` |
| Deploy config | `render.yaml`, `artifacts/connectsphere-mobile/eas.json` |
