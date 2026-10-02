import { useEffect, useRef, useState } from 'react';
import { Expand, RotateCcw } from 'lucide-react';
import { AmbientLight, AxesHelper, BufferAttribute, BufferGeometry, Color, DirectionalLight, GridHelper, LineBasicMaterial, LineSegments, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { jointAt, sampleAt, toThree, type MotionAnalysis } from '../../../../packages/shared/src/motion.js';
import { motion } from './store.js';
import { MotionSkeletonRenderer } from './MotionSkeletonRenderer.js';

type Preset = 'Perspective' | 'Front' | 'Side' | 'Top';
export function Motion3DView({ video }: { video: HTMLVideoElement | null }) {
  const host = useRef<HTMLDivElement>(null), changeView = useRef<(preset: Preset) => void>(() => undefined);
  const [preset,setPreset] = useState<Preset>('Perspective'), [error,setError] = useState('');
  useEffect(() => {
    if (!host.current) return;
    const mount = host.current; let renderer: WebGLRenderer;
    try { renderer = new WebGLRenderer({ antialias: true,preserveDrawingBuffer: true }); }
    catch { setError('WebGL unavailable. Source video and 2D analysis remain usable.'); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.domElement.setAttribute('aria-label','Estimated 3D motion canvas');
    const scene = new Scene(); scene.background = new Color('#14191e');
    const camera = new PerspectiveCamera(45,1,.01,100);
    const controls = new OrbitControls(camera,renderer.domElement); controls.enableDamping = true; controls.minDistance = .3; controls.maxDistance = 12;
    const views: Record<Preset,[number,number,number]> = { Perspective:[2,1.1,2.8],Front:[0,0,3],Side:[3,0,0],Top:[0,3,.001] };
    changeView.current = name => { camera.position.set(...views[name]); controls.target.set(0,0,0); controls.update(); }; changeView.current('Perspective');
    const light = new DirectionalLight('#ffffff',2); light.position.set(2,3,3); scene.add(light,new AmbientLight('#ffffff',2));
    const grid = new GridHelper(4,20,'#51675d','#303a41'); grid.position.y = -1;
    const axes = new AxesHelper(.65); scene.add(grid,axes);
    const current = new MotionSkeletonRenderer(); scene.add(current.group);
    const ghosts = Array.from({length:8},(_,index) => { const ghost = new MotionSkeletonRenderer(.25/(1+index*.3)); scene.add(ghost.group); return ghost; });
    const paths = Array.from({length:3},(_,index) => { const geometry = new BufferGeometry(), material = new LineBasicMaterial({color:['#f9ba68','#7fc5ff','#ff7f9e'][index]}); const line = new LineSegments(geometry,material); line.frustumCulled = false; scene.add(line); return line; });
    let lastAnalysis: MotionAnalysis | null = null, lastJoint = -1, bucket = '', frame = 0;
    const resize = () => { const width = mount.clientWidth,height = mount.clientHeight; if (!width || !height) return; renderer.setSize(width,height,false); camera.aspect = width/height; camera.updateProjectionMatrix(); };
    mount.append(renderer.domElement); const observer = new ResizeObserver(resize); observer.observe(mount); resize();
    const animate = () => {
      const state = motion.get(), data = state.analysis, options = state.display, time = video?.currentTime ?? 0;
      const sample = data && sampleAt(data.samples,time);
      current.update(sample || null,options.landmarks,options.skeleton); grid.visible = options.floor;
      ghosts.forEach((ghost,index) => { const t = time-(index+1)*options.ghostInterval; ghost.update(data && options.ghosts && index < options.ghostCount && t >= 0 ? sampleAt(data.samples,t) : null,false,true); });
      if (data !== lastAnalysis || options.selectedJoint !== lastJoint) {
        lastAnalysis = data; lastJoint = options.selectedJoint; bucket = '';
        paths.forEach(path => { path.geometry.dispose(); path.geometry = new BufferGeometry(); path.geometry.setAttribute('position',new BufferAttribute(new Float32Array((data?.samples.length ?? 1)*6),3)); });
      }
      const nextBucket = `${Math.floor(time*(data?.analysis.fps ?? 15))}:${options.trailWindow}:${options.future}:${options.trails}`;
      if (data && nextBucket !== bucket) {
        bucket = nextBucket;
        [15,16,options.selectedJoint].forEach((id,i) => {
          const path = paths[i], positions = path.geometry.attributes.position.array as Float32Array; let offset = 0;
          for (let index = 1; index < data.samples.length; index++) {
            const a = data.samples[index-1],b = data.samples[index];
            if ((!options.future && b.timeSeconds > time) || (options.trailWindow && a.timeSeconds < time-options.trailWindow) || b.timeSeconds-a.timeSeconds > .2) continue;
            const p = jointAt(a,id),q = jointAt(b,id); if (!p || !q) continue;
            for (const point of [toThree(p),toThree(q)]) { positions[offset++] = point.x; positions[offset++] = point.y; positions[offset++] = point.z; }
          }
          path.geometry.setDrawRange(0,offset/3); path.geometry.attributes.position.needsUpdate = true;
        });
      }
      paths.forEach(path => { path.visible = !!data && options.trails; });
      renderer.domElement.dataset.sampleTime = sample?.timeSeconds.toFixed(4) ?? 'unavailable';
      renderer.domElement.dataset.poseVisible = String(current.group.visible);
      controls.update(); renderer.render(scene,camera); frame = requestAnimationFrame(animate);
    };
    animate();
    const lost = (event: Event) => { event.preventDefault(); setError('WebGL context lost. Reopen Motion Lab to restore the 3D view.'); };
    renderer.domElement.addEventListener('webglcontextlost',lost);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); renderer.domElement.removeEventListener('webglcontextlost',lost); controls.dispose(); current.dispose(); ghosts.forEach(ghost => ghost.dispose()); paths.forEach(path => { path.geometry.dispose(); (path.material as LineBasicMaterial).dispose(); }); grid.geometry.dispose(); if (Array.isArray(grid.material)) grid.material.forEach(material => material.dispose()); else grid.material.dispose(); axes.geometry.dispose(); if (Array.isArray(axes.material)) axes.material.forEach(material => material.dispose()); else axes.material.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); };
  }, [video]);
  return <section className="motion-view"><header><strong>Estimated 3D Motion</strong><div className="motion-actions"><select aria-label="3D view preset" value={preset} onChange={event => { const value = event.target.value as Preset; setPreset(value); changeView.current(value); }}>{['Perspective','Front','Side','Top'].map(value => <option key={value}>{value}</option>)}</select><button title="Reset 3D view" aria-label="Reset 3D view" onClick={() => { setPreset('Perspective'); changeView.current('Perspective'); }}><RotateCcw size={15} /></button><button title="Fullscreen 3D" aria-label="Fullscreen 3D" onClick={() => void host.current?.requestFullscreen().catch(error => motion.set({error:error.message}))}><Expand size={16} /></button></div></header><div ref={host} className="motion-3d-stage">{error && <p role="alert">{error}</p>}</div><div className="motion-axis-legend"><span>X horizontal</span><span>Y up</span><span>Z estimated depth</span><span>Hip-relative / reference floor</span></div></section>;
}
