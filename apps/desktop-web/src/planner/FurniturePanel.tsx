import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { catalog } from '../../../../packages/room-engine/src/FurnitureCatalog.js';
import { workspace, useWorkspace } from './store.js';

export function FurniturePanel() {
  const state = useWorkspace(); const [search, setSearch] = useState(''); const [category, setCategory] = useState('All');
  return <aside className="furniture-panel"><div className="panel-title">Furniture library<span>{catalog.length}</span></div>
    <label className="search-field"><Search size={15} /><input aria-label="Search furniture" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search furniture" /></label>
    <select aria-label="Furniture category" value={category} onChange={event => setCategory(event.target.value)}>{['All', ...new Set(catalog.map(item => item.category))].map(value => <option key={value}>{value}</option>)}</select>
    <div className="furniture-catalog">{catalog.filter(item => (category === 'All' || item.category === category) && item.name.toLowerCase().includes(search.toLowerCase())).map(item => {
      return <article className={`furniture-card ${state.placing === item.id ? 'chosen' : ''}`} key={item.id}><div className="furniture-thumbnail"><img src={item.thumbnail} alt="" loading="lazy" /></div><div><strong>{item.name}</strong><span>{item.width.toFixed(2)} x {item.depth.toFixed(2)} x {item.height.toFixed(2)} m</span></div><button title={`Add ${item.name}`} aria-label={`Add ${item.name}`} onClick={() => {
        if (state.project.calibration.method === 'none') { workspace.notify('Calibrate the floor first, or open the demo project.'); workspace.mode('calibration'); return; }
        workspace.mode('place'); workspace.set({ placing: item.id, selected: null });
      }}><Plus size={16} /></button></article>;
    })}</div><p className="panel-hint">{state.mode === 'place' ? 'Place furniture on the floor' : state.project.calibration.method === 'none' ? 'Floor not calibrated' : 'Approximate scale in meters'}</p>
  </aside>;
}
