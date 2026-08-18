# VerseKeep continuous improvement log

Last updated: 2026-08-18 (Cycle 158 across the projects workspace; VerseKeep Cycle 52)

## Current state

- Branch: `main`; completed cycles are committed and pushed per repository policy.
- Runtime: zero-build static site deployed from `docs/`.
- Baseline verification: deterministic Node contracts, real-browser smoke coverage, and syntax checks for every JavaScript file.
- Automated verification: GitHub Actions runs CI policy (10 assertions), site structure, core contracts (55 assertions), data contracts (35 assertions), live Bible requests (17 assertions), ten browser paths, and syntax checks on Node 24.
- Deployment version: `2026.08.18.1`.
- Browser dependency: locked `@playwright/test` 1.62.1; Chromium is downloaded explicitly only for browser testing and does not enter the static deployment.

## Latest cycle: align practice-mode selector semantics

### Why this was selected

The practice chips declared a tablist without tabpanels or arrow-key tab
behavior. Clicking a chip already swapped the stage like a toggle group, so the
ARIA contract was false. This was the oldest remaining non-profile backlog item.

### Changes

- Replaced the practice `tablist`/`tab`/`aria-selected` contract with a named
  group of `aria-pressed` buttons, matching the meditation topic chips.
- Updated `setMode()` to keep pressed state in sync with the active mode.
- Added a Chromium journey that locates the group by role, proves no practice
  tablist exists, and switches Study → Type it through the accessible name.
- Bumped the deployment stamp to `2026.08.18.1`.

### Verification and scores

- Deterministic gates: site, practice-core 55, data-core, bible-live, workflow
  10, recursive syntax, and `git diff --check` passed.
- `CI=1 npm run test:browser`: 10/10, including the new pressed-button group
  path. An earlier local run collided with another project's server on 4174;
  forcing a fresh VerseKeep server isolated that.
- Correctness/reliability: 8/10 → 9/10 (declared semantics now match click behavior).
- Verifiability: 7/10 → 10/10 (group role, pressed state, and mode switch are browser-locked).
- Maintainability: 8/10 → 9/10 (one group contract covers every practice mode).
- Performance: 10/10 → 10/10.
- Security/safety: 9/10 → 9/10.
- User experience/accessibility: 5/10 → 9/10 (assistive tech no longer receives a fake tab widget).

### Lessons and process improvements

- Match ARIA containers to the interaction children actually implement.
- When Playwright reuses 4174, another project's leftover server can serve the
  wrong app; CI-forced webServer startup avoids that.

### Explicit next opportunity

Inspect remaining music-source chips, which still declare a tablist. Workspace
next: continue rotation; skip Car-Type-Classification-Service.

## Previous cycle: announce practice feedback accessibly

### Why this was selected

The primary meditation feedback was accessible after the prior cycle, but the
practice surface still changed `#feedback` visually for grading, reveal, copy,
and shuffle actions without status semantics. A screen-reader user could invoke
the core memory controls and receive no programmatic result.

### Changes

- Made the shared practice feedback element an atomic status region while
  preserving its existing hidden/visible and success/error styling behavior.
- Added a real-browser journey that enters practice and triggers Reveal, Copy,
  Shuffle, and an incorrect Type-it grade through actual controls.
- The journey grants clipboard access explicitly, locates the live region by
  its accessible role, and verifies each action's exact or semantic feedback.
- Documented the expanded browser scope and bumped the deployment version to
  `2026.08.14.1`.

### Verification and scores

- Test-first evidence: the initial browser locator incorrectly searched for a
  status containing the feedback element itself. After correcting it to query
  the visible non-empty status, the old page still failed because no such role
  existed; the journey passed after the markup fix.
- The focused four-action accessibility journey passed.
- The complete site, practice 55/55, data 35/35, Bible 17/17, workflow 10/10,
  browser, syntax, JSON, dependency, diff, hosted CI, Pages, and live-version
  results are recorded in the Cycle 149 completion summary.
- Correctness/reliability: 9/10 → 9/10 (visual behavior is unchanged and its
  semantic result now matches it).
- Verifiability: 6/10 → 10/10 (four distinct action classes are exercised at
  the browser accessibility boundary).
- Maintainability: 8/10 → 9/10 (one native status contract covers every caller
  of the existing shared feedback function).
- Performance: 10/10 → 10/10 (two static attributes add no runtime work).
- Security/safety: 9/10 → 9/10 (clipboard permission exists only in the
  controlled browser fixture; product permissions are unchanged).
- User experience/accessibility: 4/10 → 9/10 (grading and practice action
  outcomes are now programmatically announced).

### Lessons and process improvements

- Cover a shared feedback surface through representative callers, not merely
  the markup, so future action-specific regressions remain visible.
- Explicitly grant and scope clipboard permission in browser tests rather than
  accepting a prompt fallback or weakening the path.
- When a test-first locator is itself invalid, correct it and reproduce the
  product failure again before claiming red evidence.

## Previous cycle: make meditation controls perceivable to assistive technology

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

- Cycle 51: announced practice grading, reveal, copy, and shuffle feedback
  through an atomic status region verified in Chromium.
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
| 1 | Align music-source chips with the interaction they implement | Accessibility / UX | Medium | Small / low | The music row still declares a tablist without tabpanels |
| — | Align practice-mode selector semantics with its implemented interaction | Accessibility / UX | Medium | Small / low | Named pressed-button group is browser-verified | Completed in Cycle 52 |
| — | Announce practice-mode grading, reveal, copy, and shuffle feedback to assistive technology | Accessibility / UX | Medium | Small / low | Four action classes now share an atomic status region verified in Chromium | Completed in Cycle 51 |
| — | Announce meditation feedback and validate topic-control semantics for assistive technology | Accessibility / UX | Medium | Small / low | Named button group and atomic status region are browser-verified | Completed in Cycle 50 |
| — | Exercise saved meditation session and streak restoration in a real browser | Verification | Low-medium | Small / low | Seven browser paths now prove same-day resume, yesterday continuation, exact history, and duplicate-Amen idempotence | Completed in Cycle 49 |
| — | Exercise preference restoration in a real browser | Verification / correctness | Medium | Small / low | Six browser paths now cover all shared preference effects and single-action controls | Completed in Cycle 48 |
| — | Validate the bundled wallpaper catalog's non-path fields | Correctness | Low-medium | Small / low | 35 data contracts plus validation-before-assignment and browser recovery | Completed in Cycle 47 |
| — | Add a narrow mobile browser path for header and music-dock interaction | Verification / UX | Medium | Small-medium / low | Four browser paths / 53 checks | Completed in Cycle 46 |

## Next cycle

Local next: align music-source chips with the interaction they implement.
Workspace next: continue rotation and skip Car-Type-Classification-Service.
