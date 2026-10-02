import { useEffect, useState } from 'react';
import { ArrowLeft, Camera, Square } from 'lucide-react';
import { useVideoStats } from '../../../../packages/shared/src/use-video-stats.js';
import { WebcamController } from './WebcamController.js';
import { WebcamDeviceSelect } from './WebcamDeviceSelect.js';
import { WebcamDiagnostics } from './WebcamDiagnostics.js';

export function RawWebcamApp() {
  const [controller] = useState(() => new WebcamController());
  const [state, setState] = useState(controller.snapshot);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [mode, setMode] = useState('Browser default');
  const stats = useVideoStats(video);
  useEffect(() => {
    const unsubscribe = controller.subscribe(setState); void controller.refreshDevices();
    return () => { unsubscribe(); controller.stop(); };
  }, [controller]);
  function test(selected: boolean) {
    if (!video || controller.busy) return;
    setMode(selected ? state.deviceLabel || 'Selected camera' : 'Browser default');
    void controller.start(video, { raw: true, deviceId: selected ? state.deviceId : '' });
  }
  return <main className="raw-webcam-app">
    <header><a href="/" onClick={() => controller.stop()}><ArrowLeft size={16} />4D LiveSpace</a><h1>Raw Webcam Test</h1></header>
    <div className="raw-webcam-controls">
      <WebcamDeviceSelect controller={controller} state={state} />
      <button disabled={state.requesting} onClick={() => test(false)}><Camera size={16} />{state.lifecycle === 'STARTING' ? 'Starting webcam...' : 'Test Raw Webcam'}</button>
      <button disabled={state.requesting || !state.deviceId} onClick={() => test(true)}><Camera size={16} />Test Selected Camera</button>
      <button disabled={!state.stream && !state.requesting} onClick={() => controller.stop()}><Square size={16} />Stop webcam</button>
    </div>
    <div role="status" data-testid="raw-camera-result">{state.lifecycle === 'LIVE' ? 'RAW CAMERA SUCCESS' : state.lifecycle} / {mode}</div>
    {state.error && <div role="alert">{state.error}<p>{state.lastNativeError || state.lastApplicationError}</p></div>}
    <video ref={setVideo} muted playsInline aria-label="Raw webcam video" />
    <p className="raw-camera-stats">{stats.width || '--'} x {stats.height || '--'} / {stats.fps} FPS</p>
    <WebcamDiagnostics state={state} video={video} />
  </main>;
}
