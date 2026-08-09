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
assert.match(workflow, /timeout-minutes:\s*5\b/, "CI retains a bounded job timeout");

console.log("test-workflow.mjs: 5 CI policy assertions passed");
