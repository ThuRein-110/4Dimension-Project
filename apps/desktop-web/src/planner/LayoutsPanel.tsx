import { ArrowDown, ArrowUp, Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import { createLayout, deleteLayout, activateLayout } from '../../../../packages/layouts/src/LayoutManager.js';
import { workspace, useWorkspace } from './store.js';
import { askName, confirmAction } from './dialogs.js';
import { run } from './project-client.js';

export function LayoutsPanel() {
  const state = useWorkspace();
  const add = (duplicate: boolean) => run(async () => {
    const name = await askName(duplicate ? 'Duplicate layout' : 'New blank layout', duplicate ? `${workspace.active().name} copy` : 'New layout');
    if (name) { workspace.edit(p => { createLayout(p, name, duplicate); }, 'Layout created'); workspace.set({ selected: null, timeline: workspace.get().project.layouts.length - 1 }); }
  });
  return <aside className="properties-panel"><div className="panel-title">Layout states<span>{state.project.layouts.length}</span></div><div className="layout-add"><button onClick={() => add(false)}><Plus size={14} />Blank</button><button onClick={() => add(true)}><Copy size={14} />Duplicate</button></div>
    {state.project.layouts.map((layout, index) => <section key={layout.id} className={`layout-row ${layout.id === state.project.activeLayoutId ? 'active' : ''}`}><button className="layout-activate" onClick={() => { workspace.edit(p => activateLayout(p, layout.id)); workspace.set({ selected: null }); workspace.seek(index); }}><span>T{index}</span><strong>{layout.name}</strong><small>{layout.furniture.length} items</small></button><div className="layout-actions"><button title="Rename layout" aria-label={`Rename ${layout.name}`} onClick={() => run(async () => { const name = await askName('Rename layout', layout.name); if (name) workspace.edit(p => { p.layouts.find(l => l.id === layout.id)!.name = name; }, 'Layout renamed'); })}><Pencil size={13} /></button><button title="Move layout earlier" disabled={index === 0} onClick={() => workspace.edit(p => { [p.layouts[index - 1], p.layouts[index]] = [p.layouts[index], p.layouts[index - 1]]; })}><ArrowUp size={13} /></button><button title="Move layout later" disabled={index === state.project.layouts.length - 1} onClick={() => workspace.edit(p => { [p.layouts[index + 1], p.layouts[index]] = [p.layouts[index], p.layouts[index + 1]]; })}><ArrowDown size={13} /></button><button title="Delete layout" disabled={state.project.layouts.length === 1} onClick={() => run(async () => { if (await confirmAction('Delete layout?', layout.name)) { workspace.edit(p => deleteLayout(p, layout.id), 'Layout deleted'); workspace.seek(0); workspace.set({ selected: null }); } })}><Trash2 size={13} /></button></div></section>)}
    <section className="property-section"><h3>Project settings</h3><label className="check-field"><input type="checkbox" checked={state.project.settings.autosave} onChange={event => workspace.edit(p => { p.settings.autosave = event.target.checked; })} />Auto-save</label><label className="check-field"><input type="checkbox" checked={state.project.settings.confirmDelete} onChange={event => workspace.edit(p => { p.settings.confirmDelete = event.target.checked; })} />Confirm furniture deletion</label></section>
  </aside>;
}
