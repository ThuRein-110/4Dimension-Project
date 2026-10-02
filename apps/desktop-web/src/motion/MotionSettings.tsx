import { motion,useMotion } from './store.js';

export function MotionSettings({ clubMode,setClubMode }: { clubMode: boolean; setClubMode: (value: boolean) => void }) {
  const { display,analysis } = useMotion();
  return <details className="motion-settings"><summary>Display &amp; Trails</summary><div>
    {(['skeleton','landmarks','labels','confidence','trails','future','ghosts','floor'] as const).map(key => <label key={key}><input type="checkbox" checked={display[key]} onChange={event => motion.settings({[key]:event.target.checked})} />{{skeleton:'Pose Skeleton',landmarks:'Landmarks',labels:'Joint Labels',confidence:'Confidence',trails:'Motion Trail',future:'Show Future Trail',ghosts:'Ghost Poses',floor:'Reference floor'}[key]}</label>)}
    <label>Trail history <select aria-label="Trail history" value={display.trailWindow} onChange={event => motion.settings({trailWindow:Number(event.target.value)})}>{[0,.25,.5,1,2].map(value => <option value={value} key={value}>{value ? `Last ${value} s` : 'Full history'}</option>)}</select></label>
    <label>Ghost Count <input aria-label="Ghost Count" type="number" min="1" max="8" value={display.ghostCount} onChange={event => motion.settings({ghostCount:Math.max(1,Math.min(8,Number(event.target.value)||1))})} /></label>
    <label>Ghost Interval <input aria-label="Ghost Interval" type="number" min=".05" max="2" step=".05" value={display.ghostInterval} onChange={event => motion.settings({ghostInterval:Math.max(.05,Math.min(2,Number(event.target.value)||.2))})} /></label>
    <div className="segmented" aria-label="Motion video fit"><button aria-pressed={display.fit==='contain'} onClick={() => motion.settings({fit:'contain'})}>Fit</button><button aria-pressed={display.fit==='cover'} onClick={() => motion.settings({fit:'cover'})}>Fill</button></div>
    <label><input type="checkbox" checked={clubMode} disabled={!analysis} onChange={event => setClubMode(event.target.checked)} />Experimental Club Head Annotation</label>
    {clubMode && <span className="muted">Pause and click the club head in the source. 2D only.</span>}
    {analysis?.club.length ? <button onClick={() => motion.set({analysis:{...analysis,club:[]}})}>Clear club annotations</button> : null}
  </div></details>;
}
