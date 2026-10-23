/**
 * Toda aba do painel precisa ter um painel que apareça.
 *
 * Rodar com:  npm test
 *
 * A aba Instalador existiu por dias assim: o botão estava lá, acendia ao ser
 * clicado, chamava o render — e abria uma tela em branco, porque faltava a
 * linha que mostra a div dela. Nada quebrava, nada aparecia no console, e do
 * lado de cá parecia um problema de cache.
 *
 * O código que mostra a aba agora é um laço sobre ALL_TABS, então a linha não
 * pode mais faltar. O que ainda pode faltar é a DIV. Este teste cobre isso.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const PAINEL = readFileSync('gerencial/index.html', 'utf8');

/** ALL_TABS é a fonte da verdade: lida do arquivo, não copiada para cá. */
function todasAsAbas(){
  const m = PAINEL.match(/const ALL_TABS = \[([^\]]+)\]/);
  assert.ok(m, 'não achei ALL_TABS no painel');
  return m[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
}

const idDoPainel = (aba) => 'atab' + aba.charAt(0).toUpperCase() + aba.slice(1);

describe('abas do painel', () => {

  test('cada aba de ALL_TABS tem botão na barra', () => {
    for(const aba of todasAsAbas()){
      assert.ok(PAINEL.includes(`data-atab="${aba}"`), `aba sem botão: ${aba}`);
    }
  });

  test('cada aba de ALL_TABS tem a div que o clique mostra', () => {
    // Este é o que teria pego o Instalador em branco.
    for(const aba of todasAsAbas()){
      assert.ok(PAINEL.includes(`id="${idDoPainel(aba)}"`),
                `aba sem painel para mostrar: ${aba} (faltou <div id="${idDoPainel(aba)}">)`);
    }
  });

  test('nenhuma div de aba ficou órfã, sem botão que a abra', () => {
    const abas = todasAsAbas().map(idDoPainel);
    const noArquivo = [...PAINEL.matchAll(/id="(atab[A-Za-z]+)"/g)].map(m => m[1]);
    for(const id of new Set(noArquivo)){
      assert.ok(abas.includes(id), `painel sem aba correspondente em ALL_TABS: ${id}`);
    }
  });

  test('mostrar a aba continua vindo de ALL_TABS, não de linha escrita à mão', () => {
    // Esta é a trava de verdade. Foi uma linha escrita à mão que faltou no
    // Instalador; se alguém voltar ao jeito antigo, a próxima aba repete o
    // mesmo sumiço silencioso.
    assert.ok(/ALL_TABS\.forEach\(t => \{\s*const painel = document\.getElementById\('atab'/.test(PAINEL),
      'o clique na aba precisa derivar o painel de ALL_TABS');
    // Só atribuição: ler o display de uma aba para saber se está aberta é
    // outra coisa, e o painel faz isso de propósito em um ponto.
    const naMao = [...PAINEL.matchAll(/getElementById\('atab[A-Za-z]+'\)\.style\.display\s*=[^=]/g)];
    assert.strictEqual(naMao.length, 0,
      `voltaram ${naMao.length} linha(s) de display escritas à mão — é assim que uma aba some em silêncio`);
  });

  test('a aba Impressora nunca é escondida por um módulo desligado', () => {
    // Já aconteceu: a aba ficava atrás de moduloAtivo('filaimpressao'), e com
    // o módulo desligado ela simplesmente não existia na barra. Procuraram
    // por ela durante uma semana.
    //
    // É a tela de controle da impressora: se ela some justamente quando a
    // impressão está desligada, não há por onde ligar. A aba fica visível e
    // explica — o módulo desligado vira um botão, não um sumiço.
    assert.ok(!/tab:\s*'impressora'/.test(PAINEL),
      "algum módulo voltou a apontar tab:'impressora' — isso esconde a aba quando ele está desligado");
  });

  test('nenhuma aba está DENTRO de outra', () => {
    // Faltou um </div> ao montar a aba Impressora, e oito abas — TV, Mesas,
    // Caixa, Financeiro, Estoque, Equipe, Promoção e Loja — passaram a viver
    // dentro dela. O clique mostrava a div certa, mas o PAI estava escondido:
    // a aba acendia e a tela ficava em branco. O mesmo sintoma de sempre, por
    // um motivo novo, e invisível olhando só o JavaScript.
    const pilha = [];
    const aninhadas = [];
    const corpo = PAINEL.slice(PAINEL.indexOf('<div id="atabDashboard"'), PAINEL.indexOf('</body>'));
    for(const m of corpo.matchAll(/<(\/?)div([^>]*)>/g)){
      if(m[1]){ pilha.pop(); continue; }
      const id = (m[2].match(/id="([^"]+)"/) || [])[1] || '';
      const donos = pilha.filter(Boolean).filter(x => x.startsWith('atab'));
      if(id.startsWith('atab') && donos.length) aninhadas.push(`${id} dentro de ${donos.join(' > ')}`);
      pilha.push(id);
    }
    assert.deepStrictEqual(aninhadas, [],
      'aba dentro de aba: a de fora esconde a de dentro e a tela fica em branco');
  });

  test('cada botão da barra pertence a um grupo que existe', () => {
    // Sem grupo válido, o botão nunca é exibido: aplicarGrupo() filtra por data-g.
    const grupos = new Set([...PAINEL.matchAll(/data-grupo="([a-z]+)"/g)].map(m => m[1]));
    assert.ok(grupos.size >= 2, 'não achei os grupos de abas');
    for(const m of PAINEL.matchAll(/data-atab="([a-z]+)" data-g="([a-z]+)"/g)){
      assert.ok(grupos.has(m[2]), `aba ${m[1]} está no grupo inexistente "${m[2]}"`);
    }
  });
});

/* ==================================================================
   LIXO QUE O NAVEGADOR MOSTRA NA TELA
   Sobrou um "}" e um </script> órfãos depois do fim do script do
   painel. O navegador não tem como saber que aquilo era código: mostra
   a chave como texto, solta num canto da página. Ficou semanas assim,
   aparecendo em print atrás de print, e passou por cima de todas as
   outras verificações porque JavaScript inválido não era — era texto.
   ================================================================== */
describe('sobras de edição aparecendo na página', () => {

  const TELAS = ['gerencial/index.html', 'index.html', 'chamada/index.html',
                 'instalador/index.html', 'privacidade.html'];

  for(const tela of TELAS){
    test(`${tela} não mostra chave solta como texto`, () => {
      const html = readFileSync(tela, 'utf8');
      const visivel = html
        .replace(/<script[\s\S]*?<\/script>/g, '')
        .replace(/<style[\s\S]*?<\/style>/g, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<[^>]+>/g, '\n');
      const sobras = visivel.split('\n').map(l => l.trim())
        .filter(l => ['{', '}', '};', '});', ')', ';'].includes(l));
      assert.deepStrictEqual(sobras, [],
        'isso vira texto solto na tela do usuário');
    });

    test(`${tela} fecha cada <script> que abre`, () => {
      const html = readFileSync(tela, 'utf8');
      // conta só as tags de verdade: um '<script>' dentro de string (o painel
      // monta a janela de impressão assim) não abre bloco nenhum.
      const semStrings = html.replace(/<script[\s\S]*?<\/script>/g, '<script></script>');
      const abre = (semStrings.match(/<script[^>]*>/g) || []).length;
      const fecha = (semStrings.match(/<\/script>/g) || []).length;
      assert.strictEqual(abre, fecha, `${abre} aberturas para ${fecha} fechamentos`);
    });
  }
});
