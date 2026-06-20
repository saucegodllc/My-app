import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

function transpileTsForTest(source) {
  return source
    .replace(/export type [\s\S]*?;\n\n/g, "")
    .replace(/type [A-Za-z0-9_]+ = [\s\S]*?;\n\n/g, "")
    .replace(/: Record<FeatureFlagKey, boolean>/g, "")
    .replace(/: Record<FeatureFlagKey, string>/g, "")
    .replace(/: Record<string, string \| undefined>/g, "")
    .replace(/: Record<string, boolean>/g, "")
    .replace(/value: string \| undefined/g, "value")
    .replace(/: FeatureFlagKey/g, "")
    .replace(/: string/g, "")
    .replace(/: boolean/g, "")
    .replace(/: unknown/g, "")
    .replace(/\): [A-Za-z0-9_<>, \[\]\|]+/g, ")")
    .replace(/ as const/g, "")
    .replace(/ as [A-Za-z0-9_<>, \[\]\|]+/g, "");
}

test("feature flags parse enabled and disabled env values with safe defaults", async () => {
  const outDir = mkdtempSync(join(tmpdir(), "feature-flags-"));
  const source = readFileSync(resolve("artifacts/api-server/src/lib/featureFlags.ts"), "utf8");
  writeFileSync(join(outDir, "featureFlags.mjs"), transpileTsForTest(source));
  const mod = await import(pathToFileURL(join(outDir, "featureFlags.mjs")).href);

  const flags = mod.resolveFeatureFlags({
    CONNECTSPHERE_FEATURE_DOUBLE_DATE: "false",
    CONNECTSPHERE_FEATURE_PREMIUM: "1",
    CONNECTSPHERE_FEATURE_PUSH: "yes",
    CONNECTSPHERE_FEATURE_EVENTS_LIVE_PROVIDERS: "off",
  });

  assert.equal(flags.double_date, false);
  assert.equal(flags.premium, true);
  assert.equal(flags.push, true);
  assert.equal(flags.events_live_providers, false);
  assert.equal(flags.ai_bio, true);
  assert.equal(flags.resume_upload, true);
  assert.equal(flags.local_db_fallback, false);
});

test("feature flags never expose local DB fallback in production", async () => {
  const outDir = mkdtempSync(join(tmpdir(), "feature-flags-"));
  const source = readFileSync(resolve("artifacts/api-server/src/lib/featureFlags.ts"), "utf8");
  writeFileSync(join(outDir, "featureFlags.mjs"), transpileTsForTest(source));
  const mod = await import(pathToFileURL(join(outDir, "featureFlags.mjs")).href);

  const flags = mod.resolveFeatureFlags({
    NODE_ENV: "production",
    CONNECTSPHERE_LOCAL_DB_FALLBACK: "true",
  });

  assert.equal(flags.local_db_fallback, false);
});
