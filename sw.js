// يحفظ ملفات المجلس على الجهاز ليفتح بسرعة وبدون إنترنت (الرسائل نفسها يحفظها Firestore)
// غيّر رقم الإصدار عند تعديل أي ملف حتى يحدَّث الكاش
const CACHE = 'family-chat-v11';
const FILES = [
  './',
  'index.html',
  'css/style.css',
  'fonts/baloo-bhaijaan-2-arabic.woff2',
  'fonts/baloo-bhaijaan-2-latin.woff2',
  'js/art.js',
  'js/vendor/qrcode.js',
  'js/vendor/jsQR.js',
  'js/cloud.js',
  'js/app.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const SDK = 'https://www.gstatic.com/firebasejs/';

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.startsWith(SDK)) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    })));
    return;
  }
  if (new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true })
      .then(hit => hit || fetch(e.request))
      .catch(() => caches.match('index.html'))
  );
});

// الضغط على تنبيه رسالة يفتح المجلس على تلك المحادثة
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const room = e.notification.data && e.notification.data.room;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const win = list.find(c => c.url.includes(self.registration.scope));
    if (win) { win.focus(); if (room) win.postMessage({ room }); return; }
    return self.clients.openWindow('./');
  }));
});
