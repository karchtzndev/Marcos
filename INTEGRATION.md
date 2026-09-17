# 🔗 Guia de Integração dos Novos Módulos

Como integrar os novos módulos JavaScript e estilos nos arquivos existentes.

## 🎯 Checklist de Integração

- [ ] Adicionar link para colors.css
- [ ] Integrar validation.js nos formulários
- [ ] Usar errorHandler.js em operações críticas
- [ ] Usar config.js para constantes
- [ ] Testar funcionalidades

---

## 1️⃣ Adicionar colors.css

### No `index.html`, `chamada/index.html`, `gerencial/index.html`

Na seção `<head>`, adicionar **ANTES** de `<style>`:

```html
<link rel="stylesheet" href="/css/colors.css">
```

Exemplo:
```html
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="/css/colors.css"> <!-- ← ADICIONAR -->
  <style>
    /* Seus estilos podem usar var(--ember), etc */
  </style>
</head>
```

**Benefício:** Cores centralizadas, fácil de alterar branding.

---

## 2️⃣ Integrar validation.js nos Formulários

### Exemplo: Validar telefone no checkout

**Antes:**
```js
async function checkout() {
  const telefone = document.getElementById('telefone').value;
  // Sem validação — aceita tudo
  
  await db.collection('pedidos').add({
    telefone: telefone,
    // ...
  });
}
```

**Depois:**
```js
// No <head>, adicionar:
<script src="/js/validation.js"></script>
<script src="/js/errorHandler.js"></script>

async function checkout() {
  const telefone = document.getElementById('telefone').value;
  
  // Validar
  const result = Validation.telefone(telefone);
  if (!result.valid) {
    ErrorHandler.showNotification(result.error, 'error');
    return;
  }
  
  // Usar valor validado e sanitizado
  await ErrorHandler.wrap(
    () => db.collection('pedidos').add({
      telefone: result.value,
      // ...
    }),
    { source: 'checkout' }
  );
  
  ErrorHandler.showNotification('Pedido confirmado!', 'success');
}
```

### Validações Disponíveis

```js
// Telefone (10-11 dígitos)
Validation.telefone('11999999999')
// → { valid: true, value: '11999999999' }

// Nome (3-100 chars, sem caracteres suspeitos)
Validation.nome('João Silva')
// → { valid: true, value: 'João Silva' }

// Email
Validation.email('user@example.com')
// → { valid: true, value: 'user@example.com' }

// Endereço (5-200 chars)
Validation.endereco('Rua X, 123')
// → { valid: true, value: 'Rua X, 123' }

// Quantidade (1-999)
Validation.quantidade('5')
// → { valid: true, value: 5 }

// Carrinho (verificar se não está vazio)
Validation.carrinho(carrinhoItems)
// → { valid: true }

// CPF
Validation.cpf('12345678901')
// → { valid: true, value: '12345678901' }

// Sanitizar HTML (prevenir XSS)
Validation.sanitize(userInput)
// → conteúdo seguro
```

---

## 3️⃣ Usar errorHandler.js

### Adicionar no HTML

```html
<head>
  <script src="/js/errorHandler.js"></script>
</head>
```

### Padrão: Async Wrap

Para qualquer operação async que pode falhar:

```js
// Ao invés de:
try {
  const result = await db.collection('clientes').get();
} catch (e) {
  console.error(e);
}

// Fazer:
const result = await ErrorHandler.wrap(
  () => db.collection('clientes').get(),
  { source: 'loadClientes' }
);
```

**O que acontece:**
1. ✅ Se sucesso → retorna resultado
2. ❌ Se erro → loga em Firebase + mostra notificação

### Showroom de Notifications

```js
// Erro (vermelho, 5s)
ErrorHandler.showNotification('Erro ao salvar', 'error');

// Sucesso (verde, 5s)
ErrorHandler.showNotification('Salvo com sucesso!', 'success');

// Info (laranja, 5s)
ErrorHandler.showNotification('Aguarde...', 'info');

// Custom duration
ErrorHandler.showNotification('Aviso', 'error', 3000);
```

### Log Manual

```js
// Logar erro manualmente
await ErrorHandler.log(new Error('Algo deu errado'), {
  source: 'meuComponente',
  userId: 'abc123',
  extra: 'dados customizados'
});

// Depois, ver em gerencial → Aba 🐞 Erros
```

---

## 4️⃣ Usar config.js para Constantes

### Adicionar no HTML

```html
<script src="/js/config.js"></script>
```

### Usar Constantes Compartilhadas

**Antes:**
```js
// Repetido em 3 arquivos diferentes
const VISITA_VALIDADE = 30 * 60 * 1000;
const STORAGE_VISITA = 'markin_visita';
const MAX_NOME_LENGTH = 100;
```

**Depois:**
```js
// Usar de config.js
const visitaId = localStorage.getItem(Config.STORAGE_VISITA);
const tempoExpira = Date.now() - Config.VISITA_VALIDADE;

if (nome.length > Config.MAX_NOME_LENGTH) {
  // ...
}
```

### Helpers Úteis

```js
// Formatar moeda
Config.formatMoney(120.50)
// → "R$ 120,50"

// Formatar data
Config.formatDate(new Date())
// → "17/09/26"

Config.formatDate(new Date(), 'longo')
// → "17 de setembro de 2026"

// Detectar device
Config.getDevice()
// → "iOS" | "Android" | "Desktop"

// Verificar online
if (Config.isOnline()) {
  // Fazer sync com Firebase
}

// Status legível
Config.getStatusName('preparando')
// → "🔥 Preparando"
```

---

## 5️⃣ Usar firebase.js

### Adicionar no HTML

```html
<script src="/js/firebase.js"></script>
```

### Helpers para Firestore

```js
// Get collection com query
const pedidos = await FirebaseHelper.getCollection('pedidos', {
  where: ['status', '==', 'novo'],
  orderBy: ['createdAt', 'desc'],
  limit: 10
});

// Real-time listener
const unsub = FirebaseHelper.onCollection(
  'pedidos',
  (data, error) => {
    if (error) {
      ErrorHandler.log(error, { source: 'pedidosListener' });
      return;
    }
    
    // Atualizar UI com dados
    renderPedidos(data);
  },
  {
    where: ['status', '==', 'preparando'],
    orderBy: ['createdAt', 'asc']
  }
);

// Parar de ouvir quando desmontar
// unsub();

// Batch write (múltiplos documentos de uma vez)
await FirebaseHelper.batchWrite([
  {
    type: 'set',
    ref: db.collection('pedidos').doc('ABC123'),
    data: { status: 'pronto' }
  },
  {
    type: 'update',
    ref: db.collection('pedidos').doc('DEF456'),
    data: { status: 'entregue' }
  }
]);

// Retry automático com backoff
const result = await FirebaseHelper.retryOperation(
  () => db.collection('clientes').get(),
  3,  // maxRetries
  1000 // delayMs
);
```

---

## 📋 Exemplo Completo: Formulário de Checkout

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="/css/colors.css">
  <style>
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      margin-bottom: 8px;
      font-weight: bold;
    }
    input {
      width: 100%;
      padding: 10px;
      border: 1px solid var(--line);
      border-radius: 4px;
      background: var(--char);
      color: var(--cream);
    }
    button {
      padding: 12px 24px;
      background: var(--ember);
      color: var(--pitch);
      border: none;
      border-radius: 4px;
      font-weight: bold;
      cursor: pointer;
    }
    button:hover {
      background: var(--ember-deep);
    }
  </style>
</head>
<body style="background: var(--pitch); color: var(--cream);">
  
  <form id="checkoutForm">
    <div class="form-group">
      <label for="nome">Nome:</label>
      <input type="text" id="nome" placeholder="Seu nome">
    </div>
    
    <div class="form-group">
      <label for="telefone">Telefone:</label>
      <input type="tel" id="telefone" placeholder="11999999999">
    </div>
    
    <div class="form-group">
      <label for="endereco">Endereço:</label>
      <input type="text" id="endereco" placeholder="Rua X, 123">
    </div>
    
    <button type="submit">Finalizar Pedido</button>
  </form>

  <!-- Scripts -->
  <script src="https://www.gstatic.com/firebasejs/9/firebase-app.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9/firebase-firestore.js"></script>
  <script src="/js/config.js"></script>
  <script src="/js/validation.js"></script>
  <script src="/js/errorHandler.js"></script>
  <script src="/js/firebase.js"></script>
  
  <script>
    // Inicializar Firebase (seu config aqui)
    firebase.initializeApp({
      apiKey: 'YOUR_API_KEY',
      projectId: 'YOUR_PROJECT_ID',
      // ... etc
    });
    
    const db = firebase.firestore();
    
    // Submeter form
    document.getElementById('checkoutForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Validar campos
      const nomeResult = Validation.nome(document.getElementById('nome').value);
      const telefoneResult = Validation.telefone(document.getElementById('telefone').value);
      const enderecoResult = Validation.endereco(document.getElementById('endereco').value);
      
      // Mostrar primeiro erro que encontrar
      const errors = [nomeResult, telefoneResult, enderecoResult].find(r => !r.valid);
      if (errors) {
        ErrorHandler.showNotification(errors.error, 'error');
        return;
      }
      
      // Salvar pedido com erro handling
      await ErrorHandler.wrap(
        () => db.collection('pedidos').add({
          createdAt: new Date(),
          nome: nomeResult.value,
          telefone: telefoneResult.value,
          endereco: enderecoResult.value,
          items: [], // Seu carrinho aqui
          total: 0,  // Total aqui
          status: 'novo'
        }),
        { source: 'checkoutForm' }
      );
      
      ErrorHandler.showNotification('Pedido confirmado! Você receberá uma confirmação por WhatsApp.', 'success');
      
      // Limpar form
      document.getElementById('checkoutForm').reset();
    });
  </script>
</body>
</html>
```

---

## 🧪 Testar a Integração

### 1. Abrir Browser DevTools (F12)

### 2. Console
```js
// Testar validation
Validation.telefone('11999999999')
Validation.nome('João')

// Testar config
Config.formatMoney(120.50)
Config.getDevice()

// Testar errorHandler
ErrorHandler.showNotification('Teste de notificação', 'success')
```

### 3. Verificar Firebase
- Gerencial → Aba 🐞 Erros
- Deve ver erros logados automaticamente

### 4. Offline
- DevTools → Network → Offline
- Testar se app ainda funciona com cache

---

## 🚀 Próximas Fases

**Fase 1 (Agora):**
- ✅ Adicionar os novos módulos/CSS
- ✅ Testar validação básica
- ✅ Confirmar error handling funciona

**Fase 2:**
- [ ] Extrair `<style>` para `css/base.css`
- [ ] Extrair `<script>` para `js/main.js`
- [ ] Minificar em produção

**Fase 3:**
- [ ] Testes automatizados com Jest/Mocha
- [ ] Component tests
- [ ] E2E tests com Playwright

---

**Dúvidas?** Ver README.md, ARCHITECTURE.md ou CONTRIBUTING.md

**Problemas?** Abrir issue no GitHub ou verificar errorLog no gerencial! 🐛
