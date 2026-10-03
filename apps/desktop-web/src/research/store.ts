import { useSyncExternalStore } from 'react';
import type { ResearchAnalysis,ResearchSettings } from '../../../../packages/shared/src/research.js';
import type { VideoMetadata } from '../motion/types.js';
export interface ResearchOptions {boxes:boolean;masks:boolean;ids:boolean;labels:boolean;trails2D:boolean;arrows:boolean;interactions:boolean;events:boolean;confidence:boolean;depthMap:boolean;ghosts2D:boolean;floor:boolean;trails3D:boolean;ghosts3D:boolean;labels3D:boolean;uncertainty:boolean;volumes:boolean;frustum:boolean;maskStyle:'outline'|'fill'|'both';fit:'contain'|'cover';history:number;ghostCount:number;ghostInterval:number}
export interface ResearchJob {id:string;sourceId:string;status:'running'|'complete'|'cancelled'|'error';stage:string;done:number;total:number;subjects:number;error?:string;cacheHit:boolean}
interface State {metadata:VideoMetadata|null;key:string|null;analysis:ResearchAnalysis|null;job:ResearchJob|null;runtime:boolean|null;error:string;view:'split'|'video'|'3d'|'data';selected:number|null;comparison:number|null;settings:ResearchSettings;options:ResearchOptions}
class ResearchStore {
  private state:State={metadata:null,key:null,analysis:null,job:null,runtime:null,error:'',view:'split',selected:null,comparison:null,settings:{fps:5,threshold:.23},options:{boxes:true,masks:true,ids:true,labels:true,trails2D:true,arrows:true,interactions:false,events:true,confidence:false,depthMap:false,ghosts2D:false,floor:true,trails3D:true,ghosts3D:true,labels3D:false,uncertainty:true,volumes:true,frustum:true,maskStyle:'outline',fit:'contain',history:0,ghostCount:3,ghostInterval:.5}};
  private listeners=new Set<()=>void>();
  get=()=>this.state;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>this.listeners.delete(listener);};
  set(patch:Partial<State>){this.state={...this.state,...patch};if(this.state.comparison===this.state.selected)this.state.comparison=null;this.listeners.forEach(listener=>listener());}
  options(patch:Partial<ResearchOptions>){this.set({options:{...this.state.options,...patch}});}
  load(data:ResearchAnalysis){this.set({analysis:data,selected:this.state.selected&&data.tracks.some(track=>track.id===this.state.selected)?this.state.selected:data.tracks[0]?.id??null,error:''});}
}
export const research=new ResearchStore();
export const useResearch=()=>useSyncExternalStore(research.subscribe,research.get);
