// Fila sequencial de agradecimentos: um por vez (áudio nunca sobrepõe).
// Cada item: monta a frase -> gera/reusa TTS -> avisa (OBS/overlay) -> toca o áudio.
import fs from 'node:fs';
import { config, log } from './config.js';
import { generateEngagement, generatePhrase, respondToComment } from './llm.js';
import { audioDurationSeconds, play } from './player.js';
import { sanitizeName, synthesize, synthesizeChant } from './tts.js';

const SHORT_PHRASES = [
  'Valeu, {nome}!',
  'Obrigado, {nome}, você é demais!',
  'Aê, {nome}! Tamo junto!',
  '{nome}, você é show de bola!',
  'Brigadão, {nome}! Segue o baile!',
  'É isso aí, {nome}! Valeu demais!',
];

const BIG_PHRASES = [
  'Uau! {nome} mandou um {presente}! Você é uma lenda da pista!',
  'Caraca, {nome}! Um {presente}! O Teddy tá maluco com você!',
  'Segura a pista! {nome} mandou um {presente}! Você é gigante!',
  'Que isso, {nome}! Um {presente}! Brilhou mais que o globo de espelhos!',
];

const FOLLOW_PHRASES = [
  'Bem-vindo à pista, {nome}!',
  'Valeu por seguir, {nome}!',
  '{nome} entrou pro time do Teddy!',
];

const LIKES_PHRASES = [
  'Chuva de likes do {nome}! Bora de moonwalk!',
  'Tá chovendo coração, {nome}! Olha esse moonwalk!',
  '{nome} mandou likes! Segura o passinho do Teddy!',
];

const SHARE_PHRASES = [
  'Saúde, {nome}! Essa dose é sua!',
  '{nome} compartilhou! Tim-tim, essa tequila é pra você!',
  'Valeu por espalhar a festa, {nome}! Um brinde!',
];

const WELCOME_PHRASES = [
  'E aí, {nome}! Chegou na pista certa!',
  'Bem-vindo, {nome}! Senta que o baile tá rolando!',
  'Salve, {nome}! Cola aqui que a festa é sua!',
  'Olha quem chegou: {nome}! Seja muito bem-vindo!',
];

// Frases de engajamento no ocioso (fallback da IA): puxam interação do chat.
const IDLE_PHRASES = [
  'Manda um oi no chat que eu respondo na hora!',
  'De onde vocês tão assistindo? Comenta aí!',
  'Quem tá curtindo o baile? Deixa um like!',
  'Comenta alguma coisa que eu converso com você!',
  'Bora animar essa pista! Manda uma rosa pro Teddy!',
  'Tá afim de ver o moonwalk? Capricha nos likes!',
];

// Prioridade na fila: presente é o mais importante; boas-vindas o menos.
const QUEUE_PRIORITY = {
  gift: 100,
  challenge_win: 96, // vencedor do desafio: anunciar rápido, senão perde a graça
  meta: 92, // meta da live batida
  milestone: 90,
  comment: 80,
  share: 60,
  challenge: 55, // anúncio do desafio
  likes: 50,
  idle: 45,
  follow: 40,
  join: 20,
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Vinheta cantada (MP3 do Suno) para presentes grandes, se o arquivo existir.
let jingleChecked = null;
function jingleFile() {
  if (!config.jingleFile) return null;
  if (jingleChecked === null) {
    jingleChecked = fs.existsSync(config.jingleFile);
    if (!jingleChecked) log('fila', `vinheta não encontrada em ${config.jingleFile} (seguindo sem ela)`);
  }
  return jingleChecked ? config.jingleFile : null;
}

/**
 * Monta o anúncio (frase + metadados de exibição) para um evento.
 */
export function buildAnnouncement(event) {
  const nome = sanitizeName(event.user);

  if (event.type === 'gift') {
    const big = event.coins >= config.bigGiftCoins;
    const template = big ? pick(BIG_PHRASES) : pick(SHORT_PHRASES);
    return {
      type: 'gift',
      big,
      nome,
      giftName: event.giftName,
      coins: event.coins,
      phrase: template.replace('{nome}', nome).replace('{presente}', event.giftName),
      celebrationSeconds: big ? 8 : 3,
      overlaySeconds: big ? 10 : 5,
    };
  }

  if (event.type === 'follow') {
    return {
      type: 'follow',
      big: false,
      nome,
      phrase: pick(FOLLOW_PHRASES).replace('{nome}', nome),
      celebrationSeconds: 0,
      talkSeconds: 3, // cena "fala" (se configurada); estendida até o fim do áudio
      overlaySeconds: 4,
    };
  }

  if (event.type === 'join') {
    return {
      type: 'join',
      big: false,
      nome,
      phrase: pick(WELCOME_PHRASES).replace('{nome}', nome),
      celebrationSeconds: 0,
      welcomeSeconds: 4, // cena "boasvindas" (se configurada); estendida até o fim do áudio
      overlaySeconds: 5,
    };
  }

  if (event.type === 'share') {
    return {
      type: 'share',
      big: false,
      nome,
      phrase: pick(SHARE_PHRASES).replace('{nome}', nome),
      celebrationSeconds: 0,
      shareSeconds: 8, // duração do vídeo do bar; estendida até o fim do áudio
      overlaySeconds: 6,
    };
  }

  if (event.type === 'comment') {
    return {
      type: 'comment',
      big: false,
      nome,
      commentText: event.text || '',
      phrase: '', // preenchida pela IA em #process; vazia => comentário ignorado
      celebrationSeconds: 0,
      talkSeconds: 3, // cena "fala" (urso conversando)
      overlaySeconds: 6,
    };
  }

  if (event.type === 'meta') {
    const alvoTxt = event.metaTipo === 'coins' ? `${event.alvo} coins` : `${event.alvo} novos seguidores`;
    return {
      type: 'meta',
      big: true,
      count: event.alvo,
      phrase: `Batemos a meta de ${alvoTxt}! Vocês são demais, valeu pista!`,
      celebrationSeconds: 6,
      overlaySeconds: 8,
    };
  }

  if (event.type === 'challenge') {
    return {
      type: 'challenge',
      big: false,
      trigger: event.trigger,
      phrase: event.anuncio,
      celebrationSeconds: 0,
      talkSeconds: 4, // cena "fala": Teddy anunciando o desafio
      overlaySeconds: event.windowSec || 60, // card fica na tela enquanto o desafio vale
    };
  }

  if (event.type === 'challenge_win') {
    return {
      type: 'challenge_win',
      big: true,
      nome,
      phrase: `Temos um campeão! ${nome} foi o mais rápido da pista! Salve especial pra você!`,
      celebrationSeconds: 5,
      overlaySeconds: 8,
    };
  }

  if (event.type === 'milestone') {
    return {
      type: 'milestone',
      big: false,
      count: event.count,
      phrase: `Uhul! Já somos ${event.count} na pista! Bora animar esse baile!`,
      celebrationSeconds: 5, // cena de comemoração
      overlaySeconds: 6,
    };
  }

  if (event.type === 'idle') {
    return {
      type: 'idle',
      big: false,
      phrase: pick(IDLE_PHRASES), // pode ser trocada pela IA em #process
      celebrationSeconds: 0,
      talkSeconds: 3, // cena "fala" (urso puxando papo)
      overlaySeconds: 0, // sem card; é só o Teddy falando
    };
  }

  // likes
  return {
    type: 'likes',
    big: false,
    nome,
    count: event.count,
    phrase: pick(LIKES_PHRASES).replace('{nome}', nome),
    celebrationSeconds: 0,
    moonwalkSeconds: 8, // cena "moonwalk" (se configurada); estendida até o fim do áudio
    overlaySeconds: 5,
  };
}

export class ThankQueue {
  /**
   * @param {{ onAnnounce?: (announcement) => void }} hooks
   *   onAnnounce é chamado no INÍCIO de cada agradecimento (para OBS/overlay).
   */
  constructor({ onAnnounce } = {}) {
    this.items = [];
    this.running = false;
    this.seq = 0;
    this.onAnnounce = onAnnounce || (() => {});
  }

  push(event) {
    // Boas-vindas (entrada) são as menos importantes: descarta se a fila já está cheia,
    // para o Teddy não falar "fulano entrou" minutos atrasado quando entra muita gente.
    if (
      event.type === 'join' &&
      config.queueDropWelcomeAfter > 0 &&
      this.items.length >= config.queueDropWelcomeAfter
    ) {
      log('fila', `descarta boas-vindas de ${event.user} (fila cheia: ${this.items.length})`);
      return;
    }
    const priority = QUEUE_PRIORITY[event.type] ?? 30;
    // Teto de segurança: a fila nunca cresce sem limite (enxurrada de eventos).
    // Cheia: um evento mais importante expulsa o menos importante; senão é descartado.
    const MAX_QUEUE = 50;
    if (this.items.length >= MAX_QUEUE) {
      let lowest = 0;
      for (let i = 1; i < this.items.length; i++) {
        if (this.items[i].priority < this.items[lowest].priority) lowest = i;
      }
      if (this.items[lowest].priority >= priority) {
        log('fila', `cheia (${MAX_QUEUE}): descartando ${event.type} de ${event.user || ''}`);
        return;
      }
      const removido = this.items.splice(lowest, 1)[0];
      log('fila', `cheia (${MAX_QUEUE}): ${removido.event.type} sai para ${event.type} entrar`);
    }
    this.items.push({ event, priority, seq: this.seq++ });
    log('fila', `+ ${event.type} de ${event.user || ''} (${this.items.length} na fila)`);
    this.#drain();
  }

  get size() {
    return this.items.length;
  }

  get busy() {
    return this.running;
  }

  // Escolhe o próximo item: maior prioridade primeiro; entre iguais, o mais antigo.
  #takeNext() {
    let best = 0;
    for (let i = 1; i < this.items.length; i++) {
      const a = this.items[i];
      const b = this.items[best];
      if (a.priority > b.priority || (a.priority === b.priority && a.seq < b.seq)) best = i;
    }
    return this.items.splice(best, 1)[0].event;
  }

  async #drain() {
    if (this.running) return;
    this.running = true;
    while (this.items.length > 0) {
      const event = this.#takeNext();
      try {
        await this.#process(event);
      } catch (e) {
        log('fila', `erro ao processar ${event.type} de ${event.user}: ${e.message}`);
      }
    }
    this.running = false;
  }

  async #process(event) {
    const announcement = buildAnnouncement(event);

    if (announcement.type === 'comment') {
      // Comentário: a resposta vem da IA (com moderação). Sem resposta => ignora.
      const resposta = await respondToComment({ user: announcement.nome, text: announcement.commentText });
      if (!resposta) {
        log('fila', `comentário ignorado: ${announcement.nome}`);
        return;
      }
      announcement.phrase = resposta;
    } else if (announcement.type === 'idle') {
      // Fala de engajamento: IA puxa papo (fallback na frase fixa já sorteada)
      try {
        const linha = await generateEngagement();
        if (linha) announcement.phrase = linha;
      } catch {
        // mantém a frase fixa
      }
    } else {
      // Demais eventos: frase variada pela IA (fallback nas listas fixas)
      try {
        const llmPhrase = await generatePhrase(announcement);
        if (llmPhrase) announcement.phrase = llmPhrase;
      } catch (e) {
        log('fila', `IA de frases falhou (${e.message}); usando frase fixa`);
      }
    }

    log('fila', `▶ "${announcement.phrase}"`);

    // Gera os áudios ANTES de anunciar, para overlay/cena ficarem sincronizados com a voz.
    const audioFiles = [];
    if (announcement.type === 'gift' && announcement.big) {
      const jingle = jingleFile();
      if (jingle) {
        audioFiles.push(jingle); // vinheta cantada (Suno)
      } else if (config.chant) {
        try {
          audioFiles.push(await synthesizeChant(announcement.nome)); // "á á á stayin {nome}!"
        } catch (e) {
          log('fila', `bordão falhou (${e.message}), seguindo só com a frase`);
        }
      }
    }
    audioFiles.push(await synthesize(announcement.phrase));

    // A cena temporária (comemoração ou fala) dura pelo menos o tempo dos áudios:
    // o Teddy só volta a dançar quando termina de "falar" (boca do vídeo junto com a voz).
    const camposCena = ['celebrationSeconds', 'talkSeconds', 'shareSeconds', 'welcomeSeconds', 'moonwalkSeconds'];
    if (camposCena.some((c) => announcement[c] > 0)) {
      let total = 0;
      for (const f of audioFiles) total += (await audioDurationSeconds(f)) || 0;
      if (total > 0) {
        const min = Math.ceil(total + 0.5);
        for (const campo of camposCena) {
          if (announcement[campo] > 0) announcement[campo] = Math.max(announcement[campo], min);
        }
      }
    }

    this.onAnnounce(announcement);
    for (const f of audioFiles) await play(f);
    log('fila', `✔ concluído: ${announcement.nome}`);
  }
}

// Execução direta: node src/queue.js — testa fila com presentes simultâneos do simulador
if (process.argv[1] && /queue\.js$/.test(process.argv[1].replace(/\\/g, '/'))) {
  const { TikTokSource } = await import('./tiktok.js');
  process.env.SIMULATOR = 'true';
  config.simulator = true;

  const queue = new ThankQueue({
    onAnnounce: (a) => log('anuncio', JSON.stringify({ tipo: a.type, nome: a.nome, big: a.big })),
  });
  const source = new TikTokSource();
  source.on('gift', (g) => queue.push({ type: 'gift', ...g }));
  source.on('follow', (f) => {
    if (config.thankFollows) queue.push({ type: 'follow', ...f });
  });
  source.on('likes', (l) => {
    if (config.thankLikes) queue.push({ type: 'likes', ...l });
  });
  await source.start();
}
