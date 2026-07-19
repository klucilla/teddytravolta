// Conexão com o TikTok Live + modo simulador.
// Emite eventos normalizados: 'gift', 'follow', 'likes', 'comment', 'connected', 'disconnected'.
import { EventEmitter } from 'node:events';
import { config, log } from './config.js';

// Nomes claramente fictícios (handles de chat), para o simulador e demonstrações
const SIM_NAMES = [
  'DiscoFan42', 'LunaDaPista', 'DJ Aurora', 'TeddyFan', 'ReiDoMoonwalk',
  'GrooveMaster70', 'BailarinaNeon 💃', 'SrGroove', 'FunkyBoots 🕺', 'MissDiscoBall',
  'CapitaoBaile', 'NoiteDourada', 'VinilVoador', 'EstrelaDaPista ⭐', 'FebreDeSabado',
  'BolaEspelhada 🪩', 'PassinhoRetro', 'GiraGlobo', 'BrilhoNeon', 'TravoltinhaBR',
];

const SIM_GIFTS_SMALL = [
  { name: 'Rosa', coins: 1 },
  { name: 'TikTok', coins: 1 },
  { name: 'GG', coins: 1 },
  { name: 'Coração', coins: 5 },
  { name: 'Dedos', coins: 5 },
  { name: 'Perfume', coins: 20 },
  { name: 'Mãozinha', coins: 9 },
  { name: 'Boné', coins: 99 },
];

const SIM_GIFTS_BIG = [
  { name: 'Disco Ball', coins: 100 },
  { name: 'Coroa', coins: 199 },
  { name: 'Galáxia', coins: 1000 },
  { name: 'Leão', coins: 500 },
  { name: 'Foguete', coins: 1500 },
  { name: 'Carro Esportivo', coins: 2000 },
];

const SIM_COMMENTS = [
  'manda um salve pra zona leste!',
  'esse urso dança demais kkkk',
  'boa noite Teddy!',
  'qual a música que tá tocando?',
  'o Teddy é brabo no disco',
  'manda um oi pra minha mãe!',
  'tô viciado nessa live',
  'faz o moonwalk de novo!',
  'de onde você é Teddy?',
  'esse terno branco é icônico 🤍',
  'primeira vez aqui, amei!',
  'bom dia do interior de SP',
  'manda um alô pro pessoal de Portugal',
  'qual seu filme favorito?',
  'esse bar tem caipirinha? 😂',
  'já virei fã desse urso',
  'toca um funknejo aí',
  'que horas acaba a live?',
  '🌹',
  'TRAVOLTA',
  'TEDDY é o melhor!!! 🕺',
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

// Sorteio ponderado: [{ tipo, peso }] -> tipo (mais peso = mais provável)
function weightedPick(opcoes) {
  const total = opcoes.reduce((s, o) => s + o.peso, 0);
  let r = Math.random() * total;
  for (const o of opcoes) {
    if ((r -= o.peso) < 0) return o.tipo;
  }
  return opcoes[0].tipo;
}

export class TikTokSource extends EventEmitter {
  constructor() {
    super();
    this.connection = null;
    this.simTimer = null;
    this.likeAccumulator = new Map(); // pessoa -> likes acumulados (dispara aos LIKES_THRESHOLD por pessoa)
    this.currentViewers = 0; // espectadores na sala (vem do ROOM_USER)
    this.lastMilestone = 0; // maior marco de espectadores já comemorado
  }

  // Atualiza a contagem de espectadores e comemora ao bater um novo múltiplo de MILESTONE_EVERY.
  #updateViewers(v) {
    this.currentViewers = v;
    if (config.milestoneEvery > 0 && v > 0) {
      const marco = Math.floor(v / config.milestoneEvery) * config.milestoneEvery;
      if (marco >= config.milestoneEvery && marco > this.lastMilestone) {
        this.lastMilestone = marco;
        this.emit('milestone', { count: marco });
      }
    }
  }

  async start() {
    if (config.simulator) {
      this.#startSimulator();
      return;
    }
    await this.#connectLive();
  }

  stop() {
    if (this.simTimer) clearTimeout(this.simTimer);
    if (this.connection) this.connection.disconnect();
  }

  // ---------- Modo simulador ----------
  #startSimulator() {
    log('tiktok', 'MODO SIMULADOR ativo — eventos variados: presentes, comentários, entradas, marcos, momentos calmos e rajadas');
    this.emit('connected', { mode: 'simulator' });

    // Pesos relativos de cada situação (mais peso = acontece com mais frequência)
    const EVENTOS = [
      { tipo: 'comment', peso: 30 },
      { tipo: 'gift_small', peso: 20 },
      { tipo: 'follow', peso: 14 },
      { tipo: 'join', peso: 14 },
      { tipo: 'share', peso: 8 },
      { tipo: 'likes', peso: 7 },
      { tipo: 'gift_big', peso: 5 },
    ];

    const emitirEvento = (tipo) => {
      switch (tipo) {
        case 'comment':
          this.emit('comment', { user: pick(SIM_NAMES), text: pick(SIM_COMMENTS) });
          break;
        case 'follow':
          this.emit('follow', { user: pick(SIM_NAMES) });
          break;
        case 'join':
          this.emit('join', { user: pick(SIM_NAMES) });
          break;
        case 'share':
          this.emit('share', { user: pick(SIM_NAMES) });
          break;
        case 'likes':
          this.emit('likes', { user: pick(SIM_NAMES), count: 30 + rand(0, 90) });
          break;
        case 'gift_small': {
          const g = pick(SIM_GIFTS_SMALL);
          const repeat = g.coins <= 5 && Math.random() < 0.4 ? rand(1, 9) : 1;
          this.emit('gift', { user: pick(SIM_NAMES), giftName: g.name, coins: g.coins * repeat, repeatCount: repeat });
          break;
        }
        case 'gift_big': {
          const g = pick(SIM_GIFTS_BIG);
          this.emit('gift', { user: pick(SIM_NAMES), giftName: g.name, coins: g.coins, repeatCount: 1 });
          break;
        }
      }
    };

    // Loop auto-agendado: o intervalo varia, com momentos calmos e rajadas ocasionais.
    const proximo = () => {
      const sorte = Math.random();
      let espera;
      if (sorte < 0.12) {
        // MOMENTO CALMO: silêncio longo -> o Teddy puxa papo (fala de ocioso)
        const seg = rand(45, 65);
        log('tiktok', `(simulador) momento calmo — ~${seg}s de silêncio`);
        espera = seg * 1000;
      } else if (sorte < 0.22) {
        // RAJADA: a galera chegando de uma vez (testa prioridade + descarte de boas-vindas)
        const n = rand(4, 8);
        log('tiktok', `(simulador) rajada — ${n} entradas + um presentão`);
        for (let i = 0; i < n; i++) this.emit('join', { user: pick(SIM_NAMES) });
        this.emit('gift', { user: pick(SIM_NAMES), giftName: 'Coroa', coins: 199, repeatCount: 1 });
        espera = rand(10, 16) * 1000;
      } else {
        // EVENTO NORMAL — pausa maior entre eventos dá tempo do Teddy falar a frase inteira
        emitirEvento(weightedPick(EVENTOS));
        espera = rand(9, 18) * 1000;
      }
      // Espectadores sobem aos poucos (alimenta os marcos e o ajuste dinâmico de comentários)
      this.#updateViewers(this.currentViewers + rand(1, 4));
      this.simTimer = setTimeout(proximo, espera);
    };

    // Rajada inicial para feedback imediato, depois entra no loop variado
    setTimeout(() => {
      this.emit('gift', { user: 'TeddyFan', giftName: 'Rosa', coins: 1, repeatCount: 1 });
      this.emit('gift', { user: 'LunaDaPista', giftName: 'Disco Ball', coins: 100, repeatCount: 1 });
      this.emit('comment', { user: 'ReiDoMoonwalk', text: 'faz o moonwalk!' });
      this.#updateViewers(8);
    }, 1500);
    this.simTimer = setTimeout(proximo, 8000);
  }

  // ---------- Live real ----------
  async #connectLive() {
    if (!config.tiktokUsername) {
      throw new Error('TIKTOK_USERNAME não definido no .env (ou use SIMULATOR=true)');
    }
    const { TikTokLiveConnection, WebcastEvent, ControlEvent } = await import('tiktok-live-connector');
    this.connection = new TikTokLiveConnection(config.tiktokUsername);

    this.connection.on(WebcastEvent.GIFT, (data) => {
      // Presentes "streakable" disparam evento a cada repetição;
      // só agradecer quando a sequência termina (repeatEnd).
      if (data.giftType === 1 && !data.repeatEnd) return;
      const coins = (data.diamondCount || 1) * (data.repeatCount || 1);
      this.emit('gift', {
        user: data.user?.nickname || data.user?.uniqueId || 'amigo',
        giftName: data.giftName || data.giftDetails?.giftName || 'presente',
        coins,
        repeatCount: data.repeatCount || 1,
      });
    });

    this.connection.on(WebcastEvent.FOLLOW, (data) => {
      this.emit('follow', { user: data.user?.nickname || data.user?.uniqueId || 'amigo' });
    });

    this.connection.on(WebcastEvent.SHARE, (data) => {
      this.emit('share', { user: data.user?.nickname || data.user?.uniqueId || 'amigo' });
    });

    this.connection.on(WebcastEvent.MEMBER, (data) => {
      this.emit('join', { user: data.user?.nickname || data.user?.uniqueId || 'amigo' });
    });

    this.connection.on(WebcastEvent.ROOM_USER, (data) => {
      this.#updateViewers(Number(data.viewerCount || 0));
    });

    this.connection.on(WebcastEvent.LIKE, (data) => {
      // Por pessoa: quando alguém acumula LIKES_THRESHOLD likes, dispara o moonwalk.
      const user = data.user?.nickname || data.user?.uniqueId || data.uniqueId || 'amigo';
      const key = data.user?.uniqueId || data.uniqueId || user; // chave estável p/ acumular
      const n = data.likeCount || 1;
      const total = (this.likeAccumulator.get(key) || 0) + n;
      if (config.likesDebug) {
        log('tiktok', `[debug like] ${user}: +${n} (acumulado ${total}/${config.likesThreshold}) | likeCount=${data.likeCount} totalLikeCount=${data.totalLikeCount}`);
      }
      if (total >= config.likesThreshold) {
        this.likeAccumulator.set(key, 0);
        log('tiktok', `❤️ ${user} acumulou ${total} likes -> moonwalk`);
        this.emit('likes', { user, count: total });
      } else {
        this.likeAccumulator.set(key, total);
      }
    });

    this.connection.on(WebcastEvent.CHAT, (data) => {
      this.emit('comment', {
        user: data.user?.nickname || data.user?.uniqueId || 'amigo',
        text: data.comment || '',
      });
    });

    this.connection.on(ControlEvent.DISCONNECTED, () => {
      log('tiktok', 'Desconectado da live. Tentando reconectar em 10s...');
      this.emit('disconnected');
      setTimeout(() => this.#connectLive().catch((e) => log('tiktok', 'Reconexão falhou:', e.message)), 10000);
    });

    const state = await this.connection.connect();
    log('tiktok', `Conectado à live de @${config.tiktokUsername} (roomId ${state.roomId})`);
    this.emit('connected', { mode: 'live', roomId: state.roomId });
  }
}

// Execução direta: node src/tiktok.js (loga eventos no console)
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const source = new TikTokSource();
  source.on('gift', (g) => log('evento', `🎁 ${g.user} mandou ${g.repeatCount}x ${g.giftName} (${g.coins} coins)`));
  source.on('follow', (f) => log('evento', `➕ ${f.user} seguiu o canal`));
  source.on('likes', (l) => log('evento', `❤️ ${l.user} mandou ${l.count} likes`));
  source.on('comment', (c) => log('evento', `💬 ${c.user}: ${c.text}`));
  source.start().catch((e) => {
    console.error('Erro ao iniciar:', e.message);
    process.exit(1);
  });
}
