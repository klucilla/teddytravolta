// Orquestrador: TikTok Live -> fila de agradecimentos -> TTS + áudio + OBS + overlay.
import { config, log } from './config.js';
import { warmup } from './llm.js';
import { cleanupOldCache } from './tts.js';
import { ObsController } from './obs.js';
import { OverlayServer } from './overlay-server.js';
import { ThankQueue } from './queue.js';
import { TikTokSource } from './tiktok.js';

async function main() {
  log('teddy', '🕺🐻 Teddy Travolta Live iniciando...');
  log('teddy', `modo: ${config.simulator ? 'SIMULADOR' : `live de @${config.tiktokUsername}`}`);

  const overlay = new OverlayServer();
  await overlay.start();

  const obs = new ObsController();
  await obs.connect(); // não bloqueia se OBS estiver fechado

  warmup(); // pré-carrega o modelo da IA em paralelo (não bloqueia o início)
  cleanupOldCache(); // remove áudios TTS antigos do cache (melhor-esforço, em paralelo)

  // Marca quando algo aconteceu por último (para as falas de engajamento no ocioso)
  let lastActivity = Date.now();
  const bump = () => { lastActivity = Date.now(); };

  const queue = new ThankQueue({
    onAnnounce: (a) => {
      bump();
      overlay.broadcast(a);
      if (a.celebrationSeconds > 0) {
        obs.celebrate(a.celebrationSeconds); // presentes/marcos: festa
      } else if (a.shareSeconds > 0 && config.obs.sceneShare) {
        obs.showTemporary(config.obs.sceneShare, a.shareSeconds); // share: tequila no bar
      } else if (a.welcomeSeconds > 0 && config.obs.sceneWelcome) {
        obs.showTemporary(config.obs.sceneWelcome, a.welcomeSeconds); // entrada: boas-vindas
      } else if (a.moonwalkSeconds > 0 && config.obs.sceneMoonwalk) {
        obs.showTemporary(config.obs.sceneMoonwalk, a.moonwalkSeconds); // rajada de likes: moonwalk
      } else if (a.talkSeconds > 0 && config.obs.sceneTalk) {
        obs.showTemporary(config.obs.sceneTalk, a.talkSeconds); // follows/comentários/ocioso: urso falando
      }
    },
    // O ocioso conta a partir do FIM da fala, não do começo: senão o tempo que o Teddy
    // passou falando entra na conta e ele emenda "tá todo mundo quieto" logo depois de
    // uma fala longa (quanto mais longa a frase da IA, mais cedo o ocioso dispara).
    onDone: () => bump(),
  });

  // ===== Meta da live (barra de progresso no overlay) =====
  const metaAtiva = config.meta.type === 'followers' || config.meta.type === 'coins';
  let metaAtual = 0;
  let metaAlvo = config.meta.target;
  const metaLabel = () =>
    config.meta.type === 'coins'
      ? `🪙 Meta de coins da live: ${metaAtual}/${metaAlvo}`
      : `➕ Meta de novos seguidores: ${metaAtual}/${metaAlvo}`;
  const metaBroadcast = () => {
    if (metaAtiva) overlay.broadcast({ type: 'meta_progress', current: metaAtual, target: metaAlvo, label: metaLabel() });
  };
  const metaAdd = (n) => {
    if (!metaAtiva || n <= 0) return;
    metaAtual += n;
    if (metaAtual >= metaAlvo) {
      queue.push({ type: 'meta', metaTipo: config.meta.type, alvo: metaAlvo, value: metaAtual });
      // Próxima meta sempre à frente do acumulado (um presentão pode pular várias)
      while (metaAlvo <= metaAtual) metaAlvo += config.meta.step;
      log('meta', `meta batida! próxima: ${metaAlvo}`);
    }
    metaBroadcast();
  };
  if (metaAtiva) setInterval(metaBroadcast, 20000); // reenvia p/ overlays que conectarem depois

  // ===== Desafio-relâmpago: o 1º a mandar o gatilho no chat vence =====
  const DESAFIOS = [
    { trigger: '🌹', anuncio: 'Desafio-relâmpago! O primeiro que mandar o emoji de rosa no chat ganha um salve especial do Teddy!' },
    { trigger: 'TRAVOLTA', anuncio: 'Desafio-relâmpago! O primeiro que escrever TRAVOLTA no chat ganha um salve especial!' },
    { trigger: '🕺', anuncio: 'Desafio! Manda o emoji do dançarino no chat — o primeiro leva um salve do Teddy!' },
    { trigger: 'TEDDY', anuncio: 'Desafio! O primeiro que gritar TEDDY no chat ganha um salve especial!' },
  ];
  let desafioAtivo = null; // { trigger, until }
  if (config.challenge.everyMin > 0) {
    setInterval(() => {
      // Expira desafio antigo mesmo sem comentários (senão nunca lança outro)
      if (desafioAtivo && Date.now() > desafioAtivo.until) {
        log('desafio', `expirou sem vencedor ("${desafioAtivo.trigger}")`);
        desafioAtivo = null;
      }
      if (desafioAtivo || queue.size > 0 || queue.busy) return; // só lança em momento tranquilo
      const d = DESAFIOS[Math.floor(Math.random() * DESAFIOS.length)];
      desafioAtivo = { trigger: d.trigger.toLowerCase(), until: Date.now() + config.challenge.windowSec * 1000 };
      bump();
      queue.push({ type: 'challenge', trigger: d.trigger, anuncio: d.anuncio, windowSec: config.challenge.windowSec });
      log('desafio', `lançado: "${d.trigger}" valendo por ${config.challenge.windowSec}s`);
    }, config.challenge.everyMin * 60 * 1000);
  }

  const tiktok = new TikTokSource();
  tiktok.on('gift', (g) => {
    bump();
    queue.push({ type: 'gift', ...g });
    if (config.meta.type === 'coins') metaAdd(g.coins || 0);
  });
  tiktok.on('follow', (f) => {
    bump();
    if (config.thankFollows) queue.push({ type: 'follow', ...f });
    if (config.meta.type === 'followers') metaAdd(1);
  });
  tiktok.on('share', (s) => { bump(); queue.push({ type: 'share', ...s }); });
  // Boas-vindas só 1 a cada N entradas (lives movimentadas têm MUITAS entradas)
  let joinCount = 0;
  tiktok.on('join', (j) => {
    bump();
    if (config.welcomeEvery <= 0) return;
    joinCount++;
    if (joinCount % config.welcomeEvery === 0) queue.push({ type: 'join', ...j });
  });
  tiktok.on('likes', (l) => {
    bump();
    if (config.thankLikes) queue.push({ type: 'likes', ...l });
  });
  // Comemora marcos de espectadores (10, 20, 30... conforme MILESTONE_EVERY)
  tiktok.on('milestone', (m) => { bump(); queue.push({ type: 'milestone', ...m }); });
  // Comentários: loga sempre; responde por voz. Com público pequeno, responde TODOS;
  // com público grande, só 1 a cada LLM_COMMENT_EVERY (chat fica intenso).
  let commentCount = 0;
  tiktok.on('comment', (c) => {
    bump();
    log('chat', `${c.user}: ${c.text}`);
    // Desafio-relâmpago: o primeiro comentário com o gatilho vence
    if (desafioAtivo) {
      if (Date.now() > desafioAtivo.until) {
        log('desafio', `expirou sem vencedor ("${desafioAtivo.trigger}")`);
        desafioAtivo = null;
      } else if ((c.text || '').toLowerCase().includes(desafioAtivo.trigger)) {
        log('desafio', `🏆 vencedor: ${c.user}`);
        desafioAtivo = null;
        queue.push({ type: 'challenge_win', ...c });
        return; // o campeão já ganha o anúncio; não precisa da resposta normal da IA
      }
    }
    if (!config.llm.enabled || !config.llm.comments) return;
    commentCount++;
    const every = (tiktok.currentViewers || 0) > config.llm.commentBusyViewers ? config.llm.commentEvery : 1;
    if (commentCount % every === 0) queue.push({ type: 'comment', ...c });
  });
  tiktok.on('connected', (info) => log('teddy', `TikTok conectado (${info.mode})`));
  tiktok.on('disconnected', () => log('teddy', 'TikTok desconectado'));

  await tiktok.start();
  log('teddy', '✅ tudo pronto! Aguardando eventos...');

  // Falas de engajamento: se ninguém interagir por IDLE_PROMPT_SECONDS, o Teddy puxa papo.
  let idleTimer = null;
  if (config.idlePromptSeconds > 0) {
    idleTimer = setInterval(() => {
      if (queue.size === 0 && !queue.busy && Date.now() - lastActivity >= config.idlePromptSeconds * 1000) {
        bump();
        queue.push({ type: 'idle' });
      }
    }, 5000);
  }

  const shutdown = async () => {
    log('teddy', 'encerrando...');
    if (idleTimer) clearInterval(idleTimer);
    tiktok.stop();
    overlay.stop();
    await obs.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  console.error('Erro fatal:', e);
  process.exit(1);
});
