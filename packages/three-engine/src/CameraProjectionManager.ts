import { Euler, MathUtils, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import type { Calibration } from '../../shared/src/project.js';

export function contentRect(width: number, height: number, mediaWidth: number, mediaHeight: number, fit: 'contain' | 'cover') {
  if (!mediaWidth || !mediaHeight) return { x: 0, y: 0, width, height };
  const ratio = fit === 'contain' ? Math.min(width / mediaWidth, height / mediaHeight) : Math.max(width / mediaWidth, height / mediaHeight);
  const w = mediaWidth * ratio; const h = mediaHeight * ratio;
  return { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h };
}
export class CameraProjectionManager {
  readonly camera = new PerspectiveCamera(50, 16 / 9, 0.01, 250);
  apply(calibration: Calibration, aspect: number) {
    const correction = new Quaternion().setFromEuler(new Euler(...[calibration.correction.x, calibration.correction.y, calibration.correction.z].map(MathUtils.degToRad) as [number, number, number], 'YXZ'));
    this.camera.fov = calibration.fov; this.camera.aspect = aspect;
    this.camera.position.copy(new Vector3(calibration.position.x, calibration.position.y, calibration.position.z).multiplyScalar(calibration.scale));
    this.camera.position.add(new Vector3(calibration.origin.x, calibration.origin.y, calibration.origin.z));
    this.camera.quaternion.copy(new Quaternion(calibration.quaternion.x, calibration.quaternion.y, calibration.quaternion.z, calibration.quaternion.w).normalize()).multiply(correction);
    this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld();
  }
}
