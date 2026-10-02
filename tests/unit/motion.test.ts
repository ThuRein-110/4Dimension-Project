import { describe,it,expect } from 'vitest';
import { analysisIdentity, analysisSchema, defaultDisplay, LANDMARK_NAMES, MODEL_VERSION, sampleAt, estimatedVelocity, toThree, jointAt, type MotionPoseSample } from '../../packages/shared/src/motion.js';
import { contentRect } from '../../packages/three-engine/src/CameraProjectionManager.js';

const pose = (timeSeconds: number, x = 0): MotionPoseSample => ({ timeSeconds, frameIndex: Math.round(timeSeconds*30), valid: true, poseConfidence: .9, inferenceMs: 20, landmarks2D: LANDMARK_NAMES.map((name,id) => ({ id,name,x,y: .5,z: .1,visibility: .9 })),worldLandmarks: LANDMARK_NAMES.map((name,id) => ({ id,name,x,y: .5,z: .1,visibility: .9 })) });
describe('real sample motion math', () => {
  it('looks up and interpolates source timestamps without crossing missing gaps', () => {
    expect(sampleAt([pose(0),pose(.1,1)],.05)?.worldLandmarks?.[16].x).toBe(.5);
    expect(sampleAt([pose(0),pose(1,1)],.5)).toBeNull();
    expect(sampleAt([pose(0),{...pose(.1),valid:false},pose(.2)],.05)).toBeNull();
    expect(sampleAt([pose(0)],2)).toBeNull();
    expect(sampleAt([pose(0)],0)?.timeSeconds).toBe(0);
  });
  it('maps the basis once and calculates only estimated nearby velocity', () => {
    expect(toThree({x:1,y:2,z:3})).toEqual({x:1,y:-2,z:-3});
    expect(estimatedVelocity([pose(0),pose(.1,.2)],1,16)).toBeCloseTo(2);
    expect(estimatedVelocity([pose(0),pose(1)],1,16)).toBeNull();
    expect(jointAt({...pose(0),worldLandmarks:undefined},16)).toBeNull();
    expect(jointAt(pose(0,.2),33)?.name).toBe('Hip center');
    expect(contentRect(1000,500,464,848,'contain').height).toBeCloseTo(500);
    expect(contentRect(1000,500,464,848,'cover').width).toBeCloseTo(1000);
  });
  it('validates serialization, counts, landmark ordering and cache identity', async () => {
    const id = await analysisIdentity('test-video',15);
    expect(id).not.toBe(await analysisIdentity('test-video',30));
    const data = { schemaVersion:1,id,video:{id:'test-video',name:'test.mov',width:464,height:848,fps:30,duration:1,size:100,mtimeMs:1,codec:'h264',rotation:0},analysis:{scope:'video',fps:15,modelVersion:MODEL_VERSION,coordinateSystem:'mediapipe-raw; three=(x,-y,-z); hip-relative-estimated',landmarkNames:[...LANDMARK_NAMES]},samples:[pose(0),pose(.1)],keyframes:[{id:crypto.randomUUID(),name:'Address',timeSeconds:0}],display:defaultDisplay,club:[],derived:{validFrames:2,missingFrames:0}};
    expect(analysisSchema.parse(JSON.parse(JSON.stringify(data))).samples).toHaveLength(2);
    expect(analysisSchema.safeParse({...data,samples:[pose(.1),pose(0)]}).success).toBe(false);
    expect(analysisSchema.safeParse({...data,derived:{validFrames:100,missingFrames:0}}).success).toBe(false);
    expect(analysisSchema.safeParse({...data,keyframes:[{id:crypto.randomUUID(),name:'Impact',timeSeconds:10}]}).success).toBe(false);
  });
});
