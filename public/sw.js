// Astrolabe service worker
// Strategy:
//   - App shell (navigation requests): network-first, fall back to cached "/" on failure
//   - Static assets (fonts, data, /_astro/*, icon): stale-while-revalidate
//   - /api/* and cross-origin: pass through, never cached
// Versioned cache name — bump on major releases to evict stale shells.

const CACHE = "astrolabe-v1"
const SHELL = [
  "/",
  "/icon.svg",
  "/manifest.webmanifest",
  "/fonts/TronicaMono-Regular.woff2",
  "/fonts/Nippo-Variable.woff2",
  "/data/pulsars.json",
  "/data/stars.json",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith("/api/")) return
  if (url.pathname === "/og.png") return

  if (req.mode === "navigate" || req.destination === "document") {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const copy = resp.clone()
          caches.open(CACHE).then((c) => c.put("/", copy))
          return resp
        })
        .catch(() => caches.match("/") || caches.match(req)),
    )
    return
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((resp) => {
          if (resp && resp.status === 200 && resp.type === "basic") {
            const copy = resp.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return resp
        })
        .catch(() => cached)
      return cached || networkFetch
    }),
  )
})
