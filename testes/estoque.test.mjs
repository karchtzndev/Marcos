/**
 * A lista de estoque que a loja usa para começar.
 *
 * Rodar com:  npm test
 *
 * É um botão que escreve direto na operação. Se ele apagar o que já existe,
 * ou duplicar item, ou chutar quantidade, o estrago aparece no alerta de
 * estoque baixo — que passa a mentir, e ninguém confere um alerta que mente.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const PAINEL = readFileSync('gerencial/index.html', 'utf8');

const LISTA = new Function(
  PAINEL.slice(PAINEL.indexOf('const ESTOQUE_PADRAO = ['),
               PAINEL.indexOf('];', PAINEL.indexOf('const ESTOQUE_PADRAO = [')) + 2)
  + '\n return ESTOQUE_PADRAO;')();

describe('a lista', () => {

  test('tem item suficiente para uma hamburgueria de verdade', () => {
    assert.ok(LISTA.length >= 25, `só ${LISTA.length} itens`);
  });

  test('nenhum nome repetido', () => {
    const vistos = new Set(LISTA.map(i => i.name.toLowerCase()));
    assert.strictEqual(vistos.size, LISTA.length, 'tem nome repetido na própria lista');
  });

  test('toda unidade é uma das que o formulário aceita', () => {
    // Unidade fora da lista aparece quebrada na tela e o passo de somar e
    // subtrair erra: o código usa a unidade para decidir se anda de 1 em 1
    // ou de 0,5 em 0,5.
    const aceitas = ['un','kg','g','l','pct'];
    for(const i of LISTA){
      assert.ok(aceitas.includes(i.unit), `${i.name}: unidade "${i.unit}" não existe`);
    }
  });

  test('todo item tem mínimo maior que zero', () => {
    // Mínimo zero nunca dispara alerta: o item acabaria em silêncio.
    for(const i of LISTA){
      assert.ok(Number(i.min) > 0, `${i.name} sem estoque mínimo`);
    }
  });

  test('cobre o que o cardápio da loja exige', () => {
    // Não é lista genérica: tem cupim por causa da croqueta, mussarela por
    // causa do dadinho e frango por causa do Prime Chicken.
    const nomes = LISTA.map(i => i.name.toLowerCase()).join(' | ');
    for(const esperado of ['pão', 'hambúrguer de carne', 'frango', 'bacon',
                           'cupim', 'mussarela', 'cheddar', 'batata',
                           'refrigerante', 'embalagem']){
      assert.ok(nomes.includes(esperado), `faltou na lista: ${esperado}`);
    }
  });
});

describe('como ela entra no sistema', () => {

  const fonte = PAINEL.slice(PAINEL.indexOf('async function semearEstoque'),
                             PAINEL.indexOf("document.getElementById('addStockBtn')"));

  test('entra com quantidade zero', () => {
    // Chutar quantidade é pior que não ter: o alerta de estoque baixo passa
    // a mentir, e alerta que mente ninguém confere.
    assert.ok(/qty:\s*0\b/.test(fonte), 'a quantidade tem que nascer zero');
  });

  test('não duplica o que já existe', () => {
    assert.ok(fonte.includes('jaTem.has(normalizarNome(i.name))'),
      'sem isso, apertar duas vezes dobra o estoque inteiro');
  });

  test('compara ignorando acento e caixa', () => {
    // Ancorado no proprio inicio da declaracao: procurar '.trim()' solto
    // acha a primeira ocorrencia do arquivo inteiro, que e outra funcao.
    const ini = PAINEL.indexOf('const normalizarNome =');
    const norm = new Function(
      PAINEL.slice(ini, PAINEL.indexOf(';', ini) + 1) + '\n return normalizarNome;')();
    assert.strictEqual(norm('Pão de hambúrguer'), norm('pao  de  HAMBURGUER'),
      '"Pao" e "Pão" tem que contar como o mesmo item');
  });

  test('grava de uma vez só, com arrayUnion', () => {
    // Trinta chamadas separadas poderiam parar no meio e deixar a lista pela
    // metade. E reescrever o vetor inteiro é a corrida que já custou venda
    // neste sistema.
    assert.ok(fonte.includes('arrayUnion(...novos)'));
    assert.ok(!/\.set\(\{list:\s*novos/.test(fonte), 'não pode sobrescrever a lista');
  });

  test('pergunta antes e diz quantos vai adicionar', () => {
    assert.ok(fonte.includes('confirm('));
    assert.ok(fonte.includes('${novos.length} itens'));
  });
});
