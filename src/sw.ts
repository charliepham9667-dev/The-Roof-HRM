/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, NetworkOnly } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare const self: ServiceWorkerGlobalScope;

clientsClaim();

// Injected by vite-plugin-pwa — do not remove
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Navigation requests (HTML page loads): always serve index.html from
// the precache but use NetworkFirst so a fresh copy is attempted first.
// This prevents stale HTML referencing old JS hashes after a deployment.
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: 'navigation',
      networkTimeoutSeconds: 3,
      plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
    })
  )
);

// ALL Supabase traffic goes to network only — no caching whatsoever.
// This is the safest approach: avoids stale auth tokens, 401 loops,
// and broken sessions in iOS PWA standalone mode.
registerRoute(
  ({ url }) => url.hostname.includes('.supabase.co'),
  new NetworkOnly()
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
