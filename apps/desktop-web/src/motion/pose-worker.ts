import { FilesetResolver, PoseLandmarker, type NormalizedLandmark, type Landmark } from '@mediapipe/tasks-vision';
import { LANDMARK_NAMES, type MotionLandmark } from '../../../../packages/shared/src/motion.js';

let engine: PoseLandmarker | undefined;
let lastTimestamp = -1;
const points = (values: (Landmark | NormalizedLandmark)[]): MotionLandmark[] => values.map((point, id) => ({ id, name: LANDMARK_NAMES[id], x: point.x, y: point.y, z: point.z, visibility: point.visibility ?? 0 }));
self.onmessage = async (event: MessageEvent<{ id: number; type: 'init' | 'frame' | 'reset'; bitmap?: ImageBitmap; timeSeconds?: number; frameIndex?: number }>) => {
  const { id, type, bitmap } = event.data;
  try {
    if (type === 'init') {
      engine?.close();
      const files = await FilesetResolver.forVisionTasks(`${self.location.origin}/api/motion/wasm`, true);
      engine = await PoseLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: `${self.location.origin}/api/motion/model`, delegate: 'CPU' }, runningMode: 'VIDEO', numPoses: 1, outputSegmentationMasks: false });
      lastTimestamp = -1; self.postMessage({ id, ready: true });
    } else if (type === 'reset') {
      // Reset tracking by recreating the graph before each independent offline run.
      if (!engine) throw new Error('Pose model not ready.');
      await engine.setOptions({ runningMode: 'IMAGE' });
      await engine.setOptions({ runningMode: 'VIDEO' });
      lastTimestamp = -1; self.postMessage({ id, ready: true });
    } else {
      if (!engine || !bitmap) throw new Error('Pose model or frame unavailable.');
      const started = performance.now();
      const timestamp = Math.max((event.data.timeSeconds ?? 0) * 1000, lastTimestamp + 1);
      lastTimestamp = timestamp;
      const result = engine.detectForVideo(bitmap, timestamp);
      const image = points(result.landmarks[0] ?? []), world = points(result.worldLandmarks[0] ?? []);
      const confidence = image.length ? image.reduce((sum, point) => sum + point.visibility, 0) / image.length : 0;
      self.postMessage({ id, sample: { timeSeconds: event.data.timeSeconds, frameIndex: event.data.frameIndex, landmarks2D: image, worldLandmarks: world.length ? world : undefined, poseConfidence: confidence, valid: image.length === 33, inferenceMs: performance.now()-started } });
    }
  } catch (error) { self.postMessage({ id, error: error instanceof Error ? error.message : String(error) }); }
  finally { bitmap?.close(); }
};
