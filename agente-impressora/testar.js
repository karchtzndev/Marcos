/**
 * Teste de impressora — O Markin
 *
 * Roda com: node testar.js
 *
 * Só fala com a impressora, não usa internet nem Firebase. Serve para separar
 * os dois problemas possíveis: se o cupom de teste sai, a impressora está certa
 * e qualquer falha do agente é de conexão/login.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

const ESC = {
  init:   '\x1B\x40',
  center: '\x1B\x61\x01',
  left:   '\x1B\x61\x00',
  bold:   '\x1B\x45\x01',
  boldOff:'\x1B\x45\x00',
  grande: '\x1D\x21\x11',
  normal: '\x1D\x21\x00',
  cortar: '\x1D\x56\x42\x00',
};

// Régua de 48 colunas: é a largura do papel de 80mm. Se os números virarem a
// linha no papel, a impressora está configurada para 58mm (32 colunas).
const regua = '....|....1....|....2....|....3....|....4....|...8';

const cupom =
  ESC.init +
  ESC.center + ESC.grande + ESC.bold + 'O MARKIN\n' + ESC.normal +
  'Chef\'s Burguer\n' + ESC.boldOff +
  ESC.left + '-'.repeat(48) + '\n' +
  'TESTE DE IMPRESSAO\n' +
  new Date().toLocaleString('pt-BR') + '\n' +
  'Impressora: ' + cfg.impressora + '\n' +
  '-'.repeat(48) + '\n' +
  'Regua de 48 colunas (papel 80mm):\n' +
  regua + '\n' +
  '-'.repeat(48) + '\n' +
  ESC.bold + 'Se a regua coube em uma linha so,\n' +
  'a largura esta correta.\n' + ESC.boldOff +
  '\n\n\n' + ESC.cortar;

const buf = Buffer.from(cupom, 'latin1');
const ehWindows = process.platform === 'win32';
console.log(`Enviando para ${cfg.impressora} (${ehWindows ? 'Windows' : 'Linux'})…`);

function deuErro(msg){
  console.error('\n❌ Não saiu.', msg);
  console.error('\nConfira:');
  console.error('  1. A impressora está ligada e com papel?');
  if(ehWindows){
    console.error('  2. O nome no config.json é igual ao do compartilhamento?');
    console.error('  3. O compartilhamento foi marcado nas propriedades da impressora?');
  }else{
    console.error('  2. O dispositivo existe?   ls -l /dev/usb/');
    console.error('  3. Você está no grupo lp?  sudo usermod -aG lp $USER');
    console.error('     (depois de entrar no grupo, precisa sair e entrar na sessão)');
  }
  process.exitCode = 1;
}

const deuCerto = () => {
  console.log('\n✅ Enviado. Confira o papel.');
  console.log('   Saiu em branco ou com lixo? Veja o LEIA-ME.');
};

if(ehWindows){
  const tmp = path.join(os.tmpdir(), 'markin-teste.bin');
  fs.writeFileSync(tmp, buf);
  execFile('cmd', ['/c', 'copy', '/b', tmp, cfg.impressora], (erro, _s, stderr) => {
    fs.unlink(tmp, () => {});
    erro ? deuErro(stderr || erro.message) : deuCerto();
  });
}else{
  fs.promises.writeFile(cfg.impressora, buf, { flag: 'a' }).then(deuCerto, e => deuErro(e.message));
}
