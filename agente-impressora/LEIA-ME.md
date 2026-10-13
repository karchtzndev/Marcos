# Agente de impressão — O Markin

Faz a comanda sair sozinha, de **qualquer aparelho** — iPhone, Android, tablet.

**Como funciona:** quem manda imprimir no painel só escreve numa fila na nuvem.
Quem imprime é este agente, rodando perto da impressora. Por isso não importa
o aparelho de quem está no balcão — e é por isso que iPhone funciona, coisa que
a impressão direta do Android (RawBT) nunca permitiu.

Se o agente estiver desligado, os cupons esperam na fila e saem quando ele
voltar. Nada se perde.

## Dois agentes ao mesmo tempo

Você pode rodar em **dois aparelhos** — por exemplo um Raspberry Pi e o PC do
caixa — um servindo de reserva do outro. Impressora térmica é peça que falha, e
ficar sem comanda no sábado é caro.

Antes de imprimir, o agente *reivindica* o cupom: os dois recebem o mesmo
pedido no mesmo instante, mas só um ganha a disputa. **O cupom nunca sai
dobrado.** Se quem ganhou morrer no meio, o cupom volta para a fila em até dois
minutos e o outro assume.

Para isso funcionar, cada agente precisa de um `nome` diferente no
`config.json`. O painel mostra os dois e avisa, em amarelo, se um ficar calado.

---

# Instalação no Raspberry Pi (recomendado)

É o caminho mais simples: **não existe driver para instalar.**

## 1. Preparar o Pi

Raspberry Pi OS Lite já basta. Instale o Node:

```
sudo apt update && sudo apt install -y nodejs npm
```

## 2. Dar permissão de impressora ao seu usuário

```
sudo usermod -aG lp $USER
```

Saia e entre de novo na sessão para o grupo valer. **Pular isto é a causa nº 1
de "permission denied"** depois.

## 3. Plugar a impressora e confirmar

```
lsusb && ls -l /dev/usb/
```

O `lsusb` mostra a Bematech. O `ls` deve mostrar `lp0`. Esse é o caminho que
vai no `config.json`:

```json
"impressora": "/dev/usb/lp0"
```

> **Não instale o CUPS.** Ele reintroduz a camada gráfica que faz o papel sair
> com lixo. Escrever direto no dispositivo é o caminho certo.

## 4. Criar a conta da impressora

No painel, **Ajustes → Acessos**, crie um funcionário:

- Nome: `Impressora`
- E-mail: `impressora@omarkin.com.br`
- Senha: uma senha forte
- Permissões: **nenhuma**

Sem acesso a caixa nem a cliente. Se o aparelho for comprometido, o estrago
para aí. A mesma conta serve para os dois agentes.

## 5. Configurar e testar

```
cp config.exemplo.json config.json
nano config.json          # preencha nome, impressora, usuário e senha
npm install
npm run testar
```

Sai um cupom com uma régua. **Se a régua couber em uma linha só, a largura está
certa.** Esse teste não usa internet — serve para separar problema de
impressora de problema de conexão.

## 6. Ligar

```
npm start
```

No painel, o aviso vermelho vira verde em até 30 segundos.

## 7. Iniciar sozinho com o Pi

```
sudo cp markin-agente.service /etc/systemd/system/
sudo systemctl enable --now markin-agente
```

Conferir se está rodando: `systemctl status markin-agente`
Ver o que ele está fazendo: `journalctl -u markin-agente -f`

O systemd reinicia o agente sozinho se ele cair, e sobe junto com o Pi.

---

# Instalação no Windows (segundo agente, ou alternativa)

No Windows **existe** driver, e ele atrapalha — por isso os passos extras.

1. Instale o driver em **https://www.bematech.com.br/manuais-e-drivers/**
   (procure MP-4200 TH, atenção a 32 ou 64 bits)
2. **Impressoras e scanners** → MP-4200 → Propriedades → aba **Compartilhamento**
3. Marque compartilhar, nome do compartilhamento: `CUPOM`
   *(maiúsculo, sem acento, sem espaço — o Windows diferencia)*
4. Instale o Node em **https://nodejs.org** (versão LTS)
5. No `config.json`, use `"impressora": "\\\\localhost\\CUPOM"`
6. `npm install` e depois `npm run testar`
7. Para iniciar junto com o Windows: tecla **Windows + R**, digite
   `shell:startup`, e arraste `iniciar.bat` para a pasta que abrir

<details>
<summary>Por que compartilhar a impressora no Windows?</summary>

O driver da Bematech é gráfico. Mandar os comandos da impressora por ele faz o
Windows tentar **desenhar** os comandos em vez de executá-los, e sai papel com
símbolos estranhos. Escrever no compartilhamento entrega os bytes crus.

No Linux isso não existe: o kernel expõe a impressora direto, sem tradutor no
meio. Por isso o Pi tem quatro passos e o Windows tem sete.
</details>

---

# Quando der errado

**"Não saiu" no teste, no Pi**
`ls -l /dev/usb/` mostra o `lp0`? Você entrou no grupo `lp` e reabriu a sessão?

**"Não saiu" no teste, no Windows**
Impressora ligada e com papel? O nome no `config.json` é igual ao do
compartilhamento?

**Sai papel com símbolos estranhos**
No Windows, o `config.json` está apontando para o nome da impressora em vez do
compartilhamento. No Pi, provavelmente o CUPS foi instalado.

**A régua do teste vira a linha**
A impressora está em 58mm. Dá para mudar nela, ou me avise que eu ajusto o
sistema para 32 colunas.

**"não foi possível iniciar" ao rodar o agente**
E-mail ou senha errados, ou a conta não foi criada/ativada no painel. O teste do
passo 5 funciona mesmo assim — ele não usa login.

**O painel diz "sem reserva" em amarelo**
Um dos dois agentes parou. A impressão continua pelo outro, mas você está sem
rede de segurança. Vale olhar antes do próximo movimento.

**Cupom não saiu e a janela está aberta**
Olhe o registro do agente: ele anota cada falha e o motivo. Cupom que falha
**não** é perdido — volta para a fila e sai quando o problema for resolvido.
