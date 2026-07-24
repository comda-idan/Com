/**
 * Service Worker של האזור האישי.
 * שם המטמון נגזר מגרסת האפליקציה: כל עליית גרסה מנקה מטמון ישן,
 * כך שמשתמשים לא נתקעים על גרסה ישנה לאחר פריסה.
 */
const APP_SHELL = [
  '/',
  '/index.html',
  '/css/app.css',
  '/manifest.webmanifest',
  '/favicon.png',
  '/assets/comsign-logo.png',
  '/assets/smartcard.png',
  '/assets/token.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/js/app.js',
  '/js/config.js',
  '/js/data/seed.js',
  '/js/services/auth.js',
  '/js/services/format.js',
  '/js/services/israeli-id.js',
  '/js/services/pdf.js',
  '/js/storage/index.js',
  '/js/storage/storage-provider.js',
  '/js/storage/local-storage-provider.js',
  '/js/storage/api-storage-provider.js',
  '/js/ui/credentials.js',
  '/js/ui/invoices.js',
  '/js/ui/payment.js',
  '/js/ui/chat.js',
  '/js/ui/toast.js'
];

let cacheName = 'comsign-portal-v0';

async function resolveCacheName() {
  try {
    const response = await fetch('/version.json', { cache: 'no-store' });
    const v = await response.json();
    return `comsign-portal-${v.major}.${v.minor}.${v.patch}.${v.build}`;
  } catch {
    return cacheName;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    cacheName = await resolveCacheName();
    const cache = await caches.open(cacheName);
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    cacheName = await resolveCacheName();
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== cacheName).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // קריאות API וקובץ הגרסה — תמיד מהרשת, ללא מטמון.
  if (url.pathname.startsWith('/api/') || url.pathname === '/version.json') {
    event.respondWith(fetch(request).catch(() => new Response('{}', {
      headers: { 'Content-Type': 'application/json' }
    })));
    return;
  }

  // שאר הנכסים: מטמון תחילה, ורענון ברקע.
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);

    const network = fetch(request).then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    }).catch(() => cached);

    return cached ?? network ?? cache.match('/index.html');
  })());
});
