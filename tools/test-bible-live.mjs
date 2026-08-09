import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(resolve(root, "docs/assets/js/bible-live.js"), "utf8");

function response(text) {
  return {
    ok: true,
    status: 200,
    async json() {
      return { text };
    },
  };
}

function loadBible(fetchImplementation, config = {}) {
  const storage = new Map();
  let activeFetch = fetchImplementation;
  const sandbox = {
    window: {
      VERSEKEEP_BIBLE: {
        preferred: "niv",
        bibleApiTranslation: "niv",
        ...config,
      },
    },
    fetch(...args) {
      return activeFetch(...args);
    },
    sessionStorage: {
      getItem(key) {
        return storage.get(key) ?? null;
      },
      setItem(key, value) {
        storage.set(key, value);
      },
    },
    console: { warn() {} },
    AbortController,
    URLSearchParams,
    clearTimeout,
    setTimeout,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "bible-live.js" });
  return {
    bible: sandbox.window.VerseKeepBible,
    setFetch(next) {
      activeFetch = next;
    },
  };
}

async function within(promise, milliseconds = 150) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`did not settle within ${milliseconds}ms`)), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

{
  let fetches = 0;
  const { bible } = loadBible(async () => {
    fetches += 1;
    await new Promise((resolvePromise) => setImmediate(resolvePromise));
    return response("Live verse text");
  });
  const [first, second] = await Promise.all([
    bible.resolveVerse("John 3:16", "Bundled one"),
    bible.resolveVerse("John 3:16", "Bundled two"),
  ]);
  assert.equal(fetches, 1, "concurrent live requests are deduplicated");
  assert.equal(first.text, "Live verse text", "first waiter receives live text");
  assert.equal(second.text, "Live verse text", "second waiter shares live text");
}

{
  let fetches = 0;
  const hangingFetch = (_url, options = {}) => {
    fetches += 1;
    return new Promise((_, reject) => {
      options.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    });
  };
  const harness = loadBible(hangingFetch, { requestTimeoutMs: 10 });
  const [first, second] = await within(
    Promise.all([
      harness.bible.resolveVerse("Romans 8:1", "Bundled one"),
      harness.bible.resolveVerse("Romans 8:1", "Bundled two"),
    ])
  );
  assert.equal(fetches, 1, "timed-out concurrent requests share one fetch");
  assert.equal(first.text, "Bundled one", "first waiter falls back to its bundled text");
  assert.equal(second.text, "Bundled two", "second waiter falls back to its bundled text");
  assert.match(first.source, /failed/, "timeout fallback is identified");

  harness.setFetch(async () => {
    fetches += 1;
    return response("Recovered live text");
  });
  const recovered = await within(harness.bible.resolveVerse("Romans 8:1", "Bundled retry"));
  assert.equal(fetches, 2, "a timed-out request can be retried");
  assert.equal(recovered.text, "Recovered live text", "retry can recover live text");

  const invalid = await within(harness.bible.resolveVerse("not a reference", "Safe bundled text"));
  assert.equal(invalid.text, "Safe bundled text", "unparsed references use bundled fallback");
  assert.equal(fetches, 2, "unparsed references never reach the network");
}

console.log("test-bible-live.mjs: 11 request and fallback assertions passed");
