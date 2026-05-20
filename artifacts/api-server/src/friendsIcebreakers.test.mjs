import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

const sourcePath = resolve("artifacts/api-server/src/lib/friendsIcebreakers.ts");
const outDir = mkdtempSync(join(tmpdir(), "friends-icebreakers-"));
const source = readFileSync(sourcePath, "utf8");
const js = source
  .replace(/export type [\s\S]*?;\n\n/g, "")
  .replace(/type TextGenerator[\s\S]*?;\n\n/g, "")
  .replace(/let generatorPromise:[^=]+=/, "let generatorPromise =")
  .replace(/\): Promise<[^ {]+>/g, ")")
  .replace(/\): Promise<[^>]+>/g, ")")
  .replace(/\): string/g, ")")
  .replace(/\): IcebreakerSuggestion\[\]/g, ")")
  .replace(/\): FriendIcebreakerContext\):/g, "):")
  .replace(/\): FriendIcebreakerContext/g, ")")
  .replace(/\(([^)]*): FriendIcebreakerContext\)/g, "($1)")
  .replace(/\(([^)]*): unknown\)/g, "($1)")
  .replace(/\(([^)]*): string \| undefined\)/g, "($1)")
  .replace(/\(([^)]*): string\[\] \| undefined, ([^)]*): string\[\]\)/g, "($1, $2)")
  .replace(/\(([^)]*): string, ([^)]*): string, ([^)]*): string\)/g, "($1, $2, $3)")
  .replace(/\(([^)]*): string, ([^)]*): FriendIcebreakerContext\)/g, "($1, $2)")
  .replace(/\(([^)]*): string, ([^)]*)\)/g, "($1, $2)")
  .replace(/\): IcebreakerSuggestion/g, ")")
  .replace(/new Set<[^>]+>\(\)/g, "new Set()")
  .replace(/ as \{ generated_text: unknown \}/g, "")
  .replace(/ as any/g, "")
  .replace(/: TextGenerator \| null/g, "")
  .replace(/: Record<string, unknown>/g, "")
  .replace(/: boolean/g, "")
  .replace(/: true/g, "");
writeFileSync(join(outDir, "friendsIcebreakers.mjs"), js);

const mod = await import(pathToFileURL(join(outDir, "friendsIcebreakers.mjs")).href);

const personContext = {
  kind: "person",
  currentUserName: "Taylor",
  targetName: "Maya Johnson",
  interests: ["coffee", "brunch", "walks"],
  energy: "Exploring Miami",
  location: "Brickell",
};

test("fallbackFriendIcebreakers returns three short fun suggestions", () => {
  const suggestions = mod.fallbackFriendIcebreakers(personContext);
  assert.equal(suggestions.length, 3);
  for (const suggestion of suggestions) {
    assert.match(suggestion.id, /^ice-/);
    assert.ok(suggestion.text.length > 10);
    assert.ok(suggestion.text.length <= 140);
    assert.ok(suggestion.reason.length > 0);
  }
});

test("buildIcebreakerPrompt uses friend context and excludes work language", () => {
  const prompt = mod.buildIcebreakerPrompt(personContext);
  assert.match(prompt, /Maya Johnson/);
  assert.match(prompt, /coffee/);
  assert.doesNotMatch(prompt, /opportunit/i);
  assert.doesNotMatch(prompt, /networking/i);
});

test("normalizeGeneratedIcebreakers filters duplicates and adds fallback options", () => {
  const suggestions = mod.normalizeGeneratedIcebreakers(
    "Want to grab coffee this week?\nWant to grab coffee this week?\nLet's do a Brickell walk and coffee.",
    personContext,
  );
  assert.equal(suggestions.length, 3);
  assert.equal(new Set(suggestions.map((item) => item.text)).size, 3);
  assert.ok(suggestions.every((item) => item.text.length <= 140));
});
