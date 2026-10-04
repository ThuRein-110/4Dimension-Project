import { z } from 'zod';
import type { TimeRange } from '../../../../packages/shared/src/research-visual.js';
import { useSyncExternalStore } from 'react';
import type { ResearchAnalysis,ResearchSettings,ResearchCalibration } from '../../../../packages/shared/src/research.js';
import { refineResearch,type Smoothing } from '../../../../packages/shared/src/research-refinement.js';
import type { SpatialMode } from '../../../../packages/shared/src/research-metrics.js';
import type { VideoMetadata } from '../motion/types.js';
export interface ResearchOptions {boxes:boolean;masks:boolean;ids:boolean;labels:boolean;trails2D:boolean;arrows:boolean;interactions:boolean;events:boolean;confidence:boolean;depthMap:boolean;ghosts2D:boolean;floor:boolean;trails3D:boolean;ghosts3D:boolean;labels3D:boolean;uncertainty:boolean;volumes:boolean;frustum:boolean;maskStyle:'outline'|'fill'|'both';fit:'contain'|'cover';history:number;ghostCount:number;ghostInterval:number;composite?:boolean;heatmap?:'off'|'selected'|'cats'|'canines'|'all'|'interaction'|'pair';experimental?:boolean;spatialTrail?:'current'|'past'|'full';heatmapScope?:'clip'|'past'|'recent'|'range';densitySmoothing?:'low'|'medium'|'high';densityOpacity?:number;temporalWindow?:number;timeMarkers?:boolean;trailFocus?:'selected'|'nearby'|'all';viewport?:'full'|'selected'|'active';centroid?:boolean}
export interface ResearchJob {id:string;sourceId:string;status:'running'|'complete'|'cancelled'|'error';stage:string;done:number;total:number;subjects:number;error?:string;cacheHit:boolean}
const noteSchema=z.object({id:z.string().max(100),time:z.number().finite().nonnegative(),text:z.string().min(1).max(200),kind:z.enum(['note','bookmark'])});
export type ResearchNote=z.infer<typeof noteSchema>;
interface State {presentation:boolean;range:TimeRange|null;notes:ResearchNote[];metadata:VideoMetadata|null;key:string|null;analysis:ResearchAnalysis|null;job:ResearchJob|null;runtime:boolean|null;error:string;view:'split'|'video'|'3d'|'data';selected:number|null;comparison:number|null;settings:ResearchSettings;options:ResearchOptions}
class ResearchStore {
  private boundId:string|null=null;
  spatial:SpatialMode='auto';smoothing:Smoothing='medium';calibration:ResearchCalibration|null=null;mark:'a'|'b'|'horizon'|'ground-a'|'ground-b'|null=null;groundStart:{x:number;y:number}|null=null;
  private state:State={presentation:false,range:null,notes:[],metadata:null,key:null,analysis:null,job:null,runtime:null,error:'',view:'split',selected:null,comparison:null,settings:{fps:5,threshold:.23},options:{boxes:false,masks:true,ids:true,labels:false,trails2D:true,arrows:false,interactions:true,events:false,confidence:false,depthMap:false,ghosts2D:false,floor:true,trails3D:true,ghosts3D:false,labels3D:true,uncertainty:true,volumes:true,frustum:false,maskStyle:'outline',fit:'contain',history:2,ghostCount:3,ghostInterval:.5,composite:false,heatmap:'all',experimental:false,spatialTrail:'past',heatmapScope:'clip',densitySmoothing:'medium',densityOpacity:.5,temporalWindow:0,timeMarkers:true,trailFocus:'nearby',viewport:'full',centroid:false}};
  private listeners=new Set<()=>void>();
  get=()=>this.state;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>this.listeners.delete(listener);};
  set(patch:Partial<State>){if(patch.metadata&&patch.metadata.id!==this.state.metadata?.id){patch.range=null;try{const parsed=z.array(noteSchema).max(500).safeParse(JSON.parse(localStorage.getItem('research-notes:'+patch.metadata.id)??'[]'));patch.notes=parsed.success?parsed.data:[];}catch{patch.notes=[];}}this.state={...this.state,...patch};if(patch.analysis===null)this.state.view='split';if(this.state.comparison===this.state.selected)this.state.comparison=null;this.listeners.forEach(listener=>listener());}
  annotate(time:number,text:string,kind:ResearchNote['kind']){if(!this.state.metadata||!text.trim()||!Number.isFinite(time))return;time=Math.max(0,Math.min(this.state.metadata.duration,time));this.set({notes:[...this.state.notes,{id:crypto.randomUUID(),time,text:text.trim().slice(0,200),kind}].slice(-500)});this.saveNotes();}
  removeNote(id:string){this.set({notes:this.state.notes.filter(n=>n.id!==id)});this.saveNotes();}
  private saveNotes(){try{localStorage.setItem('research-notes:'+this.state.metadata?.id,JSON.stringify(this.state.notes));}catch{/* Viewer annotations still work when storage is blocked. */}}
  range(value:TimeRange|null){const duration=this.state.metadata?.duration??0;if(value&&(!Number.isFinite(value.start)||!Number.isFinite(value.end)))return;const start=Math.max(0,Math.min(duration,value?.start??0));this.set({range:value?{start,end:Math.max(start,Math.min(duration,value.end))}:null});}
  options(patch:Partial<ResearchOptions>){this.set({options:{...this.state.options,...patch}});}
  load(data:ResearchAnalysis){if(this.calibration?.sourceId!==data.video.id){this.calibration=null;this.mark=null;this.groundStart=null;}const changed=this.boundId!==data.id;this.boundId=data.id;this.set({analysis:refineResearch(data,this.smoothing,this.calibration),selected:!changed&&this.state.selected&&data.tracks.some(track=>track.id===this.state.selected)?this.state.selected:data.tracks[0]?.id??null,...(changed?{comparison:null}:{}),error:''});}
  refine(mode:Smoothing=this.smoothing){this.smoothing=mode;if(this.state.analysis)this.load(this.state.analysis);else this.set({});}
  scene(mode:SpatialMode){this.spatial=mode;this.set({});}
}
export const research=new ResearchStore();
export const useResearch=()=>useSyncExternalStore(research.subscribe,research.get);
