import type { ResearchAnalysis,ResearchSubject } from './research.js';
import { occupancyBins,spatialBounds,type HeatMode } from './research-spatial.js';
import type { SpatialMode } from './research-metrics.js';

export type TimeRange={start:number;end:number};
export type DensityScope='clip'|'past'|'recent'|'range';
export function scopedAnalysis(data:ResearchAnalysis,range:TimeRange|null){return range?{...data,frames:data.frames.filter(f=>f.time>=range.start&&f.time<=range.end),events:data.events.filter(e=>e.time>=range.start&&e.time<=range.end)}:data;}
export function densityRange(duration:number,time:number,scope:DensityScope,window:number,range:TimeRange|null):TimeRange{
  if(range)return range;
  if(scope==='recent')return {start:Math.max(0,time-window),end:Math.min(duration,time)};
  return {start:0,end:scope==='past'?Math.min(duration,time):duration};
}
export function visualQuality(s:ResearchSubject,mode:SpatialMode){return {detection:s.confidence,depth:s.depthEstimate.confidence,spatial:mode==='image'?null:s.depthEstimate.confidence===null?null:Math.min(s.confidence,s.depthEstimate.confidence)};}
export function scopedBins(data:ResearchAnalysis,mode:SpatialMode,heat:HeatMode,selected:number|null,comparison:number|null,range:TimeRange,box=spatialBounds(data,mode)){
  const scoped={...data,video:{...data.video,duration:Math.min(data.video.duration,range.end)},frames:data.frames.filter(f=>f.time>=range.start&&f.time<=range.end)};
  return new Map([...occupancyBins(scoped,mode,heat,selected,comparison,range.end,box)].filter(([,weight])=>weight>0));
}
/** Display-only Gaussian convolution preserves total raw-bin mass, not positions. */
export function gaussianDensity(bins:Map<string,number>,sigma=1.2,size=32){
  const raw=new Float64Array(size*size);for(const [key,value] of bins){const [x,y]=key.split(':').map(Number);if(x>=0&&x<size&&y>=0&&y<size)raw[y*size+x]+=value;}
  const result=new Float64Array(raw.length),radius=Math.ceil(sigma*3);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const value=raw[y*size+x];if(!value)continue;let weight=0;
    for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++)if(x+dx>=0&&x+dx<size&&y+dy>=0&&y+dy<size)weight+=Math.exp(-(dx*dx+dy*dy)/(2*sigma*sigma));
    for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++)if(x+dx>=0&&x+dx<size&&y+dy>=0&&y+dy<size)result[(y+dy)*size+x+dx]+=value*Math.exp(-(dx*dx+dy*dy)/(2*sigma*sigma))/weight;
  }return {raw,values:result,max:Math.max(0,...result),total:raw.reduce((sum,v)=>sum+v,0)};
}
export function trackGaps(data:ResearchAnalysis){const gaps:Array<{id:number;start:number;end:number;recovered:number}>=[];for(const track of data.tracks){const times=data.frames.filter(f=>f.subjects.some(s=>s.id===track.id)).map(f=>f.time);for(let i=1;i<times.length;i++)if(times[i]-times[i-1]>1.5/data.settings.fps)gaps.push({id:track.id,start:times[i-1]+1/data.settings.fps,end:times[i],recovered:times[i]});}return gaps;}
