/**
 * Conversions API do Meta — o mesmo Purchase, mandado pelo servidor.
 *
 * Por que existe: o pixel no navegador perde venda. Bloqueador de anúncio,
 * iPhone com rastreamento negado, aba fechada antes do script terminar — e a
 * compra aconteceu, mas o Meta nunca soube. Resultado prático na loja: o
 * anúncio parece render menos do que rende, e a otimização do Meta aprende
 * errado, mostrando o anúncio para a gente errada.
 *
 * Como não vira venda contada em dobro: o pixel do navegador já manda o
 * Purchase com eventID 'mk-<código do pedido>'. Esta função manda o MESMO
 * event_id. O Meta junta os dois e conta uma só. Se o navegador falhar, só
 * chega o do servidor — e a venda aparece do mesmo jeito.
 *
 * Contra pedido inventado: o corpo da requisição NÃO é acreditado. Ele traz
 * só o código do pedido; nome, telefone, itens e valor são lidos do banco.
 * Quem quisesse envenenar a conta de anúncios com compras falsas teria que
 * fazer pedidos de verdade na loja.
 *
 * Para ligar, no painel da Vercel (Settings → Environment Variables):
 *   META_CAPI_TOKEN  — token de acesso do Gerenciador de Eventos do Meta
 *   META_PIXEL_ID    — o id do pixel, o mesmo que está em Módulos
 * Sem as duas, a função responde 503 e o site segue com o pixel do navegador
 * como sempre foi. Nada quebra.
 */
const crypto = require('crypto');

const PROJETO = process.env.FIREBASE_PROJECT_ID || 'omarkin-burguer-39bda';
const API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyA-7sy4ox0ErDZAw7prhXYJ3MaSA7G_scY';
const VERSAO_GRAPH = 'v21.0';

// Pedido velho não vira evento: sem isso, alguém com um código antigo poderia
// reenviar a mesma compra para sempre.
const IDADE_MAXIMA_MS = 24 * 60 * 60 * 1000;

/** SHA-256 em hexadecimal, como o Meta exige para dado pessoal. */
function hash(valor) {
  if (!valor) return undefined;
  return crypto.createHash('sha256').update(String(valor)).digest('hex');
}

/** Minúsculas, sem acento e sem pontuação — a normalização que o Meta pede. */
function normalizarTexto(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z ]/g, '').trim();
}

/** Só dígitos, com o código do país na frente (55 = Brasil). */
function normalizarTelefone(tel) {
  const d = String(tel || '').replace(/\D/g, '');
  if (d.length < 10) return '';
  return d.startsWith('55') ? d : '55' + d;
}

/** O Firestore REST devolve valor tipado; isto devolve o valor cru. */
function valor(campo) {
  if (!campo || typeof campo !== 'object') return undefined;
  if ('stringValue'    in campo) return campo.stringValue;
  if ('integerValue'   in campo) return Number(campo.integerValue);
  if ('doubleValue'    in campo) return Number(campo.doubleValue);
  if ('booleanValue'   in campo) return campo.booleanValue;
  if ('timestampValue' in campo) return campo.timestampValue;
  if ('nullValue'      in campo) return null;
  if ('arrayValue'     in campo) return (campo.arrayValue.values || []).map(valor);
  if ('mapValue'       in campo) {
    const o = {};
    for (const [k, v] of Object.entries(campo.mapValue.fields || {})) o[k] = valor(v);
    return o;
  }
  return undefined;
}

async function lerPedido(codigo) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJETO}` +
              `/databases/(default)/documents/orders/${encodeURIComponent(codigo)}?key=${API_KEY}`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const doc = await r.json();
  if (!doc || !doc.fields) return null;
  const o = {};
  for (const [k, v] of Object.entries(doc.fields)) o[k] = valor(v);
  return o;
}

module.exports = handler;
// Abertos para os testes: é o que permite provar, sem rede e sem token, que
// um código inventado não vira venda e que nada pessoal sai sem hash.
module.exports.__teste = { hash, normalizarTexto, normalizarTelefone, valor };

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ erro: 'use POST' });
  }

  const token  = process.env.META_CAPI_TOKEN;
  const pixel  = process.env.META_PIXEL_ID;
  if (!token || !pixel) {
    // Não é erro do site: é a Conversions API simplesmente não configurada.
    return res.status(503).json({ erro: 'conversions api desligada' });
  }

  let corpo = req.body;
  if (typeof corpo === 'string') { try { corpo = JSON.parse(corpo); } catch (e) { corpo = {}; } }
  corpo = corpo || {};

  const codigo = String(corpo.code || '').trim();
  // O código é gerado como MK- mais 5 caracteres de um alfabeto sem I, O, 0 e 1
  if (!/^MK-[A-HJ-NP-Z2-9]{5}$/.test(codigo)) {
    return res.status(400).json({ erro: 'código de pedido inválido' });
  }

  let pedido;
  try {
    pedido = await lerPedido(codigo);
  } catch (e) {
    return res.status(502).json({ erro: 'não foi possível ler o pedido' });
  }
  if (!pedido) return res.status(404).json({ erro: 'pedido não encontrado' });

  const criadoEm = Date.parse(pedido.createdAt || '');
  if (!criadoEm || Date.now() - criadoEm > IDADE_MAXIMA_MS) {
    return res.status(409).json({ erro: 'pedido antigo demais para virar evento' });
  }
  if (pedido.status === 'cancelado') {
    return res.status(409).json({ erro: 'pedido cancelado' });
  }

  // Tudo que identifica a pessoa sai daqui com hash. O que vai em texto aberto
  // é só o que o Meta exige assim: IP, navegador e os cookies do próprio Meta.
  const nome = normalizarTexto(pedido.customerName).split(' ').filter(Boolean);
  const telefone = normalizarTelefone(pedido.phone);
  const user_data = {
    ph: hash(telefone),
    fn: hash(nome[0]),
    ln: nome.length > 1 ? hash(nome[nome.length - 1]) : undefined,
    country: hash('br'),
    external_id: hash(telefone),
    client_user_agent: String(req.headers['user-agent'] || '').slice(0, 400),
    client_ip_address: String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || undefined,
    fbp: typeof corpo.fbp === 'string' ? corpo.fbp.slice(0, 200) : undefined,
    fbc: typeof corpo.fbc === 'string' ? corpo.fbc.slice(0, 200) : undefined,
  };
  for (const k of Object.keys(user_data)) if (user_data[k] === undefined) delete user_data[k];

  const itens = Array.isArray(pedido.items) ? pedido.items : [];
  const evento = {
    event_name: 'Purchase',
    // o mesmo id do pixel do navegador — é isto que impede a contagem dobrada
    event_id: 'mk-' + codigo,
    event_time: Math.floor(criadoEm / 1000),
    event_source_url: typeof corpo.url === 'string' ? corpo.url.slice(0, 500) : undefined,
    action_source: 'website',
    user_data,
    custom_data: {
      currency: 'BRL',
      value: Number(pedido.total) || 0,
      order_id: codigo,
      content_type: 'product',
      content_ids: itens.map(i => String(i && i.name || '').slice(0, 100)),
      contents: itens.map(i => ({
        id: String(i && i.name || '').slice(0, 100),
        quantity: Number(i && i.qty) || 1,
        item_price: Number(i && i.price) || 0,
      })),
    },
  };

  try {
    const r = await fetch(`https://graph.facebook.com/${VERSAO_GRAPH}/${pixel}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [evento], access_token: token }),
    });
    const resposta = await r.json().catch(() => ({}));
    if (!r.ok) {
      // A mensagem do Meta vai no corpo porque é ela que diz o que arrumar
      // (token vencido, pixel errado). O token nunca aparece aqui.
      console.error('meta capi recusou:', JSON.stringify(resposta).slice(0, 500));
      return res.status(502).json({ erro: 'meta recusou o evento', detalhe: resposta.error || null });
    }
    return res.status(200).json({ ok: true, recebidos: resposta.events_received || 0 });
  } catch (e) {
    console.error('meta capi falhou:', e && e.message);
    return res.status(502).json({ erro: 'não foi possível falar com o meta' });
  }
}
