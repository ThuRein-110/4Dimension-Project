import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverVideo, parseProbe, videoIdentity,VideoPreparationService } from '../../apps/server/src/motion/video-service.js';

describe('private root videos', () => {
  it('discovers deterministically, prefers demo, excludes subfolders and rejects paths', async () => {
    const root = await mkdtemp(join(tmpdir(), 'motion-test-'));
    try {
      await mkdir(join(root, 'nested'));
      await writeFile(join(root, 'nested', 'secret.mov'), 'test');
      await expect(discoverVideo(root)).rejects.toThrow('No root video');
      await writeFile(join(root, 'a.WEBM'), 'test');
      expect((await discoverVideo(root)).name).toBe('a.WEBM');
      await writeFile(join(root, 'IMG_0135.MOV'), 'test');
      expect((await discoverVideo(root)).name).toBe('IMG_0135.MOV');
      await expect(discoverVideo(root, '../secret.mov')).rejects.toThrow('root-level');
      await expect(discoverVideo(root, 'package.json')).rejects.toThrow('root-level');
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it('parses actual rotation, fractional FPS and format duration', () => {
    expect(parseProbe({ streams: [{ codec_type: 'video', codec_name: 'hevc', width: 848, height: 464, avg_frame_rate: '30000/1001', side_data_list: [{ rotation: -90 }], pix_fmt: 'yuv420p' }], format: { duration: '4.33' } })).toMatchObject({ width: 464, height: 848, fps: 30000 / 1001, rotation: -90, duration: 4.33 });
    expect(() => parseProbe({ streams: [] })).toThrow();
    expect(parseProbe({streams:[{codec_type:'video',width:100,height:200,avg_frame_rate:'0/0',r_frame_rate:'25/1',duration:'1'}]}).fps).toBe(25);
    expect(()=>parseProbe({streams:[{codec_type:'video',width:100,height:200,duration:'1'}]})).toThrow('frame rate');
    expect(videoIdentity('a.mov', 1, 2)).not.toBe(videoIdentity('a.mov', 1, 3));
  });
  it('reuses validated metadata only for the matching source identity',async()=>{
    const root=await mkdtemp(join(tmpdir(),'motion-cache-test-')),cache=join(root,'cache');
    try {
      await mkdir(cache);await writeFile(join(root,'fixture.mp4'),'CI placeholder (metadata-cache test, not a decodable video)');
      const source=await discoverVideo(root);
      await writeFile(join(cache,`${source.id}.metadata.json`),JSON.stringify({codec:'h264',width:100,height:200,storedWidth:100,storedHeight:200,fps:30,duration:1,rotation:0,pixelFormat:'yuv420p'}));
      expect((await new VideoPreparationService(root,cache).info()).fps).toBe(30);
      await writeFile(join(root,'fixture.mp4'),'Changed CI placeholder invalidates cached metadata');
      await expect(new VideoPreparationService(root,cache).info()).rejects.toThrow('FFprobe');
    } finally {await rm(root,{recursive:true,force:true});}
  });
});
