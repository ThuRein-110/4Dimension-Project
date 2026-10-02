import { Eye, EyeOff, Pencil, Trash2 } from 'lucide-react';
import { distance } from '../../../../packages/room-engine/src/CalibrationManager.js';
import { workspace, useWorkspace } from './store.js';
import { askName } from './dialogs.js';
import { run } from './project-client.js';
export function MeasurementPanel() {
  const state = useWorkspace();
  return <aside className="properties-panel"><div className="panel-title">Measurements</div><p className="panel-hint">Approximate floor measurements</p>{state.project.measurements.map(item => <section key={item.id} className="measurement-row"><strong>{item.name}</strong><div>{distance(item.a, item.b).toFixed(2)} m <span>{Math.round(distance(item.a, item.b) * 100)} cm</span></div><div className="layout-actions"><button title="Rename measurement" onClick={() => run(async () => { const name = await askName('Rename measurement', item.name); if (name) workspace.edit(p => { p.measurements.find(m => m.id === item.id)!.name = name; }); })}><Pencil size={14} /></button><button title={item.visible ? 'Hide measurement' : 'Show measurement'} onClick={() => workspace.edit(p => { p.measurements.find(m => m.id === item.id)!.visible = !item.visible; })}>{item.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button><button title="Delete measurement" onClick={() => workspace.edit(p => { p.measurements = p.measurements.filter(m => m.id !== item.id); })}><Trash2 size={14} /></button></div></section>)}{!state.project.measurements.length && <div className="panel-empty">No measurements</div>}</aside>;
}
