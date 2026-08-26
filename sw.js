const CACHE_NAME = 'tax-cup-pwa-v1';
const APP_SHELL = [
  './',
  './index.html',
  './employees.html',
  './company.html',
  './payroll.html',
  './login.html',
  './styles.css',
  './composition.css',
  './brand.css',
  './tax-bands.css',
  './header-brand.css',
  './report.css',
  './navigation.css',
  './archive.css',
  './employees.css',
  './company.css',
  './company-payroll.css',
  './payroll.css',
  './archive.js',
  './app.js',
  './employees.js',
  './company.js',
  './payroll.js',
  './login.js',
  './tax-cup-logo.svg',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    if (response.ok && new URL(event.request.url).origin === self.location.origin) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
    }
    return response;
  })));
});
