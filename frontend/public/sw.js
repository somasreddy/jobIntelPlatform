/**
 * JobIntel AI — Service Worker
 * Strategy: Network-first with cache fallback for navigation requests.
 * Static assets are cached on install.
 */

const CACHE_NAME = "jobintel-v1";
const STATIC_ASSETS = [
  "/",
  "/jobs",
  "/interview",
  "/offline.html",
];

// ── Install: pre-cache static shell ──────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(STATIC_ASSETS).catch(() => {
        // Non-fatal: some assets may not exist yet
      })
    )
  );
  self.skipWaiting();
});

// ── Activate: remove old caches ───────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first, fallback to cache ───────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only intercept GET requests
  if (request.method !== "GET") return;

  // Skip API requests — always go to network
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful navigation responses
        if (response.ok && request.mode === "navigate") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(async () => {
        // Network failed — try cache
        const cached = await caches.match(request);
        if (cached) return cached;

        // Navigation fallback: offline page
        if (request.mode === "navigate") {
          const offlinePage = await caches.match("/offline.html");
          if (offlinePage) return offlinePage;
        }

        return new Response("Offline", {
          status: 503,
          headers: { "Content-Type": "text/plain" },
        });
      })
  );
});
