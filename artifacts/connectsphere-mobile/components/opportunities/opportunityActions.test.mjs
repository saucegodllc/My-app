import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
const ts = await import(pathToFileURL(resolve("node_modules/typescript/lib/typescript.js")).href);

const root = resolve("artifacts/connectsphere-mobile/components/opportunities");
const outDir = mkdtempSync(join(tmpdir(), "opportunity-actions-"));

for (const file of ["opportunityTypes.ts", "opportunityActions.ts"]) {
  const sourcePath = join(root, file);
  const source = readFileSync(sourcePath, "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Node10,
    },
  }).outputText.replace(/from "\.\/opportunityTypes"/g, 'from "./opportunityTypes.mjs"');
  writeFileSync(join(outDir, file.replace(".ts", ".mjs")), js);
}

const actions = await import(pathToFileURL(join(outDir, "opportunityActions.mjs")).href);

const baseItem = {
  id: "opp-1",
  kind: "sideHustle",
  title: "Weekend brand ambassador",
  subtitle: "Local paid gig",
  description: "Help a brand run a public pop-up.",
  location: "Wynwood",
  timing: "Saturday",
  source: "ConnectSphere",
  trustCue: "Public opportunity",
  tags: ["Side Hustles", "Pop-Ups", "Miami"],
  primaryAction: "Claim",
  actionUrl: "https://example.com/apply",
  relevanceReason: "Matches your Side Hustles interest",
};

test("validateOpportunityUrl only allows safe https links", () => {
  assert.equal(actions.validateOpportunityUrl("https://example.com/apply"), "https://example.com/apply");
  assert.equal(actions.validateOpportunityUrl("http://example.com"), null);
  assert.equal(actions.validateOpportunityUrl("mailto:test@example.com"), null);
  assert.equal(actions.validateOpportunityUrl("https://connectsphere.app/placeholder"), null);
  assert.equal(actions.validateOpportunityUrl("#"), null);
});

test("filterOpportunityItems matches the final filter categories", () => {
  const items = [
    baseItem,
    { ...baseItem, id: "opp-2", kind: "person", title: "Maya, mentor", primaryAction: "Connect", tags: ["People", "Mentor"] },
    { ...baseItem, id: "opp-3", kind: "group", title: "Creator circle", primaryAction: "Join", tags: ["Groups"] },
  ];
  assert.deepEqual(actions.filterOpportunityItems(items, "Side Hustles").map((i) => i.id), ["opp-1"]);
  assert.deepEqual(actions.filterOpportunityItems(items, "People").map((i) => i.id), ["opp-2"]);
  assert.deepEqual(actions.filterOpportunityItems(items, "Groups").map((i) => i.id), ["opp-3"]);
  assert.equal(actions.filterOpportunityItems(items, "For You").length, 3);
});

test("searchOpportunityItems searches title, tags, source, location, and profile text", () => {
  const items = [
    baseItem,
    {
      ...baseItem,
      id: "opp-4",
      kind: "person",
      title: "Nina Patel",
      primaryAction: "Connect",
      profile: {
        label: "Mentor",
        lookingFor: "Junior designers",
        offers: "Portfolio feedback",
        suggestedOpener: "Ask for one portfolio tip.",
      },
      tags: ["People", "Design"],
    },
  ];
  assert.deepEqual(actions.searchOpportunityItems(items, "portfolio").map((i) => i.id), ["opp-4"]);
  assert.deepEqual(actions.searchOpportunityItems(items, "wynwood").map((i) => i.id), ["opp-1", "opp-4"]);
  assert.deepEqual(actions.searchOpportunityItems(items, "").map((i) => i.id), ["opp-1", "opp-4"]);
});

test("buildOpportunityRelayPayload records action context for Connect", () => {
  const payload = actions.buildOpportunityRelayPayload(baseItem, "claim", "user_self");
  assert.equal(payload.userId, "user_self");
  assert.equal(payload.action, "claim");
  assert.equal(payload.opportunity.id, "opp-1");
  assert.equal(payload.opportunity.title, "Weekend brand ambassador");
  assert.equal(payload.opportunity.actionUrl, "https://example.com/apply");
});
