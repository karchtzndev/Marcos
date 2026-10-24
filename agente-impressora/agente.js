/**
 * Agente de impressão — O Markin
 *
 * Fica rodando perto da impressora, escuta a fila no Firestore e manda os
 * cupons para a térmica. O painel já grava os cupons prontos em ESC/POS;
 * aqui só entregamos os bytes.
 *
 * Roda em Windows e em Linux (Raspberry Pi). Pode rodar em DOIS aparelhos ao
 * mesmo tempo, como reserva um do outro: antes de imprimir, o agente
 * reivindica o cupom numa transação, então só um dos dois ganha e o cupom
 * nunca sai dobrado.
 *
 * Roda com: node agente.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const {
  getFirestore, collection, query, where, onSnapshot, getDocs,
  doc, updateDoc, setDoc, runTransaction,
} = require('firebase/firestore');

const INTERVALO_SINAL = 30000;     // de quanto em quanto tempo avisamos que estamos vivos
const INTERVALO_RESGATE = 60000;   // varredura de cupom preso
const LIMITE_IMPRESSAO = 120000;   // acima disso, quem reivindicou morreu no meio
const VERSAO = '2.0.0';

// Lido só quando o agente roda de verdade; os testes carregam este arquivo
// como módulo e não devem exigir um config com senha.
let cfg = {};
let EU = os.hostname();
let MODO = 'reserva';
// Tira o BOM: tres bytes invisiveis que o PowerShell do Windows e o Bloco de
// Notas colam no comeco do arquivo ao salvar em UTF-8. JSON.parse recusa, e a
// mensagem que sai — Unexpected token — nao parece nada com "ha um caractere
// invisivel aqui". Custou uma noite na loja, com a impressora plugada.
function lerConfig(texto){
  return JSON.parse(String(texto).replace(/^\uFEFF/, ''));
}

function carregarConfig(){
  cfg = lerConfig(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
  EU = cfg.nome || os.hostname();
  MODO = cfg.modo || 'reserva';
  if(!MODOS.includes(MODO)){
    throw new Error(`modo "${MODO}" não existe. Use: ${MODOS.join(' ou ')}`);
  }
}

/* ---------------- REGISTRO EM ARQUIVO ----------------
   O instalador registra o agente como tarefa OCULTA do Windows: ele sobe sem
   janela nenhuma. Até aqui, tudo que este arquivo tinha a dizer ia para um
   console que não existe — senha errada, nome de compartilhamento trocado,
   regra do banco recusando, tudo morria sem deixar nada. De fora parecia
   simplesmente "não acontece nada", e não havia o que olhar para saber qual
   dos cinco motivos era.

   Agora cada linha também vai para agente.log, ao lado deste arquivo. */
const ARQUIVO_LOG = path.join(__dirname, 'agente.log');
const LIMITE_LOG = 1024 * 1024;   // 1 MB: histórico suficiente, não enche o disco

function gravarNoLog(linha){
  try{
    // Gira antes de escrever, não depois: assim o arquivo nunca passa do
    // limite, e o anterior fica guardado para comparar.
    try{
      if(fs.statSync(ARQUIVO_LOG).size > LIMITE_LOG){
        fs.renameSync(ARQUIVO_LOG, ARQUIVO_LOG + '.anterior');
      }
    }catch(e){ /* ainda não existe */ }
    fs.appendFileSync(ARQUIVO_LOG, linha + os.EOL);
  }catch(e){ /* disco cheio ou sem permissão: o console ainda tem a linha */ }
}

function log(...args){
  const agora = new Date();
  const texto = args.map(a => (a instanceof Error ? a.message : String(a))).join(' ');
  console.log(agora.toLocaleTimeString('pt-BR'), '·', texto);
  // No arquivo vai a data inteira: o log é lido dias depois, e só a hora
  // deixaria a pessoa sem saber se aquilo é de hoje ou da semana passada.
  gravarNoLog(agora.toLocaleString('pt-BR') + ' · ' + texto);
}

/* ---------------- A FALHA CHEGA AO PAINEL ----------------
   O log no PC resolve para quem está na frente dele. Quem está com o celular
   na mão precisa ver na aba 🐞 Erros. Vai pelo mesmo caminho das telas, nos
   campos exatos que a regra do errorLog aceita — um a mais e a gravação é
   recusada, em silêncio, que é justamente o que isto combate. */
let avisarPainel = null;   // definido depois do login; antes dele não há como

function contarAoPainel(oQue, erro){
  if(!avisarPainel) return;
  avisarPainel(oQue, erro).catch(() => {});
}

/* ============ IMPRESSÃO ============ */

// latin1, nunca utf8: ESC/POS são bytes de controle (ESC = 0x1B), e o utf8
// transformaria qualquer byte acima de 127 em dois bytes errados.
const paraBytes = (escpos) => Buffer.from(escpos, 'latin1');

// No Linux o kernel já expõe a impressora USB em /dev/usb/lp0 e escrever ali
// é falar direto com a cabeça térmica — sem driver, sem CUPS. Modo 'a' porque
// o modo padrão tentaria truncar, o que não existe em dispositivo.
function imprimirLinux(buf){
  return fs.promises.writeFile(cfg.impressora, buf, { flag: 'a' });
}

// No Windows o driver da Bematech é gráfico: mandar ESC/POS por ele faz o
// sistema tentar DESENHAR os comandos, e sai lixo no papel. "copy /b" para o
// compartilhamento entrega os bytes crus, que é o que a impressora espera.
function imprimirWindows(buf){
  return new Promise((resolve, reject) => {
    const tmp = path.join(os.tmpdir(), 'markin-cupom-' + Date.now() + '.bin');
    fs.writeFile(tmp, buf, (err) => {
      if(err) return reject(err);
      execFile('cmd', ['/c', 'copy', '/b', tmp, cfg.impressora], (erro, _s, stderr) => {
        fs.unlink(tmp, () => {});
        erro ? reject(new Error(stderr || erro.message)) : resolve();
      });
    });
  });
}

// ---------- IMPRESSORA DE REDE (Wi-Fi ou cabo) ----------
// Praticamente toda termica com rede escuta ESC/POS cru na porta 9100. Nao ha
// driver, nao ha compartilhamento do Windows, nao ha Bluetooth no meio: o
// agente abre uma conexao, entrega os bytes e fecha.
//
// E o unico caminho que atravessa a loja inteira. Bluetooth e feito para
// alguns metros; rede e feita para predio. Quando a cozinha fica longe do
// atendimento, e esta a resposta.
// O endereco entra por parametro, com o do config como padrao: assim da
// para provar o caminho de rede num teste, sem depender de um arquivo de
// configuracao e sem impressora nenhuma na mesa.
function imprimirRede(buf, alvo = cfg.impressora){
  const net = require('net');
  const m = String(alvo).match(/^tcp:\/\/([^:/]+)(?::(\d+))?/i);
  const host = m[1];
  const porta = Number(m[2] || 9100);

  return new Promise((resolve, reject) => {
    const s = new net.Socket();
    // Sem limite de tempo, uma impressora desligada deixaria a conexao
    // pendurada e a fila parada — sem nada na tela dizendo por que.
    s.setTimeout(Number(cfg.tempoLimiteRede) || 8000);
    const falhar = (e) => { s.destroy(); reject(e); };
    s.once('timeout', () => falhar(new Error(`a impressora ${host}:${porta} nao respondeu`)));
    s.once('error', (e) => falhar(new Error(`${host}:${porta} — ${e.message}`)));
    s.connect(porta, host, () => {
      // end() so resolve depois que o socket escoou o que foi escrito
      s.end(buf, () => { s.destroy(); resolve(); });
    });
  });
}

// ---------- PORTA SERIAL (Bluetooth no Windows) ----------
// Impressora Bluetooth pareada no Windows costuma aparecer como porta COM.
// Escrever direto nela entrega os bytes crus, sem driver nenhum — mesmo
// principio do compartilhamento, outro destino.
function imprimirSerial(buf, alvo = cfg.impressora){
  return new Promise((resolve, reject) => {
    const porta = String(alvo).toUpperCase().replace(/:$/, '');
    const tmp = path.join(os.tmpdir(), 'markin-cupom-' + Date.now() + '.bin');
    fs.writeFile(tmp, buf, (err) => {
      if(err) return reject(err);
      // O "mode" fixa a velocidade antes de escrever: sem isso o Windows usa
      // o que estiver sobrando e sai lixo no papel.
      const baud = Number(cfg.velocidadeSerial) || 9600;
      execFile('cmd', ['/c',
        `mode ${porta}: BAUD=${baud} PARITY=N DATA=8 STOP=1 >nul & copy /b "${tmp}" ${porta}:`
      ], (erro, _s, stderr) => {
        fs.unlink(tmp, () => {});
        erro ? reject(new Error(stderr || erro.message)) : resolve();
      });
    });
  });
}

/* Qual caminho usar sai do proprio endereco configurado, nao do sistema:
     tcp://192.168.0.50       impressora de rede, Wi-Fi ou cabo
     COM3                     Bluetooth pareado no Windows, ou serial
     \\localhost\COZINHA      compartilhamento do Windows (USB)
     /dev/usb/lp0             USB no Linux e no Raspberry Pi
     /dev/rfcomm0             Bluetooth no Linux
   Assim a mesma versao do agente serve para os quatro, e trocar de
   impressora e trocar uma linha do config — nao reinstalar nada. */
function caminhoDeImpressao(endereco = cfg.impressora){
  const alvo = String(endereco || '');
  if(/^tcp:\/\//i.test(alvo)) return imprimirRede;
  if(/^COM\d+:?$/i.test(alvo)) return imprimirSerial;
  return process.platform === 'win32' ? imprimirWindows : imprimirLinux;
}

const imprimir = (escpos) => caminhoDeImpressao()(paraBytes(escpos));

/* ============ MODOS ============ */
//
// reserva — os agentes DISPUTAM o cupom e só um imprime. Dois aparelhos
//           vigiando a mesma impressora, um cobrindo a queda do outro.
//
// copia   — cada agente imprime a SUA via do mesmo cupom, sem disputar.
//           Mesma comanda saindo na cozinha e no balcão ao mesmo tempo.
//
// Todos os agentes precisam usar o MESMO modo. Misturar faria o que está em
// reserva engolir o cupom antes dos outros copiarem.
const MODOS = ['reserva', 'copia'];

// Nome do agente vira chave de campo no Firestore, que não aceita . [ ] * / `
const chaveAgente = (nome) => String(nome).replace(/[^A-Za-z0-9_-]/g, '_');

/* ============ DISPUTA PELA FILA ============ */

// Com dois agentes no ar, os dois recebem o MESMO cupom no mesmo instante.
// Sem isto os dois imprimiriam e sairia cupom dobrado. A transação resolve:
// quem chegar primeiro marca como 'imprimindo' e o outro recebe false.
async function reivindicar(db, id, quem){
  const ref = doc(db, 'printQueue', id);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if(!snap.exists() || snap.data().status !== 'pendente') return false;
    tx.update(ref, { status: 'imprimindo', agente: quem, desde: new Date().toISOString() });
    return true;
  });
}

const devolver = (db, id) =>
  updateDoc(doc(db, 'printQueue', id), { status: 'pendente', agente: null })
    .catch(e => log('não consegui devolver à fila:', e.message));

// Se o agente que reivindicou morrer entre o claim e a impressão (queda de
// energia, cabo arrancado), o cupom ficaria preso em 'imprimindo' para sempre.
// Esta varredura devolve à fila o que passou do tempo — é o que faz a reserva
// valer de verdade quando o principal cai no meio de um pedido.
async function resgatarPresos(db){
  try{
    const snap = await getDocs(query(collection(db,'printQueue'), where('status','==','imprimindo')));
    for(const d of snap.docs){
      const desde = new Date(d.data().desde || 0).getTime();
      if(Date.now() - desde < LIMITE_IMPRESSAO) continue;
      if(await reivindicarPreso(db, d.id)) log('🔁 resgatado da fila:', d.id);
    }
  }catch(e){ /* sem rede: a próxima varredura tenta de novo */ }
}

function reivindicarPreso(db, id, limite = LIMITE_IMPRESSAO){
  const ref = doc(db, 'printQueue', id);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if(!snap.exists() || snap.data().status !== 'imprimindo') return false;
    if(Date.now() - new Date(snap.data().desde || 0).getTime() < limite) return false;
    tx.update(ref, { status: 'pendente', agente: null });
    return true;
  }).catch(() => false);
}

/* ============ MODO CÓPIA ============ */

// Cada agente anota só a PRÓPRIA via. updateDoc interpreta o ponto como
// caminho, então dois agentes gravando ao mesmo tempo escrevem em campos
// diferentes e nenhum apaga o do outro — o contrário de regravar o mapa
// inteiro, que faria o segundo sumir com a marca do primeiro.
const marcarMinhaVia = (db, id, quem) =>
  updateDoc(doc(db, 'printQueue', id), {
    ['impressoPor.' + chaveAgente(quem)]: new Date().toISOString(),
  });

const jaImprimiAqui = (dados, quem) =>
  !!(dados.impressoPor && dados.impressoPor[chaveAgente(quem)]);

// No modo cópia ninguém pode fechar o cupom ao imprimir: os outros agentes
// ainda não copiaram. Em vez de exigir uma lista de quem existe, damos uma
// janela — impressora que estava desligada tem esse tempo para ligar e tirar
// a via dela. Passado isso o cupom sai da fila, senão ela cresceria sem fim.
async function fecharAntigos(db, janelaMin){
  const limite = Date.now() - janelaMin * 60000;
  try{
    const snap = await getDocs(query(collection(db,'printQueue'), where('status','==','pendente')));
    for(const d of snap.docs){
      if(new Date(d.data().criadoEm || 0).getTime() > limite) continue;
      await updateDoc(d.ref, { status: 'impresso', fechadoEm: new Date().toISOString() })
        .catch(() => {});
    }
  }catch(e){ /* sem rede: a próxima varredura tenta de novo */ }
}

/* ============ PROCESSAMENTO ============ */

// Um cupom por vez neste agente. Mandar dois ao mesmo tempo para a mesma
// impressora embaralha os bytes e sai um cupom dentro do outro.
let imprimindo = false;
const pendentes = [];

async function processarFila(db){
  if(imprimindo || pendentes.length === 0) return;
  imprimindo = true;

  const item = pendentes.shift();
  const vias = Math.max(1, Number(item.dados.vias) || 1);
  const sairam = async () => { for(let i = 0; i < vias; i++) await imprimir(item.dados.escpos); };

  try{
    if(MODO === 'copia'){
      if(jaImprimiAqui(item.dados, EU)) return;   // esta impressora já tirou a via dela
      await sairam();
      await marcarMinhaVia(db, item.id, EU);
    }else{
      if(!await reivindicar(db, item.id, EU)) return;   // o outro agente pegou primeiro
      await sairam();
      await updateDoc(doc(db, 'printQueue', item.id), {
        status: 'impresso',
        impressoEm: new Date().toISOString(),
        agente: EU,
      });
    }
    log(`✅ ${item.dados.tipo} ${item.dados.titulo || ''} (${vias} via${vias>1?'s':''})`);
  }catch(e){
    // Nunca marcamos como feito: papel acabou, impressora desligada. Na
    // reserva o cupom volta para a fila e o outro agente tenta; na cópia ele
    // continua pendente e este agente insiste, porque a via dele é a única
    // que ninguém mais vai tirar.
    log('❌ falhou:', e.message, MODO === 'copia' ? '— vai tentar de novo' : '— devolvido à fila');
    contarAoPainel('imprimir o cupom', e);
    if(MODO === 'copia') pendentes.push(item);
    else await devolver(db, item.id);
    await new Promise(r => setTimeout(r, 5000));
  }finally{
    imprimindo = false;
    processarFila(db);
  }
}

/* ============ PRINCIPAL ============ */

async function main(){
  carregarConfig();
  const app = initializeApp(cfg.firebase);
  const db = getFirestore(app);

  log('conectando…');
  await signInWithEmailAndPassword(getAuth(app), cfg.usuario, cfg.senha);
  log(`conectado como ${cfg.usuario} · agente "${EU}" · modo ${MODO}`);

  // Só agora dá para falar com o banco. Antes do login nada daqui sai do PC,
  // e é por isso que o arquivo de log continua sendo o canal que nunca falha.
  avisarPainel = (oQue, erro) => {
    const motivo = (erro && (erro.code || erro.message)) || String(erro || '');
    return setDoc(doc(collection(db, 'errorLog')), {
      mensagem: `FALHA: "${oQue}" no agente ${EU} — ${motivo}`.slice(0, 500),
      detalhe: `Impressora ${cfg.impressora} · modo ${MODO} · agente versão ${VERSAO}`.slice(0, 500),
      pagina: 'agente',
      plataforma: process.platform,
      online: true,
      quando: new Date().toISOString(),
      expiraEm: new Date(Date.now() + 30 * 86400000),
    });
  };
  log('imprimindo em', cfg.impressora, `(${process.platform === 'win32' ? 'Windows' : 'Linux'})`);
  if(MODO === 'copia') log(`cada cupom fica ${cfg.janelaMinutos || 10} min na fila para os outros copiarem`);

  // Sinal de vida: acende o verde no painel. Cada agente grava também o
  // próprio nome, para dar pra ver se a reserva ainda está de pé — redundância
  // que ninguém consegue monitorar vira, sem avisar, um agente só.
  const sinal = () => setDoc(doc(db, 'store', 'printer'), {
    ultimoSinal: new Date().toISOString(),
    agentes: { [chaveAgente(EU)]: {
      nome: EU, modo: MODO, visto: new Date().toISOString(),
      impressora: cfg.impressora, versao: VERSAO,
    } },
  }, { merge: true }).catch(e => log('sinal falhou:', e.message));

  sinal();
  setInterval(sinal, INTERVALO_SINAL);

  // Cada modo tem a sua varredura: na reserva, resgatar o cupom que ficou
  // preso com um agente que morreu; na cópia, fechar o cupom velho para a
  // fila não crescer para sempre.
  const varrer = MODO === 'copia'
    ? () => fecharAntigos(db, Number(cfg.janelaMinutos) || 10)
    : () => resgatarPresos(db);
  varrer();
  setInterval(varrer, INTERVALO_RESGATE);

  onSnapshot(
    query(collection(db, 'printQueue'), where('status', '==', 'pendente')),
    (snap) => {
      snap.docChanges().forEach(m => {
        if(m.type !== 'added') return;
        if(pendentes.some(p => p.id === m.doc.id)) return;
        pendentes.push({ id: m.doc.id, dados: m.doc.data() });
      });
      processarFila(db);
    },
    (e) => log('erro na fila:', e.message)
  );

  log('aguardando cupons. Pode minimizar esta janela.');
}

// Só sobe o agente quando o arquivo é executado. Carregado como módulo (pelos
// testes), exporta a disputa pela fila para ser verificada contra o emulador.
if(require.main === module){
  main().catch(e => {
    // A tarefa agendada reinicia este processo a cada minuto. Sem um motivo
    // escrito, o log vira mil linhas iguais e nenhuma pista; com ele, a
    // primeira linha já diz o que arrumar.
    const codigo = (e && e.code) || '';
    const pistas = {
      'auth/invalid-credential': 'e-mail ou senha errados no config.json.',
      'auth/invalid-email':      'o e-mail no config.json está mal escrito.',
      'auth/user-not-found':     'essa conta não existe. Crie em Ajustes → Acessos, sem permissão nenhuma.',
      'auth/wrong-password':     'a senha não confere com a da conta.',
      'auth/network-request-failed': 'o PC não alcançou a internet.',
      'permission-denied':       'a conta existe mas o banco recusou. Confira se ela está ativa no painel.',
    };
    log('não foi possível iniciar:', e.message);
    log('>>>', pistas[codigo] || 'confira usuário, senha e conexão no config.json');
    log('    (este arquivo é o agente.log, na mesma pasta do agente.js)');
    process.exitCode = 1;
  });
}

module.exports = {
  lerConfig, caminhoDeImpressao,
  imprimirRede, imprimirSerial, imprimirWindows, imprimirLinux,
  reivindicar, reivindicarPreso, devolver,
  marcarMinhaVia, jaImprimiAqui, fecharAntigos, chaveAgente,
};
