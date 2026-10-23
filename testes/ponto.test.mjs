/**
 * Ponto da carne — e o remendo aplicado pela metade.
 *
 * Rodar com:  npm test
 *
 * Escrevendo este recurso eu apliquei metade de uma alteração: o painel
 * passou a USAR PONTOS, PONTO_PADRAO e pedePonto sem que nenhum dos três
 * existisse ali. O arquivo continua sendo JavaScript válido — o erro só
 * aparece quando alguém abre o lançamento manual, na loja, com o cliente
 * esperando. Nenhuma verificação de sintaxe pega isso.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const SITE   = readFileSync('index.html', 'utf8');
const PAINEL = readFileSync('gerencial/index.html', 'utf8');

const define = (html, nome) =>
  new RegExp(`(const|let|function)\\s+${nome}\\b`).test(html);
const usa = (html, nome) =>
  new RegExp(`\\b${nome}\\b`).test(html);

describe('o que uma tela usa, ela precisa definir', () => {

  // Nomes que vivem nas duas telas. Usar sem definir não quebra a sintaxe:
  // quebra na mão de quem está atendendo.
  const COMPARTILHADOS = ['PONTOS', 'PONTO_PADRAO', 'pedePonto',
                          'money', 'escapeHtml', 'localDateStr', 'statsKey'];

  for(const [nome, html] of [['site', SITE], ['painel', PAINEL]]){
    test(`${nome}: nada é usado sem estar definido`, () => {
      const faltando = COMPARTILHADOS.filter(n => usa(html, n) && !define(html, n));
      assert.deepStrictEqual(faltando, [],
        `usa mas não define: ${faltando.join(', ')} — estoura na hora do uso`);
    });
  }
});

describe('os pontos são os mesmos nas duas telas', () => {

  const lista = (html) => {
    const m = html.match(/const PONTOS = (\[[^\]]+\])/);
    assert.ok(m, 'não achei a lista de pontos');
    return JSON.parse(m[1].replace(/'/g, '"'));
  };

  test('mesma lista, mesma ordem', () => {
    // Divergir aqui é silencioso: o site manda "Ao ponto", o balcão manda
    // outra palavra, e a chapa recebe duas linguagens para a mesma coisa.
    assert.deepStrictEqual(lista(SITE), lista(PAINEL));
  });

  test('são os três usuais', () => {
    assert.deepStrictEqual(lista(SITE), ['Mal passado', 'Ao ponto', 'Bem passado']);
  });

  test('o padrão é um dos três', () => {
    for(const html of [SITE, PAINEL]){
      const padrao = html.match(/const PONTO_PADRAO = '([^']+)'/)[1];
      assert.ok(lista(html).includes(padrao), `padrão fora da lista: ${padrao}`);
    }
  });
});

describe('dois pontos diferentes são duas linhas', () => {

  const monta = (html, nome) => {
    const i = html.indexOf(`const ${nome} = `);
    const fim = html.indexOf(';', html.indexOf('=>', i));
    return new Function('return ' + html.slice(html.indexOf('(', i), fim))();
  };

  test('o ponto entra na chave que junta item repetido', () => {
    // Sem isso, um mal passado e um bem passado do mesmo lanche viram "2x" de
    // um ponto só — e um dos dois sai errado da chapa.
    for(const [nome, html, fn] of [['site', SITE, 'chaveItem'], ['painel', PAINEL, 'chaveMo']]){
      const chave = monta(html, fn);
      assert.notStrictEqual(chave('p1','','Mal passado'), chave('p1','','Bem passado'),
        `${nome}: pontos diferentes geram a MESMA chave`);
      assert.strictEqual(chave('p1','','Ao ponto'), chave('p1','','Ao ponto'),
        `${nome}: o mesmo ponto tem que somar`);
    }
  });
});

describe('o ponto chega onde a cozinha lê', () => {

  test('sai na comanda impressa', () => {
    assert.ok(/if\(p\.ponto\) html \+= `<div class="p-addon">/.test(PAINEL),
      'sem isso a chapa nunca fica sabendo');
  });

  test('aparece na tela da cozinha', () => {
    assert.ok(/if\(p\.ponto\) h \+=/.test(PAINEL));
  });

  test('viaja junto com o pedido, das duas origens', () => {
    assert.ok(SITE.includes('ponto:c.ponto || ""'), 'pedido pelo site');
    assert.ok(PAINEL.includes('ponto:i.ponto || ""'), 'pedido pelo balcão');
  });

  test('vai no WhatsApp que o cliente recebe', () => {
    assert.ok(SITE.includes('i.ponto ? " [" + i.ponto + "]" : ""'));
  });
});
