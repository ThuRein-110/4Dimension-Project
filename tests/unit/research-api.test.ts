import { it,expect,vi } from 'vitest';
import express from 'express';
import { createServer } from 'node:http';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { researchRoutes } from '../../apps/server/src/research/routes.js';
import { ResearchService } from '../../apps/server/src/research/service.js';
import { VideoPreparationService } from '../../apps/server/src/motion/video-service.js';
import { researchFixture } from '../fixtures/research.js';

it('validates research commands, cache identity, cancellation and private import headers',async()=>{
  const root=await mkdtemp(join(tmpdir(),'research-api-')),data=await researchFixture();
  const service=new ResearchService(new VideoPreparationService(root,root),root,join(root,'missing-python'));
  vi.spyOn(service,'mediaInfo').mockResolvedValue({...data.video,status:'ready',prepared:false,url:'/private-video',error:undefined,storedWidth:data.video.width,storedHeight:data.video.height,pixelFormat:'yuv420p'});
  await writeFile(join(root,`${data.id}.json`),JSON.stringify(data));
  const app=express();app.use('/research',researchRoutes(service));
  const server=createServer(app);await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();if(!address||typeof address==='string')throw new Error('No test server');
  const base=`http://127.0.0.1:${address.port}/research`,headers={'Content-Type':'application/json','x-livespace-client':'desktop'};
  try{
    expect((await fetch(`${base}/runtime`)).status).toBe(200);
    expect((await fetch(`${base}/jobs`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status).toBe(403);
    expect((await fetch(`${base}/media`,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:'private'})).status).toBe(403);
    expect((await fetch(`${base}/export/mp4`,{method:'POST',headers:{'Content-Type':'video/webm'},body:'private'})).status).toBe(403);
    expect((await fetch(`${base}/export/mp4`,{method:'POST',headers:{'Content-Type':'video/webm','x-livespace-client':'desktop'},body:'invalid'})).status).toBe(422);
    expect((await fetch(`${base}/jobs`,{method:'POST',headers,body:JSON.stringify({sourceId:data.video.id,settings:{fps:999,threshold:.23}})})).status).toBe(400);
    expect((await fetch(`${base}/jobs`,{method:'POST',headers,body:JSON.stringify({sourceId:'b'.repeat(64),settings:data.settings})})).status).toBe(422);
    const response=await fetch(`${base}/jobs`,{method:'POST',headers,body:JSON.stringify({sourceId:data.video.id,settings:data.settings})});
    expect(response.status).toBe(200);expect(await response.json()).toMatchObject({cacheHit:true,status:'complete'});
    expect((await (await fetch(`${base}/analyses/${data.id}`)).json()).tracks).toHaveLength(2);
    expect((await fetch(`${base}/jobs/${data.id}/cancel`,{method:'POST',headers})).status).toBe(200);
    expect((await fetch(`${base}/media/${'a'.repeat(64)}/stream?id=../package.json`)).status).toBe(400);
    expect((await fetch(`${base}/analyses/not-a-hash`)).status).toBe(400);
    await writeFile(join(root,`${data.id}.json`),'corrupt');expect((await fetch(`${base}/analyses/${data.id}`)).status).toBe(422);
  }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));vi.restoreAllMocks();await rm(root,{recursive:true,force:true});}
});

it('keeps local import names and gives different video bytes different source identities',async()=>{
  const root=await mkdtemp(join(tmpdir(),'research-media-')),service=new ResearchService(new VideoPreparationService(root,root),root,join(root,'missing-python'));
  const clip=(color:string)=>execFileSync(ffmpeg!,['-hide_banner','-loglevel','error','-f','lavfi','-i',`color=c=${color}:s=160x240:r=10:d=1`,'-an','-c:v','libx264','-bf','0','-pix_fmt','yuv420p','-movflags','frag_keyframe+empty_moov','-f','mp4','pipe:1'],{windowsHide:true});
  try{
    const a=await service.upload(clip('gray'),'first.mp4'),b=await service.upload(clip('green'),'second.mp4');
    expect(a.name).toBe('first.mp4');expect(b.name).toBe('second.mp4');expect(a.id).not.toBe(b.id);expect(a.key).not.toBe(b.key);expect(a.url).toContain(a.key);expect((await service.mediaInfo(a.key)).id).toBe(a.id);
  }finally{await rm(root,{recursive:true,force:true});}
},15000);
