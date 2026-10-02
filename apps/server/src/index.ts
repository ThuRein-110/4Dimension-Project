import express from 'express';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer as createViteServer } from 'vite';
import { SessionStore } from './sessions.js';
import { attachSignaling } from './signaling.js';
import { lanAddresses, isLoopback } from './network.js';
import { generateCertificates } from '../../../scripts/certificates.js';
import { certificateDownload } from './certificate-download.js';
import { projectRoutes } from './projects.js';
import { motionRoutes } from './motion/routes.js';

const app = express();
const sessions = new SessionStore();
const httpPort = Number(process.env.PORT ?? 5173);
const httpsPort = Number(process.env.HTTPS_PORT ?? 5443);
const certificatePort = Number(process.env.CERT_PORT ?? 5442);
let tlsReady = false;
const servers = [createHttpServer(app)];
try { await access(resolve('.local/certs/server.pem')); } catch { await generateCertificates(); }
try {
  const [key, cert] = await Promise.all(['server-key.pem', 'server.pem'].map(file => readFile(resolve('.local/certs', file))));
  servers.push(createHttpsServer({ key, cert }, app));
  tlsReady = true;
} catch { console.log('LAN HTTPS is not configured. Run npm run certs, then restart.'); }
app.disable('x-powered-by');
app.use('/assets', express.static(resolve('assets')));
app.use('/markers', express.static(resolve('public/markers')));
app.use('/assets/vendor/aruco', express.static(resolve('node_modules/js-aruco2/src')));
app.get('/assets/marker-worker.js', (_req, res) => res.sendFile(resolve('packages/vision/src/marker-worker.js')));
app.use((_req, res, next) => {
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  next();
});
app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
app.get('/api/health', (_req, res) => res.json({ ok: true, tlsReady }));
app.use('/api/projects', projectRoutes());
app.use('/api/motion', motionRoutes());
app.post('/api/sessions', (req, res) => {
  // Pairing starts on Windows localhost. A phone cannot allocate desktop credentials.
  if (!isLoopback(req.socket.remoteAddress) || req.headers['x-livespace-client'] !== 'desktop') {
    res.status(403).json({ error: 'Start pairing from the desktop localhost address.' }); return;
  }
  const session = sessions.create();
  const hosts = lanAddresses();
  const cameraUrls = (hosts.length ? hosts : ['localhost']).map(ip =>
    `https://${ip}:${httpsPort}/camera?session=${session.id}&token=${session.cameraToken}`);
  res.status(201).json({ ...session, cameraUrls, tlsReady, certificatePort });
});
app.delete('/api/sessions/:id', (req, res) => {
  const token = req.headers['x-session-token'];
  if (typeof token !== 'string' || !sessions.authorize(req.params.id, token, 'desktop')) {
    res.sendStatus(403); return;
  }
  sessions.revoke(req.params.id); res.sendStatus(204);
});
const publicCertificate = certificateDownload(resolve('.local/certs/livespace-ca.crt'));
app.get('/livespace-ca.crt', publicCertificate);
let vite: Awaited<ReturnType<typeof createViteServer>> | undefined;
if (process.argv.includes('--production')) {
  app.use(express.static(resolve('dist/web')));
  app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/web/index.html')));
} else {
  vite = await createViteServer({ server: { middlewareMode: true, hmr: { server: servers[0], path: '/vite-hmr' } }, appType: 'spa' });
  servers[1]?.on('upgrade', (request, socket, head) => {
    if (new URL(request.url ?? '/', 'http://localhost').pathname === '/vite-hmr') servers[0].emit('upgrade', request, socket, head);
  });
  app.use(vite.middlewares);
}
const closeSignaling = attachSignaling(servers, sessions);
// The bootstrap HTTP listener serves the public CA certificate only.
const certificateApp = express();
certificateApp.get('/livespace-ca.crt', publicCertificate);
const certificateServer = createHttpServer(certificateApp);
await new Promise<void>((ready, reject) => {
  certificateServer.once('error', reject);
  certificateServer.listen(certificatePort, '0.0.0.0', ready);
});
for (const [index, server] of servers.entries()) {
  await new Promise<void>((resolveReady, reject) => {
    server.once('error', reject);
    server.listen(index === 0 ? httpPort : httpsPort, index === 0 ? '127.0.0.1' : '0.0.0.0', resolveReady);
  });
}
console.log(`4D LiveSpace desktop: http://localhost:${httpPort}`);
if (tlsReady) for (const ip of lanAddresses()) console.log(`LAN camera: https://${ip}:${httpsPort}/camera`);
if (process.env.LIVESPACE_OPEN === '1' && process.platform === 'win32') {
  spawn('rundll32.exe', ['url.dll,FileProtocolHandler', `http://localhost:${httpPort}`], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
}
async function shutdown() {
  closeSignaling();
  await vite?.close();
  for (const server of servers) { server.closeAllConnections(); server.close(); }
  certificateServer.closeAllConnections(); certificateServer.close();
}
process.once('SIGINT', () => { void shutdown(); });
process.once('SIGTERM', () => { void shutdown(); });
