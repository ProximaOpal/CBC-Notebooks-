const CACHE = "cbc-notebooks-v9";
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/css/styles.css",
  "./assets/js/main.js",
  "./assets/js/config.js",
  "./assets/js/hero.js",
  "./assets/js/panel.js",
  "./assets/js/nav.js",
  "./assets/js/pwa.js",
  "./assets/js/overlays.js",
  "./assets/js/auth-overlay.js",
  "./assets/js/google-gis.js",
  "./assets/js/lib/dom.js",
  "./assets/js/lib/telemetry.js",
  "./assets/js/lib/auth-validate.js",
  "./assets/js/data/subjects.js",
  "./assets/img/icons/icon-192.png",
  "./assets/img/icons/icon-512.png",
  "./assets/img/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      if (fresh.ok && new URL(req.url).origin === self.location.origin) {
        const copy = fresh.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy));
      }
      return fresh;
    } catch {
      if (req.mode === "navigate") {
        const fallback = await caches.match("./index.html");
        if (fallback) return fallback;
      }
      throw new Error("offline");
    }
  })());
});
