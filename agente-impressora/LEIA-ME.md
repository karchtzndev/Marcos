# Agente de impressão — O Markin

Faz a comanda sair sozinha, de **qualquer aparelho** — iPhone, Android, tablet.

**Como funciona:** quem manda imprimir no painel só escreve numa fila na nuvem.
Quem imprime é este agente, rodando perto da impressora. Por isso não importa
o aparelho de quem está no balcão — e é por isso que iPhone funciona, coisa que
a impressão direta do Android (RawBT) nunca permitiu.

Se o agente estiver desligado, os cupons esperam na fila e saem quando ele
voltar. Nada se perde.

## Vários agentes ao mesmo tempo — dois modos

Cada impressora tem o seu agente, com o seu `config.json`. O `modo` decide como
eles se comportam entre si. **Todos precisam usar o mesmo modo.**

### `"modo": "copia"` — a mesma comanda em todas

Cozinha, balcão e onde mais você quiser recebem a **mesma via ao mesmo tempo**.
Cada agente imprime a sua e anota só a própria marca, sem apagar a dos outros.

O cupom fica na fila por `janelaMinutos` (10 por padrão) antes de ser fechado.
É de propósito: uma impressora que estava desligada tem esse tempo para ligar e
tirar a via dela.

### `"modo": "reserva"` — um cobre a queda do outro

Os agentes **disputam** o cupom e só um imprime. Serve para dois aparelhos
vigiando a mesma impressora, ou para um PC cobrindo a queda do Pi.

Se quem ganhou morrer no meio, o cupom volta para a fila em até dois minutos e
o outro assume. **O cupom nunca sai dobrado.**

---

Cada agente precisa de um `nome` diferente. O painel lista todos, avisa em
amarelo quando um para, e em **vermelho se os modos estiverem misturados** —
nesse caso um agente fecharia o cupom antes dos outros copiarem, e uma
impressora pararia de imprimir sem erro nenhum aparecer.

---

# Instalação no Raspberry Pi (recomendado)

É o caminho mais simples: **não existe driver para instalar.**

## O jeito rápido: deixe o instalador fazer

Ligue e plugue as impressoras, copie esta pasta para o Pi e rode:

```
bash instalar-no-pi.sh
```

Ele faz sozinho tudo o que está escrito abaixo: instala o Node, dá a permissão
de impressora, **descobre as impressoras plugadas**, fixa o nome de cada uma por
udev, cria uma pasta de agente por impressora, gera os `config.json` e deixa
tudo subindo com o Pi.

Ele pergunta só três coisas: um apelido para cada impressora, o e-mail e a senha
da conta, e o modo.

> Se preferir entender cada passo — ou se algo der errado no instalador — os
> passos manuais estão todos abaixo. Eles continuam valendo.

---

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

## 3b. Fixar o nome de cada impressora USB ⚠️

**Pule este passo só se você tiver UMA impressora USB.**

Com duas do mesmo modelo, o Linux numera `lp0` e `lp1` por ordem de detecção —
e essa ordem **muda a cada reinício**. Na prática: você reinicia o Pi numa terça
e a comanda da cozinha passa a sair no balcão. Sem erro, sem aviso.

Descubra o número de série de cada uma:

```
lsusb -v 2>/dev/null | grep -A3 -i bematech | grep -i iSerial
```

Crie `/etc/udev/rules.d/99-markin.rules` com uma linha por impressora:

```
SUBSYSTEM=="usbmisc", ATTRS{serial}=="SERIE-DA-COZINHA", SYMLINK+="markin-cozinha"
SUBSYSTEM=="usbmisc", ATTRS{serial}=="SERIE-DO-BALCAO",  SYMLINK+="markin-balcao"
```

Aplique e confira:

```
sudo udevadm control --reload-rules && sudo udevadm trigger
ls -l /dev/markin-*
```

Agora use esses nomes no `config.json`. Eles nunca mudam, aconteça o que
acontecer.

> Se as impressoras não expuserem número de série, dá para fixar pela **porta
> física** em vez do serial — nesse caso cada uma fica amarrada à entrada USB
> onde está plugada. Me avise que eu te passo a regra.

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

**O painel diz "parado" em amarelo**
Um dos agentes parou. No modo reserva a impressão continua pelo outro, mas você
está sem rede de segurança. No modo cópia, aquela impressora simplesmente não
está mais recebendo as vias dela.

**O painel diz "Modos misturados" em vermelho**
Algum `config.json` está com `modo` diferente dos outros. Deixe todos iguais e
reinicie os agentes — enquanto estiver assim, uma impressora vai parar de
imprimir sem dar erro.

**A comanda da cozinha começou a sair no balcão**
As duas USB trocaram de `lp0`/`lp1` ao reiniciar. É o passo 3b — fixe os nomes
por udev e isso não acontece mais.

**Cupom não saiu e a janela está aberta**
Olhe o registro do agente: ele anota cada falha e o motivo. Cupom que falha
**não** é perdido — volta para a fila e sai quando o problema for resolvido.
