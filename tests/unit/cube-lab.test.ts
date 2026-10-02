import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { CubeRecordingController, interpolatePose, parseRecording, type CubePose, type CubeRecording } from '../../packages/cube-lab/src/recording.js';
import { cubePose, CubePoseFilter, verticalFov } from '../../packages/cube-lab/src/pose.js';
import { CubeLabStore } from '../../apps/desktop-web/src/cube-lab/store.js';
import type { CubeTrackingResult } from '../../packages/cube-lab/src/CubeTracker.js';

const pose: CubePose = { position: { x: .1, y: .2, z: .8 }, rotation: { x: 0, y: 0, z: 0, w: 1 } };
const frame: CubeTrackingResult = { raw: pose, filtered: pose, width: 640, height: 360, fps: 15, engine: 'ready', frameProcessed: true, frameStatus: 'receiving', detected: true, markers: [{ id: 101, corners: [] }], poseStatus: 'available' };
const metadata: Omit<CubeRecording, 'samples' | 'keyframes' | 'durationMs'> = { schemaVersion: 1, recordingId: crypto.randomUUID(), createdAt: new Date().toISOString(), name: 'Test', coordinates: 'camera-relative: X right, Y up, Z depth; quaternion in Three.js camera basis', camera: { width: 1280, height: 720, verticalFov: 60, calibration: 'approximate', source: 'Windows webcam' }, markerId: 101, markerSizeMm: 40, cubeSizeMm: 57, sampleRate: 10 };
describe('cube lab', () => {
  it('converts marker-face pose to cube center, preserving a proper rotation basis', () => {
    const p = cubePose([[1, 0, 0], [0, 1, 0], [0, 0, 1]], [.1, .2, .8], .057);
    expect(p.position).toEqual({ x: .1, y: .2, z: .8285 }); expect(p.rotation.w).toBe(1);
    const angle = .5; const tilted = cubePose([[Math.cos(angle), 0, Math.sin(angle)], [0, 1, 0], [-Math.sin(angle), 0, Math.cos(angle)]], [0, 0, 1], .057);
    expect(Math.hypot(...Object.values(tilted.rotation))).toBeCloseTo(1);
    const q = new Quaternion(tilted.rotation.x, tilted.rotation.y, tilted.rotation.z, tilted.rotation.w);
    const face = new Vector3(tilted.position.x, tilted.position.y, -tilted.position.z).add(new Vector3(0, 0, .057 / 2).applyQuaternion(q));
    expect(face.x).toBeCloseTo(0); expect(face.z).toBeCloseTo(-1);
  });
  it('derives vertical intrinsics from horizontal field of view', () => {
    expect(verticalFov(60, 'vertical', 1280, 720)).toBe(60);
    expect(verticalFov(90, 'horizontal', 1280, 720)).toBeCloseTo(58.7155, 3);
  });
  it('smooths position and quaternion and rejects isolated jumps, then reacquires after loss', () => {
    const filter = new CubePoseFilter(); filter.update(pose, 0, 'Medium');
    const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 1);
    const filtered = filter.update({ ...pose, position: { ...pose.position, x: .2 }, rotation: { x: q.x, y: q.y, z: q.z, w: q.w } }, 100, 'Medium')!;
    expect(filtered.position.x).toBeCloseTo(.135); expect(new Quaternion(filtered.rotation.x, filtered.rotation.y, filtered.rotation.z, filtered.rotation.w).angleTo(new Quaternion())).toBeCloseTo(.35);
    expect(filter.update({ ...pose, position: { ...pose.position, x: 3 } }, 200, 'Off')).toBeNull();
    expect(filter.update({ ...pose, position: { ...pose.position, x: 3 } }, 1500, 'Off')!.position.x).toBe(3);
    expect(filter.update({ ...pose, position: { ...pose.position, z: NaN } }, 1600, 'Medium')).toBeNull();
  });
  it('records relative time at bounded Hz and excludes paused wall-clock time', () => {
    let now = 5000; const recorder = new CubeRecordingController(() => now); recorder.start(metadata);
    expect(recorder.sample(pose)).toBe(true); now += 50; expect(recorder.sample(pose)).toBe(false);
    now += 50; recorder.sample(pose); now += 100; recorder.pause(); now += 2000;
    expect(recorder.sample(pose)).toBe(false); expect(recorder.elapsed()).toBe(200);
    recorder.resume(); now += 100; recorder.sample(pose); now += 100; const result = recorder.stop()!;
    expect(result.samples.map(p => p.timestampMs)).toEqual([0, 100, 300]); expect(result.durationMs).toBe(400);
    expect(recorder.sample(pose)).toBe(false); expect(parseRecording(result)).toEqual(result);
    recorder.clear(); expect(recorder.recording).toBeNull();
  });
  it('interpolates arbitrary times and unit quaternions and clamps ends', () => {
    const samples = [{ ...pose, timestampMs: 0 }, { position: { x: .3, y: .4, z: 1 }, rotation: { x: 0, y: 1, z: 0, w: 0 }, timestampMs: 1000 }];
    const mid = interpolatePose(samples, 250)!; expect(mid.position.x).toBeCloseTo(.15); expect(mid.rotation.y).toBeCloseTo(Math.sin(Math.PI / 8));
    expect(interpolatePose(samples, -1)).toBe(samples[0]); expect(interpolatePose(samples, 2000)).toBe(samples[1]); expect(interpolatePose([], 10)).toBeNull();
  });
  it('rejects nonfinite, unordered, oversized and out-of-duration imports', () => {
    const value = { ...metadata, durationMs: 1000, samples: [{ ...pose, timestampMs: 0 }], keyframes: [] };
    expect(parseRecording(value).samples).toHaveLength(1);
    expect(() => parseRecording({ ...value, samples: [{ ...pose, timestampMs: 0 }, { ...pose, timestampMs: 0 }] })).toThrow();
    expect(() => parseRecording({ ...value, samples: [{ ...pose, timestampMs: 1001 }] })).toThrow();
    expect(() => parseRecording({ ...value, samples: [{ ...pose, timestampMs: 0, position: { ...pose.position, z: Infinity } }] })).toThrow();
    expect(() => parseRecording({ ...value, keyframes: [{ id: crypto.randomUUID(), name: 'Far', timestampMs: 2000 }] })).toThrow();
    expect(() => parseRecording({ ...value, schemaVersion: 2 })).toThrow();
  });
  it('keeps playback independent of live detection and handles speed, loop, stepping and keyframes', () => {
    const store = new CubeLabStore();
    store.load({ ...metadata, durationMs: 1000, samples: [{ ...pose, timestampMs: 0 }, { ...pose, position: { ...pose.position, x: .3 }, timestampMs: 1000 }], keyframes: [] });
    store.seek(250); expect(store.pose()!.position.x).toBeCloseTo(.15);
    store.set({ enabled: true }); store.result({ ...frame, raw: { ...pose, position: { ...pose.position, x: 5 } }, filtered: { ...pose, position: { ...pose.position, x: 5 } } });
    expect(store.pose()!.position.x).toBeCloseTo(.15); store.addKeyframe('Left'); expect(store.get().recording!.keyframes[0].timestampMs).toBe(250);
    store.step(1); expect(store.get().time).toBe(1000); store.step(-1); expect(store.get().time).toBe(0);
    store.set({ speed: 2, playing: true, loop: true }); store.tick(100); expect(store.get().time).toBe(200); store.tick(700); expect(store.get().time).toBe(400);
    store.set({ loop: false }); store.tick(1200); expect(store.get().time).toBe(1000); expect(store.get().playing).toBe(false);
    store.live(); expect(store.get().mode).toBe('LIVE'); store.clear(); expect(store.get().recording).toBeNull();
  });
  it('retains a lost pose only briefly, while detector failures never record samples', () => {
    const store = new CubeLabStore(); store.set({ enabled: true });
    store.result(frame); const found = store.get().lastFound;
    expect(store.get().tracking).toBe('DETECTED'); store.result(frame); expect(store.get().tracking).toBe('DETECTED'); store.result(frame); expect(store.get().tracking).toBe('TRACKING');
    store.start(); const count = store.get().recording!.samples.length;
    for (let i = 0; i < 5; i++) store.result({ ...frame, raw: null, filtered: null, detected: false, markers: [], poseStatus: 'none' }); expect(store.get().tracking).toBe('LOST'); expect(store.get().recording!.samples.length).toBe(count);
    expect(store.pose(found + 500)).not.toBeNull(); expect(store.pose(found + 1500)).toBeNull(); store.suspend(); expect(store.get().mode).toBe('PLAYBACK'); expect(store.get().enabled).toBe(false);
  });
  it('separates decoded markers from invalid pose and engine errors', () => {
    const store = new CubeLabStore(); store.set({ enabled: true });
    const detectedOnly: CubeTrackingResult = { ...frame, raw: null, filtered: null, poseStatus: 'unavailable', poseMessage: 'No valid focal length' };
    store.result(detectedOnly); expect(store.get().tracking).toBe('DETECTED'); expect(store.pose()).toBeNull();
    store.result(detectedOnly); store.result(detectedOnly); expect(store.get().tracking).toBe('TRACKING'); store.start(); expect(store.get().recording).toBeNull();
    expect(store.get().framesProcessed).toBe(3); store.result({ ...frame, engine: 'error', message: 'Worker load failed', frameProcessed: false });
    expect(store.get().tracking).toBe('ERROR'); expect(store.get().enabled).toBe(false); expect(store.get().message).toBe('Worker load failed');
    store.toggleTracking(); expect(store.get().engine).toBe('loading'); expect(store.get().tracking).toBe('NOT_FOUND');
  });
  it('reports all decoded IDs, expires long loss, and ignores results after Stop tracking', () => {
    const store = new CubeLabStore(); store.toggleTracking();
    store.result({ ...frame, detected: false, raw: null, filtered: null, markers: [{ id: 100, corners: [] }], poseStatus: 'none' });
    expect(store.get().tracking).toBe('NOT_FOUND'); expect(store.get().debugResult!.markers[0].id).toBe(100);
    store.result(frame); store.tick(store.get().lastDetected + 6000); expect(store.get().tracking).toBe('NOT_FOUND'); expect(store.pose(store.get().lastFound + 6000)).toBeNull();
    store.toggleTracking(); const count = store.get().framesProcessed; store.result(frame); expect(store.get().framesProcessed).toBe(count); expect(store.get().filtered).toBeNull();
  });
});
