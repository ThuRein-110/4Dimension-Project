import { AmbientLight, AxesHelper, Box3, Box3Helper, BoxHelper, DirectionalLight, GridHelper, Group, Mesh, MeshStandardMaterial, Scene, Vector3, WebGLRenderer, BufferGeometry, Line, LineBasicMaterial } from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { CameraProjectionManager } from './CameraProjectionManager.js';
import type { Calibration } from '../../shared/src/project.js';
import type { FurnitureInstance, Measurement, Project } from '../../shared/src/project.js';
import type { RenderInstance } from '../../layouts/src/TimelineInterpolator.js';
import { ModelLoader, disposeObject } from './ModelLoader.js';
import { overlapIds } from '../../room-engine/src/CollisionChecker.js';
import { ObjectRaycaster } from './ObjectRaycaster.js';

export class ThreeSceneManager {
  readonly scene = new Scene();
  readonly projection = new CameraProjectionManager();
  readonly renderer: WebGLRenderer;
  readonly grid = new GridHelper(10, 40, 0xb9e768, 0x747f82);
  readonly axes = new AxesHelper(1);
  readonly objects = new Map<string, Group>();
  readonly raycaster = new ObjectRaycaster();
  readonly controls: TransformControls;
  private loader = new ModelLoader();
  private disposed = false;
  private selection?: BoxHelper;
  private selectedId: string | null = null;
  private boxes = new Map<string, BoxHelper>();
  private boundary?: Box3Helper;
  private measureLayer = new Group();
  private measurementKey = '';
  private requests = new Map<string, string>();
  private failures = new Set<string>();
  private size = '';
  constructor(readonly container: HTMLElement, private onError?: (message: string) => void) {
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.setAttribute('aria-label', '3D room overlay');
    container.append(this.renderer.domElement);
    this.scene.add(this.grid, this.axes, new AmbientLight(0xffffff, 2));
    const light = new DirectionalLight(0xffffff, 3); light.position.set(3, 6, 4); this.scene.add(light);
    this.axes.visible = false;
    this.grid.material.transparent = true; this.grid.material.opacity = 0.45;
    this.controls = new TransformControls(this.projection.camera, this.renderer.domElement);
    this.controls.setSize(.75); this.scene.add(this.controls.getHelper(), this.measureLayer);
  }
  resize(width: number, height: number, calibration: Calibration) {
    if (width <= 0 || height <= 0) return;
    const size = `${width}:${height}`;
    if (size !== this.size) { this.renderer.setSize(width, height); this.size = size; }
    this.projection.apply(calibration, width / height);
  }
  render() { this.renderer.render(this.scene, this.projection.camera); }
  async loadModel(id: string, furnitureId: string, overrideUrl?: string) {
    const request = crypto.randomUUID(); this.requests.set(id, request);
    const group = await this.loader.load(furnitureId, overrideUrl);
    if (this.disposed || this.requests.get(id) !== request) { disposeObject(group); return; }
    const previous = this.objects.get(id); if (previous) { previous.removeFromParent(); disposeObject(previous); }
    group.userData.instanceId = id; group.userData.furnitureId = furnitureId;
    this.objects.set(id, group); this.scene.add(group);
  }
  sync(items: RenderInstance[], selected: string | null, boxes: boolean, furniture: boolean, ghost?: FurnitureInstance, retain = false) {
    const desired = new Map([...items, ...(ghost ? [{ ...ghost, opacity: .4 }] : [])].map(item => [item.instanceId, item]));
    for (const id of this.failures) if (!desired.has(id)) this.failures.delete(id);
    for (const [id, object] of this.objects) if (!desired.has(id)) {
      if (retain) { object.visible = false; continue; }
      if (this.controls.object === object) this.controls.detach();
      object.removeFromParent(); disposeObject(object); this.objects.delete(id); this.requests.delete(id);
    }
    for (const [id, item] of desired) {
      let object = this.objects.get(id);
      if (!object && !this.requests.has(id) && !this.failures.has(id)) {
        void this.loadModel(id, item.furnitureId).catch(error => { console.error('Model load failed', error); this.requests.delete(id); this.failures.add(id); if (!this.disposed) this.onError?.('Furniture model unavailable. Check its local asset path.'); });
        continue;
      }
      object = this.objects.get(id); if (!object) continue;
      if (!this.controls.dragging || this.controls.object !== object) {
        object.position.set(item.position.x, item.position.y, item.position.z);
        object.rotation.set(item.rotation.x, item.rotation.y, item.rotation.z);
        object.scale.set(item.scale.x, item.scale.y, item.scale.z);
      }
      object.visible = item.visible && furniture;
      object.traverse(child => { if (child instanceof Mesh) for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
        if (material instanceof MeshStandardMaterial) { material.transparent = item.opacity < 1; material.opacity = item.opacity; material.depthWrite = item.opacity >= .99; }
      } });
    }
    const target = selected ? this.objects.get(selected) : undefined;
    if (target && this.controls.object !== target) this.controls.attach(target);
    else if (!target) this.controls.detach();
    if (this.selectedId !== selected || (target && !this.selection)) {
      if (this.selection) { this.selection.removeFromParent(); disposeObject(this.selection); this.selection.geometry.dispose(); (this.selection.material as LineBasicMaterial).dispose(); }
      this.selection = target ? new BoxHelper(target, overlapIds(items).has(selected!) ? 0xff867b : 0xb9e768) : undefined;
      if (this.selection) this.scene.add(this.selection);
      this.selectedId = selected;
    }
    if (this.selection) { this.selection.visible = !!target && furniture; this.selection.update(); }
    for (const [id, box] of this.boxes) if (!this.objects.has(id) || !boxes) { box.removeFromParent(); box.geometry.dispose(); (box.material as LineBasicMaterial).dispose(); this.boxes.delete(id); }
    if (boxes) for (const [id, object] of this.objects) {
      if (!this.boxes.has(id)) { const box = new BoxHelper(object, 0x839eb0); this.scene.add(box); this.boxes.set(id, box); }
      const box = this.boxes.get(id)!; box.visible = object.visible; box.update();
    }
  }
  setRoom(project: Project, show: boolean) {
    const box = new Box3(new Vector3(-project.room.width / 2, 0, -project.room.length / 2), new Vector3(project.room.width / 2, project.room.height, project.room.length / 2));
    if (!this.boundary) { this.boundary = new Box3Helper(box, 0x889882); this.scene.add(this.boundary); }
    this.boundary.box.copy(box); this.boundary.visible = show;
  }
  setMeasurements(measurements: Measurement[], visible: boolean) {
    this.measureLayer.visible = visible;
    const key = JSON.stringify(measurements); if (key === this.measurementKey) return;
    for (const line of this.measureLayer.children) {
      if (line instanceof Line) { line.geometry.dispose(); (line.material as LineBasicMaterial).dispose(); }
    }
    this.measureLayer.clear(); this.measurementKey = key;
    for (const measurement of measurements.filter(item => item.visible)) {
      const geometry = new BufferGeometry().setFromPoints([measurement.a, measurement.b].map(p => new Vector3(p.x, p.y + .025, p.z)));
      this.measureLayer.add(new Line(geometry, new LineBasicMaterial({ color: 0xf0c575, depthTest: false })));
    }
  }
  point(event: PointerEvent) {
    this.raycaster.set(event.clientX, event.clientY, this.renderer.domElement, this.projection.camera);
    return this.raycaster.floorPoint();
  }
  select(event: PointerEvent) {
    this.raycaster.set(event.clientX, event.clientY, this.renderer.domElement, this.projection.camera);
    return this.raycaster.select([...this.objects.values()].filter(object => object.visible && object.userData.instanceId !== 'ghost'));
  }
  dispose() {
    this.disposed = true; this.controls.dispose();
    for (const object of this.objects.values()) disposeObject(object);
    this.objects.clear(); this.requests.clear(); this.failures.clear();
    for (const box of this.boxes.values()) { box.geometry.dispose(); (box.material as LineBasicMaterial).dispose(); }
    this.setMeasurements([], false);
    if (this.selection) { this.selection.geometry.dispose(); (this.selection.material as LineBasicMaterial).dispose(); }
    if (this.boundary) { this.boundary.geometry.dispose(); (this.boundary.material as LineBasicMaterial).dispose(); }
    this.grid.geometry.dispose(); this.grid.material.dispose(); this.axes.geometry.dispose();
    if (Array.isArray(this.axes.material)) this.axes.material.forEach(material => material.dispose()); else this.axes.material.dispose();
    this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
