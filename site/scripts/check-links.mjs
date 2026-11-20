import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname, resolve } from "node:path";

const dist = resolve("dist");
if (!existsSync(dist)) {
  console.error("No dist directory. Run `npm run build` first.");
  process.exit(1);
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const htmlFiles = walk(dist).filter((file) => extname(file) === ".html");
const problems = [];
let checked = 0;

function targetExists(urlPath) {
  const normalized = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  if (!normalized.startsWith("/")) return null;
  const direct = join(dist, normalized);
  if (existsSync(direct) && statSync(direct).isFile()) return true;
  if (normalized.endsWith("/") && existsSync(join(direct, "index.html"))) return true;
  if (existsSync(`${direct}.html`)) return true;
  if (existsSync(join(direct, "index.html"))) return true;
  return false;
}

for (const file of htmlFiles) {
  const relativeFile = file.slice(dist.length).replaceAll("\\", "/");
  const html = readFileSync(file, "utf8");
  const matches = html.matchAll(/\b(?:href|src)="([^"]+)"/g);
  for (const match of matches) {
    const raw = match[1].trim();
    if (
      raw.startsWith("http://") ||
      raw.startsWith("https://") ||
      raw.startsWith("mailto:") ||
      raw.startsWith("tel:") ||
      raw.startsWith("data:") ||
      raw.startsWith("javascript:") ||
      raw.startsWith("#")
    ) {
      continue;
    }
    checked += 1;
    const path = raw.startsWith("/") ? raw : `/${raw}`;
    const exists = targetExists(path);
    if (exists === false) {
      problems.push(`${relativeFile} -> ${raw}`);
    }
  }
}

if (problems.length > 0) {
  console.error(`Broken internal links (${problems.length}):`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(`Checked ${checked} internal links across ${htmlFiles.length} HTML files. No broken targets.`);
