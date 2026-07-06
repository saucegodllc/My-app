#!/usr/bin/env node

const TRUE_VALUES = new Set(["1", "true", "yes", "on", "enabled"]);
const DEMO_SEED_FLAGS = [
  "CONNECTSPHERE_ENABLE_DEMO_SEEDS",
  "CONNECTSPHERE_DEMO_SEEDS",
  "EXPO_PUBLIC_ENABLE_DEMO_SEEDS",
];

function flagEnabled(value) {
  return typeof value === "string" && TRUE_VALUES.has(value.trim().toLowerCase());
}

const failures = [];

if (process.env.NODE_ENV === "production") {
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === "") {
    failures.push("DATABASE_URL is required when NODE_ENV=production.");
  }

  if (flagEnabled(process.env.CONNECTSPHERE_LOCAL_DB_FALLBACK)) {
    failures.push("CONNECTSPHERE_LOCAL_DB_FALLBACK must be disabled when NODE_ENV=production.");
  }

  for (const key of DEMO_SEED_FLAGS) {
    if (flagEnabled(process.env[key])) {
      failures.push(`${key} must be disabled when NODE_ENV=production.`);
    }
  }
}

if (failures.length > 0) {
  console.error("ConnectSphere API production env check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("ConnectSphere API production env check passed.");
