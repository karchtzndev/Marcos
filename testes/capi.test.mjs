/**
 * Conversions API do Meta — o envio da compra pelo servidor.
 *
 * Rodar com:  npm test
 *
 * Duas coisas aqui não podem dar errado nunca, e nenhuma delas aparece
 * olhando a tela:
 *
 *  1. Um código de pedido inventado NÃO pode virar venda. O endereço é
 *     público; sem essa trava, qualquer um envenenaria a conta de anúncios
 *     com compras falsas e a otimização do Meta aprenderia com lixo.
 *  2. Nada que identifique a pessoa pode sair em texto aberto. Telefone e
 *     nome vão com hash; se um dia alguém mexer no código e esquecer o
 *     hash, o vazamento seria silencioso — ninguém olha o que sai na rede.
 *
 * Nada aqui toca a internet: o fetch é substituído por um de mentira.
 */
import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';

const require = createRequire(import.meta.url);
const handler = require('../api/meta-capi.js');
const { normalizarTelefone, normalizarTexto } = handler.__teste;

const CODIGO = 'MK-ABCDE';
const TELEFONE = '(11) 99999-0000';
const NOME = 'João da Silva';

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

/* --------- resposta de mentira, no formato que a Vercel entrega --------- */
function respostaFalsa(){
  const r = { codigo: 0, corpo: null };
  r.status = (c) => { r.codigo = c; return r; };
  r.json   = (b) => { r.corpo = b; return r; };
  r.setHeader = () => {};
  return r;
}

/* --------- fetch de mentira: Firestore e Graph, sem rede --------- */
let pedidoNoBanco;       // o que o "Firestore" devolve
let enviadoAoMeta;       // o corpo que teria ido para o Graph
const fetchReal = globalThis.fetch;

function instalarFetch(){
  globalThis.fetch = async (url, opcoes) => {
    if(String(url).includes('firestore.googleapis.com')){
      if(!pedidoNoBanco) return { ok: false, status: 404, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({ fields: pedidoNoBanco }) };
    }
    if(String(url).includes('graph.facebook.com')){
      enviadoAoMeta = JSON.parse(opcoes.body);
      return { ok: true, status: 200, json: async () => ({ events_received: 1 }) };
    }
    throw new Error('endereço inesperado no teste: ' + url);
  };
}

// Um pedido como o Firestore REST devolve: valor tipado, não valor cru.
function pedidoFirestore(extra = {}){
  return Object.assign({
    code:         { stringValue: CODIGO },
    customerName: { stringValue: NOME },
    phone:        { stringValue: TELEFONE },
    total:        { doubleValue: 87.4 },
    status:       { stringValue: 'recebido' },
    createdAt:    { stringValue: new Date().toISOString() },
    items: { arrayValue: { values: [
      { mapValue: { fields: { name: {stringValue:'X-Tudo'}, qty: {integerValue:'2'}, price: {doubleValue:30} } } },
      { mapValue: { fields: { name: {stringValue:'Batata'}, qty: {integerValue:'1'}, price: {doubleValue:27.4} } } },
    ] } },
  }, extra);
}

const pedir = (corpo, metodo = 'POST') => handler(
  { method: metodo, body: corpo, headers: { 'user-agent': 'Teste/1.0', 'x-forwarded-for': '200.1.2.3' } },
  respostaFalsa()
);

before(() => {
  process.env.META_CAPI_TOKEN = 'token-de-teste';
  process.env.META_PIXEL_ID   = '1234567890';
  instalarFetch();
});
after(() => { globalThis.fetch = fetchReal; });
beforeEach(() => { pedidoNoBanco = pedidoFirestore(); enviadoAoMeta = null; });

/* ================================================================== */
describe('pedido inventado não vira venda', () => {

  test('código fora do formato é recusado antes de qualquer consulta', async () => {
    for(const ruim of ['', 'qualquer-coisa', 'MK-ABC', 'MK-ABCDEF', 'MK-ABCD1', '../orders/x']){
      const r = await pedir({ code: ruim });
      assert.strictEqual(r.codigo, 400, `deveria recusar: ${JSON.stringify(ruim)}`);
    }
    assert.strictEqual(enviadoAoMeta, null, 'nada pode ter ido para o Meta');
  });

  test('código bem formado mas inexistente não vira evento', async () => {
    pedidoNoBanco = null;
    const r = await pedir({ code: CODIGO });
    assert.strictEqual(r.codigo, 404);
    assert.strictEqual(enviadoAoMeta, null);
  });

  test('pedido de ontem não pode ser reenviado', async () => {
    pedidoNoBanco = pedidoFirestore({
      createdAt: { stringValue: new Date(Date.now() - 30*60*60*1000).toISOString() },
    });
    const r = await pedir({ code: CODIGO });
    assert.strictEqual(r.codigo, 409);
    assert.strictEqual(enviadoAoMeta, null);
  });

  test('pedido cancelado não vira venda', async () => {
    pedidoNoBanco = pedidoFirestore({ status: { stringValue: 'cancelado' } });
    const r = await pedir({ code: CODIGO });
    assert.strictEqual(r.codigo, 409);
    assert.strictEqual(enviadoAoMeta, null);
  });

  test('valor e nome mandados na requisição são IGNORADOS', async () => {
    // O corpo vem do navegador: acreditar nele seria o mesmo que não ter trava.
    await pedir({ code: CODIGO, value: 99999, customerName: 'Invasor', total: 99999 });
    assert.strictEqual(enviadoAoMeta.data[0].custom_data.value, 87.4,
      'o valor tem que ser o do banco, não o da requisição');
  });

  test('só aceita POST', async () => {
    const r = await pedir({ code: CODIGO }, 'GET');
    assert.strictEqual(r.codigo, 405);
  });
});

describe('nada pessoal sai em texto aberto', () => {

  test('telefone e nome vão com hash, e com o hash certo', async () => {
    await pedir({ code: CODIGO });
    const u = enviadoAoMeta.data[0].user_data;

    assert.strictEqual(u.ph, sha('5511999990000'), 'telefone com 55 na frente, só dígitos');
    assert.strictEqual(u.fn, sha('joao'),  'primeiro nome sem acento, minúsculo');
    assert.strictEqual(u.ln, sha('silva'), 'último sobrenome');
    assert.strictEqual(u.external_id, sha('5511999990000'));
    assert.strictEqual(u.country, sha('br'));
  });

  test('o corpo inteiro não contém o telefone nem o nome legíveis', async () => {
    // A rede mais confiável de todas: procurar o dado cru no que saiu.
    await pedir({ code: CODIGO });
    const texto = JSON.stringify(enviadoAoMeta);
    for(const cru of ['99999-0000', '999990000', 'João', 'joao da silva', 'Silva']){
      assert.ok(!texto.includes(cru), `vazou em texto aberto: ${cru}`);
    }
  });

  test('o token nunca aparece na resposta devolvida ao navegador', async () => {
    const r = await pedir({ code: CODIGO });
    assert.ok(!JSON.stringify(r.corpo).includes('token-de-teste'));
  });
});

describe('o evento chega do jeito que o Meta espera', () => {

  test('event_id é o mesmo do pixel do navegador — é o que evita contar duas vezes', async () => {
    await pedir({ code: CODIGO });
    assert.strictEqual(enviadoAoMeta.data[0].event_id, 'mk-' + CODIGO);
    assert.strictEqual(enviadoAoMeta.data[0].event_name, 'Purchase');
    assert.strictEqual(enviadoAoMeta.data[0].action_source, 'website');
  });

  test('itens e valor saem do banco, com as quantidades certas', async () => {
    await pedir({ code: CODIGO });
    const c = enviadoAoMeta.data[0].custom_data;
    assert.strictEqual(c.currency, 'BRL');
    assert.strictEqual(c.value, 87.4);
    assert.strictEqual(c.order_id, CODIGO);
    assert.deepStrictEqual(c.content_ids, ['X-Tudo', 'Batata']);
    assert.deepStrictEqual(c.contents, [
      { id: 'X-Tudo', quantity: 2, item_price: 30 },
      { id: 'Batata', quantity: 1, item_price: 27.4 },
    ]);
  });

  test('IP e navegador vão sem hash, como o Meta exige', async () => {
    await pedir({ code: CODIGO });
    const u = enviadoAoMeta.data[0].user_data;
    assert.strictEqual(u.client_ip_address, '200.1.2.3');
    assert.strictEqual(u.client_user_agent, 'Teste/1.0');
  });
});

describe('sem token configurado, o site não quebra', () => {

  test('responde 503 e não tenta falar com o Meta', async () => {
    const token = process.env.META_CAPI_TOKEN;
    delete process.env.META_CAPI_TOKEN;
    const r = await pedir({ code: CODIGO });
    process.env.META_CAPI_TOKEN = token;

    // 503 é o que o site trata como "desligada", sem registrar falha.
    assert.strictEqual(r.codigo, 503);
    assert.strictEqual(enviadoAoMeta, null);
  });
});

describe('normalização, que é onde o casamento se ganha ou se perde', () => {

  test('telefone recebe o 55 e perde a máscara', () => {
    assert.strictEqual(normalizarTelefone('(11) 99999-0000'), '5511999990000');
    assert.strictEqual(normalizarTelefone('5511999990000'),   '5511999990000');
    assert.strictEqual(normalizarTelefone('11 9999-0000'),    '551199990000');
    assert.strictEqual(normalizarTelefone('123'), '', 'curto demais não é telefone');
  });

  test('nome perde acento, maiúscula e pontuação', () => {
    assert.strictEqual(normalizarTexto('João'), 'joao');
    assert.strictEqual(normalizarTexto("D'Ávila-Souza"), 'davilasouza');
    assert.strictEqual(normalizarTexto('  MARIA  '), 'maria');
  });
});
