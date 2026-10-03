import { pairDistance,researchFrameAt,type ResearchAnalysis,type ResearchFrame,type ResearchSubject } from './research.js';
export type SpatialMode='auto'|'3d'|'top'|'perspective'|'image';
export const depthLevel=(score:number|null|undefined)=>score===null||score===undefined?'UNAVAILABLE':score>=.7?'HIGH':score>=.4?'MEDIUM':'LOW';
export function validSpatial(subject:ResearchSubject){return !!subject.worldEstimate&&(subject.depthEstimate.confidence??0)>=.4;}
export function spatialAvailability(frame:ResearchFrame|null,requested:SpatialMode='auto'){
  const subjects=frame?.subjects??[],valid=subjects.filter(validSpatial),depth=subjects.filter(s=>s.depthEstimate.value!==null),full=valid.filter(s=>s.volume.confidence>=.5);
  const automatic:SpatialMode=full.length&&full.length>=subjects.length*.75?'3d':valid.length?'top':depth.length?'perspective':'image';
  const mode=requested==='auto'?automatic:requested==='3d'&&!valid.length?automatic:requested==='top'&&!valid.length?automatic:requested==='perspective'&&!depth.length?'image':requested;
  return {mode,observed:subjects.length,valid:valid.length,depth:depth.length,available:!!subjects.length,fallback:requested!=='auto'&&mode!==requested};
}
export function pairObservations(data:ResearchAnalysis,a:number,b:number,start=0,end=data.video.duration){
  return data.frames.filter(frame=>frame.time>=start&&frame.time<=end).flatMap(frame=>{const x=frame.subjects.find(s=>s.id===a),y=frame.subjects.find(s=>s.id===b);if(!x||!y)return [];const image=pairDistance(x,y).image,scene=validSpatial(x)&&validSpatial(y)?pairDistance(x,y).scene:null;
    return [{time:frame.time,frame:frame.frameIndex,a,b,image,scene,quality:Math.min(x.confidence,y.confidence,x.depthEstimate.confidence??0,y.depthEstimate.confidence??0),relativeSpeed:x.velocity&&y.velocity?Math.hypot(x.velocity.x-y.velocity.x,x.velocity.y-y.velocity.y,x.velocity.z-y.velocity.z):null}];});
}
export function closestPairs(data:ResearchAnalysis){const result=[];for(let i=0;i<data.tracks.length;i++)for(let j=i+1;j<data.tracks.length;j++){const rows=pairObservations(data,data.tracks[i].id,data.tracks[j].id);if(rows.length<2)continue;const image=rows.reduce((a,b)=>a.image<b.image?a:b),scene=rows.filter(r=>r.scene!==null).reduce<typeof image|null>((a,b)=>!a||b.scene!<a.scene!?b:a,null);result.push({a:data.tracks[i].id,b:data.tracks[j].id,observations:rows.length,image,scene});}return result;}
export function groupMetrics(frame:ResearchFrame|null,focal:number|null){
  const selected=frame?.subjects.find(s=>s.id===focal),others=frame?.subjects.filter(s=>s.id!==focal)??[];if(!selected||!others.length)return null;
  const spatial=validSpatial(selected)&&others.every(validSpatial),position=(s:ResearchSubject)=>spatial?{x:s.worldEstimate!.x,z:s.worldEstimate!.z}:{x:s.center2D.x,z:s.center2D.y};
  const center=others.reduce((sum,s)=>({x:sum.x+position(s).x/others.length,z:sum.z+position(s).z/others.length}),{x:0,z:0}),origin=position(selected),distances=others.map(s=>({id:s.id,distance:Math.hypot(position(s).x-origin.x,position(s).z-origin.z)})).sort((a,b)=>a.distance-b.distance);
  const angles=others.map(s=>Math.atan2(position(s).z-origin.z,position(s).x-origin.x)).sort((a,b)=>a-b),largestGap=Math.max(...angles.map((angle,i)=>(angles[(i+1)%angles.length]+(i===angles.length-1?Math.PI*2:0))-angle));
  return {count:others.length,coordinates:spatial?'relative scene':'normalized image',center,spread:Math.sqrt(others.reduce((sum,s)=>sum+(position(s).x-center.x)**2+(position(s).z-center.z)**2,0)/others.length),nearest:distances[0],farthest:distances.at(-1)!,encirclement:others.length>=3?1-largestGap/(Math.PI*2):null,angularCoverageDegrees:(Math.PI*2-largestGap)*180/Math.PI};
}
export function visibilityState(data:ResearchAnalysis,time:number,id:number){const frame=researchFrameAt(data,time),subject=frame?.subjects.find(s=>s.id===id);if(subject)return subject.stateFlags.includes('partially occluded')?'Partially occluded / overlap hypothesis':'Visible';const history=data.frames.filter(f=>f.time<=time&&f.subjects.some(s=>s.id===id)),last=history.at(-1);if(!last)return 'Not yet observed';if(time-last.time>3)return 'Lost / outside observed span';const box=last.subjects.find(s=>s.id===id)!.bbox;return frame?.subjects.some(s=>s.bbox[0]<box[0]+box[2]&&s.bbox[0]+s.bbox[2]>box[0]&&s.bbox[1]<box[1]+box[3]&&s.bbox[1]+s.bbox[3]>box[1])?'Occluded / overlap hypothesis':'Unobserved / detector miss or exit';}
