import { describe, expect, it } from 'vitest';
import { SessionStore } from '../../apps/server/src/sessions.js';
import { signalSchema } from '../../packages/shared/src/protocol.js';
import { isLoopback } from '../../apps/server/src/network.js';

describe('pairing credentials', () => {
  it('creates independent unpredictable role credentials', () => {
    const store = new SessionStore(); const a = store.create(); const b = store.create();
    expect(new Set([a.id, a.cameraToken, a.desktopToken, b.id, b.cameraToken, b.desktopToken]).size).toBe(6);
    expect(a.cameraToken.length).toBeGreaterThanOrEqual(43);
    expect(store.authorize(a.id, a.cameraToken, 'camera')).toBe(true);
    expect(store.authorize(a.id, a.cameraToken, 'desktop')).toBe(false);
    expect(store.authorize(b.id, a.cameraToken, 'camera')).toBe(false);
  });
  it('rejects expired, revoked and malformed credentials', () => {
    const store = new SessionStore(100); const a = store.create(1000);
    expect(store.authorize(a.id, a.cameraToken, 'camera', 1099)).toBe(true);
    expect(store.authorize(a.id, a.cameraToken, 'camera', 1100)).toBe(false);
    expect(store.authorize(a.id, 'x', 'camera', 1000)).toBe(false);
    const b = store.create(1000); store.revoke(b.id);
    expect(store.authorize(b.id, b.desktopToken, 'desktop', 1000)).toBe(false);
  });
  it('recognizes loopback only', () => {
    expect(isLoopback('::ffff:127.0.0.1')).toBe(true);
    expect(isLoopback('192.168.1.4')).toBe(false);
    expect(isLoopback(undefined)).toBe(false);
  });
});
describe('signal validation', () => {
  it('allows actual SDP and ICE payloads', () => {
    expect(signalSchema.safeParse({ type: 'offer', sdp: 'v=0\r\n' }).success).toBe(true);
    expect(signalSchema.safeParse({ type: 'ice', candidate: { candidate: 'candidate:1', sdpMid: '0', sdpMLineIndex: 0 } }).success).toBe(true);
  });
  it('rejects frames, oversize SDP and invalid telemetry', () => {
    expect(signalSchema.safeParse({ type: 'frame', data: 'private video' }).success).toBe(false);
    expect(signalSchema.safeParse({ type: 'offer', sdp: 'x'.repeat(65001) }).success).toBe(false);
    expect(signalSchema.safeParse({ type: 'telemetry', width: 1280, height: 720, fps: -1, orientation: 'portrait' }).success).toBe(false);
  });
});
