/* Service Worker — Historias Clínicas
 * - Lightweight runtime cache (network-first for navigations, cache-first for static)
 * - Web Push (no-payload "tickle") + click navigation
 */
const CACHE = "hc-runtime-v1";

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never cache API / auth / supabase calls
  if (
    url.pathname.startsWith("/api/") ||
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("lovable.app/api")
  ) return;

  // Navigations: network-first with cache fallback
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone()).catch(() => {});
          return fresh;
        } catch {
          const cached = await caches.match(req);
          return cached || caches.match("/");
        }
      })()
    );
    return;
  }

  // Same-origin static assets: cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        try {
          const fresh = await fetch(req);
          if (fresh.ok) {
            const cache = await caches.open(CACHE);
            cache.put(req, fresh.clone()).catch(() => {});
          }
          return fresh;
        } catch {
          return cached || Response.error();
        }
      })()
    );
  }
});

// ---------- Push ----------
self.addEventListener("push", (event) => {
  let data = { title: "Historias Clínicas", body: "Nueva notificación", url: "/pacientes" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || "hc-notif",
      data: { url: data.url || "/pacientes" },
      requireInteraction: data.urgent === true,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/pacientes";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of all) {
        if ("focus" in c) {
          await c.focus();
          if ("navigate" in c) await c.navigate(target);
          return;
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(target);
    })()
  );
});
