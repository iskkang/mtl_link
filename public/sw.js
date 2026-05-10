// Bump CACHE_NAME on every deployment to invalidate all old caches.
const CACHE_NAME = 'mtl-link-v3';

// Only precache static assets — never cache index.html here.
// index.html must always come from the network so new deploys are reflected.
const PRECACHE = [
  '/manifest.webmanifest',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/maskable-192x192.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Delete every cache that doesn't match the current version.
      caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
      ),
      self.clients.claim(),
    ])
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // Only handle same-origin requests.
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    // Navigation: network-first so the browser always gets the latest HTML.
    // Cache the fresh response so the app still loads offline.
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() =>
          caches.match(event.request).then(cached => cached || Response.error())
        )
    );
    return;
  }

  // Static assets (icons, manifest): cache-first.
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request)).catch(() => Response.error())
  );
});

/* === 백업: v2.10 Phase A 시점의 push 핸들러 (롤백 대비) ===
self.addEventListener('push', (event) => {
  let data = { title: 'MTL Link', body: '새 메시지가 도착했습니다', roomId: null, url: '/' };
  if (event.data) {
    try { data = { ...data, ...event.data.json() }; } catch (e) { console.error('[SW] Push data parse error:', e); }
  }
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const hasFocusedClient = allClients.some(c => c.focused === true);
    if (hasFocusedClient) { return; }
    return self.registration.showNotification(data.title, {
      body: data.body, icon: '/icons/icon-192x192.png', badge: '/icons/icon-96x96.png',
      tag: data.roomId || 'default', renotify: true, requireInteraction: false,
      data: { roomId: data.roomId, url: data.url || '/' },
    });
  })());
});
=== 백업 끝 === */

self.addEventListener('push', (event) => {
  event.waitUntil(handlePush(event));
});

async function handlePush(event) {
  // 1. payload 파싱 — 실패해도 기본값으로 알림 표시
  let data = {
    title:  'MTL Link',
    body:   '새 메시지가 도착했어요',
    roomId: undefined,
    url:    '/',
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch (err) {
    console.warn('[SW push] payload 파싱 실패, 기본값 사용:', err);
  }

  // 2. 포커스된 클라이언트 체크 — 실패하면 알림 표시 (안전 fallback)
  let hasFocusedClient = false;
  try {
    const allClients = await self.clients.matchAll({
      type:               'window',
      includeUncontrolled: true,
    });
    hasFocusedClient = allClients.some(c =>
      c.focused === true && c.visibilityState === 'visible'
    );
  } catch (err) {
    console.warn('[SW push] clients 조회 실패, 알림 표시로 진행:', err);
    hasFocusedClient = false;
  }

  if (hasFocusedClient) {
    // 사용자가 앱을 직접 보고 있음 → OS 알림 스킵
    return;
  }

  // 3. 알림 표시
  return self.registration.showNotification(data.title, {
    body:               data.body,
    icon:               '/icons/icon-192x192.png',
    badge:              '/icons/icon-96x96.png',
    tag:                data.roomId || 'default',
    renotify:           true,
    requireInteraction: false,
    data: {
      url:    data.url || '/',
      roomId: data.roomId,
    },
  });
}

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
