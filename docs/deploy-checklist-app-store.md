# Deploy Checklist: ConnectSphere App Store Readiness

**App:** ConnectSphere / Discover Miami  
**Stack:** React Native, Expo SDK 54, Expo Router v6, Express 5 on Render, Drizzle ORM, PostgreSQL, Clerk, Stripe Hosted Checkout, RevenueCat  
**Current mode:** iOS-first launch prep only. Do not upload, submit, or release until the user explicitly says submit.  
**Last updated:** 2026-06-19

## Security Blockers

- [ ] Rotate every previously exposed Stripe test secret key in Stripe Dashboard.
- [ ] Confirm production Stripe keys live only in Render environment variables.
- [ ] Confirm `ANTHROPIC_API_KEY`, `CLERK_SECRET_KEY`, `DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and RevenueCat secret keys are never committed or pasted in chat.
- [ ] Run the tracked-source scan:

```powershell
node artifacts/connectsphere-mobile/scripts/launch-check.mjs
```

- [ ] If secrets are found in git history, purge with BFG or an equivalent history rewrite before store submission.

## iOS Production Config

- [x] Production API URL is `https://connectsphere-api.onrender.com`.
- [x] Production config requires `EXPO_PUBLIC_PROJECT_ID`.
- [x] Production config blocks demo seeds and local DB fallback.
- [ ] Set EAS production values in the EAS dashboard or EAS secrets:
  - `EXPO_PUBLIC_PROJECT_ID`
  - `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
  - `EXPO_PUBLIC_SENTRY_DSN`
- [ ] Confirm `app.json`:
  - `ios.bundleIdentifier=com.connectsphere.mobile`
  - `version=1.0.0`
  - `ios.buildNumber=2`
- [ ] Bump `ios.buildNumber` if build `2` has already been uploaded to App Store Connect or TestFlight.
- [ ] Fill iOS submit IDs only from dashboards before any future submit:
  - `ascAppId`: App Store Connect -> App Information.
  - `appleTeamId`: Apple Developer -> Account -> Membership.

## Firebase Readiness

- [x] `app.json` expects iOS Firebase config at `./GoogleService-Info.plist`.
- [ ] Download the production iOS Firebase plist from Firebase Console and place it at:

```text
artifacts/connectsphere-mobile/GoogleService-Info.plist
```

- [ ] Do not create or commit Firebase service-account private keys.
- [ ] Leave Android `google-services.json` as a follow-up unless Android launch becomes in scope.
- [ ] Deploy production Firebase rules/functions only when ready:

```bash
firebase deploy --only firestore:rules
firebase deploy --only functions
```

## Safe Verification

These commands do not submit or upload anything:

```powershell
pnpm.cmd --filter @workspace/connectsphere-mobile run typecheck
```

```powershell
npm.cmd run build
```

Run the Functions build from `artifacts/connectsphere-mobile/functions`.

```powershell
rg -n -i "g[a]mes? tab|navigate to g[a]mes|new g[a]mes|\bg[a]mes\b|\bg[a]ming\b" LAUNCH_CHECKLIST.md artifacts\DEPLOY_CHECKLIST.md docs artifacts\connectsphere-mobile\TAP_MATRIX.md artifacts\connectsphere-mobile\docs -g "*.md"
```

```powershell
node artifacts/connectsphere-mobile/scripts/launch-check.mjs
```

Expected current blockers are missing dashboard/file values, not an app submission.

## Real iPhone QA

- [ ] Fresh install opens without crash.
- [ ] Sign up with a new account.
- [ ] Sign out and sign back in.
- [ ] Complete onboarding and Vibe Quiz.
- [ ] Test push permission grant and denial.
- [ ] Discover loads profiles and every avatar/name opens a user profile.
- [ ] Connect / Matches flow works: like, pass, match modal, chat entry.
- [ ] Moments loads, actions work, and every avatar/name opens a profile.
- [ ] Spaces loads, posts/threads open, and every avatar/name opens a profile.
- [ ] Events loads and event details open.
- [ ] Premium opens checkout and restore flow.
- [ ] Report and block actions complete.
- [ ] Age gate: attempt onboarding with a DOB < 18 years — confirm underage screen appears and profile is not created.
- [ ] Account deletion: Settings → Delete Account → type DELETE → confirm profile and all data are removed.
- [ ] Push token registration appears for the signed-in user.
- [ ] Daily Spark notification can be sent and received.
- [ ] Offline/network-error states do not crash the app.

## Build and Submit Boundaries

- [ ] Optional/manual build only after approval:

```bash
eas build --platform ios --profile production
```

- [ ] Blocked until the user explicitly says submit:

```bash
eas submit --platform ios
```

- [ ] Do not run Transporter upload or any App Store Connect release action until explicit approval.

## App Store Materials

- [ ] Privacy policy URL is live.
- [ ] Terms of service URL is live.
- [ ] `PrivacyInfo.xcprivacy` remains included.
- [ ] App Store listing copy is ready.
- [ ] Required iPhone screenshots are ready.
- [ ] Age rating set to **17+** in App Store Connect (required for dating apps; ConnectSphere enforces 18+ server-side via birthDate on PUT /profiles/me and in the discovery feed — App Store minimum is 17+).
- [ ] Age rating questionnaire is ready for social/dating-style features.
- [ ] In-app purchases are created and attached in App Store Connect.

## Android Follow-Up

Android is not blocking this iOS-first launch prep.

- [ ] Add `artifacts/connectsphere-mobile/google-services.json`.
- [ ] Confirm package `com.connectsphere.mobile` in Play Console.
- [ ] Confirm Google Play upload credentials.
- [ ] Run Android real-device QA.
