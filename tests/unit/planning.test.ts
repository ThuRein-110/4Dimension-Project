import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Box3, Euler, Vector3 } from 'three';
import { createProject, parseProject } from '../../packages/shared/src/project.js';
import { demoProject } from '../../packages/layouts/src/demo.js';
import { createLayout, deleteLayout } from '../../packages/layouts/src/LayoutManager.js';
import { interpolateLayouts } from '../../packages/layouts/src/TimelineInterpolator.js';
import { calibrateManual, distance } from '../../packages/room-engine/src/CalibrationManager.js';
import { overlapIds } from '../../packages/room-engine/src/CollisionChecker.js';
import { CommandHistory } from '../../packages/room-engine/src/CommandHistory.js';
import { ProjectRepository } from '../../packages/persistence/src/ProjectRepository.js';
import { markerCameraPose } from '../../packages/vision/src/MarkerTracker.js';
import { contentRect } from '../../packages/three-engine/src/CameraProjectionManager.js';
import { catalog } from '../../packages/room-engine/src/FurnitureCatalog.js';
import { primitiveFurniture, disposeObject } from '../../packages/three-engine/src/ModelLoader.js';

const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
describe('project and layout contracts', () => {
  it('round-trips every persisted field without Three objects', () => {
    const project = demoProject(); project.measurements.push({ id: crypto.randomUUID(), name: 'Floor width', a: { x: 0, y: 0, z: 0 }, b: { x: 2, y: 0, z: 0 }, visible: true });
    expect(parseProject(JSON.parse(JSON.stringify(project)))).toEqual(project);
  });
  it('rejects missing active state, zero scales, NaN and unsupported versions', () => {
    const project = demoProject();
    expect(() => parseProject({ ...project, activeLayoutId: crypto.randomUUID() })).toThrow();
    project.layouts[0].furniture[0].scale.x = 0; expect(() => parseProject(project)).toThrow();
    expect(() => parseProject({ ...createProject(), room: { name: 'Bad', width: NaN, length: 4, height: 3 } })).toThrow();
    expect(() => parseProject({ ...createProject(), schemaVersion: 999 })).toThrow();
  });
  it('duplicates snapshots independently while retaining temporal instance identities', () => {
    const project = demoProject(); const original = structuredClone(project.layouts[0]);
    const duplicate = createLayout(project, 'Copy', true);
    expect(duplicate.id).not.toBe(original.id); expect(duplicate.furniture[0].instanceId).toBe(original.furniture[0].instanceId);
    duplicate.furniture[0].position.x += 2;
    expect(project.layouts[0]).toEqual(original);
    deleteLayout(project, duplicate.id); expect(project.layouts.some(l => l.id === project.activeLayoutId)).toBe(true);
    const single = createProject(); expect(() => deleteLayout(single, single.activeLayoutId)).toThrow();
  });
  it('rejects unknown models and conflicting model identities across time', () => {
    const project = demoProject();
    expect(() => parseProject({ ...project, layouts: [{ ...project.layouts[0], furniture: [{ ...project.layouts[0].furniture[0], furnitureId: 'missing-model' }] }] })).toThrow();
    project.layouts[1].furniture[0].furnitureId = 'desk';
    expect(() => parseProject(project)).toThrow();
  });
});
describe('temporal interpolation', () => {
  it('interpolates scale and visibility without changing stored snapshots', () => {
    const a = demoProject().layouts[0]; const b = structuredClone(a); const original = structuredClone(a);
    b.furniture[0].scale = { x: 2, y: 3, z: 4 };
    expect(interpolateLayouts(a, b, .5, 'linear')[0].scale).toEqual({ x: 1.5, y: 2, z: 2.5 });
    b.furniture[0].visible = false;
    expect(interpolateLayouts(a, b, .5, 'linear')[0].opacity).toBe(.5);
    expect(a).toEqual(original);
  });
  it('moves the same instance and reaches exact state transforms', () => {
    const [a, b] = demoProject().layouts;
    const start = interpolateLayouts(a, b, 0); const end = interpolateLayouts(a, b, 1);
    expect(start.find(i => i.instanceId === a.furniture[0].instanceId)?.position).toEqual(a.furniture[0].position);
    expect(end.find(i => i.instanceId === b.furniture[0].instanceId)?.position).toEqual(b.furniture[0].position);
    const middle = interpolateLayouts(a, b, .5, 'linear').find(i => i.instanceId === a.furniture[0].instanceId)!;
    expect(middle.position.z).toBeCloseTo((a.furniture[0].position.z + b.furniture[0].position.z) / 2);
    const added = b.furniture.at(-1)!;
    expect(start.find(i => i.instanceId === added.instanceId)?.opacity).toBe(0);
    expect(end.find(i => i.instanceId === added.instanceId)?.opacity).toBe(1);
  });
  it('slerps across the short rotation path and animates disappearance', () => {
    const project = demoProject(); const a = project.layouts[0]; const b = structuredClone(a);
    a.furniture[0].rotation.y = 170 * Math.PI / 180; b.furniture[0].rotation.y = -170 * Math.PI / 180;
    const item = interpolateLayouts(a, b, .5, 'linear')[0];
    // Euler representations are nonunique; compare the rotated forward vector.
    const forward = new Vector3(0, 0, 1); const expected = new Vector3(0, 0, -1);
    const { x, y, z } = item.rotation;
    forward.applyEuler(new Euler(x, y, z));
    expect(forward.distanceTo(expected)).toBeLessThan(.001);
    b.furniture = []; const vanished = interpolateLayouts(a, b, 1);
    expect(vanished.every(i => !i.visible && i.opacity === 0)).toBe(true);
  });
});
describe('geometry, calibration and history', () => {
  it('builds every catalog model with a floor-aligned base and expected meter bounds', () => {
    for (const item of catalog) {
      const group = primitiveFurniture(item); const bounds = new Box3().setFromObject(group); const size = bounds.getSize(new Vector3());
      expect(bounds.min.y).toBeCloseTo(0, 5);
      expect(Math.abs(size.x - item.width)).toBeLessThan(.03);
      expect(Math.abs(size.y - item.height)).toBeLessThan(.03);
      expect(Math.abs(size.z - item.depth)).toBeLessThan(.03);
      expect(group.children.length).toBeGreaterThan(1); disposeObject(group);
    }
  });
  it('measures distance and flags approximate Box3 overlap', () => {
    expect(distance({ x: 0, y: 0, z: 0 }, { x: 3, y: 0, z: 4 })).toBe(5);
    const item = demoProject().layouts[0].furniture[0];
    const copy = { ...structuredClone(item), instanceId: crypto.randomUUID() };
    expect(overlapIds([item, copy]).size).toBe(2); copy.position.x += 10;
    expect(overlapIds([item, copy]).size).toBe(0);
  });
  it('establishes scale/origin from three valid floor points and rejects degeneracy', () => {
    const calibration = createProject().calibration;
    const points = [{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 0, y: 0, z: 2 }];
    const result = calibrateManual(calibration, points, 1);
    expect(result.position.y).toBeCloseTo(calibration.position.y / 2); expect(result.method).toBe('manual');
    expect(() => calibrateManual(calibration, [points[0], points[0], points[0]], 1)).toThrow();
  });
  it('converts a frontal marker pose to a downward-looking floor camera', () => {
    const pose = markerCameraPose([[1, 0, 0], [0, 1, 0], [0, 0, 1]], [0, 0, 2]);
    expect(pose.position.y).toBeCloseTo(2);
    expect(new Vector3(0, 0, -1).applyQuaternion(pose.quaternion).y).toBeCloseTo(-1);
  });
  it('bounds undo memory and clears redo on a new command', () => {
    const history = new CommandHistory<number>(2); history.record(1); history.record(2); history.record(3);
    expect(history.undo(4)).toBe(3); expect(history.undo(3)).toBe(2); expect(history.undo(2)).toBeUndefined();
    expect(history.redo(2)).toBe(3); history.record(9); expect(history.canRedo).toBe(false);
  });
  it('matches video contain and cover rectangles', () => {
    expect(contentRect(100, 100, 200, 100, 'contain')).toEqual({ x: 0, y: 25, width: 100, height: 50 });
    expect(contentRect(100, 100, 200, 100, 'cover')).toEqual({ x: -50, y: 0, width: 200, height: 100 });
  });
});
describe('Windows local repository', () => {
  it('saves, replaces, backs up, reopens and deletes projects', async () => {
    const root = await mkdtemp(join(tmpdir(), 'livespace-project-')); roots.push(root);
    const repository = new ProjectRepository(root); const project = demoProject();
    await repository.save(project); project.name = 'Updated'; await repository.save(project);
    expect((await new ProjectRepository(root).load(project.id)).name).toBe('Updated');
    expect((await repository.load(project.id, true)).name).toBe('Demo Bedroom');
    expect(await repository.list()).toHaveLength(1);
    await writeFile(join(root, `${project.id}.json`), 'corrupt');
    expect((await repository.list())[0].corrupt).toBe(true);
    expect((await repository.load(project.id, true)).name).toBe('Demo Bedroom');
    await repository.save(project);
    expect((await repository.load(project.id, true)).name).toBe('Demo Bedroom');
    await repository.delete(project.id); expect(await repository.list()).toHaveLength(0);
    await expect(new ProjectRepository(root).load('../ca-key')).rejects.toThrow();
  });
  it('serializes overlapping saves without truncation', async () => {
    const root = await mkdtemp(join(tmpdir(), 'livespace-project-')); roots.push(root); const repository = new ProjectRepository(root);
    const project = createProject();
    await Promise.all([repository.save({ ...project, name: 'First' }), repository.save({ ...project, name: 'Second' })]);
    expect(JSON.parse(await readFile(join(root, `${project.id}.json`), 'utf8')).name).toBe('Second');
  });
});
