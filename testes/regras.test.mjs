/**
 * Testes das regras de segurança do Firestore.
 *
 * Rodar com:  npm test      (sobe o emulador sozinho)
 *
 * Falha de regra é silenciosa em produção — o app engole o erro num .catch()
 * e a gravação simplesmente não acontece. Por isso os casos que já quebraram
 * de verdade estão aqui: para nunca mais quebrarem sem ninguém perceber.
 */
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

const inc = firebase.firestore.FieldValue.increment;

let env;

const GERENTE = 'uid-gerente';
const CAIXA   = 'uid-caixa';     // funcionário só com permissão de caixa

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'markin-teste',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });

  // Perfis da equipe. Escritos com as regras desligadas porque criar conta de
  // funcionário é justamente o que as regras só deixam o gerente fazer.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc(`users/${GERENTE}`).set({ name: 'Eduardo', role: 'gerente', active: true, perms: [] });
    await db.doc(`users/${CAIXA}`).set({ name: 'Ana', role: 'funcionario', active: true, perms: ['caixa'] });
  });
});

after(async () => { await env?.cleanup(); });

const anonimo  = () => env.unauthenticatedContext().firestore();
const gerente  = () => env.authenticatedContext(GERENTE).firestore();
const caixa    = () => env.authenticatedContext(CAIXA).firestore();

const visitaValida = (extra = {}) => ({
  entrada: '2026-09-23T20:00:00.000Z',
  ultimaAtividade: '2026-09-23T20:00:00.000Z',
  aparelho: 'iPhone/iPad',
  origem: 'direto',
  finalizou: false,
  codigoPedido: '',
  expiraEm: new Date(Date.now() + 90 * 86400000),
  ...extra,
});

const erroValido = (extra = {}) => ({
  mensagem: 'TypeError: algo quebrou',
  detalhe: 'stack...',
  pagina: 'cliente',
  quando: '2026-09-23T20:00:00.000Z',
  expiraEm: new Date(Date.now() + 30 * 86400000),
  ...extra,
});

/* ==================================================================
   O QUE QUEBROU EM PRODUÇÃO — estes são os testes que faltavam
   ================================================================== */
describe('regressões que derrubaram gravações em produção', () => {

  test('visita com expiraEm é aceita (TTL de 90 dias)', async () => {
    await assertSucceeds(anonimo().doc('visitas/v1').set(visitaValida()));
  });

  test('visita de retorno à aba, com novaVisitaAposVoltar, é aceita', async () => {
    // Faltava no hasOnly: era por isso que a visita não aparecia no painel
    await assertSucceeds(
      anonimo().doc('visitas/v2').set(visitaValida({ novaVisitaAposVoltar: true }))
    );
  });

  test('registro de erro com expiraEm é aceito (TTL de 30 dias)', async () => {
    await assertSucceeds(anonimo().collection('errorLog').add(erroValido()));
  });

  test('acesso da equipe com expiraEm é aceito (TTL de 180 dias)', async () => {
    await assertSucceeds(caixa().collection('acessos').add({
      uid: CAIXA, nome: 'Ana', funcao: 'funcionario',
      entrada: '2026-09-23T20:00:00.000Z', ultimoSinal: '2026-09-23T20:00:00.000Z',
      saida: null, aparelho: 'Android', tela: '390x844',
      expiraEm: new Date(Date.now() + 180 * 86400000),
    }));
  });
});

/* ==================================================================
   O CADEADO CONTINUA FECHADO — afrouxar hasOnly não pode abrir brecha
   ================================================================== */
describe('proteções que não podem ter sido afrouxadas', () => {

  test('visita com campo inventado continua recusada', async () => {
    await assertFails(anonimo().doc('visitas/v3').set(visitaValida({ qualquerCoisa: 'x' })));
  });

  test('erro com campo inventado continua recusado', async () => {
    await assertFails(anonimo().collection('errorLog').add(erroValido({ injetado: 'x' })));
  });

  test('estranho não lê as visitas', async () => {
    await assertFails(anonimo().doc('visitas/v1').get());
  });

  test('estranho não se promove a gerente', async () => {
    await assertFails(
      env.authenticatedContext('invasor').firestore()
        .doc('users/invasor').set({ name: 'x', role: 'gerente', active: true, perms: [] })
    );
  });

  test('estranho não lê as mensagens dos clientes', async () => {
    await assertFails(anonimo().collection('mensagens').get());
  });
});

/* ==================================================================
   PERMISSÃO POR FUNÇÃO — o que mudou no painel hoje precisa passar
   ================================================================== */
describe('permissões por função', () => {

  test('equipe lança venda no caixa (o arrayUnion do pagamento)', async () => {
    await assertSucceeds(
      caixa().doc('store/cashflow').set({ list: [] }, { merge: true })
    );
  });

  test('funcionário sem "financeiro" não lê o caixa', async () => {
    await assertFails(caixa().doc('store/cashflow').get());
  });

  test('gerente lê o caixa', async () => {
    await assertSucceeds(gerente().doc('store/cashflow').get());
  });

  test('funcionário sem "estoque" não altera o estoque', async () => {
    await assertFails(caixa().doc('store/inventory').set({ list: [] }, { merge: true }));
  });

  test('equipe lê a base de clientes (a escuta dos 500 mais recentes)', async () => {
    await assertSucceeds(gerente().collection('customers').get());
  });

  test('estranho não lê a base de clientes', async () => {
    await assertFails(anonimo().collection('customers').get());
  });
});

/* ==================================================================
   FRAUDE DE FIDELIDADE — contador só sobe de 1 em 1
   ================================================================== */
describe('cadastro de cliente', () => {

  test('primeiro pedido cria o cliente', async () => {
    await assertSucceeds(anonimo().doc('customers/11999990000').set({
      nome: 'João', telefone: '11999990000', endereco: 'Rua A',
      pedidos: 1, gasto: 50, ultimo: '2026-09-23T20:00:00.000Z',
    }));
  });

  test('não dá pra forjar 9999 pedidos e liberar brinde', async () => {
    await assertFails(anonimo().doc('customers/11999990000').update({ pedidos: 9999 }));
  });
});

/* ==================================================================
   GRAVAÇÕES REAIS DO FLUXO DE PEDIDO
   Replicam exatamente o que o código faz, inclusive as chaves com
   ponto e o FieldValue.increment — supor como a regra enxerga isso
   é justamente o erro que já custou caro nesta base.
   ================================================================== */
describe('fluxo do pedido', () => {

  test('estatística do dia é gravada como o app grava', async () => {
    await assertSucceeds(
      anonimo().doc('stats/2026-09-23').set({
        date: '2026-09-23',
        orderCount: inc(1),
        revenue: inc(45.5),
        byType: { mesa: inc(1) },
        products: { 'Bugue do Papai': inc(2) },
      }, { merge: true })
    );
  });

  test('chave com ponto em stats continua recusada', async () => {
    // set() não interpreta ponto como caminho: viraria um campo de nome
    // literal "products.X", que o dashboard não lê. Era o bug original.
    const u = { date: '2026-09-23', orderCount: inc(1), revenue: inc(10) };
    u['products.Bugue do Papai'] = inc(1);
    await assertFails(anonimo().doc('stats/2026-09-24').set(u, { merge: true }));
  });

  test('número do pedido avança de 1 em 1', async () => {
    const ref = anonimo().doc('counters/daily');
    await assertSucceeds(ref.set({ date: '2026-09-23', count: 1 }));
    await assertSucceeds(ref.set({ date: '2026-09-23', count: 2 }));
  });

  test('número volta a 1 quando o dia vira', async () => {
    await assertSucceeds(
      anonimo().doc('counters/daily').set({ date: '2026-09-24', count: 1 })
    );
  });

  test('ninguém reinicia a numeração no meio do turno', async () => {
    // protege contra dois pedidos saírem com o mesmo número na cozinha
    await assertFails(
      anonimo().doc('counters/daily').set({ date: '2026-09-24', count: 1 })
    );
  });

  test('gerente consegue zerar o contador no "Zerar sistema"', async () => {
    await assertSucceeds(
      gerente().doc('counters/daily').set({ date: '2026-09-24', count: 0 })
    );
  });
});
