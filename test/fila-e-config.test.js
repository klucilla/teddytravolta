// Fila, desafio, configuração e overlay — as partes puras, sem áudio nem rede.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { num, pos } from '../src/config.js';
import { venceuDesafio } from '../src/desafio.js';
import { mesmaOrigem } from '../src/overlay-server.js';
import { buildAnnouncement, indiceDoProximo, retirarVencidos } from '../src/queue.js';

test('config: "0 desliga" funciona (antes o 0 virava o padrão)', () => {
  assert.equal(num('0', 10), 0);
  assert.equal(num('15', 10), 15);
  assert.equal(num(undefined, 10), 10);
  assert.equal(num('', 10), 10);
  assert.equal(num('abc', 10), 10);
});

test('config: valores que precisam ser positivos caem no padrão', () => {
  assert.equal(pos('-5', 5), 5); // META_STEP negativo travava o laço da meta
  assert.equal(pos('0', 5), 5);
  assert.equal(pos('8000', 4000), 8000);
});

test('fila: itens vencidos saem; presente nunca vence', () => {
  const agora = 1_000_000;
  const item = (type, idadeSeg, seq) => ({ event: { type }, priority: 1, seq, at: agora - idadeSeg * 1000 });
  const items = [item('join', 45, 1), item('gift', 3600, 2), item('comment', 30, 3), item('comment', 120, 4)];
  const vencidos = retirarVencidos(items, agora);
  assert.deepEqual(vencidos.map((v) => v.seq), [1, 4]);
  assert.deepEqual(items.map((v) => v.seq), [2, 3]);
});

test('fila: maior prioridade primeiro; empate vai para o mais antigo', () => {
  const items = [
    { priority: 80, seq: 5 },
    { priority: 100, seq: 7 },
    { priority: 100, seq: 6 },
  ];
  assert.equal(indiceDoProximo(items), 2);
});

test('anúncio: share é martini (o vídeo do bar é martini, não tequila)', () => {
  for (let i = 0; i < 30; i++) {
    assert.doesNotMatch(buildAnnouncement({ type: 'share', user: 'Ana' }).phrase, /tequila/i);
  }
});

test('anúncio: "$&" no nome do presente não vira padrão do replace', () => {
  const a = buildAnnouncement({ type: 'gift', user: 'Ana', giftName: 'Rosa $& Cia', coins: 100 });
  assert.match(a.phrase, /Rosa \$& Cia/);
});

test('anúncio: tipo desconhecido não vira "chuva de likes"', () => {
  assert.equal(buildAnnouncement({ type: 'novidade', user: 'Ana' }), null);
});

test('desafio: vale só o comentário que é o gatilho', () => {
  assert.equal(venceuDesafio('teddy!!!', 'TEDDY'), true);
  assert.equal(venceuDesafio('TEDDY', 'TEDDY'), true);
  assert.equal(venceuDesafio('boa noite Teddy!', 'TEDDY'), false); // antes vencia
  assert.equal(venceuDesafio('TEDDY é o melhor!!! 🕺', 'TEDDY'), false);
  assert.equal(venceuDesafio('🌹', '🌹'), true);
  assert.equal(venceuDesafio('🌹🌹🌹', '🌹'), true);
  assert.equal(venceuDesafio('🌹 oi', '🌹'), false);
  assert.equal(venceuDesafio('🕺🏽', '🕺'), true);
  assert.equal(venceuDesafio('', 'TEDDY'), false);
});

test('overlay: WebSocket só aceita a própria página', () => {
  assert.equal(mesmaOrigem(undefined, 'localhost:3000'), true);
  assert.equal(mesmaOrigem('http://localhost:3000', 'localhost:3000'), true);
  assert.equal(mesmaOrigem('http://127.0.0.1:3000', '127.0.0.1:3000'), true);
  assert.equal(mesmaOrigem('https://site-qualquer.com', 'localhost:3000'), false);
  assert.equal(mesmaOrigem('null', 'localhost:3000'), false);
});
