// Controle do OBS via obs-websocket-js v5.
// Tolerante a falhas: se o OBS estiver fechado, o resto do sistema continua;
// reconecta automaticamente a cada 5s.
import OBSWebSocket from 'obs-websocket-js';
import { config, log } from './config.js';

const RECONNECT_MS = 5000;

export class ObsController {
  constructor() {
    this.obs = new OBSWebSocket();
    this.connected = false;
    this.reconnectTimer = null;
    this.celebrationTimer = null;
    this.idleTimer = null;
    this.currentDance = null;
    this.stopped = false;

    this.obs.on('ConnectionClosed', () => {
      if (this.connected) log('obs', 'conexão perdida, tentando reconectar...');
      this.connected = false;
      this.#scheduleReconnect();
    });
  }

  async connect() {
    if (this.stopped) return;
    const url = `ws://${config.obs.host}:${config.obs.port}`;
    try {
      await this.obs.connect(url, config.obs.password || undefined);
      this.connected = true;
      log('obs', `conectado em ${url}`);
      const { currentProgramSceneName } = await this.obs.call('GetCurrentProgramScene');
      log('obs', `cena atual: ${currentProgramSceneName}`);
      this.currentDance = currentProgramSceneName;
      this.#startIdleRotation();
    } catch (e) {
      this.connected = false;
      log('obs', `OBS indisponível (${e.message || e.code}). Sistema segue sem OBS; nova tentativa em ${RECONNECT_MS / 1000}s`);
      this.#scheduleReconnect();
    }
  }

  #scheduleReconnect() {
    if (this.stopped || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, RECONNECT_MS);
  }

  async #setScene(name) {
    if (!this.connected) {
      log('obs', `(desconectado) ignorando troca para "${name}"`);
      return false;
    }
    try {
      await this.obs.call('SetCurrentProgramScene', { sceneName: name });
      log('obs', `cena -> ${name}`);
      return true;
    } catch (e) {
      log('obs', `falha ao trocar para "${name}": ${e.message}`);
      return false;
    }
  }

  // Escolhe uma cena de dança aleatória, evitando repetir a atual quando possível.
  #pickDance() {
    const opcoes = config.obs.danceScenes;
    if (opcoes.length <= 1) return opcoes[0];
    const outras = opcoes.filter((s) => s !== this.currentDance);
    return outras[Math.floor(Math.random() * outras.length)];
  }

  async #goToDance() {
    const cena = this.#pickDance();
    this.currentDance = cena;
    await this.#setScene(cena);
  }

  // Rotação ociosa: troca de dança a cada N segundos quando nada está acontecendo.
  #startIdleRotation() {
    if (this.idleTimer || config.danceRotateSeconds <= 0 || config.obs.danceScenes.length <= 1) return;
    this.idleTimer = setInterval(() => {
      if (this.connected && !this.celebrationTimer) this.#goToDance();
    }, config.danceRotateSeconds * 1000);
  }

  /**
   * Troca para uma cena temporária e volta sozinho para a dança após `seconds`.
   * Trocas em sequência apenas estendem/substituem o timer (não empilham).
   */
  async showTemporary(sceneName, seconds) {
    if (!sceneName || seconds <= 0) return;
    const ok = await this.#setScene(sceneName);
    if (!ok) return;
    if (this.celebrationTimer) clearTimeout(this.celebrationTimer);
    this.celebrationTimer = setTimeout(() => {
      this.celebrationTimer = null;
      this.#goToDance(); // volta para uma dança (sorteada entre as variações)
    }, seconds * 1000);
  }

  /** Atalho: cena de comemoração (presentes). */
  celebrate(seconds) {
    return this.showTemporary(config.obs.sceneCelebration, seconds);
  }

  async stop() {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.celebrationTimer) clearTimeout(this.celebrationTimer);
    if (this.idleTimer) clearInterval(this.idleTimer);
    try {
      await this.obs.disconnect();
    } catch {
      // já desconectado
    }
  }
}

// Execução direta: node src/obs.js — valida conexão/reconexão e troca de cenas
if (process.argv[1] && /obs\.js$/.test(process.argv[1].replace(/\\/g, '/'))) {
  const controller = new ObsController();
  await controller.connect();
  if (controller.connected) {
    log('obs', 'testando comemoração de 3s...');
    await controller.celebrate(3);
    setTimeout(async () => {
      await controller.stop();
      process.exit(0);
    }, 5000);
  } else {
    log('obs', 'teste de reconexão: aguardando 12s (abra o OBS para ver reconectar)...');
    setTimeout(async () => {
      await controller.stop();
      process.exit(0);
    }, 12000);
  }
}
