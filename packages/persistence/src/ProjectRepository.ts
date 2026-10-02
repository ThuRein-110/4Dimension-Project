import { readFile, writeFile, mkdir, readdir, rename, copyFile, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { parseProject, type Project } from '../../shared/src/project.js';

export class ProjectRepository {
  private writes = new Map<string, Promise<unknown>>();
  constructor(readonly root: string) { this.root = resolve(root); }
  private path(id: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error('Invalid project ID');
    return join(this.root, `${id}.json`);
  }
  private serial<T>(id: string, action: () => Promise<T>): Promise<T> {
    const pending = (this.writes.get(id) ?? Promise.resolve()).catch(() => undefined).then(action);
    this.writes.set(id, pending);
    void pending.finally(() => { if (this.writes.get(id) === pending) this.writes.delete(id); }).catch(() => undefined);
    return pending;
  }
  async save(value: Project): Promise<Project> {
    const project = parseProject(value); const path = this.path(project.id);
    return this.serial(project.id, async () => {
      await mkdir(this.root, { recursive: true });
      const temporary = `${path}.${crypto.randomUUID()}.tmp`;
      try {
        await writeFile(temporary, JSON.stringify(project, null, 2), { flag: 'wx' });
        let previousValid = false;
        try { parseProject(JSON.parse(await readFile(path, 'utf8'))); previousValid = true; }
        catch (error) { if (!(error instanceof SyntaxError) && (error as NodeJS.ErrnoException).code !== 'ENOENT' && !(error instanceof Error && error.name === 'ZodError')) throw error; }
        if (previousValid) await copyFile(path, `${path}.bak`);
        await rename(temporary, path);
      } finally { await unlink(temporary).catch(() => undefined); }
      return project;
    });
  }
  async load(id: string, backup = false): Promise<Project> {
    return parseProject(JSON.parse(await readFile(`${this.path(id)}${backup ? '.bak' : ''}`, 'utf8')));
  }
  async list() {
    await mkdir(this.root, { recursive: true });
    const files = (await readdir(this.root)).filter(file => file.endsWith('.json'));
    return Promise.all(files.map(async file => {
      const id = file.slice(0, -5);
      try { const project = await this.load(id); return { id, name: project.name, updatedAt: project.updatedAt, layouts: project.layouts.length, corrupt: false }; }
      catch { return { id, name: `Unreadable project ${id}`, updatedAt: '', layouts: 0, corrupt: true }; }
    }));
  }
  async delete(id: string) {
    const path = this.path(id);
    await this.serial(id, async () => {
      await unlink(path);
      await unlink(`${path}.bak`).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; });
    });
  }
}
