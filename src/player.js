// Reprodução de áudio no Windows.
// Preferência: ffplay (sem janela, confiável p/ MP3). Fallback: PowerShell MediaPlayer.
// Todo processo tem prazo: um player pendurado segurava a fila para sempre (o Teddy
// emudecia até o fim da live, e o ocioso e o desafio paravam junto, porque esperam a fila).
import { spawn } from 'node:child_process';
import { log } from './config.js';

let ffplayAvailable = null;
let tocando = null; // processo tocando agora (o encerramento precisa conseguir calar)

/**
 * Duração do áudio em segundos via ffprobe, ou null se indisponível.
 * Usada para manter a cena de comemoração no ar enquanto o Teddy "fala".
 */
export function audioDurationSeconds(file) {
  return new Promise((resolve) => {
    const p = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
    const watchdog = setTimeout(() => p.kill(), 5000);
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.on('error', () => {
      clearTimeout(watchdog);
      resolve(null);
    });
    p.on('exit', (code) => {
      clearTimeout(watchdog);
      const dur = parseFloat(out.trim());
      resolve(code === 0 && Number.isFinite(dur) ? dur : null);
    });
  });
}

function checkFfplay() {
  return new Promise((resolve) => {
    const p = spawn('ffplay', ['-version'], { stdio: 'ignore', shell: false });
    p.on('error', () => resolve(false));
    p.on('exit', (code) => resolve(code === 0));
  });
}

// Roda um player e resolve quando ele termina — ou quando estoura o prazo (aí é encerrado).
function tocarCom(cmd, args, opts, prazoMs) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'ignore', ...opts });
    tocando = p;
    let estourou = false;
    const watchdog = setTimeout(() => {
      estourou = true;
      p.kill();
    }, prazoMs);
    const fim = () => {
      clearTimeout(watchdog);
      if (tocando === p) tocando = null;
    };
    p.on('error', (e) => {
      fim();
      reject(e);
    });
    p.on('exit', (code) => {
      fim();
      if (estourou) log('player', `${cmd} passou de ${Math.round(prazoMs / 1000)}s e foi encerrado`);
      else if (code) log('player', `${cmd} saiu com código ${code}`);
      resolve();
    });
  });
}

function playWithFfplay(file, prazoMs) {
  return tocarCom('ffplay', ['-nodisp', '-autoexit', '-loglevel', 'quiet', file], {}, prazoMs);
}

// Fallback nativo: WPF MediaPlayer via PowerShell (suporta MP3, sem janela).
// O caminho vai por variável de ambiente, não colado no script: o PowerShell trata as aspas
// tipográficas (’ ‘) como aspas simples, e um caminho com "D’Ávila" quebrava o comando.
// Se o arquivo não abrir em 5s (MP3 corrompido, Windows N sem Media Feature Pack), desiste
// em vez de ficar esperando a duração para sempre.
function playWithPowerShell(file, prazoMs) {
  const script = `
    Add-Type -AssemblyName PresentationCore;
    $p = New-Object System.Windows.Media.MediaPlayer;
    $p.Open([Uri]::new($env:TEDDY_AUDIO_FILE));
    $n = 0;
    while (-not $p.NaturalDuration.HasTimeSpan) { Start-Sleep -Milliseconds 100; $n++; if ($n -ge 50) { $p.Close(); exit 1 } };
    $p.Play();
    Start-Sleep -Milliseconds ($p.NaturalDuration.TimeSpan.TotalMilliseconds + 300);
    $p.Close();
  `;
  return tocarCom(
    'powershell',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    { env: { ...process.env, TEDDY_AUDIO_FILE: file } },
    prazoMs + 6000 // + o tempo de abrir o PowerShell e carregar o arquivo
  );
}

/**
 * Toca o arquivo de áudio e só resolve quando terminar (essencial p/ fila).
 * `maxSeconds`: prazo máximo (a fila passa a duração medida + folga); sem ele, 2 minutos.
 */
export async function play(file, { maxSeconds = 120 } = {}) {
  const prazoMs = Math.max(1, maxSeconds) * 1000;
  if (ffplayAvailable === null) {
    ffplayAvailable = await checkFfplay();
    log('player', ffplayAvailable ? 'usando ffplay' : 'ffplay não encontrado, usando PowerShell MediaPlayer');
  }
  if (ffplayAvailable) {
    try {
      await playWithFfplay(file, prazoMs);
      return;
    } catch (e) {
      log('player', `ffplay falhou (${e.message}), tentando PowerShell`);
      ffplayAvailable = false;
    }
  }
  await playWithPowerShell(file, prazoMs);
}

/** Interrompe o áudio em andamento (usado no encerramento). */
export function stopPlayback() {
  if (tocando) tocando.kill();
}
