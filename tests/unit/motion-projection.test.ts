import { describe,it,expect } from 'vitest';
import { defaultDisplay,displaySchema,LANDMARK_NAMES,type MotionAnalysis,type MotionPoseSample } from '../../packages/shared/src/motion.js';
import { compositePoses,ghostTimes,MotionProjectionService,trailRange } from '../../apps/desktop-web/src/motion/MotionProjectionService.js';
import { renderMotionOverlay } from '../../apps/desktop-web/src/motion/MotionOverlayRenderer.js';

const pose=(timeSeconds:number,valid=true):MotionPoseSample=>({timeSeconds,frameIndex:Math.round(timeSeconds*10),valid,poseConfidence:.9,inferenceMs:1,landmarks2D:LANDMARK_NAMES.map((name,id)=>({id,name,x:.2+timeSeconds*.1,y:.5,z:timeSeconds,visibility:.9}))});
const samples=[pose(0),pose(.1),pose(.2,false),pose(.3),pose(.4)];
describe('source image projection and real temporal overlays',()=>{
  it('maps portrait Fit with letterboxing, no second orientation or mirroring',()=>{
    const p=new MotionProjectionService(1000,500,250,500,'contain');
    expect(p.project({x:0,y:0})).toEqual({x:375,y:0});expect(p.project({x:1,y:1})).toEqual({x:625,y:500});
    expect(p.inverse({x:375,y:0})).toEqual({x:0,y:0});expect(p.inverse({x:200,y:0})).toBeNull();
    expect(p.joint(pose(0),16)).toEqual({x:425,y:250});
  });
  it('maps Fill cropping and round-trips normalized clicks after resize',()=>{
    for(const [w,h] of [[1000,500],[390,500]]){const p=new MotionProjectionService(w,h,250,500,'cover');const source={x:.3,y:.4};expect(p.inverse(p.project(source))!.x).toBeCloseTo(source.x);expect(p.rect.width).toBe(w);expect(p.rect.y).toBeLessThan(0);}
  });
  it('selects past ghost timestamps only, without wrapping before the video',()=>{
    expect(ghostTimes(1,4,.15)).toEqual([.4,.55,.7,.85]);expect(ghostTimes(.2,4,.15)).toEqual([.05000000000000002]);
  });
  it('filters full and recent histories without revealing future samples',()=>{
    expect(trailRange(samples,.3,0,false)).toEqual([0,4]);expect(trailRange(samples,.3,.1,false)).toEqual([2,4]);expect(trailRange(samples,.3,0,true)).toEqual([0,5]);
  });
  it('resolves manual keyframes from real nearby samples, not missing gaps',()=>{
    const data={samples,keyframes:[{id:'x',name:'Top',timeSeconds:.35},{id:'y',name:'Impact',timeSeconds:.15}]} as MotionAnalysis;
    expect(compositePoses(data,true)).toHaveLength(1);expect(compositePoses(data,true)[0].pose.timeSeconds).toBe(.35);expect(compositePoses(data,true)[0].label).toContain('Top');
    expect(compositePoses(data,false).every(frame=>samples.includes(frame.pose))).toBe(true);
  });
  it('migrates old display preferences but preserves new saved choices',()=>{
    const old={...defaultDisplay,view:'split',ghosts:false,trailWindow:1} as Record<string,unknown>;delete old.visualizationVersion;
    expect(displaySchema.parse(old)).toMatchObject({view:'4d',ghosts:true,ghostCount:4,ghostInterval:.15,trailWindow:0});
    expect(displaySchema.parse({...defaultDisplay,view:'split',ghosts:false}).view).toBe('split');
  });
  it('does not bridge missing trails and retains historical timestamps and bounded cards',()=>{
    const lines:number[][]=[];let start:number[]=[];
    const ctx=new Proxy({moveTo:(x:number,y:number)=>{start=[x,y];},lineTo:(x:number,y:number)=>{lines.push([...start,x,y]);}}, {get:(target,key)=>key in target?target[key as keyof typeof target]:()=>{}}) as unknown as CanvasRenderingContext2D;
    const data={samples,keyframes:[],club:[],analysis:{fps:10}} as unknown as MotionAnalysis;
    const options={...defaultDisplay,skeleton:false,ghosts:false,landmarks:false,depth:false};
    const result=renderMotionOverlay(ctx,new MotionProjectionService(390,400,250,500,'contain'),data,options,.4,{joint:16,time:.1,hidden:false,offset:{x:3,y:3}});
    expect(lines).toHaveLength(4);expect(result.hits.some(hit=>hit.time===.1)).toBe(true);expect(result.information).toContain('T 0.100');expect(result.card!.x+result.card!.width).toBeLessThanOrEqual(390);expect(result.card!.y+result.card!.height).toBeLessThan(400);
  });
  it('keeps low-confidence joint information visible without asserting unreliable XYZ',()=>{
    const low=pose(0);low.landmarks2D[16].visibility=.2;
    const ctx=new Proxy({}, {get:()=>()=>{}}) as CanvasRenderingContext2D;
    const data={samples:[low],keyframes:[],club:[],analysis:{fps:10,landmarkNames:[...LANDMARK_NAMES]}} as unknown as MotionAnalysis;
    const result=renderMotionOverlay(ctx,new MotionProjectionService(390,400,250,500,'contain'),data,defaultDisplay,0,{joint:16,time:null,hidden:false,offset:{x:0,y:0}});
    expect(result.information).toContain('Coordinates unavailable');expect(result.information).toContain('Confidence 20%');expect(result.card).not.toBeNull();
  });
});
