import { useEffect, useRef } from 'react';
import { AxesHelper, BoxGeometry, BufferGeometry, EdgesGeometry, Group, Line, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import { contentRect } from '../../../../packages/three-engine/src/CameraProjectionManager.js';
import { CubeTracker } from '../../../../packages/cube-lab/src/CubeTracker.js';
import { cubeLab } from './store.js';

export let cubeCanvas: HTMLCanvasElement | null = null;
export function CubeOverlay({ media, mediaWidth, mediaHeight, fit, source, mediaActive }: { media: HTMLVideoElement | HTMLImageElement | null; mediaWidth: number; mediaHeight: number; fit: 'contain' | 'cover'; source: string; mediaActive: boolean }) {
  const host = useRef<HTMLDivElement>(null); const label = useRef<HTMLDivElement>(null); const latest = useRef({ media, mediaWidth, mediaHeight, fit, source, mediaActive });
  latest.current = { media, mediaWidth, mediaHeight, fit, source, mediaActive };
  useEffect(() => {
    const node = host.current!; const viewport = node.parentElement!;
    const renderer = new WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true }); renderer.domElement.setAttribute('aria-label', '3D cube overlay'); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor(0, 0); node.append(renderer.domElement); cubeCanvas = renderer.domElement;
    const scene = new Scene(); const camera = new PerspectiveCamera(60, 16 / 9, .005, 100); const group = new Group(); scene.add(group);
    const geometry = new BoxGeometry(1, 1, 1); const material = new MeshBasicMaterial({ color: 0xb9e768, transparent: true, opacity: .16, depthWrite: false }); const cube = new Mesh(geometry, material); group.add(cube);
    const edgesGeometry = new EdgesGeometry(geometry); const edgesMaterial = new LineBasicMaterial({ color: 0xb9e768 }); const edges = new LineSegments(edgesGeometry, edgesMaterial); group.add(edges);
    const axes = new AxesHelper(1.3); group.add(axes);
    const pathMaterial = new LineBasicMaterial({ color: 0x63dbe9 }); const path = new Line(new BufferGeometry(), pathMaterial); scene.add(path);
    const debug = document.createElement('canvas'); debug.className = 'cube-corners'; node.append(debug); const context = debug.getContext('2d')!;
    let tracker: CubeTracker | null = null; let trackedMedia: HTMLVideoElement | HTMLImageElement | null = null; let trackedSource = ''; let lastVision = 0; let frame = 0; let pathCount = -1; let pathId = ''; let width = 0; let height = 0; let labelTick = 0;
    const render = (now: number) => {
      frame = requestAnimationFrame(render); cubeLab.tick(now);
      const s = cubeLab.get(); const props = latest.current;
      const mw = props.mediaWidth || props.media && (props.media instanceof HTMLVideoElement ? props.media.videoWidth : props.media.naturalWidth) || s.width;
      const mh = props.mediaHeight || props.media && (props.media instanceof HTMLVideoElement ? props.media.videoHeight : props.media.naturalHeight) || s.height;
      if (mw !== s.width || mh !== s.height || props.source !== s.source) cubeLab.set({ width: mw, height: mh, source: props.source });
      const replay = s.mode === 'PLAYBACK' ? s.recording : null;
      const rect = contentRect(viewport.clientWidth, viewport.clientHeight, replay?.camera.width ?? mw, replay?.camera.height ?? mh, props.fit);
      node.style.left = `${rect.x}px`; node.style.top = `${rect.y}px`; node.style.width = `${rect.width}px`; node.style.height = `${rect.height}px`;
      if (width !== Math.round(rect.width) || height !== Math.round(rect.height)) { width = Math.max(1, Math.round(rect.width)); height = Math.max(1, Math.round(rect.height)); renderer.setSize(width, height); debug.width = width; debug.height = height; }
      camera.aspect = replay ? replay.camera.width / replay.camera.height : mw / mh; camera.fov = replay?.camera.verticalFov ?? cubeLab.vfov(); camera.updateProjectionMatrix();
      if (tracker && (props.source !== trackedSource || props.media !== trackedMedia)) { tracker.dispose(); tracker = null; cubeLab.suspend(); }
      else if (s.enabled && props.media && props.mediaActive) {
        if (!tracker) { trackedMedia = props.media; trackedSource = props.source; tracker = new CubeTracker(result => cubeLab.result(result)); }
        if (now - lastVision >= 1000 / s.sampleRate) { lastVision = now; tracker.capture(props.media, { markerSizeMm: s.markerSizeMm, cubeSizeMm: s.cubeSizeMm, verticalFov: cubeLab.vfov(), smoothing: s.smoothing, debug: s.debug }); }
        tracker.checkHealth();
      } else if (s.enabled) {
        tracker?.dispose(); tracker = null; cubeLab.fail('No active camera frames. Start the webcam, then press Start tracking.');
      } else if (tracker) { tracker.dispose(); tracker = null; }
      const pose = cubeLab.pose(now); group.visible = !!pose; cube.visible = edges.visible = s.cube; axes.visible = s.axes;
      if (pose) { group.position.set(pose.position.x, pose.position.y, -pose.position.z); group.quaternion.set(pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w); group.scale.setScalar((replay?.cubeSizeMm ?? s.cubeSizeMm) / 1000); }
      const samples = s.recording?.samples ?? []; const id = s.recording?.recordingId ?? '';
      if (samples.length !== pathCount || id !== pathId) { path.geometry.dispose(); path.geometry = new BufferGeometry().setFromPoints(samples.map(sample => new Vector3(sample.position.x, sample.position.y, -sample.position.z))); pathCount = samples.length; pathId = id; }
      path.visible = s.trajectory && samples.length > 1;
      context.clearRect(0, 0, width, height);
      if (s.debug && s.enabled && s.debugResult?.frameProcessed) {
        const d = s.debugResult; context.lineWidth = 2; context.font = '12px Segoe UI';
        for (const marker of d.markers) {
          context.strokeStyle = marker.id === 101 ? '#b9e768' : '#edac6b'; context.fillStyle = context.strokeStyle; context.beginPath();
          marker.corners.forEach((p, i) => { const x = p.x * width / d.width; const y = p.y * height / d.height; if (i === 0) context.moveTo(x, y); else context.lineTo(x, y); context.fillRect(x - 2, y - 2, 4, 4); }); context.closePath(); context.stroke();
          const x = marker.corners.reduce((sum, p) => sum + p.x, 0) / 4 * width / d.width; const y = marker.corners.reduce((sum, p) => sum + p.y, 0) / 4 * height / d.height;
          context.beginPath(); context.arc(x, y, 3, 0, Math.PI * 2); context.fill();
          const text = marker.id === 101 ? 'ID 101' : `Detected ID ${marker.id}`;
          const textX = Math.max(4, Math.min(width - context.measureText(text).width - 4, x - 25));
          const textY = Math.max(16, Math.min(height - 35, y - 12));
          context.fillText(text, textX, textY);
          if (marker.id !== 101) context.fillText('Expected ID 101', textX, textY + 15);
        }
        context.fillStyle = '#63dbe9'; context.fillText(`Vision: ${d.fps.toFixed(1)} FPS`, 8, height - 12);
      }
      if (label.current && now - labelTick > 75) {
        labelTick = now; label.current.hidden = !pose || !s.label;
        if (pose) {
          const projected = group.position.clone().project(camera); const element = label.current;
          element.hidden = !s.label || Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1 || projected.z > 1;
          element.textContent = `${s.preview ? 'TEST CUBE' : 'Cube 01'} | ${pose.position.x.toFixed(3)}, ${pose.position.y.toFixed(3)}, ${pose.position.z.toFixed(3)} m`;
          const half = element.offsetWidth / 2;
          element.style.left = `${Math.max(half, Math.min(width - half, (projected.x + 1) * width / 2))}px`;
          element.style.top = `${Math.max(0, Math.min(height - element.offsetHeight, (1 - projected.y) * height / 2 + 30))}px`;
        }
      }
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(frame); tracker?.dispose(); cubeLab.suspend(); geometry.dispose(); material.dispose(); edgesGeometry.dispose(); edgesMaterial.dispose(); axes.dispose(); path.geometry.dispose(); pathMaterial.dispose(); renderer.dispose(); renderer.domElement.remove(); debug.remove(); cubeCanvas = null; };
  }, []);
  return <div className="three-overlay cube-overlay" ref={host}><div ref={label} className="cube-coordinate-label" hidden /></div>;
}
