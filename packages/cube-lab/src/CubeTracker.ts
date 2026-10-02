import type { MarkerResult } from '../../vision/src/MarkerTracker.js';
import { cubePose, CubePoseFilter, type Smoothing } from './pose.js';
import type { CubePose } from './recording.js';
import { CUBE_MARKER } from './marker.js';

export interface CubeTrackingResult {
  raw: CubePose | null; filtered: CubePose | null; corners?: MarkerResult['corners']; error?: number; message?: string;
  width: number; height: number; fps: number; detected: boolean; markers: NonNullable<MarkerResult['markers']>;
  engine: 'loading' | 'ready' | 'error'; frameProcessed: boolean; frameStatus: 'waiting' | 'receiving' | 'error';
  poseStatus: 'none' | 'available' | 'unavailable' | 'rejected'; poseMessage?: string;
  sourceWidth?: number; sourceHeight?: number; luminance?: number; detectorMs?: number;
}
export interface CubeCaptureOptions { markerSizeMm: number; cubeSizeMm: number; verticalFov: number; smoothing: Smoothing; debug?: boolean }
export class CubeTracker {
  private worker: Worker | null = null;
  private canvas = document.createElement('canvas');
  private filter = new CubePoseFilter();
  private pending = false;
  private ready = false;
  private disposed = false;
  private failed = false;
  private startedAt = performance.now();
  private sentAt = 0;
  private lastCapture = 0;
  private lastWaiting = -Infinity;
  private lastLog = -Infinity;
  private frames: number[] = [];
  private sourceWidth = 0;
  private sourceHeight = 0;
  private luminance = 0;
  private options: CubeCaptureOptions = { markerSizeMm: 40, cubeSizeMm: 57, verticalFov: 60, smoothing: 'Medium' };
  constructor(private callback: (result: CubeTrackingResult) => void) {
    this.emit({ engine: 'loading' });
    try {
      this.worker = new Worker('/assets/marker-worker.js');
      this.worker.onerror = event => this.fail(`Vision engine failed: ${event.message || 'Worker/script load error'}`);
      this.worker.onmessage = event => {
        if (this.disposed || this.failed) return;
        const result = event.data as MarkerResult;
        if (result.type === 'ready') { this.ready = true; this.emit({ engine: 'ready' }); return; }
        if (result.type === 'fatal') { this.fail(result.message ?? 'Detector failed'); return; }
        this.pending = false;
        const now = performance.now(); this.frames.push(now); this.frames = this.frames.filter(time => now - time <= 1500);
        const fps = this.frames.length > 1 ? (this.frames.length - 1) * 1000 / (now - this.frames[0]) : 0;
        const raw = result.poseValid && result.rotation && result.translation ? { ...cubePose(result.rotation, result.translation, this.options.cubeSizeMm / 1000), trackingConfidence: Math.max(0, 1 - (result.error ?? 8) / 8) } : null;
        const filtered = raw ? this.filter.update(raw, now, this.options.smoothing) : null;
        this.emit({ raw, filtered, detected: !!result.detected, markers: result.markers ?? [], corners: result.corners, error: result.error, engine: 'ready', frameProcessed: true, frameStatus: 'receiving', fps,
          poseStatus: filtered ? 'available' : raw ? 'rejected' : result.detected ? 'unavailable' : 'none', poseMessage: raw && !filtered ? 'Pose outlier rejected; marker was decoded' : result.poseMessage,
          sourceWidth: this.sourceWidth, sourceHeight: this.sourceHeight, luminance: this.luminance, detectorMs: result.detectorMs,
          message: this.luminance < 8 ? 'Very dark input frame. Check the webcam preview and lighting.' : '' });
      };
    } catch (error) { this.fail(String(error)); }
  }
  private emit(patch: Partial<CubeTrackingResult>) {
    if (this.disposed) return;
    const result: CubeTrackingResult = { raw: null, filtered: null, width: this.canvas.width, height: this.canvas.height, fps: 0, detected: false, markers: [], engine: this.ready ? 'ready' : 'loading', frameProcessed: false, frameStatus: 'waiting', poseStatus: 'none', ...patch };
    this.callback(result);
    if ((this.options.debug || result.engine === 'error') && performance.now() - this.lastLog >= 2000) {
      this.lastLog = performance.now();
      console.info('[CubeTracking]', { engine: result.engine, videoReady: result.frameStatus === 'receiving', sourceResolution: `${this.sourceWidth}x${this.sourceHeight}`, processingResolution: `${result.width}x${result.height}`, frameReceived: result.frameProcessed, detectorRunning: this.ready, markersFound: result.markers.length, ids: result.markers.map(m => m.id), visionFps: result.fps.toFixed(1), pose: result.poseStatus, message: result.message || result.poseMessage || '', previewMirrored: false, detectorMirrored: false });
    }
  }
  private fail(message: string) {
    if (this.failed || this.disposed) return;
    this.failed = true; this.ready = false; this.pending = false; this.worker?.terminate(); this.worker = null;
    this.emit({ engine: 'error', frameStatus: 'error', message });
  }
  checkHealth() {
    if (!this.ready && performance.now() - this.startedAt > 8000) this.fail('Vision engine failed to initialize within 8 seconds');
    if (this.pending && performance.now() - this.sentAt > 3000) this.fail('Detector timed out while processing a frame');
  }
  capture(media: HTMLVideoElement | HTMLImageElement, options: CubeCaptureOptions) {
    this.options = options;
    if (this.disposed || this.failed || !this.ready || this.pending) return;
    const video = media instanceof HTMLVideoElement;
    const width = video ? media.videoWidth : media.naturalWidth;
    const height = video ? media.videoHeight : media.naturalHeight;
    this.sourceWidth = width; this.sourceHeight = height;
    if (!width || !height || (video && (media.readyState < 2 || media.paused || media.ended))) {
      const message = `No usable camera frame (readyState ${video ? media.readyState : '--'}, ${width}x${height}${video && media.paused ? ', paused' : ''}). Start/resume the webcam.`;
      if (performance.now() - this.lastWaiting > 1000) { this.lastWaiting = performance.now(); this.emit({ engine: 'ready', message }); }
      if (performance.now() - (this.lastCapture || this.startedAt) > 3000) this.fail(message);
      return;
    }
    // Preserve normal webcam pixels; bound unusually large media only.
    this.canvas.width = Math.min(width, 1920); this.canvas.height = Math.round(height * this.canvas.width / width);
    try {
      const context = this.canvas.getContext('2d', { willReadFrequently: true })!;
      context.drawImage(media, 0, 0, this.canvas.width, this.canvas.height);
      const pixels = context.getImageData(0, 0, this.canvas.width, this.canvas.height);
      let brightness = 0; let count = 0;
      for (let i = 0; i < pixels.data.length; i += 4 * 128) { brightness += (pixels.data[i] + pixels.data[i + 1] + pixels.data[i + 2]) / 3; count++; }
      this.luminance = brightness / count;
      this.pending = true; this.sentAt = this.lastCapture = performance.now();
      this.worker!.postMessage({ width: pixels.width, height: pixels.height, buffer: pixels.data.buffer, markerSize: options.markerSizeMm / 1000, fov: options.verticalFov, markerId: CUBE_MARKER.id }, [pixels.data.buffer]);
    } catch (error) { this.fail(`Camera frame extraction failed: ${String(error)}`); }
  }
  dispose() { this.disposed = true; this.worker?.terminate(); this.worker = null; this.canvas.width = this.canvas.height = 0; }
}
