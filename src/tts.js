// Edge TTS (gratuito, sem API key) com cache de áudios em disco.
// Gera MP3 em assets/audio/cache/<hash-da-frase>.mp3 e reusa se já existir.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { AUDIO_CACHE_DIR, config, log } from './config.js';

const EMOJI_RE = /[\p{Extended_Pictographic}\p{Emoji_Component}]/gu;
const URL_RE = /https?:\/\/\S+|www\.\S+/gi;

/**
 * Remove emojis, links e caracteres especiais do nome de usuário.
 * Mantém letras (com acentos), números e espaços. Vazio vira "amigo".
 */
export function sanitizeName(raw) {
  if (!raw) return 'amigo';
  const clean = String(raw)
    .replace(URL_RE, ' ')
    .replace(EMOJI_RE, ' ')
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
  return clean || 'amigo';
}

// O texto é inserido em SSML pelo msedge-tts; escapar entidades XML.
function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function cacheFileFor(text) {
  const hash = createHash('sha1').update(`${config.ttsVoice}|${text}`).digest('hex');
  return path.join(AUDIO_CACHE_DIR, `${hash}.mp3`);
}

/**
 * Gera (ou reusa do cache) o áudio MP3 da frase. Retorna o caminho do arquivo.
 */
export async function synthesize(text) {
  await fs.mkdir(AUDIO_CACHE_DIR, { recursive: true });
  const file = cacheFileFor(text);

  try {
    const stat = await fs.stat(file);
    if (stat.size > 0) {
      log('tts', `cache HIT: "${text}"`);
      return file;
    }
  } catch {
    // não existe, gerar
  }

  log('tts', `gerando: "${text}" (${config.ttsVoice})`);
  const tts = new MsEdgeTTS();
  await tts.setMetadata(config.ttsVoice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

  const tmp = `${file}.tmp`;
  const { audioStream } = tts.toStream(escapeXml(text));
  const chunks = [];
  for await (const chunk of audioStream) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);
  if (buffer.length === 0) throw new Error('Edge TTS retornou áudio vazio');

  await fs.writeFile(tmp, buffer);
  await fs.rename(tmp, file);
  return file;
}

/**
 * Limpa do cache os áudios não usados há mais de N dias (o cache cresceria sem
 * limite com as frases únicas geradas pela IA). Chamada uma vez na inicialização.
 */
export async function cleanupOldCache(maxAgeDays = 14) {
  try {
    const limite = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    const files = await fs.readdir(AUDIO_CACHE_DIR).catch(() => []);
    let removidos = 0;
    for (const f of files) {
      if (!f.endsWith('.mp3')) continue;
      const p = path.join(AUDIO_CACHE_DIR, f);
      const st = await fs.stat(p).catch(() => null);
      if (st && st.mtimeMs < limite) {
        await fs.unlink(p).catch(() => {});
        removidos++;
      }
    }
    if (removidos > 0) log('tts', `cache: ${removidos} áudio(s) antigos removidos`);
  } catch {
    // limpeza é melhor-esforço; nunca impede o sistema de subir
  }
}

async function synthBuffer(text, prosody = {}) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(config.ttsVoice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(escapeXml(text), prosody);
  const chunks = [];
  for await (const chunk of audioStream) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);
  if (buffer.length === 0) throw new Error('Edge TTS retornou áudio vazio');
  return buffer;
}

// Emenda os MP3s removendo o silêncio que o Edge TTS deixa em volta de cada
// trecho, com uma pausa rítmica de ~0,1s entre eles (senão o "canto" se arrasta).
function concatMp3(files, output) {
  return new Promise((resolve, reject) => {
    const inputs = files.flatMap((f) => ['-i', f]);
    const trim = 'silenceremove=start_periods=1:start_threshold=-40dB,areverse,' +
      'silenceremove=start_periods=1:start_threshold=-40dB,areverse';
    const chains = files
      .map((_, i) => {
        const pad = i < files.length - 1 ? ',apad=pad_dur=0.1' : '';
        return `[${i}:a]${trim}${pad}[a${i}]`;
      })
      .join(';');
    const filter = `${chains};${files.map((_, i) => `[a${i}]`).join('')}concat=n=${files.length}:v=0:a=1[out]`;
    const p = spawn('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex', filter, '-map', '[out]', '-q:a', '4', output]);
    p.on('error', reject);
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg saiu com código ${code}`))));
  });
}

// Notas do "canto" robótico: tons sobem a cada sílaba (melodia genérica,
// de propósito — NÃO é a melodia de Stayin' Alive, que é protegida).
const CHANT_NOTES = [
  { text: 'á!', pitch: '+0Hz' },
  { text: 'á!', pitch: '+45Hz' },
  { text: 'á!', pitch: '+90Hz' },
];

/**
 * Bordão "cantado": "á, á, á, stayin' {nome}!" com tons crescentes.
 * Gera cada nota separada no Edge TTS e emenda com ffmpeg. Cache por nome.
 */
export async function synthesizeChant(nome) {
  await fs.mkdir(AUDIO_CACHE_DIR, { recursive: true });
  const hash = createHash('sha1').update(`chant3|${config.ttsVoice}|${nome}`).digest('hex');
  const file = path.join(AUDIO_CACHE_DIR, `${hash}.mp3`);

  try {
    const stat = await fs.stat(file);
    if (stat.size > 0) {
      log('tts', `cache HIT (bordão): ${nome}`);
      return file;
    }
  } catch {
    // não existe, gerar
  }

  log('tts', `gerando bordão: "á á á stayin ${nome}!"`);
  const parts = [...CHANT_NOTES, { text: `stêinn ${nome}!`, pitch: '+70Hz', rate: 0.85 }];
  const tmpFiles = [];
  try {
    for (let i = 0; i < parts.length; i++) {
      const { text, ...prosody } = parts[i];
      const buf = await synthBuffer(text, prosody);
      const tmp = path.join(AUDIO_CACHE_DIR, `${hash}.part${i}.mp3`);
      await fs.writeFile(tmp, buf);
      tmpFiles.push(tmp);
    }
    await concatMp3(tmpFiles, file);
  } finally {
    await Promise.all(tmpFiles.map((f) => fs.unlink(f).catch(() => {})));
  }
  return file;
}

// Execução direta: node src/tts.js "frase opcional"
if (process.argv[1] && /tts\.js$/.test(process.argv[1].replace(/\\/g, '/'))) {
  const text = process.argv.slice(2).filter((a) => !a.startsWith('--')).join(' ') || 'Valeu, TeddyFan! Você é demais!';
  synthesize(text)
    .then((file) => {
      log('tts', `OK -> ${file}`);
      process.exit(0);
    })
    .catch((e) => {
      console.error('Erro no TTS:', e);
      process.exit(1);
    });
}
