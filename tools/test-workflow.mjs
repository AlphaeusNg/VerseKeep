import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workflow = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8");

assert.match(workflow, /uses:\s*actions\/checkout@v7\b/, "CI uses the current checkout runtime");
assert.match(workflow, /uses:\s*actions\/setup-node@v7\b/, "CI uses the current setup-node runtime");
assert.match(workflow, /node-version:\s*["']?24["']?\b/, "CI tests on Active LTS Node 24");
assert.match(workflow, /permissions:\s*\n\s+contents:\s*read\b/, "CI retains read-only permissions");
assert.match(workflow, /timeout-minutes:\s*10\b/, "CI retains a bounded job timeout");
assert.match(workflow, /cache:\s*npm\b/, "CI caches the locked npm dependencies");
assert.match(workflow, /run:\s*npm ci\b/, "CI installs the locked browser test dependency");
assert.match(
  workflow,
  /run:\s*npx playwright install --with-deps chromium\b/,
  "CI installs the browser explicitly"
);
assert.match(workflow, /run:\s*npm run test:browser\b/, "CI executes the browser smoke test");

console.log("test-workflow.mjs: 9 CI policy assertions passed");
