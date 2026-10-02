import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Camera, Check, ChevronDown, Copy, Download, Expand, Image, Info, Monitor, Radio, RefreshCw, ShieldCheck, Smartphone, Square, Upload, Video, Wifi, X } from 'lucide-react';
import { PeerLink, type LinkState } from '../../../packages/shared/src/peer-link.js';
import type { SessionInfo, Signal } from '../../../packages/shared/src/protocol.js';
import { useVideoStats } from '../../../packages/shared/src/use-video-stats.js';
import { ThreeOverlay } from './planner/ThreeOverlay.js';
import { CubeOverlay } from './cube-lab/CubeOverlay.js';
import { CubeLeftPanel, CubeRightPanel, CubeTimeline } from './cube-lab/CubePanels.js';
import { useCubeReplay } from './cube-lab/store.js';
import { workspace, useWorkspace } from './planner/store.js';
import { FurniturePanel } from './planner/FurniturePanel.js';
import { ModeBar, PlannerRightPanel } from './planner/PlannerChrome.js';
import { TimelinePanel } from './planner/TimelinePanel.js';
import { ProjectControls } from './planner/ProjectControls.js';
import { captureView } from './planner/export.js';
import { WebcamController } from './webcam/WebcamController.js';
import { WebcamDiagnostics } from './webcam/WebcamDiagnostics.js';

type Source = 'phone' | 'webcam' | 'file' | 'demo';
const names: Record<LinkState, string> = { connecting: 'Connecting', waiting: 'Waiting for iPhone', negotiating: 'Connecting video', live: 'iPhone Connected', reconnecting: 'Reconnecting', closed: 'Disconnected' };
export function DesktopApp() {
  const cubeReplay = useCubeReplay();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [linkState, setLinkState] = useState<LinkState>('closed');
  const [error, setError] = useState('');
  const [source, setSource] = useState<Source>('webcam');
  const sourceRef = useRef<Source>('webcam');
  const [webcamController] = useState(() => new WebcamController());
  const [webcamState, setWebcamState] = useState(webcamController.snapshot);
  const webcamStarting = webcamState.requesting;
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [remote, setRemote] = useState<MediaStream | null>(null);
  const local = webcamState.stream;
  const [mediaUrl, setMediaUrl] = useState('');
  const [isImage, setIsImage] = useState(false);
  const [urlIndex, setUrlIndex] = useState(0);
  const [qr, setQr] = useState('');
  const [certificateQr, setCertificateQr] = useState('');
  const [setup, setSetup] = useState(false);
  const [fit, setFit] = useState<'contain' | 'cover'>('contain');
  const [copied, setCopied] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [telemetry, setTelemetry] = useState<Extract<Signal, { type: 'telemetry' }> | null>(null);
  const [ready, setReady] = useState(false);
  const planner = useWorkspace();
  const link = useRef<PeerLink | null>(null);
  const connectionSeen = useRef(false);
  const currentSession = useRef<SessionInfo | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const viewport = useRef<HTMLDivElement | null>(null);
  const image = useRef<HTMLImageElement | null>(null);
  const stats = useVideoStats(video);
  const cameraUrl = session?.cameraUrls[urlIndex] ?? '';
  const certificateUrl = cameraUrl ? `http://${new URL(cameraUrl).hostname}:${session!.certificatePort}/livespace-ca.crt` : '';
  const activeStream = source === 'phone' ? remote : source === 'webcam' ? local : null;
  const phoneLive = source === 'phone' && linkState === 'live' && ready;
  const webcamLive = source === 'webcam' && !!local?.active && ready;
  const live = phoneLive || webcamLive;
  const cameraStatus = source === 'webcam' ? webcamLive ? 'Webcam live' : webcamStarting ? 'Starting webcam' : 'Webcam stopped' : source === 'phone' ? phoneLive ? 'Camera live' : names[linkState] : 'Local source';

  async function pair() {
    setPairing(true); setError('');
    try {
      const response = await fetch('/api/sessions', { method: 'POST', headers: { 'x-livespace-client': 'desktop' } });
      if (!response.ok) throw new Error('Could not pair. Open this app at the Windows localhost address.');
      const next: SessionInfo = await response.json();
      const old = currentSession.current;
      link.current?.close(); setRemote(null); setTelemetry(null);
      if (old) await fetch(`/api/sessions/${old.id}`, { method: 'DELETE', headers: { 'x-session-token': old.desktopToken } });
      currentSession.current = next; setSession(next); setUrlIndex(0);
      link.current = new PeerLink({ role: 'desktop', id: next.id, token: next.desktopToken, onState: state => {
        setLinkState(state);
        if (state === 'live') { connectionSeen.current = true; if (sourceRef.current === 'phone') workspace.notify('Camera connected'); }
        else if (connectionSeen.current && (state === 'waiting' || state === 'reconnecting' || state === 'closed')) { connectionSeen.current = false; if (sourceRef.current === 'phone') workspace.notify('Camera disconnected. Room data is retained.'); }
        if (state === 'waiting' || state === 'reconnecting' || state === 'closed') setRemote(null);
      }, onStream: setRemote, onError: message => { if (sourceRef.current === 'phone') setError(message); }, onTelemetry: setTelemetry });
    } catch (problem) { if (sourceRef.current === 'phone') setError(problem instanceof Error ? problem.message : 'Pairing failed'); }
    finally { setPairing(false); }
  }
  useEffect(() => {
    if (source !== 'phone' || currentSession.current) return;
    const timer = setTimeout(() => void pair(), 0);
    return () => clearTimeout(timer);
  }, [source]);
  useEffect(() => {
    const unsubscribe = webcamController.subscribe(state => {
      setWebcamState(state);
      if (sourceRef.current === 'webcam') { setReady(state.phase === 'live'); setError(state.error); }
    });
    return () => { unsubscribe(); webcamController.stop(); };
  }, [webcamController]);
  useEffect(() => () => { link.current?.close(); }, []);
  useEffect(() => {
    let active = true;
    if (cameraUrl) void QRCode.toDataURL(cameraUrl, { width: 256, margin: 2, errorCorrectionLevel: 'M' }).then(value => { if (active) setQr(value); });
    if (certificateUrl) void QRCode.toDataURL(certificateUrl, { width: 224, margin: 2 }).then(value => { if (active) setCertificateQr(value); });
    return () => { active = false; };
  }, [cameraUrl, certificateUrl]);
  useEffect(() => {
    // WebcamController owns webcam attachment; this effect owns phone/file playback.
    if (source === 'webcam') return;
    setReady(false);
    if (!video) return;
    video.pause(); video.srcObject = activeStream;
    if (activeStream) {
      video.removeAttribute('src');
      void video.play().catch(() => setError('Video playback is blocked. Click the viewport to resume.'));
    } else if (source === 'file' && !isImage && mediaUrl) {
      video.src = mediaUrl; video.load(); void video.play().catch(() => setError('Could not play this file. Try an H.264 MP4.'));
    } else { video.removeAttribute('src'); video.load(); }
  }, [video, activeStream, source, mediaUrl, isImage]);
  useEffect(() => () => { if (mediaUrl) URL.revokeObjectURL(mediaUrl); }, [mediaUrl]);
  useEffect(() => {
    if (!setup) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const controls = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button, a[href], input, select') ?? []);
    controls()[0]?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSetup(false);
      if (event.key !== 'Tab') return;
      const items = controls(); const first = items[0]; const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('keydown', keyboard); previous?.focus(); };
  }, [setup]);
  function chooseSource(next: Source) {
    webcamController.stop();
    if (video) { video.pause(); video.srcObject = null; video.removeAttribute('src'); video.load(); }
    sourceRef.current = next; setSource(next); setError(''); setReady(false);
    workspace.set({ calibrationState: workspace.get().project.calibration.method === 'manual' ? 'ManualCalibration' : 'NotCalibrated', trackingPose: null });
    if (workspace.get().project.calibration.method !== 'none') workspace.notify('Source changed. Check calibration before placing furniture.');
  }
  async function webcam() {
    if (webcamController.busy || !video) return;
    // start() releases the previous webcam; do not erase it before its restart delay.
    if (sourceRef.current !== 'webcam') chooseSource('webcam');
    setError(''); setReady(false);
    await webcamController.start(video);
  }
  function loadFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('video/') && !file.type.startsWith('image/')) { setError('Choose an image or video file.'); return; }
    chooseSource('file'); setIsImage(file.type.startsWith('image/')); setMediaUrl(URL.createObjectURL(file));
  }
  async function copy() {
    try { await navigator.clipboard.writeText(cameraUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { setError('Copy unavailable. Select the camera URL below.'); }
  }
  function capture() {
    if (planner.mode !== 'camera' && viewport.current) { captureView(viewport.current, showImage ? image.current : video, fit); return; }
    const still = source === 'demo' || (source === 'file' && isImage);
    const element = still ? image.current : video;
    if (!element) return;
    const width = still ? image.current?.naturalWidth : video?.videoWidth;
    const height = still ? image.current?.naturalHeight : video?.videoHeight;
    if (!width || !height) { setError('No camera frame is available to capture.'); return; }
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    canvas.getContext('2d')?.drawImage(element, 0, 0, width, height);
    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `livespace-camera-${Date.now()}.png`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }
  const showImage = source === 'demo' || (source === 'file' && isImage);
  const hasMedia = showImage || !!activeStream || (source === 'file' && !!mediaUrl);

  return <div className={`desktop-app ${planner.mode !== 'camera' ? 'planner-open' : ''} ${planner.mode === 'cube' ? 'cube-open' : ''}`}>
    <header className="app-header">
      <a className="brand" href="/"><span className="brand-mark"><Video size={21} /></span><strong>4D LiveSpace</strong><span className="version-tag">LOCAL</span></a>
      <div className="workspace-name"><Monitor size={15} /><span>Camera workspace</span></div>
      <ProjectControls />
      <button className="three-export" title="Capture 3D only" aria-label="Capture 3D only" onClick={() => { if (viewport.current) captureView(viewport.current, null, fit, true); }}><Download size={16} />3D PNG</button>
      <div className="header-actions"><span className={`connection-pill ${live ? 'is-live' : ''}`}><span className="status-dot" />{cameraStatus}</span><button title="Capture camera frame" aria-label="Capture camera frame" disabled={!ready} onClick={capture}><Download size={18} /></button></div>
    </header>
    <ModeBar onDemo={() => chooseSource('demo')} />
    <div className={`workspace ${planner.mode !== 'camera' ? 'planning' : ''}`}>
      <aside className="source-panel" hidden={planner.mode !== 'camera'}>
        <div className="panel-title">Video source<span>01</span></div>
        <nav className="source-list" aria-label="Video sources">
          <button className={source === 'webcam' ? 'active' : ''} disabled={webcamStarting} onClick={() => void webcam()}><Camera size={19} /><span>Windows webcam<small>Primary / fixed camera</small></span></button>
          <button className={source === 'phone' ? 'active' : ''} onClick={() => chooseSource('phone')}><Smartphone size={19} /><span>iPhone camera<small>Optional / local Wi-Fi</small></span>{source === 'phone' && <span className="tiny-dot" />}</button>
          <button className={source === 'file' ? 'active' : ''} onClick={() => fileInput.current?.click()}><Upload size={19} /><span>Local media<small>Image or MP4</small></span></button>
          <button className={source === 'demo' ? 'active' : ''} onClick={() => chooseSource('demo')}><Image size={19} /><span>Sample room<small>Offline image</small></span></button>
        </nav>
        <input ref={fileInput} type="file" hidden accept="image/*,video/mp4,video/webm,video/quicktime" onChange={event => { loadFile(event.target.files?.[0]); event.target.value = ''; }} />
        <div className="side-section"><div className="panel-title">Session</div><dl><dt>Host</dt><dd>Windows PC</dd><dt>Transport</dt><dd>{source === 'phone' ? 'WebRTC / LAN' : 'Local capture'}</dd><dt>Audio</dt><dd>Off</dd></dl></div>
        <div className="privacy-note"><ShieldCheck size={18} /><div><strong>Private by design</strong><p>Camera video stays on your local network.</p></div></div>
      </aside>
      {planner.mode === 'cube' ? <CubeLeftPanel /> : planner.mode !== 'camera' && <FurniturePanel />}
      <main className="view-column">
        <div className="view-toolbar"><div><span className={`view-dot ${live ? 'is-live' : ''}`} /><strong>{source === 'phone' ? 'iPhone camera' : source === 'webcam' ? 'Windows webcam' : source === 'demo' ? 'Sample room' : 'Local media'}</strong><span className="muted">/ Viewport</span>{source === 'webcam' && planner.mode !== 'camera' && <button className="recalibrate-button" title="Recalibrate" aria-label="Recalibrate" onClick={() => workspace.recalibrate()}><RefreshCw size={14} /><span>Recalibrate</span></button>}</div><div className="view-controls"><div className="segmented" aria-label="Viewport fit"><button className={fit === 'contain' ? 'active' : ''} onClick={() => setFit('contain')}>Fit</button><button className={fit === 'cover' ? 'active' : ''} onClick={() => setFit('cover')}>Fill</button></div><button title="Reset view" aria-label="Reset view" onClick={() => setFit('contain')}><RefreshCw size={16} /></button><button title="Fullscreen" aria-label="Fullscreen" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void viewport.current?.requestFullscreen().catch(() => setError('Fullscreen unavailable')); }}><Expand size={17} /></button></div></div>
        <div className={`viewport ${planner.camera ? '' : 'camera-hidden'}`} ref={viewport} onClick={() => { if (hasMedia && !showImage) void video?.play(); }}>
          <video ref={setVideo} autoPlay muted playsInline loop={source === 'file'} style={{ objectFit: fit, display: showImage ? 'none' : undefined }} onPlaying={() => { if (sourceRef.current !== 'webcam') setReady(true); }} onError={() => { if (source === 'file') setError('Unsupported video format. Try an H.264 MP4.'); }} />
          {showImage && <img ref={image} className="room-image" src={source === 'demo' ? '/assets/demo/room.jpg' : mediaUrl} alt="Room reference" style={{ objectFit: fit }} onLoad={() => setReady(true)} onError={() => setError('Image could not be loaded.')} />}
          {!hasMedia && (planner.mode !== 'cube' || !cubeReplay) && <div className="viewport-empty"><div className="camera-symbol"><Video size={36} strokeWidth={1.5} /></div><h1>{source === 'webcam' ? 'Windows webcam' : 'Connect your room'}</h1><p>{source === 'webcam' ? webcamStarting ? 'Waiting for webcam permission.' : 'Camera stopped' : 'Scan the QR code with your iPhone to start the live camera.'}</p>{source === 'webcam' ? <button className="primary" disabled={webcamStarting} onClick={() => void webcam()}><Camera size={17} />{webcamStarting ? 'Starting webcam...' : 'Start webcam'}</button> : <button className="primary" onClick={() => setSetup(true)}><Smartphone size={17} />Connect iPhone</button>}<button className="quiet" onClick={() => chooseSource('demo')}>Open sample room</button></div>}
          {hasMedia && <div className="viewport-badges"><span className={live ? 'live-badge' : 'media-badge'}>{live ? 'LIVE' : source === 'phone' ? 'CONNECTING' : source === 'webcam' ? 'WEBCAM' : 'REFERENCE'}</span><span>{showImage ? 'Still image' : `${stats.width || '--'} x ${stats.height || '--'}`}</span></div>}
          {error && <div className="viewport-error" role="alert"><Info size={17} /><span>{error}</span><button title="Dismiss" aria-label="Dismiss error" onClick={() => setError('')}><X size={15} /></button></div>}
          <span className="viewport-watermark">4D LiveSpace</span>
          {planner.mode === 'cube' ? <CubeOverlay mediaActive={hasMedia && ready} media={showImage ? image.current : video} mediaWidth={showImage ? image.current?.naturalWidth ?? 0 : stats.width} mediaHeight={showImage ? image.current?.naturalHeight ?? 0 : stats.height} fit={fit} source={source === 'webcam' ? 'Windows webcam' : source} /> : <ThreeOverlay media={showImage ? image.current : video} mediaWidth={showImage ? image.current?.naturalWidth ?? 0 : stats.width} mediaHeight={showImage ? image.current?.naturalHeight ?? 0 : stats.height} fit={fit} />}
        </div>
        <div className="view-status"><span><span className={live ? 'tiny-dot green' : 'tiny-dot'} />{phoneLive ? 'Live video received' : source === 'demo' ? 'Reference image' : webcamLive ? 'Webcam active' : cameraStatus}</span><span>{showImage ? 'IMAGE' : `${stats.fps} FPS`}<i />{source === 'phone' ? telemetry?.orientation ?? '--' : 'LOCAL'}<i /><ShieldCheck size={13} />{source === 'phone' ? 'LAN only' : 'Local only'}</span></div>
        <section className="session-strip"><div><Radio size={18} /><strong>{source === 'phone' ? 'Camera session' : 'Local workspace'}</strong></div>{source === 'phone' ? <div className="session-steps"><span className={session ? 'complete' : ''}><Check size={13} />PC ready</span><span className={linkState !== 'waiting' && linkState !== 'closed' ? 'complete' : ''}><Wifi size={13} />Phone paired</span><span className={phoneLive ? 'complete' : ''}><Video size={13} />Video received</span></div> : <span>Calibration: {planner.calibrationState}</span>}</section>
      </main>
      <aside className="connection-panel" hidden={planner.mode !== 'camera' || source !== 'phone'}>
        <div className="panel-title">Connect iPhone<Smartphone size={16} /></div>
        <div className="pairing-heading"><h2>Scan with iPhone</h2><p>Same Wi-Fi. Safari. Rear camera.</p></div>
        <div className="qr-frame">{qr ? <img src={qr} alt="Scan to connect the iPhone camera" /> : <span>Generating QR...</span>}</div>
        <div className="connection-label"><span className={`status-dot ${live ? 'green' : ''}`} />{names[linkState]}</div>
        {session && session.cameraUrls.length > 1 && <label className="network-selector">Network address<select value={urlIndex} onChange={event => setUrlIndex(Number(event.target.value))}>{session.cameraUrls.map((url, index) => <option key={url} value={index}>{new URL(url).hostname}</option>)}</select><ChevronDown size={14} /></label>}
        <div className="url-field"><input aria-label="Camera URL" value={cameraUrl} readOnly onClick={event => event.currentTarget.select()} /><button aria-label="Copy camera URL" title="Copy camera URL" onClick={() => void copy()}>{copied ? <Check size={16} /> : <Copy size={16} />}</button></div>
        <button className="setup-button" onClick={() => setSetup(true)}><ShieldCheck size={16} />First-time iPhone setup</button>
        <button className="quiet regenerate" disabled={pairing} onClick={() => void pair()}><RefreshCw size={14} />{pairing ? 'Generating...' : 'New pairing code'}</button>
        <div className="stream-details"><div className="panel-title">Stream details</div><dl><dt>Camera</dt><dd>{live ? 'Phone camera' : '--'}</dd><dt>Resolution</dt><dd>{stats.width ? `${stats.width} x ${stats.height}` : '--'}</dd><dt>Frame rate</dt><dd>{stats.fps} FPS</dd><dt>Orientation</dt><dd>{telemetry?.orientation ?? '--'}</dd><dt>Calibration</dt><dd>{planner.calibrationState === 'NotCalibrated' ? 'Not calibrated' : planner.calibrationState}</dd></dl></div>
        <button className="stop-button" disabled={!local && linkState === 'closed'} onClick={() => { link.current?.close(); setRemote(null); webcamController.stop(); }}><Square size={14} />Disconnect</button>
      </aside>
      {planner.mode === 'camera' && source !== 'phone' && <aside className="connection-panel webcam-panel"><div className="panel-title">Windows webcam<Camera size={16} /></div><div className="pairing-heading"><h2>Fixed-camera workspace</h2></div><div className="stream-details"><div className="panel-title">Stream details</div><dl><dt>Camera</dt><dd>{source === 'webcam' ? webcamLive ? 'Windows webcam' : 'Stopped' : 'Local media'}</dd><dt>Resolution</dt><dd>{stats.width ? `${stats.width} x ${stats.height}` : '--'}</dd><dt>Frame rate</dt><dd>{stats.fps} FPS</dd><dt>Calibration</dt><dd>{planner.calibrationState === 'NotCalibrated' ? 'Not calibrated' : planner.calibrationState}</dd></dl></div>{source === 'webcam' && <>
        <button className="setup-button" disabled={webcamStarting && !local} onClick={() => { if (local) webcamController.stop(); else void webcam(); }}><Camera size={16} />{local ? 'Stop webcam' : webcamStarting ? 'Starting webcam...' : 'Enable webcam'}</button>
        <button className="setup-button" disabled={webcamStarting} onClick={() => void webcam()}><RefreshCw size={16} />Restart webcam</button>
        <WebcamDiagnostics state={webcamState} video={video} />
      </>}<button className="setup-button" onClick={() => workspace.recalibrate()}><RefreshCw size={16} />Recalibrate</button></aside>}
      {planner.mode === 'cube' ? <CubeRightPanel /> : planner.mode !== 'camera' && <PlannerRightPanel />}
    </div>
    {planner.mode === 'cube' ? <CubeTimeline /> : planner.mode !== 'camera' && <TimelinePanel />}
    <footer className="app-footer"><span>{planner.mode === 'cube' ? 'Cube Lab / Camera-relative' : `${planner.project.name} / ${workspace.active().name}`}</span><span>{planner.mode === 'cube' ? 'Approximate cube pose' : 'Approximate room planning'}<span className="footer-divider" />No cloud processing</span></footer>
    {setup && <div className="modal-backdrop" onClick={() => setSetup(false)}><section className="setup-modal" role="dialog" aria-modal="true" aria-labelledby="setup-title" onClick={event => event.stopPropagation()}><button className="modal-close" aria-label="Close setup" onClick={() => setSetup(false)}><X size={20} /></button><span className="modal-eyebrow">ONE-TIME SETUP</span><h2 id="setup-title">Connect securely on your Wi-Fi</h2><p>Safari needs a trusted HTTPS connection to use the camera.</p><div className="certificate-step"><img src={certificateQr} alt="Download local HTTPS certificate" /><div><h3>1. Install the local certificate</h3><p>Scan this QR on your iPhone. Allow the download, then install the profile in Settings &gt; General &gt; VPN &amp; Device Management.</p><a href={certificateUrl}>{certificateUrl}</a></div></div><div className="setup-step"><span>2</span><div><h3>Enable full trust</h3><p>Settings &gt; General &gt; About &gt; Certificate Trust Settings. Enable 4D LiveSpace Local Development CA.</p></div></div><div className="setup-step"><span>3</span><div><h3>Open the camera QR</h3><p>Scan the camera QR in the sidebar. Tap Start Camera, allow camera access, then Connect to PC. Keep Safari open.</p></div></div><p className="setup-footnote">Allow Node.js on Private networks in Windows Firewall. Your phone and PC must use the same Wi-Fi without client isolation.</p><button className="primary" onClick={() => setSetup(false)}>Done</button></section></div>}
  </div>;
}
