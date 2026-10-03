import { useEffect,useRef } from 'react';
import { Expand } from 'lucide-react';
import { MotionProjectionService } from '../motion/MotionProjectionService.js';
import { research,useResearch } from './store.js';
import { drawResearchOverlay } from './VideoOverlayRenderer2D.js';
export function ResearchVideoView({url,video,setVideo,onFullscreen}:{url:string;video:HTMLVideoElement|null;setVideo:(video:HTMLVideoElement|null)=>void;onFullscreen:()=>void}){
  const canvas=useRef<HTMLCanvasElement>(null),hits=useRef<ReturnType<typeof drawResearchOverlay>['hits']>([]);
  const {options}=useResearch();
  useEffect(()=>{
    if(!video||!canvas.current)return;const overlay=canvas.current,context=overlay.getContext('2d')!;let frame=0;
    const draw=()=>{const width=overlay.clientWidth,height=overlay.clientHeight;if(width&&height&&video.videoWidth){const ratio=Math.min(2,devicePixelRatio);if(overlay.width!==Math.round(width*ratio)||overlay.height!==Math.round(height*ratio)){overlay.width=Math.round(width*ratio);overlay.height=Math.round(height*ratio);}context.setTransform(ratio,0,0,ratio,0,0);const state=research.get(),result=drawResearchOverlay(context,new MotionProjectionService(width,height,video.videoWidth,video.videoHeight,state.options.fit),state.analysis,state.options,video.currentTime,state.selected);hits.current=result.hits;overlay.dataset.time=String(video.currentTime);overlay.dataset.subjects=String(result.frame?.subjects.length??0);overlay.dataset.sampleTime=String(result.frame?.time??'');}frame=requestAnimationFrame(draw);};frame=requestAnimationFrame(draw);return()=>cancelAnimationFrame(frame);
  },[video]);
  return <section className="research-view"><header><strong>Source / Animal Observations</strong><button title="Fullscreen research presentation" aria-label="Fullscreen research presentation" onClick={onFullscreen}><Expand size={16}/></button></header><div className="research-video-stage"><video ref={setVideo} src={url||undefined} muted playsInline preload="auto" style={{objectFit:options.fit}} onError={()=>research.set({error:'Video decoding failed. Use the prepared root video or a supported local file.'})}/><canvas ref={canvas} aria-label="Wildlife video overlay" onClick={event=>{const rect=event.currentTarget.getBoundingClientRect(),x=event.clientX-rect.x,y=event.clientY-rect.y;const hit=hits.current.filter(hit=>x>=hit.x&&x<=hit.x+hit.width&&y>=hit.y&&y<=hit.y+hit.height).sort((a,b)=>a.width*a.height-b.width*b.height)[0];if(hit)research.set({selected:hit.id});}}/></div></section>;
}
