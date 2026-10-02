import { useEffect, useRef, useState } from 'react';
import { Activity, Box, Camera, Expand, Pause, Play, SkipBack, SkipForward, Upload, Video } from 'lucide-react';
import type { VideoMetadata } from './types.js';
import './motion.css';

export function MotionLab() {
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [error, setError] = useState('');
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [localUrl, setLocalUrl] = useState('');
  const video = useRef<HTMLVideoElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let cancelled = false; let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const response = await fetch('/api/motion/demo/info');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (cancelled) return;
        setMetadata(data);
        if (data.status === 'preparing') timer = setTimeout(() => void poll(), 1000);
        else if (data.status === 'error') setError(data.error);
      } catch (problem) { if (!cancelled) setError(problem instanceof Error ? problem.message : 'Demo video unavailable.'); }
    };
    void poll(); return () => { cancelled = true; clearTimeout(timer); };
  }, []);
  useEffect(() => () => { if (localUrl) URL.revokeObjectURL(localUrl); }, [localUrl]);
  const seek = (value: number) => { if (video.current) { video.current.pause(); video.current.currentTime = Math.min(Math.max(value, 0), metadata?.duration ?? 0); } };
  return <div className="motion-app">
    <header className="app-header"><a className="brand" href="/"><span className="brand-mark"><Video size={21} /></span><strong>4D LiveSpace</strong><span className="version-tag">LOCAL</span></a><div className="workspace-name"><Activity size={16} />4D Motion Lab</div><span className="muted">Private / on this PC</span></header>
    <nav className="mode-bar" aria-label="Workspace modes"><div className="mode-tabs"><a href="/"><Camera size={15} />Camera</a><a href="/?workspace=cube"><Box size={15} />4D Cube Lab</a><a href="/motion" className="active" aria-current="page"><Activity size={15} />4D Motion Lab</a>{['calibration', 'place', 'edit', 'measure', 'layouts', 'timeline', 'compare'].map(mode => <a key={mode} href={`/?workspace=${mode}`}>{mode[0].toUpperCase() + mode.slice(1)}</a>)}</div></nav>
    <main className="motion-main">
      <section className="motion-heading"><h1>4D Motion Lab</h1><div className="motion-actions"><button onClick={() => { setLocalUrl(''); setError(''); }}>Demo Video</button><button onClick={() => fileInput.current?.click()}><Upload size={16} />Local Media</button><input ref={fileInput} type="file" accept="video/*,.mov,.mp4,.m4v,.webm" hidden onChange={event => { const file = event.target.files?.[0]; if (file) { setError(''); setLocalUrl(URL.createObjectURL(file)); setMetadata({ id: `local-${file.name}-${file.size}-${file.lastModified}`, name: file.name, size: file.size, mtimeMs: file.lastModified, codec: 'Browser decoded', width: 0, height: 0, fps: 30, duration: 0, rotation: 0, pixelFormat: 'Browser decoded', status: 'ready', prepared: false, url: '' }); } event.target.value = ''; }} /></div></section>
      {error && <p className="motion-error" role="alert">{error}</p>}
      <div className="motion-metadata">{metadata ? <><strong>{metadata.name}</strong><span>{metadata.duration.toFixed(2)} s</span><span>{metadata.width} x {metadata.height}</span><span>{metadata.fps.toFixed(2)} FPS</span><span>{metadata.codec}</span><span>Rotation {metadata.rotation} deg</span><span>{metadata.status === 'preparing' ? 'Preparing browser preview...' : metadata.prepared ? 'Local H.264 preview' : 'Original video'}</span></> : <span>Discovering root video...</span>}</div>
      <div ref={panel} className="motion-video-stage"><video ref={video} src={localUrl || (metadata?.status === 'ready' ? metadata.url : undefined)} muted playsInline preload="auto" onLoadedMetadata={event => { const media = event.currentTarget; if (localUrl) setMetadata(current => current && ({ ...current, width: media.videoWidth, height: media.videoHeight, duration: media.duration })); }} onTimeUpdate={event => setTime(event.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setError('Video decoding failed. For Local Media use a browser-compatible H.264 MP4, or place the source in the repository root for automatic preparation.')} /><button className="motion-fullscreen" title="Fullscreen source" aria-label="Fullscreen source" onClick={() => void panel.current?.requestFullscreen()}><Expand size={17} /></button></div>
      <section className="motion-timeline"><input aria-label="Motion time" type="range" min="0" max={metadata?.duration || 0} step="0.001" value={time} onChange={event => seek(Number(event.target.value))} /><div className="motion-transport"><button title="Previous frame" aria-label="Previous frame" onClick={() => seek(time - 1 / (metadata?.fps || 30))}><SkipBack size={18} /></button><button title={playing ? 'Pause' : 'Play'} aria-label={playing ? 'Pause' : 'Play'} disabled={!metadata?.duration} onClick={() => { if (playing) video.current?.pause(); else void video.current?.play().catch(problem => setError(problem.message)); }}>{playing ? <Pause size={18} /> : <Play size={18} />}</button><button title="Next frame" aria-label="Next frame" onClick={() => seek(time + 1 / (metadata?.fps || 30))}><SkipForward size={18} /></button><output>{time.toFixed(2)} / {metadata?.duration.toFixed(2) ?? '--'} s</output><label>Speed <select aria-label="Playback speed" defaultValue="1" onChange={event => { if (video.current) video.current.playbackRate = Number(event.target.value); }}>{[.25, .5, 1, 1.5, 2].map(speed => <option key={speed} value={speed}>{speed}x</option>)}</select></label></div></section>
    </main>
  </div>;
}
