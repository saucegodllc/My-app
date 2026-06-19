# Backend Setup Guide

Everything you need to get the full stack running locally and deploy to production.

---

## Quick Start (local dev — no database needed)

```bash
# 1. From the repo root, install dependencies (one-time)
pnpm install

# 2. Start the API server (Windows)
start-api.bat

# 2. Start the API server (Mac / Linux)
bash start-api.sh

# 3. In a separate terminal, start the mobile app
cd artifacts/connectsphere-mobile
pnpm start
```

The server starts on **http://localhost:8080** with `CONNECTSPHERE_LOCAL_DB_FALLBACK=1` — all routes work using a local `db.json` file instead of Postgres.

---

## Firebase Setup (required for auth + Firestore + Storage + Cloud Functions)

### 1. Create a Firebase project

1. Go to https://console.firebase.google.com → **Add project**
2. Enable **Firestore**, **Storage**, and **Authentication** (Email/Password)
3. Go to **Project Settings → Your apps → Add app → Web** and copy the config

### 2. Add Firebase config to the mobile app

Edit `artifacts/connectsphere-mobile/.env.local` and fill in:

```
EXPO_PUBLIC_FIREBASE_API_KEY=AIza...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

### 3. Update `.firebaserc`

Edit `artifacts/connectsphere-mobile/.firebaserc`:
```json
{
  "projects": {
    "default": "your-project-id"
  }
}
```

### 4. Deploy Firebase Security Rules + Indexes

```bash
cd artifacts/connectsphere-mobile
npx firebase-tools deploy --only firestore:rules,firestore:indexes,storage
```

### 5. Deploy Cloud Functions

```bash
cd artifacts/connectsphere-mobile
npx firebase-tools deploy --only functions
```

Functions deployed:
- `usernameCheck` / `usernameClaim` — username uniqueness
- `moderatePhoto` — SafeSearch content moderation
- `pushRegister` / `pushNotifyMatch` — push notifications
- `onMatchCreated` — real-time match trigger
- `withdrawReaction` — undo swipe
- `aiShotAssist` — AI photo analysis
- `accountExport` / `accountDeletionRequest` / `accountDelete` — GDPR

---

## Production Postgres (required for production launch)

Discovery, matches, messages, and blocking all use PostgreSQL via Drizzle ORM. The local JSON fallback is dev-only.

### Get a free database (Neon — recommended)

1. Sign up free at https://neon.tech
2. Create a new project → copy the **Connection string**
3. Edit `artifacts/api-server/.env.local`:
   ```
   CONNECTSPHERE_LOCAL_DB_FALLBACK=0
   DATABASE_URL=postgres://user:pass@host/db?sslmode=require
   ```
4. Push the schema:
   ```bash
   cd lib/db
   DATABASE_URL="postgres://..." pnpm run push
   ```

### Alternative free options
- **Supabase** — https://supabase.com (includes Auth, Storage, Realtime)
- **Railway** — https://railway.app (deploy the whole API server + Postgres in one click)

---

## OpenAI (AI features)

Needed for: AI Bio writer, AI Shot Assist, AI opener suggestions.

1. Get a key at https://platform.openai.com/api-keys
2. Add to `artifacts/api-server/.env.local`:
   ```
   OPENAI_API_KEY=sk-...
   ```

---

## Deploying the API server to production

### Railway (easiest — one click)

1. Push this repo to GitHub
2. Go to https://railway.app → **New Project → Deploy from GitHub repo**
3. Select `artifacts/api-server` as the root
4. Add all env vars from `.env.local` to the Railway dashboard
5. Set `NODE_ENV=production` and `CONNECTSPHERE_LOCAL_DB_FALLBACK=0`
6. Railway auto-builds with `pnpm run build` and runs `node ./dist/index.mjs`

After deploy, copy the Railway URL (e.g. `https://api.up.railway.app`) and set in the mobile app:
```
EXPO_PUBLIC_API_URL=https://api.up.railway.app
```

### Other options
- **Render** — https://render.com (free tier, similar to Railway)
- **Fly.io** — https://fly.io (`fly launch` from `artifacts/api-server/`)
- **AWS App Runner / GCP Cloud Run** — containerized, scales to zero

---

## Environment Variable Reference

### `artifacts/api-server/.env.local`

| Variable | Required | Description |
|---|---|---|
| `PORT` | ✅ | Server port (use 8080) |
| `NODE_ENV` | ✅ | `development` or `production` |
| `CLERK_SECRET_KEY` | ✅ | From Clerk Dashboard → API Keys |
| `DATABASE_URL` | Prod only | Postgres connection string |
| `CONNECTSPHERE_LOCAL_DB_FALLBACK` | Dev | Set `1` to skip DB in dev |
| `OPENAI_API_KEY` | AI features | OpenAI API key |
| `TICKETMASTER_API_KEY` | Events | Already set |
| `EVENTBRITE_PRIVATE_TOKEN` | Events | Already set |
| `STRIPE_SECRET_KEY` | Subscriptions | Stripe test/live secret |
| `STRIPE_WEBHOOK_SECRET` | Subscriptions | From Stripe dashboard |

### `artifacts/connectsphere-mobile/.env.local`

| Variable | Required | Description |
|---|---|---|
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ | Already set |
| `EXPO_PUBLIC_DOMAIN` | ✅ | `localhost:8080` (local) |
| `EXPO_PUBLIC_API_URL` | Prod | Full API URL (overrides DOMAIN) |
| `EXPO_PUBLIC_FIREBASE_*` | ✅ | Firebase web app config |

---

## Verifying everything works

```bash
# Health check
curl http://localhost:8080/api/healthz

# Should return: {"status":"ok"}
```
