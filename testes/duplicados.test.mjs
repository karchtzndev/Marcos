/**
 * As funções que vivem nas DUAS telas precisam se comportar igual.
 *
 * Rodar com:  npm test
 *
 * O site do cliente e o painel são dois arquivos HTML fechados em si mesmos,
 * sem build e sem import — é o que faz o site continuar de pé quando a rede
 * da loja oscila, porque não existe um segundo arquivo para falhar ao baixar.
 * O preço é que meia dúzia de funções existe duas vezes.
 *
 * Isso já custou caro: a chave com ponto em `stats` tinha que ser corrigida
 * nos dois lugares, e corrigir só um teria deixado o painel contando certo e
 * o site continuando errado — sem nenhum sinal de que faltava metade.
 *
 * Estes testes não comparam texto: eles ARRANCAM a função de dentro de cada
 * HTML, executam as duas com a mesma entrada e exigem o mesmo resultado. É o
 * comportamento que precisa bater, não a formatação nem o comentário. Se um
 * dia alguém consertar um lado só, quebra aqui antes de chegar na loja.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const SITE   = readFileSync('index.html', 'utf8');
const PAINEL = readFileSync('gerencial/index.html', 'utf8');

/** Recorta `function nome(...){...}` casando as chaves. */
function extrair(html, nome){
  const i = html.indexOf('function ' + nome + '(');
  assert.notStrictEqual(i, -1, `não achei a função ${nome}`);
  let j = html.indexOf('{', i), nivel = 0;
  for(let k = j; k < html.length; k++){
    if(html[k] === '{') nivel++;
    else if(html[k] === '}' && --nivel === 0) return html.slice(i, k + 1);
  }
  throw new Error(`chaves desbalanceadas em ${nome}`);
}

/** Monta a função isolada, com as dependências que ela espera encontrar. */
function montar(html, nome, deps = {}){
  const nomes = Object.keys(deps);
  const corpo = extrair(html, nome) + '\n return ' + nome + ';';
  return new Function(...nomes, corpo)(...nomes.map(n => deps[n]));
}

/* ==================================================================
   FUNÇÕES PURAS — mesma entrada, mesma saída, nas duas telas
   ================================================================== */
describe('funções que existem nas duas telas', () => {

  const casos = {
    money: [0, 1, 9.5, 10.99, 1234.5, -3.2],
    escapeHtml: ['<script>', 'Pão & Queijo', `aspas " e '`, 'normal'],
    statsKey: [
      'X-Tudo',
      'X-Tudo 1/2',              // a barra é proibida em nome de campo
      'Combo [promo]',           // colchete também
      'Bugue.do.Papai',          // e o ponto, que já quebrou o dashboard
      'Shake ~ banana *especial*',
      'n'.repeat(80),            // passa dos 60 e precisa ser cortado igual
    ],
    localDateStr: [
      '2026-01-01T03:00:00.000Z',
      '2026-10-18T20:30:00.000Z',
      '2026-12-31T23:59:59.000Z',
      1760000000000,
    ],
  };

  for(const [nome, entradas] of Object.entries(casos)){
    test(`${nome}() responde igual no site e no painel`, () => {
      const noSite   = montar(SITE, nome);
      const noPainel = montar(PAINEL, nome);
      for(const entrada of entradas){
        assert.deepStrictEqual(
          noSite(entrada), noPainel(entrada),
          `${nome}(${JSON.stringify(entrada)}) divergiu entre as duas telas`
        );
      }
    });
  }
});

/* ==================================================================
   GRAVAÇÕES — o documento que cada tela manda ao banco tem que ser o MESMO
   Um pedido feito pelo site e o mesmo pedido lançado no balcão precisam
   virar exatamente o mesmo documento. Foi divergir aqui que fez o
   dashboard nunca mostrar os produtos vendidos pelo site.
   ================================================================== */

// Firebase de mentira: anota o que seria gravado, sem rede nenhuma.
function bancoFalso(){
  const gravado = [];
  const firebase = {
    firestore: { FieldValue: { increment: (n) => ({ __somar: n }) } },
  };
  const db = {
    collection: (col) => ({
      doc: (id) => ({
        set: (dados, opcoes) => {
          gravado.push({ col, id, dados, opcoes });
          return { catch: () => {} };
        },
      }),
    }),
  };
  return { gravado, deps: { db, firebase, registrarFalha: () => {} } };
}

const PEDIDO = {
  code: 'MK-ABCDE',
  createdAt: '2026-10-18T20:30:00.000Z',
  orderType: 'entrega',
  total: 87.4,
  phone: '(11) 99999-0000',
  customerName: 'João da Silva',
  address: 'Rua A, 100',
  items: [
    { name: 'Bugue.do.Papai', qty: 2 },
    { name: 'Batata 1/2 porção', qty: 1 },
  ],
};

function rodarGravacao(html, nome){
  const { gravado, deps } = bancoFalso();
  const extras = {};
  // bumpDailyStats chama localDateStr e statsKey; monta as duas do MESMO
  // arquivo, senão o teste compararia uma mistura das duas telas.
  if(nome === 'bumpDailyStats'){
    extras.localDateStr = montar(html, 'localDateStr');
    extras.statsKey     = montar(html, 'statsKey');
  }
  montar(html, nome, Object.assign({}, deps, extras))(PEDIDO);
  return gravado;
}

describe('o documento gravado pelas duas telas', () => {

  test('bumpDailyStats manda o mesmo documento de estatística', () => {
    assert.deepStrictEqual(
      rodarGravacao(SITE, 'bumpDailyStats'),
      rodarGravacao(PAINEL, 'bumpDailyStats')
    );
  });

  test('a estatística continua indo em objeto aninhado, nunca com ponto na chave', () => {
    // set() não interpreta ponto como caminho: 'products.X' viraria um campo
    // de nome literal, que o dashboard não lê e a regra recusa. Foi o bug.
    for(const html of [SITE, PAINEL]){
      const [{ dados }] = rodarGravacao(html, 'bumpDailyStats');
      assert.ok(dados.products, 'tem que existir o objeto products');
      for(const chave of Object.keys(dados)){
        assert.ok(!chave.includes('.'), `chave com ponto no nível de cima: ${chave}`);
      }
      for(const chave of Object.keys(dados.products)){
        assert.ok(!/[.~*/\[\]]/.test(chave), `caractere proibido na chave: ${chave}`);
      }
      assert.deepStrictEqual(dados.products['Bugue_do_Papai'], { __somar: 2 });
      assert.deepStrictEqual(dados.products['Batata 1_2 porção'], { __somar: 1 });
    }
  });

  test('registrarCliente manda o mesmo cadastro', () => {
    const limpar = (g) => g.map(x => {
      // atualizadoEm é a hora da gravação; só o resto precisa bater
      const { atualizadoEm, ...resto } = x.dados;
      return Object.assign({}, x, { dados: resto });
    });
    assert.deepStrictEqual(
      limpar(rodarGravacao(SITE, 'registrarCliente')),
      limpar(rodarGravacao(PAINEL, 'registrarCliente'))
    );
  });

  test('o cliente é gravado sob o telefone só com dígitos, nas duas telas', () => {
    // O painel acha o cliente por esse id. Se uma tela gravasse com máscara
    // e a outra sem, o mesmo cliente viraria dois cadastros e a fidelidade
    // nunca completaria os pedidos para o brinde.
    for(const html of [SITE, PAINEL]){
      const [{ col, id }] = rodarGravacao(html, 'registrarCliente');
      assert.strictEqual(col, 'customers');
      assert.strictEqual(id, '11999990000');
    }
  });
});

/* ==================================================================
   O INSTALADOR EXISTE EM DOIS LUGARES
   A aba do painel e a página /instalador montam o mesmo .bat. Esse
   arquivo roda como ADMINISTRADOR no computador da loja: duas versões
   divergindo significa uma loja configurada de um jeito e a seguinte de
   outro, e descobrir isso só quando a comanda sai na impressora errada.
   ================================================================== */
const PAGINA_INST = readFileSync('instalador/index.html', 'utf8');

function montadorDe(html){
  const raw = html.match(/const INST_RAW = '([^']+)'/);
  assert.ok(raw, 'não achei INST_RAW');
  return montar(html, 'montarInstalador', {
    INST_RAW: raw[1],
    location: { origin: 'https://exemplo.test' },
  });
}

describe('o .bat gerado pelas duas telas', () => {

  const casos = [
    { impressoras: [{nome:'cozinha', share:'COZINHA'}], modo: 'reserva' },
    { impressoras: [{nome:'cozinha', share:'COZINHA'}, {nome:'balcao', share:'BALCAO'}], modo: 'copia' },
    { impressoras: [{nome:'cozinha', share:'COZINHA'}, {nome:'balcao', share:'BALCAO'},
                    {nome:'bar', share:'BAR'}], modo: 'copia' },
  ];

  test('sai byte a byte igual, com 1, 2 e 3 impressoras', () => {
    const noPainel = montadorDe(PAINEL);
    const naPagina = montadorDe(PAGINA_INST);
    for(const c of casos){
      assert.strictEqual(
        naPagina(c.impressoras, c.modo, 'impressora@teste.com'),
        noPainel(c.impressoras, c.modo, 'impressora@teste.com'),
        `divergiu com ${c.impressoras.length} impressora(s) em modo ${c.modo}`
      );
    }
  });

  test('a senha nunca entra no arquivo', () => {
    // O instalador vai para a pasta de downloads e às vezes para um pendrive.
    // A senha é perguntada na hora de rodar, e tem que continuar assim.
    const bat = montadorDe(PAINEL)(casos[2].impressoras, 'copia', 'impressora@teste.com');
    assert.ok(/Read-Host -AsSecureString/.test(bat), 'a senha tem que ser perguntada na hora');
    assert.ok(!/MK_SENHA=[^%!\r\n]/.test(bat), 'senha escrita direto no arquivo');
  });

  test('cada impressora vira um agente com pasta e tarefa propria', () => {
    const bat = montadorDe(PAINEL)(casos[2].impressoras, 'copia', 'impressora@teste.com');
    for(const p of casos[2].impressoras){
      assert.ok(bat.includes(`agente-${p.nome}`), `faltou a pasta do agente ${p.nome}`);
      assert.ok(bat.includes(`Markin - ${p.nome}`), `faltou a tarefa agendada de ${p.nome}`);
    }
    assert.ok(bat.includes('set "MK_MODO=copia"'), 'o modo escolhido tem que ir no config');
  });

  test('a impressora e ESCOLHIDA numa lista, nao digitada', () => {
    // Digitar o nome do compartilhamento as cegas era o erro mais facil de
    // cometer numa instalacao, e o mais silencioso: nome errado e a comanda
    // vai para lugar nenhum, sem aviso. Quem conhece os nomes e o Windows do
    // computador onde o arquivo roda, entao a escolha acontece la.
    const bat = montadorDe(PAINEL)(casos[1].impressoras, 'copia', 'a@b.c');
    assert.ok(/Get-Printer \| Select-Object -ExpandProperty Name/.test(bat),
      'o instalador precisa listar as impressoras do computador');
    assert.ok(/Qual delas e a cozinha/.test(bat), 'e precisa perguntar qual e qual');
    assert.ok(bat.includes('set "MK_IMPRESSORA=!SHARE!"'),
      'o endereco tem que sair da escolha, nao vir fixo do formulario');
    // E ainda deve dar a saida de criar uma nova, para PC sem impressora.
    assert.ok(/criar uma nova numa porta USB/.test(bat));
  });

  test('da a opcao de impressora de rede, para a cozinha longe', () => {
    // Bluetooth alcanca alguns metros; rede alcanca o predio. Com a cozinha
    // longe do atendimento, e este o caminho — e o instalador precisa
    // oferece-lo, nao so o agente aceitar.
    const b = montadorDe(PAINEL)(casos[0].impressoras, 'copia', 'a@b.c');
    assert.ok(/impressora de REDE/.test(b), 'falta a opcao na lista de escolha');
    assert.ok(/IP da impressora na rede/.test(b), 'precisa perguntar o IP');
    assert.ok(/tcp:\/\/!IP!:9100/.test(b), 'e montar o endereco tcp');
    // Testar antes de terminar evita descobrir na hora do movimento.
    assert.ok(/TcpClient/.test(b), 'tem que testar a conexao durante a instalacao');
  });

  test('tem caminho proprio para Bluetooth', () => {
    const b = montadorDe(PAINEL)(casos[0].impressoras, 'copia', 'a@b.c');
    assert.ok(/impressora BLUETOOTH pareada/.test(b), 'falta a opcao na escolha');
    // No Windows a Bluetooth pareada vira uma PORTA SERIAL, e achar o numero
    // dela a mao e onde a instalacao emperra.
    assert.ok(/Get-PnpDevice -Class Ports/.test(b), 'precisa listar as portas seriais');
    assert.ok(/Standard Serial over Bluetooth/.test(b), 'e dizer como ela se chama na lista');
    assert.ok(/set "SHARE=COM!COMP!"/.test(b), 'e montar o endereco COM');
  });

  test('pergunta a velocidade da serial e a leva ao config', () => {
    // A maioria usa 9600, algumas pedem 115200. Com a velocidade errada sai
    // lixo no papel, e nada na tela explica.
    const b = montadorDe(PAINEL)(casos[0].impressoras, 'copia', 'a@b.c');
    assert.ok(/BAUD=!BAUD!/.test(b), 'tem que aplicar a velocidade escolhida');
    assert.ok(/velocidadeSerial/.test(b), 'e gravar no config, senao o agente usa outra');
  });

  test('imprime uma folha de teste na Bluetooth durante a instalacao', () => {
    // Descobrir que a porta era a errada so na hora do movimento e caro: o
    // Windows cria DUAS portas por dispositivo, e so uma serve.
    const b = montadorDe(PAINEL)(casos[0].impressoras, 'copia', 'a@b.c');
    assert.ok(/TESTE BLUETOOTH - O MARKIN/.test(b));
    assert.ok(/porta de SAIDA, nao a de entrada/.test(b),
      'precisa avisar da porta errada, que e o tropeço classico');
  });

  test('a folha de identificacao sabe ir pelos tres caminhos', () => {
    const b = montadorDe(PAINEL)(casos[1].impressoras, 'copia', 'a@b.c');
    assert.ok(/findstr \/b \/c:"COM"/.test(b), 'serial');
    assert.ok(/findstr \/b \/c:"tcp:\/\/"/.test(b), 'rede');
    assert.ok(/fim_id0/.test(b), 'e o desvio precisa ter para onde ir');
  });

  test('a folha de identificacao sabe ir pela rede', () => {
    // copy /b numa tcp:// nao chega a lugar nenhum, e a pessoa ficaria
    // esperando um papel que nunca sai.
    const b = montadorDe(PAINEL)(casos[1].impressoras, 'copia', 'a@b.c');
    assert.ok(/findstr \/b \/c:"tcp:\/\/"/.test(b), 'precisa separar os dois caminhos');
    assert.ok(/Net\.Sockets\.TcpClient/.test(b), 'e mandar por socket quando for rede');
  });

  test('o Node tem plano B quando a loja do Windows nao resolve', () => {
    // winget nao existe em todo Windows. Sem plano B, a instalacao morre na
    // casa do cliente com "instale o Node e rode de novo".
    const bat = montadorDe(PAINEL)(casos[0].impressoras, 'reserva', 'a@b.c');
    assert.ok(/winget install/.test(bat), 'primeiro tenta a loja');
    assert.ok(/nodejs\.org\/dist\/index\.json/.test(bat),
      'depois baixa direto, descobrindo a versao na hora');
    assert.ok(/msiexec \/i/.test(bat), 'e instala o pacote baixado');
  });

  test('no fim ele CONFERE se o agente entrou, em vez de supor', () => {
    // Sem isto, senha errada so aparece horas depois, como tarja vermelha no
    // painel, sem motivo nenhum escrito.
    const bat = montadorDe(PAINEL)(casos[0].impressoras, 'reserva', 'a@b.c');
    assert.ok(/agente\.log/.test(bat), 'tem que ler o log do agente');
    assert.ok(/conectado como/.test(bat), 'e procurar a linha que prova a conexao');
    assert.ok(/naoconectou/.test(bat), 'com um desfecho proprio para quando nao entra');
    assert.ok(/INSTALOU, MAS O AGENTE NAO ENTROU/.test(bat),
      'e dizendo em portugues claro o que aconteceu');
  });

  test('para se as dependencias nao instalarem', () => {
    const bat = montadorDe(PAINEL)(casos[0].impressoras, 'reserva', 'a@b.c');
    assert.ok(/node_modules/.test(bat),
      'npm install silencioso que falha deixaria o agente sem como rodar');
  });

  test('usa o driver embutido do Windows, que serve para impressora sem marca', () => {
    const bat = montadorDe(PAINEL)(casos[0].impressoras, 'reserva', 'x@y.com');
    assert.ok(bat.includes("'Generic / Text Only'"),
      'o driver genérico é o que repassa os bytes do ESC/POS sem desenhar nada');
  });
});

/* ==================================================================
   O CMD NÃO PODE ESTRAGAR O .BAT ANTES DE ELE RODAR
   O instalador roda com EnableDelayedExpansion, onde "!" é caractere
   especial do próprio cmd. Uma linha com if(!k.startsWith('_')) teve o
   "!" COMIDO antes do node ver: a condição inverteu, o config.json saiu
   errado e o agente foi recusado no login — na loja, em silêncio, com a
   impressora plugada esperando.
   ================================================================== */
describe('caracteres que o cmd interpreta', () => {

  const bat = () => montadorDe(PAINEL)(
    [{nome:'cozinha', share:'COZINHA'}, {nome:'balcao', share:'BALCAO'}],
    'copia', 'impressora@teste.com'
  );

  test('nenhum "!" solto — só as expansões !VAR! do próprio cmd', () => {
    const linhas = bat().split('\n');
    const ruins = [];
    linhas.forEach((linha, i) => {
      // tira as expansões legítimas e vê se sobrou algum "!"
      if(linha.replace(/![A-Za-z_][A-Za-z0-9_]*!/g, '').includes('!')){
        ruins.push(`linha ${i+1}: ${linha.slice(0, 120)}`);
      }
    });
    assert.deepStrictEqual(ruins, [],
      'um "!" fora de !VAR! é comido pelo cmd antes do programa ver a linha');
  });

  test('o config do agente é escrito e CONFERIDO na tela', () => {
    const b = bat();
    assert.ok(/ConvertTo-Json/.test(b), 'o config tem que ser montado em PowerShell');
    assert.ok(/IsNullOrWhiteSpace/.test(b), 'e-mail ou senha vazios têm que parar a instalação');
    // Sem esta linha, um config errado só apareceria dias depois, na loja.
    assert.ok(/entra como/.test(b), 'o instalador precisa mostrar com qual conta o agente vai entrar');
  });

  test('o config é gravado SEM o caractere invisível do Windows', () => {
    // Set-Content -Encoding UTF8 no PowerShell do Windows cola um BOM no
    // começo do arquivo, e aí o agente não consegue ler o próprio config.
    const b = bat();
    assert.ok(!/Set-Content -Encoding UTF8 'config.json'/.test(b),
      'Set-Content -Encoding UTF8 grava com BOM — o agente não lê');
    assert.ok(/UTF8Encoding \$false/.test(b),
      'o config precisa ser gravado com UTF8Encoding $false, que não põe BOM');
  });

  test('o agente sobe na hora, não só no próximo login', () => {
    // O gatilho da tarefa é AtLogOn. Sem o schtasks /run, quem instala fica
    // olhando a tarja vermelha achando que não funcionou.
    assert.ok(/schtasks \/run \/tn "Markin - cozinha"/.test(bat()));
  });

  test('agente de instalação antiga é removido', () => {
    const b = bat();
    assert.ok(/Unregister-ScheduledTask/.test(b));
    assert.ok(/\$manter=@\('cozinha','balcao'\)/.test(b),
      'a lista do que manter tem que ser a desta instalação');
  });
});
