# 🤝 Guia de Contribuição — O Markin

Obrigado por contribuir com o Markin! Este documento explica como trabalhar no projeto.

## 📋 Antes de Começar

1. **Leia o README.md** para entender a arquitetura
2. **Verifique as issues abertas** para não duplicar trabalho
3. **Crie uma issue para features novas** antes de fazer código

## 🔄 Fluxo de Trabalho

### 1. Clonar e Setup
```bash
git clone https://github.com/karchtzndev/Marcos.git
cd Marcos
# Abrir no editor de código
```

### 2. Criar Branch
```bash
git checkout -b feature/descricao-concisa
# ou para bugfix:
git checkout -b fix/descricao-do-bug
```

**Convenção de nomes:**
- `feature/novo-recurso` — Nova funcionalidade
- `fix/corrigir-bug` — Bug fix
- `refactor/melhorar-codigo` — Refatoração
- `docs/atualizar-documentacao` — Documentação
- `perf/otimizar-performance` — Performance

### 3. Fazer Mudanças
- **Comitar frequentemente** com mensagens claras
- **Testar sempre** antes de fazer commit
- **Seguir o padrão de commits** (ver abaixo)

### 4. Commits

**Formato:**
```
tipo: descrição breve

Descrição detalhada (opcional):
- Ponto 1
- Ponto 2

Closes #123
```

**Tipos:**
- `feat:` Nova funcionalidade
- `fix:` Corrigir bug
- `docs:` Documentação
- `style:` Formatação (sem mudança de lógica)
- `refactor:` Refatoração de código
- `perf:` Melhoria de performance
- `test:` Testes
- `chore:` Manutenção

**Exemplos:**
```bash
git commit -m "feat: adicionar validação de CPF"
git commit -m "fix: corrigir timezone em visitas
- Converter UTC para data local
- Corrige contagem entre 21h-00h
Closes #42"
```

### 5. Push e Pull Request
```bash
git push origin feature/descricao-concisa
```

**No GitHub:**
1. Criar Pull Request
2. Preencher a descrição (template disponível)
3. Aguardar review
4. Fazer ajustes se necessário
5. Merge quando aprovado

**Descrição do PR:**
```markdown
## 📝 Descrição
Breve descrição do que foi mudado.

## 🎯 Tipo
- [ ] Feature
- [ ] Bug fix
- [ ] Breaking change
- [ ] Documentation

## ✅ Checklist
- [ ] Testei localmente
- [ ] Código segue o padrão
- [ ] Atualizei documentação
- [ ] Não há console.log() deixado
- [ ] Performance OK

## 🧪 Como Testar
Passos para reproduzir/testar a mudança.

## 📸 Screenshots (se aplicável)
Adicionar prints do antes/depois.
```

---

## 📐 Padrões de Código

### JavaScript

**Sempre use:**
- `const` por padrão
- `let` apenas se necessário reatribuição
- Arrow functions quando faz sentido
- Template literals para strings
- `async/await` em vez de `.then()`

**Evite:**
- `var`
- `console.log()` em código de produção
- Operações síncronas pesadas
- Callbacks aninhados (callback hell)

**Exemplo bom:**
```js
async function salvarPedido(pedido) {
  try {
    const docRef = await db.collection('pedidos').add(pedido);
    ErrorHandler.showNotification('Pedido salvo com sucesso', 'success');
    return docRef.id;
  } catch (error) {
    await ErrorHandler.log(error, { source: 'salvarPedido' });
  }
}
```

### CSS

**Estrutura:**
```css
/* Componente */
.meu-componente {
  /* Layout */
  display: flex;
  align-items: center;
  /* Espaçamento */
  padding: 16px;
  /* Estilo */
  background: var(--pitch);
  color: var(--cream);
  /* Animação */
  transition: all 0.2s ease;
}

.meu-componente:hover {
  background: var(--char);
}

/* Responsivo */
@media (max-width: 768px) {
  .meu-componente {
    padding: 12px;
  }
}
```

**Use:**
- CSS custom properties (`var(--cor)`)
- Flexbox/Grid (sem floats)
- BEM naming quando necessário
- Mobile-first approach

**Evite:**
- `!important`
- Inline styles
- IDs para estilos (use classes)
- Cores hardcoded (use variáveis)

### HTML

- Usar semântica: `<header>`, `<main>`, `<footer>`, `<section>`
- Acessibilidade: `alt` em imagens, `aria-*` quando necessário
- Data attributes: `data-value=""` para JS hooking
- Minificar em produção

---

## 🧪 Testes

### Testar Localmente

**1. Funcionalidade básica:**
- Abrir app no navegador
- Testar fluxo principal
- Verificar console por erros

**2. Offline:**
- DevTools → Network → Offline
- Testar navegação
- Verificar Service Worker

**3. Responsividade:**
- DevTools → Responsive design
- Testar em 375px, 768px, 1200px

**4. Performance:**
- DevTools → Lighthouse
- Score deve ser > 90
- Sem red flags de performance

---

## 🐛 Reportar Bugs

Criar issue com:

```markdown
## Descrição
Breve descrição do bug.

## Passos para Reproduzir
1. Fazer X
2. Fazer Y
3. Ver erro

## Comportamento Esperado
O que deveria acontecer.

## Comportamento Atual
O que está acontecendo.

## Screenshots
Prints do erro.

## Ambiente
- Navegador: Chrome 120
- Dispositivo: iPhone 14
- Horário: 21h30 (UTC-3)
```

---

## 💡 Sugestões de Features

1. **Abrir issue** com template `enhancement`
2. **Descrever o caso de uso** — por que é importante
3. **Propor solução** — como implementar
4. **Aguardar feedback** do maintainer

---

## 📚 Recursos

- **Firebase Docs:** https://firebase.google.com/docs
- **MDN:** https://developer.mozilla.org/pt-BR/
- **Web.dev:** https://web.dev/
- **Accessibility:** https://www.w3.org/WAI/ARIA/

---

## ✨ Boas Práticas

✅ **DO:**
- Comitar frequentemente
- Escrever mensagens claras
- Testar antes de push
- Pedir review cedo
- Ser aberto a feedback

❌ **DON'T:**
- Force push em branches compartilhadas
- Fazer commits gigantes
- Deixar console.log()
- Ignorar linter/testes
- Fazer múltiplos problemas em um PR

---

## 🙏 Obrigado!

Toda contribuição, grande ou pequena, ajuda a fazer o Markin melhor!

Se tiver dúvidas, abra uma issue ou entre em contato. 🚀
