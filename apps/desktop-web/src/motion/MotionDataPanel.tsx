import { useEffect, useMemo, useRef, useState } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { estimatedVelocity,spatialJointAt as jointAt,toThree } from '../../../../packages/shared/src/motion.js';
import { useMotion } from './store.js';

export function MotionDataPanel({time}: {time:number}) {
  const {analysis,display} = useMotion(); const [page,setPage] = useState(0);
  const chartHost = useRef<HTMLDivElement>(null), chart = useRef<uPlot | null>(null);
  const [graph,setGraph] = useState<'position'|'speed'>('position');
  const [expanded,setExpanded] = useState(display.view==='data');
  useEffect(()=>{if(display.view==='data')setExpanded(true);},[display.view]);
  const data = useMemo((): uPlot.AlignedData => {
    const samples = analysis?.samples ?? [];
    const times = samples.map(sample => sample.timeSeconds);
    if (graph === 'speed') return [times,...[15,16].map(id => samples.map((_,index) => estimatedVelocity(samples,index,id)))];
    return [times,...(['x','y','z'] as const).map(axis => samples.map(sample => { const point = jointAt(sample,display.selectedJoint); return point ? toThree(point)[axis] : null; }))];
  }, [analysis?.samples,display.selectedJoint,graph]);
  useEffect(() => {
    if (!expanded || !chartHost.current || !data[0].length) return;
    const host = chartHost.current;
    const options: uPlot.Options = { width: Math.max(240,host.clientWidth),height:220,legend:{show:true},cursor:{show:true},scales:{x:{time:false}},axes:[{stroke:'#abb5c5',grid:{stroke:'#303640'}},{stroke:'#abb5c5',grid:{stroke:'#303640'}}],series:[{label:'T (s)'},...(graph === 'speed' ? ['Left wrist estimated speed','Right wrist estimated speed'] : ['X','Y','Z']).map((label,i) => ({label,stroke:['#f9ba68','#7fc5ff','#6ee7b7'][i],width:2,spanGaps:false}))] };
    const plot = new uPlot(options,data,host); chart.current = plot;
    const observer = new ResizeObserver(() => plot.setSize({width:Math.max(240,host.clientWidth),height:220})); observer.observe(host);
    return () => { observer.disconnect(); plot.destroy(); chart.current = null; };
  }, [data,graph,expanded]);
  useEffect(() => { const plot = chart.current; if (plot) plot.setCursor({left:plot.valToPos(time,'x'),top:0}); }, [time]);
  const total = analysis?.samples.length ?? 0, currentPage = Math.min(page,Math.max(0,Math.ceil(total/20)-1));
  return <details className="motion-data" open={expanded} onToggle={event=>setExpanded(event.currentTarget.open)}><summary>Motion Graphs &amp; Data</summary><label>Graph <select aria-label="Motion graph" value={graph} onChange={event => setGraph(event.target.value as 'position'|'speed')}><option value="position">Selected joint X / Y / Z</option><option value="speed">Estimated wrist speeds</option></select></label><div ref={chartHost} className="motion-chart" /><div className="motion-table-scroll"><table><thead><tr>{['T (s)','Joint','X','Y','Z','Confidence'].map(title => <th key={title}>{title}</th>)}</tr></thead><tbody>{analysis?.samples.slice(currentPage*20,currentPage*20+20).map(sample => { const point = jointAt(sample,display.selectedJoint), xyz = point && toThree(point); return <tr key={sample.timeSeconds}><td>{sample.timeSeconds.toFixed(3)}</td><td>{display.selectedJoint === 33 ? 'Hip center' : analysis.analysis.landmarkNames[display.selectedJoint]}</td><td>{xyz?.x.toFixed(3) ?? '--'}</td><td>{xyz?.y.toFixed(3) ?? '--'}</td><td>{xyz?.z.toFixed(3) ?? '--'}</td><td>{point?.visibility.toFixed(2) ?? '--'}</td></tr>; })}</tbody></table></div><div className="motion-actions"><button disabled={currentPage===0} onClick={() => setPage(currentPage-1)}>Previous</button><span>Page {currentPage+1} / {Math.max(1,Math.ceil(total/20))}</span><button disabled={(currentPage+1)*20>=total} onClick={() => setPage(currentPage+1)}>Next</button></div></details>;
}
