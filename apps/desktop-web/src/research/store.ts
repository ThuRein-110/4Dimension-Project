import { useSyncExternalStore } from 'react';
import type { ResearchAnalysis,ResearchSettings,ResearchCalibration } from '../../../../packages/shared/src/research.js';
import { refineResearch,type Smoothing } from '../../../../packages/shared/src/research-refinement.js';
import type { SpatialMode } from '../../../../packages/shared/src/research-metrics.js';
import type { VideoMetadata } from '../motion/types.js';
export interface ResearchOptions {boxes:boolean;masks:boolean;ids:boolean;labels:boolean;trails2D:boolean;arrows:boolean;interactions:boolean;events:boolean;confidence:boolean;depthMap:boolean;ghosts2D:boolean;floor:boolean;trails3D:boolean;ghosts3D:boolean;labels3D:boolean;uncertainty:boolean;volumes:boolean;frustum:boolean;maskStyle:'outline'|'fill'|'both';fit:'contain'|'cover';history:number;ghostCount:number;ghostInterval:number;composite?:boolean;heatmap?:'off'|'selected'|'cats'|'canines'|'all'|'interaction'|'pair';experimental?:boolean;spatialTrail?:'current'|'past'|'full';heatmapScope?:'clip'|'past'}
export interface ResearchJob {id:string;sourceId:string;status:'running'|'complete'|'cancelled'|'error';stage:string;done:number;total:number;subjects:number;error?:string;cacheHit:boolean}
interface State {metadata:VideoMetadata|null;key:string|null;analysis:ResearchAnalysis|null;job:ResearchJob|null;runtime:boolean|null;error:string;view:'split'|'video'|'3d'|'data';selected:number|null;comparison:number|null;settings:ResearchSettings;options:ResearchOptions}
class ResearchStore {
  private boundId:string|null=null;
  spatial:SpatialMode='auto';smoothing:Smoothing='medium';calibration:ResearchCalibration|null=null;mark:'a'|'b'|'horizon'|'ground-a'|'ground-b'|null=null;groundStart:{x:number;y:number}|null=null;
  private state:State={metadata:null,key:null,analysis:null,job:null,runtime:null,error:'',view:'split',selected:null,comparison:null,settings:{fps:5,threshold:.23},options:{boxes:false,masks:true,ids:true,labels:false,trails2D:true,arrows:false,interactions:true,events:false,confidence:false,depthMap:false,ghosts2D:false,floor:true,trails3D:true,ghosts3D:false,labels3D:true,uncertainty:true,volumes:true,frustum:false,maskStyle:'outline',fit:'contain',history:2,ghostCount:3,ghostInterval:.5,composite:false,heatmap:'all',experimental:false,spatialTrail:'past',heatmapScope:'clip'}};
  private listeners=new Set<()=>void>();
  get=()=>this.state;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>this.listeners.delete(listener);};
  set(patch:Partial<State>){this.state={...this.state,...patch};if(patch.analysis===null)this.state.view='split';if(this.state.comparison===this.state.selected)this.state.comparison=null;this.listeners.forEach(listener=>listener());}
  options(patch:Partial<ResearchOptions>){this.set({options:{...this.state.options,...patch}});}
  load(data:ResearchAnalysis){if(this.calibration?.sourceId!==data.video.id){this.calibration=null;this.mark=null;this.groundStart=null;}const changed=this.boundId!==data.id;this.boundId=data.id;this.set({analysis:refineResearch(data,this.smoothing,this.calibration),selected:!changed&&this.state.selected&&data.tracks.some(track=>track.id===this.state.selected)?this.state.selected:data.tracks[0]?.id??null,...(changed?{comparison:null}:{}),error:''});}
  refine(mode:Smoothing=this.smoothing){this.smoothing=mode;if(this.state.analysis)this.load(this.state.analysis);else this.set({});}
  scene(mode:SpatialMode){this.spatial=mode;this.set({});}
}
export const research=new ResearchStore();
export const useResearch=()=>useSyncExternalStore(research.subscribe,research.get);
