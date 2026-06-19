# SDK And Data Inventory

Use this file to fill Apple App Store Privacy Labels and Google Play Data Safety. Keep it current whenever an SDK or data flow changes.

## SDKs

| SDK | Purpose | Data Categories | Linked To User | Used For Tracking |
| --- | --- | --- | --- | --- |
| Clerk | Authentication and account identity | User ID, email/phone if enabled, auth tokens, device/session metadata | Yes | No |
| Sentry | Crash/error monitoring | Crash logs, device info, app version, release, user ID when signed in | Yes, when configured | No |
| PostHog | Product analytics behind consent | Events, feature flags, invite/purchase/report/block events, device/app info | Yes, after consent | No third-party ad tracking |
| RevenueCat | Premium subscriptions | Purchase status, product identifiers, app user ID | Yes | No |
| Firebase | Push/supporting platform services if configured | Installation ID, cloud messaging token, diagnostics | Yes | No |
| Expo Notifications | Push notifications | Expo push token, device notification settings | Yes | No |
| Expo Location | Location-based matching and plans | Approximate or precise location, depending on user control | Yes | No |
| Camera/Liveness | Profile trust and verification | Camera frames, liveness result, device metadata | Yes | No |
| Photos/Media | Profile photos and plan media | Uploaded images, file metadata | Yes | No |
| Payments/App Stores | Subscriptions and receipts | Purchase history, receipt/token, country/storefront | Yes | No |

## Data Categories For Store Forms

- Contact Info: account email or phone, if Clerk sign-in method uses it.
- Identifiers: user ID, Clerk ID, Expo push token, RevenueCat app user ID, PostHog distinct ID after consent.
- Purchases: subscription status and receipt metadata.
- Location: approximate or precise location depending on the Settings privacy control.
- User Content: profile text, bio, photos, messages, plans, reports, support requests.
- Usage Data: onboarding completion, invite sent/opened/joined, push opt-in, reports/blocks, purchase events after consent.
- Diagnostics: crashes, performance traces, API errors, push failures.
- Sensitive Safety Data: reports, blocks, abuse logs, moderation notes.

## Consent And Retention

- Analytics starts disabled until the user opts in from Settings.
- Sentry starts disabled unless a DSN is configured; release, environment, and user tags are attached only after initialization.
- Account deletion removes or anonymizes profile, photos, messages, plans, push tokens, and sessions where supported.
- Reports, payment records, and security logs may be retained when needed for safety, fraud prevention, tax, dispute, or legal obligations.

## Review Answers

- Data deletion URL: `https://connectsphere.app/legal/privacy#account-deletion`
- Account deletion in app: Settings > Privacy & Safety > Delete account.
- Data export in app: Settings > Privacy & Safety > Request my data.
- Analytics opt-in/out: Settings > Privacy & Safety > Help improve ConnectSphere.
- Location precision control: Settings > Privacy & Safety.
- Support contact: `support@connectsphere.app`
