import express from 'express';
import { resolve } from 'node:path';
import { mkdir, access, writeFile, rename, unlink } from 'node:fs/promises';
import { isLoopback } from '../network.js';
import { VideoPreparationService } from './video-service.js';

export function motionRoutes(service = new VideoPreparationService()) {
  const router = express.Router();
  router.use((req, res, next) => {
    const origin = req.get('origin');
    const foreignOrigin = origin && origin !== `${req.protocol}://${req.get('host')}`;
    if (!isLoopback(req.socket.remoteAddress) || foreignOrigin || req.get('sec-fetch-site') === 'cross-site') {
      res.status(403).json({ error: 'Private motion media is available on this PC at localhost only.' }); return;
    }
    next();
  });
  router.get('/demo/info', async (_req, res) => {
    try { res.json(await service.info()); }
    catch (error) { res.status(422).json({ error: error instanceof Error ? error.message : 'Video unavailable.' }); }
  });
  router.get('/demo/stream', async (req, res) => {
    try {
      if (typeof req.query.id !== 'string' || !/^[a-f0-9]{64}$/.test(req.query.id)) { res.sendStatus(400); return; }
      res.sendFile(await service.stream(req.query.id), { dotfiles: 'allow' });
    } catch { res.status(404).json({ error: 'Prepared video unavailable. Reload Motion Lab.' }); }
  });
  router.use('/wasm', express.static(resolve('node_modules/@mediapipe/tasks-vision/wasm'), { fallthrough: false }));
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
