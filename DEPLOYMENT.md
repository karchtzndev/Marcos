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

### 2. Expiração automática de dados (TTL) — NÃO DISPONÍVEL NO PLANO ATUAL

O projeto está no **Spark (gratuito)**, e a política de TTL exige **Blaze**.
Tentar criar pelo console devolve `has billing disabled` + 403. Não é
permissão de conta de serviço: é o plano.

**Isto não é um problema hoje, e não vale um upgrade.** No Spark não existe
fatura — o plano é gratuito com teto rígido. O TTL não economizaria nada; só
adiaria encostar no limite de 1 GiB de armazenamento, o que, no tamanho dos
documentos deste sistema, leva anos.

Trocar para Blaze significa cartão cadastrado e abrir mão desse teto. Se um
bug disparar escritas em loop, no Spark o app simplesmente para; no Blaze,
vira fatura. Para uma lanchonete, essa proteção vale mais do que o TTL.

O app **já grava o campo `expiraEm`** em `visitas` (90 dias), `errorLog`
(30 dias) e `acessos` (180 dias). Fica dormente: no dia em que houver Blaze,
ligar o TTL é só apontar cada coleção para esse campo, sem tocar em código.

Quando esse dia chegar — Google Cloud Console (não o do Firebase, que não
tem essa tela) → Firestore → Time to live:

| Grupo de coleção | Campo | Adiamento |
|---|---|---|
| `visitas` | `expiraEm` | 0 |
| `errorLog` | `expiraEm` | 0 |
| `acessos` | `expiraEm` | 0 |

O adiamento fica em **0** porque `expiraEm` já guarda a data final, não uma
duração — qualquer valor ali seria somado por cima.

⚠️ A política só apaga documentos que **têm** o campo. O que foi gravado
antes dessa mudança não tem `expiraEm` e ficaria de fora; esse acumulado
precisa de faxina manual.

> Isto tem que ser feito no console, na mão. Publicar regra e administrar
> índice/TTL são permissões diferentes: uma conta de serviço do Admin SDK
> publica regra mas recebe "caller does not have permission" no TTL. Quem
> for automatizar precisa do papel **Cloud Datastore Index Admin**.

### 2b. Índices compostos

Definidos em **`firestore.indexes.json`**. Hoje há um, e ele importa:

| Coleção | Campos | Para quê |
|---|---|---|
| `orders` | `phone` ASC, `createdAt` DESC | histórico do cliente ("meus pedidos" / repetir pedido) |

Filtrar por um campo e ordenar por outro exige índice composto. Sem ele o
Firestore recusa a consulta, o app cai num plano B sem ordenação — e como
sem `orderBy` o Firestore ordena por ID do documento (que aqui é aleatório,
`MK-ABC12`), o cliente via 10 pedidos quaisquer em vez dos 10 mais recentes.

Criar em Console → Firestore → **Índices** → Criar índice composto, com os
campos da tabela acima. Leva alguns minutos para ficar pronto.

`https://console.firebase.google.com/project/omarkin-burguer-39bda/firestore/databases/-default-/indexes`

### 3. Regras de Segurança Firestore

As regras valendo estão em **`firestore.rules`**, na raiz do repositório.

Antes ficavam só no console, e o que este arquivo mostrava era ficção:
descrevia coleções (`pedidos`, `gerencial`) que o sistema nunca usou. Foi
por isso que um campo novo derrubou gravação em produção sem ninguém notar
— não havia como revisar a regra junto com o código.

**Nunca edite a regra direto no console.** Altere `firestore.rules`, rode
os testes e só então publique — senão o repositório volta a divergir do que
está valendo, que é exatamente a origem do problema.

```bash
npm install          # só na primeira vez
npm test             # sobe o emulador e roda os testes das regras
```

Os testes ficam em `testes/regras.test.mjs` e cobrem duas coisas: as
gravações que o app precisa fazer, e as portas que precisam continuar
fechadas (estranho não lê cliente, funcionário não vira gerente, contador
de fidelidade não pula). Rodam local, contra o emulador — não encostam no
banco de produção.

Para publicar, com os testes passando: Console → Firestore → Rules, colar o
conteúdo de `firestore.rules` e publicar.

⚠️ **Atenção ao `hasOnly()`.** Várias regras usam essa função, que recusa
qualquer campo fora da lista. Se você acrescentar um campo no código sem
acrescentar na regra, a gravação passa a ser negada — e o app engole o erro
num `.catch()`, então nada aparece na tela. Campo novo no código significa
campo novo na regra, sempre.

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
