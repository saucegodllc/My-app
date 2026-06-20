# ConnectSphere — Launch Checklist

Complete every item below before submitting to the App Store or going live with production traffic.
Items marked 🔴 are blockers. Items marked 🟡 are important but not strictly blocking.

---

## 1. Security — Do First

- [ ] 🔴 **Rotate the second exposed Stripe test key**
  - Go to Stripe dashboard → Developers → API Keys
  - Roll `sk_test_51TdjuECVhbAAuROtXOD0iUe...` immediately
  - Never paste secret keys in chat — enter them directly in the Render dashboard

- [ ] 🔴 **Switch Stripe to live key at launch**
  - In Render dashboard → `connectsphere-api` service → Environment → `STRIPE_SECRET_KEY`
  - Set to your live `sk_live_...` key (not test)
  - Update `STRIPE_WEBHOOK_SECRET` with the live webhook signing secret from Stripe → Webhooks

---

## 2. Render Deployment — API Server

### First deploy
1. Push branch `codex-friends-mission-control` → open PR → merge into `friends-connect-handoff`
2. In Render dashboard → New → Blueprint → point to repo → select `render.yaml`
3. Render will create two services: `connectsphere-api` (web) + `connectsphere-daily-spark` (cron)

### Environment variables — set manually in Render dashboard (never in code)

**`connectsphere-api` service:**
| Key | Value |
|-----|-------|
| `DATABASE_URL` | Your Postgres connection string |
| `CLERK_SECRET_KEY` | From Clerk dashboard → API Keys |
| `CRON_SECRET` | Generate a random 32-char string (e.g. `openssl rand -hex 16`) |
| `REVENUECAT_API_SECRET_KEY` | From RevenueCat dashboard → API Keys |
| `STRIPE_SECRET_KEY` | Live key: `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | From Stripe → Webhooks → signing secret |

**`connectsphere-daily-spark` cron service:**
| Key | Value |
|-----|-------|
| `API_BASE_URL` | Your Render web service URL, e.g. `https://connectsphere-api.onrender.com` |
| `CRON_SECRET` | Same value as the API server's `CRON_SECRET` |

### Verify cron is wired
- After first deploy, note the API URL from the Render dashboard
- Update `API_BASE_URL` in the cron service env vars
- Manually trigger the cron once: `curl -X POST https://connectsphere-api.onrender.com/api/notifications/daily-spark/broadcast -H "x-cron-secret: YOUR_SECRET"`
- Confirm you get `{"sent": N, "errors": 0}` (or similar)

---

## 3. Stripe Routes — Verify Live

- [ ] 🔴 `POST /api/stripe/create-checkout-session` returns a Stripe Hosted Checkout URL
- [ ] 🔴 `POST /api/stripe/webhook` receives and processes `checkout.session.completed`
- [ ] 🟡 `POST /api/stripe/portal` returns a Stripe Customer Portal URL
- [ ] 🟡 Test the full flow: tap "Subscribe" in app → Stripe checkout opens → complete → RevenueCat entitlement granted

---

## 4. RevenueCat

- [ ] 🔴 Set `REVENUECAT_API_SECRET_KEY` in Render (see above)
- [ ] 🔴 Configure RevenueCat webhook to call your API after Stripe payment (or use RevenueCat's Stripe integration)
- [ ] 🟡 Verify entitlement `connectsphere_plus` is granted after a test purchase
- [ ] 🟡 Verify `Restore Purchases` works on Premium screen

---

## 5. Push Notifications (Daily Spark)

- [ ] 🔴 Ensure Expo push token registration is wired — users must grant notification permission during onboarding
- [ ] 🟡 Test one real device: sign in, grant notifications, check Firestore `users/{id}.expoPushToken` is populated
- [ ] 🟡 Manually fire the broadcast endpoint and verify the device receives a notification

---

## 6. Firebase / Firestore

- [ ] 🔴 Deploy production Firebase Security Rules (`firebase deploy --only firestore:rules`)
- [ ] 🔴 Deploy Cloud Functions (`firebase deploy --only functions`)
- [ ] 🟡 Confirm `users/{userId}.vibeCheck.answers` is readable/writable by the owning user only
- [ ] 🟡 Confirm match creation and reaction writes are protected by auth

---

## 7. Clerk Auth

- [ ] 🔴 Confirm `CLERK_SECRET_KEY` and `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` both use production (not development) values
- [ ] 🟡 Test sign-up → OTP → onboarding flow on a physical device

---

## 8. EAS / App Build

- [ ] 🔴 `eas.json` production profile has `EXPO_PUBLIC_API_URL` set to the live Render URL
- [ ] 🔴 `app.json` `bundleIdentifier` (iOS) and `package` (Android) match App Store / Play Store records
- [ ] 🟡 Run `eas build --platform ios --profile production` and confirm no build errors
- [ ] 🟡 Run `eas build --platform android --profile production`
- [ ] 🟡 Test the production build on a physical device before submitting

---

## 9. App Store / Privacy

- [ ] 🟡 `PrivacyInfo.xcprivacy` is included (already in repo)
- [ ] 🟡 Privacy Policy and Terms of Service screens are live (already built)
- [ ] 🟡 App Store listing copy is ready (`artifacts/connectsphere-mobile/APP_STORE_LISTING.md`)
- [ ] 🟡 ATT prompt is wired (permission request triggers before PostHog tracking)

---

## 10. Pre-submit Smoke Test (run on real device)

- [ ] Sign up with a new account
- [ ] Complete onboarding including Vibe Quiz
- [ ] See seed/discovery profiles with Vibe % pill
- [ ] Swipe right → match modal appears with VibeBreakdown
- [ ] Open chat → icebreaker bar appears
- [ ] Navigate to Games tab → all 4 decks load
- [ ] Navigate to Events tab → events load
- [ ] Open Premium screen → "Subscribe on Web" opens Stripe checkout
- [ ] Check daily spark: receives push notification at 6 PM Eastern

---

## 11. Post-launch (first 48 hours)

- [ ] Watch Render logs for API errors (`connectsphere-api` → Logs)
- [ ] Check Stripe dashboard for failed webhooks
- [ ] Monitor Firestore usage in Firebase console
- [ ] Check PostHog for funnel drop-offs (sign-up → first swipe → first match)
- [ ] Verify daily spark cron fires at `0 23 * * *` UTC and appears in Render cron logs

---

## Git Flow Reminder

```
codex-friends-mission-control  ← active dev branch
        ↓  (PR + merge)
friends-connect-handoff         ← Render deploy branch (auto-deploys on push)
```

After merging, Render triggers a new deploy automatically. Monitor the deploy log for build errors before the new version receives traffic.
