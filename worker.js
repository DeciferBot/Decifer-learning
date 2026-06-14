// Custom service worker for Decifer Learning.
// next-pwa requires self.__WB_MANIFEST when swSrc is set — it injects the
// precache manifest at build time. The push/notification handlers below are
// merged alongside the standard Workbox caching config.

// Required placeholder for next-pwa/Workbox precache injection.
// eslint-disable-next-line no-undef
const WB_MANIFEST = self.__WB_MANIFEST || [];

// ---------------------------------------------------------------------------
// Runtime image cache (offline Learn figures)
//
// Learn `foundation_images` are raster URLs (Supabase Storage). A cache-first
// strategy means any figure a child has viewed once stays available offline —
// satisfying the PWA offline-Learn requirement without pulling in Workbox.
// ---------------------------------------------------------------------------
const IMAGE_CACHE = 'decifer-images-v1';

// ---------------------------------------------------------------------------
// Take control immediately + shed legacy precaches.
//
// Early PWA installs (before this custom worker existed) ran next-pwa's default
// Workbox SW, which precached the whole app shell. That cached shell can serve
// stale HTML referencing JS chunks that no longer exist after a deploy, causing
// a ChunkLoadError white-screen. We skip waiting, claim open clients so the new
// (image-only) worker controls them right away, and delete any Workbox precache
// / runtime caches left over from older workers. The only cache we keep is our
// own offline-Learn image cache.
// ---------------------------------------------------------------------------
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((k) => k !== IMAGE_CACHE)
            .map((k) => caches.delete(k))
        );
      } catch {
        /* best effort */
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  const isImage =
    request.destination === 'image' ||
    /\/storage\/v1\/object\//.test(url.pathname) ||
    /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(url.pathname);
  if (!isImage) return;

  event.respondWith(
    caches.open(IMAGE_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        // Only cache successful, non-opaque responses.
        if (response && response.status === 200) {
          cache.put(request, response.clone());
        }
        return response;
      } catch (err) {
        const fallback = await cache.match(request);
        if (fallback) return fallback;
        throw err;
      }
    })
  );
});

self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'Decifer Learning', body: event.data.text() }
  }

  const { title = 'Decifer Learning', body = '', icon = '/icon-192.png', badge = '/icon-192.png', url = '/', tag } = payload

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag: tag ?? 'decifer-notification',
      renotify: true,
      data: { url },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
