import assert from 'node:assert/strict';
import { mkdir,readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import ffprobe from 'ffprobe-static';
import { chromium,type Page } from 'playwright';
import { spatialBounds } from '../packages/shared/src/research-spatial.js';
import { researchAnalysisSchema,researchIdentity,researchFrameAt } from '../packages/shared/src/research.js';

// Real local inference and real media only. CI fixtures are tested separately.
const base=process.env.RESEARCH_URL??'http://localhost:5173';
if(!['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname))throw new Error('Research verification must use localhost');
const response=await fetch(`${base}/api/motion/demo/info`),info=await response.json();assert(response.ok&&info.status==='ready','A prepared local video is required');
const settings={fps:5 as const,threshold:.23},id=await researchIdentity(info.id,settings);
let cached=await fetch(`${base}/api/motion/research/analyses/${id}`);
const reused=cached.ok;
const reanalyze=process.env.RESEARCH_REANALYZE==='1';
if(!cached.ok){
  const start=await fetch(`${base}/api/motion/research/jobs`,{method:'POST',headers:{'Content-Type':'application/json','x-livespace-client':'desktop'},body:JSON.stringify({sourceId:info.id,settings})});assert(start.ok,await start.text());
  for(let attempt=0;attempt<1800;attempt++){
    const job=await(await fetch(`${base}/api/motion/research/jobs/${id}`)).json();
    if(job.status==='complete')break;
    assert.equal(job.status,'running',job.error??'Research inference stopped');
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  cached=await fetch(`${base}/api/motion/research/analyses/${id}`);
}
assert(cached.ok,'Research analysis did not complete');
let data=researchAnalysisSchema.parse(await cached.json());
const masks=data.frames.flatMap(frame=>frame.subjects).filter(subject=>subject.mask.length).length;
assert.equal(data.video.id,info.id);assert(data.tracks.length>=2,'Current wildlife clip must produce multiple tracks');assert(masks>10,'Real segmentation is required');assert(data.frames.some(frame=>frame.subjects.filter(subject=>subject.worldEstimate).length>=2));
await mkdir(resolve('test-results'),{recursive:true});
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1920,height:1080},acceptDownloads:true});
await context.route('**/*',route=>['localhost','127.0.0.1','[::1]'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
const page=await context.newPage(),errors:string[]=[],inferenceRequests:string[]=[];
page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith('/research/jobs'))inferenceRequests.push(request.url());});
async function pixels(page:Page,selector:string){return page.locator(selector).evaluate(element=>{const canvas=element as HTMLCanvasElement,copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;const ctx=copy.getContext('2d')!;ctx.drawImage(canvas,0,0);const bytes=ctx.getImageData(0,0,copy.width,copy.height).data;let colored=0,hash=2166136261;for(let i=0;i<bytes.length;i+=4){if(Math.max(bytes[i],bytes[i+1],bytes[i+2])>80)colored++;hash=Math.imul(hash^bytes[i]^bytes[i+1]^bytes[i+2],16777619);}return {colored,hash,width:copy.width,height:copy.height,time:Number(canvas.dataset.time),subjects:Number(canvas.dataset.subjects)};});}
const overlay='.research-video-stage canvas',scene='.research-3d-stage canvas';
async function seek(time:number){await page.getByRole('slider',{name:'Research time',exact:true}).fill(String(time));await page.waitForFunction(t=>Math.abs(Number(document.querySelector<HTMLCanvasElement>('.research-3d-stage canvas')?.dataset.time)-t)<.002,time);await page.waitForTimeout(120);}
async function capture(mode:string,extension:string){await page.getByRole('combobox',{name:'Research Export',exact:true}).selectOption(mode);const pending=page.waitForEvent('download',{timeout:60000});await page.getByRole('button',{name:'Export research data',exact:true}).click();const download=await pending,path=resolve(`test-results/research-real-${mode}.${extension}`);await download.saveAs(path);const bytes=await readFile(path);assert(bytes.length>100);return {path,bytes};}
try{
  await page.goto(`${base}/research`);await page.waitForFunction(()=>document.querySelector('.research-analysis')?.textContent?.includes('cache hit'));
  if(reanalyze){await page.getByRole('button',{name:'Reanalyze',exact:true}).click();await page.getByRole('button',{name:'Cancel Analysis',exact:true}).waitFor();await page.waitForFunction(()=>!document.querySelector('.research-progress')&&document.querySelector('.research-analysis')?.textContent?.includes('samples /'),undefined,{timeout:300000});assert(!(await page.getByRole('alert').count()),'Fresh real inference must load without errors');}
  assert.equal(await page.getByRole('button',{name:'Split',exact:true}).getAttribute('aria-pressed'),'true');
  if(reanalyze){data=researchAnalysisSchema.parse(await(await fetch(`${base}/api/motion/research/analyses/${id}`)).json());assert.match(data.sourceHash??'',/^[a-f0-9]{64}$/);}
  await page.getByText('Spatial Controls',{exact:true}).click();await page.locator('.research-inspector summary').click();
  await seek(0);
  assert.equal(await page.locator(scene).getAttribute('data-heatmap-scope'),'clip');
  await page.waitForFunction(()=>Number(document.querySelector<HTMLCanvasElement>('.research-3d-stage canvas')?.dataset.heatmapBins)>0);
  const clipBins=await page.locator(scene).getAttribute('data-heatmap-bins');
  await page.locator('.research-spatial').screenshot({path:'test-results/research-real-spatial-zero.png'});
  const t=Math.min(5,data.video.duration*.4);await seek(t);
  assert.equal(await page.locator(scene).getAttribute('data-track-ids'),await page.locator(overlay).getAttribute('data-track-ids'));
  assert.equal(await page.locator(scene).getAttribute('data-heatmap-bins'),clipBins);
  assert(Number(await page.locator(scene).getAttribute('data-path-segments'))>0);
  const pastSegments=Number(await page.locator(scene).getAttribute('data-path-segments'));
  await page.getByRole('combobox',{name:'Spatial Trajectory'}).selectOption('full');
  await page.waitForFunction(()=>Number(document.querySelector<HTMLCanvasElement>('.research-3d-stage canvas')?.dataset.laterRecordedSegments)>0);
  assert(Number(await page.locator(scene).getAttribute('data-path-segments'))>pastSegments);
  await page.locator('.research-spatial').screenshot({path:'test-results/research-real-spatial-full.png'});
  await page.getByRole('combobox',{name:'Spatial Trajectory'}).selectOption('past');
  const frame=researchFrameAt(data,t)!;assert(frame.subjects.length>=2);
  const before=await pixels(page,scene),videoPixels=await pixels(page,overlay);assert(before.colored>500);assert(videoPixels.colored>100);assert.equal(before.subjects,frame.subjects.length);
  const target=frame.subjects[0],bounds=(await page.locator(overlay).boundingBox())!,imageHeight=Math.min(bounds.height,bounds.width*data.video.height/data.video.width),imageWidth=imageHeight*data.video.width/data.video.height;
  await page.locator(overlay).click({position:{x:(bounds.width-imageWidth)/2+target.center2D.x*imageWidth,y:(bounds.height-imageHeight)/2+target.center2D.y*imageHeight}});
  assert(await page.getByRole('combobox',{name:'Selected Research Subject'}).inputValue());
  const mapRect=(await page.locator(scene).boundingBox())!,mapBox=spatialBounds(data,'top'),p=target.worldEstimate!;
  await page.locator(scene).click({position:{x:32+(p.x-mapBox.x)/mapBox.w*(mapRect.width-64),y:mapRect.height-80-(p.z-mapBox.z)/mapBox.h*(mapRect.height-112)}});
  assert.equal(await page.getByRole('combobox',{name:'Selected Research Subject'}).inputValue(),String(target.id));
  await page.waitForFunction(()=>document.querySelector<HTMLCanvasElement>('.research-3d-stage canvas')?.dataset.selected===document.querySelector<HTMLCanvasElement>('.research-video-stage canvas')?.dataset.selected);
  await page.getByRole('combobox',{name:'Selected Research Subject'}).selectOption(String(target.id));await page.getByRole('combobox',{name:'Compare Research Subject'}).selectOption(String(frame.subjects.find(subject=>subject.id!==target.id)!.id));
  assert((await page.locator('.research-pair').textContent())?.includes('Paired observations'));
  const next=Math.min(t+2,data.video.duration-.5);await seek(next);const after=await pixels(page,scene);assert.notEqual(before.hash,after.hash,'3D proxies must move with time');await seek(t);
  await page.getByRole('button',{name:'Next research frame',exact:true}).click();await page.waitForTimeout(150);assert(Math.abs(await page.locator('video').evaluate(video=>(video as HTMLVideoElement).currentTime)-(t+1/data.video.fps))<.005);
  await seek(t);await page.getByRole('button',{name:'Play research video',exact:true}).click();await page.waitForTimeout(350);await page.getByRole('button',{name:'Pause research video',exact:true}).click();const live=await page.locator('video').evaluate(video=>(video as HTMLVideoElement).currentTime);assert(Math.abs((await pixels(page,scene)).time-live)<.1);assert(Math.abs((await pixels(page,overlay)).time-live)<.1);
  await seek(t);await page.getByText('Display & Analysis',{exact:true}).click();
  for(const name of ['Masks','3D Trajectories','Uncertainty'])assert(await page.getByRole('checkbox',{name,exact:true}).isChecked());
  assert.equal(await page.locator(scene).getAttribute('data-spatial-mode'),'top');
  await page.getByRole('combobox',{name:'Activity Heatmap'}).selectOption('all');
  await page.waitForFunction(()=>Number(document.querySelector<HTMLCanvasElement>('.research-3d-stage canvas')?.dataset.heatmapBins)>0);
  await page.getByRole('checkbox',{name:'Full Track History / Recorded Clip'}).check();
  assert(await page.locator('video').evaluate(v=>(v as HTMLVideoElement).paused));
  await page.getByRole('checkbox',{name:'Full Track History / Recorded Clip'}).uncheck();
  await page.getByRole('combobox',{name:'Activity Heatmap'}).selectOption('all');
  await page.getByText('Manual Research Reference / Optional',{exact:true}).click();
  await page.getByRole('spinbutton',{name:'Known Research Distance'}).fill('2');
  for(const [name,x] of [['Reference Point A',.42],['Reference Point B',.58]] as const){
    await page.getByRole('button',{name,exact:true}).click();const rect=(await page.locator(overlay).boundingBox())!;
    await page.locator(overlay).click({position:{x:rect.width*x,y:rect.height*.57}});
  }
  assert((await page.locator('.research-calibration').textContent())?.includes('approximate metres'));
  await page.getByRole('button',{name:'Clear research reference'}).click();
  await page.getByText('Manual Research Reference / Optional',{exact:true}).click();
  await page.getByRole('combobox',{name:'Mask Style',exact:true}).selectOption('both');await page.getByRole('checkbox',{name:'3D Labels',exact:true}).check();
  await page.getByRole('button',{name:'Fullscreen research presentation',exact:true}).click();await page.waitForFunction(()=>document.fullscreenElement?.contains(document.querySelector('.research-timeline')));await page.screenshot({path:'test-results/research-real-fullscreen.png'});await page.evaluate(()=>document.exitFullscreen());
  for(const track of data.tracks){await page.getByRole('combobox',{name:'Selected Research Subject'}).selectOption(String(track.id));await page.waitForFunction(id=>document.querySelector<HTMLCanvasElement>('.research-3d-stage canvas')?.dataset.selected===String(id),track.id);assert.equal(await page.locator(overlay).getAttribute('data-selected'),String(track.id));}
  await page.getByRole('combobox',{name:'Selected Research Subject'}).selectOption('1');await page.getByRole('combobox',{name:'Compare Research Subject'}).selectOption('4');
  await page.getByText('Visual Refinement',{exact:true}).click();
  const builds=await page.locator(scene).getAttribute('data-density-builds');await seek(t+1);assert.equal(await page.locator(scene).getAttribute('data-density-builds'),builds,'Whole-clip density must not rebuild per video frame');await seek(t);
  await page.getByRole('combobox',{name:'Density Smoothing'}).selectOption('high');await page.waitForTimeout(150);assert.notEqual(await page.locator(scene).getAttribute('data-density-builds'),builds);
  await page.getByRole('combobox',{name:'Density Smoothing'}).selectOption('medium');
  await page.getByRole('combobox',{name:'Temporal Window'}).selectOption('2');await page.waitForTimeout(150);assert.equal(await page.locator(scene).getAttribute('data-heatmap-scope'),'recent');
  await page.getByRole('spinbutton',{name:'Analysis Range Start'}).fill('4');await page.getByRole('spinbutton',{name:'Analysis Range End'}).fill('9.5');await page.waitForTimeout(150);assert.equal(await page.locator(scene).getAttribute('data-heatmap-scope'),'range');
  await page.getByRole('button',{name:'Data',exact:true}).click();await page.getByRole('combobox',{name:'Research Graph'}).selectOption('distance');assert.equal(await page.locator('.research-chart').getAttribute('data-range'),'4:9.5');assert(Number(await page.locator('.research-chart').getAttribute('data-valid-points'))>=2);
  const graph=page.locator('.research-chart .u-over'),graphRect=(await graph.boundingBox())!;await graph.click({position:{x:graphRect.width*.7,y:graphRect.height*.5}});await page.waitForTimeout(150);const graphT=await page.locator('video').evaluate(v=>(v as HTMLVideoElement).currentTime);assert(graphT>=4&&graphT<=9.5);assert(Math.abs(Number(await page.locator('.research-chart').getAttribute('data-cursor-time'))-graphT)<.1);
  await page.getByRole('button',{name:'Split',exact:true}).click();await page.getByRole('button',{name:'Clear Analysis Range'}).click();await page.getByRole('combobox',{name:'Temporal Window'}).selectOption('0');await seek(t);
  await page.getByText('Manual Notes / Bookmarks',{exact:true}).click();await page.getByRole('textbox',{name:'Manual Note'}).fill('Verification annotation / not an AUTO event');await page.getByRole('button',{name:'Add Note at T',exact:true}).click();await page.getByRole('button',{name:'Add Bookmark',exact:true}).click();assert((await page.locator('.research-notes').textContent())?.includes('MANUAL NOTE'));
  await page.locator('.research-inspector summary').click();await page.getByRole('button',{name:'Presentation Mode',exact:true}).click();assert(!await page.locator('.research-spatial-config').isVisible());assert(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight));await page.screenshot({path:'test-results/research-real-presentation-screen.png'});await page.getByRole('button',{name:'Exit presentation mode'}).click();await page.locator('.research-inspector summary').click();
  await page.screenshot({path:'test-results/research-real-desktop.png',fullPage:true});await page.locator('.research-spatial').screenshot({path:'test-results/research-real-spatial-desktop.png'});
  const report=await capture('report','json');assert.equal(JSON.parse(report.bytes.toString()).id,id);const frames=await capture('frames','json');assert.equal(JSON.parse(frames.bytes.toString()).length,data.frames.length);
  assert((await capture('markdown','md')).bytes.toString().includes('## Closest Approaches'));
  for(const mode of ['tracks','events','pairs'])assert((await capture(mode,'csv')).bytes.toString().includes('time_seconds'));
  for(const mode of ['video','3d','split','snapshot','presentation','heatmap']){const output=await capture(mode,'png');assert.equal(output.bytes.subarray(1,4).toString(),'PNG');}
  assert((await capture('heatmap-csv','csv')).bytes.toString().includes('subject'));
  await page.getByRole('combobox',{name:'Research Export'}).selectOption('annotated');await page.getByRole('button',{name:'Export research data'}).click();await page.getByRole('button',{name:'Cancel annotated export'}).click();await page.getByRole('button',{name:'Export research data'}).waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('[aria-label="Cancel annotated export"]'));
  const annotated=await capture('annotated','webm'),probe=JSON.parse(execFileSync(ffprobe.path,['-v','error','-count_frames','-show_streams','-of','json',annotated.path],{encoding:'utf8',windowsHide:true}));assert(probe.streams.some((stream:{codec_type:string;nb_read_frames:string})=>stream.codec_type==='video'&&Number(stream.nb_read_frames)>30));
  const converted=await capture('annotated-mp4','mp4'),mp4Probe=JSON.parse(execFileSync(ffprobe.path,['-v','error','-count_frames','-show_streams','-of','json',converted.path],{encoding:'utf8',windowsHide:true}));assert(mp4Probe.streams.some((s:{codec_name:string;nb_read_frames:string})=>s.codec_name==='h264'&&Number(s.nb_read_frames)>30));
  for(const name of ['Subjects','Events','Metrics','Pairs','Depth','Diagnostics']){await page.getByRole('button',{name:'Data',exact:true}).click();await page.getByRole('tab',{name,exact:true}).click();assert(await page.getByRole('tabpanel',{name,exact:true}).isVisible());}
  assert((await page.getByRole('tabpanel',{name:'Diagnostics'}).textContent())?.includes('cached data only'));
  await page.getByRole('button',{name:'Split',exact:true}).click();await page.getByRole('combobox',{name:'Spatial View',exact:true}).selectOption('3d');await page.getByRole('combobox',{name:'Research camera preset'}).selectOption('Side');await page.waitForTimeout(200);assert((await pixels(page,scene)).colored>500);await page.getByRole('button',{name:'Reset research camera'}).click();await page.waitForTimeout(120);const threeBefore=await pixels(page,scene);await seek(next);assert.notEqual((await pixels(page,scene)).hash,threeBefore.hash,'Estimated 3D subjects must change with observed T');await seek(t);
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);await page.screenshot({path:'test-results/research-real-mobile.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert((await pixels(page,scene)).colored>100);assert((await pixels(page,overlay)).colored>100);
  await page.getByRole('combobox',{name:'Spatial View',exact:true}).selectOption('auto');await page.waitForTimeout(150);await page.locator('.research-spatial').screenshot({path:'test-results/research-real-spatial-mobile.png'});
  for(const mode of ['Video','3D Research']){await page.getByRole('button',{name:mode,exact:true}).click();await page.waitForTimeout(150);assert((await pixels(page,mode==='Video'?overlay:scene)).colored>100);}
  await page.reload();await page.waitForFunction(()=>document.querySelector('.research-analysis')?.textContent?.includes('cache hit'));assert.equal(inferenceRequests.length,reanalyze?1:0,'Only explicit reanalysis may start inference');assert.deepEqual(errors,[]);
  console.log(JSON.stringify({source:info.name,frames:data.frames.length,tracks:data.tracks.length,masks,events:data.events.length,device:data.runtime.device,reusedCache:reused,synchronized:true,moving3D:true,autoTopDown:true,wholeClipOccupancyAtZero:true,observedPastAndFullModes:true,sameTrackIds:true,rightSelectionMatches:true,activityHeatmap:true,manualReference:true,mobileNonblank:true,fullscreen:true,exports:15,smoothDensity:true,densityCached:true,rangeAnalysis:true,graphSeek:true,manualAnnotations:true,presentationFits1080:true,h264VideoDecoded:true,annotatedVideoDecoded:true,noPlaybackInference:true,privateOutputs:'test-results (ignored)'},null,2));
}finally{await context.close();await browser.close();}
