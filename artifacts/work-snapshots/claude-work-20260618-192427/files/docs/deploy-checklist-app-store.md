# Deploy Checklist: ConnectSphere — App Store + Play Store Submission

**App:** ConnectSphere / Discover Miami  
**Stack:** React Native · Expo SDK 54 · Expo Router v6 · Express 5 (Render.com) · Drizzle ORM + PostgreSQL · Clerk auth · Stripe Hosted Checkout · RevenueCat  
**Channels:** Apple App Store + Google Play Store  
**Last updated:** 2026-06-08

---

## 🔴 CRITICAL — Security (do before anything else)

- [ ] **Rotate exposed Stripe test keys** — two test keys were previously visible in source.
  Go to Stripe Dashboard → Developers → API keys → Roll both `sk_test_...` keys.
  Update Render environment variables. Confirm no prod keys were affected.
- [ ] **Verify no secrets in git history** — run `git log -p | grep -E "sk_|pk_|ANTHROPIC|CLERK_SECRET"`.
  If found, use BFG Repo Cleaner to purge + force-push before submission.
- [ ] **`ANTHROPIC_API_KEY` is server-side only** — confirm it is NOT in the Expo client bundle.
  Run `npx expo export --platform ios && grep -r "sk-ant-" dist/` — must return nothing.
- [ ] **Clerk publishable key** — `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` is safe to be public.
  Confirm it is the correct environment (prod vs dev).
- [ ] **RevenueCat API keys** — verify public SDK key in client, secret key server-side only.
- [ ] **Firebase service account** — confirm it is never bundled in the client app.
- [ ] **Stripe webhook signing secret** — lives only in Render env vars, never in code.

---

## 🟠 Pre-Build — Code & Config

### Versioning
- [ ] Bump `version` in `app.json` (e.g. `1.0.1`)
- [ ] Bump `ios.buildNumber` — must be higher than the last TestFlight build
- [ ] Bump `android.versionCode` — must be higher than last Play Store upload
- [ ] Tag the release commit: `git tag v1.0.1 && git push --tags`

### App Config (`app.json` / `app.config.ts`)
- [ ] `bundleIdentifier` matches App Store Connect (iOS)
- [ ] `package` matches Google Play Console (Android)
- [ ] `icon` and `splash` assets are present and the correct resolution (1024×1024 icon, 1284×2778 splash minimum)
- [ ] `orientation` set correctly (`portrait` for dating app)
- [ ] `infoPlist.NSCameraUsageDescription` / `NSPhotoLibraryUsageDescription` / `NSLocationWhenInUseUsageDescription` are filled in — App Store rejects missing descriptions
- [x] **`PrivacyInfo.xcprivacy`** present at `ios/ConnectSphere/PrivacyInfo.xcprivacy` — created 2026-06-08; declares UserDefaults/CA92.1, FileTimestamp/C617.1, DiskSpace/E174.1, SystemBootTime/35F9.1, plus EmailAddress + PhotosOrVideos + DeviceID data types
- [ ] `android.permissions` list reviewed — remove any permissions not actually used
- [ ] `expo-notifications` config: `projectId` matches EAS project ID
- [ ] `updates.url` and `runtimeVersion` set for OTA updates if using EAS Update

**Current app config audit (2026-06-05):**
- [x] `ios.bundleIdentifier = com.connectsphere.mobile`; confirm this exact ID exists in App Store Connect.
- [x] `android.package = com.connectsphere.mobile`; confirm this exact package exists in Play Console.
- [x] `ios.buildNumber = 2` and `android.versionCode = 2`; bump again if either store has already seen these numbers.
- [x] Explicit iOS camera, photo-library, location, tracking, Face ID, and non-exempt-encryption fields are present.
- [x] Expo Router origin is set to `https://connectsphere.app`.
- [ ] Native Firebase files must be supplied for production EAS: `GoogleService-Info.plist` and `google-services.json`. `app.config.js` strips missing files only for local development.
- [ ] `EXPO_PUBLIC_PROJECT_ID` must be set in the production EAS environment; production config fails fast if it is missing.
- [ ] OTA updates are intentionally disabled for this release unless `runtimeVersion` and `updates.url` are added before build.
- [ ] **Fill in `eas.json` placeholders** — two fields are still `REPLACE_ME`:
  - `"ascAppId": "REPLACE_WITH_APP_STORE_CONNECT_APP_ID"` — get from App Store Connect → App Information
  - `"appleTeamId": "REPLACE_WITH_APPLE_TEAM_ID"` — get from developer.apple.com → Account → Membership

### Environment Variables (Render + EAS)
- [ ] All `EXPO_PUBLIC_*` vars populated in EAS build profile (production)
- [ ] All server-side vars set in Render production environment — **full list from `render.yaml`**:
  - `DATABASE_URL`
  - `CLERK_SECRET_KEY`
  - `CRON_SECRET` (must match both cron jobs)
  - `ANTHROPIC_API_KEY` ← added 2026-06-08; needed by `/api/ai-chat` routes
  - `REVENUECAT_API_SECRET_KEY`
  - `STRIPE_SECRET_KEY` (live key, not test)
  - `STRIPE_WEBHOOK_SECRET`
  - `TICKETMASTER_API_KEY`
  - `API_BASE_URL` (both cron jobs — set to `https://connectsphere-api.onrender.com`)
- [ ] Confirm prod Clerk instance is being used, not dev
- [ ] Confirm prod Stripe keys (`sk_live_...`) are in Render, not test keys
- [ ] Confirm prod RevenueCat project is configured
- [ ] Stripe secret keys are stored only in Render environment variables. Never paste them in chat, docs, `app.json`, `app.config.js`, EAS public env, or source code.

### Dependencies
- [ ] `npx expo-doctor` — resolve all warnings
- [ ] No deprecated Expo SDK packages with red warnings
- [ ] `react-native-reanimated` babel plugin is present in `babel.config.js`:
  ```js
  plugins: ['react-native-reanimated/plugin']
  ```
  (Must be last plugin — Reanimated requirement)
- [ ] All native modules have matching `expo-modules-core` versions

---

## 🟡 Build

### iOS (EAS Build)
- [ ] `eas build --platform ios --profile production`
- [ ] Build completes without warnings about missing entitlements
- [ ] Code signing: Distribution certificate + provisioning profile valid (not expired)
- [ ] Push notification entitlement (`aps-environment = production`) present
- [ ] In-app purchase capability enabled in Apple Developer portal
- [ ] Associated domains (universal links) configured if used

### Android (EAS Build)
- [ ] `eas build --platform android --profile production`
- [ ] Keystore is backed up securely (losing the keystore = can never update the app)
- [ ] `targetSdkVersion` meets Google Play minimum (34+ as of 2024)
- [ ] `android:exported` attributes set on all activities/receivers (Android 12+ requirement)

---

## 🟡 Testing

### Automated tests — run before every build

```bash
# API server
cd artifacts/api-server
pnpm test:integration   # 44 supertest cases (inbox v2 + friends routing)

# Mobile
cd artifacts/connectsphere-mobile
pnpm test               # 92+ unit cases
```

All tests must pass. Block the build if any fail.

### Functional smoke tests (run on device, not simulator)
- [ ] Sign up / sign in flow (Clerk) — new user and returning user
- [ ] Swipe right → "It's a Match!" modal fires, animations play, "Say Hey!" opens chat
- [ ] Swipe left → profile is filtered from deck
- [ ] Profile Boost activates, countdown runs, persists after app restart
- [ ] Daily boost limit enforced (second tap on same day shows "Come back tomorrow")
- [ ] Swipe counter decrements correctly; free user hits limit and sees paywall
- [ ] Rewind works for premium users, locked for free
- [ ] Friends tab shows boost + swipes overlay (FOMO pills visible)
- [ ] Action rail buttons (VIBE / SPARK / PASS / SHOT) all fire correct actions
- [ ] RevenueCat purchase flow → subscription unlocks premium features
- [ ] Stripe Hosted Checkout opens, completes, webhook received, entitlement granted
- [ ] Push notifications received in foreground and background
- [ ] Deep links open the correct screen
- [ ] App works offline (graceful degradation — no hard crash)

### Animation QA
- [ ] "It's a Match!" modal: 42 hearts snap out (not slow float), starburst rings bloom
- [ ] Title scales in with elastic overshoot — confirm on Android Pixel 6
- [ ] Glow pulse loops without stutter during scroll
- [ ] Swipe card throw animation is smooth on low-end Android (Reanimated v3)
- [ ] Action rail tap `pop` animation fires without frame drop

### Edge cases
- [ ] Empty deck (all profiles passed) — shows "You've passed on everyone" state, no crash
- [ ] Network offline → Firestore operations fail gracefully (no unhandled rejection)
- [ ] User with no profile photo — fallback avatar renders in match modal
- [ ] Very long name in match modal — subtitle wraps, no overflow

---

## 🟡 Backend / API (Render.com)

- [ ] `GET /health` returns 200 in production
- [ ] All Express routes tested via Postman / HTTPie against prod URL
- [ ] Stripe webhook endpoint reachable and verified (`stripe listen --forward-to` in staging)
- [ ] Rate limiting on discovery feed endpoint (prevent abuse)
- [ ] CORS origin whitelist set to your production domain only (not `*`)

### Inbox v2 routes — smoke test before launch

These four paths were broken (404) before 2026-06-08 and are now fixed:

- [ ] `GET /api/inbox/requests/:userId` returns `{ ok: true, requests: [], count: 0 }`
- [ ] `GET /api/inbox/reactions/:userId` returns `{ ok: true, reactions: [], counts: {...}, isPremium }`
- [ ] `POST /api/inbox/reactions/like-back/:id` creates match + returns conversation
- [ ] `POST /api/inbox/reactions/withdraw` returns `{ ok: true, withdrawn: bool }` (not 404)

### Cron jobs — verify after first deploy

- [ ] `connectsphere-daily-spark` fires at 23:00 UTC — check Render job logs the next day
- [ ] `connectsphere-anti-ghost` fires at 15:00 UTC — check Render job logs
- [ ] Both cron jobs use the same `CRON_SECRET` as the API server
- [ ] `API_BASE_URL` set on both cron jobs (e.g. `https://connectsphere-api.onrender.com`)

---

## 🟢 App Store Connect (iOS)

- [ ] Upload `.ipa` via `eas submit --platform ios` or Transporter
- [ ] All required screenshots uploaded (iPhone 6.5", iPhone 5.5", iPad 12.9" if supporting iPad)
- [ ] App description, keywords, and support URL filled in
- [ ] Privacy policy URL present and live (required for apps with user accounts)
- [ ] Age rating questionnaire completed (dating apps typically 17+)
- [ ] In-app purchases listed (ConnectSphere Plus, Boost) with correct pricing tiers
- [ ] Export compliance — answer "No" if no custom encryption beyond HTTPS/TLS
- [ ] Submit for review — allow 24–48 hr for initial review

---

## 🟢 Google Play Console (Android)

- [ ] Upload `.aab` via `eas submit --platform android` or manually
- [ ] Store listing: description, screenshots (phone + 7" tablet), feature graphic
- [ ] Content rating questionnaire completed (dating apps → may require 18+)
- [ ] Privacy policy URL live
- [ ] Data safety form filled in (location, contacts, financial info, etc.)
- [ ] In-app products configured and activated in Play Console
- [ ] Target audience set (18+) — required for apps with romantic content
- [ ] Release to Internal Testing → Closed Testing → Open Testing → Production
  (Google requires a 20-tester closed track before promoting to production for new apps)

---

## 🟢 Post-Deploy

- [ ] Monitor Sentry / Crashlytics for new error spikes for 24 hours post-launch
- [ ] Monitor Stripe Dashboard for payment success rate (flag if < 95%)
- [ ] Monitor RevenueCat for subscription grant rate
- [ ] Monitor Firestore usage and quota in Firebase Console
- [ ] Confirm push notification delivery rate in Expo Push receipts API
- [ ] App Store Connect → Crashes tab — confirm zero new crash types
- [ ] Respond to any App Store / Play Store review flags within 24 hr

---

## 🔵 Rollback Plan

| Trigger | Action |
|---------|--------|
| Crash rate > 1% of sessions | Submit hotfix build to expedited review |
| Payment failures > 5% | Revert to previous Stripe config, open support ticket |
| Reanimated crash on Android | Wrap `DatingMatchModal` in try/catch, fall back to Animated API |
| Firestore write errors on boost | Disable boost feature flag server-side until fixed |
| EAS Update available | Push OTA hotfix for JS-layer bugs (no re-review needed) |

---

## Notes

- **OTA updates via EAS Update** can fix JS bugs post-launch without App Store re-review.
  Native code changes (new permissions, native modules) always require a new binary build.
- **Stripe test keys must never reach production.** The two previously exposed test keys
  should be rotated immediately (see top of this checklist).
- **Never paste secret keys in chat, email, or Slack.** All secrets enter the system via
  Render's Environment Variables tab only.
