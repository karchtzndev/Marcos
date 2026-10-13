#!/usr/bin/env bash
#
# Instalador do agente de impressão — O Markin
#
# Faz tudo o que o LEIA-ME manda fazer à mão: instala o Node, dá permissão de
# impressora, descobre as impressoras plugadas, fixa o nome de cada uma por
# udev, cria uma pasta de agente por impressora e deixa tudo subindo sozinho
# com o Pi.
#
# Rodar DE DENTRO da pasta descompactada:   bash instalar-no-pi.sh
#
set -euo pipefail

ORIGEM="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE="$HOME"
REGRAS=/etc/udev/rules.d/99-markin.rules

azul(){ printf '\n\033[1;36m%s\033[0m\n' "$*"; }
ok(){   printf '  \033[32m✓\033[0m %s\n' "$*"; }
aviso(){ printf '  \033[33m!\033[0m %s\n' "$*"; }
erro(){ printf '\n\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

[[ "$(uname -s)" == "Linux" ]] || erro "Este instalador é para o Raspberry Pi (Linux). No Windows, siga o LEIA-ME."
[[ -f "$ORIGEM/agente.js" ]] || erro "Rode de dentro da pasta descompactada, onde está o agente.js."

azul "1/6  Instalando o Node"
if command -v node >/dev/null 2>&1; then
  ok "Node já instalado ($(node --version))"
else
  sudo apt-get update -qq
  sudo apt-get install -y -qq nodejs npm
  ok "Node instalado ($(node --version))"
fi

azul "2/6  Permissão de impressora"
if id -nG "$USER" | grep -qw lp; then
  ok "usuário $USER já está no grupo lp"
else
  sudo usermod -aG lp "$USER"
  aviso "adicionado ao grupo lp — PRECISA sair e entrar de novo no SSH antes de imprimir"
  PRECISA_RELOGAR=1
fi

azul "3/6  Procurando impressoras"
mapfile -t DEVS < <(ls /dev/usb/lp* 2>/dev/null || true)
if [[ ${#DEVS[@]} -eq 0 ]]; then
  aviso "nenhuma impressora USB encontrada em /dev/usb/"
  aviso "ligue e plugue as impressoras e rode este instalador de novo"
  aviso "(se for só Bluetooth, siga a seção de Bluetooth do LEIA-ME)"
  exit 1
fi

declare -A SERIE
for d in "${DEVS[@]}"; do
  s="$(udevadm info -q property -n "$d" 2>/dev/null | sed -n 's/^ID_SERIAL_SHORT=//p' || true)"
  modelo="$(udevadm info -q property -n "$d" 2>/dev/null | sed -n 's/^ID_MODEL=//p' || true)"
  SERIE["$d"]="$s"
  printf '  %s  %s  série: %s\n' "$d" "${modelo:-?}" "${s:-NÃO EXPÕE}"
done

azul "4/6  Nomes fixos e pastas"
echo "  Cada impressora vira uma pasta com o seu agente."
echo "  Use nomes curtos e sem acento: cozinha, balcao, bar…"
echo

: > /tmp/markin-udev.$$
CRIADAS=()
for d in "${DEVS[@]}"; do
  read -r -p "  Apelido para $d (ou Enter para pular): " apelido
  [[ -z "$apelido" ]] && continue
  apelido="$(echo "$apelido" | tr -cd 'A-Za-z0-9_-')"

  s="${SERIE[$d]}"
  if [[ -n "$s" ]]; then
    echo "SUBSYSTEM==\"usbmisc\", ATTRS{serial}==\"$s\", SYMLINK+=\"markin-$apelido\"" >> /tmp/markin-udev.$$
    CAMINHO="/dev/markin-$apelido"
  else
    # Sem número de série não dá para distinguir duas iguais; fica no nome do
    # kernel, que PODE trocar ao reiniciar. O LEIA-ME explica a alternativa.
    aviso "$d não expõe número de série — usando $d mesmo (pode trocar ao reiniciar)"
    CAMINHO="$d"
  fi

  DEST="$BASE/agente-$apelido"
  mkdir -p "$DEST"
  cp "$ORIGEM"/{agente.js,testar.js,package.json,config.exemplo.json,LEIA-ME.md} "$DEST"/
  echo "$CAMINHO" > "$DEST/.caminho"
  CRIADAS+=("$apelido")
  ok "pasta $DEST  →  $CAMINHO"
done

[[ ${#CRIADAS[@]} -gt 0 ]] || erro "Nenhuma impressora configurada."

if [[ -s /tmp/markin-udev.$$ ]]; then
  sudo cp /tmp/markin-udev.$$ "$REGRAS"
  sudo udevadm control --reload-rules
  sudo udevadm trigger
  ok "nomes fixos gravados em $REGRAS"
fi
rm -f /tmp/markin-udev.$$

azul "5/6  Conta da impressora"
echo "  A mesma conta de funcionário serve para todos os agentes."
read -r -p "  E-mail: " EMAIL
read -r -s -p "  Senha:  " SENHA; echo
read -r -p "  Modo (copia = todas imprimem a mesma comanda / reserva = uma cobre a outra) [copia]: " MODO
MODO="${MODO:-copia}"

for apelido in "${CRIADAS[@]}"; do
  DEST="$BASE/agente-$apelido"
  CAMINHO="$(cat "$DEST/.caminho")"; rm -f "$DEST/.caminho"
  # Pelo python para o JSON sair sempre válido, com senha de qualquer formato
  python3 - "$DEST/config.json" "$apelido" "$MODO" "$CAMINHO" "$EMAIL" "$SENHA" <<'PY'
import json, sys
destino, nome, modo, impressora, usuario, senha = sys.argv[1:7]
base = json.load(open(destino.replace('config.json','config.exemplo.json')))
cfg = {k: v for k, v in base.items() if not k.startswith('_')}
cfg.update(nome=nome, modo=modo, impressora=impressora, usuario=usuario, senha=senha)
json.dump(cfg, open(destino, 'w'), indent=2, ensure_ascii=False)
PY
  chmod 600 "$DEST/config.json"
  ( cd "$DEST" && npm install --silent --no-audit --no-fund )
  ok "$apelido configurado"
done

azul "6/6  Subir sozinho com o Pi"
for apelido in "${CRIADAS[@]}"; do
  DEST="$BASE/agente-$apelido"
  sudo tee "/etc/systemd/system/markin-$apelido.service" >/dev/null <<EOF
[Unit]
Description=Agente de impressao Markin ($apelido)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$DEST
ExecStart=$(command -v node) agente.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
  sudo systemctl enable --quiet "markin-$apelido"
  ok "serviço markin-$apelido criado"
done
sudo systemctl daemon-reload

azul "Pronto"
echo "  Teste cada impressora antes de ligar os agentes:"
for apelido in "${CRIADAS[@]}"; do
  echo "      cd $BASE/agente-$apelido && npm run testar"
done
echo
echo "  Saiu o cupom da régua? Então ligue:"
for apelido in "${CRIADAS[@]}"; do
  echo "      sudo systemctl start markin-$apelido"
done
echo
echo "  Ver o que um agente está fazendo:"
echo "      journalctl -u markin-${CRIADAS[0]} -f"
echo
if [[ -n "${PRECISA_RELOGAR:-}" ]]; then
  printf '\033[33m  ATENÇÃO: saia e entre de novo no SSH antes de testar — a permissão\n  de impressora só vale na próxima sessão.\033[0m\n\n'
fi
