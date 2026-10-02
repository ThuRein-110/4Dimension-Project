import { useEffect, useState } from 'react';
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { workspace, useWorkspace } from './store.js';
export function TimelinePanel() {
  const state = useWorkspace(); const [, tick] = useState(0);
  useEffect(() => {
    if (!state.playing) return;
    const timer = setInterval(() => { if (workspace.time() >= workspace.get().project.layouts.length - 1) workspace.pause(); tick(value => value + 1); }, 100);
    return () => clearInterval(timer);
  }, [state.playing]);
  const time = workspace.time(); const enabled = state.project.layouts.length > 1;
  return <section className="timeline-panel" aria-label="4D Timeline"><div className="timeline-heading"><strong>4D Timeline</strong><span>T{time.toFixed(2)} / {state.project.layouts.length - 1}</span><label>Duration<select aria-label="Transition duration" value={state.project.settings.duration} onChange={event => workspace.edit(p => { p.settings.duration = Number(event.target.value); })}>{[.5, 1, 2, 3, 5].map(value => <option value={value} key={value}>{value}s</option>)}</select></label><label>Speed<select aria-label="Timeline speed" value={state.speed} onChange={event => { workspace.pause(); workspace.set({ speed: Number(event.target.value) }); }}>{[.5, 1, 2].map(value => <option value={value} key={value}>{value}x</option>)}</select></label><label>Easing<select aria-label="Timeline easing" value={state.project.settings.easing} onChange={event => workspace.edit(p => { p.settings.easing = event.target.value as 'linear' | 'smooth'; })}><option value="smooth">Smooth</option><option value="linear">Linear</option></select></label></div>
    <div className="timeline-states">{state.project.layouts.map((layout, index) => <button key={layout.id} className={Math.round(time) === index ? 'active' : ''} onClick={() => { workspace.mode('timeline'); workspace.seek(index); workspace.edit(p => { p.activeLayoutId = layout.id; }); }}><span>T{index}</span><strong>{layout.name}</strong><small>{layout.furniture.length} objects</small></button>)}</div>
    <div className="timeline-controls"><button aria-label="Previous state" title="Previous state" onClick={() => { workspace.mode('timeline'); workspace.seek(Math.ceil(time) - 1); }}><SkipBack size={17} /></button><button className={state.playing ? '' : 'primary'} disabled={!enabled} aria-label={state.playing ? 'Pause timeline' : 'Play timeline'} title={state.playing ? 'Pause' : 'Play'} onClick={() => { if (state.playing) workspace.pause(); else { workspace.mode('timeline'); workspace.play(); } }}>{state.playing ? <Pause size={17} /> : <Play size={17} />}</button><button aria-label="Next state" title="Next state" onClick={() => { workspace.mode('timeline'); workspace.seek(Math.floor(time) + 1); }}><SkipForward size={17} /></button><input aria-label="Timeline scrubber" type="range" min={0} max={Math.max(1, state.project.layouts.length - 1)} step={.001} value={time} disabled={!enabled} onChange={event => { workspace.mode('timeline'); workspace.seek(Number(event.target.value)); }} /><output>{enabled ? Math.round(time / (state.project.layouts.length - 1) * 100) : 0}%</output></div>
  </section>;
}
