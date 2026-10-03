import { test,expect,type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync,readFileSync,unlinkSync,rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpeg from 'ffmpeg-static';
import { researchFixture } from '../fixtures/research.js';
import { researchIdentity } from '../../packages/shared/src/research.js';

// CI-only generated media/results. Never presented as real animal inference.
const directory=mkdtempSync(join(tmpdir(),'research-ci-')),file=join(directory,'fixture.mp4');
execFileSync(ffmpeg!,['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=gray:s=160x240:r=10:d=1','-an','-c:v','libx264','-bf','0','-pix_fmt','yuv420p','-movflags','+faststart',file],{windowsHide:true});
const videoBytes=readFileSync(file);unlinkSync(file);rmdirSync(directory);
async function fixtureApp(page:Page,cached=true){
  let data=await researchFixture(),running=false,cancelled=false,starts=0;
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
  return {get data(){return data;},get starts(){return starts;},complete(){running=false;cached=true;},async changeSource(){data=await researchFixture('b'.repeat(64));cached=false;}};
}
test('research cached playback, temporal selection, masks, pair metrics, views and exports',async({page})=>{
  const app=await fixtureApp(page);await expect(page.locator('.research-analysis')).toContainText('5 samples / 2 tracks / cache hit');
  await expect(page.getByRole('button',{name:'Split',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('slider',{name:'Research time',exact:true}).fill('0.4');
  await expect(page.locator('.research-3d-stage canvas')).toHaveAttribute('data-sample-time','0.4');await expect(page.locator('.research-video-stage canvas')).toHaveAttribute('data-subjects','2');
  await page.getByRole('combobox',{name:'Selected Research Subject'}).selectOption('1');await page.getByRole('combobox',{name:'Compare Research Subject'}).selectOption('2');
  await expect(page.locator('.research-pair')).toContainText('Paired observations');await expect(page.locator('.research-inspector')).toContainText('Facing');
  await page.getByRole('spinbutton',{name:'Pair Interval Start'}).fill('.2');await page.getByRole('spinbutton',{name:'Pair Interval End'}).fill('.6');
  await page.getByRole('button',{name:'Next research frame',exact:true}).click();await expect.poll(()=>page.locator('video').evaluate(video=>(video as HTMLVideoElement).currentTime)).toBeCloseTo(.5);
  await page.getByText('Overlays / Trails / Scene',{exact:true}).click();
  for(const name of ['Masks','3D Ghosts','3D Trajectories','Uncertainty'])await expect(page.getByRole('checkbox',{name,exact:true})).toBeChecked();
  await page.getByRole('combobox',{name:'Mask Style'}).selectOption('both');await page.getByRole('checkbox',{name:'Relative Depth Map',exact:true}).check();await page.getByRole('checkbox',{name:'3D Labels',exact:true}).check();await page.getByRole('button',{name:'Fill',exact:true}).click();await page.getByRole('button',{name:'Fit',exact:true}).click();
  await page.getByRole('button',{name:'Fullscreen research presentation',exact:true}).click();await expect.poll(()=>page.evaluate(()=>document.fullscreenElement?.contains(document.querySelector('.research-timeline')))).toBe(true);await page.evaluate(()=>document.exitFullscreen());
  for(const mode of ['report','frames','tracks','events','video','3d','split','annotated']){
    await page.getByRole('combobox',{name:'Research Export'}).selectOption(mode);const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export research data'}).click();const download=await pending,bytes=readFileSync((await download.path())!);expect(bytes.length).toBeGreaterThan(100);if(mode==='report')expect(JSON.parse(bytes.toString()).id).toBe(app.data.id);if(mode==='frames')expect(JSON.parse(bytes.toString())).toHaveLength(5);if(['video','3d','split'].includes(mode))expect(bytes.subarray(1,4).toString()).toBe('PNG');
  }
  await page.getByRole('button',{name:'Data',exact:true}).click();
  for(const name of ['Subjects','Events','Metrics','Depth','Diagnostics']){await page.getByRole('tab',{name,exact:true}).click();await expect(page.getByRole('tabpanel',{name,exact:true})).toBeVisible();}
  await expect(page.getByRole('tabpanel',{name:'Diagnostics'})).toContainText('cached data only');
  await page.getByRole('button',{name:'Split',exact:true}).click();await page.setViewportSize({width:390,height:844});await expect(page.locator('.research-3d-stage canvas')).toBeVisible();await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.reload();await expect(page.locator('.research-analysis')).toContainText('cache hit');expect(app.starts).toBe(0);
});

test('research jobs can complete or cancel; replacing the source removes old analysis and selection',async({page})=>{
  const app=await fixtureApp(page,false);await page.getByRole('button',{name:'Analyze Wildlife',exact:true}).click();await expect(page.getByRole('button',{name:'Cancel Analysis',exact:true})).toBeVisible();await page.getByRole('button',{name:'Cancel Analysis',exact:true}).click();await expect(page.locator('.research-analysis')).toContainText('cancelled');
  await page.getByRole('button',{name:'Analyze Wildlife',exact:true}).click();await expect(page.getByRole('button',{name:'Cancel Analysis',exact:true})).toBeVisible();app.complete();await expect(page.locator('.research-analysis')).toContainText('5 samples / 2 tracks');
  await page.getByRole('combobox',{name:'Selected Research Subject'}).selectOption('1');await page.getByRole('combobox',{name:'Compare Research Subject'}).selectOption('2');
  await app.changeSource();await page.getByRole('button',{name:'Refresh source video',exact:true}).click();await expect(page.getByRole('combobox',{name:'Selected Research Subject'})).toHaveValue('');await expect(page.getByRole('combobox',{name:'Compare Research Subject'})).toHaveValue('');await expect(page.locator('.research-3d-stage canvas')).toHaveAttribute('data-subjects','0');
  await expect(page.getByRole('button',{name:'Export research data'})).toBeDisabled();expect(app.data.id).toBe(await researchIdentity('b'.repeat(64),app.data.settings));
});

test('corrupt research cache is reported without displaying stale animal geometry',async({page})=>{
  await fixtureApp(page,false);await page.route('**/api/motion/research/analyses/*',route=>route.fulfill({status:422,json:{error:'Invalid CI cache'}}));await page.reload();await expect(page.getByRole('alert')).toContainText('cache is invalid');await expect(page.locator('.research-3d-stage canvas')).toHaveAttribute('data-subjects','0');
});
