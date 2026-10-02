import { expect, it } from 'vitest';
import { WorkspaceStore } from '../../apps/desktop-web/src/planner/store.js';
import { demoProject } from '../../packages/layouts/src/demo.js';

it('recalibrates without replacing room content or retaining stale tracking/selection', () => {
  const store = new WorkspaceStore(); const project = demoProject();
  project.measurements.push({ id: crypto.randomUUID(), name: 'Width', a: { x: 0, y: 0, z: 0 }, b: { x: 1, y: 0, z: 0 }, visible: true });
  store.load(project, project.updatedAt);
  store.set({ calibrationPoints: [{ x: 1, y: 0, z: 1 }], selected: project.layouts[0].furniture[0].instanceId, placing: 'desk', playing: true, trackingPose: { position: { x: 3, y: 2, z: 4 }, quaternion: project.calibration.quaternion } });
  store.recalibrate(); const state = store.get();
  expect(state.project.id).toBe(project.id); expect(state.project.room).toEqual(project.room);
  expect(state.project.layouts).toEqual(project.layouts); expect(state.project.measurements).toEqual(project.measurements);
  expect(state.project.calibration.method).toBe('none'); expect(state.project.calibration.position).toEqual({ x: 3, y: 2, z: 4 });
  expect(state.calibrationState).toBe('Calibrating'); expect(state.mode).toBe('calibration'); expect(state.calibrationPoints).toEqual([]);
  expect(state.trackingPose).toBeNull(); expect(state.selected).toBeNull(); expect(state.placing).toBeNull(); expect(state.playing).toBe(false); expect(state.dirty).toBe(true);
});
