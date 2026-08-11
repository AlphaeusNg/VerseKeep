# VerseKeep continuous improvement log

Last updated: 2026-08-11 (Cycle 131 across the projects workspace; VerseKeep Cycle 49)

## Current state

- Branch: `main`; completed cycles are committed and pushed per repository policy.
- Runtime: zero-build static site deployed from `docs/`.
- Baseline verification: deterministic Node contracts, real-browser smoke coverage, and syntax checks for every JavaScript file.
- Automated verification: GitHub Actions runs CI policy (10 assertions), site structure, core contracts (55 assertions), data contracts (35 assertions), live Bible requests (17 assertions), seven browser paths (78 encoded assertion sites), and syntax checks on Node 24.
- Browser dependency: locked `@playwright/test` 1.62.1; Chromium is downloaded explicitly only for browser testing and does not enter the static deployment.

## Latest cycle: exercise returning meditation and Amen continuity

### Why this was selected

Meditation-session and Amen-streak normalizers had thorough pure contracts, but
the browser suite did not prove that a returning visitor actually resumed the
saved topic/reference or carried yesterday's streak into one—and only one—Amen
for today. This is core continuity state and a small browser contract compounds
future persistence changes at low risk.

### Changes

- Added a returning-visitor browser journey with a same-day saved meditation and
  a valid yesterday streak.
- Asserted the exact restored topic, reference, session record, and visible
  four-day continuation prompt; then advanced to five days and verified the
  exact two-entry history.
- Clicked Amen a second time and proved both the duplicate warning and exactly
  equivalent persisted state, protecting against same-day inflation.
- Documented browser-suite coverage and bumped the deployment version to
  `2026.08.11.5`.

### Verification and scores

- The new coverage passed immediately, providing positive evidence that no
  production change was justified; the cycle remained test-only.
- The focused returning journey passed 3/3 consecutive runs. Three complete
  suite repetitions then passed 21/21 journeys; the suite now has seven paths /
  78 encoded interaction, persistence, fallback, layout, accessibility-state,
  and runtime assertion sites.
- `node tools/test-practice-core.mjs`: 55 passed; data: 35; live Bible: 17;
  workflow policy: 10; site structure, recursive syntax, JSON parsing, and
  `git diff --check` passed.
- `npm audit --audit-level=high`: 0 vulnerabilities.
- Correctness/reliability: 8/10 → 9/10 (continuity behavior is unchanged but now proven end to end).
- Verifiability: 7/10 → 10/10 (session resume, streak increment, history, and idempotence are browser-locked).
- Maintainability: 8/10 → 9/10 (one readable journey documents the three-store continuity contract).
- Performance: 10/10 → 10/10 (test-only change; no runtime work added).
- Security/safety: 9/10 → 9/10 (exact local state is asserted; no boundary changed).
- User experience: 8/10 → 9/10 (returning visitors' exact continuity is now regression-protected).

### Lessons and process improvements

- A passing new contract is valid improvement evidence when it closes a named
  verification gap; do not manufacture a runtime diff when behavior is already
  correct.
- Freeze dynamic calendar values inside the browser context so the fixture and
  application share the same local timezone/day boundary.
- For continuity features, assert visible meaning first, then exact storage,
  then an idempotent repeated action.

## Previous cycles

- Cycle 49: restored a same-day meditation and yesterday streak in Chromium, then proved Amen advances exactly once.
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
| 1 | Announce meditation feedback and validate topic-control semantics for assistive technology | Accessibility / UX | Medium | Small / low | `#med-feedback` has no live/status semantics and the topic container declares `listbox` while rendering plain buttons |
| — | Exercise saved meditation session and streak restoration in a real browser | Verification | Low-medium | Small / low | Seven browser paths now prove same-day resume, yesterday continuation, exact history, and duplicate-Amen idempotence | Completed in Cycle 49 |
| — | Exercise preference restoration in a real browser | Verification / correctness | Medium | Small / low | Six browser paths now cover all shared preference effects and single-action controls | Completed in Cycle 48 |
| — | Validate the bundled wallpaper catalog's non-path fields | Correctness | Low-medium | Small / low | 35 data contracts plus validation-before-assignment and browser recovery | Completed in Cycle 47 |
| — | Add a narrow mobile browser path for header and music-dock interaction | Verification / UX | Medium | Small-medium / low | Four browser paths / 53 checks | Completed in Cycle 46 |

## Next cycle

Local next: make meditation feedback perceivable to assistive technology and
align the topic control's declared semantics with its button behavior. Workspace
next: rotate to the car-classification service's current backlog.
