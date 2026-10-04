import { useEffect,useRef } from 'react';
import { Expand } from 'lucide-react';
import { researchFrameAt,trackColor,type ResearchAnalysis,type ResearchSubject } from '../../../../packages/shared/src/research.js';
import { occupancyBins,projectedHeading,spatialBounds,spatialContext,spatialPoint,spatialSegments,type HeatMode,type TrailMode } from '../../../../packages/shared/src/research-spatial.js';
import type { SpatialMode } from '../../../../packages/shared/src/research-metrics.js';
import { research,useResearch } from './store.js';
import { ResearchRenderer3D } from './ResearchRenderer3D.js';

const names:Record<SpatialMode,string>={auto:'AUTO',top:'2.5D Top View',perspective:'Perspective / Relative Depth',image:'Image Trajectory Map','3d':'Estimated 3D'};
export function ResearchSpatialView({video,time,onFullscreen}:{video:HTMLVideoElement|null;time:number;onFullscreen:()=>void}){
  const state=useResearch(),context=spatialContext(state.analysis,time,research.spatial),trail=state.options.composite?'full':state.options.spatialTrail??'past';
  return <div className="research-spatial"><div className="research-spatial-toolbar">
    <label>Spatial View <select aria-label="Spatial View" value={research.spatial} onChange={e=>research.scene(e.target.value as SpatialMode)}>{(Object.keys(names) as SpatialMode[]).map(mode=><option key={mode} value={mode}>{names[mode]}</option>)}</select></label>
    <span>{context.available?names[context.mode]:'No observations'}{context.historyOnly?' / recorded context; current unobserved':''}</span>
    {!!state.analysis?.tracks.length&&<><label>Trajectory <select aria-label="Spatial Trajectory" value={trail} onChange={e=>research.options({spatialTrail:e.target.value as TrailMode,composite:false})}><option value="current">Current Position</option><option value="past">All Observed Past</option><option value="full">Full Recorded Clip</option></select></label>
    {context.mode!=='3d'&&<><label>Heatmap <select aria-label="Activity Heatmap" value={state.options.heatmap??'all'} onChange={e=>research.options({heatmap:e.target.value as HeatMode})}><option value="off">Off</option><option value="selected">Selected Subject Occupancy</option><option value="all">All Subjects Occupancy</option><option value="interaction">Interaction Density / Proximity</option><option value="pair" disabled={state.comparison===null}>Pair Proximity Density</option>{state.analysis.tracks.some(t=>t.label.includes('lion'))&&<option value="cats">Big-cat Hypotheses</option>}{state.analysis.tracks.some(t=>t.label.includes('hyena'))&&<option value="canines">Canine Hypotheses</option>}</select></label>
    <label>Occupancy Scope <select aria-label="Occupancy Scope" value={state.options.heatmapScope??'clip'} onChange={e=>research.options({heatmapScope:e.target.value as 'clip'|'past'})}><option value="clip">Whole Recorded Clip</option><option value="past">Observed Past to T</option></select></label></>}</>}
  </div>{context.mode==='3d'&&context.available&&!context.historyOnly?<ResearchRenderer3D video={video} onFullscreen={onFullscreen}/>:<SpatialMap video={video} onFullscreen={onFullscreen}/>}</div>;
}
function SpatialMap({video,onFullscreen}:{video:HTMLVideoElement|null;onFullscreen:()=>void}){
  const canvas=useRef<HTMLCanvasElement>(null),hits=useRef<Array<{id:number;x:number;y:number}>>([]);
  useEffect(()=>{
    const element=canvas.current;if(!element)return;const ctx=element.getContext('2d')!;let raf=0;
    let cachedData:ResearchAnalysis|null=null,cachedKey='',cachedBox={x:0,z:0,w:1,h:1},bins=new Map<string,number>(),paths=new Map<number,ReturnType<typeof spatialSegments>>();
    const draw=()=>{
      const state=research.get(),data=state.analysis,time=video?.currentTime??0,context=spatialContext(data,time,research.spatial),frame=context.current,mode=context.mode,options=state.options,w=element.clientWidth,h=element.clientHeight,ratio=Math.min(2,devicePixelRatio);
      if(!w||!h){raf=requestAnimationFrame(draw);return;}
      if(element.width!==Math.round(w*ratio)||element.height!==Math.round(h*ratio)){element.width=Math.round(w*ratio);element.height=Math.round(h*ratio);}
      ctx.setTransform(ratio,0,0,ratio,0,0);ctx.fillStyle='#14191e';ctx.fillRect(0,0,w,h);hits.current=[];
      element.dataset.time=String(time);element.dataset.subjects=String(frame?.subjects.length??0);element.dataset.trackIds=frame?.subjects.map(s=>s.id).join(',')??'';element.dataset.selected=String(state.selected??'');element.dataset.sampleTime=String(frame?.time??'');element.dataset.spatialMode=mode;element.dataset.available=String(context.available);
      if(!data||!context.available){ctx.fillStyle='#cbd4df';ctx.font='14px sans-serif';ctx.fillText('3D reconstruction unavailable for this segment',20,42,w-40);ctx.font='12px sans-serif';ctx.fillText('No tracked observations. Original video remains available.',20,65,w-40);element.dataset.heatmapBins='0';element.dataset.pathSegments='0';raf=requestAnimationFrame(draw);return;}
      const trail=options.composite?'full':options.spatialTrail??'past',heat=options.heatmap??'all',scope=options.heatmapScope??'clip',bucket=Math.floor(time*data.settings.fps+1e-7),key=[mode,trail,heat,scope,state.selected,state.comparison,bucket].join(':');
      if(data!==cachedData||key!==cachedKey){cachedData=data;cachedKey=key;cachedBox=spatialBounds(data,mode);bins=occupancyBins(data,mode,heat,state.selected,state.comparison,scope==='clip'?Infinity:time,cachedBox);paths=new Map(data.tracks.map(t=>[t.id,spatialSegments(data,t.id,time,mode,trail)]));}
      const box=cachedBox,project=(p:{x:number;z:number})=>({x:32+(p.x-box.x)/box.w*(w-64),y:mode==='image'?32+(p.z-box.z)/box.h*(h-112):h-80-(p.z-box.z)/box.h*(h-112)});
      const text=(value:string,x:number,y:number,color='#b6c2cd')=>{ctx.fillStyle=color;ctx.font='12px sans-serif';ctx.fillText(value,x,y,Math.max(1,w-x-12));};
      const occupied:Array<{x:number;y:number;w:number;h:number}>=(frame?.subjects??[]).flatMap(s=>{const p=spatialPoint(s,mode);if(!p)return [];const q=project(p);return [{x:q.x-20,y:q.y-32,w:40,h:64}];});
      const annotation=(value:string,x:number,y:number,color:string)=>{
        ctx.font='12px sans-serif';const width=Math.min(w-32,ctx.measureText(value).width+10);x=Math.max(16,Math.min(w-width-16,x));
        let chosen=Math.max(48,Math.min(h-92,y));
        for(const offset of [0,-22,22,-44,44,-66,66,-88,88]){const candidate=Math.max(48,Math.min(h-92,y+offset));if(!occupied.some(r=>x<r.x+r.w&&x+width>r.x&&candidate-14<r.y+r.h&&candidate+6>r.y)){chosen=candidate;break;}}
        occupied.push({x:x-4,y:chosen-14,w:width,h:22});ctx.fillStyle='#11171cf0';ctx.fillRect(x-4,chosen-14,width,22);text(value,x,chosen+2,color);
      };
      ctx.lineWidth=1;ctx.strokeStyle='#29343a';for(let i=0;i<=4;i++){const x=32+i*(w-64)/4,y=32+i*(h-112)/4;ctx.beginPath();ctx.moveTo(x,32);ctx.lineTo(x,h-80);ctx.moveTo(32,y);ctx.lineTo(w-32,y);ctx.stroke();}
      text(mode==='image'?'Image X / Image Y / T':mode==='perspective'?'Image X / inferred depth / T':'X scene horizontal / Z estimated depth / T',32,20);
      const max=Math.max(0,...bins.values());
      for(const [key,value] of bins){const [x,z]=key.split(':').map(Number),p=project({x:box.x+x/32*box.w,z:box.z+z/32*box.h});ctx.fillStyle='rgba(239,157,73,'+(.08+.34*Math.sqrt(value/Math.max(.001,max)))+')';ctx.fillRect(p.x,mode==='image'?p.y:p.y-(h-112)/32,(w-64)/32+1,(h-112)/32+1);}
      element.dataset.heatmapBins=String(bins.size);element.dataset.heatmapScope=scope;element.dataset.trailMode=trail;element.dataset.pathSegments=String([...paths.values()].reduce((sum,p)=>sum+p.length,0));
      let selectedSegments=0,laterSegments=0;
      if(options.trails3D)for(const [id,segments] of paths){const selected=id===state.selected;ctx.strokeStyle=trackColor(id);ctx.lineWidth=selected?3:1.6;
        for(const segment of segments){const a=project(segment.from),b=project(segment.to);ctx.globalAlpha=segment.laterRecorded?.28:selected?.4+.5*Math.max(0,1-(time-segment.time)/Math.max(1,time)):.3;ctx.setLineDash(segment.laterRecorded?[5,5]:[]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();if(selected)selectedSegments++;if(segment.laterRecorded)laterSegments++;}
        ctx.globalAlpha=1;ctx.setLineDash([]);
        if(selected&&segments.length){const start=project(segments[0].from);ctx.beginPath();ctx.arc(start.x,start.y,4,0,Math.PI*2);ctx.stroke();}
      }
      element.dataset.selectedSegments=String(selectedSegments);element.dataset.laterRecordedSegments=String(laterSegments);
      const subject=(s:ResearchSubject,opacity=1,current=true)=>{
        const p=spatialPoint(s,mode);if(!p)return;const point=project(p),selected=s.id===state.selected,quality=mode==='image'?s.confidence:Math.min(s.confidence,s.depthEstimate.confidence??.15),radius=selected?13:10;
        let angle=mode==='top'&&s.heading!==null?projectedHeading(s.heading,(w-64)/box.w,(h-112)/box.h):null;
        if(mode!=='top'){const prior=data.frames.filter(f=>f.time<time&&f.time>=time-.6).reverse().find(f=>f.subjects.some(a=>a.id===s.id)),old=prior?.subjects.find(a=>a.id===s.id),q=old?spatialPoint(old,mode):null;if(q){const a=project(q),dx=point.x-a.x,dy=point.y-a.y;if(Math.hypot(dx,dy)>2)angle=Math.atan2(dx,-dy);}}
        ctx.save();ctx.translate(point.x,point.y);ctx.globalAlpha=opacity*(selected?.9:.55+.4*quality);ctx.strokeStyle=trackColor(s.id);ctx.fillStyle=trackColor(s.id);ctx.lineWidth=selected?3:1.5;
        if(options.uncertainty&&current){ctx.setLineDash([3,4]);ctx.beginPath();ctx.arc(0,0,radius+7+(1-quality)*8,0,2*Math.PI);ctx.stroke();ctx.setLineDash([]);}
        ctx.rotate(angle??0);ctx.beginPath();ctx.ellipse(0,0,radius*.65,radius,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle=selected?'#ffffff':trackColor(s.id);ctx.stroke();
        if(angle!==null&&current){ctx.strokeStyle=trackColor(s.id);ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(0,-radius);ctx.lineTo(0,-radius-23);ctx.lineTo(-5,-radius-15);ctx.moveTo(0,-radius-23);ctx.lineTo(5,-radius-15);ctx.stroke();ctx.beginPath();ctx.arc(0,-radius*.75,4,0,Math.PI*2);ctx.fill();}
        ctx.restore();
        if(current){hits.current.push({id:s.id,...point});if(options.labels3D){const label='#'+String(s.id).padStart(2,'0')+(selected?' / Q '+Math.round(quality*100)+'%':'');const width=ctx.measureText(label).width+10,x=point.x+radius+8+width>w-12?Math.max(12,point.x-radius-width-8):point.x+radius+8,y=Math.max(44,Math.min(h-88,point.y));annotation(label,x,y,trackColor(s.id));}}
      };
      if(options.ghosts3D)for(let i=options.ghostCount;i>0;i--){const t=time-i*options.ghostInterval;if(t>=0)for(const s of researchFrameAt(data,t)?.subjects??[])subject(s,.2/i,false);}
      const a=frame?.subjects.find(s=>s.id===state.selected),b=state.comparison!==null?frame?.subjects.find(s=>s.id===state.comparison):a?frame?.subjects.filter(s=>s.id!==a.id).sort((x,y)=>Math.hypot(x.center2D.x-a.center2D.x,x.center2D.y-a.center2D.y)-Math.hypot(y.center2D.x-a.center2D.x,y.center2D.y-a.center2D.y))[0]:undefined;
      if(a&&b&&options.interactions){const p=spatialPoint(a,mode),q=spatialPoint(b,mode);if(p&&q){const from=project(p),to=project(q);ctx.strokeStyle='#e2d38c';ctx.lineWidth=1;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();ctx.setLineDash([]);annotation('~'+Math.hypot(p.x-q.x,p.z-q.z).toFixed(2)+(mode==='image'?' image':' XZ'),Math.min(w-110,Math.max(12,(from.x+to.x)/2)),Math.max(40,(from.y+to.y)/2-8),'#e2d38c');}}
      if(state.selected!==null&&state.comparison!==null&&options.interactions){let closest:{distance:number;time:number;x:number;z:number}|null=null;for(const f of data.frames){if(trail!=='full'&&f.time>time)break;const a=f.subjects.find(s=>s.id===state.selected),b=f.subjects.find(s=>s.id===state.comparison),p=a?spatialPoint(a,mode):null,q=b?spatialPoint(b,mode):null;if(p&&q){const distance=Math.hypot(p.x-q.x,p.z-q.z);if(!closest||distance<closest.distance)closest={distance,time:f.time,x:(p.x+q.x)/2,z:(p.z+q.z)/2};}}if(closest){const p=project(closest);ctx.strokeStyle='#e2d38c';ctx.strokeRect(p.x-4,p.y-4,8,8);annotation('Closest T '+closest.time.toFixed(2),Math.max(12,Math.min(w-120,p.x+9)),Math.max(44,p.y-10),'#e2d38c');}}
      if(options.volumes)for(const s of frame?.subjects??[])subject(s);
      ctx.globalAlpha=1;text('T '+time.toFixed(3)+' / '+(frame?.subjects.length??0)+' current / '+(mode==='image'?'normalized image coordinates':data.refinement?.units??'relative scene units'),12,h-58);
      text(context.historyOnly?'Current subjects unobserved / recorded context retained':trail==='full'?'Solid: observed past / dashed: later recorded, not prediction':trail==='past'?'Observed past trajectory / current position emphasized':'Current observed positions',12,h-38);
      text(heat==='off'?'Occupancy off':(scope==='clip'?'Whole-clip':'Past to T')+' occupancy / '+bins.size+' bins / max '+max.toFixed(2)+' subject-s',12,h-18,'#dfb07a');
      raf=requestAnimationFrame(draw);
    };raf=requestAnimationFrame(draw);return()=>cancelAnimationFrame(raf);
  },[video]);
  return <section className="research-view"><header><strong>Monocular 4D Spatial Estimate</strong><button aria-label="Fullscreen 3D research" title="Fullscreen spatial research" onClick={onFullscreen}><Expand size={16}/></button></header><div className="research-3d-stage"><canvas ref={canvas} aria-label="Spatial research map" onClick={e=>{const rect=e.currentTarget.getBoundingClientRect(),x=e.clientX-rect.x,y=e.clientY-rect.y,hit=hits.current.filter(p=>Math.hypot(p.x-x,p.y-y)<28).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];if(hit)research.set({selected:hit.id});}}/></div><div className="research-axis-legend">Estimated reference plane / Q: model quality index, not probability / no recovered terrain</div></section>;
}
