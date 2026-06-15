/**
 * Push token registration + notification dispatch.
 * Stores Expo push tokens in db.json keyed by userId.
 * Sends push via Expo's Push API.
 */
import { Router } from "express";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { getAuth } from "@clerk/express";
import { sendPush } from "../lib/pushNotifications";
import { buildConnectThreadPush, isExpoPushToken, type ConnectPushKind } from "../lib/connectPushNotifications";

const router = Router();

const workspaceRoot = process.cwd().endsWith(join("artifacts", "api-server"))
  ? join(process.cwd(), "..", "..")
  : process.cwd();
const dbPath = join(workspaceRoot, "artifacts", "api-server", "db.json");

type PushTokenEntry = {
  userId: string;
  token: string;
  updatedAt: string;
};

type DbShape = {
  pushTokens?: PushTokenEntry[];
  [key: string]: unknown;
};

const SMOKE_KINDS = new Set<ConnectPushKind>(["message", "friend_accept", "plan_invite", "plan_join", "double_date_match"]);

function readDb(): DbShape {
  if (!existsSync(dbPath)) return {};
  try {
    return JSON.parse(readFileSync(dbPath, "utf-8"));
  } catch {
    return {};
  }
}

function writeDb(data: DbShape) {
  if (!existsSync(dirname(dbPath))) mkdirSync(dirname(dbPath), { recursive: true });
  writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// Internal helper: returns the latest token for a userId.
export function getPushToken(userId: string): string | null {
  return getPushTokenEntry(userId)?.token ?? null;
}

function getPushTokenEntry(userId: string): PushTokenEntry | null {
  const db = readDb();
  return (db.pushTokens ?? []).find((t) => t.userId === userId) ?? null;
}

function parseSmokeKind(value: unknown): ConnectPushKind {
  return typeof value === "string" && SMOKE_KINDS.has(value as ConnectPushKind)
    ? (value as ConnectPushKind)
    : "message";
}

router.post("/users/push-token", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { token } = req.body as { token?: string };
  if (!isExpoPushToken(token)) {
    return res.status(400).json({ error: "Invalid Expo push token" });
  }

  const db = readDb();
  const tokens: PushTokenEntry[] = db.pushTokens ?? [];
  const idx = tokens.findIndex((t) => t.userId === userId);
  const entry: PushTokenEntry = { userId, token, updatedAt: new Date().toISOString() };
  if (idx >= 0) tokens[idx] = entry;
  else tokens.push(entry);
  db.pushTokens = tokens;
  writeDb(db);

  return res.json({ ok: true, userId, updatedAt: entry.updatedAt });
});

// Dev helper for phone smoke tests. It can use the signed-in user's stored
// token or a raw token supplied by a temporary curl/Postman request.
router.post("/notify/test", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const targetUserId = typeof req.body?.userId === "string" && req.body.userId.trim()
    ? req.body.userId.trim()
    : userId;
  const bodyToken = typeof req.body?.token === "string" ? req.body.token.trim() : "";
  const entry = bodyToken ? null : getPushTokenEntry(targetUserId);
  const token = bodyToken || entry?.token;
  if (!isExpoPushToken(token)) {
    return res.status(404).json({
      error: "No valid Expo push token for this user",
      userId: targetUserId,
      hasStoredToken: Boolean(entry?.token),
    });
  }

  const kind = parseSmokeKind(req.body?.kind);
  const chatId =
    typeof req.body?.chatId === "string" && req.body.chatId.trim()
      ? req.body.chatId.trim()
      : "push-smoke-test";
  const title =
    typeof req.body?.title === "string" && req.body.title.trim()
      ? req.body.title.trim().slice(0, 80)
      : kind === "message"
        ? "ConnectSphere smoke test"
        : "It's a ConnectSphere match";
  const messageBody =
    typeof req.body?.body === "string" && req.body.body.trim()
      ? req.body.body.trim().slice(0, 160)
      : kind === "message"
        ? "Message push smoke test. Tap to open the chat."
        : "Match push smoke test. Tap to open the thread.";

  const payload = buildConnectThreadPush({
    to: token,
    kind,
    chatId,
    title,
    body: messageBody,
    data: {
      smokeTest: true,
      requestedBy: userId,
      targetUserId,
    },
  });

  const delivery = await sendPush(payload);
  if (!delivery.accepted) {
    return res.status(502).json({
      ok: false,
      error: "Expo push delivery was not accepted",
      userId: targetUserId,
      kind,
      chatId,
      delivery,
    });
  }

  return res.json({
    ok: true,
    userId: targetUserId,
    kind,
    chatId,
    tokenSource: bodyToken ? "request" : "stored",
    delivery,
    data: payload.data,
  });
});

export default router;
