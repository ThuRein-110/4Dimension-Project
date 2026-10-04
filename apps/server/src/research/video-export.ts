import { mkdtemp,writeFile,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve,sep } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ffmpeg from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';

let busy=false;
/** One bounded, local-only conversion; temporary recordings never enter the repo. */
export async function convertResearchVideo(bytes:Buffer,signal:AbortSignal){
  if(!ffmpeg)throw new Error('Local FFmpeg unavailable');
  if(bytes.length<4||bytes.readUInt32BE(0)!==0x1a45dfa3)throw new Error('Expected WebM recording');
  if(busy)throw new Error('Another export conversion is running');
  busy=true;let directory:string|undefined;
  try{
    directory=await mkdtemp(join(tmpdir(),'livespace-export-'));
    const input=join(directory,'input.webm'),output=join(directory,'output.mp4');
    await writeFile(input,bytes);
    await promisify(execFile)(ffmpeg,['-hide_banner','-loglevel','error','-nostdin','-protocol_whitelist','file,pipe','-i',input,'-t','121','-an','-vf',"scale=w='min(1920,iw)':h='min(1920,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",'-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',output],{windowsHide:true,timeout:120000,maxBuffer:1024*1024,signal});
    const probe=await promisify(execFile)(ffprobe.path,['-v','error','-show_entries','format=duration','-of','json',output],{windowsHide:true,timeout:10000,signal});
    const duration=Number(JSON.parse(probe.stdout).format?.duration);
    if(!Number.isFinite(duration)||duration>120)throw new Error('MP4 conversion supports clips up to 120 seconds; keep WebM');
    return await readFile(output);
  }finally{if(directory&&resolve(directory).startsWith(resolve(tmpdir())+sep))await rm(directory,{recursive:true,force:true});busy=false;}
}
