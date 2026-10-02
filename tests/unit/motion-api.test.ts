import { it,expect,vi } from 'vitest';
import express from 'express';
import { createServer,request } from 'node:http';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { motionRoutes } from '../../apps/server/src/motion/routes.js';
import { VideoPreparationService } from '../../apps/server/src/motion/video-service.js';
import { analysisIdentity,MODEL_VERSION,LANDMARK_NAMES,defaultDisplay } from '../../packages/shared/src/motion.js';

it('guards private routes, serves ranges and validates atomic analysis cache writes',async()=>{
  const root=await mkdtemp(join(tmpdir(),'motion-api-'));
  const service=new VideoPreparationService(root,root), file=join(root,'preview.mp4');
  await writeFile(file,Buffer.alloc(1000,42));
  vi.spyOn(service,'stream').mockResolvedValue(file);
  const app=express();app.use('/api/motion',motionRoutes(service,join(root,'analyses')));
  const server=createServer(app);await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();if(!address || typeof address==='string')throw new Error('Test server unavailable');
  const base=`http://127.0.0.1:${address.port}/api/motion`;
  try {
    expect((await fetch(`${base}/demo/info`,{headers:{Origin:'https://foreign.example'}})).status).toBe(403);
    const foreignHost=await new Promise<number|undefined>((resolve,reject)=>{const req=request(`${base}/demo/info`,{headers:{Host:'foreign.example'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();});
    expect(foreignHost).toBe(403);
    expect((await fetch(`${base}/demo/stream?id=../../package.json`)).status).toBe(400);
    const response=await fetch(`${base}/demo/stream?id=${'a'.repeat(64)}`,{headers:{Range:'bytes=0-99'}});
    expect(response.status).toBe(206);expect((await response.arrayBuffer()).byteLength).toBe(100);
    const id=await analysisIdentity('unit-video',15);
    const data={schemaVersion:1,id,video:{id:'unit-video',name:'unit.mp4',duration:1,width:160,height:240,fps:30,size:100,mtimeMs:1,codec:'h264',rotation:0},analysis:{scope:'video',fps:15,modelVersion:MODEL_VERSION,landmarkNames:LANDMARK_NAMES,coordinateSystem:'mediapipe-raw; three=(x,-y,-z); hip-relative-estimated'},samples:[],keyframes:[],display:defaultDisplay,club:[],derived:{validFrames:0,missingFrames:0}};
    const url=`${base}/analyses/${id}`;
    expect((await fetch(url)).status).toBe(404);
    expect((await fetch(url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})).status).toBe(403);
    expect((await fetch(url,{method:'PUT',headers:{'Content-Type':'application/json','x-livespace-client':'desktop'},body:JSON.stringify({...data,schemaVersion:999})})).status).toBe(400);
    expect((await fetch(url,{method:'PUT',headers:{'Content-Type':'application/json','x-livespace-client':'desktop'},body:JSON.stringify(data)})).status).toBe(204);
    expect((await (await fetch(url)).json()).id).toBe(id);
    await writeFile(join(root,'analyses',`${id}.json`),'corrupt');expect((await fetch(url)).status).toBe(422);
  } finally {server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));vi.restoreAllMocks();await rm(root,{recursive:true,force:true});}
});
