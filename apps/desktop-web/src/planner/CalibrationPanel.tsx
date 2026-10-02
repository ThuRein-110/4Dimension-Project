import { RefreshCw, ScanLine } from 'lucide-react';
import { calibrateManual } from '../../../../packages/room-engine/src/CalibrationManager.js';
import { defaultCalibration } from '../../../../packages/shared/src/project.js';
import { workspace, useWorkspace } from './store.js';
import { run } from './project-client.js';

export function Numeric({ label, value, onChange, min, max, step = .05 }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number }) {
  return <label className="numeric-field"><span>{label}</span><input type="number" aria-label={label} value={Number(value.toFixed(3))} min={min} max={max} step={step} onChange={event => {
    if (!event.target.value) return;
    const next = event.target.valueAsNumber; if (!Number.isFinite(next) || (min !== undefined && next < min) || (max !== undefined && next > max)) return;
    onChange(next);
  }} /></label>;
}
export function CalibrationPanel() {
  const state = useWorkspace(); const calibration = state.project.calibration;
  return <aside className="properties-panel"><div className="panel-title">Room calibration</div><div className="tracking-state">{state.calibrationState === 'Calibrating' ? 'MANUAL CALIBRATION' : state.calibrationState === 'Calibrated' ? 'TRACKING' : state.calibrationState === 'ReferenceFound' ? 'MARKER FOUND' : state.calibrationState === 'TrackingLost' ? 'TRACKING LOST' : state.calibrationState === 'Searching' ? 'MARKER NOT FOUND' : calibration.method === 'manual' ? 'MANUAL' : 'NOT CALIBRATED'}</div>
    <section className="property-section"><h3>Manual floor reference</h3><button onClick={() => workspace.recalibrate()}>Select floor points</button>
      <div className="floor-points">{['A', 'B', 'C'].map((letter, index) => <span key={letter} className={state.calibrationPoints[index] ? 'complete' : ''}>{letter} {state.calibrationPoints[index] ? 'Selected' : 'Pending'}</span>)}</div>
      <Numeric label="Distance A-B (m)" value={calibration.knownDistance} min={.01} max={100} onChange={value => workspace.edit(p => { p.calibration.knownDistance = value; })} />
      <button className="primary" disabled={state.calibrationPoints.length !== 3} onClick={() => run(() => {
        const result = calibrateManual(calibration, state.calibrationPoints, calibration.knownDistance);
        workspace.edit(p => { p.calibration = result; }, 'Manual calibration complete'); workspace.set({ calibrationState: 'ManualCalibration', calibrationPoints: [] });
      })}>Confirm floor origin</button><p className="panel-hint">Approximate: fixed FOV and camera pose. A is origin; A-B defines room X.</p>
    </section>
    <section className="property-section"><h3>Camera corrections</h3><Numeric label="Camera FOV" value={calibration.fov} min={15} max={120} step={1} onChange={value => workspace.edit(p => { p.calibration.fov = value; })} />
      {(['x', 'y', 'z'] as const).map((axis, index) => <Numeric key={axis} label={['Pitch', 'Yaw', 'Roll'][index]} value={calibration.correction[axis]} step={1} onChange={value => workspace.edit(p => { p.calibration.correction[axis] = value; })} />)}
      {(['x', 'y', 'z'] as const).map(axis => <Numeric key={axis} label={`Origin ${axis.toUpperCase()}`} value={calibration.origin[axis]} onChange={value => workspace.edit(p => { p.calibration.origin[axis] = value; })} />)}
      <Numeric label="World scale" value={calibration.scale} min={.01} max={100} onChange={value => workspace.edit(p => { p.calibration.scale = value; })} />
      <button onClick={() => { workspace.edit(p => { p.calibration = defaultCalibration(); }, 'Origin reset'); workspace.set({ calibrationState: 'NotCalibrated', calibrationPoints: [], trackingPose: null }); }}><RefreshCw size={14} />Reset origin</button>
    </section><section className="property-section"><h3>Room dimensions</h3><label className="text-field">Room name<input aria-label="Room name" value={state.project.room.name} onChange={event => { if (event.target.value.trim()) workspace.edit(p => { p.room.name = event.target.value.slice(0, 100); }); }} /></label>{(['width', 'length', 'height'] as const).map(key => <Numeric key={key} label={`Room ${key} (m)`} value={state.project.room[key]} min={.5} max={key === 'height' ? 30 : 100} onChange={value => workspace.edit(p => { p.room[key] = value; })} />)}</section>
    <details className="property-section optional-marker"><summary>Optional marker tracking</summary><Numeric label="Marker size (m)" value={calibration.markerSize} min={.02} max={2} onChange={value => workspace.edit(p => { p.calibration.markerSize = value; })} />
      <button onClick={() => workspace.set({ calibrationState: 'Searching', trackingPose: null, calibrationPoints: [] })}><ScanLine size={16} />{state.calibrationState === 'Searching' ? 'Searching...' : 'Track marker'}</button>
      <button disabled={!state.trackingPose || state.calibrationState === 'TrackingLost'} className="primary" onClick={() => { workspace.edit(p => { Object.assign(p.calibration, state.trackingPose, { method: 'marker', scale: 1, origin: { x: 0, y: 0, z: 0 }, correction: { x: 0, y: 0, z: 0 } }); }, 'Marker calibration confirmed'); workspace.set({ calibrationState: 'Calibrated' }); }}>Confirm marker origin</button>
      <a className="marker-download" href="/markers/marker-print.pdf" target="_blank" rel="noreferrer">Print 20 cm marker</a>
    </details>
  </aside>;
}
