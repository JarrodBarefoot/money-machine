// Money Machine service worker — network-first for the page (updates always flow),
// cache-first for static assets, full offline fallback.
const CACHE = "mm-v1";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Page loads: network first so new briefs land instantly; cache fallback for offline.
  if (req.mode === "navigate" || url.pathname.endsWith("/index.html")) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put("index.html", copy));
          return res;
        })
        .catch(() => caches.match("index.html"))
    );
    return;
  }

  // Same-origin statics (icons, manifest): cache first, refresh in background.
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then(hit => {
        const refresh = fetch(req)
          .then(res => { caches.open(CACHE).then(c => c.put(req, res.clone())); return res; })
          .catch(() => hit);
        return hit || refresh;
      })
    );
  }
  // Cross-origin (Google Fonts): let the browser handle it normally.
});
