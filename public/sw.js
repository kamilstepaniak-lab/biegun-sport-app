// Service Worker dla BiegunSport PWA
const CACHE_NAME = 'biegunsport-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/manifest.json',
        '/icon-192.png',
        '/icon-512.png',
      ]);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Tylko GET, pomijamy Supabase i API calls
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.hostname.includes('supabase') || url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
