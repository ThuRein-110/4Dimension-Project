import type { MarkerResult } from '../../vision/src/MarkerTracker.js';
import { cubePose, CubePoseFilter, type Smoothing } from './pose.js';
import type { CubePose } from './recording.js';

export interface CubeTrackingResult { raw: CubePose | null; filtered: CubePose | null; corners?: MarkerResult['corners']; error?: number; message?: string; width: number; height: number; fps: number }
export class CubeTracker {
  private worker = new Worker('/assets/marker-worker.js');
  private canvas = document.createElement('canvas');
  private filter = new CubePoseFilter();
  private pending = false;
  private sentAt = 0;
  private previousAt = 0;
  private options = { cubeSizeMm: 57, smoothing: 'Medium' as Smoothing };
  constructor(private callback: (result: CubeTrackingResult) => void) {
    this.worker.onerror = () => { this.pending = false; callback({ raw: null, filtered: null, width: this.canvas.width, height: this.canvas.height, fps: 0, message: 'Cube detector unavailable. Stop tracking and retry.' }); };
    this.worker.onmessage = event => {
      this.pending = false;
      const result = event.data as MarkerResult;
      const now = performance.now(); const fps = this.previousAt ? 1000 / (now - this.previousAt) : 0; this.previousAt = now;
      const raw = result.found && result.rotation && result.translation ? { ...cubePose(result.rotation, result.translation, this.options.cubeSizeMm / 1000), trackingConfidence: Math.max(0, 1 - (result.error ?? 8) / 8) } : null;
      callback({ raw, filtered: raw ? this.filter.update(raw, now, this.options.smoothing) : null, corners: result.corners, error: result.error, message: result.message, width: this.canvas.width, height: this.canvas.height, fps });
    };
  }
  capture(media: HTMLVideoElement | HTMLImageElement, options: { markerSizeMm: number; cubeSizeMm: number; verticalFov: number; smoothing: Smoothing }) {
    if (this.pending || (media instanceof HTMLVideoElement && (media.readyState < 2 || media.paused || media.ended))) return;
    const width = media instanceof HTMLVideoElement ? media.videoWidth : media.naturalWidth;
    const height = media instanceof HTMLVideoElement ? media.videoHeight : media.naturalHeight;
    if (!width || !height) return;
    this.canvas.width = Math.min(width, 960); this.canvas.height = Math.round(height * this.canvas.width / width);
    try {
      const context = this.canvas.getContext('2d', { willReadFrequently: true })!;
      context.drawImage(media, 0, 0, this.canvas.width, this.canvas.height);
      const pixels = context.getImageData(0, 0, this.canvas.width, this.canvas.height);
      this.options = options; this.pending = true; this.sentAt = performance.now();
      this.worker.postMessage({ width: pixels.width, height: pixels.height, buffer: pixels.data.buffer, markerSize: options.markerSizeMm / 1000, fov: options.verticalFov, markerId: 101 }, [pixels.data.buffer]);
    } catch (error) { this.callback({ raw: null, filtered: null, width, height, fps: 0, message: String(error) }); }
  }
  timedOut() { return this.pending && performance.now() - this.sentAt > 3000; }
  dispose() { this.worker.terminate(); }
}
