# 🍔 O Markin — PWA Chef's Burguer

Sistema PWA completo para lanchonete com Firebase/Firestore, entrega em tempo real e painel gerencial avançado.

## 📱 Três Aplicações

### 1. 🛍️ **Cliente** (`index.html`)
Site de pedidos com carrinho, histórico e acompanhamento em tempo real.
- **URL:** `/` (raiz)
- **Recursos:** Cardápio, carrinho, checkout, notificações de pedido
- **Público:** Clientes finais
- **Offline:** Funciona com Service Worker

### 2. 🍳 **Chamada/Cozinha** (`chamada/index.html`)
Display grande para cozinha com números chamados em tempo real e som.
- **URL:** `/chamada/`
- **Recursos:** Visualização de pedidos, som de alerta, status real-time
- **Público:** Cozinha/Preparo
- **Tela:** Otimizado para TV/monitor grande

### 3. 📊 **Gerencial** (`gerencial/index.html`)
Painel completo de administração com vendas, clientes, relatórios.
- **URL:** `/gerencial/`
- **Recursos:** Análise de vendas, gestão de pedidos, clientes, mensagens
- **Público:** Gerente/Admin
- **Autenticação:** Firebase Auth (email/senha)

---

## 🚀 Setup e Desenvolvimento

### Pré-requisitos
- Node.js 16+ (para dev server local)
- Conta Firebase com Firestore habilitado

### Variáveis de Ambiente

Criar arquivo `.env.local` na raiz:

```env
VITE_FIREBASE_API_KEY=seu-api-key
VITE_FIREBASE_PROJECT_ID=seu-project-id
VITE_FIREBASE_AUTH_DOMAIN=seu-project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://seu-project.firebaseio.com
VITE_FIREBASE_STORAGE_BUCKET=seu-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=seu-sender-id
VITE_FIREBASE_APP_ID=seu-app-id
```

### Desenvolvimento Local

**Opção 1: Live Server (Recomendado)**
```bash
# Terminal 1: Live Server
npx live-server

# Acessa em http://localhost:8080
```

**Opção 2: Python SimpleHTTPServer**
```bash
python3 -m http.server 8000
# Acessa em http://localhost:8000
```

### Testar Aplicações Localmente

| App | URL Local |
|---|---|
| Cliente | `http://localhost:8080/` |
| Chamada | `http://localhost:8080/chamada/` |
| Gerencial | `http://localhost:8080/gerencial/` |

---

## 🔧 Stack Técnico

```
Frontend:
├── HTML5 (Vanilla, sem frameworks)
├── CSS3 (Custom properties, Grid, Flexbox)
├── JavaScript (ES6+, módulos)
└── Firebase SDK v9+

Backend:
├── Firebase Authentication
├── Firestore Database
├── Cloud Storage
└── Cloud Messaging

PWA:
├── Service Worker (Cache-first strategy)
├── Web App Manifest
├── App Icons (192px, 512px, maskable)
└── Offline-first architecture
```

---

## 📁 Estrutura de Arquivos

```
/
├── index.html              # Cliente principal
├── sw.js                   # Service Worker
├── manifest.json           # PWA Manifest
├── vercel.json             # Config deploy Vercel
│
├── chamada/
│   ├── index.html         # Display cozinha
│   ├── sw.js              # Service Worker da chamada
│   └── manifest.json      # Manifest da chamada
│
├── gerencial/
│   ├── index.html         # Painel admin
│   ├── sw.js              # Service Worker gerencial
│   ├── manifest.json      # Manifest gerencial
│   └── mascot.jpg         # Mascote
│
├── css/
│   ├── colors.css         # Paleta de cores centralizada
│   ├── base.css           # Resets e estilos base
│   └── components.css     # Componentes reutilizáveis
│
├── js/
│   ├── firebase.js        # Inicialização Firebase
│   ├── cart.js            # Lógica do carrinho
│   ├── orders.js          # Gerenciamento de pedidos
│   ├── validation.js      # Validação de entrada
│   ├── errorHandler.js    # Tratamento de erros
│   └── ui.js              # Eventos de UI
│
├── icon-192.png           # Ícone PWA
├── icon-512.png           # Ícone PWA
├── apple-touch-icon.png   # iOS
└── mascot.jpg             # Logo/mascote
```

---

## 🎨 Design System

### Paleta de Cores

```css
--pitch:       #120e0b  /* Fundo escuro */
--char:        #1c1613  /* Destaque escuro */
--cream:       #f2e9da  /* Texto principal */
--ember:       #e5762e  /* Primária (botões) */
--ember-deep:  #c1521c  /* Hover escuro */
--tomato:      #b6382c  /* Alerta/erro */
--mustard:     #f0b429  /* Destaque quente */
--green:       #4caf6d  /* Sucesso */
--line:        rgba(242,233,218,0.14)  /* Bordas */
```

### Tipografia

```css
Display:  'Anton', sans-serif       /* Títulos */
Body:     'DM Sans', sans-serif     /* Corpo */
Script:   'Caveat', cursive         /* Acento */
```

---

## 🔐 Autenticação Firebase

### Cliente
- ✅ Acesso anônimo (não requer login)
- ✅ Persiste `visitaId` em localStorage
- ✅ Rastreia abandonos de carrinho

### Gerencial
- 🔒 Requer autenticação (email/senha)
- 🔒 Regras Firestore limitam acesso
- 🔒 Log de ações administrativas

---

## 🌐 Firestore Schema

### Collection: `visitas`
```js
{
  id: "abc123",
  entrada: "2026-09-17T20:30:45.000Z",
  ultimaAtividade: "2026-09-17T20:31:00.000Z",
  aparelho: "iPhone/iPad | Android | Computador",
  origem: "google.com | direto",
  telefoneDigitado: "11999999999",
  finalizou: true,
  codigoPedido: "ABC123",
  valorCarrinho: 120.50,
  itensCarrinho: [...] // array de items
}
```

### Collection: `pedidos`
```js
{
  id: "ABC123",
  createdAt: "2026-09-17T20:31:15.000Z",
  telefone: "11999999999",
  nome: "João Silva",
  items: [
    { id: "burger1", nome: "X-Burger", qty: 2, price: 30 }
  ],
  total: 60.00,
  status: "preparando", // preparando | pronto | entregue
  chamado: false,
  chamadoEm: null
}
```

---

## 📡 Real-time Features

### Pedidos em Tempo Real
- Cliente vê `status` atualizar ao vivo
- Gerencial vê pedidos novos instantaneamente
- Cozinha recebe alerta de novo pedido (som + visual)

### Visitas em Tempo Real
- Rastreio de clientes navegando
- Identificação de abandonos
- Cálculo automático de taxa de conversão

---

## 🧪 Testes

### Testar Offline
1. Abra DevTools (F12)
2. Aba **Network**
3. Marque **Offline**
4. Navegue pelo site — funciona com cache do Service Worker

### Testar Notificações
```js
// Console do gerencial
db.collection('pedidos').add({
  telefone: '11999999999',
  nome: 'Teste',
  items: [{id: 'x1', nome: 'X-Burger', qty: 1, price: 30}],
  total: 30,
  createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  status: 'preparando'
})
```

### Testar PWA (Instalar App)
1. **Mobile:** Abra no Chrome → "Adicionar à tela inicial"
2. **Desktop:** URL bar → Ícone de instalação → "Instalar"
3. App funciona offline, com ícone próprio

---

## 🚀 Deploy

### Vercel (Recomendado)

```bash
# 1. Instalar CLI
npm install -g vercel

# 2. Deploy
vercel

# 3. Configurar variáveis de ambiente
# Dashboard → Settings → Environment Variables
# Adicionar as variáveis do .env.local
```

**Nota:** `vercel.json` já está configurado com rewrites para SPA.

### Deployment Automático
- Qualquer push para `main` dispara deploy automático
- GitHub integrado com Vercel
- URL: https://seu-projeto.vercel.app

---

## 🐛 Debugging

### Verificar Erros
- Gerencial → Aba 🐞 **Erros**
- Mostra stack trace completo
- Timestamp e source

### Verificar Visitas
- Gerencial → Aba ❤️ **Clientes** → **Visitas ao site**
- Status em tempo real
- Rastreio de navegação

### Verificar Pedidos
- Gerencial → Aba 📦 **Gestão** → **Pedidos**
- Todos os pedidos com status
- Histórico de alterações

---

## 📋 Checklist de Features

### Cliente
- [x] Cardápio dinâmico
- [x] Carrinho com persistência
- [x] Checkout (nome, telefone, endereço)
- [x] Acompanhamento de pedido
- [x] Notificações (som + visual)
- [x] PWA (instalar como app)
- [x] Offline (com Service Worker)
- [x] Histórico de pedidos

### Chamada
- [x] Display de pedidos
- [x] Números gigantes
- [x] Som de alerta
- [x] Status em tempo real
- [x] Marcar como pronto

### Gerencial
- [x] Dashboard de vendas
- [x] Análise de clientes
- [x] Gestão de pedidos
- [x] Relatórios diários
- [x] Sistema de mensagens
- [x] Backup/Export
- [x] Registro de erros

---

## 🤝 Contribuição

1. Crie uma branch: `git checkout -b feature/sua-feature`
2. Commit: `git commit -m "feat: descrição"`
3. Push: `git push origin feature/sua-feature`
4. Pull Request no GitHub

---

## 📞 Suporte

- **Issues:** GitHub Issues
- **Docs:** Consultar comentários no código
- **Firebase:** https://firebase.google.com/docs

---

**Última atualização:** 2026-09-17  
**Versão:** 1.0.0  
**Licença:** MIT
