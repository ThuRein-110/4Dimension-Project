import { mkdir, copyFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { catalog } from '../packages/room-engine/src/FurnitureCatalog.js';

await mkdir('public/assets/models', { recursive: true });
await mkdir('assets/models', { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 800 } });
  await page.goto('http://localhost:5173');
  await page.getByRole('button', { name: 'Demo project', exact: true }).waitFor();
  for (const item of catalog) {
    await page.evaluate(async id => {
      const resources = performance.getEntriesByType('resource');
      const threePath = resources.find(entry => entry.name.includes('/deps/three.js'))!.name;
      const modelPath = resources.find(entry => entry.name.includes('/three-engine/src/ModelLoader.ts'))!.name;
      const THREE = await import(threePath) as typeof import('three');
      const { ModelLoader, disposeObject } = await import(modelPath) as typeof import('../packages/three-engine/src/ModelLoader.js');
      const model = await new ModelLoader().load(id);
      const scene = new THREE.Scene(); scene.add(model);
      scene.add(new THREE.AmbientLight(0xffffff, 2));
      const light = new THREE.DirectionalLight(0xffffff, 3); light.position.set(3, 6, 4); scene.add(light);
      const bounds = new THREE.Box3().setFromObject(model); const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3()); const radius = Math.max(size.x, size.y, size.z) * 1.65;
      const camera = new THREE.PerspectiveCamera(40, 1, .01, 100);
      camera.position.copy(center).add(new THREE.Vector3(radius, radius * .65, radius)); camera.lookAt(center);
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
      renderer.setSize(240, 240); renderer.setClearColor(0x22262a, 1);
      document.querySelector('#thumbnail')?.remove();
      renderer.domElement.id = 'thumbnail';
      Object.assign(renderer.domElement.style, { position: 'fixed', left: '0', top: '0', zIndex: '100' });
      document.body.append(renderer.domElement); renderer.render(scene, camera);
      disposeObject(model); renderer.dispose();
    }, item.id);
    await page.locator('#thumbnail').screenshot({ path: `public/assets/models/${item.id}.png` });
    await copyFile(`public/assets/models/${item.id}.png`, `assets/models/${item.id}.png`);
  }
} finally { await browser.close(); }
console.log(`Rendered ${catalog.length} model thumbnails.`);
