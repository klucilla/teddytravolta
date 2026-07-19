import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const bool = (v, def = false) =>
  v === undefined ? def : ['true', '1', 'sim', 'yes'].includes(String(v).toLowerCase());

export const ROOT_DIR = path.resolve(__dirname, '..');
export const AUDIO_CACHE_DIR = path.join(ROOT_DIR, 'assets', 'audio', 'cache');

const danceScenes = (process.env.OBS_SCENE_DANCE || 'danca_loop')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export const config = {
  tiktokUsername: process.env.TIKTOK_USERNAME || '',
  simulator: bool(process.env.SIMULATOR) || process.argv.includes('--simulator'),
  simulatorIntervalMs: Number(process.env.SIMULATOR_INTERVAL_MS) || 10000,

  obs: {
    host: process.env.OBS_HOST || '127.0.0.1',
    port: Number(process.env.OBS_PORT) || 4455,
    password: process.env.OBS_PASSWORD || '',
    // Uma ou mais cenas de dança (separadas por vírgula). O sistema alterna
    // entre elas quando está ocioso, dando variedade ao loop.
    danceScenes: danceScenes,
    sceneDance: danceScenes[0], // primária (fallback e checagens)
    sceneCelebration: process.env.OBS_SCENE_CELEBRATION || 'comemoracao',
    // Cena do urso falando calmamente (follows/likes). Vazio = desativada.
    sceneTalk: process.env.OBS_SCENE_TALK || '',
    // Cena do urso indo ao bar (compartilhamentos). Vazio = desativada.
    sceneShare: process.env.OBS_SCENE_SHARE || '',
    // Cena do urso dando boas-vindas (entrada na sala). Vazio = desativada.
    sceneWelcome: process.env.OBS_SCENE_WELCOME || '',
    // Cena do urso fazendo moonwalk (rajada de likes). Vazio = desativada.
    sceneMoonwalk: process.env.OBS_SCENE_MOONWALK || '',
  },

  ttsVoice: process.env.TTS_VOICE || 'pt-BR-AntonioNeural',
  overlayPort: Number(process.env.OVERLAY_PORT) || 3000,
  // Por segurança o overlay escuta só localmente. Se o OBS rodar em OUTRA máquina
  // da rede, defina OVERLAY_HOST=0.0.0.0 explicitamente (e saiba o que está fazendo).
  overlayHost: process.env.OVERLAY_HOST || '127.0.0.1',

  // Bordão "cantado" por TTS (á á á stayin {nome}!) antes da frase, em presentes grandes
  chant: bool(process.env.CHANT, false),

  // Vinheta cantada (MP3, ex.: gerada no Suno) tocada antes da frase em presentes
  // grandes. Tem prioridade sobre o CHANT. Vazio/inexistente = desativada.
  jingleFile: process.env.JINGLE_FILE ? path.resolve(ROOT_DIR, process.env.JINGLE_FILE) : '',

  thankFollows: bool(process.env.THANK_FOLLOWS, true),
  thankLikes: bool(process.env.THANK_LIKES, false),
  // Likes que UMA pessoa precisa acumular para disparar o moonwalk
  likesThreshold: Number(process.env.LIKES_THRESHOLD) || 50,
  // Loga CADA like recebido (diagnóstico) — desligue depois de testar
  likesDebug: bool(process.env.LIKES_DEBUG, false),

  // Boas-vindas a quem entra na sala: agradecer só 1 a cada N entradas
  // (lives movimentadas têm MUITAS entradas). 0 desliga as boas-vindas.
  welcomeEvery: Number(process.env.WELCOME_EVERY) || 10,

  // Limiar de coins entre presente pequeno e grande
  bigGiftCoins: 100,

  // Alternar entre as cenas de dança a cada N segundos quando ocioso (0 desliga)
  danceRotateSeconds: Number(process.env.DANCE_ROTATE_SECONDS) || 25,

  // Descarta boas-vindas (entrada) se já houver esta qtde de itens esperando na fila
  // (evita "fulano entrou" atrasado quando entra muita gente de uma vez). 0 = nunca descarta.
  queueDropWelcomeAfter: Number(process.env.QUEUE_DROP_WELCOME_AFTER) || 3,

  // Falas de engajamento: se ninguém interagir por N segundos, o Teddy puxa papo (0 desliga)
  idlePromptSeconds: Number(process.env.IDLE_PROMPT_SECONDS) || 40,

  // Comemora ao bater cada múltiplo de N espectadores na sala (0 desliga)
  milestoneEvery: Number(process.env.MILESTONE_EVERY) || 10,

  // ===== Meta da live (barra de progresso no overlay) =====
  meta: {
    // O que a meta conta: "followers" (novos seguidores da live), "coins" (presentes) ou "off"
    type: (process.env.META_TYPE || 'followers').toLowerCase(),
    target: Number(process.env.META_TARGET) || 5,
    // Quando bate, a próxima meta sobe este tanto (o progresso acumulado continua)
    step: Number(process.env.META_STEP) || 5,
  },

  // ===== Desafio-relâmpago (o 1º a mandar o gatilho no chat vence) =====
  challenge: {
    everyMin: Number(process.env.CHALLENGE_EVERY_MIN) || 6, // 0 desliga
    windowSec: Number(process.env.CHALLENGE_WINDOW_SEC) || 90,
  },

  // ===== IA local (Ollama) =====
  llm: {
    enabled: bool(process.env.LLM_ENABLED, false),
    host: process.env.LLM_HOST || 'http://localhost:11434',
    model: process.env.LLM_MODEL || 'qwen2.5:7b-instruct',
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS) || 4000,
    // Usar a IA para gerar as frases de agradecimento (com fallback nas listas fixas)
    phrases: bool(process.env.LLM_PHRASES, true),
    // Teddy responder comentários do chat por voz
    comments: bool(process.env.LLM_COMMENTS, true),
    // Responder só 1 a cada N comentários (chat costuma ser intenso)
    commentEvery: Number(process.env.LLM_COMMENT_EVERY) || 4,
    // Com público pequeno (espectadores <= este valor) responde TODO comentário (1 a cada 1)
    commentBusyViewers: Number(process.env.LLM_COMMENT_BUSY_VIEWERS) || 20,
    // Mantém o modelo carregado no Ollama por este tempo (evita recarregar/cold start)
    keepAlive: process.env.LLM_KEEP_ALIVE || '30m',
  },
};

export function log(scope, ...args) {
  const ts = new Date().toLocaleTimeString('pt-BR');
  console.log(`[${ts}] [${scope}]`, ...args);
}
