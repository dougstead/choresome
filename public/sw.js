// Choresome service worker.
//
// Deliberately simple: this is not a full offline-first sync engine (the app
// explicitly avoids that for v1 — see README). It exists to make the PWA
// installable and to keep the app shell available during brief network
// blips, e.g. the mini PC restarting or Wi-Fi hiccuping.

const CACHE_NAME = "choresome-shell-v1";
const PRECACHE_URLS = ["/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/offline.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API responses — always hit the network so data stays live.
  if (url.pathname.startsWith("/api/")) return;

  // Next.js build assets are content-hashed and safe to cache indefinitely.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  // Page navigations: try the network first (data changes constantly), fall
  // back to a cached copy, then to the offline page, if the network is down.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match("/offline.html")))
    );
  }
});
