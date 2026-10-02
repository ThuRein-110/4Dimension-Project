import { useEffect, useRef, useState } from 'react';
import { Camera, Radio, Square, SwitchCamera, Video, Wifi } from 'lucide-react';
import { PeerLink, type LinkState } from '../../../packages/shared/src/peer-link.js';
import { useVideoStats } from '../../../packages/shared/src/use-video-stats.js';

const cameraError = (error: unknown) => {
  if (error instanceof DOMException && error.name === 'NotAllowedError') return 'Camera permission was denied. Allow camera access in Safari settings, then try again.';
  if (error instanceof DOMException && error.name === 'NotFoundError') return 'No camera is available on this device.';
  return error instanceof Error ? error.message : 'Could not start camera.';
};
export function CameraApp() {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [state, setState] = useState<LinkState>('closed');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [orientation, setOrientation] = useState(innerWidth > innerHeight ? 'landscape' : 'portrait');
  const media = useRef<MediaStream | null>(null);
  const link = useRef<PeerLink | null>(null);
  const mounted = useRef(true);
  const stats = useVideoStats(video);
  const params = new URLSearchParams(location.search);
  const id = params.get('session'); const token = params.get('token');
  const paired = !!id && !!token;
  const connected = state === 'live';

  function disconnect() { link.current?.close(); link.current = null; }
  function connect(current = media.current) {
    if (!current || !id || !token) { setError('Scan the QR code from the Windows desktop first.'); return; }
    disconnect(); setError('');
    link.current = new PeerLink({ role: 'camera', id, token, stream: current, onState: setState, onError: setError });
  }
  function stop() {
    disconnect(); media.current?.getTracks().forEach(track => track.stop());
    media.current = null; setStream(null);
    if (video) video.srcObject = null;
  }
  async function start(nextFacing = facing, reconnect = false) {
    if (busy) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError('Camera access needs trusted HTTPS. Install the local CA certificate on this iPhone, then reopen the HTTPS QR link.'); return;
    }
    setBusy(true); setError(''); stop();
    try {
      const next = await navigator.mediaDevices.getUserMedia({ audio: false, video: {
        facingMode: { ideal: nextFacing }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 },
      } });
      if (!mounted.current) { next.getTracks().forEach(track => track.stop()); return; }
      media.current = next; setStream(next); setFacing(nextFacing);
      next.getVideoTracks()[0]?.addEventListener('ended', () => {
        disconnect(); media.current = null; setStream(null); setError('Camera stopped by the device. Tap Start Camera to resume.');
      });
      if (reconnect) connect(next);
    } catch (problem) { setError(cameraError(problem)); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    if (video && stream) { video.srcObject = stream; void video.play().catch(() => setError('Tap the preview to start playback.')); }
  }, [video, stream]);
  useEffect(() => {
    mounted.current = true;
    const resize = () => setOrientation(innerWidth > innerHeight ? 'landscape' : 'portrait');
    addEventListener('resize', resize);
    return () => {
      mounted.current = false; removeEventListener('resize', resize);
      link.current?.close(); media.current?.getTracks().forEach(track => track.stop());
    };
  }, []);
  useEffect(() => {
    link.current?.send({ type: 'telemetry', ...stats, orientation: orientation as 'portrait' | 'landscape' });
  }, [stats, orientation]);
  return <main className="phone-app">
    <header className="phone-header"><span className="brand-mark"><Video size={22} /></span><div><h1>4D LiveSpace Camera</h1><span>Local camera connection</span></div></header>
    <div className={`phone-status ${connected ? 'is-live' : ''}`}><Wifi size={16} /><span>{connected ? 'Connected to PC' : state === 'closed' ? 'Camera offline' : state === 'waiting' ? 'Waiting for PC' : state}</span></div>
    <section className="phone-preview">
      <video ref={setVideo} autoPlay muted playsInline onClick={() => void video?.play()} />
      {!stream && <div className="phone-empty"><Camera size={40} /><span>Camera preview</span></div>}
      {stream && <span className="preview-label">{facing === 'environment' ? 'Rear camera' : 'Front camera'}</span>}
    </section>
    <div className="phone-stats"><span>{stats.width ? `${stats.width} x ${stats.height}` : '-- x --'}</span><span>{stats.fps} FPS</span><span>{orientation}</span></div>
    {error && <p className="error-message" role="alert">{error}</p>}
    {!paired && <p className="error-message">Open the camera link from the desktop QR code.</p>}
    <div className="phone-actions">
      {!stream ? <button className="primary" disabled={busy} onClick={() => void start()}><Camera size={18} />{busy ? 'Starting...' : 'Start Camera'}</button>
        : <button className="primary" disabled={!paired || state !== 'closed'} onClick={() => connect()}><Radio size={18} />{connected ? 'Connected' : state === 'closed' ? 'Connect to PC' : 'Connecting...'}</button>}
      <button disabled={!stream || busy} onClick={() => void start(facing === 'environment' ? 'user' : 'environment', state !== 'closed')}><SwitchCamera size={18} />Switch Camera</button>
      <button disabled={!stream && state === 'closed'} onClick={stop}><Square size={18} />Stop</button>
    </div>
    <footer className="phone-footer">Video stays between this phone and your Windows PC.<br />Keep Safari open while streaming.</footer>
  </main>;
}
