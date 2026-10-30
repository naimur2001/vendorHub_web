// Vendors Hub service worker (hand-written, no build step).
// Pages: always from the network (prices and stock must be fresh); offline -> small offline page.
// Static assets (/_next/static, /icons): cache first, they never change under the same URL.
// The API runs on another origin and is never touched here.

const VERSION = "v1"; // bump to drop old caches after big changes
const STATIC_CACHE = `vh-static-${VERSION}`;

const OFFLINE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Offline · Vendors Hub</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #F8FAFC;
         color: #0F172A; font-family: system-ui, sans-serif; text-align: center; padding: 24px; }
  h1 { font-size: 20px; margin: 16px 0 8px; }
  p { color: #334155; font-size: 14px; margin: 0 0 24px; }
  button { background: #059669; color: #fff; border: 0; border-radius: 12px; height: 48px;
           padding: 0 24px; font-size: 14px; font-weight: 500; }
</style>
</head>
<body>
  <div>
    <img src="/icons/icon-192.png" width="72" height="72" alt="" style="border-radius:16px">
    <h1>You're offline</h1>
    <p>Check your internet connection and try again.</p>
    <button onclick="location.reload()">Try again</button>
  </div>
</body>
</html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(["/icons/icon-192.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key.startsWith("vh-") && key !== STATIC_CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // API and other sites: browser handles them

  // Page loads: network only, offline page as fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(
        () => new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } }),
      ),
    );
    return;
  }

  // Build assets and icons: cache first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});