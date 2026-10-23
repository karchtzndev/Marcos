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
const {
  lerConfig,
  reivindicar, reivindicarPreso, devolver,
  marcarMinhaVia, jaImprimiAqui, fecharAntigos, chaveAgente,
} = require('../agente-impressora/agente.js');
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

/* ==================================================================
   MODO CÓPIA — a mesma comanda saindo em mais de uma impressora
   ================================================================== */
describe('modo cópia', () => {

  test('dois agentes marcam a própria via sem apagar a do outro', async () => {
    // É o mesmo erro que tirou as estatísticas do dashboard hoje: regravar o
    // mapa inteiro faria o segundo agente sumir com a marca do primeiro, e aí
    // uma das impressoras repetiria o cupom para sempre.
    const id = await novoCupom({ status: 'pendente', criadoEm: new Date().toISOString() });

    await Promise.all([
      marcarMinhaVia(db, id, 'Cozinha'),
      marcarMinhaVia(db, id, 'Balcao'),
    ]);

    const d = await ler(id);
    assert.ok(d.impressoPor.Cozinha, 'a via da cozinha tem que estar marcada');
    assert.ok(d.impressoPor.Balcao,  'a via do balcão tem que estar marcada');
    assert.strictEqual(d.status, 'pendente', 'ninguém fecha o cupom no modo cópia');
  });

  test('agente que já tirou a via dele não imprime de novo', async () => {
    const dados = { impressoPor: { Cozinha: '2026-10-13T00:00:00.000Z' } };
    assert.strictEqual(jaImprimiAqui(dados, 'Cozinha'), true);
    assert.strictEqual(jaImprimiAqui(dados, 'Balcao'), false);
    assert.strictEqual(jaImprimiAqui({}, 'Cozinha'), false);
  });

  test('nome com espaço e acento vira chave válida de campo', async () => {
    // Firestore recusa . [ ] * / ` em nome de campo — sem isto, um agente
    // chamado "Pi da cozinha" derrubaria a gravação em silêncio.
    const id = await novoCupom({ status: 'pendente', criadoEm: new Date().toISOString() });
    await marcarMinhaVia(db, id, 'Pi da cozinha (fundo)');
    const d = await ler(id);
    assert.ok(d.impressoPor[chaveAgente('Pi da cozinha (fundo)')]);
  });

  test('cupom velho sai da fila; o recente continua esperando', async () => {
    const velho = await novoCupom({ status: 'pendente',
      criadoEm: new Date(Date.now() - 30*60000).toISOString() });
    const novo  = await novoCupom({ status: 'pendente',
      criadoEm: new Date().toISOString() });

    await fecharAntigos(db, 10);

    assert.strictEqual((await ler(velho)).status, 'impresso', 'velho devia ter sido fechado');
    assert.strictEqual((await ler(novo)).status, 'pendente',
      'o recente precisa continuar na fila — a impressora que estava desligada ainda vai copiar');
  });
});

/* ==================================================================
   O CARACTERE INVISÍVEL
   O instalador gravava o config.json pelo PowerShell do Windows, que
   cola três bytes invisíveis (BOM) no começo do arquivo. JSON.parse
   recusa, e a mensagem — "Unexpected token" — não parece nada com "há
   um caractere invisível aqui". O agente morria na primeira linha, a
   tarefa reiniciava, e na loja isso aparecia só como a tarja vermelha
   de sempre.

   O instalador foi corrigido, mas o BOM pode voltar por outro caminho:
   basta alguém abrir o config.json no Bloco de Notas e salvar.
   ================================================================== */
describe('config.json salvo no Windows', () => {

  const BOM = '\uFEFF';
  const bom = JSON.stringify({ nome: 'cozinha', modo: 'copia', usuario: 'a@b.c' });

  test('config com BOM continua sendo lido', () => {
    const c = lerConfig(BOM + bom);
    assert.strictEqual(c.nome, 'cozinha');
    assert.strictEqual(c.usuario, 'a@b.c');
  });

  test('config normal continua sendo lido', () => {
    assert.strictEqual(lerConfig(bom).modo, 'copia');
  });

  test('config realmente quebrado ainda reclama', () => {
    // Engolir o BOM não pode virar engolir erro de verdade: um config
    // digitado errado precisa continuar falhando, e falhando alto.
    assert.throws(() => lerConfig('{isto nao e json'));
  });
});
