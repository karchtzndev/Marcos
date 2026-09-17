/**
 * 📊 Performance Monitor - O Markin
 * Dashboard de performance em tempo real
 */

const PerformanceMonitor = {
  metrics: {
    requests: 0,
    errors: 0,
    firestoreLogs: 0,
    startTime: Date.now()
  },

  // Inicializar monitoramento
  init() {
    this.trackNetwork();
    this.trackErrors();
    this.trackWebVitals();
    this.trackFirestore();
    this.startPeriodicReport();
  },

  // Rastrear requisições de rede
  trackNetwork() {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          if (entry.initiatorType === 'fetch' || entry.initiatorType === 'xmlhttprequest') {
            this.metrics.requests++;

            // Log requisições lentas (> 1s)
            if (entry.duration > 1000) {
              console.warn(`[Slow Request] ${entry.name}: ${entry.duration.toFixed(2)}ms`);
            }
          }
        });
      });

      observer.observe({ entryTypes: ['resource'] });
    }
  },

  // Rastrear erros
  trackErrors() {
    // Erros não-tratados
    window.addEventListener('error', () => {
      this.metrics.errors++;
    });

    // Rejections não-tratadas
    window.addEventListener('unhandledrejection', () => {
      this.metrics.errors++;
    });
  },

  // Rastrear Web Vitals
  trackWebVitals() {
    const vitals = {
      LCP: null,
      FID: null,
      CLS: null,
      TTFB: null,
      FCP: null
    };

    if ('PerformanceObserver' in window) {
      // LCP
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        vitals.LCP = lastEntry.renderTime || lastEntry.loadTime;
      }).observe({ entryTypes: ['largest-contentful-paint'] });

      // FID
      new PerformanceObserver((list) => {
        list.getEntries().forEach(entry => {
          vitals.FID = entry.processingDuration;
        });
      }).observe({ entryTypes: ['first-input'] });

      // CLS
      let clsValue = 0;
      new PerformanceObserver((list) => {
        list.getEntries().forEach(entry => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
            vitals.CLS = clsValue;
          }
        });
      }).observe({ entryTypes: ['layout-shift'] });

      // TTFB e FCP
      window.addEventListener('load', () => {
        const perfData = window.performance.timing;
        vitals.TTFB = perfData.responseStart - perfData.navigationStart;
        vitals.FCP = perfData.responseEnd - perfData.navigationStart;
      });
    }

    this.vitals = vitals;
  },

  // Rastrear Firestore
  trackFirestore() {
    // Contar chamadas de log
    const originalLog = console.log;
    let firestoreLogs = 0;

    console.log = function(...args) {
      if (args[0]?.includes('firestore') || args[0]?.includes('Firebase')) {
        firestoreLogs++;
        PerformanceMonitor.metrics.firestoreLogs = firestoreLogs;
      }
      originalLog.apply(console, args);
    };
  },

  // Relatório periódico
  startPeriodicReport(intervalMs = 60000) {
    setInterval(() => {
      this.printReport();
    }, intervalMs);
  },

  // Imprimir relatório
  printReport() {
    const uptime = Date.now() - this.metrics.startTime;
    const uptimeSeconds = (uptime / 1000).toFixed(1);

    const report = {
      'Uptime (segundos)': uptimeSeconds,
      'Requisições de rede': this.metrics.requests,
      'Erros não-tratados': this.metrics.errors,
      'Logs Firestore': this.metrics.firestoreLogs,
      'Memória (MB)': performance.memory
        ? (performance.memory.usedJSHeapSize / 1048576).toFixed(2)
        : 'N/A',
      'LCP (ms)': this.vitals?.LCP?.toFixed(0) || 'N/A',
      'FID (ms)': this.vitals?.FID?.toFixed(2) || 'N/A',
      'CLS': this.vitals?.CLS?.toFixed(3) || 'N/A'
    };

    console.table(report);
  },

  // Obter relatório como JSON
  getReport() {
    return {
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.metrics.startTime,
      metrics: this.metrics,
      vitals: this.vitals,
      memory: performance.memory ? {
        used: (performance.memory.usedJSHeapSize / 1048576).toFixed(2) + ' MB',
        total: (performance.memory.totalJSHeapSize / 1048576).toFixed(2) + ' MB',
        limit: (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2) + ' MB'
      } : null,
      network: navigator.connection ? {
        type: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink + ' Mbps',
        rtt: navigator.connection.rtt + ' ms'
      } : null
    };
  },

  // Enviar relatório para Firebase
  async reportToFirebase() {
    try {
      const report = this.getReport();
      await db.collection('performanceMetrics').add(report);
      console.log('Performance report sent to Firebase');
    } catch (error) {
      console.error('Failed to send performance report:', error);
    }
  },

  // Performance hints
  analyzePerformance() {
    const analysis = [];

    // LCP
    if (this.vitals?.LCP > 2500) {
      analysis.push('⚠️  LCP > 2.5s: Preload imagens críticas');
    }

    // FID
    if (this.vitals?.FID > 100) {
      analysis.push('⚠️  FID > 100ms: Use debounce/throttle em eventos');
    }

    // CLS
    if (this.vitals?.CLS > 0.1) {
      analysis.push('⚠️  CLS > 0.1: Reserve espaço para imagens/ads');
    }

    // Memory
    if (performance.memory) {
      const heapUsed = performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit;
      if (heapUsed > 0.8) {
        analysis.push('⚠️  Heap > 80%: Possível memory leak');
      }
    }

    // Erros
    if (this.metrics.errors > 5) {
      analysis.push(`⚠️  ${this.metrics.errors} erros não-tratados: Verificar console`);
    }

    // Requisições lentas
    if (this.metrics.requests > 50) {
      analysis.push(`⚠️  ${this.metrics.requests} requisições: Considerar cache/paginação`);
    }

    if (analysis.length === 0) {
      analysis.push('✅ Performance dentro dos limites');
    }

    console.group('Performance Analysis');
    analysis.forEach(msg => console.log(msg));
    console.groupEnd();

    return analysis;
  }
};

// Auto-init se não estiver em teste
if (typeof window !== 'undefined' && !window.testMode) {
  window.addEventListener('load', () => {
    // Iniciar depois que tudo carregar
    setTimeout(() => PerformanceMonitor.init(), 1000);
  });
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PerformanceMonitor;
}
