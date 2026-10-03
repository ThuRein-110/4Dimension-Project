import { deriveResearchEvents,researchAnalysisSchema,researchIdentity,RESEARCH_VERSION,type ResearchSubject } from '../../packages/shared/src/research.js';

// Synthetic test data only. Production inference never imports this fixture.
export const fixtureSubject=(id:number,time:number):ResearchSubject=>({id,classLabel:'animal_unknown',classConfidence:.5,bbox:[id===1?.2+time*.1:.6-time*.1,.3,.15,.2],mask:[[[.2,.3],[.35,.3],[.35,.5],[.2,.5]]],maskConfidence:.9,center2D:{x:id===1?.275+time*.1:.675-time*.1,y:.4},depthEstimate:{value:4,confidence:.5,method:'CI relative depth fixture'},worldEstimate:{x:id===1?time:2-time,y:.5,z:4},volume:{length:1,height:1,width:.5,confidence:.3},heading:time?0:null,velocity:time?{x:id===1?1:-1,y:0,z:0,speed:1}:null,acceleration:time?0:null,visibility:1,confidence:.6,stateFlags:['observed']});
export async function researchFixture(videoId='a'.repeat(64)){
  const settings={fps:5 as const,threshold:.23},id=await researchIdentity(videoId,settings);
  const frames=[0,.2,.4,.6,.8].map((time,index)=>({time,frameIndex:index*2,subjects:[fixtureSubject(1,time),fixtureSubject(2,time)],depthMap:{width:1,height:1,rect:[0,0,1,1],values:[.5]},events:[],diagnostics:{inferenceMs:10,subjects:2,missingMasks:0}}));
  const base=researchAnalysisSchema.parse({schemaVersion:1,pipelineVersion:RESEARCH_VERSION,id,settings,video:{id:videoId,name:'CI synthetic research video.mp4',duration:1,width:160,height:240,fps:10,size:100,mtimeMs:1,codec:'h264',rotation:0},frames,tracks:[1,2].map(id=>({id,label:'animal_unknown',classConfidence:.5,firstSeen:0,lastSeen:.8,observations:5})),models:{detector:{id:'CI synthetic fixture, not a model',revision:'a'.repeat(40)}},runtime:{device:'cpu',seconds:1},ground:{method:'CI assumed ground',focalNormalized:.9,scale:'relative scene units'},events:[],warnings:['CI fixture only / not real animal results']});
  return {...base,events:deriveResearchEvents(base)};
}
