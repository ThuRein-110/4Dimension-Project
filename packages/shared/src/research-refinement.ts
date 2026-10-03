import { researchFrameAt,type ResearchAnalysis,type ResearchCalibration,type ResearchSubject } from './research.js';
import { deriveTemporalEvents } from './research-temporal-events.js';
export type Smoothing='off'|'low'|'medium'|'high';
const mix=(a:number,b:number,alpha:number)=>a+(b-a)*alpha;
function scaleFromReference(data:ResearchAnalysis,calibration:ResearchCalibration|null){
  if(!calibration?.a||!calibration.b||calibration.sourceId!==data.video.id)return null;
  const frame=researchFrameAt(data,calibration.time);if(!frame)return null;
  const position=(point:{x:number;y:number})=>{const map=frame.depthMap,[x,y,w,h]=map.rect;if(point.x<x||point.x>x+w||point.y<y||point.y>y+h)return null;const ix=Math.min(map.width-1,Math.floor((point.x-x)/w*map.width)),iy=Math.min(map.height-1,Math.floor((point.y-y)/h*map.height)),z=2+8*(1-map.values[iy*map.width+ix]);return {x:(point.x-.5)*z/data.ground.focalNormalized,z};};
  const a=position(calibration.a),b=position(calibration.b);if(!a||!b)return null;const distance=Math.hypot(a.x-b.x,a.z-b.z);return distance>.05?calibration.metres/distance:null;
}
/** Causal refinement uses observed samples only, resets on gaps, and retains raw data. */
export function refineResearch(data:ResearchAnalysis,smoothing:Smoothing='medium',calibration:ResearchCalibration|null=null):ResearchAnalysis{
  calibration=calibration?.sourceId===data.video.id?calibration:null;
  const referenceScale=scaleFromReference(data,calibration),scale=referenceScale??1,history=new Map<number,{time:number;subject:ResearchSubject;raw:ResearchSubject;count:number;heading:number|null}>();
  const tau={off:0,low:.10,medium:.25,high:.45}[smoothing],frames=data.frames.map(frame=>({...frame,rawSubjects:frame.rawSubjects??frame.subjects,subjects:(frame.rawSubjects??frame.subjects).map(raw=>{
    const subject=structuredClone(raw),previous=history.get(raw.id),dt=previous?frame.time-previous.time:0,gap=!previous||dt>.65;
    subject.velocity=null;subject.acceleration=null;subject.heading=null;
    const jump=!!previous&&Math.hypot(raw.center2D.x-previous.raw.center2D.x,raw.center2D.y-previous.raw.center2D.y)>.18;
    const alpha=tau?1-Math.exp(-dt/tau):1,count=gap?1:(previous?.count??0)+1;
    if(subject.worldEstimate){
      if(!gap&&previous?.subject.worldEstimate&&!jump){const p=previous.subject.worldEstimate,q=subject.worldEstimate;for(const axis of ['x','y','z'] as const)q[axis]=mix(p[axis],q[axis],alpha);for(const axis of ['length','width','height'] as const)subject.volume[axis]=mix(previous.subject.volume[axis],subject.volume[axis],alpha);}
      subject.depthEstimate.value=subject.worldEstimate.z;
      const change=previous?.raw.depthEstimate.value&&raw.depthEstimate.value?Math.abs(raw.depthEstimate.value-previous.raw.depthEstimate.value)/previous.raw.depthEstimate.value:0;
      subject.depthEstimate.confidence=Math.max(0,(raw.depthEstimate.confidence??0)*(change>.2?.65:1));
      if(calibration?.ground){const [x,y,w,h]=calibration.ground,foot={x:raw.center2D.x,y:raw.bbox[1]+raw.bbox[3]};if(foot.x<x||foot.x>x+w||foot.y<y||foot.y>y+h)subject.depthEstimate.confidence=Math.min(.3,subject.depthEstimate.confidence);}
      subject.kinematicQuality=jump||gap?0:Math.min(subject.confidence,subject.depthEstimate.confidence??0)*(count>=3?1:.5);
      if(!gap&&!jump&&previous?.subject.worldEstimate&&count>=3&&subject.kinematicQuality>=.25){const p=previous.subject.worldEstimate,q=subject.worldEstimate,v={x:(q.x-p.x)/dt,y:(q.y-p.y)/dt,z:(q.z-p.z)/dt},old=previous.subject.velocity;
        if(old)for(const axis of ['x','y','z'] as const)v[axis]=mix(old[axis],v[axis],alpha);
        subject.velocity={...v,speed:Math.hypot(v.x,v.y,v.z)};
        const speed=Math.hypot(v.x,v.z),angle=Math.atan2(v.x,v.z),heading=previous.heading;
        subject.heading=speed>.15?heading===null?angle:heading+Math.max(-Math.PI*dt,Math.min(Math.PI*dt,Math.atan2(Math.sin(angle-heading),Math.cos(angle-heading))*(smoothing==='off'?1:Math.min(.35,alpha)))):speed>.06?heading:null;
        if(old&&count>=5&&subject.kinematicQuality>=.4&&Math.abs(subject.velocity.speed-old.speed)<.8)subject.acceleration=Math.hypot(v.x-old.x,v.y-old.y,v.z-old.z)/dt;
      }
    }
    const overlaps=frame.subjects.some(other=>{if(other.id===raw.id)return false;const a=raw.bbox,b=other.bbox,area=Math.max(0,Math.min(a[0]+a[2],b[0]+b[2])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[1]+a[3],b[1]+b[3])-Math.max(a[1],b[1]));return area/Math.max(.00001,a[2]*a[3])>.2;});
    subject.stateFlags=overlaps?['observed','partially occluded']:['observed'];subject.visibility=overlaps?.65:1;
    history.set(raw.id,{time:frame.time,subject:structuredClone(subject),raw,count,heading:subject.heading});
    if(scale!==1){if(subject.worldEstimate)for(const axis of ['x','y','z'] as const)subject.worldEstimate[axis]*=scale;if(subject.depthEstimate.value!==null)subject.depthEstimate.value*=scale;for(const axis of ['length','width','height'] as const)subject.volume[axis]*=scale;if(subject.velocity){for(const axis of ['x','y','z','speed'] as const)subject.velocity[axis]*=scale;}if(subject.acceleration!==null)subject.acceleration*=scale;}
    return subject;
  })}));
  const tracks=data.tracks.map(track=>{const observations=frames.flatMap(f=>f.subjects.filter(s=>s.id===track.id)),raw=frames.flatMap(f=>(f.rawSubjects??f.subjects).filter(s=>s.id===track.id)),expected=Math.max(observations.length,Math.round((track.lastSeen-track.firstSeen)*data.settings.fps)+1),continuity=observations.length/expected,meanDetection=observations.reduce((sum,s)=>sum+s.confidence,0)/Math.max(1,observations.length),jumpWarnings=raw.filter((s,i)=>i&&Math.hypot(s.center2D.x-raw[i-1].center2D.x,s.center2D.y-raw[i-1].center2D.y)>.18).length;
    return {...track,quality:{score:Math.max(0,Math.min(1,.4*meanDetection+.4*continuity+.2*(1-jumpWarnings/Math.max(1,observations.length)))),continuity,meanDetection,missingSamples:expected-observations.length,jumpWarnings,identitySwitches:null}};});
  const result={...data,frames,tracks,refinement:{version:'temporal-v1' as const,smoothing,scale,units:referenceScale===null?'relative scene units' as const:'approximate metres' as const,calibration}};
  const events=deriveTemporalEvents(result);return {...result,events,frames:frames.map(f=>({...f,events:events.filter(e=>Math.abs(e.time-f.time)<.001)}))};
}
