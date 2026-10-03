import { estimatedVelocity,type MotionAnalysis } from '../../../../packages/shared/src/motion.js';
import { contentRect } from '../../../../packages/three-engine/src/CameraProjectionManager.js';
import { motion } from './store.js';
import { overlaySelection } from './MotionVideoView.js';
import { MotionProjectionService } from './MotionProjectionService.js';
import { renderMotionOverlay } from './MotionOverlayRenderer.js';

function download(blob: Blob,name: string) { const url = URL.createObjectURL(blob),anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url),1000); }
export function exportAnalysis(data: MotionAnalysis) {
  const velocities = data.samples.map((sample,index) => ({timeSeconds:sample.timeSeconds,leftWrist:estimatedVelocity(data.samples,index,15),rightWrist:estimatedVelocity(data.samples,index,16)}));
  download(new Blob([JSON.stringify({...data,derived:{...data.derived,estimatedWristVelocities:velocities,velocityUnits:'model units/s; not calibrated'}})],{type:'application/json'}),`4DLiveSpace_${data.video.name.replace(/[^a-z0-9_-]/gi,'_')}_motion.json`);
}
export function exportScreenshot(video: HTMLVideoElement | null,mode: 'original'|'video'|'3d'|'split',fit:'contain'|'cover') {
  if (!video?.videoWidth || video.readyState < 2) throw new Error('No decoded video frame available.');
  const three = document.querySelector<HTMLCanvasElement>('.motion-3d-stage canvas');
  if ((mode === '3d' || mode === 'split') && !three) throw new Error('The 3D canvas is unavailable.');
  const output = document.createElement('canvas');
  if(mode==='original'){
    output.width=video.videoWidth;output.height=video.videoHeight;output.getContext('2d')!.drawImage(video,0,0);
    output.toBlob(blob=>{if(blob)download(blob,`4DLiveSpace_motion_original_${video.currentTime.toFixed(3)}s.png`);},'image/png');return;
  }
  output.width = mode === 'split' ? 1600 : 1000;
  output.height = mode==='split' ? 850 : Math.round(1000*(mode==='3d'&&three ? three.height/three.width : video.clientHeight/video.clientWidth))+60;
  const context = output.getContext('2d')!; context.fillStyle = '#111318'; context.fillRect(0,0,output.width,output.height);
  const width = mode === 'split' ? output.width/2 : output.width;
  const drawSource = () => {
    const stageWidth = video.clientWidth,stageHeight = video.clientHeight;
    const composite = document.createElement('canvas'); composite.width = stageWidth*2; composite.height = stageHeight*2;
    const ctx = composite.getContext('2d')!,rect = contentRect(composite.width,composite.height,video.videoWidth,video.videoHeight,fit);
    ctx.drawImage(video,rect.x,rect.y,rect.width,rect.height);
    const layer=document.createElement('canvas');layer.width=composite.width;layer.height=composite.height;const state=motion.get(),layerContext=layer.getContext('2d')!;layerContext.scale(2,2);renderMotionOverlay(layerContext,new MotionProjectionService(stageWidth,stageHeight,video.videoWidth,video.videoHeight,fit),state.analysis,state.display,video.currentTime,overlaySelection);ctx.drawImage(layer,0,0);
    const placed = contentRect(width,output.height-60,composite.width,composite.height,'contain'); context.drawImage(composite,placed.x,placed.y+40,placed.width,placed.height);
  };
  if (mode !== '3d') drawSource();
  if ((mode === '3d' || mode === 'split') && three) { const rect = contentRect(width,output.height-60,three.width,three.height,'contain'); context.drawImage(three,rect.x+(mode==='split'?width:0),rect.y+40,rect.width,rect.height); }
  context.fillStyle = '#e5e8ef'; context.font = '18px sans-serif'; context.fillText(`4D LiveSpace / Estimated Motion / T ${video.currentTime.toFixed(3)} s`,20,26);
  output.toBlob(blob => { if (blob) download(blob,`4DLiveSpace_motion_${mode}_${video.currentTime.toFixed(3)}s.png`); },'image/png');
}
