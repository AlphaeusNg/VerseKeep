/* VerseKeep service worker — local meditation shell and catalog offline support. */
importScripts("./assets/js/version.js");

const CACHE_PREFIX = "versekeep-";
const CACHE = `${CACHE_PREFIX}${self.SITE_VERSION.id}`;
const SCOPE_URL = new URL(self.registration.scope);
const SHELL_URL = new URL("./index.html", SCOPE_URL).href;
const DATA_PATH = new URL("./data/", SCOPE_URL).pathname;
const PRECACHE = [
  "./",
  "./index.html",
  "./404.html",
  "./manifest.webmanifest",
  "./assets/icon.svg",
  "./assets/css/style.css",
  "./assets/js/version.js",
  "./assets/js/bible-config.js",
  "./assets/js/bible-live.js",
  "./assets/js/data-core.js",
  "./assets/js/ambient.js",
  "./assets/js/wallpapers.js",
  "./assets/js/practice-core.js",
  "./assets/js/meditate.js",
  "./assets/js/app.js",
  "./data/playlists.json",
  "./data/remote-wallpapers.json",
  "./data/verses.json",
  "./data/wallpapers.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // GitHub Pages projects share an origin. Never touch sibling-project or
  // third-party requests, and never delete caches without our prefix.
  if (
    url.origin !== SCOPE_URL.origin ||
    !url.pathname.startsWith(SCOPE_URL.pathname)
  ) {
    return;
  }

  const cachePromise = caches.open(CACHE);
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        cachePromise.then((cache) => cache.match(SHELL_URL))
      )
    );
    return;
  }

  const cachedPromise = cachePromise.then((cache) => cache.match(request));
  if (url.pathname.startsWith(DATA_PATH)) {
    event.respondWith(
      cachePromise.then((cache) => fetch(request)
        .then(async (response) => {
          if (response?.ok) {
            try {
              await cache.put(request, response.clone());
            } catch {
              // A quota/policy failure must not discard a usable response.
            }
          }
          return response;
        })
        .catch(() => cache.match(request)))
    );
    return;
  }

  const networkPromise = Promise.all([cachePromise, cachedPromise]).then(
    ([cache, cached]) => fetch(request)
      .then(async (response) => {
        if (response?.ok) {
          try {
            await cache.put(request, response.clone());
          } catch {
            // A quota/policy failure must not discard a usable response.
          }
        }
        return response;
      })
      .catch(() => cached)
  );
  event.respondWith(cachedPromise.then((cached) => cached || networkPromise));
  event.waitUntil(networkPromise.then(() => undefined));
});
