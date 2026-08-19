const CACHE = "omarkin-cliente-v15";
const ASSETS = ["/", "/index.html", "/manifest.json", "/icon-192.png", "/icon-512.png", "/mascot.jpg"];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(()=>{}));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  if(e.request.method !== 'GET') return;
  if(new URL(e.request.url).pathname.startsWith('/gerencial')) return;
  e.respondWith(
    fetch(e.request, {cache: 'no-store'}).catch(() => caches.match(e.request))
  );
});
