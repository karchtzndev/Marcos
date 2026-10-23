/**
 * Contas da equipe — e a conta que não é de gente.
 *
 * Rodar com:  npm test
 *
 * O agente de impressão entra no sistema como um funcionário, com login
 * próprio e ZERO permissão. Isso é o objetivo, não um descuido: é o que faz
 * o computador da loja, se for invadido, não enxergar caixa nem cadastro de
 * cliente.
 *
 * Só que o painel recusava criar conta sem permissão nenhuma — a mensagem
 * mandava "selecionar ao menos uma". Quem seguisse o conselho daria ao PC da
 * loja acesso que ele não precisa; quem não seguisse ficava sem a conta. E
 * sem a conta o agente nunca entra, e o painel mostra só "Nenhum agente
 * conectado", sem dizer que a conta nem existe. Foi o que aconteceu.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const PAINEL = readFileSync('gerencial/index.html', 'utf8');

function extrair(nome){
  const i = PAINEL.indexOf('function ' + nome + '(');
  assert.notStrictEqual(i, -1, `não achei ${nome}`);
  let j = PAINEL.indexOf('{', i), n = 0;
  for(let k = j; k < PAINEL.length; k++){
    if(PAINEL[k] === '{') n++;
    else if(PAINEL[k] === '}' && --n === 0) return PAINEL.slice(i, k + 1);
  }
}

// ALL_TABS e ROLE_PRESETS saem do próprio arquivo, não copiados para cá.
const ALL_TABS = JSON.parse(
  PAINEL.match(/const ALL_TABS = (\[[^\]]+\])/)[1].replace(/'/g, '"')
);
const inicioPresets = PAINEL.indexOf('const ROLE_PRESETS = {');
const fimPresets = PAINEL.indexOf('\n  };', inicioPresets) + 4;
const ROLE_PRESETS = new Function('ALL_TABS',
  PAINEL.slice(inicioPresets, fimPresets) + '\n return ROLE_PRESETS;')(ALL_TABS);

const permsOf = new Function('ALL_TABS', 'ROLE_PRESETS',
  extrair('permsOf') + '\n return permsOf;')(ALL_TABS, ROLE_PRESETS);

describe('a conta do agente de impressão', () => {

  test('existe uma função própria para ela, com zero permissão', () => {
    assert.ok(ROLE_PRESETS.impressora, 'faltou a função "impressora"');
    assert.deepStrictEqual(ROLE_PRESETS.impressora.perms, [],
      'a conta do agente não pode vir com permissão nenhuma');
  });

  test('ela continua com zero permissão ao ser lida de volta', () => {
    // Aqui mora uma armadilha: permsOf tem um atalho antigo que devolve
    // ['pedidos','mesas','estoque'] para cadastro sem perms. Se a função da
    // impressora caísse nele, o PC da loja ganharia acesso aos pedidos.
    assert.deepStrictEqual(permsOf({ role: 'impressora', perms: [] }), []);
    assert.deepStrictEqual(permsOf({ role: 'impressora' }), []);
  });

  test('o painel deixa criar conta sem permissão SÓ para ela', () => {
    assert.ok(/perms\.length === 0 && role !== 'impressora'/.test(PAINEL),
      'a trava precisa abrir exceção para a função impressora, e só para ela');
  });

  test('a função aparece na lista de escolha', () => {
    assert.ok(PAINEL.includes('<option value="impressora">'),
      'sem a opção no formulário, a função existe mas ninguém consegue escolher');
  });
});

describe('as outras funções continuam com acesso', () => {

  test('gerente vê tudo', () => {
    assert.deepStrictEqual(permsOf({ role: 'gerente' }), ALL_TABS);
  });

  test('nenhuma função de gente ficou sem permissão', () => {
    for(const [chave, preset] of Object.entries(ROLE_PRESETS)){
      if(chave === 'impressora' || chave === 'custom') continue;
      assert.ok(preset.perms.length > 0, `a função ${chave} ficou sem acesso a nada`);
    }
  });
});
