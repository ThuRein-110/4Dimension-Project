import { useEffect, useRef } from 'react';
import { Expand } from 'lucide-react';
import { contentRect } from '../../../../packages/three-engine/src/CameraProjectionManager.js';
import { CONNECTIONS, jointAt, sampleAt, type MotionPoseSample } from '../../../../packages/shared/src/motion.js';
import { motion, useMotion } from './store.js';

export function MotionVideoView({ url, video, setVideo, onMetadata, onTime, onPlaying, clubMode }: {
  url: string; video: HTMLVideoElement | null; setVideo: (value: HTMLVideoElement | null) => void;
  onMetadata: (media: HTMLVideoElement) => void; onTime: (time: number) => void; onPlaying: (playing: boolean) => void; clubMode: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null), stage = useRef<HTMLDivElement>(null);
  const { display } = useMotion();
  useEffect(() => {
    if (!video || !canvas.current) return;
    const overlay = canvas.current, context = overlay.getContext('2d')!;
    let frame = 0;
    const draw = () => {
      const width = overlay.clientWidth, height = overlay.clientHeight;
      if (overlay.width !== Math.round(width * devicePixelRatio) || overlay.height !== Math.round(height * devicePixelRatio)) { overlay.width = Math.round(width * devicePixelRatio); overlay.height = Math.round(height * devicePixelRatio); }
      context.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0); context.clearRect(0,0,width,height);
      const state = motion.get(), data = state.analysis, options = state.display;
      const time = video.currentTime, rect = contentRect(width,height,video.videoWidth,video.videoHeight,options.fit);
      const sample = data && sampleAt(data.samples,time);
      const skeleton = (pose: MotionPoseSample | null, opacity = 1) => {
        if (!pose?.valid) return;
        context.globalAlpha = opacity; context.lineWidth = 2; context.strokeStyle = '#6ee7b7';
        if (options.skeleton) for (const [a,b] of CONNECTIONS) {
          const p = jointAt(pose,a,false), q = jointAt(pose,b,false); if (!p || !q) continue;
          context.beginPath(); context.moveTo(rect.x+p.x*rect.width,rect.y+p.y*rect.height); context.lineTo(rect.x+q.x*rect.width,rect.y+q.y*rect.height); context.stroke();
        }
        for (const point of pose.landmarks2D) {
          if (point.visibility < .35) continue;
          const x = rect.x+point.x*rect.width, y = rect.y+point.y*rect.height;
          if (options.landmarks) { context.fillStyle = point.id % 2 ? '#f9ba68' : '#7fc5ff'; context.beginPath(); context.arc(x,y,3,0,Math.PI*2); context.fill(); }
          if (options.labels || options.confidence) { context.font = '10px sans-serif'; context.fillStyle = '#ffffff'; context.fillText(`${options.labels ? point.name : ''}${options.confidence ? ` ${(point.visibility*100).toFixed(0)}%` : ''}`,x+5,y-4); }
        }
        context.globalAlpha = 1;
      };
      if (data && options.ghosts) for (let i = options.ghostCount; i > 0; i--) { const t = time-i*options.ghostInterval; if (t >= 0) skeleton(sampleAt(data.samples,t),.12 + .2/i); }
      if (data && options.trails) for (const id of new Set([15,16,options.selectedJoint])) {
        context.strokeStyle = id === 15 ? '#f9ba68' : '#7fc5ff'; context.lineWidth = 2; context.beginPath(); let drawing = false;
        for (const pose of data.samples) {
          if ((!options.future && pose.timeSeconds > time) || (options.trailWindow && pose.timeSeconds < time-options.trailWindow)) continue;
          const point = jointAt(pose,id,false); if (!point) { drawing = false; continue; }
          const x = rect.x+point.x*rect.width, y = rect.y+point.y*rect.height;
          if (drawing) context.lineTo(x,y); else context.moveTo(x,y); drawing = true;
        } context.stroke();
      }
      skeleton(sample || null);
      if (data && !sample) { context.font = '12px sans-serif'; context.fillStyle = '#e5e8ef'; context.fillText('Pose unavailable at this time',12,22); }
      if (data?.club.length) {
        context.strokeStyle = '#ff7f9e'; context.fillStyle = '#ff7f9e'; context.beginPath();
        data.club.filter(point => options.future || point.timeSeconds <= time).forEach((point,i) => { const x = rect.x+point.x*rect.width, y = rect.y+point.y*rect.height; if (!i) context.moveTo(x,y); else context.lineTo(x,y); }); context.stroke();
        for (const point of data.club.filter(point => Math.abs(point.timeSeconds-time) < .04)) { context.beginPath(); context.arc(rect.x+point.x*rect.width,rect.y+point.y*rect.height,5,0,Math.PI*2); context.fill(); }
      }
      frame = requestAnimationFrame(draw);
    };
    draw(); return () => cancelAnimationFrame(frame);
  }, [video]);
  return <section className="motion-view"><header><strong>Source Video + 2D Pose</strong><button title="Fullscreen source" aria-label="Fullscreen source" onClick={() => void stage.current?.requestFullscreen().catch(error => motion.set({ error: error.message }))}><Expand size={16} /></button></header><div ref={stage} className={`motion-video-stage ${clubMode ? 'club-annotating' : ''}`}>
    <video ref={setVideo} src={url || undefined} muted playsInline preload="auto" style={{ objectFit: display.fit }} onLoadedMetadata={event => onMetadata(event.currentTarget)} onTimeUpdate={event => onTime(event.currentTarget.currentTime)} onSeeked={event => onTime(event.currentTarget.currentTime)} onPlay={() => onPlaying(true)} onPause={() => onPlaying(false)} onError={() => motion.set({ error: 'Video decoding failed. Use an H.264 MP4 for Local Media, or place the source in the repository root for automatic preparation.' })} />
    <canvas ref={canvas} className="motion-pose-overlay" aria-label="2D pose overlay" onClick={event => {
      if (!clubMode || !video || !video.paused) return;
      const state = motion.get(); if (!state.analysis) return;
      const bounds = event.currentTarget.getBoundingClientRect(), rect = contentRect(bounds.width,bounds.height,video.videoWidth,video.videoHeight,state.display.fit);
      const x = (event.clientX-bounds.x-rect.x)/rect.width, y = (event.clientY-bounds.y-rect.y)/rect.height;
      if (x < 0 || x > 1 || y < 0 || y > 1) return;
      const club = [...state.analysis.club.filter(point => Math.abs(point.timeSeconds-video.currentTime) > .001),{ timeSeconds: video.currentTime,x,y }].sort((a,b) => a.timeSeconds-b.timeSeconds);
      motion.set({ analysis: { ...state.analysis,club } });
    }} />
  </div></section>;
}
