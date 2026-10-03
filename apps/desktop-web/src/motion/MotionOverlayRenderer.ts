import { CONNECTIONS, estimatedVelocity, jointAt, sampleAt, spatialJointAt, toThree, type MotionAnalysis, type MotionDisplay, type MotionPoseSample } from '../../../../packages/shared/src/motion.js';
import { compositePoses, ghostTimes, MotionProjectionService, timeIndex, trailJoints, trailRange } from './MotionProjectionService.js';

export interface OverlaySelection { joint:number; time:number|null; hidden:boolean; offset:{x:number;y:number} }
export interface OverlayHit { x:number;y:number;joint:number;time:number|null }
export interface OverlayFrame { hits:OverlayHit[]; card:{x:number;y:number;width:number;height:number}|null; information:string; poseVisible:boolean }
type Track = Array<ReturnType<typeof jointAt>>;
const tracks = new WeakMap<MotionPoseSample[],Map<number,Track>>();
function trackFor(samples:MotionPoseSample[],id:number) {
  let map=tracks.get(samples);if(!map){map=new Map();tracks.set(samples,map);}
  let track=map.get(id);if(!track){track=samples.map(pose=>jointAt(pose,id,false));map.set(id,track);}return track;
}
const color = (id:number) => id%2 ? '#f9ba68' : '#7fc5ff';

/** Live canvas and PNG export share this renderer and source-image projection. */
export function renderMotionOverlay(ctx:CanvasRenderingContext2D,projection:MotionProjectionService,data:MotionAnalysis|null,options:MotionDisplay,time:number,selection:OverlaySelection):OverlayFrame {
  const {width,height}=projection,hits:OverlayHit[]=[];
  ctx.clearRect(0,0,width,height);ctx.save();ctx.beginPath();ctx.rect(0,0,width,height);ctx.clip();
  const current=data ? sampleAt(data.samples,time) : null;
  const pose=(sample:MotionPoseSample|null,alpha:number,labels=false)=>{
    if(!sample)return;
    ctx.globalAlpha=alpha;ctx.lineWidth=alpha===1?2.4:1.5;ctx.strokeStyle='#6ee7b7';
    if(options.skeleton)for(const [a,b] of CONNECTIONS){const p=projection.joint(sample,a),q=projection.joint(sample,b);if(!p||!q)continue;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();}
    for(let id=0;id<33;id++){
      const point=jointAt(sample,id,false);if(!point)continue;const p=projection.project(point);
      const depth=spatialJointAt(sample,id)?.z ?? 0;
      if(options.landmarks){ctx.fillStyle=color(id);ctx.beginPath();ctx.arc(p.x,p.y,options.depth?Math.max(2,Math.min(4,3-depth*.8)):3,0,Math.PI*2);ctx.fill();}
      if(labels&&(options.labels||options.confidence)){ctx.font='10px sans-serif';ctx.fillStyle='#fff';ctx.fillText(`${options.labels?point.name:''}${options.confidence?` ${(point.visibility*100).toFixed(0)}%`:''}`,p.x+5,p.y-4);}
    }
    ctx.globalAlpha=1;
  };
  if(data&&(options.composite||options.keyframePoses)) {
    const composites=[...(options.composite?compositePoses(data,false):[]),...(options.keyframePoses?compositePoses(data,true):[])];
    composites.forEach(({pose:sample,label},i)=>{pose(sample,.18);if(i<Math.min(12,Math.floor((height-70)/18))){ctx.fillStyle='rgba(8,10,13,.85)';ctx.fillRect(8,8+i*18,Math.min(235,width-16),18);ctx.font='11px sans-serif';ctx.fillStyle='#c7b9ef';ctx.fillText(label,12,21+i*18,width-24);}});
  }
  if(data&&options.ghosts)ghostTimes(time,Math.min(5,options.ghostCount),options.ghostInterval).forEach((t,i,list)=>pose(sampleAt(data.samples,t),.08+.26*(i+1)/list.length));
  if(data&&options.trails){
    const [start,end]=trailRange(data.samples,time,options.trailWindow,options.future);
    for(const id of trailJoints(options.trailJoint)){
      const track=trackFor(data.samples,id);ctx.strokeStyle=color(id);ctx.fillStyle=color(id);ctx.lineWidth=2;
      for(let i=start;i<end;i++){
        const point=track[i];if(!point)continue;const p=projection.project(point),timestamp=data.samples[i].timeSeconds;
        hits.push({...p,joint:id,time:timestamp});
        ctx.globalAlpha=.15+.65*(i-start+1)/Math.max(1,end-start);
        const previous=i>start?track[i-1]:null;
        if(previous&&timestamp-data.samples[i-1].timeSeconds<=.2){const q=projection.project(previous);ctx.beginPath();ctx.moveTo(q.x,q.y);ctx.lineTo(p.x,p.y);ctx.stroke();}
        if(options.timeDots&&i%Math.max(1,Math.round(data.analysis.fps*.2))===0){ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fill();ctx.font='10px sans-serif';ctx.fillText(`T ${timestamp.toFixed(2)}`,p.x+5,p.y+10);}
      }
      ctx.globalAlpha=1;const now=projection.joint(current,id);if(now){ctx.beginPath();ctx.arc(now.x,now.y,5,0,Math.PI*2);ctx.fill();if(options.timeDots){ctx.font='10px sans-serif';ctx.fillText('NOW',now.x+7,now.y);}}
    }
  }
  pose(current,1,true);
  if(current)for(let id=0;id<=33;id++){const p=projection.joint(current,id);if(p)hits.push({...p,joint:id,time:null});}
  if(data?.club.length){ctx.strokeStyle='#ff7f9e';ctx.lineWidth=2;ctx.beginPath();let started=false;for(const point of data.club){if(!options.future&&point.timeSeconds>time)break;const p=projection.project(point);if(started)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);started=true;}ctx.stroke();}
  const selectedTime=selection.time ?? time,selected=data?sampleAt(data.samples,selectedTime):null;
  const point=spatialJointAt(selected,selection.joint),anchor=projection.joint(selected,selection.joint);
  let card:OverlayFrame['card']=null,information='Joint unavailable at this time';
  if(data&&point&&anchor){
    const xyz=toThree(point);
    const index=Math.min(data.samples.length-1,timeIndex(data.samples,selectedTime)),speed=estimatedVelocity(data.samples,index,selection.joint);
    information=`${point.name} / X ${xyz.x.toFixed(3)} / Y ${xyz.y.toFixed(3)} / Z ${xyz.z.toFixed(3)} / T ${selectedTime.toFixed(3)} s / Estimated velocity ${speed===null?'unavailable':speed.toFixed(2)+' model units/s'} / Confidence ${(point.visibility*100).toFixed(0)}%`;
    ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(anchor.x,anchor.y,7,0,Math.PI*2);ctx.stroke();
    if(options.depth){
      const earlier=spatialJointAt(sampleAt(data.samples,selectedTime-.1),selection.joint);
      if(earlier){const dz=point.z-earlier.z,dy=-Math.sign(dz)*Math.min(28,Math.abs(dz)*200);ctx.strokeStyle='#d1a8ff';ctx.beginPath();ctx.moveTo(anchor.x,anchor.y);ctx.lineTo(anchor.x+18,anchor.y+dy);ctx.lineTo(anchor.x+13,anchor.y+dy+Math.sign(dz)*5);ctx.stroke();ctx.font='10px sans-serif';ctx.fillStyle='#e4caff';ctx.fillText(Math.abs(dz)<.002?'Z stable':dz<0?'Z toward':'Z away',anchor.x+22,anchor.y+dy);}
    }
    if(!selection.hidden){
      const w=Math.min(218,width-16),h=132,x=Math.max(8,Math.min(width-w-8,anchor.x+16+selection.offset.x*width)),y=Math.max(8,Math.min(height-h-58,anchor.y+12+selection.offset.y*height));card={x,y,width:w,height:h};
      ctx.fillStyle='rgba(17,19,24,.92)';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#566273';ctx.strokeRect(x,y,w,h);ctx.font='bold 12px sans-serif';ctx.fillStyle='#fff';ctx.fillText(point.name+(selection.time!==null?' / history':''),x+10,y+20,w-20);
      ctx.font='12px monospace';[`X ${xyz.x.toFixed(3)}   Y ${xyz.y.toFixed(3)}`,`Z ${xyz.z.toFixed(3)}   T ${selectedTime.toFixed(3)}s`,`Velocity ${speed===null?'N/A':speed.toFixed(2)} model units/s`,`Confidence ${(point.visibility*100).toFixed(0)}%`,selected?.worldLandmarks?.length?'Estimated / hip-relative':'Estimated / normalized'].forEach((line,i)=>ctx.fillText(line,x+10,y+42+i*18,w-20));
    }
  }
  if(data&&(!point||!anchor)){
    const name=selection.joint===33?'Hip center':data.analysis.landmarkNames[selection.joint],confidence=selected?.landmarks2D[selection.joint]?.visibility;
    information=`${name} / T ${selectedTime.toFixed(3)} s / Coordinates unavailable${confidence===undefined?'':` / Confidence ${(confidence*100).toFixed(0)}%`}`;
    if(!selection.hidden){const w=Math.min(218,width-16),h=96,x=Math.max(8,Math.min(width-w-8,width-w-16+selection.offset.x*width)),y=Math.max(8,Math.min(height-h-58,16+selection.offset.y*height));card={x,y,width:w,height:h};ctx.fillStyle='rgba(17,19,24,.92)';ctx.fillRect(x,y,w,h);ctx.fillStyle='#e5e8ef';ctx.font='12px sans-serif';[name,`T ${selectedTime.toFixed(3)} s / XYZ unavailable`,confidence===undefined?'Pose missing at this time':`Confidence ${(confidence*100).toFixed(0)}% / below threshold`,'No reliable joint estimate'].forEach((line,i)=>ctx.fillText(line,x+10,y+20+i*21,w-20));}
  }
  ctx.globalAlpha=1;ctx.fillStyle='rgba(8,10,13,.85)';ctx.fillRect(0,height-48,width,48);ctx.fillStyle='#cbd3df';ctx.font='11px sans-serif';ctx.fillText('X Horizontal / Y Vertical / Z Estimated depth / T Time',10,height-29,width-20);ctx.fillText(`Monocular estimate / T ${time.toFixed(3)} s${data&&!current?' / Pose unavailable':''}`,10,height-11,width-20);
  if(options.axes){ctx.strokeStyle='#ff7f9e';ctx.beginPath();ctx.moveTo(20,40);ctx.lineTo(65,40);ctx.stroke();ctx.strokeStyle='#6ee7b7';ctx.beginPath();ctx.moveTo(20,40);ctx.lineTo(20,85);ctx.stroke();ctx.fillStyle='#fff';ctx.fillText('X',69,43);ctx.fillText('Y',16,98);}
  ctx.restore();return {hits,card,information,poseVisible:!!current};
}
