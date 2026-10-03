import { describe,it,expect,vi } from 'vitest';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fixtureSubject,researchFixture } from '../fixtures/research.js';
import { deriveResearchEvents,pairDistance,pairSummary,researchAnalysisSchema,researchFrameAt,researchIdentity,trackColor } from '../../packages/shared/src/research.js';
import { ResearchService } from '../../apps/server/src/research/service.js';
import { VideoPreparationService } from '../../apps/server/src/motion/video-service.js';

describe('research estimates and source-bound cache',()=>{
  it('invalidates identity for source, versioned settings and sample rate',async()=>{
    const settings={fps:5 as const,threshold:.23};expect(await researchIdentity('source-A',settings)).not.toBe(await researchIdentity('source-B',settings));expect(await researchIdentity('source-A',settings)).not.toBe(await researchIdentity('source-A',{...settings,fps:3}));expect(await researchIdentity('source-A',settings)).not.toBe(await researchIdentity('source-A',{...settings,threshold:.3}));
  });
  it('resolves actual samples and refuses extrapolation or large missing gaps',async()=>{
    const data=await researchFixture();expect(researchFrameAt(data,.21)?.time).toBe(.2);expect(researchFrameAt(data,4)).toBeNull();expect(researchFrameAt(data,-.01)).toBeNull();expect(researchFrameAt(data,NaN)).toBeNull();const missing={...data,frames:[data.frames[0],{...data.frames[1],time:.8}]};expect(researchFrameAt(missing,.4)).toBeNull();
  });
  it('computes normalized 2D and estimated 3D separations without asserting metres',()=>{
    const a=fixtureSubject(1,0),b=fixtureSubject(2,0);expect(pairDistance(a,b).image).toBeCloseTo(.4);expect(pairDistance(a,b).scene).toBe(2);expect(pairDistance({...a,worldEstimate:null},b).scene).toBeNull();
  });
  it('filters interval distance statistics and skips missing paired observations',async()=>{
    const data=await researchFixture(),summary=pairSummary(data,1,2,.2,.6)!;expect(summary.count).toBe(3);expect(summary.closestTime).toBe(.6);expect(summary.min3D).toBeCloseTo(.8);expect(pairSummary(data,1,99,0,1)).toBeNull();
  });
  it('produces cautious kinematic events and throttles repeated pair hypotheses',async()=>{
    const data=await researchFixture(),events=deriveResearchEvents(data);expect(events.some(event=>event.type==='approach')).toBe(true);expect(events.filter(event=>event.type==='enter')).toHaveLength(2);expect(events.filter(event=>event.type==='approach')).toHaveLength(1);expect(events.every(event=>event.confidence<=.65)).toBe(true);
  });
  it('does not infer approach across an observation gap',async()=>{
    const data=await researchFixture();const events=deriveResearchEvents({...data,frames:[data.frames[0],{...data.frames[4],time:3}]});expect(events.some(event=>event.type==='approach')).toBe(false);
  });
  it('rejects stale schemas, duplicate frame IDs, nonfinite estimates and invalid masks',async()=>{
    const data=await researchFixture();expect(researchAnalysisSchema.safeParse({...data,pipelineVersion:'human-pose'}).success).toBe(false);expect(researchAnalysisSchema.safeParse({...data,frames:[{...data.frames[0],subjects:[data.frames[0].subjects[0],data.frames[0].subjects[0]]}]}).success).toBe(false);expect(researchAnalysisSchema.safeParse({...data,frames:[{...data.frames[0],subjects:[{...data.frames[0].subjects[0],mask:[[[2,0],[0,1],[1,1]]]}]}]}).success).toBe(false);
  });
  it('retains explicit unknown classification, missing-depth and missing-mask states',async()=>{
    const data=await researchFixture();const subject={...data.frames[0].subjects[0],worldEstimate:null,mask:[],maskConfidence:null,depthEstimate:{...data.frames[0].subjects[0].depthEstimate,value:null,confidence:null}};expect(researchAnalysisSchema.parse({...data,frames:[{...data.frames[0],subjects:[subject]}]}).frames[0].subjects[0].classLabel).toBe('animal_unknown');expect(trackColor(1)).not.toBe(trackColor(2));
  });
  it('validates disk identities and never accepts arbitrary media paths',async()=>{
    const root=await mkdtemp(join(tmpdir(),'research-unit-')),service=new ResearchService(new VideoPreparationService(root,root),root,join(root,'missing-python'));
    try{const data=await researchFixture();await writeFile(join(root,`${data.id}.json`),JSON.stringify(data));expect((await service.load(data.id)).id).toBe(data.id);await writeFile(join(root,`${'b'.repeat(64)}.json`),JSON.stringify(data));await expect(service.load('b'.repeat(64))).rejects.toThrow('identity');expect(await service.available()).toBe(false);expect(()=>service.mediaService('../../')).toThrow('identity');await expect(service.upload(Buffer.from('not video'),'../private.mp4')).rejects.toThrow();}finally{await rm(root,{recursive:true,force:true});}
  });
  it('rejects changed sources before spawning an inference process',async()=>{
    const service=new ResearchService();vi.spyOn(service,'mediaInfo').mockResolvedValue({id:'a'.repeat(64),status:'ready',duration:1} as Awaited<ReturnType<typeof service.mediaInfo>>);await expect(service.start('b'.repeat(64),{fps:5,threshold:.23})).rejects.toThrow('Source changed');vi.restoreAllMocks();
  });
});
