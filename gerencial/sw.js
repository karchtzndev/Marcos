const CACHE = "omarkin-gerencial-v64";
const ASSETS = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png", "./mascot.jpg"];
const STATIC_RE = /\.(png|jpg|jpeg|webp|ico|svg)$/;

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(()=>{}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if(e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if(url.origin !== location.origin) return;

  // Ícones e imagens: stale-while-revalidate — mostra o cache na hora e
  // atualiza em segundo plano.
  if(STATIC_RE.test(url.pathname)){
    e.respondWith(
      caches.match(e.request).then(cached => {
        const network = fetch(e.request).then(resp => {
          if(resp && resp.status === 200 && resp.type === 'basic'){
            const copia = resp.clone();
            caches.open(CACHE).then(c => c.put(e.request, copia)).catch(()=>{});
          }
          return resp;
        }).catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // HTML/manifest: busca na rede e guarda uma cópia; se a rede falhar, serve
  // do cache exato ou, na falta dele, do index (evita a tela de erro padrão
  // do navegador ao abrir uma rota offline sem cache).
  e.respondWith(
    fetch(e.request)
      .then(resp => {
        if(resp && resp.status === 200 && resp.type === 'basic'){
          const copia = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, copia)).catch(()=>{});
        }
        return resp;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
