import { Box3, BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, Object3D, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { definition, type FurnitureDefinition } from '../../room-engine/src/FurnitureCatalog.js';

export function disposeObject(object: Object3D) {
  object.traverse(child => {
    if (child instanceof Mesh) {
      child.geometry.dispose();
      (Array.isArray(child.material) ? child.material : [child.material]).forEach(material => {
        for (const value of Object.values(material)) if (value instanceof Texture) value.dispose();
        material.dispose();
      });
    }
  });
}
export function primitiveFurniture(item: FurnitureDefinition): Group {
  const group = new Group(); const { width: w, height: h, depth: d } = item;
  const box = (width: number, height: number, depth: number, x: number, y: number, z: number, color = item.color) => {
    const mesh = new Mesh(new BoxGeometry(width, height, depth), new MeshStandardMaterial({ color, roughness: .78 }));
    mesh.position.set(x, y, z); group.add(mesh);
  };
  const legs = (top: number, size = .05) => {
    for (const x of [-w / 2 + size, w / 2 - size]) for (const z of [-d / 2 + size, d / 2 - size]) box(size, top, size, x, top / 2, z, 0x464c4a);
  };
  switch (item.category) {
    case 'Bed': box(w, h * .38, d, 0, h * .19, 0, 0x64695f); box(w, h * .4, d, 0, h * .58, 0); box(w, h, .06, 0, h / 2, -d / 2 + .03, 0x8a9684); for (const x of [-w / 4, w / 4]) box(w * .4, h * .15, d * .22, x, h * .85, -d * .32, 0xf3f1e6); break;
    case 'Desk': case 'Table': legs(h - .06); box(w, .06, d, 0, h - .03, 0); break;
    case 'Chair': legs(h * .45); box(w, h * .12, d, 0, h * .5, 0); box(w, h * .44, .07, 0, h * .78, -d / 2 + .035); break;
    case 'Sofa': box(w, h * .5, d, 0, h * .25, 0); box(w, h, d * .2, 0, h / 2, -d * .4); for (const x of [-w * .46, w * .46]) box(w * .08, h * .8, d, x, h * .4, 0); break;
    case 'Shelf': for (const x of [-w / 2 + .025, w / 2 - .025]) box(.05, h, d, x, h / 2, 0); for (let i = 0; i < 5; i++) box(w, .04, d, 0, .02 + i * (h - .04) / 4, 0); break;
    case 'Wardrobe': box(w, h, d, 0, h / 2, 0); for (const x of [-.05, .05]) box(.015, .18, .025, x, h / 2, d / 2 + .0125, 0x4f5652); break;
    case 'Lamp': {
      box(w, .04, d, 0, .02, 0, 0x525c55); box(.025, h * .8, .025, 0, h * .4, 0, 0x555e57);
      const shade = new Mesh(new CylinderGeometry(w * .33, w / 2, h * .2, 20), new MeshStandardMaterial({ color: item.color })); shade.position.y = h * .9; group.add(shade); break;
    }
    default: {
      const pot = new Mesh(new CylinderGeometry(w * .3, w * .23, h * .35, 16), new MeshStandardMaterial({ color: 0xd6c9b4 })); pot.position.y = h * .175; group.add(pot);
      for (const x of [-w * .3, 0, w * .3]) box(w * .4, h * .65, d, x, h * .675, 0); break;
    }
  }
  return group;
}
export class ModelLoader {
  private loader = new GLTFLoader();
  async load(id: string, overrideUrl?: string) {
    const item = definition(id); if (!item) throw new Error(`Unknown furniture: ${id}`);
    const url = overrideUrl ?? item.modelUrl;
    if (!url) return primitiveFurniture(item);
    const gltf = await this.loader.loadAsync(url); const model = new Group(); model.add(gltf.scene);
    const bounds = new Box3().setFromObject(model); const size = bounds.getSize(new Vector3());
    if ([size.x, size.y, size.z].some(value => !Number.isFinite(value) || value <= 0)) { disposeObject(model); throw new Error('The model has no usable geometry.'); }
    model.scale.set(item.width / size.x, item.height / size.y, item.depth / size.z);
    const normalized = new Box3().setFromObject(model); const center = normalized.getCenter(new Vector3());
    model.position.set(-center.x, -normalized.min.y + item.floorOffset, -center.z);
    const group = new Group(); group.add(model); return group;
  }
}
