import { Euler, Quaternion, Vector3 } from 'three';
import type { Calibration, Vec3 } from '../../shared/src/project.js';

export const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export function calibrateManual(calibration: Calibration, points: Vec3[], knownDistance: number): Calibration {
  if (points.length !== 3 || !Number.isFinite(knownDistance) || knownDistance <= 0) throw new Error('Select three floor points and a positive known distance.');
  const [a, b, c] = points.map(p => new Vector3(p.x, p.y, p.z));
  const ab = b.clone().sub(a); const ac = c.clone().sub(a);
  if (ab.length() < 0.02 || new Vector3().crossVectors(ab, ac).length() < 0.01) throw new Error('Floor points must be distinct and non-collinear.');
  const scale = knownDistance / ab.length();
  if (scale < 0.01 || scale > 100) throw new Error('Known distance is outside the calibration range.');
  const yaw = Math.atan2(ab.z, ab.x);
  const rotation = new Quaternion().setFromEuler(new Euler(0, yaw, 0));
  const position = new Vector3(calibration.position.x, calibration.position.y, calibration.position.z)
    .multiplyScalar(calibration.scale).add(new Vector3(calibration.origin.x, calibration.origin.y, calibration.origin.z))
    .sub(a).applyQuaternion(rotation).multiplyScalar(scale);
  const correction = new Quaternion().setFromEuler(new Euler(calibration.correction.x * Math.PI / 180, calibration.correction.y * Math.PI / 180, calibration.correction.z * Math.PI / 180, 'YXZ'));
  const quaternion = rotation.multiply(new Quaternion(calibration.quaternion.x, calibration.quaternion.y, calibration.quaternion.z, calibration.quaternion.w).multiply(correction)).normalize();
  return { ...calibration, method: 'manual', knownDistance, position: { x: position.x, y: position.y, z: position.z },
    quaternion: { x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w }, scale: 1,
    origin: { x: 0, y: 0, z: 0 }, correction: { x: 0, y: 0, z: 0 } };
}
