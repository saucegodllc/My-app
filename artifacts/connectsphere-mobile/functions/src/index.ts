/**
 * ConnectSphere Cloud Functions — entry point
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  Function                   │ Trigger           │ Route                      │
 * ├──────────────────────────────────────────────────────────────────────────────┤
 * │  moderatePhoto              │ Storage onFinalize │ (auto)                     │
 * │  accountExport              │ HTTPS POST         │ /api/account/export        │
 * │  accountDeletionRequest     │ HTTPS POST         │ /api/account/deletion-request│
 * │  accountDelete              │ HTTPS POST         │ /api/account/delete        │
 * │  usernameCheck              │ HTTPS GET          │ /api/profiles/username/check│
 * │  usernameClaim              │ HTTPS POST         │ /api/profiles/username/claim│
 * │  aiShotAssist               │ HTTPS POST         │ /api/ai/shot-assist        │
 * │  pushRegister               │ HTTPS POST         │ /api/push/register         │
 * │  pushNotifyMatch            │ HTTPS POST         │ /api/push/notify-match     │
 * │  onMatchCreated             │ Firestore trigger  │ matches/{matchId}          │
 * │  withdrawReaction           │ HTTPS POST         │ /api/inbox/reactions/withdraw│
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * Deploy all:         cd functions && npm run deploy
 * Deploy one:         firebase deploy --only functions:aiShotAssist
 *
 * Required env vars (Secret Manager or `firebase functions:config:set`):
 *   OPENAI_API_KEY            — GPT-4o-mini for shot assist
 *   INTERNAL_FUNCTION_SECRET  — server-to-server auth for pushNotifyMatch
 */

export { moderatePhoto } from "./moderatePhoto";

// Account management — GDPR export, soft deletion, hard delete
export { accountExport, accountDeletionRequest, accountDelete } from "./account";

// Profile utils — username availability check + atomic claim
export { usernameCheck, usernameClaim } from "./profiles";

// AI-powered icebreaker / Shot opener generation
export { aiShotAssist } from "./aiShot";

// Push notifications — token registration, match alert, Firestore trigger
export { pushRegister, pushNotifyMatch, onMatchCreated } from "./push";

// Reactions — withdraw (rewind undo) before the other person acts
export { withdrawReaction } from "./reactions";
