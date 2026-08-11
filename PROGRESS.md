# VerseKeep continuous improvement log

Last updated: 2026-08-11 (Cycle 89 across the projects workspace; VerseKeep Cycle 45)

## Current state

- Branch: `main`; completed cycles are committed and pushed per repository policy.
- Runtime: zero-build static site deployed from `docs/`.
- Baseline verification: deterministic Node contracts, real-browser smoke coverage, and syntax checks for every JavaScript file.
- Automated verification: GitHub Actions runs CI policy (10 assertions), site structure, core contracts (55 assertions), data contracts (20 assertions), live Bible requests (17 assertions), three browser paths (30 checks), and syntax checks on Node 24.
- Browser dependency: locked `@playwright/test` 1.62.1; Chromium is downloaded explicitly only for browser testing and does not enter the static deployment.

## Latest cycle: cancel superseded live-verse requests safely

### Why this was selected

Latest-operation tokens prevented obsolete queue hydration from changing the page, but superseded live Bible requests still consumed network and timeout resources. Directly aborting an older operation was unsafe because requests for the same verse are deduplicated and may still serve the replacement operation.

### Changes

- Give each queue-hydration operation its own abort signal and pass it through the application boundary to live-verse resolution.
- Subscribe the replacement operation before aborting older operations, preserving an in-flight request when the replacement needs the same verse.
- Track consumers around each deduplicated request; releasing one caller affects only that caller, while releasing the final consumer aborts the underlying fetch.
- Remove abandoned requests from the in-flight registry before aborting them so an immediate retry cannot attach to doomed work.
- Keep cancellations out of the persistent cache and visitor warnings, while returning each canceled caller's own local fallback.
- Added four queue-hydration and six live-request cancellation contracts, extended static wiring checks, and bumped the deployment version to `2026.08.11.1`.

### Verification and scores

- Test-first evidence: the queue contracts first failed because resolver calls had no signal. After the implementation, the VM harness exposed a missing `AbortController`; adding the browser primitive to the harness made the new behavior testable rather than weakening the contract.
- Self-review evidence: aborting during `begin()` would have killed a shared same-verse request before its replacement subscribed. Moving supersession into `hydrate()` after resolver subscription closed that race.
- `node tools/test-practice-core.mjs`: 55 passed, 0 failed; replacement subscriptions precede obsolete cancellation and stale work remains noncommittable.
- `node tools/test-bible-live.mjs`: 17 passed, 0 failed; duplicate consumers share one fetch, individual cancellation is isolated, final cancellation aborts once, and immediate retry starts fresh work.
- `node tools/test-data-core.mjs`: 20 passed, 0 failed.
- `npm run test:browser`: three journeys / 30 interaction, fallback, and runtime checks passed in approximately 4 seconds.
- `node tools/test-workflow.mjs`: 10 passed, 0 failed.
- `node tools/test-site.mjs`: 60 wallpaper entries and both HTML entry points verified.
- `node --check docs/assets/js/*.js tools/*.mjs tools/browser/*.mjs playwright.config.mjs`: passed.
- `npm audit --audit-level=high`: 0 vulnerabilities.
- `git diff --check`: passed.
- Correctness/reliability: 9/10 (latest-wins rendering now includes resource ownership without breaking deduplication).
- Verifiability: 10/10 (queue ordering, shared-fetch cancellation, retry, static integration, and real-browser paths agree).
- Maintainability: 9/10 (the in-flight registry now owns request lifetime as well as deduplication).
- Performance: 10/10 (obsolete hydration stops its network work as soon as no active consumer needs it).
- Security/safety: 9/10 (canceled responses cannot enter the cache or surface internal cancellation details).
- User experience: 9/10 (rapid topic or translation changes no longer leave avoidable background work competing with the current queue).

### Lessons and process improvements

- Cancellation ownership belongs at the deduplication boundary: operation-level signals alone cannot know whether another caller still needs shared work.
- A replacement must subscribe before the superseded consumer releases its claim when both can target the same request.
- Delete an abandoned in-flight entry before aborting its controller so synchronous retries cannot inherit a doomed promise.
- VM contract harnesses need the browser primitives used by production code; a missing primitive is a harness fidelity gap, not a reason to weaken runtime behavior.

## Previous cycles

- Cycle 45: canceled superseded queue hydration with consumer-aware shared-request ownership.
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
| 1 | Add a narrow mobile browser path for header and music-dock interaction | Verification / UX | Medium | Small-medium / low | Desktop and invalid-data paths are covered; compact sticky-header and dock behavior remain static-only |
| 2 | Validate the bundled wallpaper catalog's non-path fields | Correctness | Low-medium | Small / low | Site checks verify every declared asset path, but title/tag/tone/ID shape is not yet shared with runtime validation |
| 3 | Exercise preference restoration in a real browser | Verification | Low-medium | Small / low | Pure contracts cover normalized storage, but browser smoke starts from empty storage |

## Next cycle

Local next: cover compact sticky-header and music-dock behavior in a narrow real-browser path. Workspace next: rotate to the car-classification service's current correctness and verification backlog after this focused VerseKeep cycle.
