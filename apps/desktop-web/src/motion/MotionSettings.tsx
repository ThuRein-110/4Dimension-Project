import { motion,useMotion } from './store.js';

export function MotionSettings({ clubMode,setClubMode }: { clubMode: boolean; setClubMode: (value: boolean) => void }) {
  const { display,analysis } = useMotion();
  return <details className="motion-settings"><summary>Display &amp; Trails</summary><div>
    {(['skeleton','landmarks','labels','confidence','trails','future','ghosts','depth','axes','composite','keyframePoses','timeDots','floor'] as const).map(key => <label key={key}><input type="checkbox" checked={display[key]} onChange={event => motion.settings({[key]:event.target.checked})} />{{skeleton:'Current Pose',landmarks:'Landmarks',labels:'Joint Labels',confidence:'Confidence',trails:'Wrist Trails',future:'Show Future Trail',ghosts:'Ghost Poses',depth:'Depth',axes:'Axes',composite:'Full Motion Composite (whole clip)',keyframePoses:'Keyframe Poses',timeDots:'Time Dots',floor:'3D reference floor'}[key]}</label>)}
    <label>Trail Joint <select aria-label="Trail Joint" value={display.trailJoint} onChange={event => motion.settings({trailJoint:event.target.value as typeof display.trailJoint})}>{Object.entries({left:'Left Wrist',right:'Right Wrist',wrists:'Both Wrists',elbows:'Elbows',head:'Head',hips:'Hip Center'}).map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label>
    <label>Trail history <select aria-label="Trail history" value={display.trailWindow} onChange={event => motion.settings({trailWindow:Number(event.target.value)})}>{[0,.25,.5,1,2].map(value => <option value={value} key={value}>{value ? `Last ${value} s` : 'Full Motion'}</option>)}</select></label>
    <label>Ghost Count <input aria-label="Ghost Count" type="number" min="1" max="5" value={Math.min(5,display.ghostCount)} onChange={event => motion.settings({ghostCount:Math.max(1,Math.min(5,Number(event.target.value)||1))})} /></label>
    <label>Ghost Interval <select aria-label="Ghost Interval" value={display.ghostInterval} onChange={event=>motion.settings({ghostInterval:Number(event.target.value)})}>{[...new Set([.1,.15,.25,.5,display.ghostInterval])].sort((a,b)=>a-b).map(value=><option key={value} value={value}>{value}s</option>)}</select></label>
    <div className="segmented" aria-label="Motion video fit"><button aria-pressed={display.fit==='contain'} onClick={() => motion.settings({fit:'contain'})}>Fit</button><button aria-pressed={display.fit==='cover'} onClick={() => motion.settings({fit:'cover'})}>Fill</button></div>
    <label><input type="checkbox" checked={clubMode} disabled={!analysis} onChange={event => setClubMode(event.target.checked)} />Experimental Club Head Annotation</label>
    {clubMode && <span className="muted">Pause and click the club head in the source. 2D only.</span>}
    {analysis?.club.length ? <button onClick={() => motion.set({analysis:{...analysis,club:[]}})}>Clear club annotations</button> : null}
  </div></details>;
}
