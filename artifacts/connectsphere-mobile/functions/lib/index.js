"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.withdrawReaction = exports.onMatchCreated = exports.pushNotifyMatch = exports.pushRegister = exports.aiShotAssist = exports.usernameClaim = exports.usernameCheck = exports.accountDelete = exports.accountDeletionRequest = exports.accountExport = exports.moderatePhoto = void 0;
var moderatePhoto_1 = require("./moderatePhoto");
Object.defineProperty(exports, "moderatePhoto", { enumerable: true, get: function () { return moderatePhoto_1.moderatePhoto; } });
// Account management — GDPR export, soft deletion, hard delete
var account_1 = require("./account");
Object.defineProperty(exports, "accountExport", { enumerable: true, get: function () { return account_1.accountExport; } });
Object.defineProperty(exports, "accountDeletionRequest", { enumerable: true, get: function () { return account_1.accountDeletionRequest; } });
Object.defineProperty(exports, "accountDelete", { enumerable: true, get: function () { return account_1.accountDelete; } });
// Profile utils — username availability check + atomic claim
var profiles_1 = require("./profiles");
Object.defineProperty(exports, "usernameCheck", { enumerable: true, get: function () { return profiles_1.usernameCheck; } });
Object.defineProperty(exports, "usernameClaim", { enumerable: true, get: function () { return profiles_1.usernameClaim; } });
// AI-powered icebreaker / Shot opener generation
var aiShot_1 = require("./aiShot");
Object.defineProperty(exports, "aiShotAssist", { enumerable: true, get: function () { return aiShot_1.aiShotAssist; } });
// Push notifications — token registration, match alert, Firestore trigger
var push_1 = require("./push");
Object.defineProperty(exports, "pushRegister", { enumerable: true, get: function () { return push_1.pushRegister; } });
Object.defineProperty(exports, "pushNotifyMatch", { enumerable: true, get: function () { return push_1.pushNotifyMatch; } });
Object.defineProperty(exports, "onMatchCreated", { enumerable: true, get: function () { return push_1.onMatchCreated; } });
// Reactions — withdraw (rewind undo) before the other person acts
var reactions_1 = require("./reactions");
Object.defineProperty(exports, "withdrawReaction", { enumerable: true, get: function () { return reactions_1.withdrawReaction; } });
//# sourceMappingURL=index.js.map