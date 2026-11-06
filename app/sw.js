// Offline-Speicher. Bei Änderungen die Versionsnummer erhöhen.
const CACHE = "tag-v4";
const FILES = ["./", "index.html", "styles.css", "data.js", "app.js", "core.js", "icons.svg", "varianten.html", "manifest.webmanifest",
  "fonts/besley-latin.woff2", "icons/icon.svg", "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Erst Netz (damit Updates ankommen), sonst Offline-Kopie.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
