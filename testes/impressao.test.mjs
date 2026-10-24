/**
 * O que sai na térmica.
 *
 * Rodar com:  npm test
 *
 * Impressora térmica não entende imagem nem HTML: entende bytes. Um byte a
 * mais ou a menos no logo e ela imprime lixo por páginas, ou trava esperando
 * dados que não vêm — com a cozinha parada, esperando a comanda. Nada disso
 * aparece olhando a tela: só no papel.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const PAINEL = readFileSync('gerencial/index.html', 'utf8');

describe('o logo em pontos', () => {

  const b64 = (PAINEL.match(/const LOGO_TERMICA_B64 = '([A-Za-z0-9+/=]+)'/) || [])[1];

  test('está embutido no painel', () => {
    assert.ok(b64, 'não achei o logo — a impressão sairia sem ele, calada');
  });

  test('é um comando de imagem válido, com o tamanho que promete', () => {
    const b = Buffer.from(b64, 'base64');
    // GS v 0: 1D 76 30 m xL xH yL yH, depois os pontos
    assert.deepStrictEqual([...b.subarray(0,4)], [0x1D, 0x76, 0x30, 0x00],
      'cabeçalho errado: a impressora leria os pontos como texto');
    const bytesPorLinha = b[4] | (b[5] << 8);
    const linhas        = b[6] | (b[7] << 8);
    assert.strictEqual(b.length - 8, bytesPorLinha * linhas,
      'a quantidade de pontos não bate com o tamanho declarado — ' +
      'faltando, a impressora fica esperando o resto e trava');
    assert.ok(bytesPorLinha * 8 <= 384,
      'mais largo que o papel de 58 mm: sairia cortado');
    assert.ok(linhas > 20 && linhas < 400, 'altura fora do razoável: ' + linhas);
  });

  test('tem tinta de verdade — não é uma folha em branco', () => {
    const b = Buffer.from(b64, 'base64').subarray(8);
    const pretos = b.reduce((s, byte) => s + byte.toString(2).split('1').length - 1, 0);
    const proporcao = pretos / (b.length * 8);
    assert.ok(proporcao > 0.08, 'quase tudo branco: o logo não apareceria');
    assert.ok(proporcao < 0.75, 'quase tudo preto: sairia um borrão, e gastando a cabeça térmica');
  });

  test('dá para desligar', () => {
    // Comanda de cozinha ninguém guarda; o papel gasto pode não compensar.
    assert.ok(/features\.filaLogo === false/.test(PAINEL), 'falta a saída de desligar o logo');
    assert.ok(PAINEL.includes('id="filaLogo"'), 'e o interruptor na tela');
    assert.ok(/filaLogo: document\.getElementById\('filaLogo'\)/.test(PAINEL), 'e gravar a escolha');
  });
});

describe('branco sobre preto não pode vazar', () => {

  test('toda faixa invertida é fechada', () => {
    // Se o inverso ficar ligado, TODO o resto do cupom sai branco sobre preto:
    // ilegível, lento, e queimando a cabeça térmica à toa.
    const conversor = PAINEL.slice(PAINEL.indexOf('function htmlParaEscPos'));
    const fim = conversor.indexOf('\n  }\n');
    const corpo = conversor.slice(0, fim);
    const abre  = (corpo.match(/ESC\.inverso\b/g) || []).length;
    const fecha = (corpo.match(/ESC\.inversoOff\b/g) || []).length;
    assert.strictEqual(abre, fecha,
      `${abre} faixas abertas para ${fecha} fechadas`);
  });

  test('o corpo volta ao tamanho normal depois de cada destaque', () => {
    const corpo = PAINEL.slice(PAINEL.indexOf('function htmlParaEscPos'));
    const fim = corpo.indexOf('\n  }\n');
    const trecho = corpo.slice(0, fim);
    const grandes = (trecho.match(/ESC\.(grande|medio)\b/g) || []).length;
    const normais = (trecho.match(/ESC\.normal\b/g) || []).length;
    assert.ok(normais >= grandes,
      `${grandes} trocas de corpo para ${normais} voltas ao normal: ` +
      'o resto do cupom sairia gigante');
  });
});

describe('rajada de teste', () => {

  const fonte = PAINEL.slice(PAINEL.indexOf('function comandasDeTeste'),
                             PAINEL.indexOf('async function enviarRajadaTeste'));

  test('são dez comandas', () => {
    const casos = (fonte.match(/oque: '/g) || []).length;
    assert.strictEqual(casos, 10, 'a rajada precisa ter dez casos');
  });

  test('cada uma mira um jeito diferente de quebrar', () => {
    // Dez cupons iguais não provam nada. O que derruba impressão térmica é
    // nome comprido, acento, muitos itens e tudo chegando junto.
    for(const alvo of ['nome comprido', 'acentuacao', 'muitos itens',
                       'endereco longo', 'observacao gigante', 'adicionais',
                       'valor alto', 'mesa', 'sem cliente']){
      assert.ok(fonte.includes(alvo), `faltou o caso: ${alvo}`);
    }
  });

  test('o teste de acento tem acento de verdade', () => {
    // Se os casos forem escritos sem acento, o teste passa e não testa nada —
    // justamente o byte que o latin1 erra se alguém trocar a codificação.
    assert.ok(/[áàâãéêíóôõúüç]/i.test(fonte), 'nenhum acento nos casos de teste');
  });

  test('os papéis saem numerados, para dar para conferir', () => {
    const envio = PAINEL.slice(PAINEL.indexOf('async function enviarRajadaTeste'));
    assert.ok(envio.includes('TESTE ${i+1} DE ${lista.length}'),
      'sem numero no papel nao da para saber qual faltou');
    assert.ok(/Rajada \$\{i\+1\}\/\$\{lista\.length\}/.test(envio));
  });

  test('pergunta antes, porque gasta papel', () => {
    const envio = PAINEL.slice(PAINEL.indexOf('async function enviarRajadaTeste'));
    assert.ok(envio.includes('confirm('), 'dez cupons de uma vez sem avisar e maldade');
  });
});

describe('impressão direta no Android, pelo RawBT', () => {

  const fonte = PAINEL.slice(PAINEL.indexOf('function enviarParaRawBT'),
                             PAINEL.indexOf('rawbt:base64,') + 40);

  test('não usa TextEncoder — ele codifica em utf8', () => {
    // utf8 transforma todo byte acima de 127 em DOIS bytes. Com texto sem
    // acento isso passa despercebido, porque ASCII sai igual nos dois. Com o
    // logo, que é imagem em pontos e usa a faixa inteira de 0 a 255, cada
    // ponto escuro viraria dois bytes: a impressora leria o tamanho errado
    // da imagem e ficaria esperando dados que nunca chegam.
    // Mira a CHAMADA, nao a palavra: o comentario do conserto cita o nome
    // para explicar o que deu errado, e nao pode derrubar o teste.
    assert.ok(!/new TextEncoder\(\)/.test(fonte),
      'TextEncoder aqui corrompe a imagem e todo byte acima de 127');
  });

  test('trata cada caractere como um byte, igual ao agente', () => {
    assert.ok(/charCodeAt\(i\) & 0xFF/.test(fonte),
      'o caractere ja E o byte: mascarar em 0xFF e o que garante isso');
  });

  test('na prática: os bytes do logo sobrevivem', () => {
    // Reproduz a conversão com uma sequência que tem bytes dos dois lados de
    // 127, que é exatamente o caso do raster.
    const cru = '\x1D\x76\x30\x00\x14\x00\x20\x00\xFF\x80\x7F\x01';
    let bin = '';
    for(let i = 0; i < cru.length; i++) bin += String.fromCharCode(cru.charCodeAt(i) & 0xFF);
    assert.strictEqual(bin.length, cru.length, 'nenhum byte pode virar dois');

    // E o que o jeito antigo faria, para o teste mostrar a diferença:
    const utf8 = Buffer.from(cru, 'utf8');
    assert.ok(utf8.length > cru.length,
      'confirma que o utf8 inchava a imagem — e por isso quebrava');
  });
});
