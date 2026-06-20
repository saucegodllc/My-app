import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = join(process.cwd(), "app");
const componentRoot = join(process.cwd(), "components");
const roots = [root, componentRoot];
const interactiveTags = ["Pressable", "TouchableOpacity", "TouchableHighlight", "TouchableWithoutFeedback"];
const failures = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(tsx|ts)$/.test(entry)) continue;
    auditFile(full);
  }
}

function auditFile(file) {
  const source = readFileSync(file, "utf8");
  for (const tag of interactiveTags) {
    const pattern = new RegExp(`<${tag}\\b[\\s\\S]*?>`, "g");
    for (const match of source.matchAll(pattern)) {
      const openTag = match[0];
      const isClosingTag = openTag.startsWith(`</${tag}`);
      const hasHandler = /\bonPress(In|Out)?=|\bonLongPress=|\bonPress=/.test(openTag);
      const isExplicitlyDisabled = /\bdisabled(=|\s|>)/.test(openTag);
      const isAsChildWrapper = /\bpointerEvents=/.test(openTag);
      if (isClosingTag || hasHandler || isExplicitlyDisabled || isAsChildWrapper) continue;
      const line = source.slice(0, match.index).split(/\r?\n/).length;
      failures.push(`${relative(process.cwd(), file)}:${line} <${tag}> has no press handler or disabled state`);
    }
  }
}

for (const dir of roots) {
  try {
    walk(dir);
  } catch {
    // Some workspaces may not have every optional root.
  }
}

if (failures.length > 0) {
  console.error("Tap audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Tap audit passed.");
