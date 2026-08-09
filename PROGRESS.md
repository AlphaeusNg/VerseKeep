# VerseKeep continuous improvement log

Last updated: 2026-08-09 (Cycle 36 across the projects workspace)

## Current state

- Branch: `main`; completed cycles are committed and pushed per repository policy.
- Runtime: zero-build static site deployed from `docs/`.
- Baseline verification: `node tools/test-site.mjs` plus syntax checks for every JavaScript file.
- Automated verification: GitHub Actions runs site structure, recall scoring (8 assertions), and syntax checks.

## Latest cycle: enforce checks in CI

### Why this was selected

The first behavioral practice suite and existing site checks were local-only. A small GitHub Actions workflow makes both contracts visible and enforceable on the main branch and pull requests before deeper state or network work.

### Changes

- Added `.github/workflows/ci.yml` for main pushes and pull requests.
- Runs practice scoring, site structure, and syntax checks for all runtime and tool JavaScript on Node 20.
- Uses explicit read-only repository permissions and a five-minute job timeout.

### Verification and scores

- `node tools/test-practice-core.mjs`: 8 passed, 0 failed.
- `node tools/test-site.mjs`: 60 wallpaper entries and both HTML entry points verified.
- `node --check docs/assets/js/*.js tools/*.mjs`: passed.
- Python `yaml.safe_load` of the workflow: passed.
- `git diff --check`: passed.
- Correctness/reliability: 8/10 (no behavior changed; the scoring contract remains green).
- Verifiability: 8/10 (all current checks are now automated; hosted execution awaits this cycle's push).
- Maintainability: 8/10 (CI matches the documented zero-build local workflow).
- Security/robustness: 8/10 (workflow permissions and runtime are explicitly constrained).

### Lessons and process improvements

- CI should invoke the same commands used locally so there is one source of verification truth.
- A dependency-free static project does not need package installation or caching in its workflow.
- Hosted status must be observed after push; a locally parsed workflow is necessary but not sufficient evidence.

## Previous cycle

- Cycle 35 (`15e7408`): replaced word-set recall grading with sequence-aware scoring, added eight assertions, and pushed version `2026.08.09.1`.

## Prioritized opportunities

| Priority | Opportunity | Category | Impact | Effort / risk | Evidence / dependency |
|---|---|---|---|---|---|
| 1 | Normalize and bound persisted practice stats/preferences | Reliability | High | Small / low | Parsed storage values are spread directly into counters and maps; malformed types can produce `NaN` or crashes |
| 2 | Bound and deduplicate live Bible requests | Reliability / performance | High | Medium / low | Queue hydration is sequential and fetches have no timeout or cancellation |
| 3 | Add verse/theme schema validation before rendering | Correctness | High | Medium / low | Startup trusts JSON structure beyond fetch success |

## Next cycle

Extract and test persisted stats/preferences normalization so malformed or stale localStorage cannot create `NaN` counters, invalid modes, or non-object lookup maps.
