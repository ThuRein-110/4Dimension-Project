import { CubeTracker, type CubeTrackingResult } from './CubeTracker.js';
import { CUBE_MARKER } from './marker.js';

// This self-test never writes to the live tracking store or recorder.
export function testMarkerImage(signal: AbortSignal): Promise<CubeTrackingResult> {
  return new Promise((resolve, reject) => {
    const image = new Image(); let tracker: CubeTracker | null = null; let settled = false;
    const finish = (error?: Error, result?: CubeTrackingResult) => {
      if (settled) return; settled = true;
      clearTimeout(timeout); signal.removeEventListener('abort', cancel); image.onload = image.onerror = null; tracker?.dispose();
      if (error) reject(error); else resolve(result!);
    };
    const cancel = () => finish(new Error('Marker self-test cancelled'));
    const timeout = setTimeout(() => finish(new Error('Marker image self-test timed out')), 10000);
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) { cancel(); return; }
    image.onerror = () => finish(new Error('Generated marker image could not be loaded'));
    image.onload = () => {
      tracker = new CubeTracker(result => {
        if (result.engine === 'error') finish(new Error(result.message));
        else if (result.frameProcessed) finish(undefined, result);
        else if (result.engine === 'ready') tracker!.capture(image, { markerSizeMm: CUBE_MARKER.sizeMm, cubeSizeMm: 57, verticalFov: 60, smoothing: 'Off' });
      });
      if (settled) tracker.dispose();
    };
    image.src = CUBE_MARKER.image;
  });
}
