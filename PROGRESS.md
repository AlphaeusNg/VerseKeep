# VerseKeep continuous improvement log

Last updated: 2026-08-10 (Cycle 73 across the projects workspace; VerseKeep Cycle 43)

## Current state

- Branch: `main`; completed cycles are committed and pushed per repository policy.
- Runtime: zero-build static site deployed from `docs/`.
- Baseline verification: deterministic Node contracts, real-browser smoke coverage, and syntax checks for every JavaScript file.
- Automated verification: GitHub Actions runs CI policy (9 assertions), site structure, core contracts (51 assertions), live Bible requests (11 assertions), one 18-check browser path, and syntax checks on Node 24.
- Browser dependency: locked `@playwright/test` 1.62.1; Chromium is downloaded explicitly only for browser testing and does not enter the static deployment.

## Latest cycle: execute startup and primary navigation in Chromium

### Why this was selected

The helper and static suites could not detect broken script loading, DOM boot failures, or integration faults across meditation, topics, queue hydration, music, and wallpapers. A real-browser path now covers the highest-value visitor journey without making the deployed site or routine static development depend on a browser.

### Changes

- Added a pinned Playwright test dependency, lockfile, single-worker configuration, and test-only local server.
- Added a real Chromium smoke path covering verse startup, theme/music/wallpaper rendering, top-nav anchor navigation, topic-to-meditation alignment, drill entry, hydrated study text, and practice-mode switching.
- Fail the suite on uncaught page exceptions or browser `console.error` messages.
- Deterministically replace external font, support-script, Bible, music iframe, image, and counter requests so CI proves bundled fallback behavior without internet-service availability.
- Added locked dependency installation, explicit Chromium provisioning, npm caching, and the browser path to least-privilege CI; expanded workflow policy checks from five to nine.
- Ignored browser artifacts, documented the local command, and bumped the deployment version to `2026.08.10.1`.

### Verification and scores

- Harness evidence: the first draft failed on two incorrect test assumptions (wallpaper class and deliberate HTTP-error noise); both were corrected without changing production code.
- Mutation evidence: temporarily replacing the `app.js` script URL made the browser suite fail on absent meditation output and the browser 404; the original source was restored immediately.
- `npm run test:browser`: one journey / 18 interaction and runtime checks passed in approximately 3 seconds.
- `node tools/test-practice-core.mjs`: 51 passed, 0 failed.
- `node tools/test-bible-live.mjs`: 11 passed, 0 failed.
- `node tools/test-workflow.mjs`: 9 passed, 0 failed.
- `node tools/test-site.mjs`: 60 wallpaper entries and both HTML entry points verified.
- `node --check docs/assets/js/*.js tools/*.mjs tools/browser/*.mjs playwright.config.mjs`: passed.
- `npm audit --audit-level=high`: 0 vulnerabilities.
- `git diff --check`: passed.
- Correctness/reliability: 9/10 (the existing visitor path is now executed as shipped).
- Verifiability: 10/10 (pure contracts, requests, static structure, and browser integration form separate layers).
- Maintainability: 9/10 (one focused journey, pinned dependency, and deterministic external boundary keep failures localized).
- Performance: 10/10 for visitors (deployment bytes and runtime behavior are unchanged); CI adds one approximately 3-second test plus browser provisioning.

### Lessons and process improvements

- Browser stubs should return syntactically valid success responses that trigger application fallback; intentional HTTP failures create noisy resource errors and weaken the signal.
- Assert visitor-observable outcomes and runtime cleanliness rather than implementation timing, because startup performs several independent async tasks.
- A reversible missing-script mutation is a cheap proof that a smoke test catches deployment wiring failures, not just happy-path selectors.
- Keep browser installation explicit in CI so ordinary `npm ci` and static development do not download a browser.

## Previous cycles

- Cycle 43: executed startup and primary meditation-to-practice navigation in real Chromium.
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
| 1 | Validate playlist and remote-wallpaper data contracts | Correctness | Medium | Small-medium / low | Browser coverage renders today's valid files, but malformed future records still reach runtime consumers before a precise diagnostic |
| 2 | Abort obsolete queue requests instead of only ignoring results | Performance | Medium | Medium / medium | Operation tokens prevent stale writes, but superseded fetches run until their bounded timeout |
| 3 | Add a narrow mobile browser path for header and music-dock interaction | Verification / UX | Medium | Small-medium / low | The new path covers primary desktop navigation; compact sticky-header and dock behavior remain static-only |

## Next cycle

Validate playlist and remote-wallpaper schemas before their runtime renderers consume them, with precise test failures and safe visitor-facing fallback behavior. This is the best next impact-to-risk step because it closes known untrusted-data boundaries now exercised by the browser suite.
