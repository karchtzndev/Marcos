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
