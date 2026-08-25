/** Pure scoring helpers for VerseKeep memory practice. */
(function (global) {
  "use strict";

  const MAX_COUNTER = 1_000_000_000;
  const MODES = new Set(["study", "blank", "type", "order", "quiz"]);
  const TRANSLATIONS = new Set(["esv", "niv", "nkjv"]);
  const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
  const VERSE_FIELDS = ["ref", "text", "context", "application", "prayer"];

  function isRecord(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function boundedInteger(value) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return 0;
    return Math.min(MAX_COUNTER, Math.floor(value));
  }

  function counterMap(value) {
    if (!isRecord(value)) return {};
    const result = {};
    for (const [key, count] of Object.entries(value)) {
      if (!key || key.length > 200 || UNSAFE_KEYS.has(key)) continue;
      if (typeof count !== "number" || !Number.isFinite(count) || count < 0) continue;
      result[key] = boundedInteger(count);
    }
    return result;
  }

  function trueMap(value) {
    if (!isRecord(value)) return {};
    const result = {};
    for (const [key, selected] of Object.entries(value)) {
      if (!key || key.length > 200 || UNSAFE_KEYS.has(key) || selected !== true) continue;
      result[key] = true;
    }
    return result;
  }

  function defaultStats() {
    return {
      checks: 0,
      correct: 0,
      themesCompleted: 0,
      bestStreak: 0,
      verseHits: {},
      themePlays: {},
      favorites: {},
      lastTheme: null,
      totalScore: 0,
    };
  }

  function normalizeStats(value) {
    const source = isRecord(value) ? value : {};
    const checks = boundedInteger(source.checks);
    const lastTheme =
      typeof source.lastTheme === "string" && source.lastTheme.trim().length <= 200
        ? source.lastTheme.trim() || null
        : null;
    return {
      checks,
      correct: Math.min(checks, boundedInteger(source.correct)),
      themesCompleted: boundedInteger(source.themesCompleted),
      bestStreak: boundedInteger(source.bestStreak),
      verseHits: counterMap(source.verseHits),
      themePlays: counterMap(source.themePlays),
      favorites: trueMap(source.favorites),
      lastTheme,
      totalScore: boundedInteger(source.totalScore),
    };
  }

  function normalizePrefs(value) {
    if (!isRecord(value)) return {};
    const result = {};
    if (MODES.has(value.mode)) result.mode = value.mode;
    if (typeof value.translation === "string") {
      const translation = value.translation.toLowerCase();
      if (TRANSLATIONS.has(translation)) result.translation = translation;
    }
    if (typeof value.autoAdvance === "boolean") result.autoAdvance = value.autoAdvance;
    if (
      typeof value.lastMedTopic === "string" &&
      value.lastMedTopic.trim() &&
      value.lastMedTopic.trim().length <= 200
    ) {
      result.lastMedTopic = value.lastMedTopic.trim();
    }
    if (typeof value.medFocus === "boolean") result.medFocus = value.medFocus;
    return result;
  }

  function isCalendarDateParts(year, month, day) {
    if (year < 2000 || year > 9999 || month < 1 || month > 12 || day < 1) return false;
    return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
  }

  function isDaySeed(value) {
    if (!Number.isInteger(value)) return false;
    const match = String(value).match(/^(\d{4})(\d{2})(\d{2})$/);
    return !!match && isCalendarDateParts(Number(match[1]), Number(match[2]), Number(match[3]));
  }

  function isDayKey(value) {
    if (typeof value !== "string") return false;
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return !!match && isCalendarDateParts(Number(match[1]), Number(match[2]), Number(match[3]));
  }

  function normalizeMeditationSession(value, allowedThemeIds = []) {
    const source = isRecord(value) ? value : {};
    const allowedTopics = new Set(["all"]);
    if (Array.isArray(allowedThemeIds)) {
      for (const id of allowedThemeIds) {
        if (typeof id === "string" && id) allowedTopics.add(id);
      }
    }
    const requestedTopic =
      typeof source.topicId === "string" && source.topicId.trim().length <= 200
        ? source.topicId.trim()
        : "all";
    const result = { topicId: allowedTopics.has(requestedTopic) ? requestedTopic : "all" };
    if (typeof source.ref === "string" && source.ref.trim() && source.ref.trim().length <= 200) {
      result.ref = source.ref.trim();
    }
    if (isDaySeed(source.day)) result.day = source.day;
    return result;
  }

  function normalizeMeditationStreak(value) {
    const source = isRecord(value) ? value : {};
    const lastDay = isDayKey(source.lastDay) ? source.lastDay : null;
    const rawCount = boundedInteger(source.count);
    const history = [];
    if (Array.isArray(source.history)) {
      for (const entry of source.history) {
        if (!isRecord(entry) || !isDayKey(entry.day)) continue;
        if (typeof entry.ref !== "string" || !entry.ref.trim() || entry.ref.trim().length > 200) {
          continue;
        }
        history.push({ day: entry.day, ref: entry.ref.trim() });
      }
    }
    return {
      count: lastDay ? Math.max(1, rawCount) : 0,
      lastDay,
      history: history.slice(-30),
    };
  }

  function createLatestQueueHydrator(resolveVerse) {
    if (typeof resolveVerse !== "function") throw new TypeError("resolveVerse must be a function");
    let latestOperation = 0;
    const operationControllers = new Map();

    function begin() {
      latestOperation += 1;
      operationControllers.set(latestOperation, new AbortController());
      return latestOperation;
    }

    function isCurrent(operation) {
      return operation === latestOperation;
    }

    async function hydrate(queue, operation, enabled = true) {
      const source = Array.isArray(queue) ? queue : [];
      const controller = operationControllers.get(operation);
      try {
        const pending = enabled
          ? source.map(async (verse) => {
            try {
              const live = await resolveVerse(verse.ref, verse.localText || verse.text, {
                signal: controller?.signal,
              });
              return {
                ...verse,
                text: live.text || verse.text,
                liveSource: live.source,
                liveTranslation: live.translation,
              };
            } catch {
              return verse;
            }
          })
          : source.map((verse) => Promise.resolve(verse));
        // Replacement consumers are subscribed above before obsolete work is
        // released, so identical in-flight verse requests remain shared.
        for (const [candidate, obsolete] of operationControllers) {
          if (candidate >= operation) continue;
          obsolete.abort();
          operationControllers.delete(candidate);
        }
        const hydrated = await Promise.all(pending);
        return { queue: hydrated, current: isCurrent(operation) };
      } finally {
        operationControllers.delete(operation);
      }
    }

    return Object.freeze({ begin, hydrate, isCurrent });
  }

  function validateVerseCatalog(value) {
    const errors = [];
    const addError = (message) => {
      if (errors.length < 50) errors.push(message);
    };
    const requireText = (record, field, path) => {
      if (typeof record[field] !== "string" || !record[field].trim()) {
        addError(`${path}.${field} must be a non-empty string`);
        return null;
      }
      return record[field].trim();
    };

    if (!isRecord(value)) {
      addError("catalog must be an object");
      return Object.freeze({ valid: false, errors: Object.freeze(errors) });
    }
    if (!Number.isInteger(value.version) || value.version < 1) {
      addError("version must be a positive integer");
    }
    requireText(value, "translationNote", "catalog");
    if (!Array.isArray(value.themes) || value.themes.length === 0) {
      addError("themes must contain at least one theme");
      return Object.freeze({ valid: false, errors: Object.freeze(errors) });
    }

    const themeIds = new Set();
    const verseReferences = new Set();
    value.themes.forEach((theme, themeIndex) => {
      const themePath = `themes[${themeIndex}]`;
      if (!isRecord(theme)) {
        addError(`${themePath} must be an object`);
        return;
      }

      const themeId = requireText(theme, "id", themePath);
      requireText(theme, "title", themePath);
      requireText(theme, "emoji", themePath);
      requireText(theme, "blurb", themePath);
      if (themeId) {
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(themeId)) {
          addError(`${themePath}.id must be a lowercase slug`);
        } else if (themeIds.has(themeId)) {
          addError(`${themePath}.id has duplicate theme id "${themeId}"`);
        }
        themeIds.add(themeId);
      }

      if (!Array.isArray(theme.verses) || theme.verses.length === 0) {
        addError(`${themePath}.verses must be a non-empty array`);
        return;
      }
      theme.verses.forEach((verse, verseIndex) => {
        const versePath = `${themePath}.verses[${verseIndex}]`;
        if (!isRecord(verse)) {
          addError(`${versePath} must be an object`);
          return;
        }
        const reference = requireText(verse, "ref", versePath);
        for (const field of VERSE_FIELDS.slice(1)) requireText(verse, field, versePath);
        if (reference) {
          const normalizedReference = reference
            .toLowerCase()
            .replace(/[\u2012-\u2015]/g, "-")
            .replace(/\s+/g, " ");
          if (verseReferences.has(normalizedReference)) {
            addError(`${versePath}.ref has duplicate verse reference "${reference}"`);
          }
          verseReferences.add(normalizedReference);
        }
      });
    });

    return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
  }

  function longestCommonSubsequenceLength(actual, expected) {
    let previous = new Array(expected.length + 1).fill(0);
    for (let actualIndex = 1; actualIndex <= actual.length; actualIndex += 1) {
      const current = new Array(expected.length + 1).fill(0);
      for (let expectedIndex = 1; expectedIndex <= expected.length; expectedIndex += 1) {
        current[expectedIndex] =
          actual[actualIndex - 1] === expected[expectedIndex - 1]
            ? previous[expectedIndex - 1] + 1
            : Math.max(previous[expectedIndex], current[expectedIndex - 1]);
      }
      previous = current;
    }
    return previous[expected.length];
  }

  function normalizeVerseRef(value) {
    if (typeof value !== "string") return "";
    return value
      .trim()
      .replace(/[\u2010-\u2015\u2212-]/g, "-")
      .replace(/\s+/g, " ")
      .slice(0, 200);
  }

  function readSearchParams(search) {
    if (search instanceof URLSearchParams) return search;
    if (typeof search !== "string" || !search) return new URLSearchParams();
    return new URLSearchParams(search.charAt(0) === "?" ? search.slice(1) : search);
  }

  function catalogVerseRefs(themeIdsSource) {
    const refs = [];
    if (!Array.isArray(themeIdsSource)) return refs;
    for (const theme of themeIdsSource) {
      if (!isRecord(theme) || !Array.isArray(theme.verses)) continue;
      for (const verse of theme.verses) {
        if (typeof verse?.ref === "string" && verse.ref.trim()) refs.push(verse.ref);
      }
    }
    return refs;
  }

  function parseMeditationLink(search, options = {}) {
    const params = readSearchParams(search);
    if (![...params.keys()].length) return null;
    const allowedTopics = new Set(["all"]);
    const themeIds = Array.isArray(options.themeIds) ? options.themeIds : [];
    for (const id of themeIds) {
      if (typeof id === "string" && id) allowedTopics.add(id);
    }
    const knownRefs = Array.isArray(options.verseRefs)
      ? options.verseRefs.filter((ref) => typeof ref === "string" && ref.trim())
      : catalogVerseRefs(options.themes);
    const result = {};
    const rawRef = params.get("v") || params.get("ref") || "";
    const normalized = normalizeVerseRef(rawRef);
    if (normalized) {
      const match = knownRefs.find((ref) => normalizeVerseRef(ref) === normalized);
      if (match) result.ref = match;
    }
    const rawTopic = (params.get("t") || params.get("topic") || "").trim();
    if (allowedTopics.has(rawTopic)) result.topicId = rawTopic;
    const translation = (params.get("tr") || "").toLowerCase();
    if (TRANSLATIONS.has(translation)) result.translation = translation;
    return Object.keys(result).length ? result : null;
  }

  function meditationSearch(session = {}) {
    const source = isRecord(session) ? session : {};
    const params = new URLSearchParams();
    if (typeof source.ref === "string" && source.ref.trim() && source.ref.trim().length <= 200) {
      params.set("v", source.ref.trim());
    }
    if (typeof source.topicId === "string" && source.topicId.trim() && source.topicId.trim().length <= 200) {
      params.set("t", source.topicId.trim());
    }
    const translation = typeof source.translation === "string" ? source.translation.toLowerCase() : "";
    if (TRANSLATIONS.has(translation)) params.set("tr", translation);
    return params.toString();
  }

  /**
   * Word-sequence F1 score. Order and repeated-word counts matter, while
   * omissions and additions remain forgiving enough for free recall.
   */
  function recallSimilarity(actualText, expectedText) {
    if (!actualText && !expectedText) return 1;
    if (!actualText || !expectedText) return 0;

    const actual = String(actualText).split(/\s+/).filter(Boolean);
    const expected = String(expectedText).split(/\s+/).filter(Boolean);
    if (!actual.length && !expected.length) return 1;
    if (!actual.length || !expected.length) return 0;

    const matched = longestCommonSubsequenceLength(actual, expected);
    const precision = matched / actual.length;
    const recall = matched / expected.length;
    return (2 * precision * recall) / Math.max(precision + recall, Number.EPSILON);
  }

  global.VerseKeepPracticeCore = Object.freeze({
    defaultStats,
    createLatestQueueHydrator,
    meditationSearch,
    normalizeMeditationSession,
    normalizeMeditationStreak,
    normalizePrefs,
    normalizeStats,
    parseMeditationLink,
    recallSimilarity,
    validateVerseCatalog,
  });
})(typeof window !== "undefined" ? window : globalThis);
