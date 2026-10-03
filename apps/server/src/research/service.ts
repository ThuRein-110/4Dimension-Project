import { spawn, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access,mkdir,readFile,writeFile,rename,unlink } from 'node:fs/promises';
import { resolve,extname,basename } from 'node:path';
import { z } from 'zod';
import { VideoPreparationService } from '../motion/video-service.js';
import { deriveResearchEvents,rawResearchSchema,researchAnalysisSchema,researchIdentity,RESEARCH_VERSION,type ResearchAnalysis,type ResearchSettings } from '../../../../packages/shared/src/research.js';

export interface ResearchJob { id:string;sourceId:string;status:'running'|'complete'|'cancelled'|'error';stage:string;done:number;total:number;subjects:number;error?:string;cacheHit:boolean; }
const hash=/^[a-f0-9]{64}$/;
const progressSchema=z.object({stage:z.string().max(100),done:z.number().int().nonnegative().optional(),total:z.number().int().positive().optional(),subjects:z.number().int().nonnegative().optional(),error:z.string().max(1000).optional()});
export class ResearchService {
  readonly jobs=new Map<string,ResearchJob>();
  private active:{id:string;child:ChildProcess}|null=null;
  constructor(readonly rootVideo=new VideoPreparationService(),readonly cache=resolve('.cache/4dlivespace/research'),readonly python=process.env.RESEARCH_PYTHON ?? resolve('.local/research-venv',process.platform==='win32'?'Scripts/python.exe':'bin/python')){}
  async available(){return access(this.python).then(()=>true).catch(()=>false);}
  mediaService(key?:string){if(!key)return this.rootVideo;if(!hash.test(key))throw new Error('Invalid local media identity');return new VideoPreparationService(resolve(this.cache,'media',key),resolve(this.cache,'video'));}
  async mediaInfo(key?:string){const info=await this.mediaService(key).info();const name=key?z.object({name:z.string().max(256)}).parse(JSON.parse(await readFile(resolve(this.cache,'media',key,'name.json'),'utf8'))).name:info.name;return {...info,name,url:key?`/api/motion/research/media/${key}/stream?id=${info.id}`:info.url};}
  async upload(bytes:Buffer,name:string){
    if(name.length>256||basename(name)!==name||!/^\.(mp4|mov|m4v|webm)$/i.test(extname(name)))throw new Error('Select a supported video file');
    const key=createHash('sha256').update(bytes).digest('hex'),directory=resolve(this.cache,'media',key),file=resolve(directory,`${key}${extname(name).toLowerCase()}`);
    await mkdir(directory,{recursive:true});
    try{await access(file);}catch{await writeFile(file,bytes,{flag:'wx'});}
    await writeFile(resolve(directory,'name.json'),JSON.stringify({name}));return {key,...await this.mediaInfo(key)};
  }
  async load(id:string):Promise<ResearchAnalysis>{
    if(!hash.test(id))throw new Error('Invalid analysis identity');
    const data=researchAnalysisSchema.parse(JSON.parse(await readFile(resolve(this.cache,`${id}.json`),'utf8')));
    if(data.id!==id||await researchIdentity(data.video.id,data.settings)!==id)throw new Error('Research cache identity mismatch');return data;
  }
  async start(sourceId:string,settings:ResearchSettings,key?:string,force=false){
    const info=await this.mediaInfo(key);
    if(info.id!==sourceId||info.status!=='ready'||info.duration>120)throw new Error('Source changed, is preparing, or exceeds the 120-second limit');
    const id=await researchIdentity(sourceId,settings);
    if(this.active){if(this.active.id===id)return this.jobs.get(id)!;throw new Error('Another local analysis is running. Cancel it first.');}
    if(!force){try{const cached=await this.load(id);const job:ResearchJob={id,sourceId,status:'complete',stage:'cached',done:cached.frames.length,total:cached.frames.length,subjects:cached.tracks.length,cacheHit:true};this.jobs.set(id,job);return job;}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw new Error('Research cache is invalid. Use Reanalyze to replace it.');}}
    if(!await this.available())throw new Error('Research runtime missing. Run scripts/setup-research.ps1 with Python 3.12.');
    const input=await this.mediaService(key).stream(sourceId);
    await mkdir(this.cache,{recursive:true});
    const temporary=resolve(this.cache,`${id}.${crypto.randomUUID()}.worker.json`);
    const job:ResearchJob={id,sourceId,status:'running',stage:'starting local inference',done:0,total:Math.ceil(info.duration*settings.fps),subjects:0,cacheHit:false};this.jobs.set(id,job);
    const child=spawn(this.python,[resolve('scripts/research/analyze.py'),'--input',input,'--output',temporary,'--models',resolve(this.cache,'models'),'--fps',String(settings.fps),'--threshold',String(settings.threshold),'--duration',String(info.duration)],{windowsHide:true,env:{...process.env,HF_HUB_DISABLE_TELEMETRY:'1',HF_HUB_DISABLE_XET:'1'},stdio:['ignore','pipe','pipe']});
    this.active={id,child};let buffer='',stderr='';
    const timer=setTimeout(()=>{job.status='error';job.error='Local analysis exceeded 45 minutes.';child.kill();},45*60*1000);
    child.stdout?.on('data',chunk=>{buffer+=String(chunk);let newline:number;while((newline=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,newline);buffer=buffer.slice(newline+1);try{const parsed=progressSchema.safeParse(JSON.parse(line));if(parsed.success&&job.status==='running'){const p=parsed.data;job.stage=p.stage;job.done=p.done??job.done;job.total=p.total??job.total;job.subjects=p.subjects??job.subjects;if(p.error)job.error=p.error;}}catch{/* Non-protocol library output stays out of the status payload. */}}});
    child.stderr?.on('data',chunk=>{stderr=(stderr+String(chunk)).slice(-16000);});
    child.once('error',error=>{job.status='error';job.error=`Could not start local inference: ${error.message}`;});
    child.once('close',code=>{void(async()=>{
      clearTimeout(timer);
      try{
        await writeFile(resolve(this.cache,`${id}.log`),stderr);
        if(job.status!=='running')return;
        if(code!==0)throw new Error(job.error??'Local inference failed. See research diagnostics and the ignored local runtime log.');
        const current=await this.mediaInfo(key);if(current.id!==sourceId)throw new Error('Source changed during analysis. Results were not cached.');
        const raw=rawResearchSchema.parse(JSON.parse(await readFile(temporary,'utf8')));
        const warnings=['Relative monocular depth and assumed ground/camera; not calibrated metric geometry.','Species scores, tracking, mask quality and event confidence are not calibrated probabilities.','ByteTrack can switch IDs after long occlusion, camera movement or scene edits.','Motion heading is not confirmed animal facing; proxies are inferred volumes, not anatomy.'];
        const base={...raw,schemaVersion:1 as const,pipelineVersion:RESEARCH_VERSION,id,video:info,settings,warnings};
        const events=deriveResearchEvents(base);
        const data=researchAnalysisSchema.parse({...base,events,frames:raw.frames.map(frame=>({...frame,events:events.filter(event=>Math.abs(event.time-frame.time)<.001)}))});
        const pending=resolve(this.cache,`${id}.tmp.json`);await writeFile(pending,JSON.stringify(data));await rename(pending,resolve(this.cache,`${id}.json`));
        job.status='complete';job.stage=data.tracks.length?'complete':'complete / no reliable animals';job.done=data.frames.length;job.total=data.frames.length;job.subjects=data.tracks.length;
      }catch(error){job.status='error';job.error=error instanceof Error?error.message:'Research cache could not be written.';}
      finally{await unlink(temporary).catch(()=>undefined);if(this.active?.id===id)this.active=null;}
    })();});
    return job;
  }
  cancel(id:string){const job=this.jobs.get(id);if(this.active?.id===id&&job){job.status='cancelled';job.stage='cancelled';this.active.child.kill();}return job;}
}
