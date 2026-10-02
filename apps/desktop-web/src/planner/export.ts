import { contentRect } from '../../../../packages/three-engine/src/CameraProjectionManager.js';
import { currentEngine } from './ThreeOverlay.js';
import { cubeCanvas } from '../cube-lab/CubeOverlay.js';
import { cubeLab } from '../cube-lab/store.js';
import { workspace } from './store.js';

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function captureView(viewport: HTMLElement, media: HTMLVideoElement | HTMLImageElement | null, fit: 'contain' | 'cover', threeOnly = false) {
  const output = document.createElement('canvas'); output.width = viewport.clientWidth * 2; output.height = viewport.clientHeight * 2;
  const context = output.getContext('2d')!;
  if (!threeOnly && media && workspace.get().camera) {
    const width = media instanceof HTMLVideoElement ? media.videoWidth : media.naturalWidth;
    const height = media instanceof HTMLVideoElement ? media.videoHeight : media.naturalHeight;
    if (width && height) { const rect = contentRect(output.width, output.height, width, height, fit); context.drawImage(media, rect.x, rect.y, rect.width, rect.height); }
  }
  const overlay = workspace.get().mode === 'cube' ? cubeCanvas : currentEngine?.renderer.domElement;
  if (overlay) {
    const rect = overlay.getBoundingClientRect(); const outer = viewport.getBoundingClientRect();
    context.drawImage(overlay, (rect.x - outer.x) * 2, (rect.y - outer.y) * 2, rect.width * 2, rect.height * 2);
  }
  const project = workspace.get().project; const index = project.layouts.findIndex(layout => layout.id === project.activeLayoutId);
  const state = workspace.get();
  const view = state.mode === 'cube' ? `Cube_${cubeLab.get().name.replace(/[^a-z0-9_-]/gi, '_')}_t${(cubeLab.get().time / 1000).toFixed(2)}` : state.mode === 'compare' ? `Compare_T${state.compareA}_T${state.compareB}` : state.mode === 'timeline' ? `T${workspace.time().toFixed(2)}` : `T${index}`;
  output.toBlob(blob => {
    if (blob) { downloadBlob(blob, `4DLiveSpace_${project.name.replace(/[^a-z0-9_-]/gi, '_')}_${view}_${new Date().toLocaleDateString('en-CA')}.png`); workspace.notify('Screenshot exported'); }
  });
}
