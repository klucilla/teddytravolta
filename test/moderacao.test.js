// Tudo que pode virar voz do Teddy: apelido, comentário e resposta da IA.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanLine } from '../src/llm.js';
import { textoBloqueado } from '../src/moderation.js';
import { sanitizeName } from '../src/tts.js';

test('apelido: mantém os números e tira emoji e símbolo', () => {
  assert.equal(sanitizeName('DiscoFan42'), 'DiscoFan42'); // antes virava "DiscoFan"
  assert.equal(sanitizeName('GrooveMaster70'), 'GrooveMaster70');
  assert.equal(sanitizeName('BailarinaNeon 💃'), 'BailarinaNeon');
  assert.equal(sanitizeName('🇧🇷 Ana ❤️'), 'Ana');
  assert.equal(sanitizeName('#1 Fã'), '1 Fã');
});

test('apelido: letras estilizadas viram letras comuns (o TTS consegue ler)', () => {
  assert.equal(sanitizeName('𝓛𝓾𝓷𝓪'), 'Luna');
});

test('apelido: sequência longa de dígitos e "user" padrão viram "amigo"', () => {
  assert.equal(sanitizeName('user8472910384'), 'amigo');
  assert.equal(sanitizeName('123456'), 'amigo');
  assert.equal(sanitizeName(''), 'amigo');
  assert.equal(sanitizeName('✨✨'), 'amigo');
});

test('apelido ofensivo ou de spam não é lido em voz alta', () => {
  assert.equal(sanitizeName('Vai se foder'), 'amigo');
  assert.equal(sanitizeName('p0rra'), 'amigo');
  assert.equal(sanitizeName('Compre seguidores'), 'amigo');
  assert.equal(sanitizeName('www.golpe.com'), 'amigo');
});

test('apelido longo é cortado por caractere', () => {
  const longo = 'Ã'.repeat(60);
  assert.equal(Array.from(sanitizeName(longo)).length, 40);
});

test('moderação barra link, spam e palavrão (inclusive disfarçados)', () => {
  for (const t of [
    'acesse www.golpe.com',
    'compre seguidores baratos',
    'inscreva-se no meu canal',
    'chama no whatsapp',
    'segue @lojinha',
    'p0rra',
    'p.o.r.r.a',
    'vai se f0der',
    'que put@ria',
  ]) {
    assert.equal(textoBloqueado(t), true, `deveria barrar: "${t}"`);
  }
});

test('moderação deixa passar comentário legítimo', () => {
  for (const t of [
    'passei pelo viaduto hoje', // antes era barrado por "viad"
    'sou seu seguidor desde o começo',
    'boa noite Teddy!',
    'comprei um terno branco igual',
    'meu computador travou kkk',
    'manda um salve pra zona leste!',
  ]) {
    assert.equal(textoBloqueado(t), false, `não deveria barrar: "${t}"`);
  }
});

test('resposta da IA: bloco <think>, markdown e emoji não chegam na voz', () => {
  assert.equal(cleanLine('<think>vou responder animado</think>Valeu, Ana!'), 'Valeu, Ana!');
  assert.equal(cleanLine('<think>raciocínio cortado sem fim'), '');
  assert.equal(cleanLine('**Valeu**, Ana! 🕺'), 'Valeu, Ana!');
});
