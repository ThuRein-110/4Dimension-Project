import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Copy, RotateCcw, Trash2 } from 'lucide-react';
import { definition } from '../../../../packages/room-engine/src/FurnitureCatalog.js';
import { overlapIds } from '../../../../packages/room-engine/src/CollisionChecker.js';
import { workspace, useWorkspace } from './store.js';
import { Numeric } from './CalibrationPanel.js';
import { confirmAction } from './dialogs.js';
import { run } from './project-client.js';

export async function deleteSelected() {
  const state = workspace.get(); const item = workspace.active().furniture.find(item => item.instanceId === state.selected);
  if (!item || item.locked) return;
  if (state.project.settings.confirmDelete && !await confirmAction('Delete furniture?', definition(item.furnitureId)?.name ?? 'Selected furniture')) return;
  workspace.edit(project => { const layout = project.layouts.find(layout => layout.id === project.activeLayoutId)!; layout.furniture = layout.furniture.filter(value => value.instanceId !== item.instanceId); }, 'Furniture deleted');
  workspace.set({ selected: null });
}
export function PropertiesPanel() {
  const state = useWorkspace(); const layout = workspace.active(); const item = layout.furniture.find(value => value.instanceId === state.selected);
  const model = item ? definition(item.furnitureId) : null;
  const collisions = overlapIds(layout.furniture);
  const move = (x: number, z: number) => { if (item && !item.locked) workspace.updateInstance(item.instanceId, { position: { ...item.position, x: item.position.x + x, z: item.position.z + z } }); };
  return <aside className="properties-panel"><div className="panel-title">Properties<span>{layout.furniture.length} items</span></div>
    {collisions.size > 0 && <p className="overlap-warning" role="status">Overlap warning: {collisions.size} items</p>}
    <div className="object-list">{layout.furniture.map(value => <button key={value.instanceId} className={value.instanceId === state.selected ? 'active' : ''} onClick={() => { workspace.mode('edit'); workspace.set({ selected: value.instanceId }); }}>{definition(value.furnitureId)?.name ?? value.furnitureId}<span>{value.visible ? '' : 'Hidden'}</span></button>)}</div>
    {item && model ? <><h2 className="selected-heading">{model.name}</h2><fieldset disabled={item.locked}>
      <section className="property-section"><h3>Transform</h3><div className="segmented">{(['translate', 'rotate', 'scale'] as const).map(mode => <button key={mode} className={state.transformMode === mode ? 'active' : ''} onClick={() => workspace.set({ transformMode: mode })}>{mode === 'translate' ? 'Move' : mode === 'rotate' ? 'Rotate' : 'Scale'}</button>)}</div>
        <label className="text-field">Snap<select aria-label="Snap" value={state.snap} onChange={event => workspace.set({ snap: Number(event.target.value) })}>{[0, .05, .1, .25, .5].map(value => <option key={value} value={value}>{value ? `${value} m` : 'Off'}</option>)}</select></label>
        {(['x', 'y', 'z'] as const).map(axis => <Numeric key={axis} label={`Position ${axis.toUpperCase()}`} value={item.position[axis]} onChange={value => workspace.updateInstance(item.instanceId, { position: { ...item.position, [axis]: value } })} />)}
        <div className="arrow-controls"><button title="Move left" onClick={() => move(-state.snap || -.1, 0)}><ArrowLeft size={16} /></button><button title="Move forward" onClick={() => move(0, -state.snap || -.1)}><ArrowUp size={16} /></button><button title="Move back" onClick={() => move(0, state.snap || .1)}><ArrowDown size={16} /></button><button title="Move right" onClick={() => move(state.snap || .1, 0)}><ArrowRight size={16} /></button></div>
      </section>
      <section className="property-section"><h3>Rotation (degrees)</h3>{(['x', 'y', 'z'] as const).map(axis => <Numeric key={axis} label={`Rotation ${axis.toUpperCase()}`} value={item.rotation[axis] * 180 / Math.PI} step={15} onChange={value => workspace.updateInstance(item.instanceId, { rotation: { ...item.rotation, [axis]: value * Math.PI / 180 } })} />)}
        <div className="rotation-buttons">{[-15, 15, 45, 90].map(value => <button key={value} onClick={() => workspace.updateInstance(item.instanceId, { rotation: { ...item.rotation, y: item.rotation.y + value * Math.PI / 180 } })}>{value > 0 ? '+' : ''}{value}</button>)}<button title="Reset rotation" aria-label="Reset rotation" onClick={() => workspace.updateInstance(item.instanceId, { rotation: { x: 0, y: 0, z: 0 } })}><RotateCcw size={15} /></button></div>
      </section><section className="property-section"><h3>Scale &amp; dimensions</h3><Numeric label="Uniform scale (%)" value={item.scale.x * 100} min={10} max={500} step={5} onChange={value => workspace.updateInstance(item.instanceId, { scale: { x: value / 100, y: value / 100, z: value / 100 } })} />{(['x', 'y', 'z'] as const).map((axis, index) => <Numeric key={axis} label={`${['Width', 'Height', 'Depth'][index]} (m)`} value={item.scale[axis] * [model.width, model.height, model.depth][index]} min={[model.width, model.height, model.depth][index] * model.minimumScale} max={[model.width, model.height, model.depth][index] * model.maximumScale} onChange={value => workspace.updateInstance(item.instanceId, { scale: { ...item.scale, [axis]: value / [model.width, model.height, model.depth][index] } })} />)}</section>
    </fieldset><div className="visibility-settings"><label><input type="checkbox" checked={item.visible} onChange={event => workspace.updateInstance(item.instanceId, { visible: event.target.checked })} />Visible</label><label><input type="checkbox" checked={item.locked} onChange={event => workspace.updateInstance(item.instanceId, { locked: event.target.checked })} />Locked</label></div><div className="object-actions"><button onClick={() => {
      if (workspace.active().furniture.length >= 500) { workspace.notify('This layout has reached its 500-item limit.'); return; }
      const duplicate = { ...structuredClone(item), instanceId: crypto.randomUUID(), position: { ...item.position, x: item.position.x + .25, z: item.position.z + .25 }, locked: false };
      workspace.edit(p => p.layouts.find(l => l.id === p.activeLayoutId)!.furniture.push(duplicate), 'Furniture duplicated'); workspace.set({ selected: duplicate.instanceId });
    }}><Copy size={15} />Duplicate</button><button disabled={item.locked} onClick={() => run(deleteSelected)}><Trash2 size={15} />Delete</button></div></> : <p className="panel-hint">No furniture selected</p>}
  </aside>;
}
