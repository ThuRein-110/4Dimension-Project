import type { ResearchAnalysis } from '../../../../packages/shared/src/research.js';
import { MotionProjectionService } from '../motion/MotionProjectionService.js';
import { drawResearchOverlay } from './VideoOverlayRenderer2D.js';
import { research,type ResearchOptions } from './store.js';
function download(blob:Blob,name:string){const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const csv=(value:unknown)=>`"${String(value??'').replaceAll('"','""')}"`;
export function exportResearchData(data:ResearchAnalysis,kind:'report'|'frames'|'tracks'|'events'){
  if(kind==='report'||kind==='frames'){download(new Blob([JSON.stringify(kind==='report'?{...data,description:'Monocular 4D scene and motion analysis / relative estimated scale'}:data.frames)],{type:'application/json'}),`4DLiveSpace_research_${kind}.json`);return;}
  const rows=kind==='events'?[['time_seconds','heuristic','subjects','confidence_index','interpretation'],...data.events.map(event=>[event.time,event.type,event.subjects.join(';'),event.confidence,event.label])]:[['track','class_hypothesis','time_seconds','x_relative','y_relative','z_relative','speed_units_per_second','acceleration_units_per_second_squared','heading_radians','detection_score','mask_quality','depth_quality'],...data.frames.flatMap(frame=>frame.subjects.map(subject=>[subject.id,subject.classLabel,frame.time,subject.worldEstimate?.x,subject.worldEstimate?.y,subject.worldEstimate?.z,subject.velocity?.speed,subject.acceleration,subject.heading,subject.confidence,subject.maskConfidence,subject.depthEstimate.confidence]))];
  download(new Blob([rows.map(row=>row.map(csv).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),`4DLiveSpace_research_${kind}.csv`);
}
export function exportResearchScreenshot(video:HTMLVideoElement|null,mode:'video'|'3d'|'split'){
  if(!video?.videoWidth||video.readyState<2)throw new Error('No decoded video frame');
  const scene=document.querySelector<HTMLCanvasElement>('.research-3d-stage canvas');if(mode!=='video'&&!scene)throw new Error('3D canvas unavailable');
  const output=document.createElement('canvas');output.width=mode==='split'?1600:1000;output.height=850;const ctx=output.getContext('2d')!;ctx.fillStyle='#111318';ctx.fillRect(0,0,output.width,output.height);const pane=mode==='split'?800:1000;
  if(mode!=='3d'){const source=document.createElement('canvas');source.width=video.clientWidth*2;source.height=video.clientHeight*2;const context=source.getContext('2d')!,state=research.get(),p=new MotionProjectionService(source.width,source.height,video.videoWidth,video.videoHeight,state.options.fit);context.drawImage(video,p.rect.x,p.rect.y,p.rect.width,p.rect.height);const layer=document.createElement('canvas');layer.width=source.width;layer.height=source.height;const layerContext=layer.getContext('2d')!;layerContext.scale(2,2);drawResearchOverlay(layerContext,new MotionProjectionService(video.clientWidth,video.clientHeight,video.videoWidth,video.videoHeight,state.options.fit),state.analysis,state.options,video.currentTime,state.selected);context.drawImage(layer,0,0);const placement=new MotionProjectionService(pane,790,source.width,source.height,'contain').rect;ctx.drawImage(source,placement.x,placement.y+40,placement.width,placement.height);}
  if(mode!=='video'&&scene){const placement=new MotionProjectionService(pane,790,scene.width,scene.height,'contain').rect;ctx.drawImage(scene,placement.x+(mode==='split'?800:0),placement.y+40,placement.width,placement.height);}
  ctx.fillStyle='#e5e8ef';ctx.font='17px sans-serif';ctx.fillText(`4D LiveSpace / Monocular Research / Relative Scale / T ${video.currentTime.toFixed(3)} s`,18,27);output.toBlob(blob=>{if(blob)download(blob,`4DLiveSpace_research_${mode}_${video.currentTime.toFixed(3)}s.png`);},'image/png');
}
export async function exportAnnotatedVideo(url:string,data:ResearchAnalysis,options:ResearchOptions,selected:number|null,onProgress:(time:number)=>void,signal:AbortSignal){
  if(!('MediaRecorder'in window))throw new Error('Annotated WebM export requires MediaRecorder support');
  const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(value=>MediaRecorder.isTypeSupported(value));if(!mime)throw new Error('No supported WebM recorder');
  const video=document.createElement('video');video.muted=true;video.playsInline=true;video.preload='auto';video.src=url;
  const canvas=document.createElement('canvas');canvas.width=data.video.width;canvas.height=data.video.height;const ctx=canvas.getContext('2d')!,layer=document.createElement('canvas');layer.width=canvas.width;layer.height=canvas.height;
  let frame=0;let stream:MediaStream|null=null;let recorder:MediaRecorder|null=null;
  try{
    await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>finish(new Error('Export decoder timed out')),30000);const abort=()=>finish(new DOMException('Export cancelled','AbortError'));const loaded=()=>finish(),failed=()=>finish(new Error('Export decoder failed'));const finish=(error?:Error)=>{clearTimeout(timer);video.removeEventListener('loadeddata',loaded);video.removeEventListener('error',failed);signal.removeEventListener('abort',abort);if(error)reject(error);else resolve();};video.addEventListener('loadeddata',loaded);video.addEventListener('error',failed);signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();else video.load();});
    stream=canvas.captureStream(30);recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:5_000_000});const chunks:BlobPart[]=[];
    await new Promise<void>((resolve,reject)=>{
      let error:Error|undefined;const abort=()=>{error??=new DOMException('Export cancelled','AbortError');video.pause();if(recorder?.state==='recording')recorder.stop();};const ended=()=>recorder?.state==='recording'&&recorder.stop();
      const timer=setTimeout(()=>{error=new Error('Export playback stalled');abort();},(data.video.duration+45)*1000);
      recorder!.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};recorder!.onerror=()=>{error=new Error('Annotated video recorder failed');abort();};
      recorder!.onstop=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);video.removeEventListener('ended',ended);cancelAnimationFrame(frame);if(error)reject(error);else resolve();};
      signal.addEventListener('abort',abort,{once:true});video.addEventListener('ended',ended,{once:true});recorder!.start(1000);
      const draw=()=>{const p=new MotionProjectionService(canvas.width,canvas.height,video.videoWidth,video.videoHeight,'contain');ctx.drawImage(video,p.rect.x,p.rect.y,p.rect.width,p.rect.height);drawResearchOverlay(layer.getContext('2d')!,p,data,options,video.currentTime,selected);ctx.drawImage(layer,0,0);onProgress(video.currentTime);frame=requestAnimationFrame(draw);};draw();if(signal.aborted)abort();else void video.play().catch(reason=>{error=reason;abort();});
    });
    download(new Blob(chunks,{type:mime}),'4DLiveSpace_research_annotated_silent.webm');
  }finally{cancelAnimationFrame(frame);if(recorder?.state==='recording')recorder.stop();stream?.getTracks().forEach(track=>track.stop());video.pause();video.removeAttribute('src');video.load();}
}
