/**
 * ⚡ Performance Utilities - O Markin
 * Otimizações de renderização e eventos
 */

const Performance = {
  // Debounce: Esperar parar de chamar antes de executar
  debounce(func, delay = 300) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), delay);
    };
  },

  // Throttle: Executar no máximo uma vez por intervalo
  throttle(func, limit = 300) {
    let lastRun = 0;
    return function(...args) {
      const now = Date.now();
      if (now - lastRun >= limit) {
        func.apply(this, args);
        lastRun = now;
      }
    };
  },

  // Lazy load de imagens
  lazyLoadImages(options = {}) {
    const settings = {
      rootMargin: options.rootMargin || '50px',
      threshold: options.threshold || 0.1,
      ...options
    };

    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;

          // Carregar imagem real
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
          }

          // Carregar srcset
          if (img.dataset.srcset) {
            img.srcset = img.dataset.srcset;
            img.removeAttribute('data-srcset');
          }

          img.classList.add('loaded');
          observer.unobserve(img);
        }
      });
    }, settings);

    // Observar todas as imagens lazy
    document.querySelectorAll('img[data-src]').forEach(img => {
      imageObserver.observe(img);
    });

    return imageObserver;
  },

  // Preload de recursos críticos
  preloadResource(url, type = 'script') {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = type;
    link.href = url;
    document.head.appendChild(link);
  },

  // Prefetch de página provável
  prefetchPage(url) {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    document.head.appendChild(link);
  },

  // Memoization: Cache resultados de funções puras
  memoize(func) {
    const cache = new Map();

    return function(...args) {
      const key = JSON.stringify(args);

      if (cache.has(key)) {
        return cache.get(key);
      }

      const result = func.apply(this, args);
      cache.set(key, result);

      return result;
    };
  },

  // Virtual scrolling para listas grandes
  createVirtualList(container, items, renderFn, options = {}) {
    const {
      itemHeight = 50,
      bufferSize = 5,
      containerHeight = window.innerHeight
    } = options;

    let scrollTop = 0;
    const totalHeight = items.length * itemHeight;

    // Atualizar ao scroll
    const updateVisibleItems = () => {
      scrollTop = container.scrollTop;
      const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - bufferSize);
      const endIndex = Math.min(
        items.length,
        Math.ceil((scrollTop + containerHeight) / itemHeight) + bufferSize
      );

      container.innerHTML = '';

      // Adicionar padding do topo
      const topPadding = document.createElement('div');
      topPadding.style.height = (startIndex * itemHeight) + 'px';
      container.appendChild(topPadding);

      // Renderizar items visíveis
      for (let i = startIndex; i < endIndex; i++) {
        const element = renderFn(items[i], i);
        element.style.height = itemHeight + 'px';
        container.appendChild(element);
      }

      // Adicionar padding do fim
      const bottomPadding = document.createElement('div');
      bottomPadding.style.height = Math.max(0, (items.length - endIndex) * itemHeight) + 'px';
      container.appendChild(bottomPadding);
    };

    // Usar requestAnimationFrame para smooth scrolling
    let frameScheduled = false;
    container.addEventListener('scroll', () => {
      if (!frameScheduled) {
        frameScheduled = true;
        requestAnimationFrame(() => {
          updateVisibleItems();
          frameScheduled = false;
        });
      }
    });

    // Render inicial
    updateVisibleItems();
  },

  // Medir Core Web Vitals
  measureWebVitals(callback) {
    // Largest Contentful Paint
    if ('PerformanceObserver' in window) {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        callback('LCP', lastEntry.renderTime || lastEntry.loadTime);
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

      // Cumulative Layout Shift
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
            callback('CLS', clsValue);
          }
        }
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });

      // First Input Delay
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          callback('FID', entry.processingDuration);
        });
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
    }

    // Medir Time to Interactive
    if ('PerformanceNavigationTiming' in window) {
      window.addEventListener('load', () => {
        const perfData = window.performance.timing;
        const tti = perfData.loadEventEnd - perfData.navigationStart;
        callback('TTI', tti);
      });
    }
  },

  // Memory profiling
  getMemoryUsage() {
    if (performance.memory) {
      return {
        usedJSHeapSize: (performance.memory.usedJSHeapSize / 1048576).toFixed(2) + ' MB',
        totalJSHeapSize: (performance.memory.totalJSHeapSize / 1048576).toFixed(2) + ' MB',
        jsHeapSizeLimit: (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2) + ' MB'
      };
    }
    return null;
  },

  // Benchmark uma função
  benchmark(func, iterations = 1000, label = 'Function') {
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      func();
    }

    const end = performance.now();
    const avgTime = (end - start) / iterations;

    console.log(`${label}: ${avgTime.toFixed(4)}ms per execution (${iterations} iterations)`);

    return {
      totalTime: end - start,
      avgTime: avgTime,
      iterations: iterations
    };
  },

  // Network information (se disponível)
  getNetworkInfo() {
    if (navigator.connection) {
      const conn = navigator.connection;
      return {
        effectiveType: conn.effectiveType, // 4g, 3g, 2g, slow-2g
        downlink: conn.downlink + ' Mbps',
        rtt: conn.rtt + 'ms',
        saveData: conn.saveData
      };
    }
    return null;
  },

  // Detectar connection e adaptar
  shouldLoadHeavyAssets() {
    if (navigator.connection) {
      const type = navigator.connection.effectiveType;
      return type === '4g'; // Só carregar em 4G
    }
    return true; // Default: carregar
  },

  // Performance mark (para debugging)
  mark(name) {
    if ('performance' in window) {
      performance.mark(name);
    }
  },

  measure(name, startMark, endMark) {
    if ('performance' in window) {
      performance.measure(name, startMark, endMark);
      const measure = performance.getEntriesByName(name)[0];
      console.log(`${name}: ${measure.duration.toFixed(2)}ms`);
      return measure.duration;
    }
  }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Performance;
}
