import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const sourcePath = resolve("artifacts/api-server/src/routes/bio.ts");
const outDir = mkdtempSync(join(tmpdir(), "bio-route-"));
const routeSource = readFileSync(sourcePath, "utf8");
const helperSource = routeSource.slice(
  routeSource.indexOf("function cleanBio"),
  routeSource.indexOf("async function generateBio"),
);
const source = helperSource
  .replace("function fallbackBio", "export function fallbackBio")
  .replace("function cleanBio", "export function cleanBio");

const transformed = await esbuild.transform(source, {
  format: "esm",
  loader: "ts",
  target: "node22",
});

writeFileSync(join(outDir, "bio.mjs"), transformed.code);
const mod = await import(pathToFileURL(join(outDir, "bio.mjs")).href);

test("fallbackBio returns a lively short bio with tasteful emoji", () => {
  const bio = mod.fallbackBio({
    firstName: "Maya",
    intent: "dating",
    location: "Brickell",
    interests: ["salsa", "sushi", "beach walks"],
    whyHere: "real chemistry",
  });

  assert.ok(bio.length <= 180);
  assert.match(bio, /[\u{1F300}-\u{1FAFF}]/u);
  assert.match(bio, /(vibe|spark|energy|yes|plans|chemistry|laughs)/i);
});
