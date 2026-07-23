import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const siteRoot = resolve(repoRoot, "docs");
const failures = [];

function requirePath(relativePath) {
  const absolutePath = resolve(siteRoot, relativePath);
  if (!existsSync(absolutePath)) failures.push(`Missing: docs/${relativePath}`);
  return absolutePath;
}

function readJson(relativePath) {
  const absolutePath = requirePath(relativePath);
  if (!existsSync(absolutePath)) return null;
  try {
    return JSON.parse(readFileSync(absolutePath, "utf8"));
  } catch (error) {
    failures.push(`Invalid JSON: docs/${relativePath} (${error.message})`);
    return null;
  }
}

[
  "index.html",
  "404.html",
  ".nojekyll",
  "manifest.webmanifest",
  "assets/css/style.css",
  "assets/js/app.js",
  "assets/js/ambient.js",
  "assets/js/bible-config.js",
  "assets/js/bible-live.js",
  "assets/js/meditate.js",
  "assets/js/wallpapers.js",
  "data/playlists.json",
  "data/remote-wallpapers.json",
  "data/verses.json",
  "data/wallpapers.json",
].forEach(requirePath);

const indexPath = requirePath("index.html");
if (existsSync(indexPath)) {
  const html = readFileSync(indexPath, "utf8");
  const references = [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((match) => match[1]);
  for (const reference of references) {
    if (/^(?:https?:|data:|#)/i.test(reference)) continue;
    const localPath = reference.split(/[?#]/, 1)[0];
    if (!localPath) continue;
    const absolutePath = resolve(siteRoot, localPath);
    if (!existsSync(absolutePath)) failures.push(`Broken HTML reference: ${reference}`);
  }
  if (!html.includes('id="wp-grid-density"')) {
    failures.push("Missing wallpaper grid density control");
  }
  const densityOptions = [...html.matchAll(/\bdata-wp-grid="([1-4])"/g)].map((match) => match[1]);
  if (densityOptions.join(",") !== "1,2,3,4") {
    failures.push("Expected wallpaper grid density options 1x1 through 4x4");
  }
}

for (const filename of readdirSync(resolve(siteRoot, "data"))) {
  if (filename.endsWith(".json")) readJson(`data/${filename}`);
}
readJson("manifest.webmanifest");

const wallpaperData = readJson("data/wallpapers.json");
const wallpapers = Array.isArray(wallpaperData?.wallpapers) ? wallpaperData.wallpapers : [];
for (const wallpaper of wallpapers) {
  if (!wallpaper.src) continue;
  requirePath(wallpaper.src);
  const match = String(wallpaper.src).match(/^assets\/wallpapers\/([^/]+)\.jpg$/i);
  if (!match) {
    failures.push(`Unexpected wallpaper path: ${wallpaper.src}`);
    continue;
  }
  requirePath(`assets/wallpapers/phone/${match[1]}-phone.jpg`);
}

const htmlFiles = readdirSync(siteRoot).filter(
  (entry) => entry.endsWith(".html") && statSync(resolve(siteRoot, entry)).isFile()
);
if (htmlFiles.length !== 2 || !htmlFiles.includes("index.html") || !htmlFiles.includes("404.html")) {
  failures.push("Expected index.html and 404.html at the docs deployment root");
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Site structure OK: ${wallpapers.length} catalog entries, ${htmlFiles.length} HTML entry points`);
