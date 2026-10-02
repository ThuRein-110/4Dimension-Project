import type { Project } from '../../shared/src/project.js';
export function createLayout(project: Project, name: string, duplicate = false) {
  if (project.layouts.length >= 50) throw new Error('Maximum 50 layout states per project.');
  const current = project.layouts.find(layout => layout.id === project.activeLayoutId)!;
  const layout = { id: crypto.randomUUID(), name, furniture: duplicate ? structuredClone(current.furniture) : [] };
  project.layouts.push(layout); project.activeLayoutId = layout.id; return layout;
}
export function deleteLayout(project: Project, id: string) {
  if (project.layouts.length === 1) throw new Error('Keep at least one layout state.');
  project.layouts = project.layouts.filter(layout => layout.id !== id);
  if (project.activeLayoutId === id) project.activeLayoutId = project.layouts[0].id;
}
export function activateLayout(project: Project, id: string) {
  if (!project.layouts.some(layout => layout.id === id)) throw new Error('Layout does not exist');
  project.activeLayoutId = id;
}
