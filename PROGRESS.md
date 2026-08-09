# VerseKeep continuous improvement log

Last updated: 2026-08-10 (Cycle 74 across the projects workspace; VerseKeep Cycle 44)

## Current state

- Branch: `main`; completed cycles are committed and pushed per repository policy.
- Runtime: zero-build static site deployed from `docs/`.
- Baseline verification: deterministic Node contracts, real-browser smoke coverage, and syntax checks for every JavaScript file.
- Automated verification: GitHub Actions runs CI policy (10 assertions), site structure, core contracts (51 assertions), data contracts (20 assertions), live Bible requests (11 assertions), three browser paths (30 checks), and syntax checks on Node 24.
- Browser dependency: locked `@playwright/test` 1.62.1; Chromium is downloaded explicitly only for browser testing and does not enter the static deployment.

## Latest cycle: validate playlist and remote-wallpaper inputs

### Why this was selected

Music and daily-wallpaper renderers trusted fetched object shapes. A malformed playlist could crash grouping or point the iframe outside the intended providers; malformed remote wallpaper fields reached selection and URL generation. Both failure paths also exposed raw exception details in the page.

### Changes

- Added a pure `data-core.js` module that validates both catalogs in the browser and in Node tests.
- Require non-empty provider arrays, globally unique slug IDs, display metadata, HTTPS, and approved YouTube/Spotify embed origins and paths.
- Require a non-empty remote pool, unique slug IDs, bare Unsplash identifiers, display metadata, non-empty tags, slug tones, and boolean disabled flags.
- Validate immediately after fetch and before assigning either catalog to renderer state; detailed diagnostics stay in console warnings while visitors receive generic recovery copy.
- Preserve bundled wallpapers when remote suggestions are invalid or unavailable and tell visitors that the offline gallery is still ready.
- Added load-order and integration checks, 20 mutation-driven schema assertions, two invalid-response browser paths, CI coverage, documented commands, and deployment version `2026.08.10.2`.

### Verification and scores

- Test-first evidence: all 20 pure validator assertions passed, while the static suite failed on the five missing module/load-order/runtime/safe-message obligations before integration.
- `node tools/test-data-core.mjs`: 20 passed, 0 failed across valid deployed data and malformed root, shape, duplicate-ID, URL-origin, tag, tone, and flag mutations.
- `npm run test:browser`: three journeys / 30 interaction, fallback, and runtime checks passed in approximately 4 seconds; invalid playlists remain unrendered, while invalid remote suggestions retain bundled wallpapers.
- `node tools/test-practice-core.mjs`: 51 passed, 0 failed.
- `node tools/test-bible-live.mjs`: 11 passed, 0 failed.
- `node tools/test-workflow.mjs`: 10 passed, 0 failed.
- `node tools/test-site.mjs`: 60 wallpaper entries and both HTML entry points verified.
- `node --check docs/assets/js/*.js tools/*.mjs tools/browser/*.mjs playwright.config.mjs`: passed.
- `npm audit --audit-level=high`: 0 vulnerabilities.
- `git diff --check`: passed.
- Correctness/reliability: 10/10 (both previously trusted inputs are rejected before renderer state changes, with offline wallpaper recovery).
- Verifiability: 10/10 (schema mutations, static wiring, real invalid responses, and normal startup agree).
- Maintainability: 9/10 (one dependency-free validator module owns both external data boundaries).
- Security/safety: 10/10 (playlist iframe origins are allowlisted and page copy no longer exposes diagnostics).
- Performance: 10/10 (linear validation over small local catalogs is negligible and adds no network work).

### Lessons and process improvements

- Validate URL purpose, not just URL syntax: HTTPS plus provider host and `/embed/` path protects the iframe boundary.
- Validation should happen before assigning shared renderer state so a bad catalog cannot leave a half-painted list.
- Optional remote enhancements should fail independently; strict rejection of daily suggestions must not remove valid bundled wallpapers.
- Keep diagnostic precision in developer channels and recovery guidance in visitor-facing copy.

## Previous cycles

- Cycle 44: validated playlist and remote-wallpaper inputs and preserved bundled fallback.
- Cycle 43 (`78858d4`): executed startup and primary meditation-to-practice navigation in real Chromium.
- Cycle 42 (`b0441d5`): made queue hydration concurrent, latest-wins, and settings-aware.
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
| 1 | Abort obsolete queue requests instead of only ignoring results | Performance | Medium | Medium / medium | Operation tokens prevent stale writes, but superseded fetches run until their bounded timeout |
| 2 | Add a narrow mobile browser path for header and music-dock interaction | Verification / UX | Medium | Small-medium / low | Desktop and invalid-data paths are covered; compact sticky-header and dock behavior remain static-only |
| 3 | Validate the bundled wallpaper catalog's non-path fields | Correctness | Low-medium | Small / low | Site checks verify every declared asset path, but title/tag/tone/ID shape is not yet shared with runtime validation |

## Next cycle

Local next: abort superseded live-verse queue requests so rapid topic/translation changes stop obsolete network work instead of merely ignoring its result. Workspace next: pivot to ChristoDay's current correctness/verification backlog after two compounding VerseKeep cycles, avoiding diminishing returns in one repo.
