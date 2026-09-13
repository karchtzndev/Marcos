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

`firestore.rules` é o arquivo que vai pro ar. O `FIRESTORE-REGRAS.txt` é a
mesma coisa com os comentários explicando cada decisão — quando mudar um,
mude o outro.

Publicar (só na primeira vez é preciso fazer login):

```bash
firebase login
```

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

O Firebase valida a sintaxe no servidor: se houver erro, o deploy falha e as
regras atuais continuam intactas. Alternativa manual: Console do Firebase →
Firestore Database → aba Regras → colar o conteúdo → Publicar.

As permissões são por área (`cardapio`, `caixa`, `financeiro`, `estoque`…) e
ficam no documento do usuário em `users/{uid}`.

### Histórico de pedidos do cliente

Listar pedidos é permitido só para a equipe **ou** para o dono da conta
(`clienteUid == auth.uid`). Por isso o pedido guarda `clienteUid` quando há
login. Quem pede sem conta tem o histórico montado a partir dos códigos
salvos no próprio aparelho (`omarkin_pedidos` no localStorage), buscados um a
um — listar por telefone seria inseguro, já que telefone é adivinhável.

## Firebase

Projeto: `omarkin-burguer-39bda`. A `apiKey` no código é pública por design no
Firebase Web — quem protege os dados são as regras do Firestore, não a chave.
