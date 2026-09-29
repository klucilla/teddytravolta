// Conexão com o TikTok Live + modo simulador.
// Emite eventos normalizados: 'gift', 'follow', 'share', 'join', 'likes', 'comment',
// 'milestone', 'connected', 'disconnected'.
import { EventEmitter } from 'node:events';
import { config, log } from './config.js';

// Likes acumulados por pessoa zeram depois deste tempo sem curtir: o moonwalk é para
// rajada, não para a soma da noite inteira.
const LIKES_JANELA_MS = 5 * 60 * 1000;

// Reconexão: espera crescente (10s, 20s, 40s...) até este teto, e tenta até conseguir.
const RECONEXAO_INICIAL_MS = 10000;
const RECONEXAO_MAX_MS = 60000;

// ---------- Normalização dos eventos da live real ----------
// A tiktok-live-connector 2.x entrega o protobuf cru do TikTok, e os nomes dos campos mudam
// entre versões do esquema. Na 2.1.0 era `comment`/`viewerCount`/`likeCount` e o presente
// vinha achatado; na 2.4.2 (tiktok-live-proto v3) virou `content`/`total`/`count` e o
// presente foi para `data.gift`. Ler o campo errado não dá erro — dá undefined em silêncio,
// e o simulador (que já emite eventos normalizados) não percebe. Por isso cada campo tenta
// o nome novo e cai no antigo, e test/tiktok-mapeamento.test.js confere contra o esquema
// instalado.

/** Nome de exibição de quem gerou o evento. */
export function nomeDe(user) {
  return user?.nickname || user?.displayId || user?.uniqueId || 'amigo';
}

/** Identificador estável da pessoa (o apelido muda; o id não), ou null. */
export function idDe(user) {
  const id = user?.idStr || user?.id || user?.displayId || user?.uniqueId;
  return id && String(id) !== '0' ? String(id) : null;
}

/** Presente -> { user, id, giftName, coins, repeatCount }, ou null se ainda não é para agradecer. */
export function normalizarPresente(data) {
  const g = data.gift || data.giftDetails || {};
  const tipo = g.type ?? g.giftType ?? data.giftType;
  // Presente em sequência (streak) gera um evento a cada repetição; só vale o último
  // (repeatEnd). Sem isso, um combo de 10 rosas virava uns 11 agradecimentos.
  const emSequencia = tipo === 1 || g.combo === true;
  if (emSequencia && !data.repeatEnd) return null;
  const repeat = Number(data.repeatCount) || 1;
  const valor = Number(g.diamondCount ?? data.diamondCount) || 1;
  return {
    user: nomeDe(data.user),
    id: idDe(data.user),
    giftName: g.name || g.giftName || data.giftName || 'presente',
    coins: valor * repeat,
    repeatCount: repeat,
  };
}

/** Comentário -> { user, id, text }. */
export function normalizarComentario(data) {
  return { user: nomeDe(data.user), id: idDe(data.user), text: String(data.content ?? data.comment ?? '') };
}

/** Espectadores na sala (o esquema novo manda como texto). */
export function normalizarEspectadores(data) {
  const n = Number(data.total ?? data.viewerCount ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Lote de likes -> { user, id, count }. */
export function normalizarLikes(data) {
  return { user: nomeDe(data.user), id: idDe(data.user), count: Number(data.count ?? data.likeCount) || 1 };
}

/** Follow, share e entrada na sala -> { user, id }. */
export function normalizarPessoa(data) {
  return { user: nomeDe(data.user), id: idDe(data.user) };
}

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
  /**
   * @param {{ criarConexao?: (usuario: string) => object }} [opcoes]
   *   criarConexao: só para testes (conexão falsa no lugar da TikTokLiveConnection).
   */
  constructor({ criarConexao } = {}) {
    super();
    this.connection = null;
    this.simTimer = null;
    this.criarConexao = criarConexao || null;
    this.likeAccumulator = new Map(); // pessoa -> { total, ultimo } (dispara aos LIKES_THRESHOLD por pessoa)
    this.likeEventos = 0;
    this.currentViewers = 0; // espectadores na sala (vem do ROOM_USER)
    this.lastMilestone = 0; // maior marco de espectadores já comemorado
    this.stopped = false;
    this.reconnectTimer = null;
    this.reconnectAttempt = 0;
    this.vistos = new Set(); // msgId já processados (a reconexão reenvia o lote inicial)
    this.formatosVistos = new Set(); // tipos cujo formato já foi logado
    this.ultimoErroLog = 0;
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
    this.stopped = true;
    if (this.simTimer) clearTimeout(this.simTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    if (this.connection) {
      this.connection.removeAllListeners?.();
      Promise.resolve(this.connection.disconnect?.()).catch(() => {});
    }
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

  // Mensagem já vista? A reconexão reprocessa o lote inicial da sala, e sem isso os mesmos
  // presentes eram agradecidos (e somados na meta) de novo.
  #jaVisto(data) {
    const id = data?.common?.msgId ?? data?.msgId;
    if (id === undefined || id === null || String(id) === '0') return false;
    const chave = String(id);
    if (this.vistos.has(chave)) return true;
    this.vistos.add(chave);
    if (this.vistos.size > 5000) this.vistos.delete(this.vistos.values().next().value);
    return false;
  }

  // Loga uma vez as chaves do 1º evento de cada tipo: se a biblioteca mudar o formato de
  // novo, o log mostra na hora em vez de o Teddy ficar mudo em silêncio.
  #registrarFormato(tipo, data) {
    if (this.formatosVistos.has(tipo)) return;
    this.formatosVistos.add(tipo);
    log('tiktok', `formato do 1º evento "${tipo}": ${Object.keys(data || {}).join(', ')}`);
  }

  // Envolve um handler: descarta repetidos, loga o formato e nunca deixa uma exceção escapar.
  #ouvir(evento, tipo, handler) {
    this.connection.on(evento, (data) => {
      try {
        if (this.#jaVisto(data)) return;
        this.#registrarFormato(tipo, data);
        handler(data);
      } catch (e) {
        log('tiktok', `erro ao tratar evento "${tipo}": ${e.message}`);
      }
    });
  }

  #onLike(data) {
    // Por pessoa: quando alguém acumula LIKES_THRESHOLD likes (dentro da janela), dispara o moonwalk.
    const { user, id, count } = normalizarLikes(data);
    const key = id || user; // chave estável p/ acumular
    const agora = Date.now();
    const anterior = this.likeAccumulator.get(key);
    const base = anterior && agora - anterior.ultimo <= LIKES_JANELA_MS ? anterior.total : 0;
    const total = base + count;
    if (config.likesDebug) {
      log('tiktok', `[debug like] ${user}: +${count} (acumulado ${total}/${config.likesThreshold}) | count=${data.count} total=${data.total}`);
    }
    if (total >= config.likesThreshold) {
      this.likeAccumulator.delete(key);
      log('tiktok', `❤️ ${user} acumulou ${total} likes -> moonwalk`);
      this.emit('likes', { user, id, count: total });
    } else {
      this.likeAccumulator.set(key, { total, ultimo: agora });
    }
    // Faxina de quem parou de curtir (o Map crescia a noite toda numa live longa)
    if (++this.likeEventos % 200 === 0) {
      for (const [k, v] of this.likeAccumulator) {
        if (agora - v.ultimo > LIKES_JANELA_MS) this.likeAccumulator.delete(k);
      }
    }
  }

  async #connectLive({ reconexao = false } = {}) {
    if (!config.tiktokUsername) {
      throw new Error('TIKTOK_USERNAME não definido no .env (ou use SIMULATOR=true)');
    }
    const { TikTokLiveConnection, WebcastEvent, ControlEvent } = await import('tiktok-live-connector');
    // A conexão anterior (se houver) não pode mais disparar nada
    if (this.connection) this.connection.removeAllListeners?.();
    this.connection = this.criarConexao
      ? this.criarConexao(config.tiktokUsername)
      : new TikTokLiveConnection(config.tiktokUsername);

    this.#ouvir(WebcastEvent.GIFT, 'gift', (data) => {
      const presente = normalizarPresente(data);
      if (presente) this.emit('gift', presente);
    });
    this.#ouvir(WebcastEvent.FOLLOW, 'follow', (data) => this.emit('follow', normalizarPessoa(data)));
    this.#ouvir(WebcastEvent.SHARE, 'share', (data) => this.emit('share', normalizarPessoa(data)));
    this.#ouvir(WebcastEvent.MEMBER, 'member', (data) => this.emit('join', normalizarPessoa(data)));
    this.#ouvir(WebcastEvent.ROOM_USER, 'roomUser', (data) => this.#updateViewers(normalizarEspectadores(data)));
    this.#ouvir(WebcastEvent.LIKE, 'like', (data) => this.#onLike(data));
    this.#ouvir(WebcastEvent.CHAT, 'chat', (data) => this.emit('comment', normalizarComentario(data)));

    this.connection.on(WebcastEvent.STREAM_END, () => {
      log('tiktok', 'a live terminou ou foi suspensa pelo TikTok');
    });
    // A biblioteca só emite erro se houver ouvinte; sem ele, falhas (inclusive de decodificação,
    // que denunciariam mudança de formato) sumiam sem rastro. Loga no máximo 1 a cada 30s.
    this.connection.on(ControlEvent.ERROR, (err) => {
      if (Date.now() - this.ultimoErroLog < 30000) return;
      this.ultimoErroLog = Date.now();
      log('tiktok', `erro na conexão: ${err?.info || ''} ${err?.exception?.message || ''}`.trim());
    });
    this.connection.on(ControlEvent.DISCONNECTED, () => {
      if (this.stopped) return;
      log('tiktok', 'Desconectado da live.');
      this.emit('disconnected');
      this.#agendarReconexao();
    });

    const state = await this.connection.connect();
    this.reconnectAttempt = 0;
    log('tiktok', `${reconexao ? 'Reconectado' : 'Conectado'} à live de @${config.tiktokUsername} (roomId ${state?.roomId})`);
    this.emit('connected', { mode: 'live', roomId: state?.roomId });
  }

  // Tenta de novo até conseguir (ou até stop()). Antes era uma tentativa só: se a live ainda
  // estivesse fora do ar 10s depois da queda, o bot ficava surdo pelo resto da noite enquanto
  // o OBS seguia transmitindo.
  #agendarReconexao() {
    if (this.stopped || this.reconnectTimer) return;
    const espera = Math.min(RECONEXAO_INICIAL_MS * 2 ** this.reconnectAttempt, RECONEXAO_MAX_MS);
    this.reconnectAttempt++;
    log('tiktok', `tentando reconectar em ${espera / 1000}s (tentativa ${this.reconnectAttempt})`);
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (this.stopped) return;
      try {
        await this.#connectLive({ reconexao: true });
      } catch (e) {
        log('tiktok', `reconexão falhou: ${e.message}`);
        this.#agendarReconexao();
      }
    }, espera);
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
