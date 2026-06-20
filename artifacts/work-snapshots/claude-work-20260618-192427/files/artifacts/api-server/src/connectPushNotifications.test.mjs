import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

const sourcePath = resolve("artifacts/api-server/src/lib/connectPushNotifications.ts");
const outDir = mkdtempSync(join(tmpdir(), "connect-push-"));
const source = readFileSync(sourcePath, "utf8");
const js = source
  .replace(/import \{ sendPush, type PushMessage \} from "\.\/pushNotifications";\n\n/, "const sendPush = async () => {};\n\n")
  .replace(/export type [\s\S]*?;\n\n/g, "")
  .replace(/type [A-Za-z0-9_]+ = [\s\S]*?;\n\n/g, "")
  .replace(/: ConnectPushKind/g, "")
  .replace(/: ConnectThreadPushInput/g, "")
  .replace(/: PushMessage/g, "")
  .replace(/: Promise<void>/g, "")
  .replace(/: token is string/g, "")
  .replace(/: Record<string, unknown>/g, "")
  .replace(/: string/g, "")
  .replace(/: unknown/g, "")
  .replace(/ as const/g, "")
  .replace(/ satisfies Record<[^;]+;/g, ";");
writeFileSync(join(outDir, "connectPushNotifications.mjs"), js);

const mod = await import(pathToFileURL(join(outDir, "connectPushNotifications.mjs")).href);

test("buildConnectThreadPush deep-links every supported Connect event to the chat thread", () => {
  const cases = [
    ["message", "Maya", "See you soon"],
    ["friend_accept", "Maya", "Maya accepted - say hi"],
    ["plan_invite", "Dinner plan", "Maya invited you to Dinner"],
    ["plan_join", "Dinner plan", "Omar joined Dinner"],
    ["double_date_match", "Double Date Match", "Your group chat is ready"],
  ];

  for (const [kind, title, body] of cases) {
    const payload = mod.buildConnectThreadPush({
      kind,
      to: "ExponentPushToken[test-token]",
      chatId: "chat-123",
      title,
      body,
      data: { refId: `${kind}-ref` },
    });

    assert.equal(payload.to, "ExponentPushToken[test-token]");
    assert.equal(payload.title, title);
    assert.equal(payload.body, body);
    assert.equal(payload.sound, "default");
    assert.deepEqual(payload.data, {
      refId: `${kind}-ref`,
      type: kind,
      chatId: "chat-123",
      matchId: "chat-123",
      screen: "connect_thread",
      url: "/chat/chat-123",
    });
  }
});

test("isExpoPushToken accepts both Expo token prefixes used by current devices", () => {
  assert.equal(mod.isExpoPushToken("ExponentPushToken[legacy-token]"), true);
  assert.equal(mod.isExpoPushToken("ExpoPushToken[current-token]"), true);
  assert.equal(mod.isExpoPushToken(""), false);
  assert.equal(mod.isExpoPushToken("apns-token"), false);
});
