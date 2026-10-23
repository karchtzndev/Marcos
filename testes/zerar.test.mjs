/**
 * O "Zerar sistema" — o botão que a loja aperta uma vez, antes de abrir.
 *
 * Rodar com:  npm test
 *
 * Ele prometia apagar "pedidos, faturamento e clientes" e deixava o
 * faturamento intacto: o caixa mora em store/cashflow, que não estava na
 * lista de limpeza. Quem zerasse antes de abrir de verdade começaria com o
 * dinheiro dos testes no movimento — e descobriria no primeiro fechamento,
 * procurando um erro que não existe.
 *
 * É um botão de uso único e irreversível. Se ele mentir, mente uma vez só e
 * de um jeito caro.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const PAINEL = readFileSync('gerencial/index.html', 'utf8');
const BLOCO = PAINEL.slice(PAINEL.indexOf('ÚLTIMA CONFIRMAÇÃO'),
                           PAINEL.indexOf('Dados zerados ✓'));

describe('o que o zerar apaga', () => {

  test('limpa tudo que os testes enchem', () => {
    for(const col of ['orders','stats','customers','closings','calls',
                      'printQueue','visitas','mensagens','acessos','errorLog']){
      assert.ok(BLOCO.includes(`'${col}'`), `ficou de fora: ${col}`);
    }
  });

  test('apaga o faturamento — que era a promessa quebrada', () => {
    assert.ok(/'cashflow',\s*'list'/.test(BLOCO),
      'o movimento do caixa continua sendo prometido e nao apagado');
  });

  test('zera os tempos de preparo medidos nos testes', () => {
    // Senão a previsão que o cliente vê no site nasce torta, calculada em
    // cima de pedidos que nunca existiram.
    assert.ok(/'tempoPreparo',\s*'amostras'/.test(BLOCO));
  });

  test('o aviso diz a verdade sobre o que apaga e o que preserva', () => {
    assert.ok(BLOCO.includes('NÃO TOCA'), 'precisa dizer o que sobrevive');
    for(const guardar of ['cardápio','equipe','cupons','estoque']){
      assert.ok(BLOCO.toLowerCase().includes(guardar),
        `o aviso nao tranquiliza sobre: ${guardar}`);
    }
  });

  test('uma coleção que resiste não aborta a limpeza inteira', () => {
    // Regra não publicada faz uma recusa. Sem isto, o sistema ficaria limpo
    // pela metade e o botão diria que deu certo.
    assert.ok(/catch\(e\)\{ naoDeu\.push\(col\)/.test(BLOCO),
      'cada colecao precisa falhar por conta propria');
    assert.ok(BLOCO.includes('mas isto resistiu'),
      'e o resultado precisa dizer o que ficou para tras');
  });

  test('não apaga a configuração da loja', () => {
    // Apagar menu, users ou features transformaria o reset num desastre.
    for(const sagrado of ["'menu'", "'users'", "'features'", "'info'", "'cupons'", "'inventory'"]){
      assert.ok(!BLOCO.includes(sagrado),
        `${sagrado} nao pode entrar na limpeza: e configuracao, nao dado de teste`);
    }
  });
});
