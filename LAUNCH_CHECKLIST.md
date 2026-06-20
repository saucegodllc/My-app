# ConnectSphere Launch-Prep Checklist

This checklist is for getting the repo and production setup ready. It does not include uploading, submitting, or releasing the app.

Current scope:
- iOS first.
- Production API URL: `https://connectsphere-api.onrender.com`.
- `eas build` is optional/manual and should only run after explicit approval.
- `eas submit`, App Store Connect upload, and production release are blocked until the user explicitly says submit.
- Android remains documented as a follow-up, not a blocker for the iOS debut.

## 1. Security - Do First

- [ ] Blocker: Rotate every previously exposed Stripe test secret key in Stripe Dashboard.
  - Go to Stripe Dashboard -> Developers -> API keys.
  - Roll the exposed `sk_test_...` keys. Do not paste full keys in docs, git, chat, or screenshots.
  - Update Render environment variables directly in the dashboard.

- [ ] Blocker: Verify no production secrets are committed or pasted anywhere.
  - Render owns server secrets only: `DATABASE_URL`, `CLERK_SECRET_KEY`, `CRON_SECRET`, `ANTHROPIC_API_KEY`, `REVENUECAT_API_SECRET_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `TICKETMASTER_API_KEY`.
  - EAS owns mobile build secrets/public config only. Do not commit `.env.production`.
  - Run the local tracked-file secret scan before release:

```powershell
node artifacts/connectsphere-mobile/scripts/launch-check.mjs
```

- [ ] Blocker: Confirm Stripe production values are live only in Render.
  - `STRIPE_SECRET_KEY` must be a live `sk_live_...` key at launch.
  - `STRIPE_WEBHOOK_SECRET` must be the live webhook signing secret.

## 2. Render Production API

- [x] `render.yaml` runs the DB push during deploy so the production `spark_memory` table can be created without paid Render Shell access.
- [ ] Confirm the latest Render deploy on `friends-connect-handoff` completed successfully.
- [ ] Confirm `GET https://connectsphere-api.onrender.com/health` returns 200.
- [ ] Confirm production DB has `spark_memory` and `push_tokens` tables after deploy.
- [ ] Confirm cron env:
  - `API_BASE_URL=https://connectsphere-api.onrender.com`
  - `CRON_SECRET` matches the API service.

## 3. EAS Production Config

- [x] `eas.json` production profile points to `https://connectsphere-api.onrender.com`.
- [x] Production config guard requires `EXPO_PUBLIC_PROJECT_ID`.
- [x] Production config guard disables demo seeds and local DB fallback.
- [ ] Add `EXPO_PUBLIC_PROJECT_ID` to the EAS production environment.
- [ ] Fill dashboard-only iOS submit IDs before any future submit:
  - `ascAppId`: App Store Connect -> App Information.
  - `appleTeamId`: Apple Developer -> Account -> Membership.
- [ ] Confirm `app.json` values:
  - `ios.bundleIdentifier=com.connectsphere.mobile`
  - `version=1.0.0`
  - `ios.buildNumber=2`
- [ ] Bump `ios.buildNumber` only if App Store Connect/TestFlight has already seen build `2`.

Manual build status:
- [ ] Optional/manual: `eas build --platform ios --profile production`
- [ ] Blocked until explicit approval: `eas submit --platform ios`

## 4. Firebase Readiness

- [x] `app.json` expects iOS Firebase config at `./GoogleService-Info.plist`.
- [ ] Add the production iOS Firebase file locally before production EAS build:
  - `artifacts/connectsphere-mobile/GoogleService-Info.plist`
- [ ] Do not commit Firebase service-account private keys.
- [ ] Android `google-services.json` is a follow-up unless Android launch becomes in scope.
- [ ] Deploy production Firestore rules and Functions from the Firebase CLI when ready:
  - `firebase deploy --only firestore:rules`
  - `firebase deploy --only functions`

## 5. Revenue, Premium, and Stripe

- [ ] Confirm RevenueCat iOS public SDK key is set in EAS production.
- [ ] Confirm `REVENUECAT_API_SECRET_KEY` is set in Render.
- [ ] Add Stripe price IDs to Render for the current three-plan offer:
  - `STRIPE_PRICE_MONTHLY` = $14.99 every 2 weeks
  - `STRIPE_PRICE_SIXMONTH` = $150 every 6 months
  - `STRIPE_PRICE_YEARLY` = $300 per year
- [ ] If Stripe prices ever need to be recreated, run one of these locally and paste the key only into the terminal prompt:
  - PowerShell: `.\scripts\run-stripe-setup.ps1`
  - Git Bash: `bash scripts/run-stripe-setup.sh`
- [ ] Confirm premium entitlement name: `connectsphere_plus`.
- [ ] Test Stripe Hosted Checkout from Premium.
- [ ] Test Stripe webhook -> RevenueCat entitlement grant.
- [ ] Test Restore Purchases on a real iPhone.

## 6. Real-Device iOS QA

Run this on a physical iPhone before any build upload:

- [ ] Fresh install opens without crash.
- [ ] Sign up with a new account.
- [ ] Sign out and sign back in.
- [ ] Complete onboarding and Vibe Quiz.
- [ ] Grant and deny push permissions in separate test passes.
- [ ] Discover loads profiles and every avatar/name opens a user profile.
- [ ] Connect / Matches flow works: like, pass, match modal, chat entry.
- [ ] Moments tab loads, create/open actions work, and every avatar/name opens a profile.
- [ ] Spaces tab loads posts/threads and every avatar/name opens a profile.
- [ ] Events tab loads and event details open.
- [ ] Premium screen opens checkout and restore flow.
- [ ] Report and block actions complete without dead buttons.
- [ ] Push token registration appears for the signed-in user.
- [ ] Daily Spark notification can be sent and received.
- [ ] Offline/network-error states do not crash the app.

## 7. Safe Verification Commands

These are safe to run now and do not upload or submit anything:

```powershell
pnpm.cmd --filter @workspace/connectsphere-mobile run typecheck
npm.cmd run build
rg -n -i "g[a]mes? tab|navigate to g[a]mes|new g[a]mes|\bg[a]mes\b|\bg[a]ming\b" LAUNCH_CHECKLIST.md artifacts\DEPLOY_CHECKLIST.md docs artifacts\connectsphere-mobile\TAP_MATRIX.md artifacts\connectsphere-mobile\docs -g "*.md"
node artifacts/connectsphere-mobile/scripts/launch-check.mjs
```

Run `npm.cmd run build` from `artifacts/connectsphere-mobile/functions`.

Expected current blockers are dashboard/file values, not code submission:
- Missing `GoogleService-Info.plist` until downloaded from Firebase.
- Missing EAS production secrets until set in EAS.
- Missing App Store Connect IDs until copied from dashboards.

## 8. App Store Materials

- [ ] Privacy Policy and Terms are live.
- [ ] `PrivacyInfo.xcprivacy` remains included.
- [ ] App Store listing copy is ready: `artifacts/connectsphere-mobile/APP_STORE_LISTING.md`.
- [ ] Screenshots are prepared for required iPhone sizes.
- [ ] Age rating is ready for social/dating-style features.
- [ ] In-app purchases are created in App Store Connect before review.

## 9. Android Follow-Up

Android is not blocking the iOS-first debut unless the scope changes.

- [ ] Add `artifacts/connectsphere-mobile/google-services.json`.
- [ ] Confirm Google Play package `com.connectsphere.mobile`.
- [ ] Confirm Play Console service account and upload key.
- [ ] Run Android QA on a real Android device.

## 10. Post-Launch Watchlist

- [ ] Watch Render logs for API errors.
- [ ] Watch Stripe webhook failures.
- [ ] Watch RevenueCat entitlement grants.
- [ ] Watch Firebase/Firestore usage.
- [ ] Watch crash/error reporting.
- [ ] Confirm daily cron jobs fire at expected UTC times.
