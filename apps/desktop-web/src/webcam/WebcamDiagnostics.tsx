import { useEffect, useState } from 'react';
import type { WebcamSnapshot } from './WebcamController.js';

export function WebcamDiagnostics({ state, video }: { state: WebcamSnapshot; video: HTMLVideoElement | null }) {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState({ width: 0, height: 0, ready: 0, playback: 'stopped', track: '--', enabled: false, active: false });
  useEffect(() => {
    if (!open) return;
    const update = () => setDetails({ width: video?.videoWidth ?? 0, height: video?.videoHeight ?? 0,
      ready: video?.readyState ?? 0, playback: video?.paused ? 'paused' : 'playing',
      track: state.stream?.getVideoTracks()[0]?.readyState ?? '--', enabled: state.stream?.getVideoTracks()[0]?.enabled ?? false, active: state.stream?.active ?? false });
    update(); const timer = setInterval(update, 500); return () => clearInterval(timer);
  }, [open, video, state.stream]);
  return <details className="webcam-diagnostics" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Camera diagnostics</summary>
    <dl><dt>Camera permission</dt><dd>{state.permission}</dd>
      <dt>Selected device</dt><dd>{state.deviceLabel || 'Browser default'}</dd>
      <dt>Selected device ID</dt><dd>{state.deviceId || 'Default'}</dd>
      <dt>Camera lifecycle state</dt><dd data-testid="webcam-lifecycle">{state.lifecycle}</dd>
      <dt>getUserMedia pending</dt><dd data-testid="webcam-native-pending">{state.nativePending ? 'yes' : 'no'}</dd>
      <dt>getUserMedia state</dt><dd>{state.nativePending ? state.lifecycle === 'STOPPING' ? 'Pending (stop requested)' : 'Pending' : state.phase === 'requesting' ? 'Preparing request' : state.stream ? 'Acquired' : state.phase === 'error' && state.errorPhase === 'getUserMedia' && state.lastNativeError ? 'Rejected' : 'Idle'}</dd>
      <dt>Startup phase</dt><dd data-testid="webcam-phase">{state.phase}</dd>
      <dt>Stream active</dt><dd>{String(details.active)}</dd>
      <dt>Stream exists</dt><dd>{String(!!state.stream)}</dd>
      <dt>Video track readyState</dt><dd>{details.track}</dd>
      <dt>Track enabled</dt><dd>{String(details.enabled)}</dd>
      <dt>Video width</dt><dd>{details.width}</dd><dt>Video height</dt><dd>{details.height}</dd>
      <dt>video.readyState</dt><dd>{details.ready}</dd><dt>Playback state</dt><dd>{details.playback}</dd>
      <dt>Error phase</dt><dd>{state.errorPhase || 'None'}</dd>
      <dt>Last native error</dt><dd data-testid="webcam-native-error">{state.lastNativeError || 'None'}</dd>
      <dt>Last application error</dt><dd data-testid="webcam-application-error">{state.lastApplicationError || 'None'}</dd>
      <dt>Last camera error</dt><dd data-testid="webcam-last-error">{state.lastError || 'None'}</dd></dl>
  </details>;
}
