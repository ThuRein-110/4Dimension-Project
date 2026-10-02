import { Plane, Raycaster, Vector2, Vector3, type Camera, type Object3D } from 'three';
export class ObjectRaycaster {
  private ray = new Raycaster();
  private floor = new Plane(new Vector3(0, 1, 0), 0);
  set(clientX: number, clientY: number, canvas: HTMLElement, camera: Camera) {
    const rect = canvas.getBoundingClientRect();
    this.ray.setFromCamera(new Vector2((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1), camera);
  }
  floorPoint() { return this.ray.ray.intersectPlane(this.floor, new Vector3()); }
  select(objects: Object3D[]) {
    const hits = this.ray.intersectObjects(objects, true);
    let node: Object3D | undefined = hits[0]?.object;
    while (node && !node.userData.instanceId) node = node.parent ?? undefined;
    return node?.userData.instanceId as string | undefined;
  }
}
