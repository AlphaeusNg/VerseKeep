# VerseKeep continuous improvement log

Last updated: 2026-08-11 (Cycle 122 across the projects workspace; VerseKeep Cycle 48)

## Current state

- Branch: `main`; completed cycles are committed and pushed per repository policy.
- Runtime: zero-build static site deployed from `docs/`.
- Baseline verification: deterministic Node contracts, real-browser smoke coverage, and syntax checks for every JavaScript file.
- Automated verification: GitHub Actions runs CI policy (10 assertions), site structure, core contracts (55 assertions), data contracts (35 assertions), live Bible requests (17 assertions), six browser paths (67 encoded assertion sites), and syntax checks on Node 24.
- Browser dependency: locked `@playwright/test` 1.62.1; Chromium is downloaded explicitly only for browser testing and does not enter the static deployment.

## Latest cycle: restore preferences without double-binding meditation controls

### Why this was selected

Normalized preference storage had thorough pure contracts, but browser startup
always began with empty storage. A new restored-state journey exposed that the
deferred meditation script bound its controls both while the document was
`interactive` and again on `DOMContentLoaded`. Every meditation click and
keyboard shortcut consequently ran twice; focus mode visibly stayed enabled
after one attempt to exit.

### Changes

- Made meditation initialization mutually exclusive: bind once at
  `DOMContentLoaded` while loading, otherwise bind immediately.
- Added a browser journey seeded with mixed-case and whitespace-padded saved
  preferences. It verifies normalized NIV selection, auto-advance, topic,
  focus, exact cleaned storage, restored quiz mode, and a single-click focus
  exit before entering a four-choice drill.
- Documented browser-suite coverage and bumped the deployment version to
  `2026.08.11.4`.

### Verification and scores

- Test-first: the new browser journey failed because one focus click left the
  body in `med-focus`; it passed after the initializer fix.
- `npm run test:browser`: six journeys / 67 encoded interaction, persistence,
  fallback, layout, accessibility-state, and runtime assertion sites passed;
  three consecutive full runs completed 18/18 journeys successfully.
- `node tools/test-practice-core.mjs`: 55 passed; data: 35; live Bible: 17;
  workflow policy: 10; site structure, recursive syntax, JSON parsing, and
  `git diff --check` passed.
- `npm audit --audit-level=high`: 0 vulnerabilities.
- Correctness/reliability: 9/10 (meditation controls now perform one action per user input).
- Verifiability: 10/10 (all shared preference effects and the discovered defect are browser-locked).
- Maintainability: 9/10 (one conventional, mutually exclusive startup path replaces ambiguous dual binding).
- Performance: 10/10 (duplicate event work is removed with no added runtime dependency).
- Security/safety: 9/10 (unknown persisted fields are discarded by the exercised normalizer).
- User experience: 9/10 (focus exit, navigation, Amen, and keyboard controls no longer double-fire).

### Lessons and process improvements

- Deferred scripts can execute at `interactive` before `DOMContentLoaded`; an
  initializer must choose either deferred binding or immediate binding, never
  independently do both.
- Restored-state journeys expose startup races and listener duplication that
  isolated normalization contracts cannot observe.
- Assert public DOM effects first, then exact cleaned storage only where it
  proves the persistence boundary itself.

## Previous cycles

- Cycle 48: restored normalized preferences in Chromium and removed duplicate meditation event binding.
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
| 1 | Exercise saved meditation session and streak restoration in a real browser | Verification | Low-medium | Small / low | Pure contracts normalize both stores, but the browser suite has no returning-meditator path |
| — | Exercise preference restoration in a real browser | Verification / correctness | Medium | Small / low | Six browser paths now cover all shared preference effects and single-action controls | Completed in Cycle 48 |
| — | Validate the bundled wallpaper catalog's non-path fields | Correctness | Low-medium | Small / low | 35 data contracts plus validation-before-assignment and browser recovery | Completed in Cycle 47 |
| — | Add a narrow mobile browser path for header and music-dock interaction | Verification / UX | Medium | Small-medium / low | Four browser paths / 53 checks | Completed in Cycle 46 |

## Next cycle

Local next: exercise saved meditation session and streak restoration through a
returning visitor's browser DOM. Workspace next: rotate to the
car-classification service's current backlog after this focused VerseKeep cycle.
