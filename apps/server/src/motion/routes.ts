import express from 'express';
import { resolve } from 'node:path';
import { mkdir, access, writeFile, rename, unlink, readFile } from 'node:fs/promises';
import { isLoopback } from '../network.js';
import { VideoPreparationService } from './video-service.js';
import { analysisSchema,analysisIdentity } from '../../../../packages/shared/src/motion.js';
import { ResearchService } from '../research/service.js';
import { researchRoutes } from '../research/routes.js';

export function motionRoutes(service = new VideoPreparationService(), analysisRoot = resolve('.cache/4dlivespace/motion')) {
  const router = express.Router();
  router.use((req, res, next) => {
    const origin = req.get('origin');
    const foreignOrigin = origin && origin !== `${req.protocol}://${req.get('host')}`;
    let host = '';
    try { host = new URL(`http://${req.get('host')}`).hostname; } catch { /* Invalid hosts cannot access private media. */ }
    if (!['localhost','127.0.0.1','[::1]'].includes(host) || !isLoopback(req.socket.remoteAddress) || foreignOrigin || req.get('sec-fetch-site') === 'cross-site') {
      res.status(403).json({ error: 'Private motion media is available on this PC at localhost only.' }); return;
    }
    next();
  });
  router.get('/demo/info', async (_req, res) => {
    try { res.json(await service.info()); }
    catch (error) { res.status(422).json({ error: error instanceof Error ? error.message : 'Video unavailable.' }); }
  });
  router.use('/research',researchRoutes(new ResearchService(service)));
  router.get('/demo/stream', async (req, res) => {
    try {
      if (typeof req.query.id !== 'string' || !/^[a-f0-9]{64}$/.test(req.query.id)) { res.sendStatus(400); return; }
      res.sendFile(await service.stream(req.query.id), { dotfiles: 'allow' });
    } catch { res.status(404).json({ error: 'Prepared video unavailable. Reload Motion Lab.' }); }
  });
  router.use('/wasm', express.static(resolve('node_modules/@mediapipe/tasks-vision/wasm'), { fallthrough: false }));
  router.use('/analyses', express.json({limit:'64mb'}));
  const writes = new Map<string,Promise<unknown>>();
  router.get('/analyses/:id', async (req,res) => {
    if (!/^[a-f0-9]{64}$/.test(req.params.id)) { res.sendStatus(400); return; }
    try {
      const data = analysisSchema.parse(JSON.parse(await readFile(resolve(analysisRoot,`${req.params.id}.json`),'utf8')));
      if (data.id !== req.params.id || data.id !== await analysisIdentity(data.video.id,data.analysis.fps) || data.analysis.scope !== 'video') throw new Error('Cache identity mismatch');
      res.json(data);
    } catch(error) { res.status((error as NodeJS.ErrnoException).code === 'ENOENT' ? 404 : 422).json({error:'Analysis cache is missing or invalid. Analyze again.'}); }
  });
  router.put('/analyses/:id', async (req,res) => {
    if (req.get('x-livespace-client') !== 'desktop') { res.sendStatus(403); return; }
    const parsed = analysisSchema.safeParse(req.body);
    if (!parsed.success || parsed.data.id !== req.params.id || parsed.data.analysis.scope !== 'video') { res.status(400).json({error:'Invalid motion analysis.'}); return; }
    const data = parsed.data;
    if (data.id !== await analysisIdentity(data.video.id,data.analysis.fps)) { res.status(400).json({error:'Analysis identity mismatch.'}); return; }
    const file = resolve(analysisRoot,`${data.id}.json`);
    const write = (writes.get(data.id) ?? Promise.resolve()).catch(() => undefined).then(async () => {
      await mkdir(analysisRoot,{recursive:true}); const temporary = `${file}.${crypto.randomUUID()}.tmp`;
      try { await writeFile(temporary,JSON.stringify(data),{flag:'wx'}); await rename(temporary,file); }
      finally { await unlink(temporary).catch(() => undefined); }
    });
    writes.set(data.id,write);
    try { await write; res.sendStatus(204); }
    catch { res.status(500).json({error:'Analysis could not be cached. Check local disk space.'}); }
    finally { if(writes.get(data.id)===write) writes.delete(data.id); }
  });
  let downloading: Promise<void> | undefined;
  const model = resolve('.cache/4dlivespace/models/pose_landmarker_lite_v1.task');
  router.get('/model', async (_req, res) => {
    try {
      try { await access(model); } catch {
        downloading ??= (async () => {
          const response = await fetch('https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task', { signal: AbortSignal.timeout(120000) });
          if (!response.ok) throw new Error('Public pose model download failed.');
          await mkdir(resolve('.cache/4dlivespace/models'), { recursive: true });
          const temporary = `${model}.tmp`;
          try { await writeFile(temporary, Buffer.from(await response.arrayBuffer())); await rename(temporary, model); }
          finally { await unlink(temporary).catch(() => undefined); }
        })().finally(() => { downloading = undefined; });
        await downloading;
      }
      res.sendFile(model, { dotfiles: 'allow' });
    } catch { res.status(503).json({ error: 'Pose model unavailable. Connect once to download the public model, then retry. No video is uploaded.' }); }
  });
  return router;
}
