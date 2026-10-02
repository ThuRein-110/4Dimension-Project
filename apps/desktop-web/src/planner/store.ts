import { useSyncExternalStore } from 'react';
import { createProject, parseProject, type Project, type WorkspaceMode, type Vec3, type CalibrationState, type FurnitureInstance, type Calibration } from '../../../../packages/shared/src/project.js';
import { CommandHistory } from '../../../../packages/room-engine/src/CommandHistory.js';

export interface WorkspaceState {
  project: Project; mode: WorkspaceMode; selected: string | null; placing: FurnitureInstance['furnitureId'] | null;
  grid: boolean; axes: boolean; boundary: boolean; furniture: boolean; camera: boolean; measurements: boolean; boxes: boolean; marker: boolean;
  calibrationState: CalibrationState; calibrationPoints: Vec3[];
  trackingPose: Pick<Calibration, 'position' | 'quaternion'> | null;
  snap: number; transformMode: 'translate' | 'rotate' | 'scale';
  timeline: number; playing: boolean; startedAt: number; speed: number;
  compareA: number; compareB: number; compareSplit: number; compareStyle: 'slider' | 'split' | 'toggle';
  dirty: boolean; savedAt: string | null; notice: string; busy: boolean;
}
export class WorkspaceStore {
  private listeners = new Set<() => void>();
  readonly history = new CommandHistory<Project>();
  private state: WorkspaceState = { project: createProject(), mode: 'camera', selected: null, placing: null,
    grid: false, axes: false, boundary: true, furniture: true, camera: true, measurements: true, boxes: false, marker: true,
    calibrationState: 'NotCalibrated', calibrationPoints: [], trackingPose: null, snap: .1, transformMode: 'translate',
    timeline: 0, playing: false, startedAt: 0, speed: 1, compareA: 0, compareB: 0, compareSplit: .5, compareStyle: 'slider',
    dirty: false, savedAt: null, notice: '', busy: false };
  get = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  set(patch: Partial<WorkspaceState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); }
  notify(message: string) { this.set({ notice: message }); }
  edit(change: (project: Project) => void, message = '') {
    const draft = structuredClone(this.state.project); change(draft); draft.updatedAt = new Date().toISOString();
    const valid = parseProject(draft); this.history.record(this.state.project);
    this.set({ project: valid, dirty: true, playing: false, notice: message || this.state.notice });
  }
  load(project: Project, savedAt: string | null = null) {
    this.history.clear();
    this.set({ project: parseProject(project), savedAt, dirty: !savedAt, selected: null, placing: null, playing: false, timeline: 0,
      compareA: 0, compareB: project.layouts.length - 1,
      calibrationPoints: [], trackingPose: null, calibrationState: project.calibration.method === 'none' ? 'NotCalibrated' : project.calibration.method === 'manual' ? 'ManualCalibration' : 'TrackingLost' });
  }
  active() { return this.state.project.layouts.find(layout => layout.id === this.state.project.activeLayoutId)!; }
  recalibrate() {
    const pose = this.state.trackingPose;
    this.edit(project => { if (pose) Object.assign(project.calibration, pose); project.calibration.method = 'none'; }, 'Select three floor points to recalibrate the fixed camera.');
    this.set({ mode: 'calibration', calibrationState: 'Calibrating', calibrationPoints: [], trackingPose: null, selected: null, placing: null, grid: true });
  }
  mode(mode: WorkspaceMode) {
    this.pause();
    this.set({ mode, placing: mode === 'place' ? this.state.placing : null, selected: mode === 'edit' ? this.state.selected : null, grid: mode === 'camera' ? this.state.grid : true });
  }
  updateInstance(id: string, change: Partial<FurnitureInstance>) {
    this.edit(project => {
      const item = project.layouts.find(layout => layout.id === project.activeLayoutId)!.furniture.find(item => item.instanceId === id);
      if (item) Object.assign(item, change);
    });
  }
  undo() { const project = this.history.undo(this.state.project); if (project) this.set({ project, dirty: true, selected: null, playing: false, notice: 'Action undone' }); }
  redo() { const project = this.history.redo(this.state.project); if (project) this.set({ project, dirty: true, selected: null, playing: false, notice: 'Action redone' }); }
  time(now = performance.now()) {
    return Math.min(this.state.project.layouts.length - 1, this.state.timeline + (this.state.playing ? (now - this.state.startedAt) / 1000 * this.state.speed / this.state.project.settings.duration : 0));
  }
  seek(time: number) { this.set({ timeline: Math.max(0, Math.min(this.state.project.layouts.length - 1, time)), playing: false }); }
  play() { this.set({ timeline: this.time() >= this.state.project.layouts.length - 1 ? 0 : this.time(), startedAt: performance.now(), playing: true }); }
  pause() { this.set({ timeline: this.time(), playing: false }); }
}
export const workspace = new WorkspaceStore();
export const useWorkspace = () => useSyncExternalStore(workspace.subscribe, workspace.get);
