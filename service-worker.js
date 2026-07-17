const CACHE_NAME = "backpacker-pwa-v73";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./financial-core.js",
  "./trip-date-core.js",
  "./trip-draft-quantity-core.js",
  "./link-intake-ui-core.js",
  "./recoverable-auth-core.js",
  "./app.js",
  "./analytics-config.js",
  "./supabase-config.public.js",
  "./vendor/pdf-lib.min.js",
  "./manifest.webmanifest",
  "./assets/kazan-cover.jpg",
  "./assets/status-backup.png",
  "./assets/status-fixed.png",
  "./assets/status-maybe.png",
  "./assets/status-paid.png",
  "./assets/status-want.png",
  "./icons/backpacker-192.png",
  "./icons/backpacker-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/card-copy.png",
  "./icons/backpacker-logo-transparent.png",
  "./icons/backpacker-logo.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.includes("/functions/v1/trip-share") || url.pathname.includes("/functions/v1/trip-draft-ai") || url.pathname.includes("/functions/v1/link-intake") || url.pathname.endsWith("/supabase-config.js") || url.searchParams.has("share")) {
    event.respondWith(fetch(event.request, { cache: "no-store" }));
    return;
  }
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html")))
  );
});
