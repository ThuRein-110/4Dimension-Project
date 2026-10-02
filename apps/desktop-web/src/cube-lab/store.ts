import { useSyncExternalStore } from 'react';
import { CubeRecordingController, interpolatePose, parseRecording, type CubePose, type CubeRecording } from '../../../../packages/cube-lab/src/recording.js';
import { verticalFov, type Smoothing } from '../../../../packages/cube-lab/src/pose.js';
import type { CubeTrackingResult } from '../../../../packages/cube-lab/src/CubeTracker.js';

const snapshot = (r: CubeRecording | null) => r ? { ...r, samples: [...r.samples], keyframes: [...r.keyframes] } : null;

interface CubeState {
  mode: 'LIVE' | 'RECORDING' | 'PLAYBACK'; tracking: 'NOT_FOUND' | 'DETECTED' | 'TRACKING' | 'LOST' | 'ERROR'; enabled: boolean;
  engine: 'idle' | 'loading' | 'ready' | 'error'; frameStatus: 'idle' | 'waiting' | 'receiving' | 'error'; framesProcessed: number;
  lastDetected: number; missed: number;
  raw: CubePose | null; filtered: CubePose | null; lastFound: number; consecutive: number;
  markerSizeMm: number; cubeSizeMm: number; fov: number; fovAxis: 'horizontal' | 'vertical'; smoothing: Smoothing; sampleRate: number;
  width: number; height: number; source: string; cube: boolean; axes: boolean; trajectory: boolean; label: boolean; debug: boolean; preview: boolean;
  recording: CubeRecording | null; paused: boolean; time: number; playing: boolean; speed: number; loop: boolean; name: string;
  debugResult: CubeTrackingResult | null; message: string;
}
export class CubeLabStore {
  private listeners = new Set<() => void>();
  readonly controller = new CubeRecordingController();
  private lastTick = 0;
  private state: CubeState = { mode: 'LIVE', tracking: 'NOT_FOUND', enabled: false, raw: null, filtered: null, lastFound: 0, consecutive: 0,
    engine: 'idle', frameStatus: 'idle', framesProcessed: 0, lastDetected: 0, missed: 0,
    markerSizeMm: 40, cubeSizeMm: 57, fov: 60, fovAxis: 'vertical', smoothing: 'Medium', sampleRate: 15, width: 1280, height: 720, source: 'Windows webcam',
    cube: true, axes: true, trajectory: true, label: true, debug: false, preview: false, recording: null, paused: false, time: 0, playing: false, speed: 1, loop: false, name: 'Cube Test 01', debugResult: null, message: '' };
  get = () => this.state;
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => this.listeners.delete(fn); };
  set(patch: Partial<CubeState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(fn => fn()); }
  vfov() { return verticalFov(this.state.fov, this.state.fovAxis, this.state.width, this.state.height); }
  toggleTracking() {
    if (this.state.mode === 'RECORDING') this.stop();
    const enabled = !this.state.enabled;
    this.set({ enabled, engine: enabled ? 'loading' : 'idle', frameStatus: enabled ? 'waiting' : 'idle', framesProcessed: 0, lastDetected: 0, missed: 0, debugResult: null, raw: null, filtered: null, lastFound: 0, consecutive: 0, tracking: 'NOT_FOUND', preview: false, message: '' });
  }
  fail(message: string) {
    if (this.state.mode === 'RECORDING') this.stop();
    this.set({ tracking: 'ERROR', enabled: false, engine: 'error', frameStatus: 'error', message, consecutive: 0, raw: null, filtered: null, lastFound: 0 });
  }
  result(result: CubeTrackingResult) {
    if (!this.state.enabled) return;
    const now = performance.now(); const s = this.state;
    if (result.engine === 'error') { this.fail(result.message ?? 'Vision engine failed'); return; }
    if (!result.frameProcessed) { this.set({ engine: result.engine, frameStatus: result.frameStatus, message: result.message ?? '' }); return; }
    let recording = s.recording;
    if (result.filtered && s.mode === 'RECORDING' && this.controller.sample(result.filtered)) recording = snapshot(this.controller.recording);
    const consecutive = result.detected ? s.consecutive + 1 : 0;
    const missed = result.detected ? 0 : s.missed + 1;
    const tracking = result.detected ? consecutive >= 3 ? 'TRACKING' : 'DETECTED' : s.lastDetected && now - s.lastDetected < 5000 ? missed >= 5 ? 'LOST' : s.tracking : 'NOT_FOUND';
    this.set({ engine: result.engine, frameStatus: result.frameStatus, framesProcessed: s.framesProcessed + 1, raw: result.raw,
      filtered: result.filtered ?? s.filtered, lastFound: result.filtered ? now : s.lastFound, lastDetected: result.detected ? now : s.lastDetected,
      consecutive, missed, tracking, debugResult: result, recording, message: result.message ?? '' });
  }
  start() {
    const s = this.state;
    if (!s.enabled || !s.filtered || s.debugResult?.poseStatus !== 'available' || (s.tracking !== 'TRACKING' && s.tracking !== 'DETECTED') || s.preview) return;
    this.controller.start({ schemaVersion: 1, recordingId: crypto.randomUUID(), createdAt: new Date().toISOString(), name: s.name.trim() || 'Cube Test',
      coordinates: 'camera-relative: X right, Y up, Z depth; quaternion in Three.js camera basis',
      camera: { width: s.width, height: s.height, verticalFov: this.vfov(), calibration: 'approximate', source: s.source }, markerId: 101, markerSizeMm: s.markerSizeMm, cubeSizeMm: s.cubeSizeMm, sampleRate: s.sampleRate });
    this.controller.sample(s.filtered);
    this.set({ mode: 'RECORDING', recording: snapshot(this.controller.recording), paused: false, time: 0, playing: false, preview: false });
  }
  pauseRecording() { if (this.state.paused) this.controller.resume(); else this.controller.pause(); this.set({ paused: this.controller.status === 'paused' }); }
  stop() { const recording = this.controller.stop(); this.set({ recording: recording ? snapshot(recording) : this.state.recording, mode: 'PLAYBACK', paused: false, playing: false, time: 0 }); }
  clear() { this.controller.clear(); this.set({ recording: null, mode: 'LIVE', time: 0, playing: false, paused: false }); }
  live() { if (this.state.mode === 'RECORDING') this.stop(); this.set({ mode: 'LIVE', playing: false, preview: false }); }
  seek(time: number) { if (this.state.mode === 'RECORDING') this.stop(); this.set({ mode: 'PLAYBACK', time: Math.max(0, Math.min(this.state.recording?.durationMs ?? 0, time)), playing: false, preview: false }); }
  step(direction: number) {
    const samples = this.state.recording?.samples ?? []; const time = this.state.time;
    const target = direction > 0 ? samples.find(s => s.timestampMs > time + .01) : [...samples].reverse().find(s => s.timestampMs < time - .01);
    this.seek(target?.timestampMs ?? (direction > 0 ? this.state.recording?.durationMs ?? 0 : 0));
  }
  play() { if (!this.state.recording?.samples.length) return; if (this.state.mode === 'RECORDING') this.stop(); this.lastTick = performance.now(); this.set({ mode: 'PLAYBACK', playing: true, preview: false, time: this.state.time >= this.state.recording.durationMs ? 0 : this.state.time }); }
  tick(now: number) {
    const s = this.state;
    if (s.enabled && s.lastDetected && now - s.lastDetected > 1000) {
      const tracking = now - s.lastDetected > 5000 ? 'NOT_FOUND' : 'LOST';
      if (s.tracking !== tracking) this.set({ tracking, consecutive: 0 });
    }
    if (s.mode === 'RECORDING') {
      const time = this.controller.elapsed();
      if ((s.recording?.samples.length ?? 0) >= 12000 || time >= 3600000) { this.stop(); this.set({ message: 'Recording limit reached. Save or export this take.' }); }
      else if (Math.abs(s.time - time) >= 50) this.set({ time });
    }
    if (s.playing && s.recording) {
      const duration = s.recording.durationMs; let time = s.time + Math.max(0, now - this.lastTick) * s.speed;
      if (time >= duration) { if (s.loop && duration > 0) time %= duration; else { time = duration; this.set({ playing: false }); } }
      this.set({ time });
    }
    this.lastTick = now;
  }
  pose(now = performance.now()): CubePose | null {
    const s = this.state;
    if (s.mode === 'PLAYBACK') return interpolatePose(s.recording?.samples ?? [], s.time);
    if (s.preview) return { position: { x: 0, y: 0, z: .5 }, rotation: { x: .12, y: .2, z: 0, w: Math.sqrt(1 - .12 ** 2 - .2 ** 2) } };
    return s.enabled && now - s.lastFound < 1000 ? s.filtered : null;
  }
  addKeyframe(name: string) {
    const r = this.state.recording; if (!r?.samples.length || !name.trim() || r.keyframes.length >= 100) return;
    const k = { id: crypto.randomUUID(), name: name.trim().slice(0, 60), timestampMs: Math.min(this.state.time, r.durationMs) };
    const recording = { ...r, keyframes: [...r.keyframes, k].sort((a, b) => a.timestampMs - b.timestampMs) };
    if (this.controller.recording?.recordingId === r.recordingId) this.controller.recording.keyframes = recording.keyframes;
    this.set({ recording });
  }
  load(value: unknown) {
    const r = parseRecording(value); this.controller.clear();
    this.set({ recording: r, mode: 'PLAYBACK', time: 0, playing: false, paused: false, preview: false, name: r.name });
  }
  suspend() { if (this.state.mode === 'RECORDING') this.stop(); this.set({ enabled: false, playing: false, filtered: null, raw: null, lastFound: 0, lastDetected: 0, missed: 0, tracking: 'NOT_FOUND', consecutive: 0, engine: 'idle', frameStatus: 'idle', framesProcessed: 0, debugResult: null }); }
}
export const cubeLab = new CubeLabStore();
export const useCubeLab = () => useSyncExternalStore(cubeLab.subscribe, cubeLab.get);
export const useCubeReplay = () => useSyncExternalStore(cubeLab.subscribe, () => cubeLab.get().mode === 'PLAYBACK' || cubeLab.get().preview);
