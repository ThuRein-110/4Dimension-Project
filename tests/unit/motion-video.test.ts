import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverVideo, parseProbe, videoIdentity } from '../../apps/server/src/motion/video-service.js';

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
    expect(videoIdentity('a.mov', 1, 2)).not.toBe(videoIdentity('a.mov', 1, 3));
  });
});
