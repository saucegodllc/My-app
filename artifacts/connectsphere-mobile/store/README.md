# ConnectSphere Store Review Packet

This folder is the launch source of truth for EAS builds, store metadata, screenshots, release notes, and privacy disclosures.

## Build And Submit

- Development: `eas build --profile development --platform ios` or `--platform android`
- Preview: `eas build --profile preview --platform all`
- Production: `eas build --profile production --platform all`
- Submit preview: `eas submit --profile preview --platform all`
- Submit production: `eas submit --profile production --platform all`

Required production secrets:

- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_SENTRY_DSN`
- `EXPO_PUBLIC_PROJECT_ID`
- `SENTRY_ORG`
- `SENTRY_PROJECT`
- `SENTRY_AUTH_TOKEN`
- `EXPO_PUBLIC_POSTHOG_KEY`
- `EXPO_PUBLIC_POSTHOG_HOST`
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`, when premium is enabled
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`, when premium is enabled
- Google services files for Firebase or push credentials, when enabled

## Pre-Submit Checklist

- `pnpm run typecheck`
- `pnpm --filter @workspace/api-server run build`
- `eas build --profile preview --platform all`
- Confirm Settings includes account deletion, data export, privacy controls, Safety Center, policies, guidelines, and support.
- Confirm blocked users cannot discover, message, invite, match, join via share links, or receive pushes from each other.
- Confirm reports appear in the moderation queue and can move from `open` to `reviewing` to `resolved`.
- Confirm Sentry and PostHog are disabled without config or consent, then emit tagged release events once enabled.
- Confirm Privacy Labels and Google Play Data Safety answers match `privacy-data-inventory.md`.

## Screenshot Checklist

- Onboarding final profile screen
- Discover profile card with safety controls visible
- Connect thread deep-link destination
- Plans invite and join screen
- Double-date match screen
- Settings privacy and account deletion screen
- Safety Center and reporting flow

## Review URLs

- Privacy Policy: `https://connectsphere.app/legal/privacy`
- Terms: `https://connectsphere.app/legal/terms`
- Community Guidelines: `https://connectsphere.app/legal/community-guidelines`
- Safety Center: `https://connectsphere.app/safety`
- Support: `support@connectsphere.app`
- Data deletion: `https://connectsphere.app/legal/privacy#account-deletion`

Public web routes are implemented in the ConnectSphere web app for `/legal/privacy`, `/legal/terms`, `/legal/community-guidelines`, and `/safety`.
