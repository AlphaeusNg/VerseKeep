# VerseKeep continuous improvement log

Last updated: 2026-08-09 (Cycle 35 across the projects workspace)

## Current state

- Branch: `main`; this cycle must be committed and pushed per repository policy.
- Runtime: zero-build static site deployed from `docs/`.
- Baseline verification: `node tools/test-site.mjs` plus syntax checks for every JavaScript file.
- New behavioral verification: `node tools/test-practice-core.mjs` (8 assertions).

## Latest cycle: make recall scoring sequence-aware

### Why this was selected

“Type it” used a set of expected words and counted every matching typed token. Reordering the entire verse scored 100%, and repeating one valid word could inflate both recall and precision to 100%. Because free recall is a core practice mode, this correctness failure outweighed storage hardening or UI polish.

### Changes

- Added `practice-core.js` with a pure word-sequence similarity metric based on longest common subsequence F1.
- Preserved the forgiving 82% pass threshold while making order and repeated-word multiplicity matter.
- Rewired Type-it grading to the tested helper.
- Loaded the helper before `app.js` and made the structural test enforce that order.
- Added eight assertions for empty input, exact recall, one omission, reordered words, repeated guesses, and duplicate expected words.
- Bumped the deployment version to `2026.08.09.1` and documented the new test command.

### Verification and scores

- `node tools/test-practice-core.mjs`: 8 passed, 0 failed (missing helper failed before implementation).
- `node tools/test-site.mjs`: 60 wallpaper entries and both HTML entry points verified.
- `node --check docs/assets/js/*.js tools/*.mjs`: passed.
- `git diff --check`: passed.
- Correctness/reliability: 8/10 (Type-it can no longer be passed by word bags or repetition).
- Verifiability: 6/10 (first deterministic practice-logic suite; CI is not yet configured).
- Maintainability: 7/10 (scoring is isolated from the 1,200-line DOM controller).
- Performance: 9/10 (dynamic programming uses O(expected words) memory and verse-sized inputs).

### Lessons and process improvements

- Fuzzy recall must preserve sequence and multiplicity; set overlap is unsuitable for memorization grading.
- Extracting one pure boundary produced useful tests without refactoring the whole controller.
- Script-order dependencies belong in the static structure suite so production cannot load the consumer first.

## Prioritized opportunities

| Priority | Opportunity | Category | Impact | Effort / risk | Evidence / dependency |
|---|---|---|---|---|---|
| 1 | Run site, syntax, and recall-scoring checks in GitHub Actions | Verifiability | High | Small / low | All checks are local-only today |
| 2 | Normalize and bound persisted practice stats/preferences | Reliability | High | Small / low | Parsed storage values are spread directly into counters and maps; malformed types can produce `NaN` or crashes |
| 3 | Bound and deduplicate live Bible requests | Reliability / performance | High | Medium / low | Queue hydration is sequential and fetches have no timeout or cancellation |
| 4 | Add verse/theme schema validation before rendering | Correctness | High | Medium / low | Startup trusts JSON structure beyond fetch success |

## Next cycle

Add a least-privilege Node CI workflow for the site, recall-scoring, and all JavaScript syntax checks. This makes the new behavioral contract persistent before deeper state or network changes.
