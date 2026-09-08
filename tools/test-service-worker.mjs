import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(resolve(root, "docs/sw.js"), "utf8");
const scope = "https://alphaeusng.github.io/VerseKeep/";
const shellUrl = `${scope}index.html`;

function createWorker({ cached = {}, networkFails = false, cacheKeys = [] } = {}) {
  const listeners = new Map();
  const calls = { deleted: [], fetch: [], match: [], open: [], put: [] };
  const cache = {
    async addAll() {},
    async match(request) {
      const url = typeof request === "string" ? request : request.url;
      calls.match.push(url);
      return cached[url] ? new Response(cached[url]) : undefined;
    },
    async put(request, response) {
      calls.put.push({ url: request.url, body: await response.text() });
    },
  };
  const self = {
    SITE_VERSION: { id: "test" },
    registration: { scope },
    clients: { claim: async () => {} },
    skipWaiting: async () => {},
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
  };
  const context = {
    URL,
    Promise,
    Response,
    self,
    importScripts() {},
    caches: {
      async open(name) {
        calls.open.push(name);
        return cache;
      },
      async keys() {
        return cacheKeys;
      },
      async delete(name) {
        calls.deleted.push(name);
        return true;
      },
    },
    async fetch(request) {
      calls.fetch.push(request.url);
      if (networkFails) throw new Error("offline");
      return new Response("network");
    },
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "sw.js" });

  function dispatch(type, request) {
    const responses = [];
    const lifetimes = [];
    listeners.get(type)?.({
      request,
      respondWith(value) {
        responses.push(Promise.resolve(value));
      },
      waitUntil(value) {
        lifetimes.push(Promise.resolve(value));
      },
    });
    return { responses, lifetimes };
  }

  return { calls, dispatch };
}

{
  const worker = createWorker();
  const event = worker.dispatch("fetch", {
    method: "GET",
    mode: "cors",
    url: "https://alphaeusng.github.io/ChristoDay/js/app.js",
  });
  assert.equal(event.responses.length, 0, "sibling projects stay outside the worker");
  assert.equal(worker.calls.fetch.length, 0, "out-of-scope requests bypass the worker");
}

{
  const worker = createWorker({
    cached: { [shellUrl]: "offline VerseKeep shell" },
    networkFails: true,
  });
  const event = worker.dispatch("fetch", {
    method: "GET",
    mode: "navigate",
    url: `${scope}?v=Psalm+56%3A3&t=trusting-god`,
  });
  const response = await event.responses[0];
  assert.equal(await response.text(), "offline VerseKeep shell");
  assert.deepEqual(worker.calls.match, [shellUrl], "unseen share URLs use the canonical shell");
}

{
  const worker = createWorker({
    cached: { [`${scope}data/verses.json`]: '{"themes":[]}' },
    networkFails: true,
  });
  const event = worker.dispatch("fetch", {
    method: "GET",
    mode: "cors",
    url: `${scope}data/verses.json`,
  });
  const response = await event.responses[0];
  assert.equal(await response.text(), '{"themes":[]}');
}

{
  const worker = createWorker({
    cached: { [`${scope}data/verses.json`]: "stale catalog" },
  });
  const event = worker.dispatch("fetch", {
    method: "GET",
    mode: "cors",
    url: `${scope}data/verses.json`,
  });
  const response = await event.responses[0];
  assert.equal(await response.text(), "network", "online catalogs prefer fresh network data");
  assert.deepEqual(worker.calls.fetch, [`${scope}data/verses.json`]);
}

{
  const worker = createWorker({
    cacheKeys: ["other-project-v1", "versekeep-old", "versekeep-test"],
  });
  const event = worker.dispatch("activate");
  await Promise.all(event.lifetimes);
  assert.deepEqual(worker.calls.deleted, ["versekeep-old"], "activation preserves foreign caches");
}

console.log("test-service-worker.mjs: scope, navigation fallback, fresh/catalog fallback, and cache ownership passed");
