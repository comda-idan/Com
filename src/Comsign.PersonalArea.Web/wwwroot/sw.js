/**
 * Service Worker של האזור האישי.
 * כל הנתיבים יחסיים למיקום ה-SW, כך שהוא עובד גם תחת תת-נתיב (GitHub Pages)
 * וגם בשורש (הרצת .NET). אסטרטגיה:
 *   • ניווט, סקריפטים וסגנונות — רשת תחילה (כדי שגרסה חדשה תיכנס מיד), עם נפילה למטמון.
 *   • תמונות, אייקונים ופונטים — מטמון תחילה.
 *   • קריאות api ו-version.json — אף פעם לא נשמרות במטמון.
 */

const CACHE = 'comsign-portal-v1';

// הבסיס שאליו רשום ה-SW (למשל "/" בהרצת .NET או "/repo/" ב-GitHub Pages)
const BASE = new URL('./', self.location).pathname;

const PRECACHE = [
  './',
  './index.html',
  './css/app.css',
  './js/app.js',
  './js/config.js',
  './manifest.webmanifest',
  './assets/comsign-logo.png',
  './assets/smartcard.png',
  './assets/token.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // לא לשמור במטמון קריאות דינמיות
  if (url.pathname.includes('/api/') || url.pathname.endsWith('/version.json')) return;

  const isAsset = /\.(png|jpg|jpeg|svg|webp|ico|woff2?)$/i.test(url.pathname);

  if (isAsset) {
    event.respondWith(caches.match(request).then((cached) => cached ?? fetchAndCache(request)));
    return;
  }

  event.respondWith(
    fetchAndCache(request).catch(() =>
      caches.match(request).then((cached) => cached ?? caches.match(`${BASE}index.html`))
    )
  );
});

async function fetchAndCache(request) {
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE);
    cache.put(request, response.clone());
  }
  return response;
}
