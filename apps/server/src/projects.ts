import express from 'express';
import { ZodError } from 'zod';
import { resolve } from 'node:path';
import { ProjectRepository } from '../../../packages/persistence/src/ProjectRepository.js';
import { parseProject } from '../../../packages/shared/src/project.js';
import { isLoopback } from './network.js';

export function projectRoutes(root = resolve('.local/projects')) {
  const router = express.Router(); const repository = new ProjectRepository(root);
  router.use((req, res, next) => {
    if (!isLoopback(req.socket.remoteAddress) || req.headers['x-livespace-client'] !== 'desktop') { res.status(403).json({ error: 'Project storage is accessible from the Windows desktop only.' }); return; }
    next();
  });
  router.use(express.json({ limit: '8mb' }));
  router.get('/', async (_req, res) => res.json(await repository.list()));
  router.get('/:id', async (req, res) => {
    try { res.json(await repository.load(req.params.id, req.query.backup === 'true')); }
    catch { res.status(404).json({ error: 'Project is missing or invalid. Try its backup or import a valid project JSON.' }); }
  });
  router.put('/:id', async (req, res) => {
    try {
      const project = parseProject(req.body);
      if (project.id !== req.params.id) { res.status(400).json({ error: 'Project ID mismatch' }); return; }
      res.json(await repository.save(project));
    } catch (error) { res.status(error instanceof ZodError ? 400 : 500).json({ error: error instanceof ZodError ? `Invalid project: ${error.issues[0]?.message}` : 'Project could not be saved. Check disk space and permissions.' }); }
  });
  router.delete('/:id', async (req, res) => {
    try { await repository.delete(req.params.id); res.sendStatus(204); }
    catch { res.status(404).json({ error: 'Project could not be deleted' }); }
  });
  router.use(((error, _req, res, _next) => {
    void _next;
    console.error('Project storage error', error);
    res.status(500).json({ error: 'Local storage unavailable. Check disk space and permissions.' });
  }) as express.ErrorRequestHandler);
  return router;
}
