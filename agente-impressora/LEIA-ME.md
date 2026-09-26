# Agente de impressão — O Markin

Programa que fica rodando no computador da loja e faz os cupons saírem sozinhos.

**Como funciona:** quando alguém manda imprimir no painel, o cupom vai para uma
fila na nuvem. Este agente escuta essa fila e entrega para a impressora. Se o PC
estiver desligado, os cupons esperam e saem quando ele ligar — nada se perde.

---

## Antes de começar

Você vai precisar de:

- O computador do caixa, com Windows
- A impressora **Bematech MP-4200 TH** ligada nele
- Uns 20 minutos, uma vez só

---

## 1. Instalar o driver da impressora

Baixe em **https://www.bematech.com.br/manuais-e-drivers/** e procure
**MP-4200 TH**. Escolha a versão certa (32 ou 64 bits) para o Windows do PC.

> Não baixe driver de outro lugar. É um programa que roda com acesso total ao
> computador — o único lugar confiável é o site do fabricante.

Depois de instalar, a impressora tem que aparecer em
**Configurações → Bluetooth e dispositivos → Impressoras e scanners**.

## 2. Compartilhar a impressora

Este passo não é opcional — é o que faz o cupom sair certo em vez de sair lixo.

1. **Impressoras e scanners** → clique na MP-4200
2. **Propriedades da impressora**
3. Aba **Compartilhamento**
4. Marque **Compartilhar esta impressora**
5. Nome do compartilhamento: `CUPOM`

⚠️ Exatamente `CUPOM`: maiúsculo, sem acento, sem espaço. O Windows diferencia.

<details>
<summary>Por que compartilhar?</summary>

O driver da Bematech é gráfico. Se o agente mandar os comandos da impressora
por ele do jeito comum, o Windows tenta **desenhar** os comandos em vez de
executá-los, e sai papel com símbolos estranhos. Escrever no compartilhamento
entrega os bytes crus, que é o que a impressora entende.
</details>

## 3. Instalar o Node

Baixe em **https://nodejs.org** — pegue a versão **LTS**. Instalação padrão,
pode ir clicando em avançar.

## 4. Criar a conta da impressora

No painel gerencial, aba **Ajustes → Acessos**, crie um funcionário:

- Nome: `Impressora`
- E-mail: `impressora@omarkin.com.br` *(ou outro que preferir)*
- Senha: uma senha forte
- Permissões: **nenhuma**

A conta só precisa existir e estar ativa. Sem permissão de caixa, de cliente,
de nada — se um dia esse PC for comprometido, o estrago para aí.

## 5. Configurar

Na pasta do agente, copie `config.exemplo.json` para `config.json` e preencha:

```json
{
  "impressora": "\\\\localhost\\CUPOM",
  "nome": "PC do caixa",
  "usuario": "impressora@omarkin.com.br",
  "senha": "a senha que você criou"
}
```

> O `config.json` guarda a senha, por isso ele fica fora do Git. Não mande esse
> arquivo por WhatsApp nem e-mail.

## 6. Testar a impressora

Abra o **Prompt de Comando** na pasta do agente e rode:

```
npm install
npm run testar
```

Deve sair um cupom de teste com uma régua. **Se a régua couber em uma linha só,
a largura está certa.** Se ela virar a linha, a impressora está configurada
para 58mm em vez de 80mm.

Esse teste não usa internet — serve justamente para separar problema de
impressora de problema de conexão.

## 7. Ligar o agente

```
npm start
```

Deve aparecer:

```
conectado como impressora@omarkin.com.br
imprimindo em \\localhost\CUPOM
aguardando cupons. Pode minimizar esta janela.
```

No painel gerencial, o aviso vermelho de "Computador desconectado" vira verde
em até 30 segundos.

## 8. Fazer iniciar sozinho com o Windows

Para não depender de alguém lembrar de abrir todo dia:

1. Tecla **Windows + R**
2. Digite `shell:startup` e Enter
3. Arraste o arquivo `iniciar.bat` para dentro dessa pasta *(segure Alt para
   criar atalho em vez de mover)*

---

## Quando der errado

**"Não saiu" no teste**
Impressora ligada e com papel? O nome do compartilhamento no `config.json` está
exatamente igual ao que você configurou?

**Sai papel com símbolos estranhos**
O compartilhamento não está sendo usado, e o driver está convertendo. Confira
que o `config.json` aponta para `\\localhost\CUPOM` e não para o nome da
impressora.

**A régua do teste vira a linha**
A impressora está em 58mm. Dá para mudar na configuração dela, ou me avise que
eu ajusto o sistema para 32 colunas.

**"não foi possível iniciar" ao rodar o agente**
E-mail ou senha errados no `config.json`, ou a conta não foi criada/ativada no
painel. O teste do passo 6 funciona mesmo assim — ele não usa login.

**O painel continua vermelho**
O agente precisa ficar aberto. Se a janela do Prompt fechou, ele parou. Veja o
passo 8.

**Cupom não saiu mas a janela está aberta**
Olhe a janela do agente: ele registra cada falha e o motivo. Cupom que falha
**não** é perdido — fica na fila e sai quando o problema for resolvido.
