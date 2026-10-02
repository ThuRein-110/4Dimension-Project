import { Matrix4, Quaternion, Vector3 } from 'three';
import type { CubePose } from './recording.js';

export type Smoothing = 'Off' | 'Low' | 'Medium' | 'High';
export function verticalFov(fov: number, axis: 'horizontal' | 'vertical', width: number, height: number) {
  return axis === 'vertical' ? fov : 2 * Math.atan(Math.tan(fov * Math.PI / 360) * height / width) * 180 / Math.PI;
}
export function cubePose(rotation: number[][], translation: number[], cubeSideMeters: number): CubePose {
  // POSIT is X-right/Y-up/Z-forward. Flip camera and marker normals to preserve handedness.
  const r = rotation;
  const matrix = new Matrix4().set(r[0][0], r[0][1], -r[0][2], 0, r[1][0], r[1][1], -r[1][2], 0, -r[2][0], -r[2][1], r[2][2], 0, 0, 0, 0, 1);
  const q = new Quaternion().setFromRotationMatrix(matrix).normalize();
  // Marker sits on local +Z face. Its center is half a cube side in front of the cube center.
  const center = new Vector3(translation[0], translation[1], -translation[2]).sub(new Vector3(0, 0, cubeSideMeters / 2).applyQuaternion(q));
  return { position: { x: center.x, y: center.y, z: -center.z }, rotation: { x: q.x, y: q.y, z: q.z, w: q.w } };
}
export class CubePoseFilter {
  private previous: CubePose | null = null;
  private lastAccepted = -Infinity;
  reset() { this.previous = null; this.lastAccepted = -Infinity; }
  update(raw: CubePose, now: number, smoothing: Smoothing): CubePose | null {
    if (![...Object.values(raw.position), ...Object.values(raw.rotation)].every(Number.isFinite) || raw.position.z <= 0) return null;
    const p = new Vector3(raw.position.x, raw.position.y, raw.position.z);
    const q = new Quaternion(raw.rotation.x, raw.rotation.y, raw.rotation.z, raw.rotation.w).normalize();
    if (this.previous && now - this.lastAccepted < 1200) {
      const old = this.previous;
      const oldP = new Vector3(old.position.x, old.position.y, old.position.z);
      const oldQ = new Quaternion(old.rotation.x, old.rotation.y, old.rotation.z, old.rotation.w);
      if (p.distanceTo(oldP) > Math.max(.3, old.position.z * .65) || q.angleTo(oldQ) > 2.4) return null;
      const alpha = { Off: 1, Low: .65, Medium: .35, High: .15 }[smoothing];
      p.lerpVectors(oldP, p, alpha); q.copy(oldQ.slerp(q, alpha));
    }
    this.lastAccepted = now;
    this.previous = { position: { x: p.x, y: p.y, z: p.z }, rotation: { x: q.x, y: q.y, z: q.z, w: q.w }, trackingConfidence: raw.trackingConfidence };
    return this.previous;
  }
}
