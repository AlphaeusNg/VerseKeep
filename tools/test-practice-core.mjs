import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(resolve(root, "docs/assets/js/practice-core.js"), "utf8");
const verseCatalog = JSON.parse(readFileSync(resolve(root, "docs/data/verses.json"), "utf8"));
const sandbox = { window: {}, AbortController };
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
assert.equal(typeof core?.validateVerseCatalog, "function", "validateVerseCatalog is exported");
assert.equal(
  typeof core?.normalizeMeditationSession,
  "function",
  "normalizeMeditationSession is exported"
);
assert.equal(
  typeof core?.normalizeMeditationStreak,
  "function",
  "normalizeMeditationStreak is exported"
);
assert.equal(
  typeof core?.createLatestQueueHydrator,
  "function",
  "createLatestQueueHydrator is exported"
);

if (core?.createLatestQueueHydrator) {
  const pending = new Map();
  const calls = [];
  const hydrator = core.createLatestQueueHydrator((ref) => {
    calls.push(ref);
    return new Promise((resolvePromise, rejectPromise) => {
      pending.set(ref, { resolve: resolvePromise, reject: rejectPromise });
    });
  });
  const originalQueue = [
    { ref: "First", text: "Bundled first", localText: "Bundled first" },
    { ref: "Second", text: "Bundled second", localText: "Bundled second" },
    { ref: "Third", text: "Bundled third", localText: "Bundled third" },
  ];
  const operation = hydrator.begin();
  const hydration = hydrator.hydrate(originalQueue, operation, true);
  assert.deepEqual(calls, ["First", "Second", "Third"], "queue requests start concurrently");
  pending.get("Third").resolve({ text: "Live third", source: "provider", translation: "NIV" });
  pending.get("Second").reject(new Error("provider failed"));
  pending.get("First").resolve({ text: "Live first", source: "provider", translation: "NIV" });
  const hydrated = await hydration;
  assert.equal(hydrated.current, true, "an unsuperseded hydration remains current");
  assert.deepEqual(
    JSON.parse(JSON.stringify(hydrated.queue.map((verse) => verse.text))),
    ["Live first", "Bundled second", "Live third"],
    "concurrent results preserve queue order and per-verse fallback"
  );
  assert.deepEqual(
    originalQueue.map((verse) => verse.text),
    ["Bundled first", "Bundled second", "Bundled third"],
    "hydration does not mutate the bundled source queue"
  );

  let resolveOld;
  const latestHydrator = core.createLatestQueueHydrator((ref) => {
    if (ref === "Old") {
      return new Promise((resolvePromise) => {
        resolveOld = resolvePromise;
      });
    }
    return Promise.resolve({ text: "Newest", source: "provider", translation: "ESV" });
  });
  const oldOperation = latestHydrator.begin();
  const oldHydration = latestHydrator.hydrate([{ ref: "Old", text: "Old local" }], oldOperation);
  const newOperation = latestHydrator.begin();
  const newHydration = await latestHydrator.hydrate(
    [{ ref: "New", text: "New local" }],
    newOperation
  );
  assert.equal(newHydration.current, true, "the newest hydration may commit");
  resolveOld({ text: "Stale", source: "provider", translation: "ESV" });
  assert.equal((await oldHydration).current, false, "a superseded hydration cannot commit");

  let obsoleteSignal;
  const resolverOrder = [];
  const abortingHydrator = core.createLatestQueueHydrator((ref, _text, options = {}) => {
    resolverOrder.push(ref);
    if (ref !== "Obsolete") {
      return Promise.resolve({ text: "Replacement", source: "provider", translation: "ESV" });
    }
    obsoleteSignal = options.signal;
    return new Promise((resolvePromise, rejectPromise) => {
      options.signal?.addEventListener("abort", () => rejectPromise(new Error("cancelled")), {
        once: true,
      });
    });
  });
  const obsoleteOperation = abortingHydrator.begin();
  const obsoleteHydration = abortingHydrator.hydrate(
    [{ ref: "Obsolete", text: "Bundled" }],
    obsoleteOperation
  );
  const replacementOperation = abortingHydrator.begin();
  const replacementHydration = abortingHydrator.hydrate(
    [{ ref: "Replacement", text: "Bundled replacement" }],
    replacementOperation
  );
  assert.deepEqual(
    resolverOrder,
    ["Obsolete", "Replacement"],
    "replacement resolver subscribes before obsolete work is released"
  );
  assert.equal(obsoleteSignal?.aborted, true, "replacement hydration aborts obsolete resolver work");
  assert.equal((await replacementHydration).current, true, "replacement hydration remains current");
  assert.equal((await obsoleteHydration).current, false, "aborted hydration remains non-committable");

  const callsBeforeDisabled = calls.length;
  const disabledOperation = hydrator.begin();
  const disabled = await hydrator.hydrate(originalQueue, disabledOperation, false);
  assert.equal(calls.length, callsBeforeDisabled, "disabled live text performs no network work");
  assert.deepEqual(
    JSON.parse(JSON.stringify(disabled.queue)),
    originalQueue,
    "disabled live text preserves the bundled queue"
  );
}

if (core?.normalizeMeditationSession && core?.normalizeMeditationStreak) {
  const themeIds = verseCatalog.themes.map((theme) => theme.id);
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        core.normalizeMeditationSession(
          { topicId: ` ${themeIds[0]} `, ref: " John 3:16 ", day: 20260809 },
          themeIds
        )
      )
    ),
    { topicId: themeIds[0], ref: "John 3:16", day: 20260809 },
    "valid meditation session values are trimmed and preserved"
  );
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        core.normalizeMeditationSession(
          { topicId: "not-a-real-theme", ref: "", day: 20260230 },
          themeIds
        )
      )
    ),
    { topicId: "all" },
    "unknown topics and malformed resume fields reset safely"
  );

  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        core.normalizeMeditationStreak({
          count: 4,
          lastDay: "2026-08-09",
          history: [{ day: "2026-08-08", ref: " Psalm 56:3 " }],
        })
      )
    ),
    {
      count: 4,
      lastDay: "2026-08-09",
      history: [{ day: "2026-08-08", ref: "Psalm 56:3" }],
    },
    "valid streak state is normalized"
  );
  assert.equal(
    core.normalizeMeditationStreak({ count: "4", lastDay: "2026-08-09" }).count,
    1,
    "string counts cannot concatenate during the next streak increment"
  );
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        core.normalizeMeditationStreak({ count: 99, lastDay: "2026-02-30", history: [] })
      )
    ),
    { count: 0, lastDay: null, history: [] },
    "an invalid streak date resets its dependent count"
  );

  const history = Array.from({ length: 34 }, (_, index) => ({
    day: `2026-07-${String(index + 1).padStart(2, "0")}`,
    ref: `Reference ${index + 1}`,
  }));
  history.push({ day: "not-a-day", ref: "Bad date" }, { day: "2026-08-01", ref: " " });
  const normalizedHistory = core.normalizeMeditationStreak({
    count: 8,
    lastDay: "2026-08-09",
    history,
  }).history;
  assert.equal(normalizedHistory.length, 30, "streak history is capped at 30 valid entries");
  assert.equal(
    normalizedHistory.every((entry) => entry.ref && /^\d{4}-\d{2}-\d{2}$/.test(entry.day)),
    true,
    "malformed history entries are discarded"
  );
  assert.equal(
    normalizedHistory.some((entry) => entry.day === "2026-07-32"),
    false,
    "impossible calendar dates are removed from history"
  );
}

if (core?.validateVerseCatalog) {
  const validation = core.validateVerseCatalog(verseCatalog);
  assert.equal(validation.valid, true, `deployed verse catalog is valid: ${validation.errors.join("; ")}`);

  const emptyCatalog = core.validateVerseCatalog({ version: 3, translationNote: "Note", themes: [] });
  assert.match(emptyCatalog.errors.join("; "), /themes must contain at least one theme/);

  const withoutThemeId = structuredClone(verseCatalog);
  delete withoutThemeId.themes[0].id;
  assert.match(
    core.validateVerseCatalog(withoutThemeId).errors.join("; "),
    /themes\[0\]\.id must be a non-empty string/
  );

  const duplicateThemeId = structuredClone(verseCatalog);
  duplicateThemeId.themes[1].id = duplicateThemeId.themes[0].id;
  assert.match(core.validateVerseCatalog(duplicateThemeId).errors.join("; "), /duplicate theme id/);

  const duplicateReference = structuredClone(verseCatalog);
  duplicateReference.themes[1].verses[0].ref = duplicateReference.themes[0].verses[0].ref;
  assert.match(
    core.validateVerseCatalog(duplicateReference).errors.join("; "),
    /duplicate verse reference/
  );

  for (const field of ["context", "application", "prayer"]) {
    const missingField = structuredClone(verseCatalog);
    missingField.themes[0].verses[0][field] = "   ";
    assert.match(
      core.validateVerseCatalog(missingField).errors.join("; "),
      new RegExp(`themes\\[0\\]\\.verses\\[0\\]\\.${field} must be a non-empty string`)
    );
  }

  const malformedVerseList = structuredClone(verseCatalog);
  malformedVerseList.themes[0].verses = {};
  assert.match(
    core.validateVerseCatalog(malformedVerseList).errors.join("; "),
    /themes\[0\]\.verses must be a non-empty array/
  );
}

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

console.log("test-practice-core.mjs: 55 scoring, state, catalog, and cancellation assertions passed");
