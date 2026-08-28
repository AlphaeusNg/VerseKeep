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
  "assets/js/data-core.js",
  "assets/js/meditate.js",
  "assets/js/practice-core.js",
  "assets/js/version.js",
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
  if (!html.includes('role="group" aria-label="Music source"')) {
    failures.push("Music source chips must be a named button group");
  }
  if (html.includes('role="tablist"')) {
    failures.push("index.html must not declare a tablist for chip toggles");
  }
  if (!html.includes('id="med-more"') || !html.includes('id="med-more-panel"')) {
    failures.push("Meditation dock must keep extras behind More");
  }
  if (!html.includes('id="med-copy-link"')) {
    failures.push("Meditation More panel must include Copy link");
  }
  if (!html.includes('id="med-focus"') || !html.includes('id="med-amen"')) {
    failures.push("Meditation dock must keep Focus and Amen button IDs");
  }
  if (!html.includes('id="med-practice-verse"')) {
    failures.push("Meditation dock must include Practice this verse");
  }
  if (!html.includes('id="nav-music"')) {
    failures.push("Primary nav must keep #nav-music to toggle the dock");
  }
  if (!html.includes('class="nav-more"') || !html.includes('href="#topics"') || !html.includes('href="#wallpapers"')) {
    failures.push("Topics, wallpapers, and sibling links must stay reachable from a More overflow");
  }
  if (html.includes("Meditate without friction")) {
    failures.push("Compact hero manifesto must not occupy the first screen");
  }
  if (!html.includes('id="memorize-empty"')) {
    failures.push("Memorize section must include an empty state");
  }
  const practiceCoreIndex = html.indexOf('src="assets/js/practice-core.js"');
  const dataCoreIndex = html.indexOf('src="assets/js/data-core.js"');
  const meditateIndex = html.indexOf('src="assets/js/meditate.js"');
  const appIndex = html.indexOf('src="assets/js/app.js"');
  const ambientIndex = html.indexOf('src="assets/js/ambient.js"');
  const wallpapersIndex = html.indexOf('src="assets/js/wallpapers.js"');
  if (practiceCoreIndex < 0) failures.push("index.html must load practice-core.js");
  else if (practiceCoreIndex > meditateIndex || practiceCoreIndex > appIndex) {
    failures.push("practice-core.js must load before meditate.js and app.js");
  }
  if (dataCoreIndex < 0) failures.push("index.html must load data-core.js");
  else if (dataCoreIndex > ambientIndex || dataCoreIndex > wallpapersIndex) {
    failures.push("data-core.js must load before ambient.js and wallpapers.js");
  }
  const densityOptions = [...html.matchAll(/\bdata-wp-grid="([1-4])"/g)].map((match) => match[1]);
  if (densityOptions.join(",") !== "1,2,3,4") {
    failures.push("Expected wallpaper grid density options 1x1 through 4x4");
  }
}

const appPath = requirePath("assets/js/app.js");
if (existsSync(appPath)) {
  const appSource = readFileSync(appPath, "utf8");
  if (!appSource.includes("validateVerseCatalog")) {
    failures.push("app.js must validate verses.json before rendering");
  }
  if (appSource.includes("Could not load verses: ${err.message}")) {
    failures.push("Verse loading errors must not expose raw exception details in the page");
  }
  if (!appSource.includes("Could not load verses. Please refresh or try again later.")) {
    failures.push("app.js must show a user-safe verse loading recovery message");
  }
  if (!appSource.includes("createLatestQueueHydrator")) {
    failures.push("app.js must use latest-operation queue hydration");
  }
  if (!appSource.includes("resolveVerse(ref, localText, options)")) {
    failures.push("app.js must forward queue cancellation options to live verse resolution");
  }
  if (!appSource.includes("parseMeditationLink") || !appSource.includes("applyTranslation")) {
    failures.push("app.js must apply shared translation before meditation boot");
  }
  if (!appSource.includes("async function practiceVerse(ref, themeId)")) {
    failures.push("app.js must open Fill blanks for a single meditation ref");
  }
}

const meditatePath = requirePath("assets/js/meditate.js");
if (existsSync(meditatePath)) {
  const meditateSource = readFileSync(meditatePath, "utf8");
  for (const helper of ["normalizeMeditationSession", "normalizeMeditationStreak"]) {
    if (!meditateSource.includes(helper)) {
      failures.push(`meditate.js must use ${helper} for persisted state`);
    }
  }
  if (!meditateSource.includes("parseMeditationLink") || !meditateSource.includes("meditationSearch")) {
    failures.push("meditate.js must parse and write meditation share URLs");
  }
  if (!meditateSource.includes("history.replaceState")) {
    failures.push("meditation navigation must keep the address bar canonical");
  }
  if (!meditateSource.includes("topicToken")) {
    failures.push("meditate.js must supersede stale topic hydration");
  }
  if (!meditateSource.includes("resumeOffer") || !meditateSource.includes("med-resume")) {
    failures.push("meditate.js must offer last verse as a visible resume chip");
  }
  if (!meditateSource.includes("practiceVerse") || !meditateSource.includes("offerPracticeThisVerse")) {
    failures.push("meditate.js must offer Practice this verse after Amen");
  }
}

const stylePath = requirePath("assets/css/style.css");
if (existsSync(stylePath)) {
  const css = readFileSync(stylePath, "utf8");
  if (!css.includes("body.med-focus #med-drill") || !css.includes("body.med-focus #med-more") || !css.includes("body.med-focus .music-dock")) {
    failures.push("Focus mode must hide Drill, More, and the music dock chrome");
  }
  if (!css.includes("grid-auto-rows: 7rem") || !css.includes(".topics-panel .theme-card small")) {
    failures.push("phone Topics cards must stay dense (7rem rows, hide blurbs)");
  }
}

const ambientPath = requirePath("assets/js/ambient.js");
if (existsSync(ambientPath)) {
  const ambientSource = readFileSync(ambientPath, "utf8");
  if (!ambientSource.includes("validatePlaylistCatalog")) {
    failures.push("ambient.js must validate playlists before rendering");
  }
  if (!ambientSource.includes("Could not load music stations. Please refresh or try again later.")) {
    failures.push("ambient.js must show a safe playlist recovery message");
  }
}

const wallpapersPath = requirePath("assets/js/wallpapers.js");
if (existsSync(wallpapersPath)) {
  const wallpapersSource = readFileSync(wallpapersPath, "utf8");
  if (!wallpapersSource.includes("validateBundledWallpaperCatalog")) {
    failures.push("wallpapers.js must validate bundled wallpapers before rendering");
  } else if (
    wallpapersSource.indexOf("validateBundledWallpaperCatalog") >
    wallpapersSource.indexOf("classics = (local.wallpapers || [])")
  ) {
    failures.push("wallpapers.js must validate bundled wallpapers before runtime assignment");
  }
  if (!wallpapersSource.includes("validateRemoteWallpaperCatalog")) {
    failures.push("wallpapers.js must validate remote wallpapers before rendering");
  }
  if (
    !wallpapersSource.includes(
      "Daily wallpaper suggestions are unavailable. Bundled wallpapers are still ready."
    ) ||
    !wallpapersSource.includes("Could not load wallpapers. Please refresh or try again later.")
  ) {
    failures.push("wallpapers.js must show a safe wallpaper recovery message");
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
