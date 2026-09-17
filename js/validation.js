/**
 * 🔐 Validação de Entrada - O Markin
 * Sanitização e validação de dados do usuário
 */

const Validation = {
  // Validar telefone (celular 11 dígitos)
  telefone(value) {
    if (!value) return { valid: false, error: 'Telefone é obrigatório' };
    const clean = value.replace(/\D/g, '');
    if (clean.length < 10 || clean.length > 11) {
      return { valid: false, error: 'Telefone inválido (10-11 dígitos)' };
    }
    return { valid: true, value: clean };
  },

  // Validar nome (apenas letras, espaços, acentos)
  nome(value) {
    if (!value || value.trim().length === 0) {
      return { valid: false, error: 'Nome é obrigatório' };
    }
    if (value.trim().length < 3) {
      return { valid: false, error: 'Nome deve ter pelo menos 3 caracteres' };
    }
    if (value.trim().length > 100) {
      return { valid: false, error: 'Nome muito longo (máx 100 caracteres)' };
    }
    // Bloquear caracteres suspeitos (SQL injection, XSS)
    if (/[<>\"'%;()&+]/.test(value)) {
      return { valid: false, error: 'Nome contém caracteres inválidos' };
    }
    return { valid: true, value: value.trim() };
  },

  // Validar email
  email(value) {
    if (!value) return { valid: false, error: 'Email é obrigatório' };
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(value)) {
      return { valid: false, error: 'Email inválido' };
    }
    return { valid: true, value: value.toLowerCase().trim() };
  },

  // Validar endereço (rua, número, complemento)
  endereco(value) {
    if (!value || value.trim().length < 5) {
      return { valid: false, error: 'Endereço deve ter pelo menos 5 caracteres' };
    }
    if (value.trim().length > 200) {
      return { valid: false, error: 'Endereço muito longo' };
    }
    return { valid: true, value: value.trim() };
  },

  // Validar quantidade (mínimo 1)
  quantidade(value) {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 1) {
      return { valid: false, error: 'Quantidade deve ser no mínimo 1' };
    }
    if (num > 999) {
      return { valid: false, error: 'Quantidade máxima é 999' };
    }
    return { valid: true, value: num };
  },

  // Validar carrinho (não vazio, preços válidos)
  carrinho(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return { valid: false, error: 'Carrinho vazio' };
    }

    for (const item of items) {
      if (!item.id || !item.nome || item.qty < 1 || item.price < 0) {
        return { valid: false, error: 'Carrinho contém dados inválidos' };
      }
    }

    return { valid: true };
  },

  // Sanitizar HTML (prevenir XSS)
  sanitize(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  // Validar CPF (simples, sem dígito verificador)
  cpf(value) {
    if (!value) return { valid: false, error: 'CPF é obrigatório' };
    const clean = value.replace(/\D/g, '');
    if (clean.length !== 11) {
      return { valid: false, error: 'CPF deve ter 11 dígitos' };
    }
    // Rejeitar sequências (111.111.111-11, 000.000.000-00, etc)
    if (/^(\d)\1{10}$/.test(clean)) {
      return { valid: false, error: 'CPF inválido' };
    }
    return { valid: true, value: clean };
  },
};

// Exportar para uso em módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Validation;
}
