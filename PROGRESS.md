# VerseKeep continuous improvement log

Last updated: 2026-08-11 (Cycle 102 across the projects workspace; VerseKeep Cycle 46)

## Current state

- Branch: `main`; completed cycles are committed and pushed per repository policy.
- Runtime: zero-build static site deployed from `docs/`.
- Baseline verification: deterministic Node contracts, real-browser smoke coverage, and syntax checks for every JavaScript file.
- Automated verification: GitHub Actions runs CI policy (10 assertions), site structure, core contracts (55 assertions), data contracts (20 assertions), live Bible requests (17 assertions), four browser paths (53 checks), and syntax checks on Node 24.
- Browser dependency: locked `@playwright/test` 1.62.1; Chromium is downloaded explicitly only for browser testing and does not enter the static deployment.

## Latest cycle: verify compact header and music dock in Chromium

### Why this was selected

Desktop meditation/practice and corrupt-data fallbacks ran in a real browser,
but the space-saving phone header and fixed left music dock remained static-only.
Those surfaces combine viewport media queries, scroll direction, fixed geometry,
ARIA state, outside-click handling, and the promise that closing the dock never
interrupts audio.

### Changes

- Added a real Chromium path at a 390×844 phone viewport.
- Verified compact-only external navigation links are hidden while primary local
  destinations remain available.
- Exercised header hide on downward scroll and restore on upward scroll.
- Opened the music dock from its edge tab and checked its class, ARIA, scrim,
  visible panel, in-viewport geometry, and player ownership.
- Closed via the scrim, reopened from header Music, and closed via Escape while
  proving the Spotify iframe source never changed.
- Bumped the deployment version to `2026.08.11.2`.

### Verification and scores

- Targeted mobile browser path: 1/1 passed in approximately 2 seconds.
- `npm run test:browser`: four journeys / 53 interaction, fallback, layout,
  accessibility-state, and runtime checks passed.
- `node tools/test-practice-core.mjs`: 55 passed; live Bible: 17; data core:
  20; workflow policy: 10; site structure and recursive syntax passed.
- `npm audit --audit-level=high`: 0 vulnerabilities; `git diff --check` passed.
- Correctness/reliability: 9/10 (behavior was unchanged and verified healthy).
- Verifiability: 10/10 (the previously static-only compact shell runs in Chromium).
- Maintainability: 9/10 (one journey covers coupled header/dock viewport behavior).
- Performance: 9/10 (one additional path adds roughly two seconds locally).
- Security/safety: 9/10 (the offline external-request stub keeps CI deterministic).
- User experience: 10/10 (the primary compact navigation and persistent-audio promises are executable).

### Lessons and process improvements

- Real-browser layout contracts should verify semantic state and geometry, not
  screenshots alone: ARIA, visibility, bounding boxes, and persistent media
  identity provide stable evidence.
- A single journey can efficiently cover coupled responsive behaviors when they
  share the same viewport and user flow.
- Test-only cycles still require the deployment stamp here because every main
  push triggers the docs Pages deployment.

## Previous cycles

- Cycle 46: exercised compact header and persistent music-dock behavior in a 390×844 Chromium path.
- Cycle 45 (`d5c229d`): canceled superseded queue hydration with consumer-aware shared-request ownership.
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
| 1 | Validate the bundled wallpaper catalog's non-path fields | Correctness | Low-medium | Small / low | Site checks verify every declared asset path, but title/tag/tone/ID shape is not yet shared with runtime validation |
| 2 | Exercise preference restoration in a real browser | Verification | Low-medium | Small / low | Pure contracts cover normalized storage, but browser smoke starts from empty storage |
| — | Add a narrow mobile browser path for header and music-dock interaction | Verification / UX | Medium | Small-medium / low | Four browser paths / 53 checks | Completed in Cycle 46 |

## Next cycle

Local next: validate bundled wallpaper metadata beyond asset paths. Workspace
next: rotate to the car-classification service's current backlog after this
focused VerseKeep cycle.
