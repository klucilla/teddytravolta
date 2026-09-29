// Confere a leitura dos eventos da live real contra o esquema INSTALADO da biblioteca.
// Foi exatamente isto que quebrou em silêncio na atualização 2.1.0 -> 2.4.2 da
// tiktok-live-connector: os campos mudaram de nome e o simulador não tinha como perceber.
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mock, test } from 'node:test';
import * as proto from 'tiktok-live-proto/v3';
import { config } from '../src/config.js';
import {
  TikTokSource,
  normalizarComentario,
  normalizarEspectadores,
  normalizarLikes,
  normalizarPresente,
} from '../src/tiktok.js';

// Monta a mensagem como a biblioteca entrega (decode do protobuf) e RECUSA campo que não
// existe no esquema: se uma atualização renomear um campo, o teste quebra aqui.
function msg(tipo, campos = {}) {
  const obj = proto[tipo].decode(new Uint8Array(0));
  for (const [k, v] of Object.entries(campos)) {
    assert.ok(k in obj, `o esquema instalado não tem ${tipo}.${k} — a biblioteca mudou o formato?`);
    obj[k] = v;
  }
  return obj;
}

const usuario = (nickname, id = '7001') => msg('User', { nickname, id, displayId: nickname.toLowerCase() });
const presente = (nome, diamantes, tipo) => msg('Gift', { name: nome, diamondCount: diamantes, type: tipo });

test('presente grande: valor e nome saem de data.gift', () => {
  const data = msg('WebcastGiftMessage', {
    user: usuario('Ana'),
    gift: presente('Galáxia', 1000, 2),
    repeatCount: 1,
    repeatEnd: 0,
  });
  assert.deepEqual(normalizarPresente(data), {
    user: 'Ana', id: '7001', giftName: 'Galáxia', coins: 1000, repeatCount: 1,
  });
});

test('presente em sequência: ignora as repetições e agradece só o fim do combo', () => {
  const rosa = presente('Rosa', 1, 1);
  for (let n = 1; n < 10; n++) {
    const parcial = msg('WebcastGiftMessage', { user: usuario('Bia'), gift: rosa, repeatCount: n, repeatEnd: 0 });
    assert.equal(normalizarPresente(parcial), null, `repetição ${n} não pode gerar agradecimento`);
  }
  const fim = msg('WebcastGiftMessage', { user: usuario('Bia'), gift: rosa, repeatCount: 10, repeatEnd: 1 });
  assert.equal(normalizarPresente(fim).coins, 10);
});

test('comentário: texto sai de data.content', () => {
  const data = msg('WebcastChatMessage', { user: usuario('Caio'), content: 'boa noite Teddy!' });
  assert.deepEqual(normalizarComentario(data), { user: 'Caio', id: '7001', text: 'boa noite Teddy!' });
});

test('espectadores: data.total vem como texto', () => {
  assert.equal(normalizarEspectadores(msg('WebcastRoomUserSeqMessage', { total: '42' })), 42);
  assert.equal(normalizarEspectadores(msg('WebcastRoomUserSeqMessage')), 0);
});

test('likes: quantidade do lote sai de data.count', () => {
  const data = msg('WebcastLikeMessage', { user: usuario('Duda'), count: 15 });
  assert.equal(normalizarLikes(data).count, 15);
});

test('formato antigo (2.1.0, campos achatados) continua funcionando', () => {
  const user = { nickname: 'Eva', uniqueId: 'eva' };
  assert.deepEqual(
    normalizarPresente({ user, giftType: 1, repeatEnd: true, repeatCount: 3, diamondCount: 5, giftName: 'Coração' }),
    { user: 'Eva', id: 'eva', giftName: 'Coração', coins: 15, repeatCount: 3 }
  );
  assert.equal(normalizarComentario({ user, comment: 'oi' }).text, 'oi');
  assert.equal(normalizarEspectadores({ viewerCount: 30 }), 30);
  assert.equal(normalizarLikes({ user, likeCount: 7 }).count, 7);
});

// ---------- conexão (com uma conexão falsa no lugar da biblioteca) ----------

function conexaoFalsa(roteiro) {
  const criadas = [];
  const fabrica = () => {
    const c = new EventEmitter();
    c.connect = async () => {
      const ok = roteiro[criadas.length - 1];
      if (!ok) throw new Error('live offline');
      return { roomId: 'sala-teste' };
    };
    c.disconnect = async () => {};
    criadas.push(c);
    return c;
  };
  return { fabrica, criadas };
}

// Deixa as promessas pendentes andarem (o import dinâmico e o connect são assíncronos)
const escoar = async () => {
  for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
};

test('mesma mensagem duas vezes (reenvio do lote inicial) gera um agradecimento só', async () => {
  config.simulator = false;
  config.tiktokUsername = 'teste';
  const { fabrica, criadas } = conexaoFalsa([true]);
  const fonte = new TikTokSource({ criarConexao: fabrica });
  const recebidos = [];
  fonte.on('gift', (g) => recebidos.push(g));
  await fonte.start();

  const data = msg('WebcastGiftMessage', {
    common: msg('CommonMessageData', { msgId: '123456789' }),
    user: usuario('Fábio'),
    gift: presente('Leão', 500, 2),
    repeatCount: 1,
  });
  criadas[0].emit('gift', data);
  criadas[0].emit('gift', data);
  assert.equal(recebidos.length, 1);
  assert.equal(recebidos[0].coins, 500);
  fonte.stop();
});

test('reconexão insiste até conseguir (antes desistia na primeira falha)', async () => {
  config.simulator = false;
  config.tiktokUsername = 'teste';
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    // 1ª conexão ok; depois da queda, duas tentativas falham e a terceira volta
    const { fabrica, criadas } = conexaoFalsa([true, false, false, true]);
    const fonte = new TikTokSource({ criarConexao: fabrica });
    let conectou = 0;
    fonte.on('connected', () => conectou++);
    await fonte.start();

    criadas[0].emit('disconnected');
    for (const espera of [10000, 20000, 40000]) {
      mock.timers.tick(espera);
      await escoar();
    }
    assert.equal(criadas.length, 4, 'deveria ter tentado 3 reconexões');
    assert.equal(conectou, 2, 'deveria ter voltado a conectar');

    // Depois do stop(), uma queda não agenda mais nada
    fonte.stop();
    criadas[3].emit('disconnected');
    mock.timers.tick(60000);
    await escoar();
    assert.equal(criadas.length, 4);
  } finally {
    mock.timers.reset();
  }
});
