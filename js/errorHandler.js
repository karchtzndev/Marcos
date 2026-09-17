/**
 * 🐛 Error Handler - O Markin
 * Tratamento centralizado de erros com logging
 */

const ErrorHandler = {
  // Log de erro para Firebase
  async log(error, context = {}) {
    try {
      const timestamp = new Date().toISOString();
      const errorData = {
        timestamp,
        message: error?.message || String(error),
        stack: error?.stack || '',
        source: context.source || 'unknown',
        url: window.location.href,
        userAgent: navigator.userAgent,
        ...context
      };

      // Salvar no Firebase (se autenticado)
      if (typeof db !== 'undefined') {
        await db.collection('errorLog').add(errorData);
      }

      // Log no console em desenvolvimento
      if (process.env.NODE_ENV !== 'production') {
        console.error('[ERROR LOG]', errorData);
      }
    } catch (e) {
      // Falha silenciosa se não conseguir logar
      console.error('Erro ao registrar log:', e);
    }
  },

  // Mostrar mensagem de erro ao usuário
  showNotification(message, type = 'error', duration = 5000) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.setAttribute('role', 'alert');
    notification.setAttribute('aria-live', 'polite');

    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">
          ${type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'}
        </span>
        <span class="notification-text">${message}</span>
        <button class="notification-close" aria-label="Fechar notificação">✕</button>
      </div>
    `;

    // Adicionar estilos se não existirem
    if (!document.getElementById('notification-styles')) {
      const style = document.createElement('style');
      style.id = 'notification-styles';
      style.textContent = `
        .notification {
          position: fixed;
          bottom: 20px;
          right: 20px;
          max-width: 400px;
          padding: 16px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          animation: slideIn 0.3s ease;
          z-index: 9999;
        }

        .notification-error {
          background: #c1521c;
          color: #f2e9da;
          border-left: 4px solid #b6382c;
        }

        .notification-success {
          background: #4caf6d;
          color: #f2e9da;
          border-left: 4px solid #3a8556;
        }

        .notification-info {
          background: #e5762e;
          color: #f2e9da;
          border-left: 4px solid #c1521c;
        }

        .notification-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .notification-icon {
          font-size: 20px;
          flex-shrink: 0;
        }

        .notification-text {
          flex: 1;
          font-size: 14px;
        }

        .notification-close {
          background: none;
          border: none;
          color: inherit;
          cursor: pointer;
          font-size: 18px;
          padding: 0;
          margin-left: 8px;
        }

        .notification-close:hover {
          opacity: 0.8;
        }

        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(400px);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    // Fechar ao clicar no X
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn?.addEventListener('click', () => removeNotification());

    // Auto-fechar após duration
    const timeout = setTimeout(removeNotification, duration);

    function removeNotification() {
      clearTimeout(timeout);
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }

    return notification;
  },

  // Wraper para async operations com tratamento automático
  async wrap(asyncFn, context = {}) {
    try {
      return await asyncFn();
    } catch (error) {
      await this.log(error, context);
      this.showNotification(
        error?.message || 'Erro ao processar operação',
        'error'
      );
      throw error;
    }
  },

  // Validar e executar com tratamento de erro
  validate(validationResult, onSuccess) {
    if (!validationResult.valid) {
      this.showNotification(validationResult.error, 'error');
      return false;
    }
    if (typeof onSuccess === 'function') {
      onSuccess(validationResult.value);
    }
    return true;
  },
};

// Event listener global para erros não tratados
window.addEventListener('error', (event) => {
  ErrorHandler.log(event.error, { source: 'uncaughtError' });
});

// Event listener para promessas rejeitadas não tratadas
window.addEventListener('unhandledrejection', (event) => {
  ErrorHandler.log(event.reason, { source: 'unhandledRejection' });
});

// Exportar para uso
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ErrorHandler;
}
