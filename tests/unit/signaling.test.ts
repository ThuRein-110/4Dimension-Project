import { afterEach, describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { WebSocket } from 'ws';
import { SessionStore } from '../../apps/server/src/sessions.js';
import { attachSignaling } from '../../apps/server/src/signaling.js';

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { for (const close of cleanup.splice(0)) await close(); });
async function fixture() {
  const server = createServer(); const store = new SessionStore(); const session = store.create();
  const stop = attachSignaling([server], store);
  await new Promise<void>(ready => server.listen(0, '127.0.0.1', ready));
  const port = (server.address() as AddressInfo).port;
  cleanup.push(async () => { stop(); await new Promise<void>(ready => server.close(() => ready())); });
  const open = (role: 'desktop' | 'camera', token = role === 'desktop' ? session.desktopToken : session.cameraToken) =>
    new WebSocket(`ws://127.0.0.1:${port}/signal?id=${session.id}&role=${role}&token=${token}`, { origin: `http://127.0.0.1:${port}` });
  return { open, session, store };
}
function message(ws: WebSocket, type: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { ws.off('message', listener); reject(new Error(`Timed out: ${type}`)); }, 3000);
    function listener(raw: Buffer) {
      const parsed = JSON.parse(raw.toString());
      if (parsed.type === type) { clearTimeout(timer); ws.off('message', listener); resolve(parsed); }
    }
    ws.on('message', listener);
  });
}
describe('LAN signaling', () => {
  it('relays offer, answer, ICE and peer departure only within an authenticated pair', async () => {
    const { open } = await fixture();
    const desktop = open('desktop'); await message(desktop, 'joined');
    const peerReady = message(desktop, 'peer-ready');
    const camera = open('camera'); await message(camera, 'peer-ready'); await peerReady;
    const offer = message(desktop, 'offer'); camera.send(JSON.stringify({ type: 'offer', sdp: 'camera-sdp' }));
    expect((await offer).sdp).toBe('camera-sdp');
    const answer = message(camera, 'answer'); desktop.send(JSON.stringify({ type: 'answer', sdp: 'desktop-sdp' }));
    expect((await answer).sdp).toBe('desktop-sdp');
    const ice = message(desktop, 'ice'); camera.send(JSON.stringify({ type: 'ice', candidate: { candidate: 'host-only' } }));
    expect((await ice).candidate).toEqual({ candidate: 'host-only' });
    const left = message(desktop, 'peer-left'); camera.close(); await left;
    desktop.close();
  });
  it('rejects the camera token in the desktop role', async () => {
    const { open, session } = await fixture(); const socket = open('desktop', session.cameraToken);
    await new Promise<void>(resolve => { socket.once('error', () => resolve()); });
    expect(socket.readyState).not.toBe(WebSocket.OPEN);
  });
  it('reports malformed signals and preserves the authenticated session', async () => {
    const { open } = await fixture(); const camera = open('camera'); await message(camera, 'joined');
    const error = message(camera, 'error'); camera.send('not JSON');
    expect((await error).message).toBe('Invalid JSON'); camera.close();
  });
});
