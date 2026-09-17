/**
 * 🍔 App Client Initialization — O Markin
 * Integra todas as otimizações de performance
 */

// Aguardar DOM pronto
document.addEventListener('DOMContentLoaded', () => {
  // 1️⃣ LAZY LOADING DE IMAGENS
  console.log('[Markin] Inicializando lazy loading...');
  if (typeof Performance !== 'undefined') {
    Performance.lazyLoadImages({
      rootMargin: '50px',
      threshold: 0.1
    });
  }

  // 2️⃣ DEBOUNCE EM INPUTS DE BUSCA
  const searchInput = document.querySelector('input[type="search"]');
  if (searchInput && typeof Performance !== 'undefined') {
    const handleSearch = Performance.debounce(async (query) => {
      if (query.length < 2) return;

      console.log('[Markin] Buscando:', query);
      // Aqui vai a busca no Firebase com cache
      if (typeof FirestoreOptimization !== 'undefined') {
        try {
          // Busca com cache
          // const results = await FirestoreOptimization.getCollectionCached(...)
        } catch (error) {
          if (typeof ErrorHandler !== 'undefined') {
            ErrorHandler.log(error, { source: 'search' });
          }
        }
      }
    }, 500);

    searchInput.addEventListener('input', (e) => {
      handleSearch(e.target.value);
    });
  }

  // 3️⃣ DEBOUNCE EM SCROLL
  if (typeof Performance !== 'undefined') {
    const handleScroll = Performance.throttle(() => {
      // Atualizar UI ao scroll
      // Por exemplo: mostrar botão "voltar ao topo"
    }, 300);

    window.addEventListener('scroll', handleScroll);
  }

  // 4️⃣ ADICIONAR AO CARRINHO COM VALIDAÇÃO + ERROR HANDLING
  const addToCartButtons = document.querySelectorAll('[data-add-to-cart]');
  addToCartButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();

      const itemId = btn.dataset.itemId;
      const itemName = btn.dataset.itemName;
      const itemPrice = parseFloat(btn.dataset.itemPrice);

      // Validar quantidade
      const quantityInput = btn.closest('.card')?.querySelector('[data-quantity]');
      const quantity = quantityInput ? parseInt(quantityInput.value) : 1;

      const quantityResult = typeof Validation !== 'undefined'
        ? Validation.quantidade(quantity)
        : { valid: quantity > 0 };

      if (!quantityResult.valid) {
        if (typeof ErrorHandler !== 'undefined') {
          ErrorHandler.showNotification(quantityResult.error || 'Quantidade inválida', 'error');
        }
        return;
      }

      // Adicionar ao carrinho
      if (typeof ErrorHandler !== 'undefined') {
        await ErrorHandler.wrap(
          () => addItemToCart(itemId, itemName, itemPrice, quantityResult.value),
          { source: 'addToCart', itemId }
        );
      } else {
        addItemToCart(itemId, itemName, itemPrice, quantityResult.value);
      }

      if (typeof ErrorHandler !== 'undefined') {
        ErrorHandler.showNotification(`${itemName} adicionado ao carrinho!`, 'success');
      }
    });
  });

  // 5️⃣ PERFORMANCE MONITOR
  if (typeof PerformanceMonitor !== 'undefined') {
    console.log('[Markin] Iniciando monitoramento de performance...');
    PerformanceMonitor.init();

    // Análise de performance a cada 60 segundos
    setTimeout(() => {
      PerformanceMonitor.analyzePerformance();
    }, 60000);
  }

  // 6️⃣ CARREGAR DADOS COM CACHE
  loadProductsWithCache();

  // 7️⃣ PRELOAD DE RECURSOS CRÍTICOS
  preloadCriticalResources();

  console.log('[Markin] App inicializado com sucesso ✅');
});

// Função: Adicionar ao carrinho
function addItemToCart(itemId, itemName, itemPrice, quantity) {
  const cart = JSON.parse(localStorage.getItem(Config?.STORAGE_CARRINHO || 'markin_carrinho') || '[]');

  const existingItem = cart.find(item => item.id === itemId);

  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    cart.push({
      id: itemId,
      nome: itemName,
      preco: itemPrice,
      quantidade: quantity
    });
  }

  localStorage.setItem(Config?.STORAGE_CARRINHO || 'markin_carrinho', JSON.stringify(cart));
  updateCartCount();
}

// Função: Atualizar contador do carrinho
function updateCartCount() {
  const cart = JSON.parse(localStorage.getItem(Config?.STORAGE_CARRINHO || 'markin_carrinho') || '[]');
  const total = cart.reduce((sum, item) => sum + item.quantidade, 0);

  const cartBadge = document.querySelector('[data-cart-count]');
  if (cartBadge) {
    cartBadge.textContent = total;
    cartBadge.style.display = total > 0 ? 'inline' : 'none';
  }
}

// Função: Carregar produtos com cache
async function loadProductsWithCache() {
  if (typeof FirestoreOptimization === 'undefined') {
    console.warn('[Markin] FirestoreOptimization não disponível');
    return;
  }

  try {
    // Carregar com cache de 10 minutos
    const products = await FirestoreOptimization.getCollectionCached(
      'cardapio',
      null,
      10 * 60 * 1000 // 10 minutos
    );

    console.log('[Markin] Produtos carregados:', products.length);
    // renderProducts(products);
  } catch (error) {
    console.error('[Markin] Erro ao carregar produtos:', error);
  }
}

// Função: Preload de recursos críticos
function preloadCriticalResources() {
  if (typeof Performance === 'undefined') return;

  // Preload do ícone
  Performance.preloadResource('/icon-192.png', 'image');

  // Prefetch de páginas prováveis
  Performance.prefetchPage('/chamada/');
}

// Observador de conexão para adaptar carregamento
if (navigator.connection) {
  navigator.connection.addEventListener('change', () => {
    const connection = navigator.connection.effectiveType;
    console.log('[Markin] Tipo de conexão:', connection);

    // Adaptar qualidade de imagens
    if (connection === 'slow-2g' || connection === '2g') {
      document.body.classList.add('low-bandwidth');
    } else {
      document.body.classList.remove('low-bandwidth');
    }
  });
}

// Exportar para uso global
window.MarkinApp = {
  addItemToCart,
  updateCartCount,
  loadProductsWithCache
};
