/** Pure data-contract validators shared by VerseKeep runtime and Node tests. */
(function (global) {
  "use strict";

  const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const UNSPLASH_ID_PATTERN = /^\d{10,}-[a-zA-Z0-9]+$/;
  const PLAYLIST_PROVIDERS = {
    youtube: new Set([
      "youtube.com",
      "www.youtube.com",
      "youtube-nocookie.com",
      "www.youtube-nocookie.com",
    ]),
    spotify: new Set(["open.spotify.com"]),
  };

  function isRecord(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function result(errors) {
    return Object.freeze({
      valid: errors.length === 0,
      errors: Object.freeze(errors),
    });
  }

  function requireText(record, key, path, errors) {
    const value = record?.[key];
    if (typeof value !== "string" || !value.trim()) {
      errors.push(`${path}.${key} must be a non-empty string`);
      return "";
    }
    if (value.length > 500) errors.push(`${path}.${key} must be at most 500 characters`);
    return value.trim();
  }

  function validatePlaylistEmbed(embed, provider, path, errors) {
    let url;
    try {
      url = new URL(embed);
    } catch {
      errors.push(`${path}.embed must be an absolute URL`);
      return;
    }
    if (url.protocol !== "https:") {
      errors.push(`${path}.embed must use HTTPS`);
      return;
    }
    if (!PLAYLIST_PROVIDERS[provider].has(url.hostname) || !url.pathname.startsWith("/embed/")) {
      errors.push(`${path}.embed must use an approved ${provider} embed URL`);
    }
  }

  function validatePlaylistCatalog(value) {
    const errors = [];
    if (!isRecord(value)) {
      errors.push("playlist catalog must be an object");
      return result(errors);
    }

    const ids = new Set();
    for (const provider of Object.keys(PLAYLIST_PROVIDERS)) {
      const entries = value[provider];
      if (!Array.isArray(entries) || entries.length === 0) {
        errors.push(`${provider} must be a non-empty array`);
        continue;
      }
      entries.forEach((entry, index) => {
        const path = `${provider}[${index}]`;
        if (!isRecord(entry)) {
          errors.push(`${path} must be an object`);
          return;
        }
        const id = requireText(entry, "id", path, errors);
        requireText(entry, "title", path, errors);
        requireText(entry, "blurb", path, errors);
        requireText(entry, "category", path, errors);
        const embed = requireText(entry, "embed", path, errors);
        if (id) {
          if (!ID_PATTERN.test(id)) errors.push(`${path}.id must be a lowercase slug`);
          if (ids.has(id)) errors.push(`${path}.id has duplicate playlist id "${id}"`);
          ids.add(id);
        }
        if (embed) validatePlaylistEmbed(embed, provider, path, errors);
      });
    }
    return result(errors);
  }

  function validateRemoteWallpaperCatalog(value) {
    const errors = [];
    if (!isRecord(value)) {
      errors.push("remote wallpaper catalog must be an object");
      return result(errors);
    }
    if (!Array.isArray(value.pool) || value.pool.length === 0) {
      errors.push("pool must be a non-empty array");
      return result(errors);
    }

    const ids = new Set();
    value.pool.forEach((entry, index) => {
      const path = `pool[${index}]`;
      if (!isRecord(entry)) {
        errors.push(`${path} must be an object`);
        return;
      }
      const id = requireText(entry, "id", path, errors);
      requireText(entry, "title", path, errors);
      requireText(entry, "blurb", path, errors);
      const unsplash = requireText(entry, "unsplash", path, errors);
      const tone = requireText(entry, "tone", path, errors);
      if (id) {
        if (!ID_PATTERN.test(id)) errors.push(`${path}.id must be a lowercase slug`);
        if (ids.has(id)) errors.push(`${path}.id has duplicate wallpaper id "${id}"`);
        ids.add(id);
      }
      if (unsplash && !UNSPLASH_ID_PATTERN.test(unsplash)) {
        errors.push(`${path}.unsplash must be an Unsplash photo identifier`);
      }
      if (tone && !ID_PATTERN.test(tone)) errors.push(`${path}.tone must be a lowercase slug`);
      if (!Array.isArray(entry.tags) || entry.tags.length === 0) {
        errors.push(`${path}.tags must be a non-empty array`);
      } else {
        entry.tags.forEach((tag, tagIndex) => {
          if (typeof tag !== "string" || !tag.trim()) {
            errors.push(`${path}.tags[${tagIndex}] must be a non-empty string`);
          }
        });
      }
      if (entry.disabled !== undefined && typeof entry.disabled !== "boolean") {
        errors.push(`${path}.disabled must be a boolean when present`);
      }
    });
    return result(errors);
  }

  global.VerseKeepDataCore = Object.freeze({
    validatePlaylistCatalog,
    validateRemoteWallpaperCatalog,
  });
})(typeof window !== "undefined" ? window : globalThis);
