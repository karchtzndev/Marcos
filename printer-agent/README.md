# Agente de impressão — O Markin

Programa que fica rodando no computador do balcão (ligado na impressora
térmica por cabo USB) e imprime as comandas sozinho, sem ninguém precisar
clicar em nada. Ele lê a fila que o painel gerencial já cria — o navegador
nunca imprime direto, só avisa "tem uma comanda pra sair" e este programa
faz a impressão de verdade.

Precisa de um computador Windows ligado o tempo todo (o mesmo que já fica no
caixa serve). Não precisa ser potente — é um programinha bem leve.

## Passo a passo pra deixar funcionando

### 1. Instalar o Node.js (só na primeira vez)

Baixe e instale em https://nodejs.org (escolha a versão "LTS"). Depois de
instalar, feche e abra o terminal de novo.

### 2. Compartilhar a impressora no Windows

1. Painel de Controle → Dispositivos e Impressoras
2. Botão direito na impressora térmica → Propriedades da impressora
3. Aba "Compartilhamento" → marque "Compartilhar esta impressora"
4. Dê um nome simples, sem espaço nem acento — por exemplo `ImpressoraCozinha`
5. Anote esse nome, você vai usar no passo 5

### 3. Gerar a chave de serviço do Firebase

1. Abra https://console.firebase.google.com e entre no projeto
   `omarkin-burguer-39bda`
2. Ícone de engrenagem (canto superior esquerdo) → "Configurações do projeto"
3. Aba "Contas de serviço"
4. Botão "Gerar nova chave privada" → confirma → baixa um arquivo `.json`
5. Renomeie esse arquivo pra `service-account.json` e coloque dentro desta
   pasta (`printer-agent/`)

⚠️ Esse arquivo dá acesso total ao banco de dados do sistema. Nunca mande
ele por WhatsApp/e-mail, nunca suba pro GitHub (ele já fica de fora do
repositório de propósito).

### 4. Instalar as dependências

Nesta pasta (`printer-agent/`), abra um terminal e rode:

```bash
npm install
```

### 5. Configurar

Copie o arquivo `config.example.json` e renomeie a cópia pra `config.json`.
Abra e preencha:

- `printerShareName`: o nome que você deu no passo 2 (ex: `ImpressoraCozinha`)
- `serviceAccountPath`: pode deixar `./service-account.json` se seguiu o
  passo 3 certinho

### 6. Rodar

```bash
node agent.js
```

Deve aparecer `Agente de impressão iniciado`. Deixe essa janela aberta — se
fechar, a impressão automática para. No painel gerencial, na aba **Módulos**,
o status "Computador conectado 🟢" deve aparecer em alguns segundos.

### 7. Deixar rodando sempre (recomendado)

Pra não depender de alguém lembrar de abrir o programa toda manhã:

1. Tecla Windows → digite `shell:startup` → Enter (abre a pasta Inicializar)
2. Crie um atalho nessa pasta apontando pra um arquivo `.bat` com este
   conteúdo (ajuste o caminho da pasta):

```bat
@echo off
cd /d "C:\caminho\para\printer-agent"
node agent.js
```

Assim, toda vez que o computador ligar, o agente inicia sozinho.

## Ligando a impressão automática no painel

Depois do agente rodando e mostrando 🟢 conectado:

1. Painel gerencial → aba **Módulos**
2. Ligue **"Fila de impressão (PC + USB)"**
3. Ligue **"Imprimir comanda ao aceitar"** se quiser que a comanda saia
   sozinha assim que você aceitar o pedido (sem esse módulo, ainda dá pra
   imprimir manualmente clicando no botão de imprimir de cada pedido)

## Se der problema

- **"Não encontrei o config.json"** — copie `config.example.json` pra
  `config.json` (passo 5).
- **"Não encontrei a chave de serviço"** — confira se o arquivo
  `service-account.json` está mesmo dentro desta pasta.
- **Painel mostra 🟡 ou 🔴 mesmo com o agente rodando** — confira se este
  terminal ainda está aberto e sem erros na tela.
- **Agente roda mas nada sai da impressora** — confira se o nome em
  `printerShareName` é EXATAMENTE o nome do compartilhamento (passo 2), não
  o nome/modelo da impressora. Teste abrir `\\localhost\NomeQueVoceUsou` no
  Explorador de Arquivos do Windows — se der erro, o compartilhamento não
  está certo.
