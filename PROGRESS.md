# VerseKeep continuous improvement log

Last updated: 2026-08-09 (Cycle 38 across the projects workspace)

## Current state

- Branch: `main`; completed cycles are committed and pushed per repository policy.
- Runtime: zero-build static site deployed from `docs/`.
- Baseline verification: `node tools/test-site.mjs` plus syntax checks for every JavaScript file.
- Automated verification: GitHub Actions runs site structure, practice core (22 assertions), live Bible requests (11 assertions), and syntax checks.

## Latest cycle: bound stalled live Bible requests

### Why this was selected

The resolver already cached and deduplicated successful in-flight lookups, but `fetch()` had no timeout. A stalled provider could leave meditation or an entire practice queue on “Loading verses…” indefinitely. Concurrent waiters also retried immediately after a shared failure instead of using their own bundled fallback.

### Changes

- Added one abort controller and bounded timer per deduplicated live lookup; the production default is eight seconds and configuration is clamped to 1–30,000 ms.
- Passed the abort signal through both official ESV and Bolls provider paths.
- Reused a single bundled-fallback constructor for local mode, failures, timeouts, and concurrent waiters.
- Prevented concurrent waiters from starting duplicate retries after their shared request fails; a later independent call may retry normally.
- Added 11 mocked-network assertions for successful deduplication, timeout, caller-specific fallback, cleanup/retry, and unparsed references.
- Added the network suite to CI and the README; bumped the deployment version to `2026.08.09.3`.

### Verification and scores

- `node tools/test-bible-live.mjs`: 11 passed, 0 failed (the timeout regression exceeded its 150 ms test deadline before implementation).
- `node tools/test-practice-core.mjs`: 22 passed, 0 failed.
- `node tools/test-site.mjs`: 60 wallpaper entries and both HTML entry points verified.
- `node --check docs/assets/js/*.js tools/*.mjs`: passed.
- `git diff --check`: passed.
- Correctness/reliability: 9/10 (live-provider stalls now degrade to bundled Scripture instead of hanging the UI).
- Verifiability: 9/10 (success, timeout, concurrency, retry, and parse failure paths are deterministic).
- Maintainability: 8/10 (timeout policy is explicit in configuration and fallback construction is centralized).
- Performance: 9/10 (existing request deduplication is preserved and failure storms no longer create immediate retries).

### Lessons and process improvements

- Audit existing behavior before adding infrastructure: in-flight deduplication was already present and only its failure path needed correction.
- A timeout must cover the entire provider chain, not grant each fallback provider a fresh full delay.
- Concurrent waiters should share network work but construct fallback results from their own bundled text.

## Previous cycle

- Cycle 37 (`cd5636a`): normalized persisted practice stats and shared preferences; practice-core coverage increased from 8 to 22 assertions.
- Cycle 36 (`a2c21e5`): added least-privilege CI; hosted run `31293112358` completed successfully.
- Cycle 35 (`15e7408`): replaced word-set recall grading with sequence-aware scoring, added eight assertions, and pushed version `2026.08.09.1`.

## Prioritized opportunities

| Priority | Opportunity | Category | Impact | Effort / risk | Evidence / dependency |
|---|---|---|---|---|---|
| 1 | Add verse/theme schema validation before rendering | Correctness | High | Medium / low | Startup trusts JSON structure beyond fetch success |
| 2 | Normalize meditation streak/history state | Reliability | Medium | Small / low | `count`, `lastDay`, and history entries still trust parsed localStorage types |
| 3 | Abort obsolete queue hydration when the user switches theme/translation | Reliability / performance | Medium | Medium / medium | Per-request timeouts are bounded, but superseded sequential queues still finish in the background |

## Next cycle

Validate `verses.json` before either meditation or practice renders it, with fixtures for duplicate IDs/references and missing context/application/prayer fields. Keep the fatal UI user-safe and diagnostics precise.
