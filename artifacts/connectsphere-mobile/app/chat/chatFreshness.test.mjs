import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

function transpileTsForTest(source) {
  return source
    .replace(/export type [\s\S]*?};\n\n/g, "")
    .replace(/: ChatFreshnessMessage\[\]/g, "")
    .replace(/: string/g, "")
    .replace(/: boolean/g, "")
    .replace(/\): [A-Za-z0-9_<>, \[\]\|]+/g, ")")
    .replace(/ as const/g, "");
}

test("system-only messages still count as a fresh chat", async () => {
  const outDir = mkdtempSync(join(tmpdir(), "chat-freshness-"));
  const source = readFileSync(resolve("artifacts/connectsphere-mobile/app/chat/chatFreshness.ts"), "utf8");
  writeFileSync(join(outDir, "chatFreshness.mjs"), transpileTsForTest(source));
  const mod = await import(pathToFileURL(join(outDir, "chatFreshness.mjs")).href);

  assert.equal(mod.hasUserMessages([{ id: "sys", senderId: "system", content: "You matched.", system: true }]), false);
  assert.equal(mod.hasUserMessages([{ id: "user", senderId: "user_self", content: "Hey" }]), true);
});
