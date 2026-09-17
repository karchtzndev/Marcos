# ⚡ Guia de Performance — O Markin PWA

Estratégias avançadas para otimizar velocidade e eficiência.

## 📊 Métricas de Performance

### Core Web Vitals (Google)

```
LCP (Largest Contentful Paint)
├─ Alvo: < 2.5 segundos
├─ O que é: Tempo até maior elemento visível aparecer
└─ Como otimizar:
   ├─ Preload de imagens críticas
   ├─ Lazy loading de imagens fora-da-tela
   ├─ Comprimir imagens (WebP)
   └─ Critical CSS inline

FID (First Input Delay)
├─ Alvo: < 100ms
├─ O que é: Tempo de resposta do navegador ao interagir
└─ Como otimizar:
   ├─ Debounce/throttle de eventos
   ├─ Usar requestAnimationFrame
   ├─ Dividir scripts pesados
   └─ Usar Web Workers

CLS (Cumulative Layout Shift)
├─ Alvo: < 0.1
├─ O que é: Movimento inesperado de elementos
└─ Como otimizar:
   ├─ Reservar espaço para imagens
   ├─ Evitar inserir conteúdo acima
   ├─ Usar CSS containment
   └─ Transformações em vez de layout changes
```

---

## 🖼️ Otimização de Imagens

### 1. Lazy Loading

**HTML:**
```html
<!-- Usar data-src ao invés de src -->
<img 
  data-src="/imagens/pedido.jpg"
  data-srcset="/imagens/pedido-300w.jpg 300w, /imagens/pedido-600w.jpg 600w"
  alt="Foto do pedido"
  width="300"
  height="200"
>

<script src="/js/performance.js"></script>
<script>
  Performance.lazyLoadImages({ rootMargin: '50px' });
</script>
```

**CSS (Placeholder):**
```css
img[data-src] {
  background: linear-gradient(90deg, #e5e5e5, #f5f5f5);
  min-height: 200px;
  opacity: 0.5;
}

img.loaded {
  opacity: 1;
  transition: opacity 0.3s ease;
}
```

### 2. Formatos e Compressão

**WebP com Fallback:**
```html
<picture>
  <source srcset="/imagens/logo.webp" type="image/webp">
  <img src="/imagens/logo.png" alt="Logo">
</picture>
```

**Ferramentas:**
- **ImageMagick:** `convert input.jpg -quality 85 output.webp`
- **TinyPNG:** https://tinypng.com/ (batch processing)
- **ImageOptim:** https://imageoptim.com/ (Mac)
- **Squoosh:** https://squoosh.app/ (online)

### 3. Responsive Images

```html
<img
  src="/imagens/logo-small.png"
  srcset="
    /imagens/logo-300w.png 300w,
    /imagens/logo-600w.png 600w,
    /imagens/logo-1200w.png 1200w
  "
  sizes="(max-width: 600px) 90vw, (max-width: 1200px) 50vw, 100vw"
  alt="Logo"
>
```

---

## 📦 Otimização de JavaScript

### 1. Minificação

**Desenvolvimento:**
```js
// js/app.js — código normal
const meuFuncao = (parametro) => {
  return parametro * 2;
};
```

**Produção (com build tool):**
```js
// app.min.js — minificado
const a=e=>2*e;
```

**Ferramentas:**
- **Terser:** `npx terser app.js -o app.min.js`
- **UglifyJS:** `uglifyjs app.js -o app.min.js`
- **Webpack:** Build automático

### 2. Defer e Async

```html
<!-- Sincronamente (bloqueia parsing) — NÃO USAR -->
<script src="/js/app.js"></script>

<!-- Async (paralelo, executa assim que pronto) -->
<script async src="/js/analytics.js"></script>

<!-- Defer (executa após parse completo) — RECOMENDADO -->
<script defer src="/js/app.js"></script>
<script defer src="/js/ui.js"></script>

<!-- Ordem importa com defer -->
<script defer src="/js/firebase.js"></script>
<script defer src="/js/app.js"></script> <!-- app.js espera firebase -->
```

### 3. Debounce e Throttle

**Antes (muitas chamadas):**
```js
input.addEventListener('input', async (e) => {
  // Chamado a cada tecla = 100+ chamadas/segundo
  await fetch('/api/search?q=' + e.target.value);
});
```

**Depois (otimizado):**
```js
const handleSearch = Performance.debounce(async (value) => {
  // Chamado apenas após 300ms sem digitar
  const result = await fetch('/api/search?q=' + value);
}, 300);

input.addEventListener('input', (e) => {
  handleSearch(e.target.value);
});
```

**Diferença:**
- **Debounce:** Wait until user stops (input, search)
- **Throttle:** Execute at most once per interval (scroll, resize)

```js
// Throttle: no máximo 1x por 300ms
window.addEventListener('scroll', 
  Performance.throttle(updateUI, 300)
);
```

### 4. Memoization

**Antes (recalcula sempre):**
```js
function calculateTotal(items) {
  // Operação pesada
  return items.reduce((sum, item) => sum + item.price, 0);
}

// Chamado múltiplas vezes com mesmos itens
calculateTotal(carrinhoItems); // 50ms
calculateTotal(carrinhoItems); // 50ms
calculateTotal(carrinhoItems); // 50ms
```

**Depois (cache):**
```js
const calculateTotal = Performance.memoize((items) => {
  return items.reduce((sum, item) => sum + item.price, 0);
});

calculateTotal(carrinhoItems); // 50ms (calculado)
calculateTotal(carrinhoItems); // <1ms (cache)
calculateTotal(carrinhoItems); // <1ms (cache)
```

---

## 🔥 Otimização de Firestore

### 1. Query Optimization

**❌ Ruim (carrega 1000+ documentos):**
```js
const allOrders = await db.collection('pedidos').get();
const paidOrders = allOrders.docs
  .map(doc => doc.data())
  .filter(order => order.pago === true);
```

**✅ Bom (carrega apenas necessário):**
```js
const paidOrders = await db.collection('pedidos')
  .where('pago', '==', true)
  .limit(50)
  .get();
```

### 2. Paginação Eficiente

```js
const pagination = await FirestoreOptimization.getPaginatedCollection(
  'pedidos',
  20, // 20 itens por página
  {
    orderBy: ['createdAt', 'desc'],
    where: ['pago', '==', true]
  }
);

// Primeira página
const page1 = await pagination.getFirstPage();
console.log(page1); // 20 itens

// Próxima página
const page2 = await pagination.getNextPage();

// Verificar se tem mais
if (pagination.hasMore()) {
  // Mostrar botão "carregar mais"
}
```

### 3. Cache de Queries

```js
// Sem cache: hit Firestore toda vez
const orders = await FirebaseHelper.getCollection('pedidos', {
  where: ['status', '==', 'preparando']
});

// Com cache: 5 minutos
const orders = await FirestoreOptimization.getCollectionCached(
  'pedidos',
  { where: ['status', '==', 'preparando'] },
  5 * 60 * 1000 // 5 minutos
);
```

### 4. Índices do Firestore

No Firebase Console → Firestore → Indexes, criar:

```
Collection: pedidos
Fields:
  ├─ status (ASCENDING)
  └─ createdAt (DESCENDING)

Purpose: Queries like "WHERE status = 'preparando' ORDER BY createdAt DESC"
```

Ver índices recomendados:
```js
console.table(FirestoreOptimization.getRecommendedIndexes());
```

### 5. Batch Operations

```js
// Operação pesada: 500 documentos
const operations = [];
for (let i = 0; i < 500; i++) {
  operations.push({
    type: 'update',
    ref: db.collection('pedidos').doc(`pedido_${i}`),
    data: { status: 'pronto' }
  });
}

// Executar em batches (500 por batch é o máximo)
await FirestoreOptimization.optimizedBatchWrite(operations, 500);
```

---

## 🎨 Otimização de CSS

### 1. Critical CSS

**Inline o CSS crítico (acima da dobra):**
```html
<head>
  <style>
    /* Critical CSS (header, hero) */
    header { /* ... */ }
    .hero { /* ... */ }
    .cta-btn { /* ... */ }
  </style>
  
  <!-- Defer CSS não-crítico -->
  <link rel="preload" href="/css/components.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="/css/components.css"></noscript>
</head>
```

### 2. Minificação

**Desenvolvimento:**
```css
body {
  background: var(--pitch);
  color: var(--cream);
  font-family: 'DM Sans', sans-serif;
  padding: 20px;
}
```

**Produção (minificado):**
```css
body{background:var(--pitch);color:var(--cream);font-family:'DM Sans',sans-serif;padding:20px}
```

**Ferramentas:**
- **cssnano:** `npx cssnano input.css -o output.min.css`
- **Clean CSS:** `cleancss input.css -o output.min.css`

### 3. CSS Containment (isolar layout)

```css
/* Isolar componente = melhor performance */
.pedido-card {
  contain: layout style paint;
}

/* Só afeta este elemento, não afeta resto da página */
```

### 4. Will-change (hint ao navegador)

```css
/* Elemento vai se mover — prepare GPU */
.animacao {
  will-change: transform;
  transform: translateZ(0);
}

/* Remover depois da animação */
.animacao.done {
  will-change: auto;
}
```

---

## 🌐 Service Worker Avançado

### Cache Strategy

```js
// Cache-first com network fallback
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit
        if (response) return response;

        // Network
        return fetch(event.request).then(response => {
          // Cache new response
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE).then(cache => {
              cache.put(event.request, clone);
            });
          }
          return response;
        });
      })
      .catch(() => {
        // Offline fallback
        return caches.match('/offline.html');
      })
  );
});
```

---

## 📊 Monitoramento

### Medir Web Vitals

```js
<script src="/js/performance.js"></script>
<script>
  Performance.measureWebVitals((metric, value) => {
    console.log(`${metric}: ${value.toFixed(2)}ms`);
    
    // Enviar para analytics
    fetch('/analytics', {
      method: 'POST',
      body: JSON.stringify({ metric, value })
    });
  });
</script>
```

### Memory Usage

```js
console.log(Performance.getMemoryUsage());
// {
//   usedJSHeapSize: "45.23 MB",
//   totalJSHeapSize: "62.15 MB",
//   jsHeapSizeLimit: "2048.00 MB"
// }
```

### Detect Slow Network

```js
const networkInfo = Performance.getNetworkInfo();

if (networkInfo.effectiveType === '2g' || networkInfo.effectiveType === 'slow-2g') {
  // Carregar versão leve
  loadLiteVersion();
} else if (networkInfo.saveData) {
  // Usuário ativou "economizar dados"
  disableAutoPlay();
}
```

---

## ✅ Checklist de Performance

### Antes do Deploy

- [ ] **Imagens**
  - [ ] Todas em WebP com fallback
  - [ ] Lazy loaded (data-src)
  - [ ] Comprimidas (< 100KB cada)
  - [ ] Responsive (srcset)
  - [ ] Alt text presente

- [ ] **JavaScript**
  - [ ] Minificado (app.min.js)
  - [ ] Defer/Async correto
  - [ ] Debounce/Throttle em eventos
  - [ ] Sem console.log() em produção
  - [ ] Sem memory leaks

- [ ] **CSS**
  - [ ] Minificado (styles.min.css)
  - [ ] Critical CSS inline
  - [ ] Unused CSS removido
  - [ ] CSS containment em components
  - [ ] Sem !important (não crítico)

- [ ] **Firebase**
  - [ ] Índices criados
  - [ ] Queries com limit
  - [ ] Paginação implementada
  - [ ] Cache estratégico
  - [ ] Regras de segurança otimizadas

- [ ] **Service Worker**
  - [ ] Versioning correto
  - [ ] Cache strategy eficiente
  - [ ] Offline page funciona
  - [ ] Background sync
  - [ ] Cache cleanup automático

### Medir Lighthouse

```bash
# Chrome DevTools
1. Abrir DevTools (F12)
2. Aba "Lighthouse"
3. Selecionar "Desktop" ou "Mobile"
4. Clicar "Analyze page load"
5. Alvo: > 90 em cada métrica
```

---

## 🚀 Roadmap de Performance

**Semana 1:**
- [ ] Lazy load de imagens
- [ ] Minificação de JS/CSS
- [ ] Debounce/Throttle em eventos

**Semana 2:**
- [ ] Cache Firestore
- [ ] Paginação
- [ ] Índices Firestore

**Semana 3:**
- [ ] Service Worker avançado
- [ ] Critical CSS
- [ ] WebP images

**Semana 4:**
- [ ] Lighthouse > 90
- [ ] Web Vitals tracking
- [ ] Monitoring setup

---

## 📞 Referências

- **Google Performance:** https://web.dev/performance/
- **Core Web Vitals:** https://web.dev/vitals/
- **Lighthouse:** https://developers.google.com/web/tools/lighthouse
- **Firebase Optimization:** https://firebase.google.com/docs/firestore/best-practices
- **Web Fundamentals:** https://developer.mozilla.org/pt-BR/

---

**Boa otimização!** ⚡🚀
