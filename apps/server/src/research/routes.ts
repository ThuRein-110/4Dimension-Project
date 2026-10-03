import express from 'express';
import { researchSettingsSchema } from '../../../../packages/shared/src/research.js';
import { ResearchService } from './service.js';

/** Mounted inside Motion's localhost/origin guard, not as a public media API. */
export function researchRoutes(service:ResearchService){
  const router=express.Router(),hash=/^[a-f0-9]{64}$/;
  router.use((req,res,next)=>{if(req.method!=='GET'&&req.get('x-livespace-client')!=='desktop'){res.sendStatus(403);return;}next();});
  router.get('/runtime',async(_req,res)=>res.json({available:await service.available(),pipeline:'Grounding DINO / SAM 2 / ByteTrack / Depth Anything V2',localOnly:true}));
  router.post('/media',express.raw({type:'application/octet-stream',limit:'256mb'}),async(req,res)=>{try{if(!Buffer.isBuffer(req.body)||!req.body.length){res.sendStatus(400);return;}const name=decodeURIComponent(req.get('x-video-name')??'source.mp4');res.json(await service.upload(req.body,name));}catch(error){res.status(422).json({error:error instanceof Error?error.message:'Local video could not be read.'});}});
  router.get('/media/:key/info',async(req,res)=>{try{res.json(await service.mediaInfo(req.params.key));}catch{res.status(422).json({error:'Local video unavailable.'});}});
  router.get('/media/:key/stream',async(req,res)=>{if(!hash.test(req.params.key)||typeof req.query.id!=='string'||!hash.test(req.query.id)){res.sendStatus(400);return;}try{const media=service.mediaService(req.params.key);await media.info();res.sendFile(await media.stream(req.query.id),{dotfiles:'allow'});}catch{res.sendStatus(404);}});
  router.use(express.json({limit:'16kb'}));
  router.post('/jobs',async(req,res)=>{
    const parsed=researchSettingsSchema.safeParse(req.body?.settings);
    if(!parsed.success||typeof req.body?.sourceId!=='string'||!hash.test(req.body.sourceId)||(req.body.key!==undefined&&(typeof req.body.key!=='string'||!hash.test(req.body.key)))||(req.body.force!==undefined&&typeof req.body.force!=='boolean')){res.sendStatus(400);return;}
    try{res.json(await service.start(req.body.sourceId,parsed.data,req.body.key,req.body.force));}catch(error){res.status(422).json({error:error instanceof Error?error.message:'Analysis could not start.'});}
  });
  router.get('/jobs/:id',(req,res)=>{const job=hash.test(req.params.id)&&service.jobs.get(req.params.id);if(!job){res.sendStatus(404);return;}res.json(job);});
  router.post('/jobs/:id/cancel',(req,res)=>{if(!hash.test(req.params.id)){res.sendStatus(400);return;}const job=service.cancel(req.params.id);if(!job){res.sendStatus(404);return;}res.json(job);});
  router.get('/analyses/:id',async(req,res)=>{if(!hash.test(req.params.id)){res.sendStatus(400);return;}try{res.json(await service.load(req.params.id));}catch(error){res.status((error as NodeJS.ErrnoException).code==='ENOENT'?404:422).json({error:'Research cache is unavailable or invalid.'});}});
  return router;
}
