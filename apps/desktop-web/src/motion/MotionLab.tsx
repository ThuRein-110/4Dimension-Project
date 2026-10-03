import { useEffect, useRef, useState } from 'react';
import { Activity, Box, Camera, Download, Expand, RefreshCw, Save, Upload, Video, X } from 'lucide-react';
import { analysisIdentity } from '../../../../packages/shared/src/motion.js';
import { motion, useMotion } from './store.js';
import { PoseEngine } from './PoseEngine.js';
import { MotionAnalysisController } from './MotionAnalysisController.js';
import { loadAnalysis, saveAnalysis } from './cache.js';
import { MotionVideoView } from './MotionVideoView.js';
import { MotionTimeline } from './MotionTimeline.js';
import { Motion3DView } from './Motion3DView.js';
import { MotionSettings } from './MotionSettings.js';
import { JointInspector } from './JointInspector.js';
import { MotionDataPanel } from './MotionDataPanel.js';
import { MotionDiagnostics } from './MotionDiagnostics.js';
import { exportAnalysis,exportScreenshot } from './export.js';
import { workspace,useWorkspace } from '../planner/store.js';
import { saveProject,useAutosave } from '../planner/project-client.js';
import type { VideoMetadata } from './types.js';
import './motion.css';

export function MotionLab() {
  const state = useMotion(), { metadata, analysis } = state;
  const projectState = useWorkspace();
  useAutosave();
  const [video,setVideo] = useState<HTMLVideoElement | null>(null), [time,setTime] = useState(0), [playing,setPlaying] = useState(false);
  const [localUrl,setLocalUrl] = useState(''), [modelRetry,setModelRetry] = useState(0);
  const [clubMode,setClubMode] = useState(false), [captureMode,setCaptureMode] = useState<'original'|'video'|'3d'|'split'>('video');
  const [decodedTime,setDecodedTime] = useState<number|null>(null);
  const decoded = useRef<number|null>(null), views = useRef<HTMLDivElement>(null);
  const root = useRef<VideoMetadata | null>(null), fileInput = useRef<HTMLInputElement>(null);
  const sourceKind = useRef<'demo'|'local'>('demo');
  const engine = useRef<PoseEngine | null>(null), controller = useRef<MotionAnalysisController | null>(null);
  useEffect(() => {
    let cancelled = false; let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const response = await fetch('/api/motion/demo/info'); const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (cancelled) return;
        root.current = data;
        if(sourceKind.current==='demo') { const reference=workspace.get().project.motion; motion.set({metadata:data,...(reference && reference.videoId===data.id?{fps:reference.analysisFps}:{})}); }
        if (data.status === 'preparing') timer = setTimeout(() => void poll(),1000);
        else if (data.status === 'error') motion.set({ error: data.error });
      } catch (error) { if (!cancelled && sourceKind.current==='demo') motion.set({ error: error instanceof Error ? error.message : 'Demo video unavailable.' }); }
    };
    void poll(); return () => { cancelled = true; clearTimeout(timer); };
  }, []);
  useEffect(() => {
    let active = true; const worker = new PoseEngine(); engine.current = worker; motion.set({ model: 'loading' });
    void worker.initialize().then(() => { if (active) motion.set({ model: 'ready' }); }).catch(error => { if (active) motion.set({ model: 'error', error: `Pose initialization failed: ${error.message}` }); });
    return () => { active = false; controller.current?.cancel(); controller.current = null; worker.dispose(); engine.current = null; };
  }, [modelRetry]);
  useEffect(() => () => { if (localUrl) URL.revokeObjectURL(localUrl); }, [localUrl]);
  useEffect(() => {
    if (!metadata?.duration || metadata.status !== 'ready') return;
    let active = true;
    motion.set({ analysis: null, status: 'idle', cacheHit: false, progress: null });
    void analysisIdentity(metadata.id,state.fps).then(loadAnalysis).then(cached => {
      if (active && cached) {
        const reference = workspace.get().project.motion;
        if(reference?.analysisId===cached.id) cached = {...cached,keyframes:reference.keyframes,display:reference.display};
        motion.load(cached); motion.set({ cacheHit: true });
      }
    }).catch(error => { if (active) motion.set({ error: error.message }); });
    return () => { active = false; };
  }, [metadata?.id,metadata?.duration,metadata?.status,state.fps]);
  useEffect(() => {
    if (!analysis || state.status !== 'complete') return;
    const timer = setTimeout(() => void saveAnalysis(analysis).catch(error => motion.set({ error: `Analysis cache failed: ${error.message}` })),400);
    return () => clearTimeout(timer);
  }, [analysis,state.status]);
  useEffect(() => {
    if (!video) return;
    let frame = 0, last = 0;
    let callback = 0;
    const onFrame = (_now:number, info:VideoFrameCallbackMetadata) => { decoded.current = info.mediaTime; callback = video.requestVideoFrameCallback(onFrame); };
    if (video.requestVideoFrameCallback) callback = video.requestVideoFrameCallback(onFrame);
    const tick = (now: number) => { if (now-last > 80) { setTime(video.currentTime); setDecodedTime(decoded.current); last = now; } frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick); return () => { cancelAnimationFrame(frame); if (callback) video.cancelVideoFrameCallback(callback); };
  }, [video]);
  const url = localUrl || (metadata?.status === 'ready' ? metadata.url : '');
  const busy = state.status === 'analyzing';
  async function analyze(single = false) {
    if (!metadata || !engine.current || busy || state.model !== 'ready') return;
    video?.pause(); motion.set({ status: 'analyzing', error: '', progress: null });
    const previous=motion.get().analysis;
    const run = new MotionAnalysisController(engine.current); controller.current = run;
    try {
      let result = await run.analyze(metadata,url,state.fps,progress => motion.set({ progress }),single ? video?.currentTime ?? time : undefined);
      if (controller.current !== run) return;
      result={...result,display:motion.get().display,...(previous?.video.id===metadata.id?{keyframes:previous.keyframes,club:previous.club}:{})};
      motion.load(result); motion.set({ cacheHit: false });
      await saveAnalysis(result);
    } catch (error) {
      if (controller.current !== run) return;
      motion.set({ status: error instanceof DOMException && error.name === 'AbortError' ? 'cancelled' : 'idle', error: error instanceof DOMException && error.name === 'AbortError' ? 'Analysis cancelled. Previous completed data is retained.' : error instanceof Error ? error.message : 'Analysis failed.' });
    } finally { if (controller.current === run) controller.current = null; }
  }
  function changeSource(next: VideoMetadata | null, local = '') { sourceKind.current = local ? 'local' : 'demo'; controller.current?.cancel(); controller.current=null; video?.pause(); setLocalUrl(local); setTime(0); motion.set({ metadata: next, analysis: null, progress: null, error: '', status: 'idle', cacheHit: false }); }
  async function attachProject() {
    if(!analysis || analysis.analysis.scope!=='video') return;
    try {
      await saveAnalysis(analysis);
      workspace.edit(project => { project.motion = { videoId:analysis.video.id,preparedVideoReference:localUrl?'Local Media (reselect file)':metadata?.url ?? '',analysisId:analysis.id,analysisFps:analysis.analysis.fps,keyframes:analysis.keyframes,display:analysis.display }; });
      await saveProject();
    } catch(error) { motion.set({error:error instanceof Error?error.message:'Project save failed.'}); }
  }
  return <div className="motion-app">
    <header className="app-header"><a className="brand" href="/"><span className="brand-mark"><Video size={21} /></span><strong>4D LiveSpace</strong><span className="version-tag">LOCAL</span></a><div className="workspace-name"><Activity size={16} />4D Motion Lab</div><span className="muted">Private / on this PC</span><button disabled={!analysis || analysis.analysis.scope!=='video' || projectState.busy} onClick={() => void attachProject()}><Save size={15} />Save with Project</button><span className="muted">{projectState.project.name}</span></header>
    <nav className="mode-bar" aria-label="Workspace modes"><div className="mode-tabs"><a href="/"><Camera size={15} />Camera</a><a href="/?workspace=cube"><Box size={15} />4D Cube Lab</a><a href="/motion" className="active" aria-current="page"><Activity size={15} />4D Motion Lab</a>{['calibration','place','edit','measure','layouts','timeline','compare'].map(mode => <a key={mode} href={`/?workspace=${mode}`}>{mode[0].toUpperCase()+mode.slice(1)}</a>)}</div></nav>
    <main className="motion-main">
      <section className="motion-heading"><h1>4D Motion Lab</h1><div className="motion-actions"><button disabled={busy} onClick={() => changeSource(root.current)}>Demo Video</button><button disabled={busy} onClick={() => fileInput.current?.click()}><Upload size={16} />Local Media</button><input ref={fileInput} type="file" accept="video/*,.mov,.mp4,.m4v,.webm" hidden onChange={event => { const file = event.target.files?.[0]; if (file) changeSource({ id: `local-${file.name}-${file.size}-${file.lastModified}`, name: file.name, size: file.size, mtimeMs: file.lastModified, codec: 'Browser decoded', width: 0,height: 0,fps: 30,duration: 0,rotation: 0,pixelFormat: 'Browser decoded',status: 'ready',prepared: false,url: '' },URL.createObjectURL(file)); event.target.value = ''; }} /></div></section>
      {state.error && <div className="motion-error" role="alert">{state.error}<button title="Dismiss motion error" aria-label="Dismiss motion error" onClick={() => motion.set({ error: '' })}><X size={15} /></button></div>}
      <div className="motion-metadata">{metadata ? <><strong>{metadata.name}</strong><span>{metadata.duration.toFixed(2)} s</span><span>{metadata.width} x {metadata.height}</span><span>{metadata.fps.toFixed(2)} FPS{localUrl ? ' (stepping assumption)' : ''}</span><span>{metadata.codec}</span><span>Rotation {metadata.rotation} deg</span><span>{metadata.status === 'preparing' ? 'Preparing browser preview...' : metadata.prepared ? 'Local H.264 preview' : 'Original video'}</span></> : <span>No demo video available</span>}</div>
      <div className="motion-analysis-bar"><span role="status">{state.model === 'ready' ? 'Pose model ready' : state.model === 'error' ? 'Pose model unavailable' : 'Loading pose model...'}</span>{state.model === 'error' && <button title="Retry model" onClick={() => setModelRetry(value => value+1)}><RefreshCw size={15} />Retry model</button>}<label>Analysis FPS <select aria-label="Analysis FPS" value={state.fps} disabled={busy} onChange={event => motion.set({ fps: Number(event.target.value) as 10 | 15 | 30 })}>{[10,15,30].map(fps => <option key={fps}>{fps}</option>)}</select></label><button className="primary" disabled={busy || state.model !== 'ready' || !metadata?.duration || metadata.status !== 'ready'} onClick={() => void analyze()}><Activity size={16} />Analyze Motion</button><button disabled={busy || state.model !== 'ready' || !metadata?.duration || metadata.status !== 'ready'} onClick={() => void analyze(true)}>Analyze Frame</button>{busy && <button onClick={() => controller.current?.cancel()}><X size={15} />Cancel Analysis</button>}<span>{analysis ? `${analysis.samples.length} analyzed / ${analysis.derived.validFrames} detected${state.cacheHit ? ' / cache hit' : ''}` : ''}</span></div>
      {busy && state.progress && <div className="motion-progress" role="status"><progress value={state.progress.done} max={state.progress.total} /><span>Analyzing motion... {Math.round(state.progress.done/state.progress.total*100)}% / Frames {state.progress.done} / {state.progress.total} / Pose detected {state.progress.valid} / Pose missing {state.progress.missing}</span></div>}
      <div className="motion-view-controls"><div className="segmented" aria-label="Motion views">{(['4d','split','3d','data'] as const).map(view => <button key={view} aria-pressed={state.display.view===view} onClick={() => motion.settings({view})}>{{'4d':'4D Video',split:'Split View','3d':'3D Motion',data:'Data'}[view]}</button>)}</div><button title="Fullscreen split visualization" aria-label="Fullscreen split visualization" onClick={() => {motion.settings({view:'split'});void views.current?.requestFullscreen().catch(error => motion.set({error:error.message}));}}><Expand size={16} /></button><button disabled={!analysis} onClick={() => analysis && exportAnalysis(analysis)}><Download size={15} />Analysis JSON</button><select aria-label="Screenshot view" value={captureMode} onChange={event => setCaptureMode(event.target.value as typeof captureMode)}><option value="original">Original Video</option><option value="video">4D Video View</option><option value="3d">3D View</option><option value="split">Split View</option></select><button title="Capture Current 4D View" aria-label="Capture Current 4D View" disabled={!metadata?.duration} onClick={() => { try { exportScreenshot(video,captureMode,state.display.fit); } catch(error) { motion.set({error:error instanceof Error?error.message:'Screenshot failed.'}); } }}><Download size={16} /></button></div>
      <MotionSettings clubMode={clubMode} setClubMode={value => { if(value) video?.pause(); setClubMode(value); }} />
      <div ref={views} className={`motion-presentation mode-${state.display.view}`}>
      <div className={`motion-views view-${state.display.view}`}>
        <MotionVideoView url={url} video={video} setVideo={setVideo} onMetadata={media => { if (localUrl) motion.set({ metadata: { ...metadata!,width: media.videoWidth,height: media.videoHeight,duration: media.duration } }); }} onTime={setTime} onPlaying={setPlaying} clubMode={clubMode} onFullscreen={()=>{motion.settings({view:'4d'});void views.current?.requestFullscreen().catch(error=>motion.set({error:error.message}));}} />
        <Motion3DView video={video} />
      </div>
      <MotionTimeline video={video} time={time} playing={playing} />
      </div>
      <JointInspector time={time} />
      <MotionDataPanel time={time} />
      <MotionDiagnostics time={time} decodedTime={decodedTime} />
      <details className="motion-help"><summary>About 4D Motion</summary><p>4D Motion Lab represents the subject using three spatial dimensions (X, Y, Z) and video time (T) as the fourth dimension. A sequence of estimated 3D body poses is reconstructed from the video and synchronized with time to visualize how the subject moves.</p><p>Depth from a single camera is estimated and should not be treated as professional motion-capture measurement.</p></details>
    </main>
  </div>;
}
