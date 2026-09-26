/**
 * Agente de impressão — O Markin
 *
 * Fica rodando no computador da loja, escuta a fila de impressão no Firestore
 * e manda os cupons para a impressora térmica. O painel já grava os cupons
 * prontos, em ESC/POS; aqui só entregamos os bytes.
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
  getFirestore, collection, query, where, onSnapshot,
  doc, updateDoc, setDoc,
} = require('firebase/firestore');

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

const INTERVALO_SINAL = 30000;   // de quanto em quanto tempo avisamos que estamos vivos
const VERSAO = '1.0.0';

function log(...args){
  console.log(new Date().toLocaleTimeString('pt-BR'), '·', ...args);
}

/* ============ IMPRESSÃO ============ */

// O driver da Bematech é gráfico: mandar ESC/POS por ele do jeito normal faz o
// Windows tentar DESENHAR os comandos, e sai lixo no papel. "copy /b" para o
// compartilhamento entrega os bytes crus, que é o que a impressora espera.
function imprimir(escpos){
  return new Promise((resolve, reject) => {
    // latin1, nunca utf8: os comandos são bytes de controle (ESC = 0x1B) e o
    // utf8 transformaria qualquer byte acima de 127 em dois bytes errados.
    const buf = Buffer.from(escpos, 'latin1');
    const tmp = path.join(os.tmpdir(), 'markin-cupom-' + Date.now() + '.bin');

    fs.writeFile(tmp, buf, (err) => {
      if(err) return reject(err);
      execFile('cmd', ['/c', 'copy', '/b', tmp, cfg.impressora], (erro, _saida, stderr) => {
        fs.unlink(tmp, () => {});
        if(erro) return reject(new Error(stderr || erro.message));
        resolve();
      });
    });
  });
}

/* ============ FILA ============ */

// Um cupom por vez. Mandar dois ao mesmo tempo para a mesma impressora
// embaralha os bytes e sai um cupom dentro do outro.
let imprimindo = false;
const pendentes = [];

async function processarFila(db){
  if(imprimindo || pendentes.length === 0) return;
  imprimindo = true;

  const item = pendentes.shift();
  try{
    const vias = Math.max(1, Number(item.dados.vias) || 1);
    for(let i = 0; i < vias; i++) await imprimir(item.dados.escpos);

    await updateDoc(doc(db, 'printQueue', item.id), {
      status: 'impresso',
      impressoEm: new Date().toISOString(),
    });
    log(`✅ ${item.dados.tipo} ${item.dados.titulo || ''} (${vias} via${vias>1?'s':''})`);
  }catch(e){
    // Não marcamos como impresso: o documento continua pendente e volta na
    // próxima escuta. Papel acabou, impressora desligada — tudo se resolve
    // sozinho quando o problema for resolvido, sem perder cupom.
    log('❌ falhou:', e.message, '— fica na fila e tenta de novo');
    await new Promise(r => setTimeout(r, 5000));
  }finally{
    imprimindo = false;
    processarFila(db);
  }
}

/* ============ PRINCIPAL ============ */

async function main(){
  const app = initializeApp(cfg.firebase);
  const auth = getAuth(app);
  const db = getFirestore(app);

  log('conectando…');
  await signInWithEmailAndPassword(auth, cfg.usuario, cfg.senha);
  log('conectado como', cfg.usuario);
  log('imprimindo em', cfg.impressora);

  // Sinal de vida: é o que acende o verde no painel. Sem isso a equipe vê
  // "Computador desconectado" mesmo com tudo funcionando.
  const sinal = () => setDoc(doc(db, 'store', 'printer'), {
    ultimoSinal: new Date().toISOString(),
    agente: cfg.nome || os.hostname(),
    impressora: cfg.impressora,
    versao: VERSAO,
  }, { merge: true }).catch(e => log('sinal falhou:', e.message));

  sinal();
  setInterval(sinal, INTERVALO_SINAL);

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

main().catch(e => {
  log('não foi possível iniciar:', e.message);
  log('confira usuário, senha e conexão no config.json');
  process.exitCode = 1;
});
