# ConnectSphere — App Store Readiness Checklist
**Target: Apple App Store (iOS) + Google Play (Android)**

---

## App Store Metadata

### App Name (30 char max)
`ConnectSphere`

### Subtitle (30 char max)
`Miami Dating & Social Scene`

### Category
**Primary:** Social Networking  
**Secondary:** Lifestyle

### Age Rating
**17+** (required: "Frequent/Intense Sexual Content or Nudity" → NO, but "Infrequent/Mild" YES for dating context; unrestricted web access; contact info shared with third parties for dating)

Run the App Store age rating questionnaire with:
- Infrequent/Mild Mature/Suggestive Themes: ✓
- Unrestricted Web Access: ✓
- Location sharing: ✓
- Dating apps are automatically 17+

---

## App Description (4000 char max)

```
Meet Miami. Really meet it.

ConnectSphere is the dating and social app built for Miami — not adapted from somewhere else, not a global product with a Miami option. Born here. Made for the people who actually live here.

**DISCOVER**
Swipe through real Miami people with real Miami lives. Filter by neighborhood, vibe, or interest. See who's nearby and actually active — not profiles left up from three months ago.

**MOMENTS**
Share what you're doing right now. 24-hour story-style posts tied to your location — Wynwood, Brickell, Coconut Grove, wherever you are. See who's out, what they're into, and what Miami feels like today.

The Hot Zone tells you where the energy is. Right now.

**CONNECT**
When you match, it's real. Respond to Moment requests, reply to sparks, actually talk. Free users get a 2-hour window to reply to Moments — move fast or miss it.

**EVENTS**
From sunrise yoga at Crandon to chef's tables in Little Havana to gallery walks in Wynwood — real events, hosted by real people in your matches. RSVP and meet IRL.

**SPACES**
Join your neighborhood's social layer. Wynwood Creatives. Miami Fitness Crew. Biscayne Bay Collective. Community built around how people actually live in Miami, not interests they checked a box for.

---

This isn't a swipe machine. It's a city app for people who want to be part of Miami, not just in it.

ConnectSphere. Your city's social pulse.
```

---

## Keywords (100 char max, comma-separated)
```
miami dating,miami social,brickell,wynwood,south beach,local dating,miami singles,moments,social
```

### Keyword Strategy
| Keyword | Search Volume Est. | Competition |
|---|---|---|
| miami dating | High | Medium |
| miami singles | High | Low |
| local dating app | Medium | Low |
| miami social scene | Medium | Very Low |
| wynwood | Medium | Very Low |
| brickell dating | Low | Very Low |

---

## Screenshots Spec (6.7" iPhone — required)

All screenshots should use dark background (#050008) with BRAND.pink (#FF2DA8) accents.

| # | Screen | Caption | Key UI elements |
|---|---|---|---|
| 1 | **Discover tab** — Sofia's profile open | "Meet Miami, really meet it" | Full-screen profile, compatibility score 96, Key Biscayne distance |
| 2 | **Moments tab** — Hot Zone banner + feed | "See who's out right now · Wynwood is popping" | Hot Zone banner, 4 moment cards, story rail at top |
| 3 | **Moments viewer** — Full screen Kayla | "24-hour moments from real Miami people" | Full viewer modal, pink progress bar, react button glowing |
| 4 | **Events tab** — Rooftop social card open | "Real events. Real people. IRL." | Event cover, 83 attendees, RSVP button, date/time |
| 5 | **Spaces tab** — Wynwood Creatives joined | "Your neighborhood's social layer" | Community grid, member count, recent activity |
| 6 | **Connect tab** — Messages list | "When you match, it's real" | Match list with Maya/Sofia/Kayla, unread badges |

### Screenshot tool
Use `expo-blur` screenshots with `EXPO_PUBLIC_DEMO_MODE=true`. All mock users from `lib/mockData.ts` will load automatically.

---

## Privacy Policy Requirements (App Store Review)

ConnectSphere must have a working privacy policy URL before submission. Required sections:

- [ ] What data is collected (location, photos, profile info, messages)
- [ ] How location data is used (Moments, Hot Zone — NOT sold to third parties)
- [ ] User data deletion (CCPA + GDPR: account deletion within 30 days)
- [ ] Third-party services: Clerk (auth), Expo (push notifications), Render (hosting)
- [ ] Age requirement: Users must be 18+
- [ ] Data retention policy
- [ ] Contact: support@connectsphere.app (or equivalent)

**Host at:** `https://connectsphere.app/privacy`

---

## App Store Review Checklist

### Before Submitting

- [ ] **Clerk auth works on TestFlight** — real sign-in, not demo bypass
- [ ] **Location permissions prompt fires** correctly (both `whenInUse` and explanation)
- [ ] **Camera + photo library permissions** have `NSCameraUsageDescription` and `NSPhotoLibraryUsageDescription` in `app.config.js`
- [ ] **Push notification permissions** set up with Expo notification handler
- [ ] **All placeholder data is removed** from release build (or `IS_DEMO_MODE` guard is off)
- [ ] **Crash-free cold start** on iPhone SE (smallest support target)
- [ ] **No broken tabs** — all 5 tabs load without error in release mode
- [ ] **Deep links work** — `connectsphere://moments` etc. if implemented
- [ ] **Privacy policy URL is live**
- [ ] **Support email/URL is real and monitored**
- [ ] **App icon** — 1024×1024 PNG, no alpha, no rounded corners (App Store adds those)
- [ ] **No placeholder text** — no "lorem ipsum", "TODO", or test strings in UI

### Known App Store Rejection Triggers — Avoid These

| Risk | Check |
|---|---|
| Dating app with no age gate | ✅ Clerk requires DOB at signup — enforce 18+ |
| Location always-on without justification | Use `whenInUse` only, never `always` |
| Crashy on simulator | Test Release build on device before submit |
| Guideline 5.1.1 — Data collection disclosure | Privacy policy + App Privacy form in ASC |
| Guideline 1.2 — User-generated content moderation | Must have in-app report/block functionality |
| Guideline 4.3 — Spam/duplicate app | Single binary, multiple platforms = fine |

### In-App Report/Block (Required for Dating Apps)
- [ ] Block user button on every profile
- [ ] Report user with category selection (inappropriate content, spam, fake profile)
- [ ] Block hides user from all feed views including Moments
- [ ] Report goes to moderation queue (even if it's just an email for v1)

---

## Google Play Metadata

### Short Description (80 char max)
`Miami dating, communities & real-time Moments. Your city's social pulse.`

### Long Description
*(Same as App Store description — Google Play has no word limit)*

### Content Rating
**Teen** minimum (Google Play's equivalent of 17+ for dating)

### Required Google Play Declarations
- [ ] Does your app target children under 13? **No**
- [ ] Does your app include ads? **No** (for v1)
- [ ] Financial features? **No** (In-App Purchases for Pulse Pass — declare this)
- [ ] Location permission declaration in store listing
- [ ] Data safety form completed (equivalent to Apple's App Privacy)

---

## Pre-Launch Test Matrix

| Device | OS | Test |
|---|---|---|
| iPhone 15 Pro Max | iOS 17 | Full feature test + screenshots |
| iPhone SE 3rd gen | iOS 16 | Smallest viewport, performance |
| iPhone 14 | iOS 16 | Notch layout |
| Pixel 7 | Android 14 | Google Play compliance |
| Samsung Galaxy S23 | Android 13 | Most common Android |

---

## EAS Build Commands

```bash
# Development build (Expo Go replacement)
eas build --profile development --platform ios

# TestFlight beta
eas build --profile preview --platform ios
eas submit --platform ios --profile preview

# App Store release
eas build --profile production --platform ios
eas submit --platform ios --profile production
```

**`eas.json` profiles needed:**
```json
{
  "build": {
    "development": { "developmentClient": true, "distribution": "internal" },
    "preview": { "distribution": "internal", "ios": { "simulator": false } },
    "production": { "autoIncrement": true }
  }
}
```

---

## Launch Readiness Scorecard

| Area | Status | Notes |
|---|---|---|
| 5 tabs implemented | ✅ | Discover, Connect, Events, Spaces, Moments |
| Auth (Clerk) | ✅ | |
| Moments API (in-memory) | ✅ | Deploy to Render needed |
| Mock data suite | ✅ | `lib/mockData.ts` |
| App Store metadata | ✅ | This document |
| Privacy policy | ⬜ | Need live URL |
| Report/Block UI | ⬜ | Required for dating apps |
| Age gate (18+) | ⬜ | Enforce in Clerk signup |
| App icon (1024×1024) | ⬜ | Design needed |
| Push notifications | ⬜ | Expo notifications setup |
| EAS build configured | ⬜ | `eas.json` needed |
| TestFlight beta | ⬜ | After EAS build |
| App Store submission | ⬜ | After TestFlight signoff |

**Estimated to launch:** 3 blockers (privacy policy, report/block, app icon) + EAS build setup.
