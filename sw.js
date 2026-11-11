// يحفظ ملفات المجلس على الجهاز ليفتح بسرعة وبدون إنترنت (الرسائل نفسها يحفظها Firestore)
// غيّر رقم الإصدار عند تعديل أي ملف حتى يحدَّث الكاش
const CACHE = 'family-chat-v51';
const FILES = [
  './',
  'index.html',
  'css/style.css',
  'js/art.js',
  'js/native.js',
  'js/cloud.js',
  'js/draw.js',
  'js/app.js',
  'manifest.webmanifest',
];
// ملفات كبيرة نادرة التغيّر: لا تُنزَّل مع كل إصدار. غيّر رقمها فقط إن عدّلت أحدها
const STATIC = 'family-chat-static-v2';
const STATIC_FILES = [
  'fonts/baloo-bhaijaan-2-arabic.woff2',
  'fonts/baloo-bhaijaan-2-latin.woff2',
  'js/vendor/qrcode.js',
  'js/vendor/jsQR.js',
  'js/vendor/firebase/firebase-app.js',
  'js/vendor/firebase/firebase-auth.js',
  'js/vendor/firebase/firebase-firestore.js',
  'js/vendor/firebase/firebase-functions.js',
  'js/vendor/firebase/firebase-storage.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/badge.png',
];
const fresh = f => new Request(f, { cache: 'reload' });

self.addEventListener('install', e => {
  e.waitUntil(Promise.all([
    caches.open(CACHE).then(c => c.addAll(FILES.map(fresh))),
    caches.open(STATIC).then(async c => {
      const have = await Promise.all(STATIC_FILES.map(f => c.match(f)));
      return c.addAll(STATIC_FILES.filter((f, i) => !have[i]).map(fresh));
    }),
  ]).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      // النطاق نفسه تستخدمه الألعاب: لا نمس إلا ذاكرتنا
      .then(keys => Promise.all(keys.filter(k => k.startsWith('family-chat-') && k !== CACHE && k !== STATIC).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true })
      .then(hit => hit || fetch(e.request))
      .catch(() => caches.match('index.html'))
  );
});

// تنبيه من الخادم (functions/index.js) عند رسالة جديدة، يصل حتى لو كان المجلس مغلقاً
const IOS = /iPhone|iPad|iPod/.test(self.navigator.userAgent);
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) {}
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    // المجلس أمام صاحبه الآن (مركَّز عليه): هو يعرض الرسالة بنفسه.
    // (الآيفون يلغي التنبيهات إن وصل تنبيه لم يُعرض، فنعرضه دائماً هناك)
    const skip = !IOS && list.some(c => c.focused && c.visibilityState === 'visible');
    if (skip) return;
    return self.registration.showNotification(d.title || 'مجلس العائلة', {
      body: d.body || '💌 رسالة جديدة', icon: 'icons/icon-192.png', badge: 'icons/badge.png',
      tag: d.room || 'chat', renotify: true, lang: 'ar', dir: 'rtl', data: { room: d.room },
    });
  }));
});

// الضغط على تنبيه رسالة يفتح المجلس على تلك المحادثة
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const room = e.notification.data && e.notification.data.room;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const win = list.find(c => c.url.includes(self.registration.scope));
    if (win) { win.focus(); if (room) win.postMessage({ room }); return; }
    return self.clients.openWindow(room ? './?room=' + encodeURIComponent(room) : './');
  }));
});
