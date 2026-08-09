import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(resolve(root, "docs/assets/js/practice-core.js"), "utf8");
const sandbox = { window: {} };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: "practice-core.js" });

const similarity = sandbox.window.VerseKeepPracticeCore?.recallSimilarity;
assert.equal(typeof similarity, "function", "recallSimilarity is exported");
assert.equal(similarity("", ""), 1, "two empty answers match");
assert.equal(similarity("trust", ""), 0, "non-empty answer cannot match an empty target");
assert.equal(similarity("trust in the lord", "trust in the lord"), 1, "exact recall scores 100%");
assert(
  similarity("lord the in trust", "trust in the lord") < 0.82,
  "reordered words do not pass the recall threshold"
);
assert(
  similarity("trust trust trust trust", "trust in the lord") < 0.82,
  "repeating one valid word does not pass"
);
assert(
  similarity("trust in lord", "trust in the lord") >= 0.82,
  "one missing word remains a forgiving match"
);
assert(
  similarity("the lord is my shepherd", "the lord is my shepherd the lord") < 1,
  "duplicate expected words retain their multiplicity"
);

console.log("test-practice-core.mjs: 8 recall-scoring assertions passed");
