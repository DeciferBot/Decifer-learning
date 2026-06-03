// Custom service worker for Decifer Learning.
// next-pwa requires self.__WB_MANIFEST when swSrc is set — it injects the
// precache manifest at build time. The push/notification handlers below are
// merged alongside the standard Workbox caching config.

// Required placeholder for next-pwa/Workbox precache injection.
// eslint-disable-next-line no-undef
const WB_MANIFEST = self.__WB_MANIFEST || [];

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
