# VerseKeep continuous improvement log

Last updated: 2026-08-11 (Cycle 140 across the projects workspace; VerseKeep Cycle 50)

## Current state

- Branch: `main`; completed cycles are committed and pushed per repository policy.
- Runtime: zero-build static site deployed from `docs/`.
- Baseline verification: deterministic Node contracts, real-browser smoke coverage, and syntax checks for every JavaScript file.
- Automated verification: GitHub Actions runs CI policy (10 assertions), site structure, core contracts (55 assertions), data contracts (35 assertions), live Bible requests (17 assertions), eight browser paths (82 encoded assertion sites), and syntax checks on Node 24.
- Browser dependency: locked `@playwright/test` 1.62.1; Chromium is downloaded explicitly only for browser testing and does not enter the static deployment.

## Latest cycle: make meditation controls perceivable to assistive technology

### Why this was selected

The horizontal topic row declared a listbox while rendering ordinary toggle
buttons, so assistive technology received a container/widget contract the child
controls did not implement. Transient Amen, copy, share, and speech feedback was
also only visual. Correcting both semantics is a high-value, low-risk improvement
to the primary meditation journey.

### Changes

- Replaced the false `listbox` contract with a named group containing the
  existing pressed-state topic buttons.
- Made `#med-feedback` an atomic status region so its transient action results
  are announced without moving focus.
- Added a real-browser journey that locates the group and status by their
  accessible roles, verifies the active button state, and triggers an Amen
  announcement.
- Documented the expanded browser coverage and bumped the deployment version to
  `2026.08.11.6`.

### Verification and scores

- The new browser contract failed against the old page because no correctly
  named topic-button group existed, then passed 3/3 after the semantic fix.
- Three complete suite repetitions passed 24/24 journeys; the suite now has
  eight paths / 82 encoded interaction, persistence, fallback, layout,
  accessibility-state, and runtime assertion sites.
- `node tools/test-practice-core.mjs`: 55 passed; data: 35; live Bible: 17;
  workflow policy: 10; site structure, recursive syntax, JSON parsing, and
  `git diff --check` passed.
- `npm audit --audit-level=high`: 0 vulnerabilities.
- Correctness/reliability: 8/10 → 9/10 (declared control semantics now match actual button behavior).
- Verifiability: 8/10 → 10/10 (the accessible roles and dynamic announcement are browser-locked).
- Maintainability: 8/10 → 9/10 (native roles describe the interaction without custom keyboard code).
- Performance: 10/10 → 10/10 (two static attributes add no meaningful runtime work).
- Security/safety: 9/10 → 9/10 (no trust boundary changed).
- User experience/accessibility: 5/10 → 9/10 (the primary controls and results are now programmatically perceivable).

### Lessons and process improvements

- Match ARIA containers to the behavior children actually implement; a native
  button with `aria-pressed` belongs in a named group, not an incomplete listbox.
- Exercise live-region behavior through a real user action and query the
  resulting role, rather than accepting markup-only evidence.
- Accessibility fixes can remain surgical when native semantics already cover
  the interaction model.

## Previous cycles

- Cycle 50: aligned meditation topic-button semantics and announced transient feedback through an atomic status region.
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
| 1 | Announce practice-mode grading, reveal, copy, and shuffle feedback to assistive technology | Accessibility / UX | Medium | Small / low | `#feedback` changes dynamically but has no status or alert semantics |
| — | Announce meditation feedback and validate topic-control semantics for assistive technology | Accessibility / UX | Medium | Small / low | Named button group and atomic status region are browser-verified | Completed in Cycle 50 |
| — | Exercise saved meditation session and streak restoration in a real browser | Verification | Low-medium | Small / low | Seven browser paths now prove same-day resume, yesterday continuation, exact history, and duplicate-Amen idempotence | Completed in Cycle 49 |
| — | Exercise preference restoration in a real browser | Verification / correctness | Medium | Small / low | Six browser paths now cover all shared preference effects and single-action controls | Completed in Cycle 48 |
| — | Validate the bundled wallpaper catalog's non-path fields | Correctness | Low-medium | Small / low | 35 data contracts plus validation-before-assignment and browser recovery | Completed in Cycle 47 |
| — | Add a narrow mobile browser path for header and music-dock interaction | Verification / UX | Medium | Small-medium / low | Four browser paths / 53 checks | Completed in Cycle 46 |

## Next cycle

Local next: make practice grading and action feedback perceivable to assistive
technology. Workspace next: rotate to the car-classification service's current
backlog.
