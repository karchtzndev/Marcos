# 🚀 Deployment — O Markin

Guia passo-a-passo para fazer deploy da aplicação.

## 📋 Pré-requisitos

- Conta GitHub (com acesso ao repositório)
- Conta Vercel (gratuita)
- Conta Firebase (com Firestore habilitado)
- Node.js 16+ instalado

## 🔧 Configuração Inicial

### 1. Firebase Setup

1. Ir para [console.firebase.google.com](https://console.firebase.google.com)
2. Criar novo projeto (ou usar existente)
3. Ativar **Firestore Database**
4. Ativar **Authentication** (Email/Senha)
5. Em Project Settings, copiar config:

```js
const config = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  // ... etc
};
```

6. Colar no bloco `firebaseConfig`, que fica dentro de cada HTML:
   `index.html`, `gerencial/index.html` e `chamada/index.html`

### 2. Expiração automática de dados (TTL)

Sem isso as coleções de registro crescem para sempre e a fatura do Firebase
sobe todo mês por causa de dado que ninguém consulta. O app já grava o campo
`expiraEm` — falta ligar a política que apaga por ele.

No Firebase Console → Firestore → **Time-to-live**, criar uma política para
cada coleção, todas no campo `expiraEm`:

| Coleção | Prazo | Por quê |
|---|---|---|
| `visitas` | 90 dias | análise de funil olha semanas, não meses |
| `errorLog` | 30 dias | erro antigo não ajuda a depurar nada |
| `acessos` | 180 dias | histórico de ponto além disso não é consultado |

⚠️ **A política só apaga documentos que têm o campo.** O que foi gravado
antes dessa mudança não tem `expiraEm` e vai ficar lá para sempre. Para
limpar o acumulado, uma vez só, no Console → Firestore: filtrar por data
antiga e apagar em lote.

### 3. Regras de Segurança Firestore

No Firebase Console → Firestore → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Visitas: público (leitura), apenas app (escrita)
    match /visitas/{document=**} {
      allow read: if true;
      allow create: if request.auth.uid != null || 
                       request.auth.uid == null; // Públic write com origem verificada
      allow update, delete: if false;
    }
    
    // Pedidos: público leitura (meu ID), apenas gerencial escrita
    match /pedidos/{document=**} {
      allow read: if resource.data.visitaId == request.auth.uid || 
                     request.auth.token.admin == true;
      allow write: if request.auth.token.admin == true;
    }
    
    // Gerencial: apenas admin
    match /gerencial/{document=**} {
      allow read, write: if request.auth.token.admin == true;
    }
    
    // ErrorLog: apenas app e admin
    match /errorLog/{document=**} {
      allow create: if true;
      allow read: if request.auth.token.admin == true;
    }
  }
}
```

### 4. Criar Admin User

No Firebase Console → Authentication:
1. Adicionar usuário (email@exemplo.com)
2. Em Firestore, criar documento:

```
/users/{uid}
{
  email: "email@exemplo.com",
  role: "admin",
  createdAt: timestamp
}
```

3. Em Firebase CLI, definir claim customizado:

```bash
firebase auth:import users.json --hash-algo=bcrypt
```

## 📦 Deploy no Vercel

### Opção 1: Via GitHub (Recomendado)

1. **Verificar arquivo `vercel.json`:**
```json
{
  "buildCommand": "",
  "outputDirectory": ".",
  "public": true,
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

2. **Ir para [vercel.com](https://vercel.com)**
3. **Conectar GitHub** (se não estiver)
4. **Importar projeto** `karchtzndev/Marcos`
5. **Configurar Environment Variables:**

   ```
   VITE_FIREBASE_API_KEY=sua-key
   VITE_FIREBASE_PROJECT_ID=seu-project-id
   VITE_FIREBASE_AUTH_DOMAIN=seu-auth-domain
   ... (copiar do js/firebase.js)
   ```

6. **Deploy** → Vercel faz automaticamente

### Opção 2: Vercel CLI

```bash
# 1. Instalar CLI
npm install -g vercel

# 2. Fazer deploy
vercel

# 3. Seguir prompts (selecionar projeto, branch, etc)
```

## 🔄 Deployment Automático

Uma vez conectado GitHub + Vercel:

1. Qualquer push para `main` → Deploy automático
2. Qualquer PR → Deploy de preview
3. Merges → Deploy de produção

**Status:**
- Dashboard Vercel mostra status de cada deploy
- GitHub mostra badge ✅ quando pronto

## 📝 Deploy Checklist

Antes de fazer deploy:

- [ ] **Testes locais OK**
  ```bash
  npm run dev
  # ou live-server
  ```

- [ ] **Sem erros no console** (F12)

- [ ] **Firebase config atualizado** em `js/firebase.js`

- [ ] **Regras Firestore ativas** e testadas

- [ ] **Variáveis de ambiente** no Vercel

- [ ] **Lighthouse score > 90**
  ```bash
  # Chrome DevTools → Lighthouse
  ```

- [ ] **Testar em celular** (responsividade)

- [ ] **Testar offline** (Service Worker)

- [ ] **Mensagem de commit clara:**
  ```bash
  git commit -m "release: v1.0.0 - Markin PWA production ready"
  ```

## 🔍 Verificar Deploy

Após deploy estar online:

1. **Ir para URL de produção**
2. **Verificar cada app:**
   - `/` — Cliente
   - `/chamada/` — Cozinha
   - `/gerencial/` — Admin

3. **Testar funcionalidades:**
   - Fazer pedido no cliente
   - Ver em tempo real na chamada
   - Ver dados no gerencial

4. **Verificar Firebase:**
   - Dados salvando em Firestore
   - Erros aparecendo em errorLog

## 🆘 Rollback

Se algo der errado:

1. **Vercel:**
   - Dashboard → Project → Deployments
   - Clicar no deployment anterior
   - Botão "Promote to Production"

2. **Git:**
   ```bash
   git revert <commit-ruim>
   git push origin main
   # Vercel faz redeploy automaticamente
   ```

### Ponto de restauração — antes das otimizações de 23/09/2026

Branch `backup-antes-otimizacoes` (commit `0a31722`) guarda o site como
estava antes daquele conjunto de mudanças. Nada é apagado por ter feito o
backup: o branch fica parado ali para sempre.

**Desfazer só uma das mudanças** (preferir isto — é cirúrgico):

| Commit | O que desfaz |
|---|---|
| `330b0c4` | arrayUnion no caixa/estoque/custos fixos |
| `02638f6` | campo `expiraEm` nos registros |
| `811dfe5` | limite de 500 clientes no painel |
| `adb1d59` | remoção dos módulos de performance |
| `2b537b2` | imagens otimizadas e WebP |

```bash
git revert 330b0c4        # troque pelo commit que quer desfazer
git push origin main
```

**Desfazer tudo de uma vez:**

```bash
git revert --no-commit backup-antes-otimizacoes..main
git commit -m "Volta ao estado anterior às otimizações"
git push origin main
```

`git revert` cria um commit novo que desfaz — o histórico continua
inteiro e dá para voltar atrás de novo. Não use `reset --hard` em `main`:
aí sim o trabalho some.

> Para uma emergência em que nem o GitHub esteja acessível, existe também
> um .zip do site nesse mesmo estado, enviado no chat da sessão.

## 📊 Monitoramento

### Firebase Console
- Firestore → Data
- Authentication → Users
- Realtime Database → Rules

### Vercel Dashboard
- Deployments status
- Build logs
- Analytics (se ativado)

### Application
- Console de erros do navegador
- Gerencial → Aba 🐞 Erros
- Gerencial → Aba ❤️ Clientes

## 🔐 Segurança

- [ ] Não commitar `.env` ou `firebaseConfig` com credenciais reais
- [ ] Usar variáveis de ambiente no Vercel
- [ ] Revisar regras Firestore regularmente
- [ ] Ativar 2FA no Firebase
- [ ] Fazer backup regular dos dados

## 📞 Troubleshooting

### "CORS Error"
```
→ Verificar regras CORS no Vercel
→ Firestore pode estar bloqueando origem
→ Adicionar origem em Firebase Security
```

### "Service Worker não funciona"
```
→ Deve ser HTTPS (Vercel é automático)
→ Verificar DevTools → Application → Service Workers
→ Limpar cache: Settings → Clear Storage
```

### "Firestore não conecta"
```
→ Verificar config em js/firebase.js
→ Verificar Firebase está inicializado
→ Verificar regras de segurança
→ Verificar console browser por erros
```

### "Deploy travado"
```
→ Vercel Dashboard → Rebuild
→ Ou fazer novo push: git commit --allow-empty -m "rebuild"
→ Ou: vercel --prod --force
```

---

**Próximas etapas:**
1. ✅ Deploy produção
2. ✅ Configurar domínio customizado
3. ✅ Ativar analytics
4. ✅ Configurar email notifications

Sucesso! 🚀
