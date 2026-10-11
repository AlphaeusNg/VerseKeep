# CI readiness: ubuntu-latest → Ubuntu 26.04

## Context

GitHub is moving the `ubuntu-latest` label to Ubuntu 26.04, rolling out from
2026-10-19 and completing by 2026-11-19. See the
[runner image announcement](https://github.com/actions/runner-images/issues/14748).

## Probe on 2026-10-12 (SGT)

A temporary branch-only commit (`32ca4fe`) ran the ci.yml `test` job on the
explicit `ubuntu-26.04` label against main `1c9e1f0`, via PR #10. The image was
`ubuntu-26.04` version `20260927.149.1`, Ubuntu 26.04.1 LTS.
See the [Probe run](https://github.com/AlphaeusNg/VerseKeep/actions/runs/38163547843)
([job](https://github.com/AlphaeusNg/VerseKeep/actions/runs/38163547843/job/114541286292)).
The whole job took 1m15s. The probe commit was reverted in `026613b` (normal
revert, no force-push) before review; the workflow on this branch matches main.

| Step | What ran on 26.04 | Duration | Result |
| --- | --- | --- | --- |
| checkout / setup-node | actions/checkout@v7, actions/setup-node@v7 Node 24 (v24.21.0 from the image tool cache) with npm cache restored | 3s | pass |
| Install browser test dependencies | `npm ci` (3 packages) | 1s | pass |
| Workflow policy | `node tools/test-workflow.mjs`: 12 CI policy assertions | <1s | pass |
| Core contracts | `node tools/test-practice-core.mjs` | <1s | pass |
| Device backup and speech | `node tools/test-session.mjs` (incl. honest storage) | <1s | pass |
| Data contracts | `node tools/test-data-core.mjs`: 35 assertions | <1s | pass |
| Live Bible requests | `node tools/test-bible-live.mjs`: 26 assertions | <1s | pass |
| Site structure | `node tools/test-site.mjs` | <1s | pass |
| Offline worker | `node tools/test-service-worker.mjs` | <1s | pass |
| Install Chromium | `npx playwright install --with-deps chromium` (Playwright 1.62.1): 9 new packages, 1 upgraded; Chrome for Testing 151.0.7922.34 | 21s | pass |
| Browser smoke test | `npm run test:browser`: 35 passed (47.9s) | 48s | pass |
| JavaScript syntax | `node --check` over docs/assets/js, docs/sw.js and tools | 1s | pass |

## Playwright

Playwright 1.62.1 treats Ubuntu 26.04 as its supported `ubuntu26.04-x64` host
platform with its own `--with-deps` package list (t64 package names), so
`--with-deps chromium` printed "Installing dependencies...", installed cleanly
(9 new, 1 upgraded) with no unsupported-OS warning.

## Decision and limits

No workflow change needed; the job stays on `ubuntu-latest`. If a future 26.04
image update breaks the job, pin it to `ubuntu-24.04` with a dated comment
citing the failure and the announcement, and link this note. Note that this
file lives under docs/, which is the GitHub Pages root (with .nojekyll), so it
is also served as a plain static file; the service worker does not precache it.
