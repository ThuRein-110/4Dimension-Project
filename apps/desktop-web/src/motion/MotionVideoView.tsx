import { useEffect, useRef } from 'react';
import { Expand, Eye, EyeOff } from 'lucide-react';
import { MotionProjectionService } from './MotionProjectionService.js';
import { renderMotionOverlay, type OverlayFrame, type OverlaySelection } from './MotionOverlayRenderer.js';
import { motion, useMotion } from './store.js';

export const overlaySelection:OverlaySelection={joint:16,time:null,hidden:false,offset:{x:0,y:0}};
export function MotionVideoView({ url, video, setVideo, onMetadata, onTime, onPlaying, clubMode, onFullscreen }: {
  url:string;video:HTMLVideoElement|null;setVideo:(value:HTMLVideoElement|null)=>void;
  onMetadata:(media:HTMLVideoElement)=>void;onTime:(time:number)=>void;onPlaying:(playing:boolean)=>void;clubMode:boolean;onFullscreen:()=>void;
}) {
  const canvas=useRef<HTMLCanvasElement>(null),rendered=useRef<OverlayFrame|null>(null),status=useRef<HTMLOutputElement>(null);
  const drag=useRef<{x:number;y:number;offset:{x:number;y:number}}|null>(null);
  const {display,metadata}=useMotion();
  useEffect(()=>{overlaySelection.time=null;overlaySelection.offset={x:0,y:0};},[metadata?.id]);
  useEffect(()=>{
    if(!video||!canvas.current)return;
    const overlay=canvas.current,context=overlay.getContext('2d')!;let frame=0,lastStatus=0;
    const draw=(now:number)=>{
      const width=overlay.clientWidth,height=overlay.clientHeight;
      if(width&&height&&video.videoWidth){
        const ratio=devicePixelRatio;
        if(overlay.width!==Math.round(width*ratio)||overlay.height!==Math.round(height*ratio)){overlay.width=Math.round(width*ratio);overlay.height=Math.round(height*ratio);}
        context.setTransform(ratio,0,0,ratio,0,0);
        const state=motion.get();if(overlaySelection.joint!==state.display.selectedJoint){overlaySelection.joint=state.display.selectedJoint;overlaySelection.time=null;}
        rendered.current=renderMotionOverlay(context,new MotionProjectionService(width,height,video.videoWidth,video.videoHeight,state.display.fit),state.analysis,state.display,video.currentTime,overlaySelection);
        overlay.dataset.sampleTime=String(video.currentTime);overlay.dataset.poseVisible=String(rendered.current.poseVisible);overlay.dataset.card=JSON.stringify(rendered.current.card);overlay.dataset.selectedTime=String(overlaySelection.time ?? video.currentTime);
        if(now-lastStatus>100&&status.current){status.current.textContent=rendered.current.information;lastStatus=now;}
      }
      frame=requestAnimationFrame(draw);
    };
    frame=requestAnimationFrame(draw);return()=>cancelAnimationFrame(frame);
  },[video]);
  return <section className="motion-view"><header><strong>4D Video View</strong><div className="motion-overlay-actions"><button title="Show joint information" aria-label="Show joint information" onClick={()=>{overlaySelection.hidden=false;overlaySelection.time=null;}}><Eye size={16}/></button><button title="Hide joint information" aria-label="Hide joint information" onClick={()=>{overlaySelection.hidden=true;}}><EyeOff size={16}/></button><button title="Fullscreen 4D Video" aria-label="Fullscreen 4D Video" onClick={onFullscreen}><Expand size={16}/></button></div></header><div className={`motion-video-stage ${clubMode?'club-annotating':''}`}>
    <video ref={setVideo} src={url||undefined} muted playsInline preload="auto" style={{objectFit:display.fit}} onLoadedMetadata={event=>onMetadata(event.currentTarget)} onTimeUpdate={event=>onTime(event.currentTarget.currentTime)} onSeeked={event=>{overlaySelection.time=null;onTime(event.currentTarget.currentTime);}} onPlay={()=>{overlaySelection.time=null;onPlaying(true);}} onPause={()=>onPlaying(false)} onError={()=>motion.set({error:'Video decoding failed. Use an H.264 MP4 or the prepared root video.'})}/>
    <canvas ref={canvas} className="motion-pose-overlay" aria-label="2D pose overlay" onPointerDown={event=>{
      if(!video)return;const bounds=event.currentTarget.getBoundingClientRect(),x=event.clientX-bounds.x,y=event.clientY-bounds.y;
      const state=motion.get();if(!state.analysis)return;
      if(clubMode){if(!video.paused)return;const p=new MotionProjectionService(bounds.width,bounds.height,video.videoWidth,video.videoHeight,state.display.fit).inverse({x,y});if(!p)return;const club=[...state.analysis.club.filter(point=>Math.abs(point.timeSeconds-video.currentTime)>.001),{timeSeconds:video.currentTime,...p}].sort((a,b)=>a.timeSeconds-b.timeSeconds);motion.set({analysis:{...state.analysis,club}});return;}
      const card=rendered.current?.card;
      if(card&&x>=card.x&&x<=card.x+card.width&&y>=card.y&&y<=card.y+card.height){drag.current={x:event.clientX,y:event.clientY,offset:{...overlaySelection.offset}};event.currentTarget.setPointerCapture(event.pointerId);return;}
      const hit=rendered.current?.hits.reduce<{distance:number;hit:OverlayFrame['hits'][number]}|null>((best,hit)=>{const distance=Math.hypot(hit.x-x,hit.y-y);return distance<=12&&(!best||distance<=best.distance)?{distance,hit}:best;},null)?.hit;
      if(hit){motion.settings({selectedJoint:hit.joint});overlaySelection.joint=hit.joint;overlaySelection.time=hit.time;overlaySelection.hidden=false;overlaySelection.offset={x:0,y:0};}
    }} onPointerMove={event=>{if(!drag.current)return;overlaySelection.offset={x:Math.max(-1,Math.min(1,drag.current.offset.x+(event.clientX-drag.current.x)/event.currentTarget.clientWidth)),y:Math.max(-1,Math.min(1,drag.current.offset.y+(event.clientY-drag.current.y)/event.currentTarget.clientHeight))};}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}/>
    <output ref={status} className="motion-accessible-info" aria-label="Selected video joint"/>
  </div></section>;
}
