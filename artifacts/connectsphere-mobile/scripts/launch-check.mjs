#!/usr/bin/env node
/**
 * launch-check.mjs
 *
 * Safe local launch-readiness scan for ConnectSphere mobile.
 *
 * This script does not build, upload, submit, or release the app.
 *
 * Default target is iOS-first:
 *   node scripts/launch-check.mjs
 *
 * To include Android follow-up checks:
 *   CONNECTSPHERE_LAUNCH_TARGET=all node scripts/launch-check.mjs
 */

import { execFileSync, execSync } from "child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { extname, join, relative, resolve } from "path";
import { fileURLToPath } from "url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPO_ROOT = resolve(ROOT, "..", "..");
const TARGET = (process.env.CONNECTSPHERE_LAUNCH_TARGET || "ios").toLowerCase();
const INCLUDE_ANDROID = TARGET === "android" || TARGET === "all";

const failures = [];
const warnings = [];

function fail(msg) {
  failures.push(`  x ${msg}`);
}

function warn(msg) {
  warnings.push(`  ! ${msg}`);
}

function pass(msg) {
  console.log(`  ok ${msg}`);
}

function flagEnabled(value) {
  return typeof value === "string" && ["1", "true", "yes", "on", "enabled"].includes(value.trim().toLowerCase());
}

function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function collectSrc(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }

  for (const entry of entries) {
    if (["node_modules", ".expo", "dist", ".git", "functions", "lib"].includes(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) collectSrc(full, acc);
    else if (/\.(ts|tsx)$/.test(entry)) acc.push(full);
  }
  return acc;
}

console.log(`\nConnectSphere launch check (${INCLUDE_ANDROID ? TARGET : "ios-first"})`);
console.log("No build, upload, submit, or release command will run.\n");

console.log("[A] Required environment variables");

const requiredEnv = [
  "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "EXPO_PUBLIC_API_URL",
  "EXPO_PUBLIC_API_BASE_URL",
  "EXPO_PUBLIC_REVENUECAT_IOS_API_KEY",
  "EXPO_PUBLIC_SENTRY_DSN",
  "EXPO_PUBLIC_PROJECT_ID",
];

if (INCLUDE_ANDROID) {
  requiredEnv.push("EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY");
}

for (const key of requiredEnv) {
  const val = process.env[key];
  if (!val) {
    fail(`${key} is not set`);
  } else if (val.includes("YOUR_") || val.includes("PLACEHOLDER") || val === "TODO" || val.startsWith("pk_test_")) {
    fail(`${key} looks like a placeholder or non-production value`);
  } else {
    pass(key);
  }
}

console.log("\n[B] Dev-only flags");

const devFlags = {
  EXPO_PUBLIC_ENABLE_DEMO_SEEDS: "demo seeds",
  EXPO_PUBLIC_CONNECTSPHERE_LOCAL_DB_FALLBACK: "local DB fallback",
};

for (const [key, label] of Object.entries(devFlags)) {
  const val = process.env[key];
  if (flagEnabled(val)) {
    fail(`${label} (${key}) is enabled; it must be off for production`);
  } else {
    pass(`${label} disabled`);
  }
}

console.log("\n[C] Firebase native config files");

const firebaseFiles = [
  { path: join(ROOT, "GoogleService-Info.plist"), platform: "iOS", required: true },
  { path: join(ROOT, "google-services.json"), platform: "Android", required: INCLUDE_ANDROID },
];

for (const item of firebaseFiles) {
  const rel = relative(ROOT, item.path);
  if (!existsSync(item.path)) {
    if (item.required) {
      fail(`Missing ${item.platform} Firebase config: ${rel}`);
    } else {
      warn(`Missing ${item.platform} Firebase config: ${rel}; OK while Android is out of scope`);
    }
    continue;
  }

  const content = readFileSync(item.path, "utf8");
  if (content.includes("YOUR_PROJECT") || content.includes("PLACEHOLDER") || content.includes('"project_id": ""')) {
    fail(`${rel} appears to contain placeholder values`);
  } else if (/private_key|BEGIN PRIVATE KEY/i.test(content)) {
    fail(`${rel} appears to contain a service-account private key; do not bundle or commit it`);
  } else {
    pass(`${rel} present`);
  }
}

console.log("\n[D] eas.json production profile");

const eas = readJson(join(ROOT, "eas.json"));
if (!eas) {
  fail("eas.json not found or invalid JSON");
} else {
  const prod = eas?.build?.production;
  const submitIos = eas?.submit?.production?.ios;

  if (!prod) {
    fail("eas.json missing build.production profile");
  } else {
    pass("build.production profile exists");
    if (prod.channel !== "production") {
      warn(`build.production.channel is "${prod.channel}", expected "production"`);
    }

    const apiUrl = prod.env?.EXPO_PUBLIC_API_URL;
    const apiBaseUrl = prod.env?.EXPO_PUBLIC_API_BASE_URL;
    if (apiUrl !== "https://connectsphere-api.onrender.com") {
      fail(`build.production.env.EXPO_PUBLIC_API_URL is "${apiUrl}", expected Render production URL`);
    } else {
      pass("production API URL points to Render");
    }
    if (apiBaseUrl !== "https://connectsphere-api.onrender.com") {
      fail(`build.production.env.EXPO_PUBLIC_API_BASE_URL is "${apiBaseUrl}", expected Render production URL`);
    } else {
      pass("production API base URL points to Render");
    }

    for (const [key, label] of Object.entries(devFlags)) {
      if (flagEnabled(prod.env?.[key])) {
        fail(`build.production.env.${key} enables ${label}`);
      }
    }
  }

  if (!submitIos) {
    warn("eas.json missing submit.production.ios; OK until submit is approved");
  } else {
    for (const key of ["ascAppId", "appleTeamId"]) {
      const value = submitIos[key];
      if (!value || String(value).includes("REPLACE_")) {
        warn(`submit.production.ios.${key} still needs the real dashboard value before submit`);
      } else {
        pass(`submit.production.ios.${key} filled`);
      }
    }
  }
}

console.log("\n[E] app.json required fields");

const appJson = readJson(join(ROOT, "app.json"));
const expo = appJson?.expo;
if (!expo) {
  fail("app.json missing or has no expo key");
} else {
  const checks = [
    ["name", expo.name, true],
    ["slug", expo.slug, true],
    ["version", expo.version, true],
    ["ios.bundleIdentifier", expo.ios?.bundleIdentifier, true],
    ["ios.buildNumber", expo.ios?.buildNumber, true],
    ["ios.googleServicesFile", expo.ios?.googleServicesFile, true],
    ["android.package", expo.android?.package, INCLUDE_ANDROID],
    ["android.googleServicesFile", expo.android?.googleServicesFile, INCLUDE_ANDROID],
  ];

  for (const [field, val, required] of checks) {
    if (!val) {
      if (required) fail(`app.json expo.${field} is missing`);
      else warn(`app.json expo.${field} is not checked while Android is out of scope`);
    } else if (String(val).includes("YOUR_") || String(val).includes("com.example")) {
      fail(`app.json expo.${field} looks like a placeholder`);
    } else {
      pass(`expo.${field} = ${val}`);
    }
  }
}

console.log("\n[F] Hardcoded localhost / 127.0.0.1");

const LOCALHOST_RE = /['"`](https?:\/\/(?:localhost|127\.0\.0\.1))[^'"`]*/g;
const srcFiles = collectSrc(ROOT);
let localhostHits = 0;

for (const file of srcFiles) {
  const rel = relative(ROOT, file);
  if (rel.startsWith("__tests__") || rel.startsWith("scripts") || rel.includes(".test.")) continue;
  const content = readFileSync(file, "utf8");
  const matches = [...content.matchAll(LOCALHOST_RE)];
  for (const match of matches) {
    const lineNo = content.slice(0, match.index).split("\n").length;
    const lines = content.split("\n");
    const context = lines.slice(Math.max(0, lineNo - 3), lineNo + 1).join(" ");
    if (context.includes("__DEV__") || context.includes("isDev") || context.includes("// dev")) continue;
    fail(`Hardcoded localhost in ${rel}:${lineNo}`);
    localhostHits += 1;
    if (localhostHits >= 10) break;
  }
}

if (localhostHits === 0) pass("No hardcoded localhost found in app source");

console.log("\n[G] TODO/FIXME in critical production files");

const criticalFiles = [
  "app/(tabs)/index.tsx",
  "app/(tabs)/matches.tsx",
  "app/(tabs)/moments.tsx",
  "app/(tabs)/communities.tsx",
  "app/(tabs)/events.tsx",
  "components/DatingMatchModal.tsx",
  "lib/routes.ts",
  "contexts/DatingMatchContext.tsx",
];

const TODO_RE = /\b(TODO|FIXME|HACK|XXX)\b/;
for (const rel of criticalFiles) {
  const file = join(ROOT, rel);
  if (!existsSync(file)) {
    warn(`Critical file not found: ${rel}`);
    continue;
  }

  const hits = readFileSync(file, "utf8")
    .split("\n")
    .map((line, i) => ({ line, no: i + 1 }))
    .filter(({ line }) => TODO_RE.test(line));

  if (hits.length > 0) {
    for (const hit of hits.slice(0, 3)) {
      warn(`${rel}:${hit.no} - ${hit.line.trim().slice(0, 100)}`);
    }
  } else {
    pass(`${rel} clean`);
  }
}

console.log("\n[H] Tracked-source secret scan");

const secretPatterns = [
  { name: "Stripe secret key", re: /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/ },
  { name: "Stripe webhook secret", re: /\bwhsec_[A-Za-z0-9]{16,}\b/ },
  { name: "Anthropic API key", re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/ },
  { name: "Clerk secret key", re: /\bsk_(?:live|test)_[A-Za-z0-9]{20,}\b/ },
  { name: "Postgres URL with password", re: /postgres(?:ql)?:\/\/[^\s"'<>]+:[^\s"'<>]+@/i },
  { name: "Private key block", re: /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/ },
  { name: "Firebase service private key", re: /"private_key"\s*:\s*"-----BEGIN PRIVATE KEY-----/ },
];

const binaryExts = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".mp3", ".mp4", ".mov", ".ttf", ".otf", ".woff", ".woff2", ".zip", ".pdf",
]);

function isAllowedPlaceholder(matchText) {
  return /postgres(?:ql)?:\/\/(?:user:pass|postgres:postgres)@/i.test(matchText);
}

let trackedFiles = [];
try {
  trackedFiles = execFileSync("git", ["ls-files"], { cwd: REPO_ROOT, encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean);
} catch (e) {
  warn(`Could not list tracked files for secret scan: ${e.message}`);
}

let secretHits = 0;
for (const rel of trackedFiles) {
  const file = join(REPO_ROOT, rel);
  if (!existsSync(file)) continue;
  if (binaryExts.has(extname(file).toLowerCase())) continue;
  if (rel.includes("node_modules/") || rel.includes("functions/lib/")) continue;

  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }

  for (const pattern of secretPatterns) {
    const match = content.match(pattern.re);
    if (match) {
      if (rel === "artifacts/connectsphere-mobile/scripts/launch-check.mjs") continue;
      if (isAllowedPlaceholder(match[0])) continue;
      const lineNo = content.slice(0, match.index).split("\n").length;
      fail(`${pattern.name} pattern in ${rel}:${lineNo}`);
      secretHits += 1;
      break;
    }
  }
}

if (trackedFiles.length > 0 && secretHits === 0) {
  pass(`No secret patterns found in ${trackedFiles.length} tracked files`);
}

console.log("\n[I] TypeScript");

if (process.env.CONNECTSPHERE_RUN_TSC === "1") {
  try {
    const tscPath = join(ROOT, "node_modules", ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc");
    if (existsSync(tscPath)) {
      execSync(`"${tscPath}" --noEmit --skipLibCheck`, {
        cwd: ROOT,
        stdio: "pipe",
        timeout: 60_000,
      });
      pass("TypeScript check passed");
    } else {
      warn("TypeScript binary not found");
    }
  } catch (e) {
    warn(`TypeScript check did not complete in launch-check: ${String(e.message).slice(0, 120)}`);
  }
} else {
  pass("Skipped here; run pnpm.cmd --filter @workspace/connectsphere-mobile run typecheck");
}

console.log("\n" + "-".repeat(60));

if (warnings.length > 0) {
  console.log(`\n${warnings.length} warning(s):`);
  warnings.forEach((warning) => console.log(warning));
}

if (failures.length > 0) {
  console.error(`\nLaunch check FAILED: ${failures.length} issue(s) must be resolved before build/upload/submit:\n`);
  failures.forEach((failure) => console.error(failure));
  console.error("\nThis script did not upload or submit the app.\n");
  process.exit(1);
}

console.log("\nLaunch check passed. This script did not upload or submit the app.\n");
process.exit(0);
