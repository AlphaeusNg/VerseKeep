# VerseKeep continuous improvement log

Last updated: 2026-08-09 (Cycle 37 across the projects workspace)

## Current state

- Branch: `main`; completed cycles are committed and pushed per repository policy.
- Runtime: zero-build static site deployed from `docs/`.
- Baseline verification: `node tools/test-site.mjs` plus syntax checks for every JavaScript file.
- Automated verification: GitHub Actions runs site structure, practice core (22 assertions), and syntax checks; Cycle 36 hosted run passed.

## Latest cycle: normalize persisted practice state

### Why this was selected

Parsed localStorage values were spread directly into live counters and maps. Strings, negative values, arrays, or oversized numbers could create `NaN`, concatenated counters, unsafe lookup behavior, or broken statistics. The shared preference object also needed normalization that preserves meditation settings when practice saves it.

### Changes

- Extended `practice-core.js` with fresh default stats plus stats and preference normalizers.
- Bounds counters to non-negative integers at one billion and clamps `correct` to `checks`.
- Sanitizes verse-hit, theme-play, and favorite maps while rejecting arrays, malformed values, long keys, and prototype-sensitive keys.
- Preserves only valid `mode`, `translation`, `autoAdvance`, `lastMedTopic`, and `medFocus` preferences across both app and meditation saves.
- Routed both `app.js` and `meditate.js` through the shared normalizer and enforced core-before-consumer script order.
- Expanded the practice suite from 8 to 22 assertions and bumped the deployment version to `2026.08.09.2`.

### Verification and scores

- `node tools/test-practice-core.mjs`: 22 passed, 0 failed (normalizer export regression failed before implementation).
- `node tools/test-site.mjs`: 60 wallpaper entries and both HTML entry points verified.
- `node --check docs/assets/js/*.js tools/*.mjs`: passed.
- `git diff --check`: passed.
- Correctness/reliability: 9/10 (persisted corruption cannot poison practice counters or preference types).
- Verifiability: 9/10 (14 new state-contract assertions run locally and in CI).
- Maintainability: 8/10 (both preference consumers share one explicit contract).
- Security/robustness: 9/10 (map keys and numeric bounds are sanitized before use).

### Lessons and process improvements

- Shared localStorage records need a shared schema; otherwise one module can erase or reinterpret another module's fields.
- Sanitize maps entry-by-entry rather than trusting any parsed object-shaped value.
- Fresh default factories prevent accidental cross-test and cross-session mutation through shared nested objects.

## Previous cycle

- Cycle 36 (`a2c21e5`): added least-privilege CI; hosted run `31293112358` completed successfully.
- Cycle 35 (`15e7408`): replaced word-set recall grading with sequence-aware scoring, added eight assertions, and pushed version `2026.08.09.1`.

## Prioritized opportunities

| Priority | Opportunity | Category | Impact | Effort / risk | Evidence / dependency |
|---|---|---|---|---|---|
| 1 | Bound and deduplicate live Bible requests | Reliability / performance | High | Medium / low | Queue hydration is sequential and fetches have no timeout or cancellation |
| 2 | Add verse/theme schema validation before rendering | Correctness | High | Medium / low | Startup trusts JSON structure beyond fetch success |
| 3 | Normalize meditation streak/history state | Reliability | Medium | Small / low | `count`, `lastDay`, and history entries still trust parsed localStorage types |

## Next cycle

Add timeout, in-flight deduplication, and stale-result protection to live Bible fetches, with pure or mocked-network tests that preserve bundled fallback behavior.
