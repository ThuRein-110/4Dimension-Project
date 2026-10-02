import { readdir, lstat, realpath, mkdir, stat, rename, unlink, readFile, writeFile } from 'node:fs/promises';
import { resolve, extname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ffmpeg from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';
import { z } from 'zod';

const execute = promisify(execFile);
export const videoExtension = /\.(mov|mp4|m4v|webm)$/i;
export async function discoverVideo(root: string, configured?: string) {
  const directory = await realpath(root);
  const entries = (await readdir(directory, { withFileTypes: true }))
    .filter(entry => entry.isFile() && videoExtension.test(entry.name)).map(entry => entry.name).sort();
  if (configured && (basename(configured) !== configured || !entries.includes(configured))) throw new Error('DEMO_VIDEO must name an existing root-level video.');
  const name = configured ?? entries.find(name => name.toLowerCase() === 'img_0135.mov') ?? entries[0];
  if (!name) throw new Error('No root video found. Place a MOV, MP4, M4V or WebM in the repository root.');
  const path = resolve(directory, name);
  if ((await lstat(path)).isSymbolicLink() || await realpath(path) !== path) throw new Error('Linked video files are not allowed.');
  const info = await stat(path);
  return { name, path, size: info.size, mtimeMs: info.mtimeMs, id: videoIdentity(name, info.size, info.mtimeMs) };
}
export function videoIdentity(name: string, size: number, mtimeMs: number) {
  return createHash('sha256').update(JSON.stringify([name, size, mtimeMs, 'h264-orientation-v1'])).digest('hex');
}
interface ProbeOutput {
  streams?: { codec_type?: string; codec_name?: string; width?: number; height?: number; avg_frame_rate?: string; r_frame_rate?: string; duration?: string; pix_fmt?: string; tags?: { rotate?: string }; side_data_list?: { rotation?: number }[] }[];
  format?: { duration?: string };
}
export function parseProbe(probe: ProbeOutput) {
  const stream = probe.streams?.find(stream => stream.codec_type === 'video');
  if (!stream?.width || !stream.height) throw new Error('The file has no decodable video stream.');
  const rate = (value?: string) => { const [n,d]=(value ?? '').split('/').map(Number); return Number.isFinite(n)&&Number.isFinite(d)&&n>0&&d>0?n/d:0; };
  const fps=rate(stream.avg_frame_rate)||rate(stream.r_frame_rate);
  if(!fps)throw new Error('FFprobe could not determine the source frame rate. Prepare a clip with valid frame-rate metadata.');
  const rotation = Number(stream.side_data_list?.find(data => data.rotation !== undefined)?.rotation ?? stream.tags?.rotate ?? 0);
  const rotated = Math.abs(Math.round(rotation / 90)) % 2 === 1;
  const duration = Number(stream.duration ?? probe.format?.duration);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Video duration could not be read.');
  return { codec: stream.codec_name ?? 'unknown', width: rotated ? stream.height : stream.width,
    height: rotated ? stream.width : stream.height, storedWidth: stream.width, storedHeight: stream.height,
    fps, duration, rotation, pixelFormat: stream.pix_fmt ?? 'unknown' };
}
export class VideoPreparationService {
  private jobs = new Map<string, { status: 'preparing' | 'ready' | 'error'; error?: string; path?: string }>();
  private probes = new Map<string,Promise<ReturnType<typeof parseProbe>>>();
  constructor(readonly root = resolve('.'), readonly cache = resolve('.cache/4dlivespace/video')) {}
  async info() {
    const source = await discoverVideo(this.root, process.env.DEMO_VIDEO);
    if(!this.probes.has(source.id)) this.probes.set(source.id,this.metadata(source).catch(error=>{this.probes.delete(source.id);throw error;}));
    const metadata = await this.probes.get(source.id)!;
    // Normalize rotated/MOV/HEVC sources once; browsers and inference see identical pixels.
    const needsPreparation = extname(source.name).toLowerCase() !== '.mp4' || metadata.codec !== 'h264' || metadata.rotation !== 0 || metadata.pixelFormat !== 'yuv420p';
    if (!needsPreparation) this.jobs.set(source.id, { status: 'ready', path: source.path });
    if (!this.jobs.has(source.id)) {
      const output = resolve(this.cache, `${source.id}.mp4`);
      if (await stat(output).then(file => file.size > 0).catch(() => false)) this.jobs.set(source.id, { status: 'ready', path: output });
      else {
        this.jobs.set(source.id, { status: 'preparing' });
        void this.prepare(source.path, output).then(() => this.jobs.set(source.id, { status: 'ready', path: output }))
          .catch(error => this.jobs.set(source.id, { status: 'error', error: error instanceof Error ? error.message : 'Video preparation failed.' }));
      }
    }
    const job = this.jobs.get(source.id)!;
    return { id: source.id, name: source.name, size: source.size, mtimeMs: source.mtimeMs, ...metadata,
      status: job.status, error: job.error, prepared: needsPreparation, url: `/api/motion/demo/stream?id=${source.id}` };
  }
  async stream(id: string) {
    const source = await discoverVideo(this.root, process.env.DEMO_VIDEO);
    if (source.id !== id) throw new Error('Video changed. Reload its metadata.');
    const job = this.jobs.get(id);
    if (job?.status !== 'ready' || !job.path) throw new Error('Video is not ready.');
    return job.path;
  }
  private async metadata(source: Awaited<ReturnType<typeof discoverVideo>>) {
    const positive=z.number().finite().positive();
    const schema=z.object({codec:z.string(),width:positive,height:positive,storedWidth:positive,storedHeight:positive,fps:positive,duration:positive,rotation:z.number().finite(),pixelFormat:z.string()});
    const file=resolve(this.cache,`${source.id}.metadata.json`);
    try {return schema.parse(JSON.parse(await readFile(file,'utf8')));}
    catch { /* Missing/corrupt metadata is regenerated from the original video. */ }
    let probe:ProbeOutput;
    try {
      const result=await execute(process.env.FFPROBE_PATH ?? ffprobe.path,['-v','error','-show_streams','-show_format','-of','json',source.path],{windowsHide:true,timeout:30000,maxBuffer:2_000_000});
      probe=JSON.parse(result.stdout) as ProbeOutput;
    } catch {throw new Error('FFprobe could not read this video. Install dependencies or set FFPROBE_PATH to a working ffprobe.exe.');}
    const metadata=schema.parse(parseProbe(probe)),temporary=`${file}.${crypto.randomUUID()}.tmp`;
    try {await mkdir(this.cache,{recursive:true});await writeFile(temporary,JSON.stringify(metadata),{flag:'wx'});await rename(temporary,file);}
    catch {throw new Error('Video metadata cache is not writable. Check local disk space and permissions.');}
    finally {await unlink(temporary).catch(()=>undefined);}
    return metadata;
  }
  private async prepare(input: string, output: string) {
    const binary = process.env.FFMPEG_PATH ?? ffmpeg;
    if (!binary) throw new Error('FFmpeg is missing. Install dependencies or set FFMPEG_PATH to ffmpeg.exe.');
    await mkdir(this.cache, { recursive: true });
    const temporary = `${output}.${crypto.randomUUID()}.tmp.mp4`;
    try {
      await execute(binary, ['-hide_banner', '-loglevel', 'error', '-y', '-i', input, '-map', '0:v:0', '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-map_metadata', '-1', '-movflags', '+faststart', temporary], { windowsHide: true, timeout: 600000, maxBuffer: 2_000_000 });
      await rename(temporary, output);
    } catch { throw new Error('FFmpeg preview preparation failed. Check the source codec, disk space and FFMPEG_PATH.'); }
    finally { await unlink(temporary).catch(() => undefined); }
  }
}
