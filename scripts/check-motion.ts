import assert from 'node:assert/strict';
import { readFile,mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium,type Page } from 'playwright';
import { analysisSchema,analysisIdentity,type MotionAnalysis } from '../packages/shared/src/motion.js';

// Deliberately uses the real local video and real worker, never the CI mock.
const base=process.env.MOTION_URL ?? 'http://localhost:5173';
if(!['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname))throw new Error('Real motion verification is localhost-only.');
const infoResponse=await fetch(`${base}/api/motion/demo/info`),info=await infoResponse.json();
if(!infoResponse.ok)throw new Error(info.error ?? 'Place a real person-motion video in the root before this integration test.');
const analysisId=await analysisIdentity(info.id,15),previousResponse=await fetch(`${base}/api/motion/analyses/${analysisId}`);
const previous=previousResponse.ok?analysisSchema.parse(await previousResponse.json()):null;
let verified:MotionAnalysis|undefined;
await mkdir(resolve('test-results'),{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1050},acceptDownloads:true});
await context.route('**/*',route=>{const url=new URL(route.request().url());if(['localhost','127.0.0.1','[::1]'].includes(url.hostname))return route.continue();return route.abort();});
const page=await context.newPage();const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
async function pixels(page:Page) {
  return page.locator('.motion-3d-stage canvas').evaluate(element=>{
    const canvas=element as HTMLCanvasElement,copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;
    const ctx=copy.getContext('2d')!;ctx.drawImage(canvas,0,0);const pixels=ctx.getImageData(0,0,copy.width,copy.height).data;
    let colored=0,hash=2166136261;for(let i=0;i<pixels.length;i+=4){if(Math.max(pixels[i],pixels[i+1],pixels[i+2])>80)colored++;hash=Math.imul(hash^pixels[i]^pixels[i+1]^pixels[i+2],16777619);}
    return {colored,hash,width:canvas.width,height:canvas.height,pose:canvas.dataset.poseVisible,time:canvas.dataset.sampleTime};
  });
}
try {
  await page.goto(`${base}/motion`);
  await page.getByRole('button',{name:'Analyze Frame',exact:true}).waitFor();
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(button=>button.textContent==='Analyze Frame'&&!button.disabled),{timeout:180000});
  await page.getByRole('button',{name:'Analyze Frame',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.motion-analysis-bar')?.textContent?.includes('1 analyzed'),{timeout:60000});
  await page.getByRole('button',{name:'Analyze Motion',exact:true}).click();
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(button=>button.textContent?.includes('Analyze Motion')&&!button.disabled)&&Number(document.querySelector('.motion-analysis-bar')?.textContent?.match(/(\d+) analyzed/)?.[1])>1,{timeout:180000});
  const exported=page.waitForEvent('download');await page.getByRole('button',{name:'Analysis JSON',exact:true}).click();
  const download=await exported,local=resolve('test-results/motion-real-analysis.json');await download.saveAs(local);
  const data=analysisSchema.parse(JSON.parse(await readFile(local,'utf8')));
  verified=data;
  assert(data.samples.length>1);assert(data.derived.validFrames>0);assert(data.samples.some(sample=>sample.worldLandmarks?.length===33));
  const valid=data.samples.filter(sample=>sample.valid),a=valid[Math.floor(valid.length*.25)].timeSeconds,b=valid[Math.floor(valid.length*.65)].timeSeconds;
  await page.getByRole('slider',{name:'Motion time',exact:true}).fill(String(Number(a.toFixed(3))));await page.waitForTimeout(250);const before=await pixels(page);assert(before.colored>200);assert.equal(before.pose,'true');
  await page.getByRole('slider',{name:'Motion time',exact:true}).fill(String(Number(b.toFixed(3))));await page.waitForTimeout(250);const after=await pixels(page);assert.notEqual(before.hash,after.hash);assert.equal(after.pose,'true');
  await page.getByRole('button',{name:'Add Keyframe',exact:true}).click();await page.getByRole('button',{name:'Ghost Motion',exact:true}).click();
  await page.getByRole('combobox',{name:'3D view preset'}).selectOption('Side');
  await page.screenshot({path:'test-results/motion-real-desktop.png',fullPage:true});
  const capture=page.waitForEvent('download');await page.getByRole('button',{name:'Capture Current 4D View',exact:true}).click();await(await capture).saveAs(resolve('test-results/motion-real-export.png'));
  await page.getByRole('button',{name:'Play',exact:true}).click();await page.waitForTimeout(300);await page.getByRole('button',{name:'Pause',exact:true}).click();
  const live=await page.locator('video').evaluate(element=>(element as HTMLVideoElement).currentTime);const canvasTime=Number(await page.locator('.motion-3d-stage canvas').getAttribute('data-sample-time'));assert(Math.abs(live-canvasTime)<.15);
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);await page.screenshot({path:'test-results/motion-real-mobile.png',fullPage:true});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert((await pixels(page)).colored>100);
  await page.waitForTimeout(1000);await page.reload();await page.waitForFunction(()=>document.querySelector('.motion-analysis-bar')?.textContent?.includes('cache hit'),{timeout:60000});assert(await page.locator('.motion-keyframes').textContent());
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({source:data.video.name,duration:data.video.duration,samples:data.samples.length,valid:data.derived.validFrames,world:valid.filter(sample=>sample.worldLandmarks?.length===33).length,desktopCanvas:before,mobileNonblank:true,synchronized:true,cacheReload:true,privateOutputs:'test-results (ignored)'},null,2));
} finally {
  await context.close();await browser.close();
  // Keep the real analysis, but never leave automated golf labels in the user's take.
  if(verified){const clean={...verified,keyframes:previous?.keyframes ?? [],club:previous?.club ?? [],display:previous?.display ?? verified.display};const restored=await fetch(`${base}/api/motion/analyses/${clean.id}`,{method:'PUT',headers:{'Content-Type':'application/json','x-livespace-client':'desktop'},body:JSON.stringify(clean)});assert(restored.ok,'Could not restore user annotations after real verification.');}
}
