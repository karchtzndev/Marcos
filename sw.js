const CACHE = "omarkin-cliente-v49";
const ASSETS = ["/", "/index.html", "/manifest.json", "/icon-192.png", "/icon-512.png",
                "/icon-maskable-192.png", "/icon-maskable-512.png", "/apple-touch-icon.png", "/mascot.jpg"];
const STATIC_RE = /\.(png|jpg|jpeg|webp|ico|svg)$/;

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(()=>{}));
});

self.addEventListener('activate', (e) => {
  // Apaga só as versões ANTIGAS DESTE app. Antes eu apagava todos, inclusive o
  // que acabara de ser criado — o offline ficava sempre vazio.
  // E o caches.keys() enxerga a origem inteira: sem o filtro por prefixo, abrir
  // o painel gerencial apagava o cache do app do cliente (e vice-versa), então
  // quem usava os dois no mesmo celular ficava sempre sem offline.
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('omarkin-cliente-') && k !== CACHE)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if(e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if(url.origin !== location.origin) return;          // Firebase, fontes, etc.
  if(url.pathname.startsWith('/gerencial')) return;   // painel tem cache próprio
  if(url.pathname.startsWith('/chamada')) return;     // painel de chamada tem cache próprio

  // Ícones e imagens: stale-while-revalidate — mostra o cache na hora e
  // atualiza em segundo plano. Não mudam a cada deploy, não precisam
  // esperar a rede.
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

  // HTML/manifest: busca na rede e guarda uma cópia; se a rede falhar, serve do cache.
  e.respondWith(
    fetch(e.request)
      .then(resp => {
        if(resp && resp.status === 200 && resp.type === 'basic'){
          const copia = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, copia)).catch(()=>{});
        }
        return resp;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('/index.html')))
  );
});
