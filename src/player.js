// Reprodução de áudio no Windows.
// Preferência: ffplay (sem janela, confiável p/ MP3). Fallback: PowerShell MediaPlayer.
import { spawn } from 'node:child_process';
import { log } from './config.js';

let ffplayAvailable = null;

/**
 * Duração do áudio em segundos via ffprobe, ou null se indisponível.
 * Usada para manter a cena de comemoração no ar enquanto o Teddy "fala".
 */
export function audioDurationSeconds(file) {
  return new Promise((resolve) => {
    const p = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.on('error', () => resolve(null));
    p.on('exit', (code) => {
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

function playWithFfplay(file) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffplay', ['-nodisp', '-autoexit', '-loglevel', 'quiet', file], {
      stdio: 'ignore',
    });
    p.on('error', reject);
    p.on('exit', () => resolve());
  });
}

// Fallback nativo: WPF MediaPlayer via PowerShell (suporta MP3, sem janela).
function playWithPowerShell(file) {
  const script = `
    Add-Type -AssemblyName PresentationCore;
    $p = New-Object System.Windows.Media.MediaPlayer;
    $p.Open([Uri]::new('${file.replace(/'/g, "''")}'));
    while (-not $p.NaturalDuration.HasTimeSpan) { Start-Sleep -Milliseconds 100 };
    $p.Play();
    Start-Sleep -Milliseconds ($p.NaturalDuration.TimeSpan.TotalMilliseconds + 300);
    $p.Close();
  `;
  return new Promise((resolve, reject) => {
    const p = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
      stdio: 'ignore',
    });
    p.on('error', reject);
    p.on('exit', () => resolve());
  });
}

/**
 * Toca o arquivo de áudio e só resolve quando terminar (essencial p/ fila).
 */
export async function play(file) {
  if (ffplayAvailable === null) {
    ffplayAvailable = await checkFfplay();
    log('player', ffplayAvailable ? 'usando ffplay' : 'ffplay não encontrado, usando PowerShell MediaPlayer');
  }
  if (ffplayAvailable) {
    try {
      await playWithFfplay(file);
      return;
    } catch (e) {
      log('player', `ffplay falhou (${e.message}), tentando PowerShell`);
      ffplayAvailable = false;
    }
  }
  await playWithPowerShell(file);
}
