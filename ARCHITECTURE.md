# 🏗️ Arquitetura — O Markin PWA

Documentação da arquitetura técnica do sistema.

## 🎯 Visão Geral

```
┌─────────────────────────────────────────────────────────┐
│                    O MARKIN PWA                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   CLIENTE    │  │   CHAMADA    │  │  GERENCIAL   │  │
│  │  /index.html │  │ /chamada/    │  │ /gerencial/  │  │
│  │              │  │              │  │              │  │
│  │  SPA Vanilla │  │  Display TV  │  │  Admin Panel │  │
│  │  + PWA       │  │  + Audio     │  │  + Analytics │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│         │                 │                 │           │
│         └─────────────────┼─────────────────┘           │
│                           │                             │
│                    ┌──────▼──────┐                      │
│                    │  SERVICE    │                      │
│                    │  WORKER     │                      │
│                    │  (Cache)    │                      │
│                    └──────┬──────┘                      │
│                           │                             │
│         ┌─────────────────┼─────────────────┐           │
│         │                 │                 │           │
│    ┌────▼────┐       ┌────▼────┐       ┌───▼────┐      │
│    │ Storage │       │Firestore│       │  Auth  │      │
│    │ (Cache) │       │ (Data)  │       │        │      │
│    └─────────┘       └─────────┘       └────────┘      │
│                                                         │
│                      FIREBASE                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## 📱 Aplicações

### 1. Cliente (`/`)

**Responsabilidade:** Interface pública para clientes finais

**Fluxo:**
```
Visitante
    │
    ├→ Anônimo (visitaId em localStorage)
    │
    ├→ Ver Cardápio
    │   └→ Firestore: /cardapio
    │
    ├→ Montar Carrinho (localStorage)
    │
    ├→ Checkout
    │   ├→ Validar telefone, nome
    │   ├→ Salvar em /visitas
    │   └→ Redirecionar para WhatsApp ou confirmação
    │
    ├→ Rastrear Pedido
    │   ├→ Buscar por telefone
    │   ├→ Ver status em real-time
    │   └→ Notificação quando pronto
    │
    └→ Offline
        └→ Usar cache do Service Worker
```

**Dados Críticos:**
- `visitas` — Rastreamento de cada visitante
- `pedidos` — Histórico de pedidos do cliente
- `cardapio` — Menu (se dinâmico)

### 2. Chamada (`/chamada/`)

**Responsabilidade:** Display para cozinha (TV/Monitor)

**Fluxo:**
```
Pedido criado em /pedidos
    │
    ├→ Real-time listener em ativação
    │
    ├→ Toca som 🔔
    │
    ├→ Exibe número gigante
    │
    ├→ Mostra nome cliente
    │
    ├→ Tipo: Delivery/Retirada/Mesa
    │
    └→ Cozinha marca como "Pronto"
        └→ Número sai da tela
```

**Dados:**
- `pedidos` onde `status == "preparando"`
- Real-time: `onSnapshot` para atualizar UI

### 3. Gerencial (`/gerencial/`)

**Responsabilidade:** Painel administrativo completo

**Abas Principais:**

1. **Dashboard 📊**
   - KPIs do dia (vendas, pedidos, ticket médio)
   - Gráficos de vendas
   - Clientes novos

2. **Gestão 📦**
   - Lista de pedidos
   - Filtrar por status
   - Marcar como pronto/entregue

3. **Clientes ❤️**
   - Visitas ao site
   - Taxa de conversão
   - Abandonos de carrinho
   - Histórico de compras

4. **Mensagens 💬**
   - Comunicação com clientes
   - Template de mensagens

5. **Relatórios 📈**
   - Vendas por período
   - Clientes mais ativos
   - Horários de pico

6. **Ajustes ⚙️**
   - Configurações do app
   - Dados da loja
   - Backup/Export

7. **Erros 🐞**
   - Log de erros do sistema
   - Stack traces
   - Timestamp e origem

---

## 🔌 Firestore Schema

### Collections

#### `visitas`
Rastreamento de cada visitante do site.

```firestore
/visitas/{visitaId}
├── entrada: timestamp          # Quando entrou no site
├── ultimaAtividade: timestamp  # Última página visitada
├── aparelho: string            # iPhone/iPad, Android, Computador
├── origem: string              # google.com, direto, facebook...
├── telefoneDigitado: string    # Se digitou no carrinho
├── finalizou: boolean          # Fez pedido?
├── codigoPedido: string        # Referência ao pedido
├── valorCarrinho: number       # Total do carrinho
└── itensCarrinho: array        # Items [{ id, nome, qty, price }]
```

#### `pedidos`
Histórico completo de pedidos.

```firestore
/pedidos/{codigoPedido}
├── createdAt: timestamp
├── telefone: string
├── nome: string
├── email: string (opcional)
├── endereco: string
├── items: array [
│   ├── id: string
│   ├── nome: string
│   ├── quantidade: number
│   └── preco: number
│ ]
├── total: number
├── desconto: number (opcional)
├── frete: number
├── metodoPagamento: string     # dinheiro, cartao, pix
├── status: string              # novo, preparando, pronto, entregue
├── chamado: boolean            # Número foi chamado?
├── chamadoEm: timestamp
├── pago: boolean
├── paidAt: timestamp
├── observacoes: string
└── visitaId: string            # Referência à visita
```

#### `errorLog`
Log centralizado de erros.

```firestore
/errorLog/{errorId}
├── timestamp: timestamp
├── message: string
├── stack: string
├── source: string              # Qual parte do app
├── url: string                 # Página onde ocorreu
├── userAgent: string           # Navegador/Device
└── context: object             # Dados customizados
```

#### `settings` (Configurações da Loja)
```firestore
/settings/loja
├── nome: string
├── telefone: string
├── endereco: string
├── horarioAbertura: string
├── horarioFechamento: string
├── tempoPreparoMin: number
├── freteEnable: boolean
├── freteValue: number
├── taxasCard: number (%)
└── logo: string (URL)
```

---

## 🔐 Autenticação e Autorização

### Cliente
- ✅ **Sem autenticação** (anônimo)
- ✅ Identificado por `visitaId` (UUID)
- ✅ localStorage para persistência
- ✅ Sem acesso a dados de outros clientes

### Gerencial
- 🔒 **Requer email/senha** via Firebase Auth
- 🔒 **Custom claims**: `admin: true`
- 🔒 Regras Firestore limitam leitura/escrita
- 🔒 Tudo é auditável

---

## 📡 Real-time Features

### Listeners Ativos

**Cliente:**
```js
// Ouve seus próprios pedidos
db.collection('pedidos')
  .where('telefone', '==', seuTelefone)
  .onSnapshot(snap => {
    // Atualiza status em tempo real
    // Toca som quando pronto
  });
```

**Chamada:**
```js
// Ouve todos os pedidos "preparando"
db.collection('pedidos')
  .where('status', '==', 'preparando')
  .onSnapshot(snap => {
    // Atualiza display
    // Toca som de novo pedido
  });
```

**Gerencial:**
```js
// Múltiplos listeners
db.collection('pedidos').onSnapshot(...);
db.collection('visitas').onSnapshot(...);
db.collection('errorLog').onSnapshot(...);
```

---

## 💾 Estratégia de Cache (Service Worker)

### Cache-First Strategy
```
Requisição
  │
  ├→ Cache tem?
  │   └→ Sim: Retorna cache
  │   └→ Não: Vai para rede
  │
  ├→ Rede responde?
  │   └→ Sim: Atualiza cache, retorna
  │   └→ Não: Retorna cache antigo ou erro
  │
  └→ Offline?
      └→ Só cache funciona
```

### Assets em Cache
```js
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/mascot.jpg'
];
```

---

## 🔄 Fluxo de Dados

### Um Novo Pedido

```
1. CLIENTE
   └─→ Cliente monta carrinho (localStorage)
   └─→ Clica "Finalizar"
   └─→ Valida dados (Validation.js)
   └─→ Envia para Firebase
   
2. FIRESTORE
   └─→ Documento criado em /pedidos
   └─→ Trigger automático envia notificação
   
3. CHAMADA
   └─→ Listener recebe novo pedido
   └─→ Toca som 🔔
   └─→ Mostra número gigante
   
4. GERENCIAL
   └─→ Dashboard atualiza KPIs
   └─→ Aba Gestão mostra novo pedido
   
5. CLIENTE (Notificação)
   └─→ Push notification (se habilitado)
   └─→ Página atualiza status
```

---

## ⚠️ Tratamento de Erros

### Error Flow
```
Erro ocorre
  │
  ├→ Try/Catch captura
  │
  ├→ ErrorHandler.log()
  │   └→ Salva em Firebase errorLog
  │
  ├→ ErrorHandler.showNotification()
  │   └→ Mostra toast ao usuário
  │
  └→ Gerencial pode ver em 🐞 Erros
```

### Tipos de Erro
1. **Network** → Retry automático
2. **Validation** → Mostrar mensagem clara
3. **Firebase** → Log + notificação
4. **Business Logic** → Log + feedback

---

## 🚀 Performance

### Otimizações Implementadas

✅ **Code Splitting**
- Módulos separados (validation, errorHandler, etc)

✅ **Lazy Loading**
- Assets carregam sob demanda

✅ **Minificação**
- CSS/JS minificados em produção

✅ **Service Worker**
- Cache de assets
- Offline functionality

✅ **Firebase**
- Firestore indexes (índices de query)
- Limitar documents fetched
- Real-time listeners eficientes

---

## 📊 Monitoramento

### KPIs Rastreados
- Visitas diárias
- Taxa de conversão
- Ticket médio
- Tempo de preparo
- Clientes novos
- Abandonos de carrinho

### Alertas
- Muitos erros em errorLog
- Visitantes sem conversão
- Pedidos travados

---

## 🔮 Melhorias Futuras

- [ ] Autoscaling de preparação
- [ ] AI para previsão de demanda
- [ ] Loyalty program
- [ ] Marketplace de franquias
- [ ] App nativa (React Native)
- [ ] Geolocation para delivery

---

**Mantém-se atualizado!** Última revisão: 2026-09-17
