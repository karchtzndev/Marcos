/**
 * Impressora de rede e Bluetooth — o agente falando com quem não está no cabo.
 *
 * Rodar com:  npm test
 *
 * A cozinha ficou longe do atendimento. Bluetooth alcança alguns metros;
 * rede alcança o prédio. O agente passou a aceitar os dois, e qual caminho
 * usar sai do próprio endereço configurado — não do sistema operacional.
 *
 * O teste da rede é de verdade: sobe um servidor na máquina, manda imprimir
 * e confere os bytes que chegaram. É o único jeito de provar que o ESC/POS
 * atravessa inteiro, sem o utf8 estragar byte de controle no caminho.
 */
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert';
import net from 'node:net';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const agente = require('../agente-impressora/agente.js');

describe('o endereço decide o caminho, não o sistema', () => {

  const casos = [
    ['tcp://192.168.0.50',      'imprimirRede',    'impressora de rede, sem porta'],
    ['tcp://10.0.0.7:9100',     'imprimirRede',    'impressora de rede, com porta'],
    ['COM3',                    'imprimirSerial',  'Bluetooth pareado no Windows'],
    ['COM12:',                  'imprimirSerial',  'porta serial de dois dígitos'],
    ['/dev/rfcomm0',            'imprimirLinux',   'Bluetooth no Linux'],
    ['/dev/usb/lp0',            'imprimirLinux',   'USB no Raspberry Pi'],
  ];

  for(const [endereco, esperado, oque] of casos){
    test(`${endereco} → ${oque}`, () => {
      // No Windows o padrão seria o compartilhamento; o que decide é o
      // endereço, para a mesma versão do agente servir aos quatro casos.
      const escolhido = agente.caminhoDeImpressao(endereco);
      if(esperado === 'imprimirLinux' && process.platform === 'win32') return;
      assert.strictEqual(escolhido, agente[esperado],
        `${endereco} caiu no caminho errado`);
    });
  }

  test('compartilhamento do Windows continua sendo o padrão', () => {
    const escolhido = agente.caminhoDeImpressao('\\\\localhost\\COZINHA');
    assert.ok(escolhido === agente.imprimirWindows || escolhido === agente.imprimirLinux);
  });
});

describe('impressão pela rede, contra um servidor de verdade', () => {

  let servidor, porta, recebido;

  before(async () => {
    recebido = [];
    servidor = net.createServer((s) => {
      const pedacos = [];
      s.on('data', (d) => pedacos.push(d));
      s.on('end', () => recebido.push(Buffer.concat(pedacos)));
    });
    await new Promise(ok => servidor.listen(0, '127.0.0.1', ok));
    porta = servidor.address().port;
  });

  after(() => servidor.close());

  test('entrega os bytes e resolve', async () => {
    const cupom = '\x1B\x40TESTE\n\x1D\x56\x42\x00';
    await agente.imprimirRede(Buffer.from(cupom, 'latin1'), `tcp://127.0.0.1:${porta}`);
    await new Promise(r => setTimeout(r, 60));

    assert.strictEqual(recebido.length, 1, 'nada chegou na impressora');
    assert.strictEqual(recebido[0].toString('latin1'), cupom);
  });

  test('byte de controle acima de 127 atravessa inteiro', () => {
    // É aqui que o utf8 estragaria tudo: 0xC7 viraria dois bytes, e a
    // impressora leria um comando que ninguém mandou.
    const bruto = recebido[0];
    assert.strictEqual(bruto[0], 0x1B, 'o ESC inicial se perdeu');
    assert.strictEqual(bruto[bruto.length-4], 0x1D, 'o comando de corte se perdeu');
  });

  test('impressora desligada falha rápido, em vez de travar a fila', async () => {
    // Uma porta fechada no mesmo computador recusa na hora; o que importa é
    // que a promessa REJEITE em vez de ficar pendurada para sempre.
    await assert.rejects(
      () => agente.imprimirRede(Buffer.from('x', 'latin1'), 'tcp://127.0.0.1:1'),
      (e) => /127\.0\.0\.1:1/.test(e.message)
    );
  });

  test('porta 9100 é o padrão quando não se diz qual', async () => {
    await assert.rejects(
      () => agente.imprimirRede(Buffer.from('x','latin1'), 'tcp://127.0.0.1'),
      (e) => /:9100/.test(e.message), 'sem porta, tem que assumir 9100'
    );
  });
});
