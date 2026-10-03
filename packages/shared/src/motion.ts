import { z } from 'zod';

export const MODEL_VERSION = 'tasks-vision-1.0.1/lite-float16-v1';
export const LANDMARK_NAMES = ['Nose', 'Left eye inner', 'Left eye', 'Left eye outer', 'Right eye inner', 'Right eye', 'Right eye outer', 'Left ear', 'Right ear', 'Mouth left', 'Mouth right', 'Left shoulder', 'Right shoulder', 'Left elbow', 'Right elbow', 'Left wrist', 'Right wrist', 'Left pinky', 'Right pinky', 'Left index', 'Right index', 'Left thumb', 'Right thumb', 'Left hip', 'Right hip', 'Left knee', 'Right knee', 'Left ankle', 'Right ankle', 'Left heel', 'Right heel', 'Left foot index', 'Right foot index'] as const;
// MediaPipe PoseLandmarker.POSE_CONNECTIONS, with its original 33 landmark IDs.
export const CONNECTIONS = [[0,1],[1,2],[2,3],[3,7],[0,4],[4,5],[5,6],[6,8],[9,10],[11,12],[11,13],[13,15],[15,17],[15,19],[15,21],[17,19],[12,14],[14,16],[16,18],[16,20],[16,22],[18,20],[11,23],[12,24],[23,24],[23,25],[24,26],[25,27],[26,28],[27,29],[28,30],[29,31],[30,32],[27,31],[28,32]] as const;
const finite = z.number().finite();
export const landmarkSchema = z.object({ id: z.number().int().min(0).max(32), name: z.string().max(50), x: finite, y: finite, z: finite, visibility: finite.min(0).max(1) });
export type MotionLandmark = z.infer<typeof landmarkSchema>;
const landmarks = z.array(landmarkSchema).max(33).refine(points => points.every((point, index) => point.id === index), 'Landmark IDs must retain model order');
export const sampleSchema = z.object({ timeSeconds: finite.min(0), frameIndex: z.number().int().min(0), landmarks2D: landmarks, worldLandmarks: landmarks.optional(), poseConfidence: finite.min(0).max(1), valid: z.boolean(), inferenceMs: finite.min(0) }).refine(sample => !sample.valid || sample.landmarks2D.length === 33, 'Valid pose requires all 33 landmarks');
export type MotionPoseSample = z.infer<typeof sampleSchema>;
export const keyframeSchema = z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(80), timeSeconds: finite.min(0) });
const displayFields = z.object({ skeleton: z.boolean(), landmarks: z.boolean(), labels: z.boolean(), confidence: z.boolean(), trails: z.boolean(), trailWindow: finite.min(0).max(10), future: z.boolean(), ghosts: z.boolean(), ghostCount: z.number().int().min(1).max(8), ghostInterval: finite.min(.05).max(2), fit: z.enum(['contain','cover']), selectedJoint: z.number().int().min(0).max(33), floor: z.boolean(), view: z.enum(['4d','split','video','3d','ghost','trajectory','data']), visualizationVersion: z.literal(2).default(2), depth: z.boolean().default(true), axes: z.boolean().default(false), composite: z.boolean().default(false), keyframePoses: z.boolean().default(false), timeDots: z.boolean().default(false), trailJoint: z.enum(['left','right','wrists','elbows','head','hips']).default('wrists') });
// Upgrade display preferences only. Pose timestamps, cache identity and annotations are unchanged.
export const displaySchema = z.preprocess(value => {
  if (value && typeof value === 'object' && !('visualizationVersion' in value)) return { ...value, view: '4d', ghosts: true, ghostCount: 4, ghostInterval: .15, trailWindow: 0 };
  return value;
}, displayFields);
export type MotionDisplay = z.infer<typeof displaySchema>;
export const defaultDisplay: MotionDisplay = displaySchema.parse({ skeleton: true, landmarks: true, labels: false, confidence: false, trails: true, trailWindow: 0, future: false, ghosts: true, ghostCount: 4, ghostInterval: .15, fit: 'contain', selectedJoint: 16, floor: true, view: '4d', visualizationVersion: 2 });
export const analysisSchema = z.object({
  schemaVersion: z.literal(1), id: z.string().regex(/^[a-f0-9]{64}$/),
  video: z.object({ id: z.string().min(1).max(512), name: z.string().max(256), duration: finite.positive().max(7200), width: finite.positive(), height: finite.positive(), fps: finite.positive(), size: finite.min(0), mtimeMs: finite.min(0), codec: z.string(), rotation: finite }),
  analysis: z.object({ scope: z.enum(['frame','video']), fps: z.union([z.literal(10), z.literal(15), z.literal(30)]), modelVersion: z.literal(MODEL_VERSION), coordinateSystem: z.literal('mediapipe-raw; three=(x,-y,-z); hip-relative-estimated'), landmarkNames: z.array(z.string()).length(33) }),
  samples: z.array(sampleSchema).max(216000), keyframes: z.array(keyframeSchema).max(100), display: displaySchema,
  club: z.array(z.object({ timeSeconds: finite.min(0), x: finite.min(0).max(1), y: finite.min(0).max(1) })).max(10000),
  derived: z.object({ validFrames: z.number().int().min(0), missingFrames: z.number().int().min(0) }),
}).superRefine((value, context) => {
  const invalid = value.samples.some((sample, i) => sample.timeSeconds > value.video.duration || (i > 0 && sample.timeSeconds <= value.samples[i - 1].timeSeconds));
  if (invalid || value.keyframes.some(frame => frame.timeSeconds > value.video.duration) || value.club.some(point => point.timeSeconds > value.video.duration)) context.addIssue({ code: 'custom', message: 'Samples and annotations must use ordered source-video timestamps' });
  if (value.derived.validFrames !== value.samples.filter(sample => sample.valid).length || value.derived.missingFrames !== value.samples.filter(sample => !sample.valid).length) context.addIssue({ code: 'custom', message: 'Analysis counts do not match samples' });
});
export type MotionAnalysis = z.infer<typeof analysisSchema>;
export async function analysisIdentity(videoId: string, fps: number) {
  const bytes = new TextEncoder().encode(JSON.stringify([videoId, fps, MODEL_VERSION, 1]));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
}
export function toThree(point: Pick<MotionLandmark, 'x' | 'y' | 'z'>) { return { x: point.x, y: -point.y, z: -point.z }; }
export function jointAt(sample: MotionPoseSample | null, id: number, world = true): MotionLandmark | null {
  if (!sample?.valid) return null;
  const points = world ? sample.worldLandmarks : sample.landmarks2D;
  if (!points?.length) return null;
  if (id !== 33) { const point = points[id]; return point?.visibility >= .35 ? point : null; }
  const a = points[23], b = points[24];
  if (!a || !b || Math.min(a.visibility, b.visibility) < .35) return null;
  return { id: 23, name: 'Hip center', x: (a.x+b.x)/2, y: (a.y+b.y)/2, z: (a.z+b.z)/2, visibility: Math.min(a.visibility,b.visibility) };
}
export function spatialJointAt(sample: MotionPoseSample | null,id:number): MotionLandmark | null {
  if(sample?.worldLandmarks?.length===33) return jointAt(sample,id);
  const point=jointAt(sample,id,false),hips=jointAt(sample,33,false);
  return point && hips ? {...point,x:point.x-hips.x,y:point.y-hips.y,z:point.z-hips.z} : null;
}
export function sampleAt(samples: MotionPoseSample[], time: number, maxGap = .2): MotionPoseSample | null {
  if (!samples.length) return null;
  let lo = 0, hi = samples.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (samples[mid].timeSeconds < time) lo = mid + 1; else hi = mid; }
  const right = samples[lo], left = samples[lo - 1];
  if (right?.valid && Math.abs(right.timeSeconds - time) < .001) return right;
  if (!left || !right) { const edge = left ?? right; return edge?.valid && Math.abs(edge.timeSeconds-time) <= maxGap / 2 ? edge : null; }
  if (!left.valid || !right.valid || right.timeSeconds - left.timeSeconds > maxGap) return null;
  const alpha = (time-left.timeSeconds)/(right.timeSeconds-left.timeSeconds);
  const interpolate = (a: MotionLandmark[], b: MotionLandmark[]) => a.map((point, i) => ({ ...point, x: point.x+(b[i].x-point.x)*alpha, y: point.y+(b[i].y-point.y)*alpha, z: point.z+(b[i].z-point.z)*alpha, visibility: Math.min(point.visibility,b[i].visibility) }));
  return { ...left, timeSeconds: time, landmarks2D: interpolate(left.landmarks2D,right.landmarks2D), worldLandmarks: left.worldLandmarks?.length === 33 && right.worldLandmarks?.length === 33 ? interpolate(left.worldLandmarks,right.worldLandmarks) : undefined, poseConfidence: Math.min(left.poseConfidence,right.poseConfidence) };
}
export function estimatedVelocity(samples: MotionPoseSample[], index: number, joint: number) {
  const a = samples[index-1], b = samples[index];
  if (!a || !b || b.timeSeconds-a.timeSeconds > .2) return null;
  if(!!a.worldLandmarks?.length !== !!b.worldLandmarks?.length) return null;
  const p = spatialJointAt(a,joint), q = spatialJointAt(b,joint);
  return p && q ? Math.hypot(q.x-p.x,q.y-p.y,q.z-p.z)/(b.timeSeconds-a.timeSeconds) : null;
}
