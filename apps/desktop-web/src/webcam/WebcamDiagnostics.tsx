import { useEffect, useState } from 'react';
import type { WebcamSnapshot } from './WebcamController.js';

export function WebcamDiagnostics({ state, video }: { state: WebcamSnapshot; video: HTMLVideoElement | null }) {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState({ width: 0, height: 0, ready: 0, playback: 'stopped', track: '--', active: false });
  useEffect(() => {
    if (!open) return;
    const update = () => setDetails({ width: video?.videoWidth ?? 0, height: video?.videoHeight ?? 0,
      ready: video?.readyState ?? 0, playback: video?.paused ? 'paused' : 'playing',
      track: state.stream?.getVideoTracks()[0]?.readyState ?? '--', active: state.stream?.active ?? false });
    update(); const timer = setInterval(update, 500); return () => clearInterval(timer);
  }, [open, video, state.stream]);
  return <details className="webcam-diagnostics" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Camera diagnostics</summary>
    <dl><dt>Camera permission</dt><dd>{state.permission}</dd>
      <dt>Selected device ID</dt><dd>{state.deviceId || 'Default'}</dd>
      <dt>getUserMedia state</dt><dd>{state.requesting && state.phase === 'stopped' ? 'Cancelling request' : state.phase === 'requesting' ? 'Requesting' : state.stream ? 'Acquired' : state.phase === 'error' ? 'Failed' : 'Idle'}</dd>
      <dt>Startup phase</dt><dd data-testid="webcam-phase">{state.phase}</dd>
      <dt>Stream active</dt><dd>{String(details.active)}</dd>
      <dt>Video track readyState</dt><dd>{details.track}</dd>
      <dt>Video width</dt><dd>{details.width}</dd><dt>Video height</dt><dd>{details.height}</dd>
      <dt>video.readyState</dt><dd>{details.ready}</dd><dt>Playback state</dt><dd>{details.playback}</dd>
      <dt>Last camera error</dt><dd data-testid="webcam-last-error">{state.lastError || 'None'}</dd></dl>
  </details>;
}
