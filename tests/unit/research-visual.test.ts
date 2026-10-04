import { describe,it,expect } from 'vitest';
import { researchFixture } from '../fixtures/research.js';
import { densityRange,gaussianDensity,scopedAnalysis,scopedBins,trackGaps,visualQuality } from '../../packages/shared/src/research-visual.js';
describe('display-only research refinement',()=>{
  it('preserves raw density mass including boundary kernels without moving observations',()=>{
    const bins=new Map([['0:0',2],['16:16',3]]),low=gaussianDensity(bins,.65),high=gaussianDensity(bins,2);
    expect(low.total).toBe(5);expect(low.values.reduce((a,b)=>a+b,0)).toBeCloseTo(5,10);
    expect(high.values.reduce((a,b)=>a+b,0)).toBeCloseTo(5,10);
    expect(high.max).toBeLessThan(low.max);expect(bins.size).toBe(2);expect(low.raw[0]).toBe(2);
    expect(gaussianDensity(new Map()).max).toBe(0);
  });
  it('filters actual frame/event samples and leaves the cached object unchanged',async()=>{
    const data=await researchFixture(),before=JSON.stringify(data),range={start:.2,end:.6},scoped=scopedAnalysis(data,range);
    expect(scoped.frames.map(f=>f.time)).toEqual([.2,.4,.6]);
    expect(scoped.events.every(e=>e.time>=.2&&e.time<=.6)).toBe(true);
    expect(scopedBins(data,'top','all',1,null,range).size).toBeGreaterThan(0);
    expect(gaussianDensity(scopedBins(data,'top','all',1,null,range)).total).toBeCloseTo(.8);
    expect(scopedBins(data,'top','all',1,null,{start:.4,end:.4}).size).toBe(0);
    expect(JSON.stringify(data)).toBe(before);
    expect(scopedAnalysis(data,null)).toBe(data);
  });
  it('supports whole, past, recent and shared-range scopes',()=>{
    expect(densityRange(15,8,'clip',2,null)).toEqual({start:0,end:15});
    expect(densityRange(15,8,'past',2,null)).toEqual({start:0,end:8});
    expect(densityRange(15,8,'recent',2,null)).toEqual({start:6,end:8});
    expect(densityRange(15,.2,'recent',2,null)).toEqual({start:0,end:.2});
    expect(densityRange(15,8,'clip',2,{start:4,end:5})).toEqual({start:4,end:5});
  });
  it('separates detection/depth/spatial quality and avoids an image-depth score',async()=>{
    const data=await researchFixture(),s=data.frames[0].subjects[0];
    expect(visualQuality(s,'top')).toEqual({detection:.6,depth:.5,spatial:.5});
    expect(visualQuality(s,'image').spatial).toBeNull();
    expect(visualQuality({...s,depthEstimate:{...s.depthEstimate,confidence:null}},'top').spatial).toBeNull();
  });
  it('labels same-ID observation gaps without claiming verified identity recovery',async()=>{
    const data=await researchFixture();expect(trackGaps(data)).toHaveLength(0);
    data.frames[2].subjects=data.frames[2].subjects.filter(s=>s.id!==1);
    expect(trackGaps(data)).toEqual([{id:1,start:.4,end:.6,recovered:.6}]);
  });
});
