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
    config: sandbox.window.VERSEKEEP_BIBLE,
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

{
  let fetches = 0;
  let underlyingAborts = 0;
  const harness = loadBible((_url, options = {}) => {
    fetches += 1;
    return new Promise((_, reject) => {
      options.signal?.addEventListener(
        "abort",
        () => {
          underlyingAborts += 1;
          reject(new Error("aborted"));
        },
        { once: true }
      );
    });
  }, { requestTimeoutMs: 1000 });
  const firstController = new AbortController();
  const secondController = new AbortController();
  const first = harness.bible.resolveVerse("Mark 1:1", "Bundled first", {
    signal: firstController.signal,
  });
  const second = harness.bible.resolveVerse("Mark 1:1", "Bundled second", {
    signal: secondController.signal,
  });
  firstController.abort();
  assert.equal((await within(first)).text, "Bundled first", "cancelled consumer gets its own fallback");
  assert.equal(underlyingAborts, 0, "one cancelled consumer preserves the shared fetch");
  secondController.abort();
  assert.equal((await within(second)).text, "Bundled second", "last cancelled consumer settles safely");
  assert.equal(underlyingAborts, 1, "last consumer aborts the shared fetch");

  harness.setFetch(async () => {
    fetches += 1;
    return response("Fresh retry");
  });
  const retry = await within(harness.bible.resolveVerse("Mark 1:1", "Bundled retry"));
  assert.equal(fetches, 2, "abandoned shared work is immediately retryable");
  assert.equal(retry.text, "Fresh retry", "retry does not inherit the aborted request");
}

{
  let underlyingAborts = 0;
  const { bible } = loadBible((_url, options = {}) =>
    new Promise((_, reject) => {
      options.signal?.addEventListener(
        "abort",
        () => {
          underlyingAborts += 1;
          reject(new Error("aborted"));
        },
        { once: true }
      );
    }), { requestTimeoutMs: 1000 });
  const controller = new AbortController();
  const speculative = bible.prefetch("Luke 1:37", undefined, {
    signal: controller.signal,
  });
  assert.equal(typeof speculative?.then, "function", "an uncached prefetch exposes its completion");
  controller.abort();
  await within(speculative);
  assert.equal(underlyingAborts, 1, "cancelling speculative work aborts its unshared fetch");
}

{
  const urls = [];
  let underlyingAborts = 0;
  const pending = [];
  const harness = loadBible((url, options = {}) => {
    urls.push(String(url));
    return new Promise((resolve, reject) => {
      pending.push({ url: String(url), resolve, reject });
      options.signal?.addEventListener(
        "abort",
        () => {
          underlyingAborts += 1;
          reject(new Error("aborted"));
        },
        { once: true }
      );
    });
  }, { requestTimeoutMs: 5000, preferred: "niv", bibleApiTranslation: "niv" });

  const oldController = new AbortController();
  const stale = harness.bible.prefetch("John 3:16", "niv", {
    signal: oldController.signal,
  });
  assert.equal(typeof stale?.then, "function", "previous-slug neighbor prefetch is in flight");

  harness.config.bibleApiTranslation = "esv";
  harness.config.preferred = "esv";
  const next = harness.bible.prefetch("John 3:16", "esv");
  assert.equal(typeof next?.then, "function", "new-slug neighbor prefetch starts after the switch");

  oldController.abort();
  await within(stale);
  assert.equal(underlyingAborts, 1, "cancelling the previous slug leaves the new slug in flight");
  assert.equal(urls.filter((url) => url.includes("/NIV/")).length, 1, "old prefetch stays on NIV");
  assert.equal(urls.filter((url) => url.includes("/ESV/")).length, 1, "new prefetch uses ESV");

  const esv = pending.find((entry) => entry.url.includes("/ESV/"));
  esv.resolve(response("For God so loved the world"));
  const live = await within(next);
  assert.equal(live.text, "For God so loved the world", "new slug completes after the old prefetch is cancelled");
  assert.equal(live.translation, "ESV", "completed prefetch stays on the requested slug");
}

console.log("test-bible-live.mjs: 26 request, cancellation, and fallback assertions passed");
