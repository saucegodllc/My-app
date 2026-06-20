# Deploy Checklist: ConnectSphere — App Store + Play Store Submission
**Date:** 2026-06-08 | **Stack:** Expo SDK 54 · Expo Router v6 · Express 5 (Render.com) · Clerk · Stripe · RevenueCat · Ticketmaster

---

## PART 1 — API Server (Render.com) — Deploy First

### Pre-Deploy: Environment Variables
- [ ] `TICKETMASTER_API_KEY` is set in Render dashboard (never in source code)
- [ ] `EVENTS_USE_MOCKS=true` is set in Render env vars (safety net so Events tab is never empty)
- [ ] `EVENTS_FAIL_RETRY_MS=900000` is set (15-min retry on TM failure)
- [ ] `CLERK_SECRET_KEY` is set (live key, not test key)
- [ ] `DATABASE_URL` points to production database
- [ ] `CRON_SECRET` matches the value in both daily-spark-cron and anti-ghost cron services
- [ ] `REVENUECAT_API_SECRET_KEY` is set
- [ ] `STRIPE_SECRET_KEY` is the **live** key (sk_live_…), not test
- [ ] `STRIPE_WEBHOOK_SECRET` matches the Stripe dashboard webhook endpoint
- [ ] `NODE_ENV=production` is set
- [ ] No `.env.local` secrets accidentally committed to git

### Pre-Deploy: Code
- [ ] All unit tests passing locally (`pnpm test`)
- [ ] `pnpm build` completes without errors (`dist/` generated)
- [ ] No TypeScript errors (`pnpm tsc --noEmit`)
- [ ] `db.json` is the **production** seed file (not local dev data with test user IDs)
- [ ] `render.yaml` is committed and up to date (reflects all env vars above)

### Deploy API
- [ ] Push to `friends-connect-handoff` branch (or merge to main per your deploy branch)
- [ ] Render auto-deploy triggers (or manually trigger from Render dashboard)
- [ ] Watch build logs — confirm `pnpm install && pnpm build` succeeds
- [ ] Wait for "Live" status in Render dashboard

### Post-Deploy: API Smoke Tests
Run these against `https://connectsphere-api.onrender.com`:

- [ ] `GET /api/events` → returns `{ events: [...], loading: false, tmCount: N }` — not empty
- [ ] `GET /api/events/context/:userId?sourceIds=fallback-1` → returns `{ contexts: [...] }`
- [ ] `GET /api/conversations/:userId` → returns array (may be empty for fresh user)
- [ ] Ticketmaster events appear OR mock fallback events appear (either is fine — never both empty)
- [ ] No 500 errors in Render logs for first 5 minutes after deploy

### Rollback Triggers (API)
- Any `GET /api/events` returns `{ events: [] }` — Events tab is broken
- Any auth route returns 500 instead of 401 for unauthenticated requests
- Render logs show repeated unhandled promise rejections
- Cold-start response time exceeds 30 seconds (free tier spin-up)

---

## PART 2 — Mobile App (EAS Build → App Store / Play Store)

### Pre-Build: Config Checks
- [ ] `app.config.js` / `app.json` — `version` and `buildNumber` / `versionCode` incremented
- [ ] `API_BASE_URL` in app config points to production Render URL (not localhost)
- [ ] **No secret keys** in `app.config.js`, `eas.json`, or any source file
- [ ] All Expo public env vars (`EXPO_PUBLIC_*`) are safe to ship (no secrets)
- [ ] Push notification credentials configured in EAS (APNs for iOS, FCM for Android)
- [ ] `eas.json` production profile is set to `"distribution": "store"`

### Pre-Build: Feature Flags
- [ ] `CONNECTSPHERE_FEATURE_EVENTS_LIVE_PROVIDERS` — confirm intended value before shipping
- [ ] `CONNECTSPHERE_FEATURE_PREMIUM=true` — Stripe + RevenueCat flows are live
- [ ] `CONNECTSPHERE_FEATURE_PUSH=true` — push notifications wired up
- [ ] `CONNECTSPHERE_FEATURE_DOUBLE_DATE=true` — double date feature enabled
- [ ] `CONNECTSPHERE_FEATURE_AI_BIO=true` — AI bio generation enabled

### Pre-Build: Quality Gates
- [ ] All Jest tests passing (`npx jest` in `connectsphere-mobile/`)
- [ ] ExpandedProfileCard tests: 35/35 passing
- [ ] No red TypeScript errors in the mobile project
- [ ] No `console.error` calls that indicate broken flows in the app
- [ ] Test on physical iPhone (not just simulator) — gestures, swipe deck, camera
- [ ] Test on physical Android device — back button behavior, keyboard handling

### Pre-Build: App Store Assets
- [ ] App icon is final (1024×1024, no alpha channel for iOS)
- [ ] Splash screen is final
- [ ] Screenshots captured for all required device sizes (iPhone 6.7", 6.5", iPad)
- [ ] Android screenshots captured (phone + 7" tablet)
- [ ] App description, keywords, and privacy policy URL are final
- [ ] Age rating questionnaire completed in App Store Connect
- [ ] Privacy nutrition labels match actual data collection

### Build
```bash
# iOS
eas build --platform ios --profile production

# Android
eas build --platform android --profile production
```
- [ ] iOS build completes without errors (check EAS dashboard)
- [ ] Android build completes without errors
- [ ] Download both builds and install locally for final smoke test

### Final Smoke Test (production build, production API)
Go through each flow manually on the production build:

| Flow | Result |
|------|--------|
| Sign up → onboarding → profile created | ☐ Pass / ☐ Fail |
| Discover → swipe vibe → match modal | ☐ Pass / ☐ Fail |
| Match → tap Message → chat opens | ☐ Pass / ☐ Fail |
| Send a message → appears in chat thread | ☐ Pass / ☐ Fail |
| Chat inbox shows match in list | ☐ Pass / ☐ Fail |
| Events tab loads (TM or mock — not blank) | ☐ Pass / ☐ Fail |
| Tap "Interested" on event → count updates | ☐ Pass / ☐ Fail |
| Create a plan from an event | ☐ Pass / ☐ Fail |
| Friends Discover → Besties → request sent | ☐ Pass / ☐ Fail |
| Shots inbox shows incoming reactions | ☐ Pass / ☐ Fail |
| Sign out → sign back in → data preserved | ☐ Pass / ☐ Fail |

### Submit
- [ ] Upload iOS `.ipa` to App Store Connect (via EAS Submit or Transporter)
- [ ] Upload Android `.aab` to Google Play Console
- [ ] Set release notes for this version
- [ ] Submit for review (App Store) / Release to production track (Play Store)
- [ ] Monitor for rejection reasons within 24–48h (App Store) / 1–3 days (Play)

---

## PART 3 — Post-Launch Monitoring (First 48h)

- [ ] Watch Render logs for spike in 5xx errors
- [ ] Confirm Ticketmaster events are loading (check `/api/events` directly)
- [ ] Confirm push notifications firing (daily-spark cron at 6 PM ET)
- [ ] Confirm RevenueCat webhooks processing (check RC dashboard)
- [ ] Check Clerk dashboard for auth errors or unusual sign-in patterns
- [ ] Monitor app crash rates in Expo / Sentry (if wired up)

---

## PART 4 — Known Issues to Fix Before or Shortly After Launch

These are gaps identified from the testing strategy — track them before v1.0:

| Issue | Priority | What Breaks |
|-------|----------|-------------|
| Zero API integration tests for `/api/conversations` | P0 | Chat inbox — core feature |
| Zero API integration tests for `/api/events/context` | P0 | "Who's going" on events |
| No E2E test for Match → Chat journey | P1 | Can't automate regression |
| `datingMatches` routes untested | P1 | Match persistence |
| `CONNECTSPHERE_LOCAL_DB_FALLBACK` must be `false` in production | P0 | Production reads db.json instead of real DB |
| `db.json` must NOT be the mock seed file in production | P0 | Real users would see mock data |

---

## Rollback Plan

**API Server:**
- Go to Render dashboard → select previous deploy → "Redeploy"
- Takes ~2–3 minutes to be live again

**Mobile App:**
- iOS: Use App Store Connect "Pause Rollout" or submit hotfix build
- Android: Use Play Console "Halt rollout" — set rollout to 0%
- Both stores allow emergency hotfix submission with expedited review if you flag a crash

---

## Quick Reference — Key URLs

| Service | URL |
|---------|-----|
| API (production) | `https://connectsphere-api.onrender.com` |
| Render dashboard | `https://dashboard.render.com` |
| App Store Connect | `https://appstoreconnect.apple.com` |
| Google Play Console | `https://play.google.com/console` |
| Clerk dashboard | `https://dashboard.clerk.com` |
| RevenueCat dashboard | `https://app.revenuecat.com` |
| EAS Build dashboard | `https://expo.dev` |
