import { z } from 'zod';

export const RESEARCH_VERSION = 'wildlife-dino-sam2-byte-depth-v2-recovery';
const finite=z.number().finite(),confidence=finite.min(0).max(1),normalized=finite.min(0).max(1);
const vector=z.object({x:finite,y:finite,z:finite});
export const researchSettingsSchema=z.object({fps:z.union([z.literal(2),z.literal(3),z.literal(5),z.literal(10)]).default(5),threshold:finite.min(.1).max(.8).default(.23)});
export type ResearchSettings=z.infer<typeof researchSettingsSchema>;
export const subjectSchema=z.object({
  id:z.number().int().positive(),classLabel:z.string().max(80),classConfidence:confidence,
  bbox:z.tuple([normalized,normalized,normalized,normalized]),mask:z.array(z.array(z.tuple([normalized,normalized])).min(3).max(256)).max(4),maskConfidence:confidence.nullable(),
  center2D:z.object({x:normalized,y:normalized}),depthEstimate:z.object({value:finite.positive().nullable(),confidence:confidence.nullable(),method:z.string().max(120)}),
  worldEstimate:vector.nullable(),volume:z.object({length:finite.positive(),width:finite.positive(),height:finite.min(0),confidence}),
  heading:finite.nullable(),velocity:vector.extend({speed:finite.min(0)}).nullable(),acceleration:finite.min(0).nullable(),visibility:confidence,confidence,stateFlags:z.array(z.enum(['observed','partially occluded','occluded','lost'])).max(4),kinematicQuality:confidence.optional(),
});
export type ResearchSubject=z.infer<typeof subjectSchema>;
export const eventSchema=z.object({id:z.string().max(120),time:finite.min(0),type:z.enum(['enter','exit','approach','retreat','close encounter','encirclement tendency','stationary','rapid motion']),subjects:z.array(z.number().int().positive()).min(1).max(32),confidence,label:z.string().max(200),evidence:z.object({coordinateSystem:z.enum(['image','relative scene']),value:finite,windowSeconds:finite.nonnegative(),description:z.string().max(200)}).optional()});
export type ResearchEvent=z.infer<typeof eventSchema>;
export const researchFrameSchema=z.object({time:finite.min(0),frameIndex:z.number().int().min(0),subjects:z.array(subjectSchema).max(32),rawSubjects:z.array(subjectSchema).max(32).optional(),depthMap:z.object({width:z.number().int().min(1).max(64),height:z.number().int().min(1).max(64),rect:z.tuple([normalized,normalized,normalized,normalized]),values:z.array(confidence).max(4096)}),events:z.array(eventSchema).max(1024),diagnostics:z.object({inferenceMs:finite.min(0),subjects:z.number().int().min(0),missingMasks:z.number().int().min(0)})}).superRefine((frame,ctx)=>{
  if(frame.depthMap.values.length!==frame.depthMap.width*frame.depthMap.height||new Set(frame.subjects.map(subject=>subject.id)).size!==frame.subjects.length)ctx.addIssue({code:'custom',message:'Invalid depth map or duplicate subject IDs'});
});
export type ResearchFrame=z.infer<typeof researchFrameSchema>;
export const researchTrackSchema=z.object({id:z.number().int().positive(),label:z.string().max(80),classConfidence:confidence,firstSeen:finite.min(0),lastSeen:finite.min(0),observations:z.number().int().positive(),quality:z.object({score:confidence,continuity:confidence,meanDetection:confidence,missingSamples:z.number().int().nonnegative(),jumpWarnings:z.number().int().nonnegative(),identitySwitches:z.null()}).optional()});
const point=z.object({x:normalized,y:normalized});
export const researchCalibrationSchema=z.object({sourceId:z.string(),time:finite.nonnegative(),horizon:normalized.nullable(),ground:z.tuple([normalized,normalized,normalized,normalized]).nullable(),a:point.nullable(),b:point.nullable(),metres:finite.positive().max(1000)});
export type ResearchCalibration=z.infer<typeof researchCalibrationSchema>;
const rawFields={frames:z.array(researchFrameSchema).min(1).max(1200),tracks:z.array(researchTrackSchema).max(1024),models:z.record(z.object({id:z.string().max(200),revision:z.string().regex(/^[a-f0-9]{40}$/)})),runtime:z.object({device:z.enum(['cpu','cuda']),seconds:finite.min(0)}),ground:z.object({method:z.string().max(200),focalNormalized:finite.positive(),scale:z.literal('relative scene units')})};
export const rawResearchSchema=z.object(rawFields);
export const researchAnalysisSchema=z.object({
  ...rawFields,schemaVersion:z.literal(1),pipelineVersion:z.literal(RESEARCH_VERSION),id:z.string().regex(/^[a-f0-9]{64}$/),settings:researchSettingsSchema,
  video:z.object({id:z.string().min(1).max(512),name:z.string().max(256),duration:finite.positive().max(120),width:finite.positive(),height:finite.positive(),fps:finite.positive(),size:finite.min(0),mtimeMs:finite.min(0),codec:z.string(),rotation:finite}),
  events:z.array(eventSchema).max(10000),warnings:z.array(z.string().max(300)).max(30),
  refinement:z.object({version:z.literal('temporal-v1'),smoothing:z.enum(['off','low','medium','high']),units:z.enum(['relative scene units','approximate metres']),scale:finite.positive(),calibration:researchCalibrationSchema.nullable()}).optional(),
  sourceHash:z.string().regex(/^[a-f0-9]{64}$/).optional(),
}).superRefine((analysis,ctx)=>{
  const ids=new Set(analysis.tracks.map(track=>track.id));
  if(ids.size!==analysis.tracks.length||analysis.frames.some((frame,i)=>frame.time>analysis.video.duration+.001||(i>0&&frame.time<=analysis.frames[i-1].time)||frame.subjects.some(subject=>!ids.has(subject.id))))ctx.addIssue({code:'custom',message:'Invalid research track identities or source timestamps'});
});
export type ResearchAnalysis=z.infer<typeof researchAnalysisSchema>;
export async function researchIdentity(videoId:string,settings:ResearchSettings){
  const bytes=new TextEncoder().encode(JSON.stringify([videoId,RESEARCH_VERSION,settings.fps,settings.threshold]));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');
}
export function researchIndex(frames:ResearchFrame[],time:number){let lo=0,hi=frames.length;while(lo<hi){const mid=(lo+hi)>>>1;if(frames[mid].time<time)lo=mid+1;else hi=mid;}return lo;}
export function researchFrameAt(analysis:ResearchAnalysis|null,time:number):ResearchFrame|null{
  if(!analysis||!Number.isFinite(time)||time<0||time>analysis.video.duration)return null;const frames=analysis.frames,index=researchIndex(frames,time),left=frames[index-1],right=frames[index];
  const nearest=!left?right:!right?left:time-left.time<right.time-time?left:right;
  return nearest&&Math.abs(nearest.time-time)<=1.1/analysis.settings.fps ? nearest : null;
}
export function pairDistance(a:ResearchSubject,b:ResearchSubject){return {image:Math.hypot(a.center2D.x-b.center2D.x,a.center2D.y-b.center2D.y),scene:a.worldEstimate&&b.worldEstimate?Math.hypot(a.worldEstimate.x-b.worldEstimate.x,a.worldEstimate.y-b.worldEstimate.y,a.worldEstimate.z-b.worldEstimate.z):null};}
export function pairSummary(analysis:ResearchAnalysis,a:number,b:number,start:number,end:number){
  const values=analysis.frames.slice(researchIndex(analysis.frames,start),researchIndex(analysis.frames,end+.00001)).flatMap(frame=>{const x=frame.subjects.find(s=>s.id===a),y=frame.subjects.find(s=>s.id===b);return x&&y?[{time:frame.time,...pairDistance(x,y)}]:[];});
  if(!values.length)return null;
  const closest=values.reduce((best,value)=>value.image<best.image?value:best),sceneValues=values.filter(value=>value.scene!==null);
  return {count:values.length,closestTime:closest.time,min2D:closest.image,mean2D:values.reduce((sum,value)=>sum+value.image,0)/values.length,min3D:sceneValues.length?Math.min(...sceneValues.map(value=>value.scene!)):null,mean3D:sceneValues.length?sceneValues.reduce((sum,value)=>sum+value.scene!,0)/sceneValues.length:null};
}
export function deriveResearchEvents(analysis:Pick<ResearchAnalysis,'frames'|'tracks'|'video'|'settings'>):ResearchEvent[]{
  const events:ResearchEvent[]=[],last=new Map<string,number>(),previous=new Map<string,{time:number;distance:number}>();
  const emit=(type:ResearchEvent['type'],time:number,subjects:number[],score:number,label:string)=>{const key=`${type}:${[...subjects].sort((a,b)=>a-b).join('-')}`;if(time-(last.get(key)??-Infinity)<1)return;last.set(key,time);events.push({id:`${key}:${time.toFixed(3)}`,time,type,subjects,confidence:Math.min(.65,score*.7),label});};
  for(const track of analysis.tracks){emit('enter',track.firstSeen,[track.id],track.classConfidence,'First observed / entry hypothesis');if(track.lastSeen<analysis.video.duration-1/analysis.settings.fps)emit('exit',track.lastSeen,[track.id],track.classConfidence,'Last observed / exit or occlusion hypothesis');}
  for(const frame of analysis.frames){
    for(const subject of frame.subjects){
      if(subject.velocity&&subject.velocity.speed<.12)emit('stationary',frame.time,[subject.id],subject.confidence,'Low estimated scene motion');
      if(subject.velocity&&subject.velocity.speed>3)emit('rapid motion',frame.time,[subject.id],subject.confidence,'High estimated scene motion / camera motion may contribute');
      const angles=frame.subjects.filter(other=>other.id!==subject.id&&pairDistance(subject,other).image<.45).map(other=>Math.atan2(other.center2D.y-subject.center2D.y,other.center2D.x-subject.center2D.x)).sort((a,b)=>a-b);
      if(angles.length>=3){const gaps=angles.map((angle,i)=>(i===angles.length-1?angles[0]+Math.PI*2:angles[i+1])-angle);if(Math.max(...gaps)<Math.PI)emit('encirclement tendency',frame.time,[subject.id],subject.confidence*.5,'Surrounding image-space distribution / not confirmed behavior');}
    }
    for(let i=0;i<frame.subjects.length;i++)for(let j=i+1;j<frame.subjects.length;j++){
      const a=frame.subjects[i],b=frame.subjects[j],distance=pairDistance(a,b).image,key=[a.id,b.id].sort((x,y)=>x-y).join('-'),prior=previous.get(key),score=Math.min(a.confidence,b.confidence);
      if(distance<.12)emit('close encounter',frame.time,[a.id,b.id],score,'Close image-space separation / projection may be misleading');
      if(prior&&frame.time-prior.time<=.65){const change=(distance-prior.distance)/(frame.time-prior.time);if(change<-.025)emit('approach',frame.time,[a.id,b.id],score,'Decreasing image-space separation');if(change>.025)emit('retreat',frame.time,[a.id,b.id],score,'Increasing image-space separation');}
      previous.set(key,{time:frame.time,distance});
    }
  }
  return events.sort((a,b)=>a.time-b.time);
}
export const trackColor=(id:number)=>['#efb556','#65c9df','#d891c5','#92ce81','#ada4e8','#ed8b80'][(id-1)%6];
