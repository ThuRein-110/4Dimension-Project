import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { Role } from '../../../packages/shared/src/protocol.js';

export interface PairingSession {
  id: string; cameraToken: string; desktopToken: string; expiresAt: number;
}
const secret = () => randomBytes(32).toString('base64url');
const equal = (a: string, b: string) => {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
export class SessionStore {
  private sessions = new Map<string, PairingSession>();
  constructor(private ttl = 4 * 60 * 60 * 1000) {}
  create(now = Date.now()): PairingSession {
    this.prune(now);
    if (this.sessions.size >= 100) throw new Error('Too many pairing sessions. Restart the server.');
    const session = { id: secret(), cameraToken: secret(), desktopToken: secret(), expiresAt: now + this.ttl };
    this.sessions.set(session.id, session);
    return session;
  }
  authorize(id: string, token: string, role: Role, now = Date.now()): boolean {
    const session = this.sessions.get(id);
    return !!session && session.expiresAt > now && equal(token, role === 'camera' ? session.cameraToken : session.desktopToken);
  }
  revoke(id: string) { this.sessions.delete(id); }
  prune(now = Date.now()) {
    for (const [id, session] of this.sessions) if (session.expiresAt <= now) this.sessions.delete(id);
  }
}
