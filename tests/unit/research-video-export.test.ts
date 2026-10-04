import { it,expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import { convertResearchVideo } from '../../apps/server/src/research/video-export.js';
it('converts a real encoded local WebM into a playable H.264 MP4',async()=>{
  const webm=execFileSync(ffmpeg!,['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=gray:s=160x240:r=10:d=0.5','-an','-c:v','libvpx','-f','webm','pipe:1'],{windowsHide:true});
  const mp4=await convertResearchVideo(webm,new AbortController().signal);
  expect(mp4.subarray(4,8).toString()).toBe('ftyp');
  expect(mp4.includes(Buffer.from('avc1'))).toBe(true);
  execFileSync(ffmpeg!,['-hide_banner','-loglevel','error','-i','pipe:0','-f','null','-'],{windowsHide:true,input:mp4});
},15000);
it('rejects non-WebM input and cancellation',async()=>{
  await expect(convertResearchVideo(Buffer.from('invalid'),new AbortController().signal)).rejects.toThrow('Expected WebM');
  const controller=new AbortController();controller.abort();
  await expect(convertResearchVideo(Buffer.from([0x1a,0x45,0xdf,0xa3]),controller.signal)).rejects.toThrow();
});
