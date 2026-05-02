self.addEventListener('push', (event) => {
  console.log('[SW] Push received');

  let data = { title: 'MTL Link', body: '새 메시지가 도착했습니다', roomId: null, url: '/' };
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      console.error('[SW] Push data parse error:', e);
    }
  }

  const options = {
    body: data.body,
    icon: '/mtl-logo.png',
    badge: '/mtl-logo.png',
    tag: data.roomId || 'default',
    renotify: true,
    requireInteraction: false,
    data: {
      roomId: data.roomId,
      url: data.url || '/',
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
      .then(() => console.log('[SW] Notification shown'))
      .catch(err => console.error('[SW] showNotification error:', err))
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'NAVIGATE', url });
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
