import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(resolve(root, "docs/assets/js/data-core.js"), "utf8");
const playlists = JSON.parse(readFileSync(resolve(root, "docs/data/playlists.json"), "utf8"));
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
