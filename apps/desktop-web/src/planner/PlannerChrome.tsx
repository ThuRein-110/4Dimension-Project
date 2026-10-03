import { Fragment, useEffect, useRef, useState } from 'react';
import { Activity, Box, Camera, CircleHelp, Copy, Grid3X3, Layers, MousePointer2, Redo2, Ruler, ScanLine, Undo2, Video, X } from 'lucide-react';
import type { WorkspaceMode } from '../../../../packages/shared/src/project.js';
import { demoProject } from '../../../../packages/layouts/src/demo.js';
import { workspace, useWorkspace } from './store.js';
import { PropertiesPanel, deleteSelected } from './PropertiesPanel.js';
import { CalibrationPanel } from './CalibrationPanel.js';
import { LayoutsPanel } from './LayoutsPanel.js';
import { MeasurementPanel } from './MeasurementPanel.js';
import { ComparisonPanel } from './ComparisonPanel.js';
import { run, useAutosave } from './project-client.js';
import { DialogHost, confirmAction } from './dialogs.js';
import { currentEngine } from './ThreeOverlay.js';

const modes = [['camera', 'Camera', Camera], ['cube', '4D Cube Lab', Box], ['calibration', 'Calibration', ScanLine], ['place', 'Place', Grid3X3], ['edit', 'Edit', MousePointer2], ['measure', 'Measure', Ruler], ['layouts', 'Layouts', Layers], ['timeline', 'Timeline', Video], ['compare', 'Compare', Copy]] as const;
const tutorial = ['Connect camera', 'Calibrate room', 'Add furniture', 'Edit furniture', 'Save T0', 'Create T1', 'Open timeline', 'Play 4D transition'];
export function ModeBar({ onDemo }: { onDemo: () => void }) {
  const state = useWorkspace(); const [help, setHelp] = useState(false); const [step, setStep] = useState(0);
  const helpDialog = useRef<HTMLDialogElement>(null);
  const [firstRun, setFirstRun] = useState(() => { try { return localStorage.getItem('livespace-onboarding') !== 'done'; } catch { return true; } });
  const finishTour = () => { try { localStorage.setItem('livespace-onboarding', 'done'); } catch { /* Storage can be disabled in private browsing. */ } setFirstRun(false); setHelp(false); };
  useEffect(() => { if (help) helpDialog.current?.showModal(); else helpDialog.current?.close(); }, [help]);
  useAutosave();
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).closest('input,select,textarea,[contenteditable],dialog') || document.querySelector('dialog[open],[aria-modal="true"]')) return;
      const mode = workspace.get().mode;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) workspace.redo(); else workspace.undo(); }
      else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); workspace.redo(); }
      else if (event.key === 'Escape') workspace.set({ placing: null, selected: null, mode: mode === 'place' ? 'edit' : mode });
      else if (event.key === 'Delete' && mode === 'edit') run(deleteSelected);
      else if (event.key === ' ' && mode === 'timeline') { event.preventDefault(); if (workspace.get().playing) workspace.pause(); else workspace.play(); }
      else if (mode === 'edit' && !event.ctrlKey && !event.metaKey) {
        const shortcuts = { g: 'translate', r: 'rotate', s: 'scale' } as const;
        const value = shortcuts[event.key.toLowerCase() as keyof typeof shortcuts]; if (value) workspace.set({ transformMode: value });
        if (event.key.toLowerCase() === 'f') { const object = currentEngine?.controls.object; if (object && currentEngine) { currentEngine.projection.camera.lookAt(object.position); const q = currentEngine.projection.camera.quaternion; workspace.edit(p => { p.calibration.quaternion = { x: q.x, y: q.y, z: q.z, w: q.w }; }); } }
      }
    };
    addEventListener('keydown', keyboard); return () => removeEventListener('keydown', keyboard);
  }, []);
  useEffect(() => { if (!state.notice) return; const timer = setTimeout(() => { if (workspace.get().notice === state.notice) workspace.set({ notice: '' }); }, 4500); return () => clearTimeout(timer); }, [state.notice]);
  return <><nav className="mode-bar" aria-label="Workspace modes"><div className="mode-tabs">{modes.map(([mode, label, Icon]) => <Fragment key={mode}><button key={mode} aria-pressed={state.mode === mode} className={state.mode === mode ? 'active' : ''} onClick={() => workspace.mode(mode as WorkspaceMode)}><Icon size={15} />{label}</button>{mode === 'cube' && <><a href="/motion"><Activity size={15} />4D Motion Lab</a><a href="/research"><Activity size={15}/>4D Research View</a></>}</Fragment>)}</div><div className="history-buttons"><button title="Undo" aria-label="Undo" disabled={!workspace.history.canUndo} onClick={() => workspace.undo()}><Undo2 size={16} /></button><button title="Redo" aria-label="Redo" disabled={!workspace.history.canRedo} onClick={() => workspace.redo()}><Redo2 size={16} /></button><button title="Demo project" aria-label="Demo project" onClick={() => run(async () => { if (state.dirty && !await confirmAction('Open demo project?', 'Unsaved edits will be replaced.')) return; workspace.load(demoProject()); workspace.mode('edit'); onDemo(); workspace.notify('Demo project opened'); })}>Demo</button><button title="Help & onboarding" aria-label="Help & onboarding" onClick={() => setHelp(true)}><CircleHelp size={17} /></button></div></nav>
    <div className="overlay-toolbar"><label><input type="checkbox" checked={state.grid} onChange={event => workspace.set({ grid: event.target.checked })} />Floor grid</label><label><input type="checkbox" checked={state.camera} onChange={event => workspace.set({ camera: event.target.checked })} />Camera</label><details className="view-options"><summary>View</summary><div>{(['furniture', 'boundary', 'axes', 'marker', 'measurements', 'boxes'] as const).map(key => <label key={key}><input type="checkbox" checked={state[key]} onChange={event => workspace.set({ [key]: event.target.checked })} />{key === 'boxes' ? 'Bounding boxes' : key.charAt(0).toUpperCase() + key.slice(1)}</label>)}</div></details><span className="planner-status">{state.calibrationState} / {workspace.active().name}</span></div>
    {state.notice && <div className="toast" role="status">{state.notice}<button title="Dismiss notification" aria-label="Dismiss notification" onClick={() => workspace.set({ notice: '' })}><X size={14} /></button></div>}
    {firstRun && <div className="onboarding-strip"><CircleHelp size={15} /><span>Welcome to 4D LiveSpace</span><button onClick={() => { setStep(0); setHelp(true); }}>Start tour</button><button aria-label="Skip onboarding" title="Skip onboarding" onClick={finishTour}><X size={14} /></button></div>}
    <DialogHost />{help && <dialog ref={helpDialog} className="setup-modal help-modal" aria-labelledby="help-title" onCancel={() => setHelp(false)}><button className="modal-close" aria-label="Close help" onClick={() => setHelp(false)}><X size={19} /></button><span className="modal-eyebrow">4D LIVESPACE</span><h2 id="help-title">A room through time</h2><p>4D LiveSpace represents a physical room using three spatial dimensions (X, Y, Z) and uses time/state (T) as the fourth dimension. Each timeline state stores a different arrangement of the same room, and the application interpolates furniture between states to visualize spatial change over time.</p><div className="help-diagram"><span>T0<br />Current</span><span>---&gt;</span><span>T1<br />Study</span><span>---&gt;</span><span>T2<br />Gaming</span></div><div className="tutorial-step"><small>{step + 1} / {tutorial.length}</small><h3>{tutorial[step]}</h3><p>{['Start Windows webcam and keep it fixed. iPhone pairing is optional.', 'Set three floor points and the known A-B distance, or print and track the marker.', 'Choose a catalog item; move its ghost on the floor, then click.', 'Select furniture and use the gizmo or numerical properties.', 'Save the project. Active layout edits are stored in T0.', 'Duplicate the current layout to retain matching furniture IDs.', 'Scrub across layout states while the camera remains live.', 'Play or pause; compare states and export the view.'][step]}</p></div><div className="dialog-actions"><button onClick={finishTour}>Skip</button><button disabled={step === 0} onClick={() => setStep(step - 1)}>Previous</button><button className="primary" onClick={() => { if (step === tutorial.length - 1) finishTour(); else setStep(step + 1); }}>{step === tutorial.length - 1 ? 'Finish' : 'Next'}</button></div></dialog>}
  </>;
}
export function PlannerRightPanel() {
  const state = useWorkspace();
  if (state.mode === 'calibration') return <CalibrationPanel />;
  if (state.mode === 'layouts' || state.mode === 'timeline') return <LayoutsPanel />;
  if (state.mode === 'measure') return <MeasurementPanel />;
  if (state.mode === 'compare') return <ComparisonPanel />;
  return <PropertiesPanel />;
}
