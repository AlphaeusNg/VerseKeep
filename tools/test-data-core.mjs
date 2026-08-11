import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(resolve(root, "docs/assets/js/data-core.js"), "utf8");
const playlists = JSON.parse(readFileSync(resolve(root, "docs/data/playlists.json"), "utf8"));
const bundledWallpapers = JSON.parse(
  readFileSync(resolve(root, "docs/data/wallpapers.json"), "utf8")
);
const remoteWallpapers = JSON.parse(
  readFileSync(resolve(root, "docs/data/remote-wallpapers.json"), "utf8")
);
const sandbox = { URL, window: {} };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: "data-core.js" });

const core = sandbox.window.VerseKeepDataCore;
let assertions = 0;
function equal(actual, expected, message) {
  assert.equal(actual, expected, message);
  assertions += 1;
}
function hasError(validation, pattern, message) {
  assert.match(validation.errors.join("; "), pattern, message);
  assertions += 1;
}

equal(typeof core?.validatePlaylistCatalog, "function", "playlist validator is exported");
equal(
  typeof core?.validateRemoteWallpaperCatalog,
  "function",
  "remote wallpaper validator is exported"
);
equal(
  typeof core?.validateBundledWallpaperCatalog,
  "function",
  "bundled wallpaper validator is exported"
);

const deployedPlaylists = core.validatePlaylistCatalog(playlists);
equal(deployedPlaylists.valid, true, `deployed playlists are valid: ${deployedPlaylists.errors}`);
const deployedWallpapers = core.validateRemoteWallpaperCatalog(remoteWallpapers);
equal(
  deployedWallpapers.valid,
  true,
  `deployed remote wallpapers are valid: ${deployedWallpapers.errors}`
);
equal(Object.isFrozen(deployedPlaylists), true, "playlist validation results are immutable");
equal(Object.isFrozen(deployedWallpapers.errors), true, "validation error lists are immutable");

const deployedBundledWallpapers = core.validateBundledWallpaperCatalog(bundledWallpapers);
equal(
  deployedBundledWallpapers.valid,
  true,
  `deployed bundled wallpapers are valid: ${deployedBundledWallpapers.errors}`
);
hasError(
  core.validateBundledWallpaperCatalog(null),
  /bundled wallpaper catalog must be an object/,
  "bundled wallpaper root is required"
);
hasError(
  core.validateBundledWallpaperCatalog({ wallpapers: [] }),
  /wallpapers must be a non-empty array/,
  "bundled wallpaper list cannot be empty"
);
const malformedBundledRecord = structuredClone(bundledWallpapers);
malformedBundledRecord.wallpapers[0] = null;
hasError(
  core.validateBundledWallpaperCatalog(malformedBundledRecord),
  /wallpapers\[0\] must be an object/,
  "bundled wallpaper entries must be objects"
);
const missingBundledTitle = structuredClone(bundledWallpapers);
delete missingBundledTitle.wallpapers[0].title;
hasError(
  core.validateBundledWallpaperCatalog(missingBundledTitle),
  /wallpapers\[0\]\.title must be a non-empty string/,
  "bundled wallpaper titles are required"
);
const duplicateBundledId = structuredClone(bundledWallpapers);
duplicateBundledId.wallpapers[1].id = duplicateBundledId.wallpapers[0].id;
hasError(
  core.validateBundledWallpaperCatalog(duplicateBundledId),
  /duplicate wallpaper id/,
  "bundled wallpaper IDs are unique"
);
const unsafeBundledId = structuredClone(bundledWallpapers);
unsafeBundledId.wallpapers[0].id = "Unsafe ID";
hasError(
  core.validateBundledWallpaperCatalog(unsafeBundledId),
  /id must be a lowercase slug/,
  "bundled wallpaper IDs are safe slugs"
);
const blankBundledTag = structuredClone(bundledWallpapers);
blankBundledTag.wallpapers[0].tags = ["Morning", ""];
hasError(
  core.validateBundledWallpaperCatalog(blankBundledTag),
  /tags\[1\] must be a non-empty string/,
  "bundled wallpaper tags cannot be blank"
);
const excessBundledTags = structuredClone(bundledWallpapers);
excessBundledTags.wallpapers[0].tags = ["One", "Two", "Three", "Four"];
hasError(
  core.validateBundledWallpaperCatalog(excessBundledTags),
  /tags must contain at most 3 entries/,
  "bundled wallpaper tags cannot be silently truncated"
);
const duplicateBundledTag = structuredClone(bundledWallpapers);
duplicateBundledTag.wallpapers[0].tags = ["Morning", "morning"];
hasError(
  core.validateBundledWallpaperCatalog(duplicateBundledTag),
  /duplicate tag/,
  "bundled wallpaper tags are unique case-insensitively"
);
const unsafeBundledTone = structuredClone(bundledWallpapers);
unsafeBundledTone.wallpapers[0].tone = "Morning Light";
hasError(
  core.validateBundledWallpaperCatalog(unsafeBundledTone),
  /tone must be a lowercase slug/,
  "bundled wallpaper tones remain CSS-safe"
);
const unsafeBundledStyle = structuredClone(bundledWallpapers);
unsafeBundledStyle.wallpapers[0].style = "Classic Style";
hasError(
  core.validateBundledWallpaperCatalog(unsafeBundledStyle),
  /style must be a lowercase slug/,
  "bundled wallpaper styles remain filter-safe"
);
const missingThemeTitle = structuredClone(bundledWallpapers);
const themedWallpaper = missingThemeTitle.wallpapers.find((wallpaper) => wallpaper.theme);
themedWallpaper.themeTitle = "";
hasError(
  core.validateBundledWallpaperCatalog(missingThemeTitle),
  /themeTitle must be present when theme is set/,
  "bundled wallpaper themes retain display titles"
);
const malformedThemeMetadata = structuredClone(bundledWallpapers);
malformedThemeMetadata.wallpapers[0].theme = {};
hasError(
  core.validateBundledWallpaperCatalog(malformedThemeMetadata),
  /theme must be a string/,
  "bundled wallpaper optional theme metadata retains a stable type"
);

hasError(core.validatePlaylistCatalog(null), /catalog must be an object/, "playlist root is required");
hasError(
  core.validatePlaylistCatalog({ youtube: {}, spotify: [] }),
  /youtube must be a non-empty array.*spotify must be a non-empty array/,
  "both providers require entries"
);

const missingPlaylistTitle = structuredClone(playlists);
delete missingPlaylistTitle.youtube[0].title;
hasError(
  core.validatePlaylistCatalog(missingPlaylistTitle),
  /youtube\[0\]\.title must be a non-empty string/,
  "playlist display fields are required"
);
const duplicatePlaylist = structuredClone(playlists);
duplicatePlaylist.spotify[0].id = duplicatePlaylist.youtube[0].id;
hasError(
  core.validatePlaylistCatalog(duplicatePlaylist),
  /duplicate playlist id/,
  "playlist IDs are unique across providers"
);
const insecurePlaylist = structuredClone(playlists);
insecurePlaylist.youtube[0].embed = insecurePlaylist.youtube[0].embed.replace("https:", "http:");
hasError(
  core.validatePlaylistCatalog(insecurePlaylist),
  /embed must use HTTPS/,
  "playlist embeds require HTTPS"
);
const wrongPlaylistHost = structuredClone(playlists);
wrongPlaylistHost.spotify[0].embed = "https://example.com/embed/playlist/not-spotify";
hasError(
  core.validatePlaylistCatalog(wrongPlaylistHost),
  /approved spotify embed URL/,
  "playlist embeds are restricted to their provider"
);

hasError(
  core.validateRemoteWallpaperCatalog(null),
  /catalog must be an object/,
  "remote wallpaper root is required"
);
hasError(
  core.validateRemoteWallpaperCatalog({ pool: [] }),
  /pool must be a non-empty array/,
  "remote wallpaper pool cannot be empty"
);
const missingWallpaperTitle = structuredClone(remoteWallpapers);
delete missingWallpaperTitle.pool[0].title;
hasError(
  core.validateRemoteWallpaperCatalog(missingWallpaperTitle),
  /pool\[0\]\.title must be a non-empty string/,
  "remote wallpaper display fields are required"
);
const duplicateWallpaper = structuredClone(remoteWallpapers);
duplicateWallpaper.pool[1].id = duplicateWallpaper.pool[0].id;
hasError(
  core.validateRemoteWallpaperCatalog(duplicateWallpaper),
  /duplicate wallpaper id/,
  "remote wallpaper IDs are unique"
);
const badUnsplashId = structuredClone(remoteWallpapers);
badUnsplashId.pool[0].unsplash = "https://images.unsplash.com/not-an-id";
hasError(
  core.validateRemoteWallpaperCatalog(badUnsplashId),
  /Unsplash photo identifier/,
  "remote wallpapers require bare Unsplash photo identifiers"
);
const badTags = structuredClone(remoteWallpapers);
badTags.pool[0].tags = ["Word", ""];
hasError(
  core.validateRemoteWallpaperCatalog(badTags),
  /tags\[1\] must be a non-empty string/,
  "remote wallpaper tags cannot contain blank values"
);
const badTone = structuredClone(remoteWallpapers);
badTone.pool[0].tone = "Study Tone";
hasError(
  core.validateRemoteWallpaperCatalog(badTone),
  /tone must be a lowercase slug/,
  "remote wallpaper tones remain CSS-safe slugs"
);
const badDisabled = structuredClone(remoteWallpapers);
badDisabled.pool[0].disabled = "false";
hasError(
  core.validateRemoteWallpaperCatalog(badDisabled),
  /disabled must be a boolean/,
  "disabled flags cannot rely on truthy strings"
);

console.log(`test-data-core.mjs: ${assertions} data contract assertions passed`);
