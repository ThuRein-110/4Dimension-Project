import { Box3, Matrix4, Quaternion, Euler, Vector3 } from 'three';
import type { FurnitureInstance } from '../../shared/src/project.js';
import { definition } from './FurnitureCatalog.js';
export function furnitureBounds(item: FurnitureInstance) {
  const model = definition(item.furnitureId); if (!model) return new Box3();
  const bounds = new Box3(new Vector3(-model.width / 2, 0, -model.depth / 2), new Vector3(model.width / 2, model.height, model.depth / 2));
  return bounds.applyMatrix4(new Matrix4().compose(new Vector3(item.position.x, item.position.y, item.position.z),
    new Quaternion().setFromEuler(new Euler(item.rotation.x, item.rotation.y, item.rotation.z)), new Vector3(item.scale.x, item.scale.y, item.scale.z)));
}
export function overlapIds(items: FurnitureInstance[]): Set<string> {
  const ids = new Set<string>();
  const boxes = items.map(item => furnitureBounds(item).expandByScalar(-.001));
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    if (items[i].visible && items[j].visible && boxes[i].intersectsBox(boxes[j])) { ids.add(items[i].instanceId); ids.add(items[j].instanceId); }
  }
  return ids;
}
