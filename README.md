# O Markin Chef's Burguer

Sistema da hamburgueria: site de pedidos para o cliente, painel de gestão e
painel de chamada para a TV. Tudo é HTML estático + Firebase — **não há build,
não há dependências para instalar**. Editar o arquivo e publicar já é o deploy.

## Estrutura

| Caminho | O que é | Quem usa |
|---|---|---|
| `index.html` | Site do cliente: cardápio, carrinho, acompanhamento do pedido | Público |
| `gerencial/` | Painel de gestão: pedidos, cardápio, caixa, financeiro, estoque, equipe | Equipe (login) |
| `chamada/` | Painel de senha para a TV da loja | Interno (TV) |
| `sw.js` / `gerencial/sw.js` | Service workers (cache offline de cada app) | — |
| `manifest.json` / `gerencial/manifest.json` | Web App Manifest (instalação como app) | — |
| `vercel.json` | Cabeçalhos de cache do deploy | — |
| `FIRESTORE-REGRAS.txt` | **Regras de segurança do Firestore** (fonte da verdade) | — |
| `LEIA-PRIMEIRO-SEGURANCA.txt` | Passo a passo de configuração inicial do Firebase | — |

Os ícones e o `mascot.jpg` ficam **só na raiz**. O `gerencial/` e o `chamada/`
apontam para eles com caminho absoluto (`/mascot.jpg`) — não duplique os arquivos.

## Deploy

O repositório está conectado à Vercel. **Todo push na `main` publica sozinho**
em ~1 minuto, em https://omarkin-site-vercel.vercel.app

```bash
git add -A && git commit -m "descrição da mudança" && git push
```

## Ao mexer no service worker

Sempre que alterar `sw.js` ou `gerencial/sw.js`, **suba o número da versão do
cache** na primeira linha (`omarkin-cliente-v45` → `v46`). É isso que faz o
navegador dos clientes buscar a versão nova e limpar a antiga. Sem isso, quem
já usou o app continua vendo a versão velha.

Se algo estranho acontecer só para alguns usuários depois de um deploy, o
roteiro é: DevTools → Application → Service Workers (tem worker "waiting"?) →
Cache Storage (sobrou cache de versão antiga?).

## Regras do Firestore

O arquivo `FIRESTORE-REGRAS.txt` é a fonte da verdade, mas **editá-lo não muda
nada sozinho**. Depois de alterar, publique no console do Firebase:
Firestore Database → aba Regras → colar → Publicar.

As permissões são por área (`cardapio`, `caixa`, `financeiro`, `estoque`…) e
ficam no documento do usuário em `users/{uid}`.

## Firebase

Projeto: `omarkin-burguer-39bda`. A `apiKey` no código é pública por design no
Firebase Web — quem protege os dados são as regras do Firestore, não a chave.
