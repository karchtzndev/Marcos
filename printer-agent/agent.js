// Agente de impressão do O Markin
// -------------------------------
// Roda no computador do balcão, ligado na impressora térmica por USB.
// Lê a fila 'printQueue' que o painel gerencial já escreve (o navegador
// nunca imprime direto — só enfileira) e manda os bytes ESC/POS pra
// impressora de verdade. Avisa o painel que está vivo escrevendo em
// 'store/printer' a cada poucos segundos.
//
// Uso: npm install && node agent.js  (veja o README pro passo a passo completo)

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const admin = require('firebase-admin');

function carregarConfig(){
  const caminho = path.join(__dirname, 'config.json');
  if(!fs.existsSync(caminho)){
    console.error(
      "\nNão encontrei o config.json.\n" +
      "Copie o config.example.json pra config.json e preencha os campos.\n"
    );
    process.exit(1);
  }
  const cfg = JSON.parse(fs.readFileSync(caminho, 'utf8'));
  if(!cfg.serviceAccountPath || !cfg.printerShareName){
    console.error("\nconfig.json incompleto — falta serviceAccountPath ou printerShareName.\n");
    process.exit(1);
  }
  return cfg;
}

function carregarServiceAccount(cfg){
  const caminho = path.isAbsolute(cfg.serviceAccountPath)
    ? cfg.serviceAccountPath
    : path.join(__dirname, cfg.serviceAccountPath);
  if(!fs.existsSync(caminho)){
    console.error(
      `\nNão encontrei a chave de serviço em: ${caminho}\n` +
      "Veja no README como gerar essa chave no Console do Firebase.\n"
    );
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(caminho, 'utf8'));
}

const config = carregarConfig();
const serviceAccount = carregarServiceAccount(config);

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

function log(msg){
  console.log(`[${new Date().toLocaleString('pt-BR')}] ${msg}`);
}

// ---------------- HEARTBEAT ----------------
// Contrato exato que o painel espera em store/printer (gerencial/index.html,
// função filaStatus()): ultimoSinal (ISO) e impressora (nome pra exibir).
// Abaixo de 90s sem sinal o painel já mostra "desconectado" — por isso o
// intervalo padrão é bem menor que isso.
async function enviarHeartbeat(){
  try{
    await db.collection('store').doc('printer').set({
      ultimoSinal: new Date().toISOString(),
      impressora: config.printerShareName
    }, { merge: true });
  }catch(e){
    log(`Falha ao enviar sinal de vida: ${e.message}`);
  }
}

// ---------------- IMPRESSÃO ----------------
// A string 'escpos' já vem pronta do navegador (htmlParaEscPos, no painel):
// texto normal misturado com bytes de controle ESC/POS literais (ex: \x1B\x40).
// Cada caractere da string já corresponde a um byte 0-255 — por isso o
// Buffer usa encoding 'binary' (Latin1), NUNCA 'utf8' (que reencodaria os
// bytes de controle e estragaria os comandos da impressora).
function escposParaBuffer(texto){
  return Buffer.from(texto, 'binary');
}

function imprimirBuffer(buffer){
  return new Promise((resolve, reject) => {
    const tmp = path.join(os.tmpdir(), `omarkin-cupom-${Date.now()}.prn`);
    fs.writeFile(tmp, buffer, (err) => {
      if(err) return reject(err);
      // Truque padrão pra mandar bytes crus pra uma impressora térmica
      // compartilhada no Windows, sem precisar de nenhum módulo nativo:
      // copiar o arquivo em modo binário direto pro compartilhamento.
      // A impressora precisa estar COMPARTILHADA (Painel de Controle >
      // Dispositivos e Impressoras > botão direito > Propriedades da
      // impressora > aba Compartilhamento) com o nome usado em config.json.
      const destino = `\\\\localhost\\${config.printerShareName}`;
      execFile('cmd.exe', ['/c', 'copy', '/b', tmp, destino], (erroCmd) => {
        fs.unlink(tmp, () => {});
        if(erroCmd) return reject(erroCmd);
        resolve();
      });
    });
  });
}

async function imprimirComanda(doc){
  const dados = doc.data();
  const vias = Math.max(1, Number(dados.vias) || 1);
  const buffer = escposParaBuffer(dados.escpos || '');
  for(let i = 0; i < vias; i++){
    await imprimirBuffer(buffer);
  }
}

// ---------------- FILA ----------------
// Processa um documento de cada vez (evita duas vias saindo intercaladas se
// dois pedidos chegarem juntos) e nunca deixa a fila travada num erro
// permanente: depois de 3 tentativas, marca como 'erro' e segue em frente.
const emProcessamento = new Set();
const MAX_TENTATIVAS = 3;

async function processarDocumento(doc){
  if(emProcessamento.has(doc.id)) return;
  emProcessamento.add(doc.id);
  const ref = doc.ref;
  const dados = doc.data();
  const titulo = dados.titulo || dados.tipo || 'comanda';

  try{
    await imprimirComanda(doc);
    await ref.update({ status: 'impresso', impressoEm: new Date().toISOString() });
    log(`Impresso: ${titulo} (${doc.id})`);
  }catch(e){
    const tentativas = (Number(dados.tentativas) || 0) + 1;
    log(`Falha ao imprimir ${titulo} (${doc.id}), tentativa ${tentativas}: ${e.message}`);
    if(tentativas >= MAX_TENTATIVAS){
      await ref.update({ status: 'erro', erro: e.message, tentativas }).catch(() => {});
      log(`Desistindo de ${doc.id} após ${MAX_TENTATIVAS} tentativas — confira se a impressora está ligada e compartilhada.`);
    }else{
      await ref.update({ tentativas }).catch(() => {});
    }
  }finally{
    emProcessamento.delete(doc.id);
  }
}

function iniciarFila(){
  db.collection('printQueue')
    .where('status', '==', 'pendente')
    .orderBy('criadoEm', 'asc')
    .onSnapshot((snap) => {
      snap.docChanges().forEach((change) => {
        if(change.type === 'added' || change.type === 'modified'){
          processarDocumento(change.doc);
        }
      });
    }, (err) => {
      log(`Erro ao escutar a fila de impressão: ${err.message}`);
    });
}

// ---------------- INÍCIO ----------------
log(`Agente de impressão iniciado — impressora "${config.printerShareName}".`);
enviarHeartbeat();
setInterval(enviarHeartbeat, (Number(config.heartbeatSegundos) || 30) * 1000);
iniciarFila();

process.on('SIGINT', () => { log('Encerrando...'); process.exit(0); });
