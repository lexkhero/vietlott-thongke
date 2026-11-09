/* Service worker: giao diện lưu sẵn để mở nhanh/offline; dữ liệu (data/) luôn thử mạng trước. */
const VERSION = '814616d196';
const SHELL = 'vl-shell-' + VERSION;
const DATA = 'vl-data';
const FILES = ["./","./index.html","./css/style.css","./lib/jquery/dist/jquery.min.js","./js/engine.js","./js/shim.js","./js/web/app.js","./manifest.webmanifest","./icons/apple-touch-icon.png","./icons/icon-192.png","./icons/icon-512.png"];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('vl-shell-') && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (url.pathname.includes('/data/')) {
    // Mạng trước; mất mạng thì dùng bản đã lưu (bỏ tham số ?t=... khi lưu và khi tìm).
    const key = new Request(url.origin + url.pathname);
    e.respondWith(
      fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(DATA).then((c) => c.put(key, copy)); }
        return res;
      }).catch(() => caches.open(DATA).then((c) => c.match(key)).then((r) => r || Response.error()))
    );
    return;
  }

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).catch(() =>
      req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))
  );
});
