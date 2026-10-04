import { researchFrameAt,type ResearchAnalysis,type ResearchSubject } from './research.js';
import { spatialAvailability,validSpatial,type SpatialMode } from './research-metrics.js';

export type TrailMode='current'|'past'|'full';
export type HeatMode='off'|'selected'|'all'|'interaction'|'pair'|'cats'|'canines';
export function spatialContext(data:ResearchAnalysis|null,time:number,requested:SpatialMode='auto'){
  const frame=researchFrameAt(data,time),history=data?.frames.flatMap(f=>f.subjects)??[];
  const subjects=frame?.subjects.length?frame.subjects:history;
  const availability=spatialAvailability(frame?.subjects.length?frame:subjects.length?{...data!.frames[0],subjects}:null,requested);
  let mode=availability.mode;
  if(mode==='3d'&&subjects.some(s=>!validSpatial(s)))mode='top';
  // A mixed-quality scene must not silently drop an animal seen in the video.
  if((mode==='top'||mode==='3d')&&subjects.some(s=>!s.worldEstimate))mode=subjects.every(s=>s.depthEstimate.value!==null)?'perspective':'image';
  if(mode==='perspective'&&subjects.some(s=>s.depthEstimate.value===null))mode='image';
  if(!frame?.subjects.length&&mode==='3d')mode='top';
  return {...availability,mode,available:subjects.length>0,current:frame,historyOnly:!frame?.subjects.length&&history.length>0};
}
export function spatialPoint(subject:ResearchSubject,mode:SpatialMode){
  if(mode==='top'||mode==='3d')return subject.worldEstimate?{x:subject.worldEstimate.x,z:subject.worldEstimate.z}:null;
  if(mode==='perspective')return subject.depthEstimate.value!==null?{x:subject.center2D.x,z:subject.depthEstimate.value}:null;
  return {x:subject.center2D.x,z:subject.center2D.y};
}
export function projectedHeading(heading:number,xScale:number,zScale:number){return Math.atan2(Math.sin(heading)*xScale,Math.cos(heading)*zScale);}
export function spatialBounds(data:ResearchAnalysis,mode:SpatialMode){
  const points=data.frames.flatMap(f=>f.subjects.flatMap(s=>{const p=spatialPoint(s,mode);return p?[p]:[];}));
  if(!points.length)return {x:0,z:0,w:1,h:1};
  const xs=points.map(p=>p.x),zs=points.map(p=>p.z),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
  const w=Math.max(mode==='image'?.1:.5,maxX-minX),h=Math.max(mode==='image'?.1:.5,maxZ-minZ);
  return {x:minX-w*.12,z:minZ-h*.12,w:w*1.24,h:h*1.24};
}
export function spatialSegments(data:ResearchAnalysis,id:number,time:number,mode:SpatialMode,trail:TrailMode){
  if(trail==='current')return [];
  const observations=data.frames.flatMap(f=>{const s=f.subjects.find(s=>s.id===id);return s?[{time:f.time,subject:s}]:[];}),segments=[];
  for(let i=1;i<observations.length;i++){
    const a=observations[i-1],b=observations[i];if(trail!=='full'&&b.time>time)break;
    const from=spatialPoint(a.subject,mode),to=spatialPoint(b.subject,mode);
    if(from&&to&&b.time-a.time<=.65)segments.push({from,to,time:b.time,laterRecorded:b.time>time});
  }return segments;
}
export function occupancyBins(data:ResearchAnalysis,mode:SpatialMode,heat:HeatMode,selected:number|null,comparison:number|null,until:number,box=spatialBounds(data,mode)){
  const bins=new Map<string,number>();if(heat==='off')return bins;
  for(const frame of data.frames){if(frame.time>until)break;
    const subjects=frame.subjects.filter(s=>heat==='selected'?s.id===selected:heat==='cats'?s.classLabel.includes('lion'):heat==='canines'?s.classLabel.includes('hyena'):heat==='pair'?s.id===selected||s.id===comparison:true);
    for(const s of subjects){
      if(heat==='interaction'||heat==='pair'){
        if(heat==='pair'&&(selected===null||comparison===null))continue;
        const near=frame.subjects.some(other=>other.id!==s.id&&(heat!=='pair'||other.id===selected||other.id===comparison)&&Math.hypot(s.center2D.x-other.center2D.x,s.center2D.y-other.center2D.y)<.15);
        if(!near)continue;
      }
      const p=spatialPoint(s,mode);if(!p)continue;
      const x=Math.max(0,Math.min(31,Math.floor((p.x-box.x)/box.w*32))),z=Math.max(0,Math.min(31,Math.floor((p.z-box.z)/box.h*32))),key=`${x}:${z}`;
      const duration=Math.min(1/data.settings.fps,Math.max(0,data.video.duration-frame.time));
      bins.set(key,(bins.get(key)??0)+duration);
    }
  }return bins;
}
