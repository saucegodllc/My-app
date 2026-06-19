import { readFileSync } from "fs";

const required = [
  "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "EXPO_PUBLIC_API_URL",
  "EXPO_PUBLIC_API_BASE_URL",
  "EXPO_PUBLIC_REVENUECAT_IOS_API_KEY",
  "EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY",
  "EXPO_PUBLIC_SENTRY_DSN",
  "EXPO_PUBLIC_PROJECT_ID",
];

const optionalWhenEnabled = [
  ["EXPO_PUBLIC_POSTHOG_KEY", "analytics"],
  ["EXPO_PUBLIC_POSTHOG_HOST", "analytics"],
];

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

const missing = required.filter((key) => !process.env[key]);
for (const [key, feature] of optionalWhenEnabled) {
  if (process.env[`EXPO_PUBLIC_FEATURE_${feature.toUpperCase()}`] === "1" && !process.env[key]) {
    missing.push(key);
  }
}

if (flagEnabled(process.env.EXPO_PUBLIC_ENABLE_DEMO_SEEDS)) {
  missing.push("EXPO_PUBLIC_ENABLE_DEMO_SEEDS must be disabled for production");
}

if (flagEnabled(process.env.EXPO_PUBLIC_CONNECTSPHERE_LOCAL_DB_FALLBACK)) {
  missing.push("EXPO_PUBLIC_CONNECTSPHERE_LOCAL_DB_FALLBACK must be disabled for production");
}

const eas = readJson(new URL("../eas.json", import.meta.url));
const prodEnv = eas?.build?.production?.env ?? {};
for (const key of ["EXPO_PUBLIC_ENABLE_DEMO_SEEDS", "EXPO_PUBLIC_CONNECTSPHERE_LOCAL_DB_FALLBACK"]) {
  if (flagEnabled(prodEnv[key])) {
    missing.push(`eas.json build.production.env.${key} must be disabled for production`);
  }
}

if (missing.length > 0) {
  console.error("ConnectSphere pre-submit check failed:");
  for (const item of missing) console.error(`- ${item}`);
  process.exit(1);
}

console.log("ConnectSphere pre-submit check passed.");
