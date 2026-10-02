import { useEffect, useRef, useState } from 'react';
import { Download, Image, Printer, ScanLine, X } from 'lucide-react';
import { CUBE_MARKER } from '../../../../packages/cube-lab/src/marker.js';
import { testMarkerImage } from '../../../../packages/cube-lab/src/test-marker.js';
import { cubeLab, useCubeLab } from './store.js';

function MarkerDialog({ open, close }: { open: boolean; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close(); }, [open]);
  return <dialog ref={dialog} className="planner-dialog cube-marker-dialog" aria-labelledby="cube-marker-title" onCancel={event => { event.preventDefault(); close(); }}>
    <button className="modal-close" aria-label="Close marker" title="Close marker" onClick={close}><X size={18} /></button>
    <h2 id="cube-marker-title">Marker 101</h2><img src={CUBE_MARKER.image} alt="ArUco MIP 36h12 marker ID 101" />
    <dl><dt>Dictionary</dt><dd>{CUBE_MARKER.dictionary}</dd><dt>Expected ID</dt><dd>101</dd><dt>Black square</dt><dd>40 x 40 mm</dd><dt>White margin</dt><dd>5 mm / side</dd></dl>
    <p>Print the PDF at 100% / Actual size, not Fit to page. Measure the entire black outer square, not the white margin. Enter its measured width in Marker size.</p>
    <div className="cube-button-row"><a className="cube-link-button" href={CUBE_MARKER.image} download><Download size={15} />PNG</a><a className="cube-link-button" href={CUBE_MARKER.svg} download><Download size={15} />SVG</a><a className="cube-link-button" href={CUBE_MARKER.print} target="_blank" rel="noreferrer"><Printer size={15} />Print PDF</a></div>
    <ol><li>Print Marker 101 at 100%.</li><li>Verify the black square's width.</li><li>Attach it flat and centered on the cube.</li><li>Use good lighting and avoid glare.</li><li>Hold the marker 30-80 cm from the fixed webcam, facing the camera.</li><li>Start the webcam, then press Start tracking.</li></ol>
  </dialog>;
}

export function CubeTrackingControls() {
  const s = useCubeLab(); const [showMarker, setShowMarker] = useState(false); const [testing, setTesting] = useState(false); const [testResult, setTestResult] = useState('');
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const testImage = async () => {
    abort.current?.abort(); const controller = new AbortController(); abort.current = controller; setTesting(true); setTestResult('');
    try {
      const result = await testMarkerImage(controller.signal);
      if (!controller.signal.aborted) setTestResult(result.detected && result.markers.some(m => m.id === CUBE_MARKER.id) ? 'SELF-TEST PASS: ID 101 detected from the generated PNG. Live tracking unchanged.' : `SELF-TEST FAILED: detected IDs [${result.markers.map(m => m.id).join(', ')}]. Expected ID 101.`);
    } catch (error) { if (!controller.signal.aborted) setTestResult(`SELF-TEST ERROR: ${error instanceof Error ? error.message : String(error)}`); }
    finally { if (!controller.signal.aborted) setTesting(false); }
  };
  const d = s.debugResult; const wrongIds = d?.markers.filter(m => m.id !== CUBE_MARKER.id).map(m => m.id) ?? [];
  return <section className="property-section cube-tracking-controls">
    <div className="cube-expected">Expected Marker: <strong>ID 101</strong></div>
    <button onClick={() => setShowMarker(true)}><Image size={15} />Show Marker 101</button>
    <div className="cube-vision-status" data-testid="cube-engine">{{ idle: 'Vision stopped', loading: 'Vision engine loading...', ready: 'Vision ready', error: 'Vision engine failed' }[s.engine]}</div>
    <button disabled={s.mode === 'RECORDING'} onClick={() => cubeLab.toggleTracking()}><ScanLine size={15} />{s.enabled ? 'Stop tracking' : 'Start tracking'}</button>
    {d?.detected && d.poseStatus !== 'available' && <p className="cube-pose-warning" role="status" data-testid="cube-pose-unavailable">MARKER FOUND / POSE UNAVAILABLE<br />{d.poseMessage}</p>}
    {wrongIds.length > 0 && !d?.detected && <p className="cube-pose-warning">Detected ID {wrongIds.join(', ')}. Expected ID 101 ({CUBE_MARKER.dictionary}).</p>}
    {s.message && <p className="overlap-warning" role="alert">{s.message}</p>}
    {(s.tracking === 'NOT_FOUND' || s.tracking === 'LOST') && <details className="cube-info cube-troubleshooting"><summary>{s.enabled ? 'Marker not detected' : 'Tracking stopped'}</summary><ul><li>Press Start tracking with webcam video running.</li><li>Use ID 101 from Show Marker 101, family {CUBE_MARKER.dictionary}.</li><li>Keep the full black border and white margin visible.</li><li>Move closer if the marker is too small in the image.</li><li>Check focus, lighting, motion blur and glare.</li></ul></details>}
    <details className="cube-info"><summary>Tracking Diagnostics</summary><label className="check-field"><input type="checkbox" checked={s.debug} onChange={event => cubeLab.set({ debug: event.target.checked })} />Debug Tracking</label>
      <dl><dt>Frames</dt><dd data-testid="cube-frame-count">{s.framesProcessed}</dd><dt>Frame input</dt><dd>{s.frameStatus}</dd><dt>Source</dt><dd>{d?.sourceWidth ?? 0} x {d?.sourceHeight ?? 0}</dd><dt>CV pixels</dt><dd>{d?.width ?? 0} x {d?.height ?? 0}</dd><dt>Vision FPS</dt><dd data-testid="cube-vision-fps">{d?.fps.toFixed(1) ?? '0.0'}</dd><dt>Detected IDs</dt><dd data-testid="cube-detected-ids">{d?.markers.map(m => m.id).join(', ') || 'None'}</dd><dt>Expected ID</dt><dd>101</dd><dt>Detector time</dt><dd>{d?.detectorMs?.toFixed(1) ?? '--'} ms</dd><dt>Luminance</dt><dd>{d?.luminance?.toFixed(1) ?? '--'} / 255</dd><dt>Pose</dt><dd>{d?.poseStatus ?? 'none'}</dd><dt>Preview mirrored</dt><dd>No</dd><dt>Detector mirrored</dt><dd>No</dd></dl>
      <button disabled={testing || s.mode === 'RECORDING'} onClick={() => void testImage()}><ScanLine size={15} />{testing ? 'Testing marker...' : 'Test Marker Image'}</button>
      {testResult && <p className="cube-self-test" role="status" data-testid="cube-self-test">{testResult}</p>}
    </details>
    <MarkerDialog open={showMarker} close={() => setShowMarker(false)} />
  </section>;
}
