import { BufferAttribute, BufferGeometry, Group, LineBasicMaterial, LineSegments, Mesh, MeshStandardMaterial, SphereGeometry } from 'three';
import { CONNECTIONS, jointAt, toThree, type MotionPoseSample } from '../../../../packages/shared/src/motion.js';

export class MotionSkeletonRenderer {
  readonly group = new Group();
  private geometry = new SphereGeometry(.018,10,8);
  private materials = [new MeshStandardMaterial({ color: '#f9ba68' }),new MeshStandardMaterial({ color: '#7fc5ff' })];
  private joints = Array.from({length:33},(_,id) => new Mesh(this.geometry,this.materials[id%2]));
  private positions = new Float32Array(CONNECTIONS.length*6);
  private bonesGeometry = new BufferGeometry();
  private bonesMaterial = new LineBasicMaterial({ color: '#6ee7b7' });
  private bones = new LineSegments(this.bonesGeometry,this.bonesMaterial);
  constructor(opacity = 1) {
    for (const material of [...this.materials,this.bonesMaterial]) { material.transparent = opacity < 1; material.opacity = opacity; material.depthWrite = opacity === 1; }
    this.bonesGeometry.setAttribute('position',new BufferAttribute(this.positions,3));
    this.bones.frustumCulled = false;
    this.group.add(...this.joints,this.bones);
  }
  update(sample: MotionPoseSample | null, showJoints = true, showBones = true) {
    this.group.visible = !!sample?.valid && sample.worldLandmarks?.length === 33;
    if (!this.group.visible) return;
    for (let id = 0; id < 33; id++) {
      const point = jointAt(sample,id); this.joints[id].visible = !!point && showJoints;
      if (point) { const mapped = toThree(point); this.joints[id].position.set(mapped.x,mapped.y,mapped.z); }
    }
    let cursor = 0;
    for (const [a,b] of CONNECTIONS) {
      const p = jointAt(sample,a), q = jointAt(sample,b); if (!p || !q) continue;
      for (const point of [toThree(p),toThree(q)]) { this.positions[cursor++] = point.x; this.positions[cursor++] = point.y; this.positions[cursor++] = point.z; }
    }
    this.bones.visible = showBones; this.bonesGeometry.setDrawRange(0,cursor/3); this.bonesGeometry.attributes.position.needsUpdate = true;
  }
  dispose() { this.geometry.dispose(); this.bonesGeometry.dispose(); this.materials.forEach(material => material.dispose()); this.bonesMaterial.dispose(); }
}
