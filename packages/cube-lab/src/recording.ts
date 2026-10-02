import { z } from 'zod';
import { Quaternion, Vector3 } from 'three';

const finite = z.number().finite();
const position = z.object({ x: finite.min(-100).max(100), y: finite.min(-100).max(100), z: finite.positive().max(100) });
const rotation = z.object({ x: finite, y: finite, z: finite, w: finite }).refine(q => Math.abs(Math.hypot(q.x, q.y, q.z, q.w) - 1) < .001, 'Rotation must be normalized');
export const sampleSchema = z.object({ timestampMs: finite.min(0).max(3600000), position, rotation, trackingConfidence: finite.min(0).max(1).optional() });
export type CubePoseSample = z.infer<typeof sampleSchema>;
export type CubePose = Omit<CubePoseSample, 'timestampMs'>;
export const recordingSchema = z.object({
  schemaVersion: z.literal(1), recordingId: z.string().uuid(), createdAt: z.string().datetime(), name: z.string().trim().min(1).max(80),
  coordinates: z.literal('camera-relative: X right, Y up, Z depth; quaternion in Three.js camera basis'),
  camera: z.object({ width: finite.int().min(1).max(8192), height: finite.int().min(1).max(8192), verticalFov: finite.min(1).max(160), calibration: z.literal('approximate'), source: z.string().max(80) }),
  markerId: z.literal(101), markerSizeMm: finite.min(5).max(500), cubeSizeMm: finite.min(5).max(1000), sampleRate: finite.int().min(10).max(20),
  durationMs: finite.min(0).max(3600000), samples: z.array(sampleSchema).max(12000),
  keyframes: z.array(z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(60), timestampMs: finite.min(0) })).max(100),
}).superRefine((r, ctx) => {
  if (r.samples.some((s, i) => s.timestampMs > r.durationMs || (i > 0 && s.timestampMs <= r.samples[i - 1].timestampMs))) ctx.addIssue({ code: 'custom', message: 'Samples must be strictly chronological and within duration' });
  if (r.keyframes.some(k => k.timestampMs > r.durationMs) || new Set(r.keyframes.map(k => k.id)).size !== r.keyframes.length) ctx.addIssue({ code: 'custom', message: 'Invalid keyframes' });
});
export type CubeRecording = z.infer<typeof recordingSchema>;
export function parseRecording(value: unknown) { return recordingSchema.parse(value); }
export function interpolatePose(samples: CubePoseSample[], time: number): CubePoseSample | null {
  if (!samples.length) return null;
  if (time <= samples[0].timestampMs) return samples[0];
  if (time >= samples.at(-1)!.timestampMs) return samples.at(-1)!;
  let low = 0; let high = samples.length - 1;
  while (high - low > 1) { const mid = (low + high) >> 1; if (samples[mid].timestampMs <= time) low = mid; else high = mid; }
  const a = samples[low]; const b = samples[high]; const t = (time - a.timestampMs) / (b.timestampMs - a.timestampMs);
  const p = new Vector3().lerpVectors(new Vector3(a.position.x, a.position.y, a.position.z), new Vector3(b.position.x, b.position.y, b.position.z), t);
  const q = new Quaternion(a.rotation.x, a.rotation.y, a.rotation.z, a.rotation.w).slerp(new Quaternion(b.rotation.x, b.rotation.y, b.rotation.z, b.rotation.w), t);
  return { timestampMs: time, position: { x: p.x, y: p.y, z: p.z }, rotation: { x: q.x, y: q.y, z: q.z, w: q.w } };
}
export class CubeRecordingController {
  recording: CubeRecording | null = null;
  status: 'idle' | 'recording' | 'paused' = 'idle';
  private startedAt = 0;
  private accumulated = 0;
  private lastSample = -Infinity;
  constructor(private clock = () => performance.now()) {}
  start(metadata: Omit<CubeRecording, 'samples' | 'keyframes' | 'durationMs'>) {
    this.recording = { ...metadata, samples: [], keyframes: [], durationMs: 0 }; this.status = 'recording';
    this.startedAt = this.clock(); this.accumulated = 0; this.lastSample = -Infinity;
  }
  elapsed() { return this.accumulated + (this.status === 'recording' ? this.clock() - this.startedAt : 0); }
  sample(pose: CubePose) {
    if (!this.recording || this.status !== 'recording') return false;
    const time = this.elapsed();
    if (time - this.lastSample < 1000 / this.recording.sampleRate || this.recording.samples.length >= 12000 || time > 3600000) return false;
    const sample = sampleSchema.parse({ ...pose, timestampMs: time });
    this.recording.samples.push(sample); this.recording.durationMs = time; this.lastSample = time; return true;
  }
  pause() { if (this.status === 'recording') { this.accumulated = this.elapsed(); this.status = 'paused'; } }
  resume() { if (this.status === 'paused') { this.startedAt = this.clock(); this.status = 'recording'; } }
  stop() { if (this.status === 'recording') this.pause(); this.status = 'idle'; if (this.recording) this.recording.durationMs = Math.min(3600000, this.accumulated); return this.recording; }
  clear() { this.status = 'idle'; this.recording = null; this.accumulated = 0; }
}
