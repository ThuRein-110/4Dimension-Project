import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebcamController, webcamError } from '../../apps/desktop-web/src/webcam/WebcamController.js';

class TestVideo extends EventTarget {
  srcObject: MediaStream | null = null;
  videoWidth = 0; videoHeight = 0; readyState = 0; paused = true;
  error: MediaError | null = null;
  play = vi.fn(async () => { this.paused = false; this.readyState = 2; this.dispatchEvent(new Event('playing')); });
  pause() { this.paused = true; }
  removeAttribute() {}
  load() { this.videoWidth = 0; this.videoHeight = 0; this.readyState = 0; }
  metadata() { this.videoWidth = 640; this.videoHeight = 480; this.readyState = 1; this.dispatchEvent(new Event('loadedmetadata')); }
}
function stream() {
  const track = Object.assign(new EventTarget(), { readyState: 'live', getSettings: () => ({ deviceId: 'camera-a' }), stop: vi.fn(function (this: { readyState: string }) { this.readyState = 'ended'; }) });
  return { track, media: { active: true, getVideoTracks: () => [track], getTracks: () => [track] } as unknown as MediaStream };
}
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

describe('webcam lifecycle', () => {
  let camera: WebcamController; let video: TestVideo;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'info').mockImplementation(() => {}); vi.spyOn(console, 'warn').mockImplementation(() => {}); vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('window', { isSecureContext: true });
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
    camera = new WebcamController(); video = new TestVideo();
  });
  afterEach(() => { camera.stop(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });
  const start = (camera: WebcamController, video: TestVideo) => camera.start(video as unknown as HTMLVideoElement);

  it('locks through metadata/playback, clears timers on success, and stops all tracks', async () => {
    const input = stream(); const capture = vi.fn(async () => input.media);
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: capture } });
    const first = start(camera, video); expect(start(camera, video)).toBe(first);
    await flush(); expect(capture).toHaveBeenCalledTimes(1); expect(camera.snapshot.phase).toBe('metadata'); expect(camera.busy).toBe(true);
    expect(video.srcObject).toBe(input.media); expect(video.play).not.toHaveBeenCalled();
    video.metadata(); await first;
    expect(camera.snapshot.phase).toBe('live'); expect(camera.busy).toBe(false); expect(video.play).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0); await vi.advanceTimersByTimeAsync(30000); expect(camera.snapshot.phase).toBe('live');
    camera.stop(); expect(input.track.stop).toHaveBeenCalledTimes(1); expect(video.srcObject).toBe(null);
  });
  it('labels the acquisition watchdog as application-only and retains the native request lock', async () => {
    const input = stream(); let resolve!: (stream: MediaStream) => void;
    const capture = vi.fn(() => new Promise<MediaStream>(done => { resolve = done; }));
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: capture } });
    const pending = start(camera, video); await flush(); await vi.advanceTimersByTimeAsync(30000);
    const timedOut = camera.snapshot;
    const locked = start(camera, video); const calls = capture.mock.calls.length;
    camera.stop(); resolve(input.media); await pending;
    expect(timedOut.phase).toBe('error'); expect(timedOut.lifecycle).toBe('ERROR'); expect(timedOut.lastApplicationError).toContain('Webcam startup timed out');
    expect(timedOut.lastNativeError).toBe(''); expect(timedOut.nativePending).toBe(true);
    expect(locked).toBe(pending); expect(calls).toBe(1);
    expect(input.track.stop).toHaveBeenCalledTimes(1); expect(video.srcObject).toBe(null);
    expect(camera.snapshot.phase).toBe('stopped'); expect(camera.busy).toBe(false);
  });
  it('times out only after acquisition when metadata never arrives, and releases the camera', async () => {
    const input = stream(); vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: async () => input.media } });
    const pending = start(camera, video); await flush();
    await vi.advanceTimersByTimeAsync(9999); expect(camera.snapshot.phase).toBe('metadata');
    await vi.advanceTimersByTimeAsync(1); await pending;
    expect(camera.snapshot.error).toContain('stream acquired, but video metadata'); expect(input.track.stop).toHaveBeenCalledTimes(1);
    expect(video.srcObject).toBe(null); expect(vi.getTimerCount()).toBe(0);
  });
  it('cancels metadata listeners and timers on unmount/source cleanup', async () => {
    const input = stream(); vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: async () => input.media } });
    const listener = vi.fn(); const unsubscribe = camera.subscribe(listener);
    const pending = start(camera, video); await flush(); unsubscribe(); const count = listener.mock.calls.length;
    camera.stop(); await pending; video.metadata(); await vi.advanceTimersByTimeAsync(30000);
    expect(listener).toHaveBeenCalledTimes(count); expect(video.play).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
    expect(input.track.stop).toHaveBeenCalledTimes(1); expect(camera.snapshot.error).toBe('');
  });
  it('keeps the startup lock until delayed playback confirms nonzero dimensions', async () => {
    const input = stream(); vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: async () => input.media } });
    video.play = vi.fn(() => new Promise<void>(resolve => setTimeout(() => {
      video.paused = false; video.readyState = 2; video.dispatchEvent(new Event('playing')); resolve();
    }, 9000)));
    const pending = start(camera, video); await flush(); video.metadata(); await flush();
    expect(camera.snapshot.phase).toBe('playback'); expect(camera.busy).toBe(true);
    expect(start(camera, video)).toBe(pending);
    await vi.advanceTimersByTimeAsync(9000); await pending;
    expect(camera.snapshot.phase).toBe('live'); expect(vi.getTimerCount()).toBe(0);
  });
  it('reports a playback-specific timeout without retaining a locked track', async () => {
    const input = stream(); vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: async () => input.media } });
    video.play = vi.fn(async () => {});
    const pending = start(camera, video); await flush(); video.metadata(); await flush();
    await vi.advanceTimersByTimeAsync(10000); await pending;
    expect(camera.snapshot.error).toContain('playback did not begin'); expect(input.track.stop).toHaveBeenCalledTimes(1);
    expect(video.srcObject).toBe(null); expect(camera.busy).toBe(false); expect(vi.getTimerCount()).toBe(0);
  });
  it('releases an ended track and retains a useful disconnect error', async () => {
    const input = stream(); vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: async () => input.media } });
    const pending = start(camera, video); await flush(); video.metadata(); await pending;
    input.track.dispatchEvent(new Event('ended'));
    expect(camera.snapshot.phase).toBe('error'); expect(camera.snapshot.error).toContain('Webcam disconnected'); expect(video.srcObject).toBe(null);
  });
  it('preserves a busy browser error and never retries it', async () => {
    const capture = vi.fn(async () => { throw new DOMException('Device in use', 'NotReadableError'); });
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: capture } });
    await start(camera, video); expect(capture).toHaveBeenCalledTimes(1);
    expect(camera.snapshot.lastError).toBe('NotReadableError: Device in use'); expect(camera.snapshot.error).toContain('Another application');
  });
  it('detects an insecure/unavailable media API before requesting', async () => {
    vi.stubGlobal('navigator', {}); await start(camera, video);
    expect(camera.snapshot.lastApplicationError).toContain('localhost or HTTPS'); expect(camera.snapshot.lastNativeError).toBe('');
  });
  it('keeps browser AbortError distinct from app metadata timeouts', () => {
    const failure = webcamError(new DOMException('Timeout starting video source', 'AbortError'));
    expect(failure.name).toBe('AbortError'); expect(failure.message).toBe('Timeout starting video source');
    expect(failure.userMessage).toContain('browser could not start');
  });
  it('never retries a native AbortError and preserves its exact name/message', async () => {
    const capture = vi.fn(async () => { throw new DOMException('Timeout starting video source', 'AbortError'); });
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: capture } });
    await start(camera, video);
    expect(capture).toHaveBeenCalledTimes(1); expect(camera.snapshot.lastNativeError).toBe('AbortError: Timeout starting video source');
    expect(camera.snapshot.lastApplicationError).toBe(''); expect(camera.snapshot.nativePending).toBe(false); expect(camera.snapshot.lifecycle).toBe('ERROR');
    expect(vi.getTimerCount()).toBe(0);
  });
  it('retains both the watchdog error and a late native rejection without retrying', async () => {
    let reject!: (error: Error) => void;
    const capture = vi.fn(() => new Promise<MediaStream>((_, fail) => { reject = fail; }));
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: capture } });
    const pending = start(camera, video); await flush(); await vi.advanceTimersByTimeAsync(15000);
    reject(new DOMException('Timeout starting video source', 'AbortError')); await pending;
    expect(camera.snapshot.lastApplicationError).toContain('getUserMedia: Webcam startup timed out');
    expect(camera.snapshot.lastNativeError).toBe('AbortError: Timeout starting video source'); expect(capture).toHaveBeenCalledTimes(1);
    expect(camera.busy).toBe(false); expect(vi.getTimerCount()).toBe(0);
  });
  it('serializes native acquisition across unmounted/remounted controller instances', async () => {
    const oldInput = stream(); const newInput = stream(); const next = new WebcamController(); const nextVideo = new TestVideo();
    let resolve!: (stream: MediaStream) => void;
    const capture = vi.fn().mockImplementationOnce(() => new Promise<MediaStream>(done => { resolve = done; })).mockResolvedValueOnce(newInput.media);
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: capture } });
    const old = start(camera, video); await flush(); camera.stop();
    const replacement = start(next, nextVideo); await flush(); const callsBeforeSettlement = capture.mock.calls.length;
    resolve(oldInput.media); await old; await flush(); nextVideo.metadata(); await replacement;
    next.stop();
    expect(callsBeforeSettlement).toBe(1); expect(capture).toHaveBeenCalledTimes(2);
    expect(oldInput.track.stop).toHaveBeenCalledTimes(1); expect(newInput.track.stop).toHaveBeenCalledTimes(1); expect(video.srcObject).toBe(null);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('supports idempotent stop and three start/stop cycles without stale locks', async () => {
    const inputs = [stream(), stream(), stream()]; let index = 0;
    const capture = vi.fn(async () => inputs[index++].media);
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: capture } });
    for (let i = 0; i < inputs.length; i++) {
      const pending = start(camera, video); await flush(); video.metadata(); await pending;
      expect(camera.snapshot.lifecycle).toBe('LIVE'); camera.stop(); camera.stop();
      expect(camera.snapshot.lifecycle).toBe('STOPPED'); expect(camera.busy).toBe(false); expect(inputs[i].track.stop).toHaveBeenCalledTimes(1);
    }
    expect(capture).toHaveBeenCalledTimes(3); expect(vi.getTimerCount()).toBe(0);
  });
  it('raw default acquisition ignores saved IDs and uses only video: true, audio: false', async () => {
    const input = stream(); const capture = vi.fn(async () => input.media);
    vi.stubGlobal('localStorage', { getItem: () => 'old-device', setItem: vi.fn() });
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: capture } });
    const pending = camera.start(video as unknown as HTMLVideoElement, { raw: true }); await flush(); video.metadata(); await pending;
    expect(capture).toHaveBeenCalledWith({ video: true, audio: false }); expect(camera.snapshot.lifecycle).toBe('LIVE');
  });
});
