const CACHE_NAME = "backpacker-pwa-v140";
const APP_SHELL = [
  "./",
  "./styles.css?v=organizer-mode-20260904",
  "./app-qr.js",
  "./analytics-source-contract.js?v=referral-arrival-20260829",
  "./financial-core.js",
  "./trip-date-core.js",
  "./trip-draft-quantity-core.js",
  "./trip-draft-ai-core.js?v=i18n-ai-draft-20260824",
  "./link-intake-ui-core.js",
  "./recoverable-auth-core.js",
  "./extension-connect-ui-core.js",
  "./identity-bridge-core.js",
  "./group-trip-core.js",
  "./travel-idea-core.js",
  "./travel-ideas-client.js",
  "./trip-item-attachments-core.js",
  "./trip-item-attachments-client.js",
  "./platform-file-boundary-core.js",
  "./private-trip-sync-core.js",
  "./private-trip-sync-client.js",
  "./i18n.js?v=organizer-mode-20260904",
  "./locales/ru.json",
  "./locales/en.json",
  "./locales/fr.json",
  "./locales/ka.json",
  "./locales/de.json",
  "./locales/hy.json",
  "./locales/zh.json",
  "./app.js?v=organizer-mode-20260904",
  "./analytics-config.js?v=2",
  "./supabase-config.public.js?v=1",
  "./vendor/pdf-lib.min.js",
  "./manifest.webmanifest",
  "./assets/kazan-cover.jpg",
  "./assets/status-backup.png",
  "./assets/status-fixed.png",
  "./assets/status-maybe.png",
  "./assets/status-paid.png",
  "./assets/status-want.png",
  "./icons/backpacker-192.png?v=logo-beige-20260808",
  "./icons/backpacker-512.png?v=logo-beige-20260808",
  "./icons/backpacker-maskable-512.png?v=logo-beige-20260808",
  "./icons/apple-touch-icon.png?v=logo-beige-20260808",
  "./icons/card-copy.png",
  "./icons/piggy-bank.png",
  "./fonts/inter-cyrillic.woff2",
  "./fonts/inter-latin.woff2",
  "./fonts/noto-sans-georgian.ttf",
  "./fonts/noto-sans-armenian.ttf",
  "./fonts/LICENSE-NOTO.txt",
  "./assets/map-home.jpg",
  "./icons/backpacker-logo-transparent.png",
  "./icons/backpacker-logo.svg?v=logo-beige-20260808"
];

const STATIC_URLS = new Set(APP_SHELL.map((path) => new URL(path, self.registration.scope).href));
const INDEX_URL = new URL("./", self.registration.scope).href;

function isSensitiveRequest(request, url) {
  return request.headers.has("Authorization")
    || /\/(?:auth|rest|functions|storage)\/v1(?:\/|$)/.test(url.pathname)
    || /\/supabase-config(?:\.e2e-local)?\.js$/.test(url.pathname)
    || [...url.searchParams.keys()].some((key) => /^(?:share|token|access_token|refresh_token|code|signature|sig|apikey)$/i.test(key));
}

function isStaticRequest(request, url) {
  return request.method === "GET" && url.origin === self.location.origin
    && !isSensitiveRequest(request, url) && STATIC_URLS.has(url.href);
}

function isCacheableResponse(response) {
  return response.ok && !response.redirected
    && ["basic", "default"].includes(response.type)
    && !/(?:no-store|private)/i.test(response.headers.get("Cache-Control") || "")
    && !/(?:\*|authorization|cookie)/i.test(response.headers.get("Vary") || "");
}

function isShellNavigation(request, url) {
  const shell = new URL(INDEX_URL);
  return request.mode === "navigate" && url.origin === shell.origin
    && [shell.pathname, new URL("./index.html", self.registration.scope).pathname].includes(url.pathname)
    && [...url.searchParams.keys()].every((key) => key === "lang");
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => Promise.all([...STATIC_URLS].map(async (url) => {
      const response = await fetch(url, { cache: "no-store" });
      if (!isCacheableResponse(response)) throw new Error("app_shell_response_not_cacheable");
      await cache.put(url, response);
    })))
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
  if (isSensitiveRequest(event.request, url)) {
    event.respondWith(fetch(event.request, { cache: "no-store" }));
    return;
  }
  if (event.request.method !== "GET") return;
  const cacheable = isStaticRequest(event.request, url);
  const shellNavigation = isShellNavigation(event.request, url);

  event.respondWith(
    fetch(event.request, cacheable ? undefined : { cache: "no-store" })
      .then((response) => {
        if (cacheable && isCacheableResponse(response)) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)));
        }
        return response;
      })
      .catch(async (error) => {
        if (!cacheable && !shellNavigation) throw error;
        const cache = await caches.open(CACHE_NAME);
        const cached = cacheable ? await cache.match(event.request) : null;
        if (cached) return cached;
        if (shellNavigation) {
          const shell = await cache.match(INDEX_URL);
          if (shell) return shell;
        }
        throw error;
      })
  );
});
