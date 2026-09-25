/**
 * Shared device storage and speech-session lifecycle for meditation and practice.
 * Practice scoring stays in practice-core.js.
 */
(function (global) {
  "use strict";

  const KEYS = Object.freeze({
    practice: "versekeep-stats-v1",
    preferences: "versekeep-prefs-v1",
    meditation: "versekeep-meditate-v1",
    amen: "versekeep-med-streak-v1",
    wallpapers: "versekeep-wallpaper-pref-v2",
  });
  const FORMAT = "versekeep-device";
  const VERSION = 1;
  const LIVE_LABELS = Object.freeze({ esv: "ESV", niv: "NIV", nkjv: "NKJV" });

  function core() {
    const api = global.VerseKeepPracticeCore;
    if (!api) throw new Error("VerseKeep practice core is not loaded");
    return api;
  }

  function storageOf(storage) {
    if (storage) return storage;
    if (global.localStorage) return global.localStorage;
    throw new Error("Device storage is unavailable");
  }

  function isPlain(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function readJson(key, storage) {
    try {
      const raw = storageOf(storage).getItem(key);
      if (!raw) return { ok: true, value: null };
      return { ok: true, value: JSON.parse(raw) };
    } catch (error) {
      return { ok: false, value: null, error };
    }
  }

  function writeJson(key, value, storage) {
    try {
      storageOf(storage).setItem(key, JSON.stringify(value));
      return { ok: true };
    } catch (error) {
      return { ok: false, error };
    }
  }

  function loadPrefs(storage) {
    const read = readJson(KEYS.preferences, storage);
    if (!read.value) return {};
    return core().normalizePrefs(read.value);
  }

  function savePrefs(partial, storage) {
    const next = core().normalizePrefs({ ...loadPrefs(storage), ...(partial || {}) });
    return writeJson(KEYS.preferences, next, storage).ok;
  }

  function loadStats(storage) {
    const read = readJson(KEYS.practice, storage);
    if (!read.value) return core().defaultStats();
    return core().normalizeStats(read.value);
  }

  function saveStats(stats, storage) {
    return writeJson(KEYS.practice, stats, storage);
  }

  function loadMeditation(themeIds, storage) {
    const read = readJson(KEYS.meditation, storage);
    return core().normalizeMeditationSession(read.value || {}, themeIds || []);
  }

  function saveMeditation(partial, themeIds, storage) {
    const next = core().normalizeMeditationSession(
      { ...loadMeditation(themeIds, storage), ...(partial || {}) },
      themeIds || []
    );
    return writeJson(KEYS.meditation, next, storage).ok;
  }

  function createStreakStore(storage) {
    let session = null;

    function load() {
      if (session) return session;
      const read = readJson(KEYS.amen, storage);
      session = core().normalizeMeditationStreak(read.value || {});
      return session;
    }

    function save(data) {
      session = core().normalizeMeditationStreak(data);
      const written = writeJson(KEYS.amen, session, storage);
      return written.ok ? { ok: true, streak: session } : { ok: false, error: written.error, streak: session };
    }

    function replace(data) {
      session = core().normalizeMeditationStreak(data);
      return session;
    }

    return { load, save, replace };
  }

  function isDayKey(value) {
    if (typeof value !== "string") return false;
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (year < 2000 || year > 9999 || month < 1 || month > 12 || day < 1) return false;
    return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
  }

  function finiteCount(value) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0;
  }

  function isSafeWallpaperUrl(value) {
    if (typeof value !== "string" || !value || value.length > 500) return false;
    if (value.startsWith("assets/wallpapers/") && !value.includes("..")) {
      return /^assets\/wallpapers\/(?:phone\/)?[a-z0-9.-]+\.jpg$/i.test(value);
    }
    let url;
    try {
      url = new URL(value);
    } catch {
      return false;
    }
    if (url.protocol !== "https:" || url.username || url.password) return false;
    return url.hostname === "images.unsplash.com" || url.hostname === "picsum.photos";
  }

  function normalizeWallpaperSelection(value) {
    if (!isPlain(value)) return null;
    const mode = value.mode === "manual" || value.mode === "daily" ? value.mode : null;
    if (!mode) return null;
    const result = { mode };
    if (value.id != null && value.id !== "") {
      if (typeof value.id !== "string" || !/^[a-z0-9-]{1,80}$/.test(value.id)) return null;
      result.id = value.id;
    }
    if (mode === "manual" && !result.id) return null;
    if (value.format != null && value.format !== "") {
      if (value.format !== "desktop" && value.format !== "phone") return null;
      result.format = value.format;
    }
    if (value.title != null && value.title !== "") {
      if (typeof value.title !== "string" || value.title.trim().length > 200) return null;
      result.title = value.title.trim();
    }
    if (value.day != null && value.day !== "") {
      if (!isDayKey(value.day)) return null;
      result.day = value.day;
    }
    if (value.at != null && value.at !== "") {
      if (!finiteCount(value.at) || value.at > Number.MAX_SAFE_INTEGER) return null;
      result.at = Math.floor(value.at);
    }
    if (value.unsplash != null && value.unsplash !== "") {
      if (typeof value.unsplash !== "string" || !/^\d{10,}-[a-zA-Z0-9_-]+$/.test(value.unsplash)) {
        return null;
      }
      result.unsplash = value.unsplash;
    }
    for (const key of ["src", "desktopSrc", "desktopDownload", "phoneSrc", "phoneDownload"]) {
      if (value[key] == null || value[key] === "") continue;
      if (!isSafeWallpaperUrl(value[key])) return null;
      result[key] = value[key];
    }
    return result;
  }

  function acceptableNumberMap(value) {
    if (!isPlain(value)) return false;
    return Object.values(value).every((item) => finiteCount(item));
  }

  function acceptablePractice(value) {
    if (!isPlain(value)) return false;
    for (const key of ["checks", "correct", "themesCompleted", "bestStreak", "totalScore"]) {
      if (key in value && !finiteCount(value[key])) return false;
    }
    if ("verseHits" in value && !acceptableNumberMap(value.verseHits)) return false;
    if ("themePlays" in value && !acceptableNumberMap(value.themePlays)) return false;
    if ("favorites" in value) {
      if (!isPlain(value.favorites)) return false;
      if (!Object.values(value.favorites).every((item) => item === true)) return false;
    }
    if ("versePractice" in value) {
      if (!isPlain(value.versePractice)) return false;
      for (const entry of Object.values(value.versePractice)) {
        if (!isPlain(entry)) return false;
        if ("correct" in entry && !finiteCount(entry.correct)) return false;
        if ("missed" in entry && !finiteCount(entry.missed)) return false;
        if ("lastDay" in entry && entry.lastDay !== null && !isDayKey(entry.lastDay)) return false;
        if (
          "lastResult" in entry &&
          entry.lastResult !== null &&
          entry.lastResult !== "correct" &&
          entry.lastResult !== "missed"
        ) {
          return false;
        }
      }
    }
    if ("lastTheme" in value && value.lastTheme !== null && typeof value.lastTheme !== "string") {
      return false;
    }
    return true;
  }

  function acceptablePrefs(value) {
    if (!isPlain(value)) return false;
    if ("mode" in value && !["study", "blank", "type", "order", "quiz"].includes(value.mode)) {
      return false;
    }
    if ("translation" in value) {
      const translation = String(value.translation || "").toLowerCase();
      if (!LIVE_LABELS[translation]) return false;
    }
    if ("autoAdvance" in value && typeof value.autoAdvance !== "boolean") return false;
    if ("medFocus" in value && typeof value.medFocus !== "boolean") return false;
    if ("lastMedTopic" in value) {
      if (typeof value.lastMedTopic !== "string" || !value.lastMedTopic.trim()) return false;
      if (value.lastMedTopic.trim().length > 200) return false;
    }
    return true;
  }

  function acceptableAmen(value) {
    if (!isPlain(value)) return false;
    if ("count" in value && !finiteCount(value.count)) return false;
    if ("lastDay" in value && value.lastDay !== null && !isDayKey(value.lastDay)) return false;
    if ("history" in value) {
      if (!Array.isArray(value.history)) return false;
      for (const entry of value.history) {
        if (!isPlain(entry) || !isDayKey(entry.day)) return false;
        if (typeof entry.ref !== "string" || !entry.ref.trim() || entry.ref.trim().length > 200) {
          return false;
        }
      }
    }
    return true;
  }

  function exportSnapshot(parts) {
    const source = isPlain(parts) ? parts : {};
    const wallpapers = normalizeWallpaperSelection(source.wallpapers || { mode: "daily" }) || {
      mode: "daily",
    };
    return {
      ok: true,
      snapshot: {
        format: FORMAT,
        version: VERSION,
        practice: core().normalizeStats(source.practice || {}),
        preferences: core().normalizePrefs(source.preferences || {}),
        amen: core().normalizeMeditationStreak(source.amen || {}),
        wallpapers,
      },
    };
  }

  function parseSnapshot(raw) {
    let value = raw;
    if (typeof raw === "string") {
      try {
        value = JSON.parse(raw);
      } catch {
        return { ok: false, error: "invalid" };
      }
    }
    if (!isPlain(value) || value.format !== FORMAT || value.version !== VERSION) {
      return { ok: false, error: "invalid" };
    }
    if (
      !acceptablePractice(value.practice) ||
      !acceptablePrefs(value.preferences) ||
      !acceptableAmen(value.amen)
    ) {
      return { ok: false, error: "invalid" };
    }
    const wallpapers = normalizeWallpaperSelection(value.wallpapers);
    if (!wallpapers) return { ok: false, error: "invalid" };
    return {
      ok: true,
      snapshot: {
        format: FORMAT,
        version: VERSION,
        practice: core().normalizeStats(value.practice),
        preferences: core().normalizePrefs(value.preferences),
        amen: core().normalizeMeditationStreak(value.amen),
        wallpapers,
      },
    };
  }

  function persistSnapshot(snapshot, storage) {
    const parsed = parseSnapshot(snapshot);
    if (!parsed.ok) return { ok: false, persisted: false, error: "invalid", rollbackFailed: [] };
    let store;
    try {
      store = storageOf(storage);
    } catch (error) {
      return { ok: false, persisted: false, error, rollbackFailed: [] };
    }
    const records = [
      [KEYS.practice, parsed.snapshot.practice],
      [KEYS.preferences, parsed.snapshot.preferences],
      [KEYS.amen, parsed.snapshot.amen],
      [KEYS.wallpapers, parsed.snapshot.wallpapers],
    ];
    const previous = [];
    for (const [key] of records) {
      try {
        previous.push(store.getItem(key));
      } catch (error) {
        return { ok: false, persisted: false, error, rollbackFailed: [] };
      }
    }
    const written = [];
    for (let index = 0; index < records.length; index += 1) {
      try {
        store.setItem(records[index][0], JSON.stringify(records[index][1]));
        written.push(index);
      } catch (error) {
        const rollbackFailed = [];
        for (const writtenIndex of written) {
          try {
            if (previous[writtenIndex] == null) store.removeItem(records[writtenIndex][0]);
            else store.setItem(records[writtenIndex][0], previous[writtenIndex]);
          } catch {
            rollbackFailed.push(records[writtenIndex][0]);
          }
        }
        return {
          ok: false,
          persisted: false,
          error,
          rollbackFailed,
          snapshot: parsed.snapshot,
        };
      }
    }
    return { ok: true, persisted: true, rollbackFailed: [], snapshot: parsed.snapshot };
  }

  /**
   * A bundled or mismatched result must not wear the selected translation's name.
   * Rejected results carry no text so a stale response cannot be painted.
   */
  function labelScripture(selectedSlug, result) {
    const selected = String(selectedSlug || "").toLowerCase();
    const expected = LIVE_LABELS[selected] || "";
    if (!isPlain(result)) {
      return { live: false, rejected: false, label: "Bundled", text: "" };
    }
    const translation = typeof result.translation === "string" ? result.translation : "";
    const source = typeof result.source === "string" ? result.source : "";
    const text = typeof result.text === "string" ? result.text : "";
    const bundled = !translation || translation.toUpperCase() === "LOCAL" || /bundled/i.test(source);
    if (bundled) return { live: false, rejected: false, label: "Bundled", text };
    if (!expected || translation !== expected) {
      return { live: false, rejected: true, label: "Bundled", text: "" };
    }
    return { live: true, rejected: false, label: translation, text };
  }

  /** Overlapping navigation or translation changes cannot commit an older result. */
  function shouldApplyScripture(request, current) {
    if (!request || !current) return false;
    if (request.token !== current.token) return false;
    if (!request.ref || request.ref !== current.ref) return false;
    return (
      String(request.translation || "").toLowerCase() ===
      String(current.translation || "").toLowerCase()
    );
  }

  function wallpaperFileName(url, fallback) {
    const path = String(url || "").split(/[?#]/, 1)[0];
    const slash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
    const name = slash >= 0 ? path.slice(slash + 1) : path;
    if (/^[A-Za-z0-9._-]+\.(?:jpe?g|png|webp)$/.test(name)) return name;
    const safeFallback = String(fallback || "versekeep-wallpaper.jpg").replace(/[^\w.-]+/g, "_");
    return /\.(?:jpe?g|png|webp)$/i.test(safeFallback) ? safeFallback : "versekeep-wallpaper.jpg";
  }

  function createSpeechSession(host) {
    const root = host || global;
    let generation = 0;
    const pending = new Set();

    function cancel() {
      generation += 1;
      for (const utterance of pending) {
        utterance.onend = null;
        utterance.onerror = null;
      }
      pending.clear();
      try {
        root.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
    }

    function speak(text, options = {}) {
      const synth = root.speechSynthesis;
      if (!synth || typeof synth.speak !== "function" || typeof root.SpeechSynthesisUtterance !== "function") {
        return false;
      }
      cancel();
      const mine = generation;
      let utterance;
      try {
        utterance = new root.SpeechSynthesisUtterance(String(text || ""));
      } catch {
        return false;
      }
      if (options.rate != null) utterance.rate = options.rate;
      if (options.pitch != null) utterance.pitch = options.pitch;
      pending.add(utterance);
      utterance.onend = () => {
        pending.delete(utterance);
        if (mine !== generation) return;
        if (typeof options.onend === "function") options.onend();
      };
      utterance.onerror = () => {
        pending.delete(utterance);
        if (mine !== generation) return;
      };
      try {
        synth.speak(utterance);
      } catch {
        pending.delete(utterance);
        return false;
      }
      return mine === generation;
    }

    return { cancel, speak };
  }

  const speech = createSpeechSession(global);

  global.VerseKeepSession = Object.freeze({
    FORMAT,
    KEYS,
    VERSION,
    createSpeechSession,
    createStreakStore,
    exportSnapshot,
    labelScripture,
    loadMeditation,
    loadPrefs,
    loadStats,
    normalizeWallpaperSelection,
    parseSnapshot,
    persistSnapshot,
    saveMeditation,
    savePrefs,
    saveStats,
    shouldApplyScripture,
    speech,
    wallpaperFileName,
  });
})(typeof window !== "undefined" ? window : globalThis);
