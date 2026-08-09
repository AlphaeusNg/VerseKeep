# VerseKeep continuous improvement log

Last updated: 2026-08-09 (Cycle 41 across the projects workspace)

## Current state

- Branch: `main`; completed cycles are committed and pushed per repository policy.
- Runtime: zero-build static site deployed from `docs/`.
- Baseline verification: `node tools/test-site.mjs` plus syntax checks for every JavaScript file.
- Automated verification: GitHub Actions runs CI policy (5 assertions), site structure, practice/core/catalog contracts (42 assertions), live Bible requests (11 assertions), and syntax checks on Node 24.

## Latest cycle: remove deprecated CI runtimes

### Why this was selected

The successful Cycle 40 hosted run warned that both pinned GitHub actions still used the deprecated Node 20 action runtime and were being forcibly executed on Node 24. The workflow also configured Node 20 for the project checks even though that release line is end-of-life.

### Changes

- Verified from the official repositories that `actions/checkout@v7` and `actions/setup-node@v7` use Node 24 and support current GitHub-hosted runners.
- Upgraded both actions from v4 to v7 and moved project checks from end-of-life Node 20 to Active LTS Node 24.
- Added five local/hosted workflow-policy assertions for action majors, Node version, read-only permissions, and the bounded job timeout.
- Added the workflow test to CI and the README; bumped the deployment version to `2026.08.09.6`.

### Verification and scores

- `node tools/test-workflow.mjs`: 5 passed, 0 failed (the legacy checkout action failed before implementation).
- `node tools/test-practice-core.mjs`: 42 passed, 0 failed.
- `node tools/test-bible-live.mjs`: 11 passed, 0 failed.
- `node tools/test-site.mjs`: 60 wallpaper entries and both HTML entry points verified.
- `node --check docs/assets/js/*.js tools/*.mjs`: passed.
- `git diff --check`: passed.
- Correctness/reliability: 8/10 (CI no longer relies on forced compatibility for deprecated action runtimes).
- Verifiability: 9/10 (five policy invariants now fail locally before an outdated workflow is pushed).
- Maintainability: 9/10 (the action and project runtimes align on the current Active LTS line).
- Security/robustness: 9/10 (current action releases retain read-only permissions and receive supported runtime fixes).

### Lessons and process improvements

- A successful hosted run can still carry actionable maintenance evidence; warnings belong in the next prioritization pass.
- The JavaScript runtime inside an action and the Node version installed for project tests are separate upgrade targets.
- Encode least privilege and timeout limits alongside dependency versions so a future workflow edit cannot regress adjacent safeguards.

## Previous cycle

- Cycle 40 (`d34d984`): normalized meditation session/streak persistence and added ten corrupt-state assertions.
- Cycle 39 (`55191ea`): validated the 17-theme, 93-verse catalog before rendering and separated precise diagnostics from safe visitor messaging.
- Cycle 38 (`64ec822`): bounded live Bible lookups, preserved deduplication and retry behavior, and added 11 network assertions.
- Cycle 37 (`cd5636a`): normalized persisted practice stats and shared preferences; practice-core coverage increased from 8 to 22 assertions.
- Cycle 36 (`a2c21e5`): added least-privilege CI; hosted run `31293112358` completed successfully.
- Cycle 35 (`15e7408`): replaced word-set recall grading with sequence-aware scoring, added eight assertions, and pushed version `2026.08.09.1`.

## Prioritized opportunities

| Priority | Opportunity | Category | Impact | Effort / risk | Evidence / dependency |
|---|---|---|---|---|---|
| 1 | Make practice queue hydration supersedable and concurrent | Reliability / performance | High | Medium / medium | A theme with several uncached verses resolves sequentially, blocks selection, and translation changes can apply stale results |
| 2 | Validate playlist and remote-wallpaper data contracts | Correctness | Medium | Medium / low | Site checks prove JSON syntax and local paths but runtime consumers still trust object shapes |
| 3 | Add browser-level smoke coverage for startup and primary navigation | Verification | Medium | Medium / low | Pure/static checks do not execute the complete DOM boot path |

## Next cycle

Make practice queue hydration concurrent and supersedable. Add an operation token so stale theme/translation results cannot overwrite newer state, retain request deduplication, and prove ordering plus stale-result behavior with deterministic tests before changing the UI path.
