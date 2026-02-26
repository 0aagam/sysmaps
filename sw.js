const CACHE = 'sysmap-v1';
const SHELL = ['/', '/index.html', '/css/style.css', '/js/env-loader.js', '/js/config.js', '/js/themes.js', '/js/app.js', '/js/main.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;
  // Don't intercept Firebase calls
  if (url.includes('firestore.googleapis.com') || url.includes('identitytoolkit') || url.includes('securetoken') || url.includes('gstatic.com/firebasejs')) return;
  e.respondWith(
    fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    }).catch(() => caches.match(e.request))
  );
});
