import 'dotenv/config';
import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import { createLiveRouter } from './server/routes/liveRoutes';
import { createMediaRouter } from './server/routes/mediaRoutes';

interface WsClientMeta {
  ws: WebSocket;
  clientId: string;
  liveRoomId?: string;
  isBroadcaster?: boolean;
}

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

async function bootstrap() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  // Authenticated Cloudinary media management & YouTube Live Shopping routes
  app.use('/api/media', createMediaRouter());
  app.use('/api/lives', createLiveRouter());

  // Serve generated studio assets in both dev and prod
  app.use('/src/assets/images', express.static(path.resolve(process.cwd(), 'src/assets/images')));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });
  const wsClients = new Map<string, WsClientMeta>();

  function sendWs(ws: WebSocket, payload: unknown) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }

  function broadcastToLiveRoom(liveId: string, payload: unknown, excludeClientId?: string) {
    for (const meta of wsClients.values()) {
      if (meta.liveRoomId === liveId && meta.clientId !== excludeClientId) {
        sendWs(meta.ws, payload);
      }
    }
  }

  function getLiveRoomViewerCount(liveId: string): number {
    let count = 0;
    for (const meta of wsClients.values()) {
      if (meta.liveRoomId === liveId) count += 1;
    }
    return count;
  }

  function syncLiveViewerCount(liveId: string) {
    const count = getLiveRoomViewerCount(liveId);
    broadcastToLiveRoom(liveId, { type: 'live:viewers', payload: { liveId, viewerCount: count } });
  }

  // Lightweight WebRTC signaling + live viewer count relay (app state lives in Firebase)
  wss.on('connection', (ws) => {
    const clientId = crypto.randomBytes(8).toString('hex');
    const meta: WsClientMeta = {
      ws,
      clientId,
    };
    wsClients.set(clientId, meta);
    sendWs(ws, { type: 'ws:connected', payload: { clientId } });

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString()) as { type: string; payload?: Record<string, unknown> };
        if (data.type === 'live:join') {
          const liveId = typeof data.payload?.liveId === 'string' ? data.payload.liveId : '';
          const prev = meta.liveRoomId;
          meta.liveRoomId = liveId || undefined;
          meta.isBroadcaster = Boolean(data.payload?.isBroadcaster);
          if (prev && prev !== liveId) syncLiveViewerCount(prev);
          if (liveId) {
            syncLiveViewerCount(liveId);
            if (!meta.isBroadcaster) {
              for (const peer of wsClients.values()) {
                if (peer.liveRoomId === liveId && peer.isBroadcaster) {
                  sendWs(peer.ws, {
                    type: 'rtc:watcher-join',
                    payload: { liveId, watcherId: meta.clientId },
                  });
                }
              }
            } else {
              broadcastToLiveRoom(
                liveId,
                { type: 'rtc:broadcaster-ready', payload: { liveId, broadcasterId: meta.clientId } },
                meta.clientId,
              );
            }
          }
          return;
        }
        if (data.type === 'live:leave') {
          const prev = meta.liveRoomId;
          meta.liveRoomId = undefined;
          meta.isBroadcaster = false;
          if (prev) syncLiveViewerCount(prev);
          return;
        }
        if (data.type === 'rtc:offer' || data.type === 'rtc:answer' || data.type === 'rtc:ice') {
          const targetId = typeof data.payload?.targetId === 'string' ? data.payload.targetId : '';
          const target = wsClients.get(targetId);
          if (target) {
            sendWs(target.ws, {
              type: data.type,
              payload: {
                ...(data.payload || {}),
                fromId: meta.clientId,
              },
            });
          }
        }
      } catch {
        // Ignore malformed socket frames
      }
    });

    ws.on('close', () => {
      const prev = meta.liveRoomId;
      wsClients.delete(clientId);
      if (prev) syncLiveViewerCount(prev);
    });
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`TECH STYLE MARKET server running on http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
