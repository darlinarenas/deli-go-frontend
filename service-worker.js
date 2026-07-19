const CACHE_NAME = 'bhuz-pwa-v9-20260719';
const APP_SHELL = [
  '/',
  '/index.html',
  '/mis-pedidos.html',
  '/panel-repartidor.html',
  '/manifest.webmanifest',
  '/manifest-driver.webmanifest',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .catch(() => null)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isPage = request.mode === 'navigate';
  const isFreshAsset = /\.(?:html|js|css|webmanifest)$/i.test(url.pathname);

  if (isPage || isFreshAsset) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          if (isPage) return caches.match('/index.html');
          throw new Error('Sin conexión');
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
      return response;
    }))
  );
});

self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; }
  catch (_) { payload = { body: event.data ? event.data.text() : '' }; }

  const title = payload.title || 'BHUZ';
  const options = {
    body: payload.body || 'Tienes una actualización.',
    icon: '/assets/icons/icon-192.png',
    badge: '/assets/icons/icon-192.png',
    tag: payload.tag || 'bhuz-update',
    renotify: true,
    vibrate: [180, 80, 180],
    data: { url: payload.url || '/mis-pedidos.html' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/mis-pedidos.html', self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
      for (const windowClient of windows) {
        if ('focus' in windowClient && windowClient.url.startsWith(self.location.origin)) {
          windowClient.navigate(target).catch(() => {});
          return windowClient.focus();
        }
      }
      return clients.openWindow ? clients.openWindow(target) : null;
    })
  );
});
