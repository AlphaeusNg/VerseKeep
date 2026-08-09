/** Pure scoring helpers for VerseKeep memory practice. */
(function (global) {
  "use strict";

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

  global.VerseKeepPracticeCore = Object.freeze({ recallSimilarity });
})(typeof window !== "undefined" ? window : globalThis);
