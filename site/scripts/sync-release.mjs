#!/usr/bin/env node
/**
 * Keeps the marketing site in step with a shipped build.
 *
 * What it does, in order:
 *   1. copies the installer into public/downloads as Lyrica-Setup-<version>.exe
 *      and deletes older installers so the folder never grows a second copy;
 *   2. hashes it and rewrites the download block in site.config.ts (URL, SHA-256,
 *      size label and the badge);
 *   3. optionally adds a release entry to the changelog page from a notes file.
 *
 * Usage:
 *   node scripts/sync-release.mjs                      # refresh the current version
 *   node scripts/sync-release.mjs --version 2.1.0      # bump, then refresh
 *   node scripts/sync-release.mjs --notes notes.md     # also add a changelog entry
 *   node scripts/sync-release.mjs --dry-run            # print, write nothing
 *
 * The version defaults to whatever site.config.ts already says, so this never
 * invents a release number on its own.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(siteRoot, "..");
const configPath = join(siteRoot, "site.config.ts");
const changelogPath = join(siteRoot, "src/pages/changelog.astro");
const downloadsDir = join(siteRoot, "public/downloads");

const args = process.argv.slice(2);
const flag = (name) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
};
const has = (name) => args.includes(`--${name}`);

const dryRun = has("dry-run");
const config = readFileSync(configPath, "utf8");

const currentVersion = config.match(/\n\s*version:\s*"([^"]+)"/)?.[1];
if (!currentVersion) {
  console.error("sync-release: could not find product.version in site.config.ts");
  process.exit(1);
}

const version = flag("version") ?? currentVersion;
const installer = resolve(repoRoot, flag("installer") ?? "release/Lyrica-Setup.exe");
const notesPath = flag("notes") ? resolve(process.cwd(), flag("notes")) : undefined;
const date = flag("date") ?? new Date().toISOString().slice(0, 10);
const releaseDate = new Date(`${date}T12:00:00Z`);

if (!existsSync(installer)) {
  console.error(`sync-release: no installer at ${installer} — build it first (npm run tauri build)`);
  process.exit(1);
}

const bytes = readFileSync(installer);
const sha256 = createHash("sha256").update(bytes).digest("hex");
const sizeMb = (bytes.length / (1024 * 1024)).toFixed(1);
const sizeLabel = `${sizeMb} MB`;
const fileName = `Lyrica-Setup-${version}.exe`;
const windowsUrl = `/downloads/${fileName}`;

// --- 1. the file itself -----------------------------------------------------
const target = join(downloadsDir, fileName);
if (dryRun) {
  console.log(`would copy ${installer}\n        -> ${target}`);
} else {
  const staging = join(downloadsDir, `.${fileName}.tmp`);
  writeFileSync(staging, bytes);
  renameSync(staging, target);
  for (const entry of readdirSync(downloadsDir)) {
    if (/^Lyrica-Setup-.*\.exe$/.test(entry) && entry !== fileName) {
      rmSync(join(downloadsDir, entry));
      console.log(`removed stale ${entry}`);
    }
  }
}

// --- 2. the config ----------------------------------------------------------
const fields = [
  ["windowsUrl", windowsUrl, /(\n\s*windowsUrl:\s*")[^"]*(",)/],
  ["sha256", sha256, /(\n\s*sha256:\s*")[^"]*(",)/],
  ["sizeLabel", sizeLabel, /(\n\s*sizeLabel:\s*")[^"]*(",)/],
  ["badge", `Free · ${sizeLabel}`, /(\n\s*badge:\s*")[^"]*(",)/],
];

let updated = config;
for (const [name, value, pattern] of fields) {
  const matches = updated.match(new RegExp(pattern.source, "g"));
  if (!matches || matches.length !== 1) {
    console.error(`sync-release: expected exactly one ${name} in site.config.ts, found ${matches?.length ?? 0}`);
    process.exit(1);
  }
  updated = updated.replace(pattern, `$1${value}$2`);
  console.log(`${name.padEnd(10)} ${value}`);
}

if (updated !== config) {
  if (dryRun) console.log("would rewrite site.config.ts");
  else writeFileSync(configPath, updated);
}

// --- 3. the changelog -------------------------------------------------------
const nextVersion = flag("version");
if (notesPath) {
  if (!nextVersion) {
    console.error("sync-release: a changelog entry needs --version as well as --notes");
    process.exit(1);
  }
  if (!existsSync(notesPath)) {
    console.error(`sync-release: no notes at ${notesPath}`);
    process.exit(1);
  }
  if (!existsSync(changelogPath)) {
    console.error(`sync-release: no changelog page at ${changelogPath}`);
    process.exit(1);
  }

  const notes = readFileSync(notesPath, "utf8");
  const entry = changelogEntry(notes, nextVersion, releaseDate);
  let page = readFileSync(changelogPath, "utf8");

  if (page.includes(`version: "${nextVersion}"`)) {
    console.error(`sync-release: the changelog already has ${nextVersion}; edit that entry by hand`);
    process.exit(1);
  }

  // Only the newest release wears the badge.
  page = page.replace(/\n\s*isNew: true,/g, "");
  const anchor = "const releases = [";
  const index = page.indexOf(anchor);
  if (index === -1) {
    console.error("sync-release: could not find `const releases = [` in changelog.astro");
    process.exit(1);
  }
  const insertAt = index + anchor.length;
  page = `${page.slice(0, insertAt)}\n${entry}${page.slice(insertAt)}`;

  if (dryRun) console.log(`would add a ${nextVersion} entry to changelog.astro`);
  else {
    writeFileSync(changelogPath, page);
    console.log(`changelog   ${nextVersion}`);
  }
}

function changelogEntry(notes, entryVersion, when) {
  const lines = notes.split(/\r?\n/);
  const title = flag("title") ?? lines.find((line) => line.startsWith("# "))?.slice(2).trim() ?? `Lyrica ${entryVersion}`;
  const summary =
    flag("summary") ??
    lines.find((line) => line.trim() && !line.startsWith("#") && !line.startsWith("-"))?.trim() ??
    "";

  const sections = [];
  let current;
  for (const line of lines) {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      current = { label: heading[1].trim(), items: [] };
      sections.push(current);
      continue;
    }
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet && current) current.items.push(bullet[1].trim());
  }

  const quote = (text) => `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(when);

  const body = sections
    .filter((section) => section.items.length)
    .map(
      (section) => `      {
        label: ${quote(section.label)},
        items: [
${section.items.map((item) => `          ${quote(item)},`).join("\n")}
        ],
      },`,
    )
    .join("\n");

  return `  {
    version: ${quote(entryVersion)},
    date: ${quote(formattedDate)},
    title: ${quote(title)},
    isNew: true,
    summary:
      ${quote(summary)},
    sections: [
${body}
    ],
  },`;
}
