import { sampleAt } from '../../../../packages/shared/src/motion.js';
import { useMotion } from './store.js';

export function MotionDiagnostics({time,decodedTime}: {time:number;decodedTime:number|null}) {
  const state = useMotion(), sample = state.analysis && sampleAt(state.analysis.samples,time);
  return <details className="motion-diagnostics"><summary>Motion Diagnostics</summary><dl><dt>Video currentTime</dt><dd>{time.toFixed(4)} s</dd><dt>Decoded frame time</dt><dd>{decodedTime?.toFixed(4) ?? 'Unavailable'}</dd><dt>Analysis sample time</dt><dd>{sample?.timeSeconds.toFixed(4) ?? 'Unavailable'}</dd><dt>Pose model</dt><dd>{state.model}</dd><dt>Inference time</dt><dd>{sample?.inferenceMs.toFixed(1) ?? '--'} ms</dd><dt>Analysis FPS</dt><dd>{state.fps}</dd><dt>Sample index</dt><dd>{sample?.frameIndex ?? '--'}</dd><dt>Confidence</dt><dd>{sample?.poseConfidence.toFixed(3) ?? '--'}</dd><dt>3D landmarks</dt><dd>{sample?.worldLandmarks?.length ?? 0}</dd><dt>Cache</dt><dd>{state.cacheHit?'Hit':'Miss'}</dd></dl></details>;
}
