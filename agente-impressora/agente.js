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
function carregarConfig(){
  cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
  EU = cfg.nome || os.hostname();
}

function log(...args){
  console.log(new Date().toLocaleTimeString('pt-BR'), '·', ...args);
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

const imprimir = (escpos) => process.platform === 'win32'
  ? imprimirWindows(paraBytes(escpos))
  : imprimirLinux(paraBytes(escpos));

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

/* ============ PROCESSAMENTO ============ */

// Um cupom por vez neste agente. Mandar dois ao mesmo tempo para a mesma
// impressora embaralha os bytes e sai um cupom dentro do outro.
let imprimindo = false;
const pendentes = [];

async function processarFila(db){
  if(imprimindo || pendentes.length === 0) return;
  imprimindo = true;

  const item = pendentes.shift();
  try{
    if(!await reivindicar(db, item.id, EU)) return;   // o outro agente pegou primeiro

    const vias = Math.max(1, Number(item.dados.vias) || 1);
    for(let i = 0; i < vias; i++) await imprimir(item.dados.escpos);

    await updateDoc(doc(db, 'printQueue', item.id), {
      status: 'impresso',
      impressoEm: new Date().toISOString(),
      agente: EU,
    });
    log(`✅ ${item.dados.tipo} ${item.dados.titulo || ''} (${vias} via${vias>1?'s':''})`);
  }catch(e){
    // Devolve à fila em vez de deixar preso: papel acabou, impressora
    // desligada — o outro agente tenta, ou este mesmo tenta de novo depois.
    log('❌ falhou:', e.message, '— devolvido à fila');
    await devolver(db, item.id);
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
  log(`conectado como ${cfg.usuario} · agente "${EU}"`);
  log('imprimindo em', cfg.impressora, `(${process.platform === 'win32' ? 'Windows' : 'Linux'})`);

  // Sinal de vida: acende o verde no painel. Cada agente grava também o
  // próprio nome, para dar pra ver se a reserva ainda está de pé — redundância
  // que ninguém consegue monitorar vira, sem avisar, um agente só.
  const sinal = () => setDoc(doc(db, 'store', 'printer'), {
    ultimoSinal: new Date().toISOString(),
    agentes: { [EU]: { visto: new Date().toISOString(), impressora: cfg.impressora, versao: VERSAO } },
  }, { merge: true }).catch(e => log('sinal falhou:', e.message));

  sinal();
  setInterval(sinal, INTERVALO_SINAL);

  resgatarPresos(db);
  setInterval(() => resgatarPresos(db), INTERVALO_RESGATE);

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
    log('não foi possível iniciar:', e.message);
    log('confira usuário, senha e conexão no config.json');
    process.exitCode = 1;
  });
}

module.exports = { reivindicar, reivindicarPreso, devolver };
