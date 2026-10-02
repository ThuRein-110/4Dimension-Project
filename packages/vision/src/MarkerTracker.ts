import { Matrix4, Quaternion, Vector3 } from 'three';
import type { Calibration } from '../../shared/src/project.js';

export interface MarkerResult { found: boolean; rotation?: number[][]; translation?: number[]; corners?: { x: number; y: number }[]; error?: number; message?: string }
export function markerCameraPose(rotation: number[][], translation: number[]) {
  // POSIT camera has forward +Z. Flip camera Z, then lay marker XY on world XZ.
  const r = rotation;
  const markerToCamera = new Matrix4().set(r[0][0], r[0][1], r[0][2], translation[0], r[1][0], r[1][1], r[1][2], translation[1], r[2][0], r[2][1], r[2][2], translation[2], 0, 0, 0, 1);
  const cvToGl = new Matrix4().makeScale(1, 1, -1);
  const floorToMarker = new Matrix4().makeRotationX(Math.PI / 2);
  const worldToCamera = cvToGl.multiply(markerToCamera).multiply(floorToMarker);
  // The forward-Z basis change also needs a marker-normal flip to preserve handedness.
  worldToCamera.multiply(new Matrix4().makeScale(1, -1, 1));
  const cameraToWorld = worldToCamera.invert();
  const position = new Vector3(); const quaternion = new Quaternion(); const scale = new Vector3();
  cameraToWorld.decompose(position, quaternion, scale);
  return { position, quaternion: quaternion.normalize() };
}
export class MarkerTracker {
  private worker: Worker;
  private canvas = document.createElement('canvas');
  private pending = false;
  private position?: Vector3;
  private quaternion?: Quaternion;
  lastFound = 0;
  constructor(private callback: (result: MarkerResult, pose?: Pick<Calibration, 'position' | 'quaternion'>) => void) {
    this.worker = new Worker('/assets/marker-worker.js');
    this.worker.onerror = () => { this.pending = false; callback({ found: false, message: 'Marker worker unavailable. Use manual calibration.' }); };
    this.worker.onmessage = event => {
      this.pending = false;
      const result = event.data as MarkerResult;
      if (result.found && result.rotation && result.translation) {
        const pose = markerCameraPose(result.rotation, result.translation);
        if (this.position && pose.position.distanceTo(this.position) > 2 && performance.now() - this.lastFound < 1500) { callback({ found: false }); return; }
        if (performance.now() - this.lastFound > 1500) { this.position = undefined; this.quaternion = undefined; }
        this.position = this.position ? this.position.lerp(pose.position, .25) : pose.position;
        this.quaternion = this.quaternion ? this.quaternion.slerp(pose.quaternion, .25) : pose.quaternion;
        this.lastFound = performance.now();
        callback(result, { position: { x: this.position.x, y: this.position.y, z: this.position.z }, quaternion: { x: this.quaternion.x, y: this.quaternion.y, z: this.quaternion.z, w: this.quaternion.w } });
      } else callback(result);
    };
  }
  capture(media: HTMLVideoElement | HTMLImageElement, calibration: Calibration) {
    if (this.pending) return;
    const width = media instanceof HTMLVideoElement ? media.videoWidth : media.naturalWidth;
    const height = media instanceof HTMLVideoElement ? media.videoHeight : media.naturalHeight;
    if (!width || !height) return;
    this.canvas.width = Math.min(width, 640); this.canvas.height = Math.round(height * this.canvas.width / width);
    const context = this.canvas.getContext('2d', { willReadFrequently: true })!;
    context.drawImage(media, 0, 0, this.canvas.width, this.canvas.height);
    const pixels = context.getImageData(0, 0, this.canvas.width, this.canvas.height);
    this.pending = true;
    this.worker.postMessage({ width: pixels.width, height: pixels.height, buffer: pixels.data.buffer, markerSize: calibration.markerSize, fov: calibration.fov }, [pixels.data.buffer]);
  }
  dispose() { this.worker.terminate(); }
}
