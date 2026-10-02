import { useEffect, useRef, useState } from 'react';
import { Copy, Download, FilePlus2, FolderOpen, Pencil, Save, Trash2, Upload } from 'lucide-react';
import { createProject, parseProject } from '../../../../packages/shared/src/project.js';
import { workspace, useWorkspace } from './store.js';
import { api, run, saveProject, type ProjectSummary } from './project-client.js';
import { askName, confirmAction } from './dialogs.js';
import { downloadBlob } from './export.js';

export function ProjectControls() {
  const state = useWorkspace(); const [projects, setProjects] = useState<ProjectSummary[]>([]); const [opening, setOpening] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null); const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (opening) dialog.current?.showModal(); else dialog.current?.close(); }, [opening]);
  const replace = async () => !workspace.get().dirty || await confirmAction('Leave unsaved project?', 'Save your current changes first, or confirm to continue.');
  const fork = async () => {
    const name = await askName('Save project as', `${state.project.name} copy`); if (!name) return;
    const copy = structuredClone(workspace.get().project); copy.id = crypto.randomUUID(); copy.name = name; copy.createdAt = copy.updatedAt = new Date().toISOString();
    workspace.load(copy); await saveProject();
  };
  return <div className="project-controls"><details className="project-menu"><summary>{state.project.name}<span>{state.dirty ? ' *' : ''}</span></summary><div className="project-menu-items" onClick={event => { if ((event.target as HTMLElement).closest('button')) event.currentTarget.closest('details')?.removeAttribute('open'); }}>
    <button onClick={() => run(async () => { if (await replace()) { const name = await askName('New project', 'Untitled Room'); if (name) { workspace.load(createProject(name)); workspace.mode('calibration'); } } })}><FilePlus2 size={15} />New project</button>
    <button onClick={() => run(async () => { setProjects(await api<ProjectSummary[]>('')); setOpening(true); })}><FolderOpen size={15} />Open project</button>
    <button onClick={() => run(fork)}><Copy size={15} />Save as / Duplicate</button>
    <button onClick={() => run(async () => { const name = await askName('Rename project', state.project.name); if (name) workspace.edit(p => { p.name = name; }); })}><Pencil size={15} />Rename project</button>
    <button onClick={() => downloadBlob(new Blob([JSON.stringify(state.project, null, 2)], { type: 'application/json' }), `${state.project.name.replace(/[^a-z0-9_-]/gi, '_')}.json`)}><Download size={15} />Export project JSON</button>
    <button onClick={() => input.current?.click()}><Upload size={15} />Import project JSON</button>
    <button onClick={() => run(async () => { if (await confirmAction('Delete project?', state.project.name)) { await api(`/${state.project.id}`, { method: 'DELETE' }); workspace.load(createProject()); workspace.notify('Project deleted'); } })}><Trash2 size={15} />Delete project</button>
  </div></details><button className="save-project" title="Save project" aria-label="Save project" disabled={state.busy} onClick={() => run(saveProject)}><Save size={17} /></button><span className="save-status">{state.busy ? 'Saving...' : state.dirty ? 'Unsaved' : state.savedAt ? `Saved ${new Date(state.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'New project'}</span>
    <input ref={input} type="file" accept="application/json,.json" hidden onChange={event => {
      const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
      run(async () => { if (file.size > 8 * 1024 * 1024) throw new Error('Project JSON is too large (8 MB maximum).'); const project = parseProject(JSON.parse(await file.text())); if (await replace()) { workspace.load(project); workspace.notify('Project imported'); } });
    }} />
    <dialog className="planner-dialog project-picker" aria-labelledby="project-picker-title" ref={dialog} onCancel={() => setOpening(false)}><h2 id="project-picker-title">Open project</h2>{projects.length ? projects.map(project => <div key={project.id} data-project-id={project.id} className="saved-project-row"><button onClick={() => run(async () => {
      const loaded = parseProject(await api(`/${project.id}${project.corrupt ? '?backup=true' : ''}`));
      setOpening(false); if (await replace()) { workspace.load(loaded, loaded.updatedAt); workspace.notify('Project opened'); }
    })}><strong>{project.name}</strong><small>{project.corrupt ? 'Try backup' : `${project.layouts} states / ${new Date(project.updatedAt).toLocaleDateString()}`}</small></button><button title="Delete saved project" onClick={() => run(async () => { if (await confirmAction('Delete saved project?', project.name)) { await api(`/${project.id}`, { method: 'DELETE' }); setProjects(await api<ProjectSummary[]>('')); } })}><Trash2 size={15} /></button></div>) : <p>No saved projects</p>}<div className="dialog-actions"><button onClick={() => setOpening(false)}>Close</button></div></dialog>
  </div>;
}
