# VerseKeep continuous improvement log

Last updated: 2026-08-09 (Cycle 39 across the projects workspace)

## Current state

- Branch: `main`; completed cycles are committed and pushed per repository policy.
- Runtime: zero-build static site deployed from `docs/`.
- Baseline verification: `node tools/test-site.mjs` plus syntax checks for every JavaScript file.
- Automated verification: GitHub Actions runs site structure, practice/core/catalog contracts (32 assertions), live Bible requests (11 assertions), and syntax checks.

## Latest cycle: validate the verse catalog before rendering

### Why this was selected

Startup assigned parsed JSON directly to shared state and began rendering without checking its shape. A deploy with an empty theme list, malformed verses, duplicate identifiers, or missing meditation fields could crash midway through startup or silently render broken content. Its page-level error also exposed raw exception details.

### Changes

- Added a non-mutating catalog validator to the shared practice core with bounded, field-path-specific diagnostics.
- Enforced a positive catalog version, translation note, non-empty theme and verse arrays, required theme and verse text, lowercase unique theme IDs, and normalized unique verse references.
- Validated the full catalog before assigning shared state or rendering either experience.
- Kept detailed failures in the console while replacing raw page exceptions with a stable user-safe recovery message.
- Added ten catalog assertions over the deployed JSON and malformed fixtures, plus site checks that enforce validation wiring and safe error copy.
- Bumped the deployment version to `2026.08.09.4`.

### Verification and scores

- `node tools/test-practice-core.mjs`: 32 passed, 0 failed (the missing validator export failed before implementation).
- `node tools/test-bible-live.mjs`: 11 passed, 0 failed.
- `node tools/test-site.mjs`: 60 wallpaper entries and both HTML entry points verified.
- `node --check docs/assets/js/*.js tools/*.mjs`: passed.
- `git diff --check`: passed.
- Correctness/reliability: 9/10 (malformed content is rejected before partial UI initialization).
- Verifiability: 9/10 (the live 17-theme, 93-verse catalog and targeted invalid shapes share one tested contract).
- Maintainability: 9/10 (one pure validator owns the schema and returns precise paths without mutating content).
- Security/robustness: 9/10 (user-visible failures no longer reveal internal exception details, and diagnostic volume is bounded).

### Lessons and process improvements

- Validate at the fetch boundary before any shared-state assignment so consumers never observe a partially trusted catalog.
- Operational diagnostics and user-facing recovery copy have different audiences; preserve detail in the console while keeping the page stable.
- Run multi-command verification under fail-fast shell behavior. The first pass exposed a fixture bug, but a later successful command otherwise masked the aggregate exit status.

## Previous cycle

- Cycle 38 (`64ec822`): bounded live Bible lookups, preserved deduplication and retry behavior, and added 11 network assertions.
- Cycle 37 (`cd5636a`): normalized persisted practice stats and shared preferences; practice-core coverage increased from 8 to 22 assertions.
- Cycle 36 (`a2c21e5`): added least-privilege CI; hosted run `31293112358` completed successfully.
- Cycle 35 (`15e7408`): replaced word-set recall grading with sequence-aware scoring, added eight assertions, and pushed version `2026.08.09.1`.

## Prioritized opportunities

| Priority | Opportunity | Category | Impact | Effort / risk | Evidence / dependency |
|---|---|---|---|---|---|
| 1 | Normalize meditation session and streak/history state | Reliability | High | Small / low | String counts can concatenate, arbitrary topics can empty the pool, and history entries trust parsed localStorage types |
| 2 | Abort obsolete queue hydration when the user switches theme/translation | Reliability / performance | Medium | Medium / medium | Per-request timeouts are bounded, but superseded sequential queues still finish in the background |
| 3 | Validate playlist and remote-wallpaper data contracts | Correctness | Medium | Medium / low | Site checks prove JSON syntax and local paths but runtime consumers still trust object shapes |

## Next cycle

Normalize saved meditation session and streak records through shared pure helpers. Bound counters, validate calendar-day/history entries, reject unknown topics against the loaded catalog, and cover corrupt localStorage fixtures before changing runtime consumers.
