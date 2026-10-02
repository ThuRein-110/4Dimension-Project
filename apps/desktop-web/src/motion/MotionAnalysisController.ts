import { analysisIdentity, MODEL_VERSION, LANDMARK_NAMES, defaultDisplay, type MotionAnalysis, type MotionPoseSample } from '../../../../packages/shared/src/motion.js';
import type { VideoMetadata } from './types.js';
import type { PoseEngine } from './PoseEngine.js';

export interface AnalysisProgress { done: number; total: number; valid: number; missing: number; elapsedMs: number }
export function waitForMedia(video: HTMLVideoElement, event: 'loadeddata' | 'seeked', signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); video.removeEventListener(event, ready); video.removeEventListener('error', failed); signal.removeEventListener('abort', aborted); };
    const ready = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error('Video frame decoding failed.')); };
    const aborted = () => { cleanup(); reject(new DOMException('Analysis cancelled', 'AbortError')); };
    const timer = setTimeout(() => { cleanup(); reject(new Error('Video frame decoding timed out.')); }, 15000);
    video.addEventListener(event, ready, { once: true }); video.addEventListener('error', failed, { once: true }); signal.addEventListener('abort', aborted, { once: true });
    if (signal.aborted) aborted();
  });
}
export class MotionAnalysisController {
  private abort = new AbortController();
  cancel() { this.abort.abort(); }
  constructor(private engine: PoseEngine) {}
  async analyze(metadata: VideoMetadata, url: string, fps: 10 | 15 | 30, progress: (value: AnalysisProgress) => void, singleTime?: number): Promise<MotionAnalysis> {
    const video = document.createElement('video'); video.muted = true; video.playsInline = true; video.preload = 'auto';
    const signal = this.abort.signal;
    const samples: MotionPoseSample[] = [];
    try {
      const loaded = waitForMedia(video, 'loadeddata', signal); video.src = url; video.load(); await loaded;
      if (video.duration > 7200) throw new Error('Use a clip shorter than two hours for offline analysis.');
      await this.engine.reset();
      const timestamps = singleTime === undefined ? Array.from({ length: Math.ceil(video.duration * fps) }, (_, i) => Math.min(i/fps, video.duration-.001)) : [Math.min(singleTime, video.duration-.001)];
      const started = performance.now(); let valid = 0;
      progress({ done: 0, total: timestamps.length, valid: 0, missing: 0, elapsedMs: 0 });
      for (const time of timestamps) {
        signal.throwIfAborted();
        if (Math.abs(video.currentTime-time) > .0001) { const seeked = waitForMedia(video, 'seeked', signal); video.currentTime = time; await seeked; }
        signal.throwIfAborted();
        const bitmap = await createImageBitmap(video);
        const sample = await this.engine.infer(bitmap, video.currentTime, Math.round(video.currentTime * metadata.fps));
        signal.throwIfAborted(); samples.push(sample); if (sample.valid) valid++;
        progress({ done: samples.length, total: timestamps.length, valid, missing: samples.length-valid, elapsedMs: performance.now()-started });
      }
      return { schemaVersion: 1, id: await analysisIdentity(metadata.id,fps), video: { ...metadata, duration: video.duration },
        analysis: { scope: singleTime === undefined ? 'video' : 'frame', fps, modelVersion: MODEL_VERSION, landmarkNames: [...LANDMARK_NAMES], coordinateSystem: 'mediapipe-raw; three=(x,-y,-z); hip-relative-estimated' }, samples, keyframes: [], display: { ...defaultDisplay }, club: [], derived: { validFrames: valid, missingFrames: samples.length-valid } };
    } finally { video.pause(); video.removeAttribute('src'); video.load(); }
  }
}
