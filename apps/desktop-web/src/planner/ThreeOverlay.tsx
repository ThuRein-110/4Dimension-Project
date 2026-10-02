import { useEffect, useRef, useState } from 'react';
import { ThreeSceneManager } from '../../../../packages/three-engine/src/ThreeSceneManager.js';
import { contentRect } from '../../../../packages/three-engine/src/CameraProjectionManager.js';
import type { FurnitureInstance, Vec3 } from '../../../../packages/shared/src/project.js';
import { timelineFrame } from '../../../../packages/layouts/src/TimelineInterpolator.js';
import { MarkerTracker } from '../../../../packages/vision/src/MarkerTracker.js';
import { workspace, useWorkspace } from './store.js';

export let currentEngine: ThreeSceneManager | null = null;
export function ThreeOverlay({ mediaWidth, mediaHeight, fit, media }: { mediaWidth: number; mediaHeight: number; fit: 'contain' | 'cover'; media: HTMLVideoElement | HTMLImageElement | null }) {
  const host = useRef<HTMLDivElement>(null); const markerCanvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState('');
  const state = useWorkspace();
  const dimensions = useRef({ mediaWidth, mediaHeight, fit }); dimensions.current = { mediaWidth, mediaHeight, fit };
  const engineRef = useRef<ThreeSceneManager | null>(null);
  useEffect(() => {
    if (!host.current) return;
    const element = host.current; const parent = element.parentElement!;
    let engine: ThreeSceneManager;
    try { engine = new ThreeSceneManager(element, message => workspace.notify(message)); }
    catch (problem) { setError(`3D unavailable: ${problem instanceof Error ? problem.message : 'WebGL failed'}`); return; }
    engineRef.current = engine; currentEngine = engine;
    let animation = 0; let ghost: FurnitureInstance | undefined; let measurementStart: Vec3 | undefined;
    let pointerStart: { x: number; y: number; id?: string } | undefined;
    const point = (event: PointerEvent) => {
      const p = engine.point(event); if (!p || Math.abs(p.x) > 100 || Math.abs(p.z) > 100) return null;
      const snap = workspace.get().snap;
      return { x: snap ? Math.round(p.x / snap) * snap : p.x, y: 0, z: snap ? Math.round(p.z / snap) * snap : p.z };
    };
    const down = (event: PointerEvent) => {
      const current = workspace.get();
      pointerStart = { x: event.clientX, y: event.clientY, id: current.mode === 'edit' ? engine.select(event) : undefined };
    };
    const move = (event: PointerEvent) => {
      const current = workspace.get(); const position = point(event);
      if (current.mode === 'place' && current.placing && position) {
        ghost = { instanceId: 'ghost', furnitureId: current.placing, position, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, visible: true, locked: false };
      }
    };
    const up = (event: PointerEvent) => {
      const start = pointerStart; pointerStart = undefined;
      if (!start || engine.controls.dragging || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) return;
      const current = workspace.get();
      if (current.mode === 'edit') { if (!engine.controls.axis) workspace.set({ selected: engine.select(event) ?? null }); return; }
      const position = point(event); if (!position) return;
      if (current.mode === 'calibration' && current.calibrationState === 'Calibrating') {
        if (current.calibrationPoints.length < 3) workspace.set({ calibrationPoints: [...current.calibrationPoints, position] });
      } else if (current.mode === 'place' && current.placing) {
        if (workspace.active().furniture.length >= 500) { workspace.notify('This layout has reached its 500-item limit.'); return; }
        const item: FurnitureInstance = { instanceId: crypto.randomUUID(), furnitureId: current.placing, position, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, visible: true, locked: false };
        workspace.edit(project => project.layouts.find(layout => layout.id === project.activeLayoutId)!.furniture.push(item), 'Furniture added');
        workspace.set({ mode: 'edit', selected: item.instanceId, placing: null }); ghost = undefined;
      } else if (current.mode === 'measure') {
        if (current.project.measurements.length >= 500) { workspace.notify('This project has reached its 500-measurement limit.'); return; }
        if (!measurementStart) { measurementStart = position; workspace.notify('Point A selected'); }
        else {
          const a = measurementStart; measurementStart = undefined;
          workspace.edit(project => project.measurements.push({ id: crypto.randomUUID(), name: `Measurement ${project.measurements.length + 1}`, a, b: position, visible: true }), 'Approximate measurement added');
        }
      }
    };
    const transformEnd = () => {
      const object = engine.controls.object; const selected = workspace.get().selected;
      if (!object || !selected) return;
      const item = workspace.active().furniture.find(item => item.instanceId === selected);
      if (!item || item.locked) return;
      const scale = { x: Math.max(.1, Math.min(5, object.scale.x)), y: Math.max(.1, Math.min(5, object.scale.y)), z: Math.max(.1, Math.min(5, object.scale.z)) };
      workspace.updateInstance(selected, { position: { x: object.position.x, y: object.position.y, z: object.position.z }, rotation: { x: object.rotation.x, y: object.rotation.y, z: object.rotation.z }, scale });
    };
    engine.controls.addEventListener('mouseUp', transformEnd);
    element.addEventListener('pointerdown', down); element.addEventListener('pointermove', move); element.addEventListener('pointerup', up);
    const resize = () => {
      const { mediaWidth, mediaHeight, fit } = dimensions.current;
      const rect = contentRect(parent.clientWidth, parent.clientHeight, mediaWidth, mediaHeight, fit);
      Object.assign(element.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px` });
      engine.resize(rect.width, rect.height, workspace.get().project.calibration);
    };
    const observer = new ResizeObserver(resize); observer.observe(parent); resize();
    const render = () => {
      const current = workspace.get(); const project = current.project;
      engine.projection.apply({ ...project.calibration, ...(project.calibration.method === 'marker' ? current.trackingPose : null) }, engine.renderer.domElement.clientWidth / Math.max(1, engine.renderer.domElement.clientHeight));
      engine.grid.visible = current.grid; engine.axes.visible = current.axes;
      engine.setRoom(project, current.boundary && current.mode !== 'camera'); engine.setMeasurements(project.measurements, current.measurements);
      engine.controls.enabled = current.mode === 'edit' && !workspace.active().furniture.find(item => item.instanceId === current.selected)?.locked;
      engine.controls.getHelper().visible = current.mode === 'edit' && !!current.selected;
      engine.controls.setMode(current.transformMode); engine.controls.setTranslationSnap(current.snap || null);
      engine.controls.setRotationSnap(current.snap ? Math.PI / 12 : null);
      engine.controls.showY = current.transformMode !== 'translate';
      if (current.mode === 'compare') {
        const renderState = (index: number) => engine.sync(index < 0 ? [] : timelineFrame(project.layouts, index, 'linear'), null, false, current.furniture, undefined, true);
        const width = engine.renderer.domElement.clientWidth; const height = engine.renderer.domElement.clientHeight;
        engine.renderer.setScissorTest(false);
        const split = current.compareStyle === 'toggle' ? (current.compareSplit < .5 ? 1 : 0) : current.compareStyle === 'split' ? .5 : current.compareSplit;
        engine.renderer.clear(); engine.renderer.autoClear = false; engine.renderer.setScissorTest(true);
        engine.renderer.setScissor(0, 0, width * split, height); renderState(current.compareA); engine.render();
        engine.renderer.setScissor(width * split, 0, width * (1 - split), height); renderState(current.compareB); engine.render();
        engine.renderer.setScissorTest(false); engine.renderer.autoClear = true;
      } else {
        const items = current.mode === 'timeline' ? timelineFrame(project.layouts, workspace.time(), project.settings.easing) : timelineFrame([workspace.active()], 0, 'linear');
        engine.sync(items, current.mode === 'edit' ? current.selected : null, current.boxes, current.furniture, current.mode === 'place' ? ghost : undefined); engine.render();
      }
      animation = requestAnimationFrame(render);
    };
    animation = requestAnimationFrame(render);
    const unsubscribe = workspace.subscribe(() => {
      if (workspace.get().mode !== 'measure') measurementStart = undefined;
      resize();
    });
    return () => {
      cancelAnimationFrame(animation); observer.disconnect(); unsubscribe();
      element.removeEventListener('pointerdown', down); element.removeEventListener('pointermove', move); element.removeEventListener('pointerup', up);
      engine.controls.removeEventListener('mouseUp', transformEnd); engine.dispose();
      engineRef.current = null; if (currentEngine === engine) currentEngine = null;
    };
  }, []);
  useEffect(() => {
    const engine = engineRef.current; const element = host.current; const parent = element?.parentElement;
    if (!engine || !element || !parent) return;
    const rect = contentRect(parent.clientWidth, parent.clientHeight, mediaWidth, mediaHeight, fit);
    Object.assign(element.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    engine.resize(rect.width, rect.height, workspace.get().project.calibration);
  }, [mediaWidth, mediaHeight, fit]);
  const searching = state.calibrationState === 'Searching' || state.calibrationState === 'ReferenceFound' || state.calibrationState === 'Calibrated' || state.calibrationState === 'TrackingLost';
  useEffect(() => {
    if (!searching || !media) return;
    let last = workspace.get().project.calibration.method === 'marker' ? performance.now() : 0;
    const tracker = new MarkerTracker((result, pose) => {
      if (pose) {
        last = performance.now();
        const current = workspace.get();
        workspace.set({ trackingPose: pose, calibrationState: current.project.calibration.method === 'marker' ? 'Calibrated' : 'ReferenceFound' });
      } else if (result.message) workspace.notify(result.message);
      const canvas = markerCanvas.current; if (!canvas) return;
      const ctx = canvas.getContext('2d')!; canvas.width = 640; canvas.height = Math.round(640 * (mediaHeight || 9) / (mediaWidth || 16));
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (result.found && result.corners && workspace.get().marker) {
        ctx.strokeStyle = '#b9e768'; ctx.lineWidth = 3; ctx.beginPath();
        result.corners.forEach((p, index) => { if (index === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }); ctx.closePath(); ctx.stroke();
      }
    });
    const timer = setInterval(() => {
      tracker.capture(media, workspace.get().project.calibration);
      if (last && performance.now() - last > 1000 && workspace.get().calibrationState !== 'TrackingLost') workspace.set({ calibrationState: 'TrackingLost', notice: 'Tracking lost. Holding the last pose; use manual calibration if needed.' });
    }, 100);
    return () => { clearInterval(timer); tracker.dispose(); };
  }, [searching, media, mediaWidth, mediaHeight]);
  return <><div className={`three-overlay ${['place', 'edit', 'calibration', 'measure'].includes(state.mode) ? 'interactive' : ''}`} ref={host}><canvas className="marker-overlay" ref={markerCanvas} hidden={!state.marker || !searching} /></div>{error && <div className="viewport-error" role="alert">{error}</div>}</>;
}
