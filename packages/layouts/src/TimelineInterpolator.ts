import { Euler, Quaternion, Vector3 } from 'three';
import type { FurnitureInstance, Layout } from '../../shared/src/project.js';
export interface RenderInstance extends FurnitureInstance { opacity: number }
export function interpolateLayouts(a: Layout, b: Layout, alpha: number, easing: 'linear' | 'smooth' = 'smooth'): RenderInstance[] {
  const clamped = Math.max(0, Math.min(1, alpha));
  const t = easing === 'linear' ? clamped : clamped < .5 ? 4 * clamped ** 3 : 1 - (-2 * clamped + 2) ** 3 / 2;
  const left = new Map(a.furniture.map(item => [item.instanceId, item]));
  const right = new Map(b.furniture.map(item => [item.instanceId, item]));
  return [...new Set([...left.keys(), ...right.keys()])].map(id => {
    const from = left.get(id); const to = right.get(id); const item = to ?? from!;
    const start = from ?? to!; const end = to ?? from!;
    const vector = (key: 'position' | 'scale') => {
      const value = new Vector3(start[key].x, start[key].y, start[key].z).lerp(new Vector3(end[key].x, end[key].y, end[key].z), t);
      return { x: value.x, y: value.y, z: value.z };
    };
    const q1 = new Quaternion().setFromEuler(new Euler(start.rotation.x, start.rotation.y, start.rotation.z));
    const q2 = new Quaternion().setFromEuler(new Euler(end.rotation.x, end.rotation.y, end.rotation.z));
    const euler = new Euler().setFromQuaternion(q1.slerp(q2, t));
    const opacity = (from?.visible ? 1 - t : 0) + (to?.visible ? t : 0);
    const scale = vector('scale');
    return { ...item, position: vector('position'), rotation: { x: euler.x, y: euler.y, z: euler.z },
      scale: { x: scale.x * opacity, y: scale.y * opacity, z: scale.z * opacity }, opacity, visible: opacity > .001 };
  });
}
export function timelineFrame(layouts: Layout[], time: number, easing: 'linear' | 'smooth'): RenderInstance[] {
  const position = Math.max(0, Math.min(layouts.length - 1, time));
  const index = Math.floor(position);
  return interpolateLayouts(layouts[index], layouts[Math.min(index + 1, layouts.length - 1)], position - index, easing);
}
