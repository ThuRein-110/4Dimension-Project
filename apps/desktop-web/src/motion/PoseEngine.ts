import type { MotionPoseSample } from '../../../../packages/shared/src/motion.js';

export class PoseEngine {
  private worker = new Worker(new URL('./pose-worker.ts', import.meta.url), { type: 'module' });
  private sequence = 0;
  private closed = false;
  private pending = new Map<number, { resolve: (value: MotionPoseSample | undefined) => void; reject: (reason: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  constructor() {
    this.worker.onmessage = (event: MessageEvent<{ id: number; error?: string; sample?: MotionPoseSample }>) => {
      const pending = this.pending.get(event.data.id); if (!pending) return;
      clearTimeout(pending.timer); this.pending.delete(event.data.id);
      if (event.data.error) pending.reject(new Error(event.data.error)); else pending.resolve(event.data.sample);
    };
    this.worker.onerror = event => this.fail(new Error(event.message || 'Pose worker failed.'));
  }
  private fail(error: Error) { for (const task of this.pending.values()) { clearTimeout(task.timer); task.reject(error); } this.pending.clear(); }
  private call(type: 'init' | 'reset' | 'frame', bitmap?: ImageBitmap, timeSeconds?: number, frameIndex?: number) {
    if (this.closed) { bitmap?.close(); return Promise.reject(new Error('Pose worker closed.')); }
    const id = ++this.sequence;
    return new Promise<MotionPoseSample | undefined>((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('Pose worker timed out. Retry model initialization.')); }, type === 'init' ? 180000 : 30000);
      this.pending.set(id, { resolve, reject, timer });
      try { this.worker.postMessage({ id, type, bitmap, timeSeconds, frameIndex }, bitmap ? [bitmap] : []); }
      catch(error) { clearTimeout(timer); this.pending.delete(id); bitmap?.close(); reject(error instanceof Error ? error : new Error('Pose frame transfer failed.')); }
    });
  }
  async initialize() { await this.call('init'); }
  async reset() { await this.call('reset'); }
  async infer(bitmap: ImageBitmap, timeSeconds: number, frameIndex: number) { const sample = await this.call('frame', bitmap, timeSeconds, frameIndex); if (!sample) throw new Error('Inference returned no sample.'); return sample; }
  dispose() { this.closed = true; this.worker.terminate(); this.fail(new Error('Pose worker closed.')); }
}
