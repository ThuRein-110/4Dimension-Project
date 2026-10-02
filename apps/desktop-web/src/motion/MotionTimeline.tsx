import { useState } from 'react';
import { ChevronFirst, ChevronLast, Pause, Play, Plus, SkipBack, SkipForward, X } from 'lucide-react';
import { motion, useMotion } from './store.js';

export function MotionTimeline({ video, time, playing }: { video: HTMLVideoElement | null; time: number; playing: boolean }) {
  const { metadata, analysis, status } = useMotion(); const [name,setName] = useState('Address');
  const duration = metadata?.duration ?? 0;
  const seek = (value: number) => { if (video) { video.pause(); video.currentTime = Math.max(0,Math.min(value,duration)); } };
  const previous = [...(analysis?.keyframes ?? [])].reverse().find(frame => frame.timeSeconds < time-.001);
  const next = analysis?.keyframes.find(frame => frame.timeSeconds > time+.001);
  const blocked = !duration || status === 'analyzing';
  return <section className="motion-timeline" aria-label="Motion timeline">
    <input aria-label="Motion time" type="range" min="0" max={duration} step="0.001" value={time} disabled={blocked} onInput={event => seek(Number(event.currentTarget.value))} />
    <div className="motion-transport">
      <button title="Previous keyframe" aria-label="Previous keyframe" disabled={blocked || !previous} onClick={() => seek(previous!.timeSeconds)}><ChevronFirst size={18} /></button>
      <button title="Previous frame" aria-label="Previous frame" disabled={blocked} onClick={() => seek(time-1/(metadata?.fps || 30))}><SkipBack size={18} /></button>
      <button title={playing ? 'Pause' : 'Play'} aria-label={playing ? 'Pause' : 'Play'} disabled={blocked} onClick={() => { if (playing) video?.pause(); else void video?.play().catch(error => motion.set({ error: error.message })); }}>{playing ? <Pause size={18} /> : <Play size={18} />}</button>
      <button title="Next frame" aria-label="Next frame" disabled={blocked} onClick={() => seek(time+1/(metadata?.fps || 30))}><SkipForward size={18} /></button>
      <button title="Next keyframe" aria-label="Next keyframe" disabled={blocked || !next} onClick={() => seek(next!.timeSeconds)}><ChevronLast size={18} /></button>
      <output>{time.toFixed(2)} / {duration.toFixed(2)} s</output>
      <label>Speed <select aria-label="Playback speed" defaultValue="1" onChange={event => { if (video) video.playbackRate = Number(event.target.value); }}>{[.25,.5,1,1.5,2].map(speed => <option key={speed} value={speed}>{speed}x</option>)}</select></label>
      <label>Keyframe <select aria-label="Keyframe name" value={name} onChange={event => setName(event.target.value)}>{['Address','Backswing','Top','Downswing','Impact','Follow-through'].map(value => <option key={value}>{value}</option>)}</select></label>
      <button disabled={!analysis || blocked || analysis.keyframes.length >= 100} onClick={() => { if (analysis) motion.set({ analysis: { ...analysis,keyframes: [...analysis.keyframes,{ id: crypto.randomUUID(),name,timeSeconds: video?.currentTime ?? time }].sort((a,b) => a.timeSeconds-b.timeSeconds) } }); }}><Plus size={15} />Add Keyframe</button>
    </div>
    <div className="motion-keyframes">{analysis?.keyframes.map(frame => <div key={frame.id}><button onClick={() => seek(frame.timeSeconds)}>{frame.name} <small>{frame.timeSeconds.toFixed(2)} s</small></button><button aria-label={`Delete ${frame.name} keyframe`} title={`Delete ${frame.name} keyframe`} onClick={() => motion.set({ analysis: { ...analysis,keyframes: analysis.keyframes.filter(value => value.id !== frame.id) } })}><X size={13} /></button></div>)}</div>
  </section>;
}
