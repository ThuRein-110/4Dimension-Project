import { createProject, type FurnitureInstance } from '../../shared/src/project.js';
import { PerspectiveCamera } from 'three';
export function demoProject() {
  const project = createProject('Demo Bedroom');
  project.room = { name: 'Multi-use bedroom', width: 5, length: 6, height: 2.7 };
  const camera = new PerspectiveCamera(); camera.position.set(4.6, 1.65, 6.5); camera.lookAt(0, 1.1, 0);
  project.calibration = { ...project.calibration, method: 'manual', position: { x: camera.position.x, y: camera.position.y, z: camera.position.z }, quaternion: { x: camera.quaternion.x, y: camera.quaternion.y, z: camera.quaternion.z, w: camera.quaternion.w } };
  const make = (furnitureId: FurnitureInstance['furnitureId'], x: number, z: number): FurnitureInstance => ({ instanceId: crypto.randomUUID(), furnitureId, position: { x, y: 0, z }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, visible: true, locked: false });
  const bed = make('bed', -1.1, -.8); const desk = make('desk', 1, -.9); const chair = make('chair', 1, .1);
  project.layouts[0] = { ...project.layouts[0], name: 'Current Bedroom', furniture: [bed, desk, chair] };
  const study = structuredClone(project.layouts[0]); study.id = crypto.randomUUID(); study.name = 'Study';
  study.furniture[0].position.z = 1.2; study.furniture[1].position = { x: 0, y: 0, z: -1.7 }; study.furniture[1].rotation.y = Math.PI / 2;
  study.furniture[2].position = { x: -.8, y: 0, z: -1.6 }; study.furniture.push(make('shelf', 1.7, -1.7));
  const gaming = structuredClone(study); gaming.id = crypto.randomUUID(); gaming.name = 'Gaming';
  gaming.furniture = gaming.furniture.filter(item => item.furnitureId !== 'bed');
  gaming.furniture[0].position = { x: 1.2, y: 0, z: .8 }; gaming.furniture[0].rotation.y = 0; gaming.furniture[0].scale = { x: 1.2, y: 1, z: 1 };
  gaming.furniture.push(make('sofa', -1.1, 1.1), make('lamp', -2, -1.6));
  project.layouts.push(study, gaming);
  return project;
}
