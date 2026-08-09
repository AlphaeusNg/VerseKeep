import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(resolve(root, "docs/assets/js/practice-core.js"), "utf8");
const sandbox = { window: {} };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: "practice-core.js" });

const core = sandbox.window.VerseKeepPracticeCore;
const similarity = core?.recallSimilarity;
assert.equal(typeof similarity, "function", "recallSimilarity is exported");
assert.equal(similarity("", ""), 1, "two empty answers match");
assert.equal(similarity("trust", ""), 0, "non-empty answer cannot match an empty target");
assert.equal(similarity("trust in the lord", "trust in the lord"), 1, "exact recall scores 100%");
assert(
  similarity("lord the in trust", "trust in the lord") < 0.82,
  "reordered words do not pass the recall threshold"
);
assert(
  similarity("trust trust trust trust", "trust in the lord") < 0.82,
  "repeating one valid word does not pass"
);
assert(
  similarity("trust in lord", "trust in the lord") >= 0.82,
  "one missing word remains a forgiving match"
);
assert(
  similarity("the lord is my shepherd", "the lord is my shepherd the lord") < 1,
  "duplicate expected words retain their multiplicity"
);

assert.equal(typeof core?.normalizeStats, "function", "normalizeStats is exported");
assert.equal(typeof core?.normalizePrefs, "function", "normalizePrefs is exported");

if (core?.normalizeStats && core?.normalizePrefs) {
  const stats = JSON.parse(
    JSON.stringify(
      core.normalizeStats({
        checks: 10,
        correct: 99,
        themesCompleted: -4,
        bestStreak: 3.9,
        totalScore: Number.MAX_VALUE,
        verseHits: { "John 3:16": 3.8, "Psalm 1:1": -1, bad: "4" },
        themePlays: { trust: 2.2, trials: null },
        favorites: { trust: true, trials: "yes", sin: false },
        lastTheme: { id: "trust" },
      })
    )
  );
  assert.equal(stats.checks, 10, "valid check count is preserved");
  assert.equal(stats.correct, 10, "correct count cannot exceed checks");
  assert.equal(stats.themesCompleted, 0, "negative counters reset to zero");
  assert.equal(stats.bestStreak, 3, "fractional counters normalize to integers");
  assert.equal(stats.totalScore, 1_000_000_000, "counters are bounded");
  assert.deepEqual(stats.verseHits, { "John 3:16": 3 }, "verse-hit map drops malformed values");
  assert.deepEqual(stats.themePlays, { trust: 2 }, "theme-play map drops malformed values");
  assert.deepEqual(stats.favorites, { trust: true }, "favorites retain only true boolean entries");
  assert.equal(stats.lastTheme, null, "invalid last theme resets safely");

  const first = core.defaultStats();
  const second = core.defaultStats();
  first.verseHits.example = 1;
  assert.equal(second.verseHits.example, undefined, "default stats do not share mutable maps");

  const prefs = JSON.parse(
    JSON.stringify(
      core.normalizePrefs({
        mode: "quiz",
        translation: "NIV",
        autoAdvance: true,
        lastMedTopic: "trust",
        medFocus: false,
        unknown: "discard me",
      })
    )
  );
  assert.deepEqual(
    prefs,
    {
      mode: "quiz",
      translation: "niv",
      autoAdvance: true,
      lastMedTopic: "trust",
      medFocus: false,
    },
    "valid practice and meditation preferences are preserved"
  );
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        core.normalizePrefs({
          mode: "invalid",
          translation: "kjv",
          autoAdvance: "true",
          lastMedTopic: 42,
          medFocus: 1,
        })
      )
    ),
    {},
    "malformed preferences are discarded"
  );
}

console.log("test-practice-core.mjs: 22 scoring and state assertions passed");
