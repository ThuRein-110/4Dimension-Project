export type WebcamSnapshot = {
  lifecycle: 'STOPPED' | 'STARTING' | 'LIVE' | 'STOPPING' | 'ERROR';
  phase: 'stopped' | 'requesting' | 'metadata' | 'playback' | 'live' | 'error';
  requesting: boolean;
  nativePending: boolean;
  permission: string;
  deviceId: string;
  deviceLabel: string;
  devices: { deviceId: string; label: string }[];
  stream: MediaStream | null;
  error: string;
  lastError: string;
  lastNativeError: string;
  lastApplicationError: string;
  errorPhase: string;
};

const DEVICE_KEY = 'livespace.webcam.deviceId';
let activeStartup: Promise<void> | null = null;
const cameraOwner: { current: WebcamController | null } = { current: null };
class WebcamApplicationError extends Error {
  constructor(message: string) { super(message); this.name = 'WebcamApplicationError'; }
}
export function webcamError(problem: unknown): { name: string; message: string; userMessage: string } {
  const name = problem instanceof Error ? problem.name : 'Error';
  const message = problem instanceof Error ? problem.message : String(problem);
  let userMessage: string;
  if (name === 'NotReadableError' || /device in use|could not start video source/i.test(message)) {
    userMessage = 'Windows could not open the webcam. Another application may be using it. Close other camera applications and try again.';
  } else if (name === 'NotAllowedError') {
    userMessage = 'Camera permission was denied. Allow camera access in your browser and Windows privacy settings, then try again.';
  } else if (name === 'NotFoundError') {
    userMessage = 'No webcam was found. Connect a camera and try again.';
  } else if (name === 'OverconstrainedError') {
    userMessage = 'The webcam cannot provide the requested settings. Try another camera.';
  } else if (name === 'AbortError') {
    userMessage = 'The browser could not start the webcam. Close other camera applications, reconnect the webcam, and try again.';
  } else if (name === 'SecurityError') {
    userMessage = 'Camera access is blocked. Open localhost or HTTPS and check your browser camera policy.';
  } else {
    userMessage = message || 'Webcam unavailable.';
  }
  return { name, message, userMessage };
}

// Own acquisition and video attachment together; cancelling getUserMedia cannot abort
// the browser request, so keep the lock until it settles and stop any late stream.
export class WebcamController {
  snapshot: WebcamSnapshot = { lifecycle: 'STOPPED', phase: 'stopped', requesting: false, nativePending: false,
    permission: 'unknown', deviceId: '', deviceLabel: '', devices: [], stream: null, error: '', lastError: '', lastNativeError: '', lastApplicationError: '', errorPhase: '' };
  private listeners = new Set<(state: WebcamSnapshot) => void>();
  private pending: Promise<void> | null = null;
  private generation = 0;
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private attachment: AbortController | null = null;
  private ended: (() => void) | null = null;

  get busy() { return this.pending !== null; }
  subscribe(listener: (state: WebcamSnapshot) => void) {
    this.listeners.add(listener); listener(this.snapshot);
    return () => { this.listeners.delete(listener); };
  }
  private update(next: Partial<WebcamSnapshot>) {
    if (next.lifecycle && next.lifecycle !== this.snapshot.lifecycle) console.info(`[Webcam] lifecycle ${this.snapshot.lifecycle} -> ${next.lifecycle}`);
    this.snapshot = { ...this.snapshot, ...next };
    this.listeners.forEach(listener => listener(this.snapshot));
  }
  private release() {
    this.attachment?.abort(); this.attachment = null;
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        if (this.ended) track.removeEventListener('ended', this.ended);
        track.stop();
      }
    }
    this.stream = null; this.ended = null;
    if (this.video) { this.video.pause(); this.video.srcObject = null; this.video.removeAttribute('src'); this.video.load(); }
    this.video = null;
  }
  stop() {
    if (this.stream || this.pending) this.update({ lifecycle: 'STOPPING' });
    this.generation++; this.release();
    if (cameraOwner.current === this) cameraOwner.current = null;
    this.update({ lifecycle: this.pending ? 'STOPPING' : 'STOPPED', phase: 'stopped', stream: null, error: '' });
  }
  async refreshDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = (await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === 'videoinput').map(device => ({ deviceId: device.deviceId, label: device.label }));
      let deviceId = this.snapshot.deviceId;
      try { if (!deviceId) deviceId = localStorage.getItem(DEVICE_KEY) ?? ''; } catch { /* Optional preference. */ }
      // Before permission, hidden IDs cannot prove that a saved device was removed.
      if (deviceId && devices.some(device => device.deviceId) && !devices.some(device => device.deviceId === deviceId)) {
        deviceId = ''; try { localStorage.removeItem(DEVICE_KEY); } catch { /* Optional preference. */ }
        console.info('[Webcam] removed saved device; using browser default');
      }
      this.update({ devices, deviceId, deviceLabel: devices.find(device => device.deviceId === deviceId)?.label ?? '' });
    } catch (problem) { console.warn('[Webcam] device enumeration unavailable', problem); }
  }
  selectDevice(deviceId: string) {
    if (this.busy) return;
    this.stop();
    try { if (deviceId) localStorage.setItem(DEVICE_KEY, deviceId); else localStorage.removeItem(DEVICE_KEY); } catch { /* Optional preference. */ }
    this.update({ deviceId, deviceLabel: this.snapshot.devices.find(device => device.deviceId === deviceId)?.label ?? '' });
  }
  start(video: HTMLVideoElement, options: { raw?: boolean; deviceId?: string } = {}): Promise<void> {
    if (this.pending) { console.info('[Webcam] startup already pending; sharing request'); return this.pending; }
    console.info('[Webcam] start requested', options.raw ? 'raw' : 'normal');
    const releasing = !!this.stream;
    this.stop(); const generation = this.generation;
    this.update({ lifecycle: 'STARTING', phase: 'requesting', requesting: true, error: '', lastError: '', lastNativeError: '', lastApplicationError: '', errorPhase: '' });
    // A remounted controller must also wait for an old uncancellable native request.
    const operation = (activeStartup ?? Promise.resolve()).then(async () => {
      if (generation !== this.generation) return;
      if (cameraOwner.current && cameraOwner.current !== this) { cameraOwner.current.stop(); await new Promise(resolve => setTimeout(resolve, 150)); }
      if (generation !== this.generation) return;
      cameraOwner.current = this;
      await this.open(video, generation, releasing, options);
    }).finally(() => {
      this.pending = null;
      if (activeStartup === operation) activeStartup = null;
      this.update({ requesting: false, ...(this.snapshot.lifecycle === 'STOPPING' ? { lifecycle: 'STOPPED' } : {}) });
    });
    this.pending = operation; activeStartup = operation;
    return this.pending;
  }
  private async acquire(constraints: MediaStreamConstraints, current: () => boolean): Promise<MediaStream | null> {
    const started = performance.now(); let expired = false;
    this.update({ nativePending: true });
    console.info('[Webcam] requesting getUserMedia', constraints);
    // A watchdog cannot abort native getUserMedia. Keep the lock until settlement,
    // stop late streams, and never relabel its eventual native exception as a timer.
    const timer = setTimeout(() => {
      if (!current()) return;
      expired = true; this.release();
      const message = 'Webcam startup timed out. The browser camera request is still pending; retry is blocked until it finishes.';
      console.error('[Webcam] application timeout; phase = getUserMedia');
      this.update({ lifecycle: 'ERROR', phase: 'error', error: message, errorPhase: 'getUserMedia', lastError: 'WebcamApplicationError: Webcam startup timed out.', lastApplicationError: 'getUserMedia: Webcam startup timed out.' });
    }, 15000);
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      clearTimeout(timer);
      console.info('[Webcam] stream acquired in', Math.round(performance.now() - started), 'ms');
      if (!current() || expired) { stream.getTracks().forEach(track => track.stop()); return null; }
      return stream;
    } catch (problem) {
      clearTimeout(timer);
      const failure = webcamError(problem);
      console.error('[Webcam] native error: name =', failure.name, 'message =', failure.message, 'phase = getUserMedia');
      if (current()) this.update({ lastNativeError: `${failure.name}: ${failure.message}`, errorPhase: 'getUserMedia' });
      throw problem;
    } finally { clearTimeout(timer); this.update({ nativePending: false }); }
  }
  private async open(video: HTMLVideoElement, generation: number, releasing: boolean, options: { raw?: boolean; deviceId?: string }) {
    const current = () => generation === this.generation;
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new WebcamApplicationError('Camera access is blocked. Open localhost or HTTPS to use the webcam.');
      if (releasing) await new Promise(resolve => setTimeout(resolve, 150));
      if (!current()) return;
      try {
        const permission = await navigator.permissions?.query({ name: 'camera' as PermissionName });
        if (current()) this.update({ permission: permission?.state ?? 'unknown' });
      } catch { /* Camera permission querying is not supported by every browser. */ }
      if (!options.raw) await this.refreshDevices();
      let deviceId = options.raw ? options.deviceId ?? '' : this.snapshot.deviceId;
      if (!current()) return;
      this.update({ deviceId });
      const preferred: MediaStreamConstraints = options.raw ? { video: deviceId ? { deviceId: { exact: deviceId } } : true, audio: false } : { audio: false, video: {
        width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 },
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      } };
      console.info('[Webcam] device =', deviceId || 'browser default', this.snapshot.deviceLabel);
      let acquired: MediaStream | null;
      try { acquired = await this.acquire(preferred, current); }
      catch (problem) {
        const failure = webcamError(problem);
        const fallback = !options.raw && failure.name === 'OverconstrainedError' && !this.snapshot.lastApplicationError;
        if (!current() || !fallback) throw problem;
        this.release();
        this.update({ lastError: `${failure.name}: ${failure.message}` });
        await new Promise(resolve => setTimeout(resolve, 150));
        if (!current()) return;
        console.info('[Webcam] retrying with video: true');
        acquired = await this.acquire({ audio: false, video: true }, current);
      }
      if (!acquired) return;
      if (!current()) { acquired.getTracks().forEach(track => track.stop()); return; }
      this.stream = acquired; this.video = video;
      const track = acquired.getVideoTracks()[0];
      if (!track || track.readyState !== 'live') throw new WebcamApplicationError('The webcam returned no live video track.');
      console.info('[Webcam] stream acquired'); console.info('[Webcam] track state:', track.readyState);
      deviceId = track.getSettings().deviceId ?? deviceId;
      try { if (deviceId) localStorage.setItem(DEVICE_KEY, deviceId); } catch { /* Optional device preference. */ }
      this.update({ stream: acquired, permission: 'granted', deviceId, deviceLabel: track.label || this.snapshot.deviceLabel, phase: 'metadata', errorPhase: '' });
      void this.refreshDevices();
      this.ended = () => {
        if (!current()) return;
        this.generation++; this.release();
        this.update({ stream: null, lifecycle: 'ERROR', phase: 'error', error: 'Webcam disconnected. Reconnect it and start the webcam again. Your room data is retained.', lastError: 'Video track ended', lastNativeError: 'Video track ended' });
      };
      track.addEventListener('ended', this.ended);
      const attachment = new AbortController(); this.attachment = attachment;
      video.pause(); video.removeAttribute('src');
      console.info('[Webcam] attaching stream'); video.srcObject = acquired;
      await this.waitFor(video, () => video.readyState >= 1 && video.videoWidth > 0 && video.videoHeight > 0,
        ['loadedmetadata', 'resize'], attachment.signal, 'Webcam stream acquired, but video metadata did not arrive within 10 seconds.');
      if (!current()) return;
      console.info('[Webcam] metadata loaded', video.videoWidth, video.videoHeight);
      this.update({ phase: 'playback' });
      // Begin listening before play() so immediate playing/canplay events cannot be lost.
      const playing = this.waitFor(video, () => !video.paused && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0,
        ['playing', 'canplay', 'loadeddata'], attachment.signal, 'Webcam stream acquired, but playback did not begin within 10 seconds.');
      await Promise.all([video.play(), playing]);
      if (!current()) return;
      console.info('[Webcam] video.play success'); this.update({ lifecycle: 'LIVE', phase: 'live', error: '' });
    } catch (problem) {
      if (!current()) return;
      const failure = webcamError(problem);
      const application = problem instanceof WebcamApplicationError;
      const phase = this.snapshot.errorPhase || this.snapshot.phase;
      if (application || phase !== 'getUserMedia' || this.snapshot.lastNativeError !== `${failure.name}: ${failure.message}`) {
        console.error(`[Webcam] ${application ? 'application' : 'native'} error: name =`, failure.name, 'message =', failure.message, 'phase =', phase);
      }
      const playbackBlocked = this.snapshot.phase === 'playback' && failure.name === 'NotAllowedError';
      this.release();
      this.update({ lifecycle: 'ERROR', phase: 'error', stream: null, errorPhase: phase, error: playbackBlocked ? 'Webcam playback is blocked. Allow video playback in your browser and restart the webcam.' : failure.userMessage, lastError: `${failure.name}: ${failure.message}`,
        ...(application ? { lastApplicationError: `${phase}: ${failure.message}` } : { lastNativeError: `${failure.name}: ${failure.message}` }),
        ...(failure.name === 'NotAllowedError' && !playbackBlocked ? { permission: 'denied' } : {}) });
    }
  }
  private waitFor(video: HTMLVideoElement, ready: () => boolean, events: string[], signal: AbortSignal, message: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); events.forEach(event => video.removeEventListener(event, check)); video.removeEventListener('error', failed); signal.removeEventListener('abort', cancelled); };
      const check = () => { if (ready()) { cleanup(); resolve(); } };
      const failed = () => { cleanup(); reject(new WebcamApplicationError(video.error?.message || 'The webcam video element could not load the stream.')); };
      const cancelled = () => { cleanup(); reject(new WebcamApplicationError('Webcam startup cancelled.')); };
      const timer = setTimeout(() => { cleanup(); reject(new WebcamApplicationError(`Webcam startup timed out. ${message}`)); }, 10000);
      events.forEach(event => video.addEventListener(event, check)); video.addEventListener('error', failed); signal.addEventListener('abort', cancelled, { once: true });
      if (signal.aborted) cancelled(); else check();
    });
  }
}
