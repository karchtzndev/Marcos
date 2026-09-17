/**
 * ⚙️ Config - O Markin
 * Constantes e configurações compartilhadas
 */

const Config = {
  // Aplicação
  APP_VERSION: '1.0.0',
  APP_NAME: 'O Markin',
  APP_SUBTITLE: "Chef's Burguer",

  // Timing
  VISITA_VALIDADE: 30 * 60 * 1000, // 30 minutos
  CARRINHO_SALVAR_DELAY: 1000,      // 1 segundo
  ATIVIDADE_TIMEOUT: 5 * 60 * 1000, // 5 minutos

  // Limites
  MAX_NOME_LENGTH: 100,
  MAX_ENDERECO_LENGTH: 200,
  MAX_ITEMS_CARRINHO: 999,
  MAX_TELEFONE_LENGTH: 11,

  // Valores
  FRETE_PADRAO: 5.00,
  TEMPO_PREPARO_MIN: 15, // minutos

  // Cache
  CACHE_VERSION: 'v43',
  CACHE_ASSETS: ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png', '/mascot.jpg'],

  // Storage keys
  STORAGE_VISITA: 'markin_visita',
  STORAGE_CARRINHO: 'markin_carrinho',
  STORAGE_TELEFONE: 'markin_telefone',
  STORAGE_HISTORICO: 'markin_historico',

  // URLs
  BASE_URL: window.location.origin,
  WHATSAPP_GERENTE: '5511999999999', // Substituir

  // Permissões
  REQUER_NOTIFICACOES: true,
  REQUER_GEOLOCATION: false,

  // Firestore Collections
  COLLECTIONS: {
    VISITAS: 'visitas',
    PEDIDOS: 'pedidos',
    CLIENTES: 'clientes',
    CARDAPIO: 'cardapio',
    MENSAGENS: 'mensagens',
    ERROR_LOG: 'errorLog',
    SETTINGS: 'settings',
    BACKUP: 'backup'
  },

  // Status de pedido
  ORDER_STATUS: {
    NOVO: 'novo',
    PREPARANDO: 'preparando',
    PRONTO: 'pronto',
    ENTREGUE: 'entregue',
    CANCELADO: 'cancelado'
  },

  // Status de visita
  VISITA_STATUS: {
    NAVEGANDO: 'navegando',
    COM_CARRINHO: 'comCarrinho',
    ABANDONOU: 'abandonou',
    FINALIZOU: 'finalizou'
  },

  // Features habilitadas
  FEATURES: {
    PWA: true,
    NOTIFICACOES: true,
    OFFLINE: true,
    REAL_TIME: true,
    ANALYTICS: true,
    BACKUP_AUTO: true
  },

  // Helper: Obter status name legível
  getStatusName(status) {
    const names = {
      novo: '📋 Novo',
      preparando: '🔥 Preparando',
      pronto: '✅ Pronto',
      entregue: '🎉 Entregue',
      cancelado: '❌ Cancelado'
    };
    return names[status] || status;
  },

  // Helper: Formato de moeda
  formatMoney(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  },

  // Helper: Formato de data
  formatDate(date, formato = 'curto') {
    const d = new Date(date);
    const opcoes = {
      curto: { day: '2-digit', month: '2-digit', year: '2-digit' },
      longo: { day: '2-digit', month: 'long', year: 'numeric' },
      completo: { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    };
    return d.toLocaleDateString('pt-BR', opcoes[formato] || opcoes.curto);
  },

  // Helper: Verificar online
  isOnline() {
    return navigator.onLine;
  },

  // Helper: Detectar dispositivo
  getDevice() {
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad/.test(ua)) return 'iOS';
    if (/android/.test(ua)) return 'Android';
    return 'Desktop';
  }
};

// Exportar
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Config;
}
