# Markin PWA - Instruções para Claude Code

## 🍔 Projeto
Sistema PWA completo para lanchonete/burger com Firebase/Firestore.

**Três aplicações:**
- 🛍️ `index.html` - Site cliente (cardápio, pedidos)
- 🍳 `chamada/` - Display cozinha (acompanhamento em tempo real)
- 📊 `gerencial/` - Painel admin (gerenciamento, relatórios)

## 🔧 Stack
- **Frontend:** Vanilla JS, HTML5, CSS3
- **Backend:** Firebase/Firestore
- **PWA:** Service Worker, manifest.json
- **Deploy:** Vercel (vercel.json)

## 🚀 Autorização Git
Sou autorizado a fazer commit e push automaticamente sem precisar confirmar cada operação:
- ✅ Fazer commits em qualquer branch
- ✅ Fazer push para origin automaticamente
- ✅ Criar branches se necessário
- ✅ Rebase e merge quando apropriado

**Exceções:** Operações destrutivas (--force, reset --hard) ainda requerem confirmação.

## 📁 Estrutura
```
/
├── index.html          # Cliente (site principal)
├── chamada/            # Display da cozinha
├── gerencial/          # Painel administrativo
├── sw.js              # Service Worker
├── manifest.json      # PWA Manifest
├── vercel.json        # Config Vercel
├── icon-*.png         # Ícones PWA
├── apple-touch-icon.png
└── mascot.jpg         # Mascote/logo
```

## 🎯 Desenvolvimento
- **Desenvolvimento local:** Abrir arquivos diretamente no navegador ou via live server
- **Testes:** Chrome DevTools, testar offline com SW
- **Deploy:** Vercel (automático ou manual via CLI)

## 📝 Convenções
- Commits em português: `git commit -m "Descrição da mudança"`
- Messages incluem contexto: feature, fix, refactor, docs
- Atribuição automática: Co-Authored-By com Claude Haiku 4.5

---
**Última atualização:** 2026-09-17
**Sessão:** https://claude.ai/code/session_01YXeSPHtGKxyosXfWWYr8hh
