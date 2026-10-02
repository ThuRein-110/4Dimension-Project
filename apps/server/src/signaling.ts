import { WebSocket, WebSocketServer } from 'ws';
import type { IncomingMessage, Server as HttpServer } from 'node:http';
import type { Server as HttpsServer } from 'node:https';
import type { Duplex } from 'node:stream';
import { signalSchema, type Role } from '../../../packages/shared/src/protocol.js';
import { SessionStore } from './sessions.js';

export function attachSignaling(servers: (HttpServer | HttpsServer)[], store: SessionStore) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 70000 });
  const rooms = new Map<string, Partial<Record<Role, WebSocket>>>();
  const lives = new WeakMap<WebSocket, boolean>();
  const send = (socket: WebSocket | undefined, message: unknown) => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  };
  function upgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/vite-hmr') return;
    if (url.pathname !== '/signal') { socket.destroy(); return; }
    const role = url.searchParams.get('role');
    const id = url.searchParams.get('id') ?? '';
    const token = url.searchParams.get('token') ?? '';
    const origin = req.headers.origin;
    let originMatches = false;
    try { originMatches = !!origin && new URL(origin).host === req.headers.host; } catch { /* Reject malformed origins. */ }
    if (!originMatches || (role !== 'camera' && role !== 'desktop') || !store.authorize(id, token, role)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n'); socket.destroy(); return;
    }
    const room = rooms.get(id) ?? {};
    if (room[role]?.readyState === WebSocket.OPEN) {
      socket.write('HTTP/1.1 409 Conflict\r\nConnection: close\r\n\r\n'); socket.destroy(); return;
    }
    wss.handleUpgrade(req, socket, head, ws => {
      room[role] = ws;
      rooms.set(id, room);
      const other: Role = role === 'desktop' ? 'camera' : 'desktop';
      lives.set(ws, true);
      ws.on('pong', () => lives.set(ws, true));
      send(ws, { type: 'joined' });
      if (room[other]?.readyState === WebSocket.OPEN) {
        send(ws, { type: 'peer-ready' }); send(room[other], { type: 'peer-ready' });
      }
      let windowStart = Date.now(); let count = 0;
      ws.on('message', (raw, binary) => {
        if (!store.authorize(id, token, role)) { ws.close(4003, 'Pairing expired'); return; }
        if (Date.now() - windowStart > 1000) { windowStart = Date.now(); count = 0; }
        if (binary || ++count > 120) { ws.close(1008, 'Invalid signaling traffic'); return; }
        try {
          const parsed = signalSchema.safeParse(JSON.parse(raw.toString()));
          if (!parsed.success) { send(ws, { type: 'error', message: 'Invalid signal' }); return; }
          const message = parsed.data;
          if ((message.type === 'offer' || message.type === 'telemetry') && role !== 'camera') return;
          if (message.type === 'answer' && role !== 'desktop') return;
          send(room[other], message);
        } catch { send(ws, { type: 'error', message: 'Invalid JSON' }); }
      });
      ws.on('error', () => { /* Close handling reports the disconnect to the peer. */ });
      ws.on('close', () => {
        if (room[role] !== ws) return;
        delete room[role];
        send(room[other], { type: 'peer-left' });
        if (!room.camera && !room.desktop) rooms.delete(id);
      });
    });
  }
  servers.forEach(server => server.on('upgrade', upgrade));
  const heartbeat = setInterval(() => {
    store.prune();
    for (const room of rooms.values()) for (const ws of Object.values(room)) {
      if (!ws) continue;
      if (!lives.get(ws)) ws.terminate();
      else { lives.set(ws, false); ws.ping(); }
    }
  }, 15000);
  heartbeat.unref();
  return () => {
    clearInterval(heartbeat);
    servers.forEach(server => server.off('upgrade', upgrade));
    for (const room of rooms.values()) for (const ws of Object.values(room)) ws?.terminate();
    wss.close();
  };
}
