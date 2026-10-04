import { test,expect,type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync,readFileSync,unlinkSync,rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpeg from 'ffmpeg-static';
import { researchFixture } from '../fixtures/research.js';
import { researchIdentity } from '../../packages/shared/src/research.js';
import { spatialBounds } from '../../packages/shared/src/research-spatial.js';
import { refineResearch } from '../../packages/shared/src/research-refinement.js';

// CI-only generated media/results. Never presented as real animal inference.
const directory=mkdtempSync(join(tmpdir(),'research-ci-')),file=join(directory,'fixture.mp4');
execFileSync(ffmpeg!,['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=gray:s=160x240:r=10:d=1','-an','-c:v','libx264','-bf','0','-pix_fmt','yuv420p','-movflags','+faststart',file],{windowsHide:true});
const videoBytes=readFileSync(file);unlinkSync(file);rmdirSync(directory);
async function fixtureApp(page:Page,cached=true,transform?:(data:Awaited<ReturnType<typeof researchFixture>>)=>void){
  let data=await researchFixture(),running=false,cancelled=false,starts=0;
  transform?.(data);
  await page.route('**/api/motion/demo/info',route=>route.fulfill({json:{...data.video,status:'ready',prepared:false,url:'/api/motion/research-ci-video'}}));
  await page.route('**/api/motion/research-ci-video',route=>{
    const range=route.request().headers().range?.match(/^bytes=(\d+)-(\d*)$/);
    if(!range)return route.fulfill({body:videoBytes,contentType:'video/mp4'});
    const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),videoBytes.length-1):videoBytes.length-1;
    return route.fulfill({status:206,body:videoBytes.subarray(start,end+1),contentType:'video/mp4',headers:{'Content-Range':`bytes ${start}-${end}/${videoBytes.length}`,'Accept-Ranges':'bytes'}});
  });
  await page.route('**/api/motion/research/runtime',route=>route.fulfill({json:{available:true}}));
  await page.route('**/api/motion/research/analyses/*',route=>route.request().url().endsWith(data.id)&&cached?route.fulfill({json:data}):route.fulfill({status:404,json:{error:'No CI cache'}}));
  await page.route('**/api/motion/research/jobs',route=>{starts++;running=true;cancelled=false;return route.fulfill({json:{id:data.id,sourceId:data.video.id,status:'running',stage:'CI-only job',done:0,total:5,subjects:0,cacheHit:false}});});
  await page.route('**/api/motion/research/jobs/**',route=>{if(route.request().url().endsWith('/cancel')){running=false;cancelled=true;}return route.fulfill({json:{id:data.id,sourceId:data.video.id,status:running?'running':cancelled?'cancelled':'complete',stage:running?'CI-only job':cancelled?'cancelled':'complete',done:running?1:5,total:5,subjects:2,cacheHit:false}});});
  await page.goto('/research');await expect(page.getByRole('button',{name:'Analyze Wildlife',exact:true})).toBeEnabled();
  if(cached&&data.tracks.length){await expect(page.locator('.research-analysis')).toContainText('cache hit');await page.getByText('Spatial Controls',{exact:true}).click();await page.locator('.research-inspector summary').click();}
  return {get data(){return data;},get starts(){return starts;},complete(){running=false;cached=true;},async changeSource(){data=await researchFixture('b'.repeat(64));cached=false;}};
}
test('research cached playback, temporal selection, masks, pair metrics, views and exports',async({page})=>{
  const app=await fixtureApp(page);await expect(page.locator('.research-analysis')).toContainText('5 samples / 2 tracks / cache hit');
  await expect(page.getByRole('button',{name:'Split',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('slider',{name:'Research time',exact:true}).fill('0.4');
  await expect(page.locator('.research-3d-stage canvas')).toHaveAttribute('data-sample-time','0.4');await expect(page.locator('.research-video-stage canvas')).toHaveAttribute('data-subjects','2');
  await page.getByRole('combobox',{name:'Selected Research Subject'}).selectOption('1');await page.getByRole('combobox',{name:'Compare Research Subject'}).selectOption('2');
  await expect(page.locator('.research-pair')).toContainText('Paired observations');await expect(page.locator('.research-inspector')).toContainText('Facing');
  await page.getByRole('spinbutton',{name:'Analysis Range Start'}).fill('.2');await page.getByRole('spinbutton',{name:'Analysis Range End'}).fill('.6');
  await page.getByRole('button',{name:'Next research frame',exact:true}).click();await expect.poll(()=>page.locator('video').evaluate(video=>(video as HTMLVideoElement).currentTime)).toBeCloseTo(.5);
  await page.getByText('Display & Analysis',{exact:true}).click();
  for(const name of ['Masks','3D Trajectories','Uncertainty'])await expect(page.getByRole('checkbox',{name,exact:true})).toBeChecked();
  await page.getByRole('combobox',{name:'Mask Style'}).selectOption('both');await page.getByRole('checkbox',{name:'Relative Depth Map',exact:true}).check();await page.getByRole('checkbox',{name:'3D Labels',exact:true}).check();await page.getByRole('button',{name:'Fill',exact:true}).click();await page.getByRole('button',{name:'Fit',exact:true}).click();
  await page.getByRole('button',{name:'Fullscreen research presentation',exact:true}).click();await expect.poll(()=>page.evaluate(()=>document.fullscreenElement?.contains(document.querySelector('.research-timeline')))).toBe(true);await page.evaluate(()=>document.exitFullscreen());
  for(const mode of ['report','frames','tracks','events','pairs','markdown','snapshot','video','3d','split','presentation','heatmap','heatmap-csv','annotated']){
    await page.getByRole('combobox',{name:'Research Export'}).selectOption(mode);const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export research data'}).click();const download=await pending,bytes=readFileSync((await download.path())!);expect(bytes.length).toBeGreaterThan(100);if(mode==='report')expect(JSON.parse(bytes.toString()).id).toBe(app.data.id);if(mode==='frames')expect(JSON.parse(bytes.toString())).toHaveLength(5);if(['video','3d','split','snapshot'].includes(mode))expect(bytes.subarray(1,4).toString()).toBe('PNG');
  }
  await page.getByRole('button',{name:'Data',exact:true}).click();
  for(const name of ['Subjects','Events','Metrics','Pairs','Depth','Diagnostics']){await page.getByRole('tab',{name,exact:true}).click();await expect(page.getByRole('tabpanel',{name,exact:true})).toBeVisible();}
  await expect(page.getByRole('tabpanel',{name:'Diagnostics'})).toContainText('cached data only');
  await page.getByRole('button',{name:'Split',exact:true}).click();await page.setViewportSize({width:390,height:844});await expect(page.locator('.research-3d-stage canvas')).toBeVisible();await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.reload();await expect(page.locator('.research-analysis')).toContainText('cache hit');expect(app.starts).toBe(0);
});

test('optional MP4 conversion failure downloads the original WebM',async({page})=>{
  await fixtureApp(page);await page.route('**/api/motion/research/export/mp4',route=>route.fulfill({status:422,json:{error:'CI conversion unavailable'}}));
  await page.getByRole('combobox',{name:'Research Export',exact:true}).selectOption('annotated-mp4');
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export research data',exact:true}).click();
  expect((await pending).suggestedFilename()).toMatch(/\.webm$/);
  await expect(page.getByRole('alert')).toContainText('exported silent WebM instead');
});

test('research jobs can complete or cancel; replacing the source removes old analysis and selection',async({page})=>{
  const app=await fixtureApp(page,false);await page.getByRole('button',{name:'Analyze Wildlife',exact:true}).click();await expect(page.getByRole('button',{name:'Cancel Analysis',exact:true})).toBeVisible();await page.getByRole('button',{name:'Cancel Analysis',exact:true}).click();await expect(page.locator('.research-analysis')).toContainText('cancelled');
  await page.getByRole('button',{name:'Analyze Wildlife',exact:true}).click();await expect(page.getByRole('button',{name:'Cancel Analysis',exact:true})).toBeVisible();app.complete();await expect(page.locator('.research-analysis')).toContainText('5 samples / 2 tracks');
  await page.locator('.research-inspector summary').click();await page.getByRole('combobox',{name:'Selected Research Subject'}).selectOption('1');await page.getByRole('combobox',{name:'Compare Research Subject'}).selectOption('2');
  await app.changeSource();await page.getByRole('button',{name:'Refresh source video',exact:true}).click();await expect(page.locator('.research-inspector')).toHaveCount(0);await expect(page.locator('.research-3d-stage canvas')).toHaveAttribute('data-subjects','0');
  await expect(page.getByRole('button',{name:'Export research data'})).toBeDisabled();expect(app.data.id).toBe(await researchIdentity('b'.repeat(64),app.data.settings));
});

test('corrupt research cache is reported without displaying stale animal geometry',async({page})=>{
  await fixtureApp(page,false);await page.route('**/api/motion/research/analyses/*',route=>route.fulfill({status:422,json:{error:'Invalid CI cache'}}));await page.reload();await expect(page.getByRole('alert')).toContainText('cache is invalid');await expect(page.locator('.research-3d-stage canvas')).toHaveAttribute('data-subjects','0');
});

test('AUTO gates weak and absent depth without empty geometry or unsupported graphs',async({page})=>{
  await fixtureApp(page,true,data=>{for(const frame of data.frames){for(const subject of frame.subjects){subject.depthEstimate={value:null,confidence:null,method:'CI unavailable'};subject.worldEstimate=null;subject.velocity=null;subject.heading=null;}}});
  await expect(page.locator('.research-3d-stage canvas')).toHaveAttribute('data-spatial-mode','image');
  await page.getByRole('slider',{name:'Research time',exact:true}).fill('0.4');
  await page.getByRole('combobox',{name:'Selected Research Subject'}).selectOption('1');
  await page.getByRole('button',{name:'Data',exact:true}).click();
  await expect(page.getByRole('tab',{name:'Depth',exact:true})).toHaveCount(0);
  await expect(page.getByRole('combobox',{name:'Research Graph'}).locator('option')).toHaveText(['Detection Score']);
  await expect(page.locator('.research-chart')).toHaveAttribute('data-valid-points','5');
  await expect(page.locator('.research-inspector')).not.toContainText('NaN');
});

test('AUTO, heatmaps, smoothing and optional manual references use recorded samples',async({page})=>{
  await fixtureApp(page);
  await page.getByRole('slider',{name:'Research time',exact:true}).fill('0.4');
  await expect(page.locator('.research-3d-stage canvas')).toHaveAttribute('data-spatial-mode','top');
  await page.getByText('Display & Analysis',{exact:true}).click();
  await page.getByRole('combobox',{name:'Temporal Smoothing'}).selectOption('high');
  await page.getByRole('combobox',{name:'Activity Heatmap'}).selectOption('all');
  await expect.poll(()=>page.locator('.research-3d-stage canvas').getAttribute('data-heatmap-bins')).not.toBe('0');
  await page.getByRole('checkbox',{name:'Full Track History / Recorded Clip'}).check();
  await expect.poll(()=>page.locator('video').evaluate(v=>(v as HTMLVideoElement).paused)).toBe(true);
  await page.getByText('Manual Research Reference / Optional',{exact:true}).click();
  await page.getByRole('spinbutton',{name:'Known Research Distance'}).fill('3');
  await page.getByRole('button',{name:'Reference Point A',exact:true}).click();
  const canvas=page.locator('.research-video-stage canvas'),rect=await canvas.boundingBox();expect(rect).not.toBeNull();
  await canvas.click({position:{x:rect!.width*.45,y:rect!.height*.6}});
  await page.getByRole('button',{name:'Reference Point B',exact:true}).click();
  await canvas.click({position:{x:rect!.width*.55,y:rect!.height*.6}});
  await expect(page.locator('.research-calibration')).toContainText('approximate metres');
  await page.getByRole('button',{name:'Clear research reference',exact:true}).click();
  await expect(page.locator('.research-calibration')).toContainText('Scale: relative');
});

test('no observations hides research controls and leaves an explicit unavailable segment',async({page})=>{
  await fixtureApp(page,true,data=>{data.tracks=[];data.events=[];for(const frame of data.frames){frame.subjects=[];}});
  await expect(page.locator('.research-3d-stage canvas')).toHaveAttribute('data-subjects','0');
  await expect(page.getByRole('button',{name:'3D Research',exact:true})).toBeDisabled();
  await expect(page.locator('.research-inspector')).toHaveCount(0);
  await expect(page.locator('.research-chart')).toHaveCount(0);
  await expect(page.getByText('Display & Analysis',{exact:true})).toHaveCount(0);
});

test('right-side clip occupancy, observed trail modes and clicks share the video tracks',async({page})=>{
  const app=await fixtureApp(page),map=page.locator('.research-3d-stage canvas');
  await expect(map).toHaveAttribute('data-heatmap-scope','clip');
  await expect.poll(async()=>Number(await map.getAttribute('data-heatmap-bins'))).toBeGreaterThan(0);
  const bins=await map.getAttribute('data-heatmap-bins');
  await expect(map).toHaveAttribute('data-track-ids','1,2');
  await expect(map).toHaveAttribute('data-path-segments','0');
  await page.getByRole('slider',{name:'Research time',exact:true}).fill('0.4');
  await expect(map).toHaveAttribute('data-path-segments','4');
  await expect(map).toHaveAttribute('data-heatmap-bins',bins!);
  await expect(map).toHaveAttribute('data-later-recorded-segments','0');
  await page.getByRole('combobox',{name:'Spatial Trajectory'}).selectOption('full');
  await expect(map).toHaveAttribute('data-path-segments','8');
  await expect(map).toHaveAttribute('data-later-recorded-segments','4');
  await page.getByRole('combobox',{name:'Spatial Trajectory'}).selectOption('current');
  await expect(map).toHaveAttribute('data-path-segments','0');
  const refined=refineResearch(app.data),box=spatialBounds(refined,'top'),s=refined.frames[2].subjects[1],rect=(await map.boundingBox())!;
  await map.click({position:{x:32+(s.worldEstimate!.x-box.x)/box.w*(rect.width-64),y:rect.height-80-(s.worldEstimate!.z-box.z)/box.h*(rect.height-112)}});
  await expect(page.getByRole('combobox',{name:'Selected Research Subject'})).toHaveValue('2');
  await expect(map).toHaveAttribute('data-selected','2');
  await page.getByRole('combobox',{name:'Compare Research Subject'}).selectOption('1');
  await page.getByRole('combobox',{name:'Activity Heatmap'}).selectOption('pair');
  await page.getByRole('combobox',{name:'Occupancy Scope'}).selectOption('past');
  await expect(map).toHaveAttribute('data-heatmap-scope','past');
  await expect(page.locator('.research-pair')).toContainText('Current 2D');
});

test('smooth density scopes, graph seeking, manual notes and compact presentation',async({page})=>{
  await fixtureApp(page);const map=page.locator('.research-3d-stage canvas');
  await page.getByRole('slider',{name:'Research time',exact:true}).fill('0.6');
  await expect(map).toHaveAttribute('data-time','0.6');const builds=await map.getAttribute('data-density-builds');
  await page.getByRole('slider',{name:'Research time',exact:true}).fill('0.4');await expect(map).toHaveAttribute('data-time','0.4');
  await expect(map).toHaveAttribute('data-density-builds',builds!);
  await page.getByText('Visual Refinement',{exact:true}).click();
  await page.getByRole('combobox',{name:'Density Smoothing'}).selectOption('high');
  await expect.poll(()=>map.getAttribute('data-density-builds')).not.toBe(builds);
  await page.getByRole('combobox',{name:'Temporal Window'}).selectOption('0.5');
  await expect(map).toHaveAttribute('data-heatmap-scope','recent');
  await page.getByRole('spinbutton',{name:'Analysis Range Start'}).fill('.2');
  await page.getByRole('spinbutton',{name:'Analysis Range End'}).fill('.6');
  await expect(map).toHaveAttribute('data-heatmap-scope','range');
  await page.getByRole('button',{name:'Data',exact:true}).click();
  await expect(page.locator('.research-chart')).toHaveAttribute('data-valid-points','3');
  const graph=page.locator('.research-chart .u-over'),rect=(await graph.boundingBox())!;
  await graph.click({position:{x:rect.width*.75,y:rect.height*.5}});
  await expect.poll(()=>page.locator('video').evaluate(v=>(v as HTMLVideoElement).currentTime)).toBeGreaterThan(.4);
  await page.getByRole('button',{name:'Split',exact:true}).click();
  await page.getByRole('spinbutton',{name:'Analysis Range End'}).fill('1');
  await page.getByRole('spinbutton',{name:'Analysis Range Start'}).fill('0.9');
  await expect(map).toHaveAttribute('data-heatmap-bins','0');await expect(map).toHaveAttribute('data-path-segments','0');
  await expect(map).toHaveAttribute('data-subjects','2');
  await page.getByRole('button',{name:'Data',exact:true}).click();await expect(page.locator('.research-chart')).toHaveCount(0);
  await page.getByRole('button',{name:'Split',exact:true}).click();await page.getByRole('button',{name:'Clear Analysis Range'}).click();
  await page.getByText('Manual Notes / Bookmarks',{exact:true}).click();await page.getByRole('textbox',{name:'Manual Note'}).fill('Observed turn');
  await page.getByRole('button',{name:'Add Note at T',exact:true}).click();await expect(page.locator('.research-notes')).toContainText('MANUAL NOTE / Observed turn');
  await page.getByRole('button',{name:'Add Bookmark',exact:true}).click();
  await page.reload();await expect(page.locator('.research-analysis')).toContainText('cache hit');await expect(page.locator('.research-notes')).toContainText('Observed turn');
  await page.setViewportSize({width:1920,height:1080});await page.getByRole('button',{name:'Presentation Mode',exact:true}).click();
  await expect(page.locator('.research-spatial-config')).not.toBeVisible();await expect(page.locator('.research-presentation-bar')).toContainText('2.5D');
  await expect(page.locator('.research-video-stage')).toBeVisible();await expect(map).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);
  await page.getByRole('button',{name:'Exit presentation mode',exact:true}).click();await expect(page.locator('.research-view-controls')).toBeVisible();
});
