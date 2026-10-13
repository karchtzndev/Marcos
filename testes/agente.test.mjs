/**
 * Disputa pela fila de impressão, contra o emulador do Firestore.
 *
 * Rodar com:  npm test
 *
 * O agente pode rodar em dois aparelhos ao mesmo tempo (PC e Raspberry Pi),
 * um servindo de reserva para o outro. Os dois recebem o MESMO cupom no mesmo
 * instante — o que torna a reivindicação a peça que decide entre "reserva
 * funcionando" e "cupom saindo dobrado em toda comanda".
 */
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';

// Pelo require, e não por import: o agente é CommonJS, e o mesmo pacote
// carregado nos dois sistemas vira duas instâncias separadas — o objeto criado
// de um lado não é reconhecido pelas funções do outro.
const require = createRequire(import.meta.url);
const { reivindicar, reivindicarPreso, devolver } = require('../agente-impressora/agente.js');
const { initializeApp, deleteApp } = require('firebase/app');
const { getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc } = require('firebase/firestore');
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } = require('firebase/auth');

let app, db, env;
let n = 0;
const novoCupom = async (dados) => {
  const id = 'cupom' + (++n);
  await setDoc(doc(db, 'printQueue', id), { escpos: 'x', vias: 1, ...dados });
  return id;
};
const ler = async (id) => (await getDoc(doc(db, 'printQueue', id))).data();

// Autentica de verdade, como o agente faz em produção, e roda contra as regras
// reais. Assim o teste prova a cadeia inteira: se a conta da impressora um dia
// perder permissão de mexer na fila, isto quebra antes de chegar na loja.
before(async () => {
  app = initializeApp({ projectId: 'markin-teste', apiKey: 'falsa' }, 'agente-teste');
  db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);

  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const cred = await createUserWithEmailAndPassword(auth, 'impressora@teste.local', 'senha-de-teste');

  // Criar funcionário é coisa de gerente, então o cadastro em si entra com as
  // regras desligadas — equivale a você criar a conta da impressora no painel.
  env = await initializeTestEnvironment({
    projectId: 'markin-teste',
    firestore: { host: '127.0.0.1', port: 8080 },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc(`users/${cred.user.uid}`)
      .set({ name: 'Impressora', role: 'funcionario', active: true, perms: [] });
  });
});

after(async () => { await deleteApp(app); await env?.cleanup(); });

describe('dois agentes disputando o mesmo cupom', () => {

  test('só um ganha — é isto que impede cupom dobrado', async () => {
    const id = await novoCupom({ status: 'pendente' });

    // Os dois exatamente ao mesmo tempo, como acontece na prática: a escuta
    // do Firestore entrega o documento aos dois no mesmo instante.
    const [pc, pi] = await Promise.all([
      reivindicar(db, id, 'PC-do-caixa'),
      reivindicar(db, id, 'Raspberry'),
    ]);

    assert.strictEqual([pc, pi].filter(Boolean).length, 1, 'exatamente um agente deve ganhar');
    const d = await ler(id);
    assert.strictEqual(d.status, 'imprimindo');
    assert.ok(['PC-do-caixa','Raspberry'].includes(d.agente));
  });

  test('dez tentativas simultâneas continuam dando um vencedor', async () => {
    const id = await novoCupom({ status: 'pendente' });
    const r = await Promise.all(
      Array.from({length:10}, (_,i) => reivindicar(db, id, 'agente'+i))
    );
    assert.strictEqual(r.filter(Boolean).length, 1);
  });

  test('cupom já impresso não é reivindicado de novo', async () => {
    const id = await novoCupom({ status: 'impresso' });
    assert.strictEqual(await reivindicar(db, id, 'PC'), false);
  });
});

describe('agente que morre no meio da impressão', () => {

  test('cupom preso há muito tempo volta para a fila', async () => {
    // Quem reivindicou caiu: queda de energia, cabo arrancado. Sem o resgate,
    // este pedido nunca sairia — e a reserva não teria servido para nada.
    const id = await novoCupom({
      status: 'imprimindo', agente: 'PC-que-caiu',
      desde: new Date(Date.now() - 5*60*1000).toISOString(),
    });

    assert.strictEqual(await reivindicarPreso(db, id, 120000), true);
    assert.strictEqual((await ler(id)).status, 'pendente');
  });

  test('cupom imprimindo agora NÃO é roubado do outro agente', async () => {
    // Se o limite fosse frouxo, o segundo agente arrancaria o cupom das mãos
    // do primeiro no meio da impressão — e aí sim sairia dobrado.
    const id = await novoCupom({
      status: 'imprimindo', agente: 'Raspberry',
      desde: new Date().toISOString(),
    });

    assert.strictEqual(await reivindicarPreso(db, id, 120000), false);
    assert.strictEqual((await ler(id)).status, 'imprimindo');
  });

  test('falha ao imprimir devolve o cupom em vez de perdê-lo', async () => {
    const id = await novoCupom({ status: 'imprimindo', agente: 'PC' });
    await devolver(db, id);
    const d = await ler(id);
    assert.strictEqual(d.status, 'pendente');
    assert.strictEqual(d.agente, null);
  });
});
