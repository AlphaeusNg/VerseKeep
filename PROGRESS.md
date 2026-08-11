# VerseKeep continuous improvement log

Last updated: 2026-08-11 (Cycle 112 across the projects workspace; VerseKeep Cycle 47)

## Current state

- Branch: `main`; completed cycles are committed and pushed per repository policy.
- Runtime: zero-build static site deployed from `docs/`.
- Baseline verification: deterministic Node contracts, real-browser smoke coverage, and syntax checks for every JavaScript file.
- Automated verification: GitHub Actions runs CI policy (10 assertions), site structure, core contracts (55 assertions), data contracts (35 assertions), live Bible requests (17 assertions), five browser paths (58 checks), and syntax checks on Node 24.
- Browser dependency: locked `@playwright/test` 1.62.1; Chromium is downloaded explicitly only for browser testing and does not enter the static deployment.

## Latest cycle: validate bundled wallpaper metadata before rendering

### Why this was selected

Site structure verified that every declared desktop and derived phone image
existed, but runtime accepted the rest of `wallpapers.json` unchanged. Null
records, duplicate or unsafe IDs, absent titles, malformed tags, unsafe tone or
style values, and inconsistent theme metadata could reach search, filters,
classes, persistence, and rendering before failing incidentally.

### Changes

- Added `validateBundledWallpaperCatalog` beside the existing playlist/remote
  validators and routed fetched local data through it before runtime assignment.
- Requires a non-empty record list; unique lowercase IDs; non-empty title,
  blurb, tone, and style; CSS/filter-safe slugs; one to three unique nonblank
  tags; string-typed optional theme fields; and paired theme/title metadata.
- Added 15 bundled-catalog assertions covering the checked-in 60 entries plus
  malformed roots, records, IDs, fields, tags, slugs, and themes; total data
  contracts increased from 20 to 35.
- Added a structural validation-before-assignment contract and a real browser
  recovery path that keeps meditation working while showing only the safe
  wallpaper error and rendering no invalid cards.
- Bumped the deployment version to `2026.08.11.3`.

### Verification and scores

- Test-first: the data suite failed because no bundled wallpaper validator was
  exported; a follow-up type case caught object-valued optional theme metadata.
- `node tools/test-data-core.mjs`: 35 data contracts passed.
- `npm run test:browser`: five journeys / 58 interaction, fallback, layout,
  accessibility-state, and runtime checks passed in approximately 5 seconds.
- `node tools/test-practice-core.mjs`: 55 passed; live Bible: 17; workflow
  policy: 10; all 60 wallpaper paths, site structure, and recursive syntax passed.
- `npm audit --audit-level=high`: 0 vulnerabilities; `git diff --check` passed.
- Correctness/reliability: 9/10 (only complete, internally consistent metadata reaches runtime consumers).
- Verifiability: 10/10 (pure boundary cases, assignment order, and visitor-visible recovery are covered).
- Maintainability: 9/10 (one shared validator owns bundled display/filter assumptions).
- Performance: 10/10 (one linear 60-record startup pass; no runtime dependency or network cost).
- Security/safety: 9/10 (unsafe slug inputs fail before class/filter use and diagnostics stay internal).
- User experience: 9/10 (corrupt metadata degrades honestly without breaking meditation).

### Lessons and process improvements

- File existence proves packaging, not semantic safety. Validate display and
  filter metadata at the same fetched-data boundary as remote catalogs.
- Fields that permit an empty string still need explicit type validation; a
  truthy object can otherwise survive normalization and reach string consumers.
- Keep detailed validator errors in console diagnostics while browser coverage
  locks the stable, non-technical recovery message visitors receive.

## Previous cycles

- Cycle 47: validated all bundled wallpaper metadata before assignment and exercised safe browser recovery.
- Cycle 46 (`37e27e7`): exercised compact header and persistent music-dock behavior in a 390×844 Chromium path.
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
| 1 | Exercise preference restoration in a real browser | Verification | Low-medium | Small / low | Pure contracts cover normalized storage, but browser smoke starts from empty storage |
| — | Validate the bundled wallpaper catalog's non-path fields | Correctness | Low-medium | Small / low | 35 data contracts plus validation-before-assignment and browser recovery | Completed in Cycle 47 |
| — | Add a narrow mobile browser path for header and music-dock interaction | Verification / UX | Medium | Small-medium / low | Four browser paths / 53 checks | Completed in Cycle 46 |

## Next cycle

Local next: exercise normalized preference restoration through the real browser
DOM. Workspace next: rotate to the car-classification service's current backlog
after this focused VerseKeep cycle.
