/** Pure scoring helpers for VerseKeep memory practice. */
(function (global) {
  "use strict";

  const MAX_COUNTER = 1_000_000_000;
  const MODES = new Set(["study", "blank", "type", "order", "quiz"]);
  const TRANSLATIONS = new Set(["esv", "niv", "nkjv"]);
  const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

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
    normalizePrefs,
    normalizeStats,
    recallSimilarity,
  });
})(typeof window !== "undefined" ? window : globalThis);
