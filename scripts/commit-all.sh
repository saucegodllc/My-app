#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# commit-all.sh  —  Stage the worktree into logical commits
#
# Run this from the repo root in Git Bash (or WSL):
#   bash scripts/commit-all.sh
#
# Prerequisites: close VS Code / GitHub Desktop so no index.lock is held.
# ─────────────────────────────────────────────────────────────────────────────
set -e
cd "$(git rev-parse --show-toplevel)"

git() {
  if [ "$1" = "commit" ]; then
    command git "$@" || {
      if command git diff --cached --quiet; then
        echo "  (no staged changes; skipping commit)"
        return 0
      fi
      return 1
    }
    return 0
  fi
  command git "$@"
}

echo "🔍 Checking for stale index lock..."
[ -f .git/index.lock ] && rm -f .git/index.lock && echo "  removed stale lock"

# ─── 1. Tooling / root config ─────────────────────────────────────────────────
echo ""
echo "📦 [1/10] chore: gitignore, root config, CI"
git add \
  .gitignore \
  .npmrc \
  render.yaml \
  .github/
git commit -m "chore: gitignore _replit_import, coverage, tmp dirs; add CI config"

# ─── 2. Infra — Render + Railway + Docker ─────────────────────────────────────
echo ""
echo "🏗️  [2/10] chore(infra): Dockerfile, railway, render.yaml, start scripts"
git add \
  artifacts/api-server/Dockerfile \
  artifacts/api-server/railway.toml \
  artifacts/render.yaml
git add -f \
  start-api.sh \
  start-api.bat \
  start-expo-go-*.ps1 \
  start-expo-go-*.bat 2>/dev/null || true
git commit -m "chore(infra): add Dockerfile, railway.toml, render.yaml; dev start scripts"

# ─── 3. DB schema ─────────────────────────────────────────────────────────────
echo ""
echo "🗄️  [3/10] feat(db): sparkMemory + pushTokens schema"
git add \
  lib/db/src/schema/sparkMemory.ts \
  lib/db/src/schema/pushTokens.ts
git commit -m "feat(db): add sparkMemory and pushTokens tables

sparkMemory: per-user summarized Spark conversation history (5 rows max).
pushTokens: stores Expo push tokens per user for notification delivery."

# ─── 4. API — Spark AI upgrade ────────────────────────────────────────────────
echo ""
echo "🤖 [4/10] feat(api): Spark/Vibe AI companion upgrade"
git add \
  artifacts/api-server/src/routes/aiChat.ts \
  artifacts/api-server/src/lib/monitoring.ts \
  artifacts/api-server/src/lib/featureFlags.ts
git commit -m "feat(api): Spark AI upgrade — Sonnet model, mood pre-pass, DB memory, paywall

- Model: claude-haiku → claude-sonnet-4-6 (main), haiku (mood pre-pass)
- Rate limit: 5 msg/hr free, unlimited for isPremium===true
- User context: profile injected into system prompt
- Mood detection: Haiku pre-pass on last 2 messages
- Session memory: DB-backed summaries via sparkMemory table
- Paywall: msg 5 soft nudge, msg 6+ HTTP 402 {paywallPrompt:true}"

# ─── 5. API — new routes ──────────────────────────────────────────────────────
echo ""
echo "🛣️  [5/10] feat(api): moments, notifications, anti-ghost, daily-spark routes"
git add \
  artifacts/api-server/src/routes/moments.ts \
  artifacts/api-server/src/routes/notifications.ts \
  artifacts/api-server/src/routes/antiGhostNudge.ts \
  artifacts/api-server/src/routes/dailySpark.ts \
  artifacts/api-server/src/routes/icebreakers.ts \
  artifacts/api-server/src/routes/me.ts \
  artifacts/api-server/src/routes/account.ts \
  artifacts/api-server/src/routes/matchesBatching.ts \
  artifacts/api-server/src/routes/index.ts \
  artifacts/api-server/src/middlewares/rateLimit.ts \
  artifacts/api-server/src/middlewares/requireAuth.ts \
  artifacts/api-server/src/lib/pushNotifications.ts \
  artifacts/api-server/src/lib/connectPushNotifications.ts \
  artifacts/api-server/src/lib/matchThreads.ts \
  artifacts/api-server/src/lib/operationalStore.ts \
  artifacts/api-server/src/app.ts \
  artifacts/api-server/src/index.ts \
  artifacts/api-server/src/socket.ts \
  artifacts/api-server/src/routes/dating.ts \
  artifacts/api-server/src/routes/events.ts \
  artifacts/api-server/src/routes/friends.ts \
  artifacts/api-server/src/routes/matches.ts \
  artifacts/api-server/src/routes/messages.ts \
  artifacts/api-server/src/routes/profiles.ts \
  artifacts/api-server/src/routes/discovery.ts \
  artifacts/api-server/src/routes/doubleDate.ts \
  artifacts/api-server/src/routes/subscriptions.ts \
  artifacts/api-server/src/routes/reports.ts \
  artifacts/api-server/src/routes/bio.ts \
  artifacts/api-server/src/routes/resume.ts \
  artifacts/api-server/src/routes/storage.ts \
  artifacts/api-server/src/routes/authServer.ts \
  artifacts/api-server/src/lib/stripeClient.ts \
  artifacts/api-server/src/launchGuards.ts \
  artifacts/api-server/package.json \
  artifacts/api-server/tsconfig.json \
  artifacts/api-server/build.mjs \
  artifacts/api-server/.env.example \
  artifacts/api-server/jest.config.cjs \
  artifacts/api-server/scripts/ \
  artifacts/api-server/events-cache.json
git commit -m "feat(api): add moments, notifications, anti-ghost, daily-spark, icebreakers routes

New routes: moments, notifications, antiGhostNudge, dailySpark, icebreakers,
me, account, matchesBatching. New middleware: rateLimit, requireAuth.
New libs: pushNotifications, connectPushNotifications, matchThreads,
operationalStore, featureFlags, launchGuards."

# ─── 6. API — test suite ──────────────────────────────────────────────────────
echo ""
echo "🧪 [6/10] test(api): server-side test suites"
git add \
  artifacts/api-server/src/auth401.test.ts \
  artifacts/api-server/src/bio.test.mjs \
  artifacts/api-server/src/connectPushNotifications.test.mjs \
  artifacts/api-server/src/friendsMatchRouting.test.ts \
  artifacts/api-server/src/inboxRoutes.test.ts \
  artifacts/api-server/src/launchOps.test.mjs \
  artifacts/api-server/src/matchThreads.test.ts \
  artifacts/api-server/src/routes/events.test.ts \
  artifacts/api-server/src/routes/icebreakers.test.ts \
  artifacts/api-server/src/routes/stripe.webhook.test.ts \
  artifacts/api-server/test/ \
  artifacts/api-server/tests/
git commit -m "test(api): add auth, bio, push, friends, inbox, matchThreads, stripe test suites"

# ─── 7. Mobile — new screens + _layout ────────────────────────────────────────
echo ""
echo "📱 [7/10] feat(mobile): new screens — Moments, Matches upgrade, nested screens"
git add \
  artifacts/connectsphere-mobile/app/\(tabs\)/moments.tsx \
  artifacts/connectsphere-mobile/app/\(tabs\)/communities.tsx \
  artifacts/connectsphere-mobile/app/\(tabs\)/matches.tsx \
  artifacts/connectsphere-mobile/app/\(tabs\)/index.tsx \
  artifacts/connectsphere-mobile/app/\(tabs\)/events.tsx \
  artifacts/connectsphere-mobile/app/\(tabs\)/profile.tsx \
  artifacts/connectsphere-mobile/app/\(tabs\)/_layout.tsx \
  artifacts/connectsphere-mobile/app/_layout.tsx \
  artifacts/connectsphere-mobile/app/index.tsx \
  artifacts/connectsphere-mobile/app/blocked-users.tsx \
  artifacts/connectsphere-mobile/app/likes-you.tsx \
  artifacts/connectsphere-mobile/app/profile-views.tsx \
  artifacts/connectsphere-mobile/app/referral.tsx \
  artifacts/connectsphere-mobile/app/premium.tsx \
  artifacts/connectsphere-mobile/app/settings.tsx \
  artifacts/connectsphere-mobile/app/onboarding.tsx \
  artifacts/connectsphere-mobile/app/congrats.tsx \
  artifacts/connectsphere-mobile/app/chat/ \
  artifacts/connectsphere-mobile/app/legal/ \
  artifacts/connectsphere-mobile/app/communities/ \
  artifacts/connectsphere-mobile/app/invite/ \
  artifacts/connectsphere-mobile/app/u/ \
  artifacts/connectsphere-mobile/app/\(auth\)/
git commit -m "feat(mobile): Moments tab, Matches upgrade, nested screens

- New tab: Moments (full screen with feed, viewer, like/echo actions)
- New tab: Communities (placeholder)
- Matches: chatId-first routing fix, Moment Requests section, Likes section
- New screens: blocked-users, likes-you, profile-views, referral
- New nested routes: legal/privacy, legal/terms, communities/*, invite/*, u/*
- _layout.tsx: all new routes registered
- app/index.tsx: auth + onboarding guards"

# ─── 8. Mobile — components + lib + hooks + services ─────────────────────────
echo ""
echo "🧩 [8/10] feat(mobile): new components, libs, hooks, services"
git add \
  artifacts/connectsphere-mobile/components/ \
  artifacts/connectsphere-mobile/lib/ \
  artifacts/connectsphere-mobile/hooks/ \
  artifacts/connectsphere-mobile/services/ \
  artifacts/connectsphere-mobile/store/ \
  artifacts/connectsphere-mobile/constants/ \
  artifacts/connectsphere-mobile/assets/sounds/ \
  artifacts/connectsphere-mobile/shims/ \
  artifacts/connectsphere-mobile/app/chat/chatFreshness.ts \
  artifacts/connectsphere-mobile/app/chat/chatFreshness.test.mjs
git commit -m "feat(mobile): new components, libs, hooks, services

Components: PushTokenRegistrar, ReportBlockSheet, MatchesSpotlightRow,
ProfileActionBar, DiscoveryFilters, LegalDocumentScreen, ShotAssist,
VibeCheckQuiz, VibeRevealScreen, TypingIndicator, GifPicker, etc.

Libs: routes.ts (openChat/openProfile/openPremium), featureFlags, premiumAccess,
mockData, discoverActionRail, swipeCounter, swipeStreak, sounds, analytics,
retentionFeatures, legalDocuments, offlineQueue, launchConfig.

Hooks: useFeatureUnlock, useIcebreakers, usePersistentBoost, useSessionState,
useUnreadCount.

Services: connectApi, connectIncoming, communitiesApi, blockedUsersApi, chatSignals."

# ─── 9. Mobile — test suite ───────────────────────────────────────────────────
echo ""
echo "🧪 [9/10] test(mobile): routing + dead-button test suites"
git add \
  artifacts/connectsphere-mobile/__tests__/ \
  artifacts/connectsphere-mobile/__mocks__/ \
  artifacts/connectsphere-mobile/jest.config.js \
  artifacts/connectsphere-mobile/jest.setup.js \
  artifacts/connectsphere-mobile/services/connectIncoming.test.ts
git commit -m "test(mobile): routing completeness and dead-button regression suites

Tests:
- momentsSilentButtons.test.tsx  — Echo Alert + handleLike flash contracts
- matchesMomentAccept.test.ts    — accept() 800ms navigate regression
- authRouting.test.ts            — 4 splash routing branches incl. edge cases
- notificationRouting.test.ts    — all 3 push notification data shapes
- spotlightRowRouting.test.ts    — chatId-first match card fix"

# ─── 10. Mobile config + docs ─────────────────────────────────────────────────
echo ""
echo "📝 [10/10] chore(mobile): config, EAS, Firebase, docs"
git add \
  artifacts/connectsphere-mobile/app.config.js \
  artifacts/connectsphere-mobile/app.json \
  artifacts/connectsphere-mobile/eas.json \
  artifacts/connectsphere-mobile/.env.example \
  artifacts/connectsphere-mobile/firebase.json \
  artifacts/connectsphere-mobile/.firebaserc \
  artifacts/connectsphere-mobile/firestore.indexes.json \
  artifacts/connectsphere-mobile/firestore.rules \
  artifacts/connectsphere-mobile/storage.rules \
  artifacts/connectsphere-mobile/functions/ \
  artifacts/connectsphere-mobile/scripts/ \
  artifacts/connectsphere-mobile/docs/ \
  artifacts/connectsphere-mobile/TAP_MATRIX.md \
  artifacts/connectsphere-mobile/user/\[userId\].tsx 2>/dev/null || true \
  artifacts/DEPLOY_CHECKLIST.md \
  artifacts/TESTING_STRATEGY.md \
  CLAUDE.md \
  BACKEND_SETUP.md \
  COMPETITIVE_PLAN.md \
  LAUNCH_CHECKLIST.md \
  PRODUCT_CONCEPT_MIAMI_MAP.md \
  SPEC_CHAT_SHOT_VOICE_UX.md \
  docs/ \
  e2e/ \
  scripts/ \
  artifacts/work-snapshots/
git commit -m "chore: app config, EAS, Firebase, docs, TAP_MATRIX, CLAUDE.md

- app.config.js / eas.json: EAS build + OTA update config
- Firebase: firestore rules, indexes, storage rules, functions
- TAP_MATRIX.md: full tap coverage matrix for all 5 tabs (~95 elements)
- CLAUDE.md: session notes, architecture decisions, gotchas
- docs/: ADRs, launch checklist, legal docs, testing strategy"

# ─── Untracked Replit web app pages ──────────────────────────────────────────
git add \
  artifacts/connectsphere/src/pages/admin-moderation.tsx \
  artifacts/connectsphere/src/pages/legal.tsx 2>/dev/null || true
git diff --cached --name-only | grep -q "." && \
  git commit -m "feat(web): admin moderation and legal pages" || \
  echo "  (no web pages to commit)"

echo ""
echo "✅ Done! Commits created:"
git log --oneline -12
