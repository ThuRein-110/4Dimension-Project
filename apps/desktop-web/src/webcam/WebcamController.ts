export type WebcamSnapshot = {
  phase: 'stopped' | 'requesting' | 'metadata' | 'playback' | 'live' | 'error';
  requesting: boolean;
  permission: string;
  deviceId: string;
  stream: MediaStream | null;
  error: string;
  lastError: string;
};

const DEVICE_KEY = 'livespace.webcam.deviceId';
export function webcamError(problem: unknown): { name: string; message: string; userMessage: string } {
  const name = problem instanceof Error ? problem.name : 'Error';
  const message = problem instanceof Error ? problem.message : String(problem);
  let userMessage: string;
  if (name === 'NotReadableError' || /device in use|could not start video source/i.test(message)) {
    userMessage = 'Webcam is currently being used by another application. Close other camera applications and try again.';
  } else if (name === 'NotAllowedError') {
    userMessage = 'Webcam permission denied. Allow camera access in your browser and Windows privacy settings, then try again.';
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
  snapshot: WebcamSnapshot = { phase: 'stopped', requesting: false, permission: 'unknown', deviceId: '', stream: null, error: '', lastError: '' };
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
    this.generation++; this.release();
    this.update({ phase: 'stopped', stream: null, error: '' });
  }
  start(video: HTMLVideoElement): Promise<void> {
    if (this.pending) return this.pending;
    const releasing = !!this.stream;
    this.stop(); const generation = this.generation;
    this.update({ phase: 'requesting', requesting: true, error: '', lastError: '' });
    // Schedule after assigning the lock, including when preflight fails synchronously.
    this.pending = Promise.resolve().then(() => this.open(video, generation, releasing)).finally(() => {
      this.pending = null; this.update({ requesting: false });
    });
    return this.pending;
  }
  private async open(video: HTMLVideoElement, generation: number, releasing: boolean) {
    const current = () => generation === this.generation;
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new DOMException('Open localhost or HTTPS to use the webcam.', 'SecurityError');
      if (releasing) await new Promise(resolve => setTimeout(resolve, 150));
      if (!current()) return;
      try {
        const permission = await navigator.permissions?.query({ name: 'camera' as PermissionName });
        if (current()) this.update({ permission: permission?.state ?? 'unknown' });
      } catch { /* Camera permission querying is not supported by every browser. */ }
      let deviceId = '';
      try { deviceId = localStorage.getItem(DEVICE_KEY) ?? ''; } catch { /* Capture also works without storage. */ }
      if (deviceId) {
        try {
          const inputs = (await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === 'videoinput');
          if (inputs.length && !inputs.some(device => device.deviceId === deviceId)) deviceId = inputs[0].deviceId;
        } catch { deviceId = ''; }
      }
      if (!current()) return;
      this.update({ deviceId });
      const preferred: MediaStreamConstraints = { audio: false, video: {
        width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 },
        ...(deviceId ? { deviceId: { ideal: deviceId } } : {}),
      } };
      console.info('[Webcam] requesting stream', preferred);
      let acquired: MediaStream;
      try { acquired = await navigator.mediaDevices.getUserMedia(preferred); }
      catch (problem) {
        const failure = webcamError(problem);
        console.warn('[Webcam] acquisition error', failure.name, failure.message);
        // Never re-prompt denied permission or retry a camera already reported busy.
        const fallback = ['OverconstrainedError', 'NotFoundError', 'AbortError'].includes(failure.name) && !/device in use|could not start video source/i.test(failure.message);
        if (!current() || !fallback) throw problem;
        this.update({ lastError: `${failure.name}: ${failure.message}` });
        await new Promise(resolve => setTimeout(resolve, 150));
        if (!current()) return;
        console.info('[Webcam] retrying with video: true');
        acquired = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      }
      if (!current()) { acquired.getTracks().forEach(track => track.stop()); return; }
      this.stream = acquired; this.video = video;
      const track = acquired.getVideoTracks()[0];
      if (!track || track.readyState !== 'live') throw new DOMException('The webcam returned no live video track.', 'NotReadableError');
      console.info('[Webcam] stream acquired'); console.info('[Webcam] track state:', track.readyState);
      deviceId = track.getSettings().deviceId ?? deviceId;
      try { if (deviceId) localStorage.setItem(DEVICE_KEY, deviceId); } catch { /* Optional device preference. */ }
      this.update({ stream: acquired, permission: 'granted', deviceId, phase: 'metadata' });
      this.ended = () => {
        if (!current()) return;
        this.generation++; this.release();
        this.update({ stream: null, phase: 'error', error: 'Webcam disconnected. Reconnect it and start the webcam again. Your room data is retained.', lastError: 'Video track ended' });
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
      console.info('[Webcam] playback started'); this.update({ phase: 'live', error: '' });
    } catch (problem) {
      if (!current()) return;
      const failure = webcamError(problem);
      console.error('[Webcam] error', failure.name, failure.message);
      const playbackBlocked = this.snapshot.phase === 'playback' && failure.name === 'NotAllowedError';
      this.release();
      this.update({ phase: 'error', stream: null, error: playbackBlocked ? 'Webcam playback is blocked. Allow video playback in your browser and restart the webcam.' : failure.userMessage, lastError: `${failure.name}: ${failure.message}`,
        ...(failure.name === 'NotAllowedError' && !playbackBlocked ? { permission: 'denied' } : {}) });
    }
  }
  private waitFor(video: HTMLVideoElement, ready: () => boolean, events: string[], signal: AbortSignal, message: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); events.forEach(event => video.removeEventListener(event, check)); video.removeEventListener('error', failed); signal.removeEventListener('abort', cancelled); };
      const check = () => { if (ready()) { cleanup(); resolve(); } };
      const failed = () => { cleanup(); reject(new Error(video.error?.message || 'The webcam video element could not load the stream.')); };
      const cancelled = () => { cleanup(); reject(new DOMException('Webcam startup cancelled.', 'AbortError')); };
      const timer = setTimeout(() => { cleanup(); reject(new Error(message)); }, 10000);
      events.forEach(event => video.addEventListener(event, check)); video.addEventListener('error', failed); signal.addEventListener('abort', cancelled, { once: true });
      if (signal.aborted) cancelled(); else check();
    });
  }
}
