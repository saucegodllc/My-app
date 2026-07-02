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

/**
 * Find the index of the `>` that closes a JSX opening tag, starting just after
 * `<Tag`. Tracks curly-brace depth and string/template literals so a `>` inside
 * an expression (e.g. `onPress={() => ...}` or `length > 0 ? 1 : 0.35`) never
 * terminates the tag early — that was the source of false positives.
 */
function findTagEnd(source, startIndex) {
  let depth = 0;
  let inString = null;
  for (let i = startIndex; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (ch === inString && source[i - 1] !== "\\") inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    else if (ch === ">" && depth === 0) return i;
  }
  return -1;
}

function auditFile(file) {
  const source = readFileSync(file, "utf8");
  for (const tag of interactiveTags) {
    // `<Tag\b` never matches closing tags (`</Tag`) because of the slash.
    const pattern = new RegExp(`<${tag}\\b`, "g");
    for (const match of source.matchAll(pattern)) {
      const end = findTagEnd(source, match.index + match[0].length);
      if (end === -1) continue; // malformed / end of file — skip rather than misreport
      const openTag = source.slice(match.index, end + 1);
      const hasHandler = /\bonPress(In|Out)?=|\bonLongPress=|\bonPress=/.test(openTag);
      const isExplicitlyDisabled = /\bdisabled(=|\s|>|\})/.test(openTag);
      const isAsChildWrapper = /\bpointerEvents=/.test(openTag);
      if (hasHandler || isExplicitlyDisabled || isAsChildWrapper) continue;
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
