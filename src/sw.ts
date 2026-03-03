/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare const self: ServiceWorkerGlobalScope;

clientsClaim();

// Injected by vite-plugin-pwa — do not remove
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Auth, realtime, storage, and Edge Functions MUST always go to network.
// Caching these causes login loops and stale 401s on iOS PWA.
registerRoute(
  ({ url }) =>
    url.hostname.includes('.supabase.co') && (
      url.pathname.startsWith('/auth/') ||
      url.pathname.startsWith('/realtime/') ||
      url.pathname.startsWith('/storage/') ||
      url.pathname.startsWith('/functions/') ||
      url.searchParams.has('apikey')
    ),
  new NetworkOnly()
);

// Runtime cache for Supabase REST API (Network First, 24h)
// Auth endpoints above are excluded, so only data queries are cached.
registerRoute(
  ({ url }) =>
    url.hostname.includes('.supabase.co') &&
    url.pathname.startsWith('/rest/v1/') &&
    !url.pathname.startsWith('/rest/v1/profiles'),
  new NetworkFirst({
    cacheName: 'supabase-api',
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// ── Web Push ──────────────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data: { title?: string; body?: string; url?: string } = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: event.data.text() };
  }

  const title = data.title ?? 'The Roof HRM';
  const options: NotificationOptions = {
    body: data.body ?? '',
    icon: '/icons/android-chrome-192x192.png',
    badge: '/icons/android-chrome-192x192.png',
    data: { url: data.url ?? '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl: string = (event.notification.data as { url?: string })?.url ?? '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
