import { useEffect } from 'react';
import { ZodError } from 'zod';
import { parseProject, type Project } from '../../../../packages/shared/src/project.js';
import { workspace, useWorkspace } from './store.js';
export interface ProjectSummary { id: string; name: string; updatedAt: string; layouts: number; corrupt: boolean }
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/projects${path}`, { ...options, headers: { 'x-livespace-client': 'desktop', 'Content-Type': 'application/json', ...options.headers } });
  if (response.status === 204) return undefined as T;
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? 'Project operation failed');
  return value as T;
}
let saving: Promise<void> = Promise.resolve();
export function saveProject() {
  const project = workspace.get().project;
  const operation = saving.catch(() => undefined).then(async () => {
    workspace.set({ busy: true });
    try {
      const saved = parseProject(await api<Project>(`/${project.id}`, { method: 'PUT', body: JSON.stringify(project) }));
      if (workspace.get().project === project) workspace.set({ dirty: false, savedAt: saved.updatedAt });
      workspace.notify('Project saved');
    } finally { workspace.set({ busy: false }); }
  });
  saving = operation;
  return operation;
}
export function useAutosave() {
  const state = useWorkspace();
  useEffect(() => {
    if (!state.dirty || !state.project.settings.autosave) return;
    const timer = setTimeout(() => { void saveProject().catch(error => workspace.notify(`Save failed: ${error instanceof Error ? error.message : error}`)); }, 1200);
    return () => clearTimeout(timer);
  }, [state.project, state.dirty]);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => { if (workspace.get().dirty) event.preventDefault(); };
    addEventListener('beforeunload', unload); return () => removeEventListener('beforeunload', unload);
  }, []);
}
export const run = (action: () => Promise<unknown> | unknown) => { void Promise.resolve().then(action).catch(error => {
  console.error(error);
  workspace.notify(error instanceof ZodError ? `Invalid project data: ${error.issues[0]?.message ?? 'Unsupported project format'}` : error instanceof Error ? error.message : 'Operation failed');
}); };
