import { LANDMARK_NAMES,estimatedVelocity,spatialJointAt,sampleAt,toThree } from '../../../../packages/shared/src/motion.js';
import { motion,useMotion } from './store.js';

export function JointInspector({ time }: {time:number}) {
  const { analysis,display } = useMotion();
  const sample = analysis && sampleAt(analysis.samples,time), point = spatialJointAt(sample,display.selectedJoint);
  const xyz = point && toThree(point);
  const index = analysis?.samples.findIndex(sample => sample.timeSeconds >= time) ?? -1;
  const speed = analysis ? estimatedVelocity(analysis.samples,index,display.selectedJoint) : null;
  return <section className="motion-inspector"><label>Selected Joint <select aria-label="Selected Joint" value={display.selectedJoint} onChange={event => motion.settings({selectedJoint:Number(event.target.value)})}>{[...LANDMARK_NAMES,'Hip center'].map((name,id) => <option key={name} value={id}>{name}</option>)}</select></label><div className="motion-joint-values"><span>X <strong>{xyz?.x.toFixed(3) ?? 'Unavailable'}</strong></span><span>Y <strong>{xyz?.y.toFixed(3) ?? 'Unavailable'}</strong></span><span>Z <strong>{xyz?.z.toFixed(3) ?? 'Unavailable'}</strong></span><span>T <strong>{time.toFixed(3)} s</strong></span><span>Confidence <strong>{point ? `${(point.visibility*100).toFixed(0)}%` : 'Unavailable'}</strong></span><span>Estimated Velocity <strong>{speed?.toFixed(3) ?? 'Unavailable'}</strong></span></div><small>{sample?.worldLandmarks?.length ? 'Estimated hip-relative coordinates' : 'Normalized model coordinates (not metric)'}; velocity in model units/s, not calibrated biomechanics.</small></section>;
}
