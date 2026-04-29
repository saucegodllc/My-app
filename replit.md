# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Project: ConnectSphere

A full-featured global social platform for dating, friendships, and professional networking. Open to users 16+, monetized via Stripe premium subscriptions.

### Architecture

- **Frontend**: React + Vite SPA at `artifacts/connectsphere/` (violet/rose theme, Clerk auth)
- **Backend**: Express 5 REST API at `artifacts/api-server/` (Clerk JWT middleware, Drizzle ORM)
- **Database**: PostgreSQL via `lib/db/` (profiles, matches, messages, reports, blocks tables)
- **API Contract**: OpenAPI spec at `lib/api-spec/` → codegen to `lib/api-zod/` + `lib/api-client-react/`
- **Auth**: Clerk (web SDK + Express middleware via `@clerk/express`)
- **Payments**: Stripe via `stripe-replit-sync` integration
- **Storage**: Replit Object Storage via `lib/object-storage-web/` (presigned URL upload flow)

### Frontend Pages

| Route | Page |
|-------|------|
| `/` | Landing page with marketing copy |
| `/sign-in`, `/sign-up` | Clerk auth pages |
| `/onboarding` | 4-step profile wizard |
| `/discover` | Swipe-based discovery with filters |
| `/matches` | Matches list |
| `/messages/:matchId` | Chat thread |
| `/dashboard` | Stats & activity |
| `/premium` | Upgrade page with Stripe checkout |
| `/profile/me` | Edit own profile + photo upload |
| `/profile/:userId` | View others + report/block |
| `/settings` | Account, subscription management, blocked users |

### API Routes (all under `/api`)

- `GET/POST /profiles/me` — upsert & fetch own profile
- `GET /profiles/:userId` — public profile view
- `GET /discovery` — filtered profile discovery
- `GET/POST /matches` — match list + create match
- `GET/POST /messages/:matchId` — chat messages
- `GET /subscriptions/status`, `POST /subscriptions/checkout`, `POST /subscriptions/portal` — Stripe billing
- `GET /subscriptions/products` — Stripe products list
- `POST /stripe/webhook` — Stripe webhook handler
- `POST /reports` — report a user
- `POST /blocks` — block a user
- `GET /blocks` — list blocked users
- `DELETE /blocks/:userId` — unblock
- `GET /dashboard/stats` — dashboard stats
- `POST /storage/uploads/request-url` — presigned upload URL

### Mobile App (Expo / React Native)

- **Location**: `artifacts/connectsphere-mobile/`
- **Stack**: Expo 54 + React Native + expo-router 6
- **Auth**: `@clerk/clerk-expo` — key auto-forwarded from `VITE_CLERK_PUBLISHABLE_KEY` in dev script
- **Payments**: `react-native-purchases` (RevenueCat) — configure with `EXPO_PUBLIC_REVENUECAT_APPLE_KEY` / `EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY`
- **API**: Shared `@workspace/api-client-react` hooks; base URL = `EXPO_PUBLIC_DOMAIN` (set to `REPLIT_DEV_DOMAIN` in dev)

#### Mobile Screens
| Route | Screen |
|-------|--------|
| `/(auth)/welcome` | Animated welcome with floating orbs |
| `/(auth)/sign-in` | Email + password sign-in |
| `/(auth)/sign-up` | Registration + email verification |
| `/onboarding` | 4-step profile wizard (bio, location, intent, interests) |
| `/(tabs)/` | Discover — PanResponder swipe cards with like/pass/superlike |
| `/(tabs)/matches` | Matches list + new match horizontal scroll |
| `/(tabs)/profile` | Own profile + premium upgrade prompt |
| `/chat/[matchId]` | Real-time chat with inverted FlatList |
| `/user/[userId]` | Full-screen profile view |
| `/premium` | RevenueCat offerings + feature list |
| `/settings` | Account, discovery prefs, sign-out |

#### Expo Go QR Code
The Metro bundler prints a QR code URL in the `connectsphere-mobile: expo` workflow logs. Scan it with Expo Go (iOS Camera or Android Expo Go app) to run on a real device.

### Stripe Products
Not yet seeded — see follow-up task #2 to create Premium Monthly/Annual plans.
