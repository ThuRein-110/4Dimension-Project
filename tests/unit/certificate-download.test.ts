import { afterEach, describe, expect, it } from 'vitest';
import express from 'express';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { certificateDownload } from '../../apps/server/src/certificate-download.js';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'livespace-certificate-'));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  const hidden = join(root, '.local', 'certs');
  await mkdir(hidden, { recursive: true });
  const path = join(hidden, 'livespace-ca.crt');
  const app = express();
  app.get('/livespace-ca.crt', certificateDownload(path));
  const server = createServer(app);
  await new Promise<void>(ready => server.listen(0, '127.0.0.1', ready));
  cleanups.push(() => new Promise<void>(ready => { server.closeAllConnections(); server.close(() => ready()); }));
  return { path, hidden, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

describe('public certificate download', () => {
  it('serves exact public bytes from the hidden .local directory', async () => {
    const { path, url } = await fixture();
    const certificate = '-----BEGIN CERTIFICATE-----\npublic-certificate\n-----END CERTIFICATE-----\n';
    await writeFile(path, certificate);
    const response = await fetch(`${url}/livespace-ca.crt`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/x-x509-ca-cert');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).toBe(certificate);
  });
  it('returns an actionable message for a missing file without a stack trace', async () => {
    const { url } = await fixture();
    const response = await fetch(`${url}/livespace-ca.crt`);
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('Certificate not available. Run npm run certs on Windows, then restart the app.');
  });
  it('does not serve adjacent private keys', async () => {
    const { hidden, url } = await fixture();
    await writeFile(join(hidden, 'ca-key.pem'), 'PRIVATE KEY');
    for (const path of ['/ca-key.pem', '/.local/certs/ca-key.pem', '/server-key.pem']) {
      const response = await fetch(`${url}${path}`);
      expect(response.status).toBe(404);
      expect(await response.text()).not.toContain('PRIVATE KEY');
    }
  });
});
