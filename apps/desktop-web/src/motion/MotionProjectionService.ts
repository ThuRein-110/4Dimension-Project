import { contentRect } from '../../../../packages/three-engine/src/CameraProjectionManager.js';
import { jointAt, sampleAt, type MotionAnalysis, type MotionDisplay, type MotionPoseSample } from '../../../../packages/shared/src/motion.js';

/** Input landmarks refer to the upright decoded image, never a second rotation or mirror. */
export class MotionProjectionService {
  readonly rect;
  constructor(public width: number, public height: number, videoWidth: number, videoHeight: number, fit: 'contain'|'cover') {
    this.rect = contentRect(width,height,videoWidth,videoHeight,fit);
  }
  project(point: {x:number;y:number}) { return { x:this.rect.x+point.x*this.rect.width,y:this.rect.y+point.y*this.rect.height }; }
  inverse(point: {x:number;y:number}) {
    const x=(point.x-this.rect.x)/this.rect.width,y=(point.y-this.rect.y)/this.rect.height;
    return x>=0 && x<=1 && y>=0 && y<=1 ? {x,y} : null;
  }
  joint(sample:MotionPoseSample|null,id:number) { const point=jointAt(sample,id,false);return point ? this.project(point) : null; }
}
export function timeIndex(samples:MotionPoseSample[],time:number) {
  let lo=0,hi=samples.length;
  while(lo<hi) { const mid=(lo+hi)>>>1;if(samples[mid].timeSeconds<time)lo=mid+1;else hi=mid; }
  return lo;
}
export function ghostTimes(time:number,count:number,interval:number) {
  return Array.from({length:count},(_,i)=>time-(count-i)*interval).filter(t=>t>=0);
}
export const trailJoints = (choice:MotionDisplay['trailJoint']) => ({left:[15],right:[16],wrists:[15,16],elbows:[13,14],head:[0],hips:[33]})[choice];
export function trailRange(samples:MotionPoseSample[],time:number,window:number,future:boolean) {
  return [timeIndex(samples,window ? Math.max(0,time-window) : 0),future ? samples.length : timeIndex(samples,time+.000001)] as const;
}
export function compositePoses(data:MotionAnalysis,keyframesOnly:boolean) {
  const key=keyframesOnly ? data.keyframes : data.samples;
  const cached=composites.get(key);if(cached?.samples===data.samples)return cached.poses;
  const poses=resolveComposite(data,keyframesOnly);composites.set(key,{samples:data.samples,poses});return poses;
}
const composites=new WeakMap<object,{samples:MotionPoseSample[];poses:Array<{pose:MotionPoseSample;label:string}>}>();
function resolveComposite(data:MotionAnalysis,keyframesOnly:boolean) {
  if(keyframesOnly) return data.keyframes.flatMap(frame=>{ const pose=sampleAt(data.samples,frame.timeSeconds);return pose ? [{pose,label:`${frame.name} / T ${frame.timeSeconds.toFixed(2)}s`}] : []; });
  const valid=data.samples.filter(pose=>pose.valid);
  const count=Math.min(6,valid.length);
  return Array.from({length:count},(_,i)=>valid[Math.round(i*(valid.length-1)/Math.max(1,count-1))]).map(pose=>({pose,label:`T ${pose.timeSeconds.toFixed(2)}s`}));
}
