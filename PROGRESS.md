# VerseKeep continuous improvement log

Last updated: 2026-08-09 (Cycle 42 across the projects workspace)

## Current state

- Branch: `main`; completed cycles are committed and pushed per repository policy.
- Runtime: zero-build static site deployed from `docs/`.
- Baseline verification: `node tools/test-site.mjs` plus syntax checks for every JavaScript file.
- Automated verification: GitHub Actions runs CI policy (5 assertions), site structure, core contracts (51 assertions), live Bible requests (11 assertions), and syntax checks on Node 24.

## Latest cycle: make practice hydration concurrent and supersedable

### Why this was selected

Practice queues fetched every uncached verse sequentially, so a seven-verse theme could wait for seven provider round trips. Theme selection, translation changes, and the live-text toggle also wrote hydrated queues independently, allowing a slower obsolete operation to overwrite newer state.

### Changes

- Added a shared latest-operation queue hydrator that starts verse requests concurrently, preserves source order, keeps per-verse bundled fallback, and marks superseded results as non-committable.
- Routed theme selection, weak drills, translation changes, and the live-text toggle through one queue commit boundary.
- Replaced the selection lock with monotonic selection IDs so a newer theme or weak drill can supersede a slower request safely.
- Added a settings fingerprint: translation/live changes during initial hydration cause the current selection to retry with current settings before it commits.
- Made meditation topic changes latest-wins as well, preserving practice/meditation alignment during rapid theme changes.
- Added nine deterministic concurrency/supersession assertions and integration-presence checks; bumped the deployment version to `2026.08.09.7`.

### Verification and scores

- `node tools/test-practice-core.mjs`: 51 passed, 0 failed (the missing hydrator export failed before implementation).
- `node tools/test-bible-live.mjs`: 11 passed, 0 failed.
- `node tools/test-workflow.mjs`: 5 passed, 0 failed.
- `node tools/test-site.mjs`: 60 wallpaper entries and both HTML entry points verified.
- `node --check docs/assets/js/*.js tools/*.mjs`: passed.
- `git diff --check`: passed.
- Correctness/reliability: 9/10 (only the newest queue/topic operation may commit state).
- Verifiability: 8/10 (concurrency, ordering, fallback, and stale-result behavior are deterministic; no local headless browser is installed for a full DOM smoke test).
- Maintainability: 9/10 (one hydrator and one rehydration path replace three independent implementations).
- Performance: 9/10 (uncached queue latency is bounded by the slowest request rather than the sum of all request latencies).

### Lessons and process improvements

- `Promise.all` starts independent verse lookups together while retaining input order; fallback still belongs inside each item task.
- Operation tokens prevent obsolete writes but do not cancel network work. Existing per-request timeouts keep that residual cost bounded.
- Settings changes during an in-progress initial load need a fingerprint/retry path because no committed queue exists yet for an event handler to rehydrate.

## Previous cycle

- Cycle 41 (`513fc05`): upgraded GitHub actions and project checks to Node 24, added five CI-policy assertions, and eliminated hosted deprecation annotations.
- Cycle 40 (`d34d984`): normalized meditation session/streak persistence and added ten corrupt-state assertions.
- Cycle 39 (`55191ea`): validated the 17-theme, 93-verse catalog before rendering and separated precise diagnostics from safe visitor messaging.
- Cycle 38 (`64ec822`): bounded live Bible lookups, preserved deduplication and retry behavior, and added 11 network assertions.
- Cycle 37 (`cd5636a`): normalized persisted practice stats and shared preferences; practice-core coverage increased from 8 to 22 assertions.
- Cycle 36 (`a2c21e5`): added least-privilege CI; hosted run `31293112358` completed successfully.
- Cycle 35 (`15e7408`): replaced word-set recall grading with sequence-aware scoring, added eight assertions, and pushed version `2026.08.09.1`.

## Prioritized opportunities

| Priority | Opportunity | Category | Impact | Effort / risk | Evidence / dependency |
|---|---|---|---|---|---|
| 1 | Add browser-level smoke coverage for startup and primary navigation | Verification | High | Medium / low | Pure/static checks do not execute the complete DOM boot or the new queue integration |
| 2 | Abort obsolete queue requests instead of only ignoring results | Performance | Medium | Medium / medium | Operation tokens prevent stale writes, but superseded fetches run until their bounded timeout |
| 3 | Validate playlist and remote-wallpaper data contracts | Correctness | Medium | Medium / low | Site checks prove JSON syntax and local paths but runtime consumers still trust object shapes |

## Next cycle

Add a lightweight browser-level smoke test for startup and primary meditation/practice navigation, selecting the least intrusive runner that preserves the zero-build deployment and does not make normal local development depend on a browser download.
