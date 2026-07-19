// Servidor do overlay: express serve overlay/index.html e um WebSocket
// envia os eventos de agradecimento para o navegador (Browser Source do OBS).
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { WebSocketServer } from 'ws';
import { ROOT_DIR, config, log } from './config.js';

export class OverlayServer {
  constructor() {
    this.app = express();
    this.app.use(express.static(path.join(ROOT_DIR, 'overlay')));
    this.server = http.createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });

    this.wss.on('connection', (ws) => {
      log('overlay', `cliente conectado (${this.wss.clients.size} no total)`);
      ws.on('close', () => log('overlay', 'cliente desconectado'));
    });
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server.once('error', reject);
      // Escuta apenas no host configurado (padrão 127.0.0.1: não expõe à rede local)
      this.server.listen(config.overlayPort, config.overlayHost, () => {
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
