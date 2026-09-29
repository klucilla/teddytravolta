// Servidor do overlay: express serve overlay/index.html e um WebSocket
// envia os eventos de agradecimento para o navegador (Browser Source do OBS).
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { WebSocketServer } from 'ws';
import { ROOT_DIR, config, log } from './config.js';

/**
 * Aceita só a página servida por este mesmo servidor (ou cliente sem Origin, como scripts).
 * O navegador deixa qualquer site abrir WebSocket para localhost; sem esta checagem, uma
 * aba qualquer do streamer podia conectar, ouvir os eventos e mandar lixo para o processo.
 */
export function mesmaOrigem(origin, host) {
  if (!origin) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export class OverlayServer {
  constructor() {
    this.app = express();
    this.app.use(express.static(path.join(ROOT_DIR, 'overlay')));
    this.server = http.createServer(this.app);
    this.wss = new WebSocketServer({
      server: this.server,
      maxPayload: 1024, // o overlay só recebe; nada grande precisa chegar aqui
      verifyClient: ({ origin, req }) => mesmaOrigem(origin, req.headers.host),
    });
    this.wss.on('error', (e) => log('overlay', `erro no servidor WebSocket: ${e.message}`));

    this.wss.on('connection', (ws) => {
      // Sem este ouvinte, um frame inválido ou grande demais virava exceção não tratada
      // e derrubava o processo no meio da live.
      ws.on('error', (e) => log('overlay', `erro num cliente: ${e.message}`));
      log('overlay', `cliente conectado (${this.wss.clients.size} no total)`);
      ws.on('close', () => log('overlay', 'cliente desconectado'));
      ws.send(JSON.stringify(this.#configOverlay()));
    });
  }

  // O banner do overlay promete coisas ("comenta que o Teddy responde"). Ele só mostra
  // a promessa se o recurso estiver ligado neste .env.
  #configOverlay() {
    return {
      type: 'overlay_config',
      respondeChat: config.llm.enabled && config.llm.comments,
      agradeceFollows: config.thankFollows,
      agradeceLikes: config.thankLikes,
    };
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server.once('error', reject);
      // Escuta apenas no host configurado (padrão 127.0.0.1: não expõe à rede local)
      this.server.listen(config.overlayPort, config.overlayHost, () => {
        this.server.off('error', reject);
        this.server.on('error', (e) => log('overlay', `erro no servidor HTTP: ${e.message}`));
        log('overlay', `http://localhost:${config.overlayPort} (Browser Source do OBS)`);
        resolve();
      });
    });
  }

  /** Envia um anúncio para todos os overlays conectados. */
  broadcast(announcement) {
    const msg = JSON.stringify(announcement);
    for (const client of this.wss.clients) {
      if (client.readyState === 1) client.send(msg);
    }
  }

  stop() {
    for (const client of this.wss.clients) client.close();
    this.server.close();
  }
}
