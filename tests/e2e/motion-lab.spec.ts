import { test,expect,type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync,readFileSync,unlinkSync,rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpeg from 'ffmpeg-static';

// Explicit CI fixtures only: a generated color video and mock worker results.
// Real inference is separately exercised by scripts/check-motion.ts on local media.
const directory=mkdtempSync(join(tmpdir(),'motion-fixture-')),file=join(directory,'fixture.mp4');
execFileSync(ffmpeg!,['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=gray:s=160x240:r=10:d=1','-an','-c:v','libx264','-bf','0','-pix_fmt','yuv420p','-movflags','+faststart',file],{windowsHide:true});
const fixture=readFileSync(file);unlinkSync(file);rmdirSync(directory);
async function fixtureApp(page:Page) {
  await page.route('**/api/motion/demo/info',route => route.fulfill({json:{id:'ci-video-fixture',name:'CI generated video (not personal media)',size:fixture.length,mtimeMs:1,codec:'h264',width:160,height:240,fps:10,duration:1,rotation:0,pixelFormat:'yuv420p',status:'ready',prepared:false,url:'/api/motion/ci-fixture'}}));
  await page.route('**/api/motion/ci-fixture',route => {
    const range=route.request().headers().range?.match(/^bytes=(\d+)-(\d*)$/);
    if(!range)return route.fulfill({body:fixture,contentType:'video/mp4'});
    const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),fixture.length-1):fixture.length-1;
    return route.fulfill({status:206,body:fixture.subarray(start,end+1),contentType:'video/mp4',headers:{'Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${fixture.length}`}});
  });
  const cache = new Map<string,unknown>();
  await page.route('**/api/motion/analyses/*',async route => { const request=route.request(),id=request.url().split('/').at(-1)!; if(request.method()==='PUT') {cache.set(id,request.postDataJSON());await route.fulfill({status:204});} else if(cache.has(id)) await route.fulfill({json:cache.get(id)});else await route.fulfill({status:404,json:{error:'Missing fixture analysis'}}); });
  await page.route('**/api/projects/**',route=>route.fulfill({json:route.request().postDataJSON()}));
  await page.addInitScript(() => {
    const NativeWorker=window.Worker;
    class FixtureWorker {
      onmessage: ((event:MessageEvent)=>void)|null=null; onerror=null; closed=false;
      postMessage(message:{id:number;type:string;timeSeconds:number;frameIndex:number;bitmap?:ImageBitmap}) {
        if(message.type==='frame')Reflect.set(window,'motionInferenceFrames',(Reflect.get(window,'motionInferenceFrames') ?? 0)+1);
        message.bitmap?.close();
        setTimeout(() => {
          if(this.closed) return;
          if(message.type!=='frame') {this.onmessage?.(new MessageEvent('message',{data:{id:message.id,ready:true}}));return;}
          const points=Array.from({length:33},(_,id)=>({id,name:`CI joint ${id}`,x:.3+message.timeSeconds*.1,y:.2+id*.015,z:.1,visibility:.9}));
          this.onmessage?.(new MessageEvent('message',{data:{id:message.id,sample:{timeSeconds:message.timeSeconds,frameIndex:message.frameIndex,landmarks2D:points,worldLandmarks:points,poseConfidence:.9,valid:true,inferenceMs:1}}}));
        },30);
      }
      terminate(){this.closed=true;}
    }
    window.Worker = class extends NativeWorker { constructor(url:string|URL,options?:WorkerOptions){if(String(url).includes('pose-worker'))return new FixtureWorker() as unknown as Worker; super(url,options);} };
  });
  await page.goto('/motion');
  await expect(page.getByRole('button',{name:'Analyze Motion',exact:true})).toBeEnabled();
}
test('human 3D mode does not show a decorative grid without a valid pose',async({page})=>{
  await fixtureApp(page);
  await page.getByRole('button',{name:'Split View',exact:true}).click();
  await expect(page.locator('.motion-empty')).toContainText('3D reconstruction unavailable for this segment');
  await expect(page.getByRole('combobox',{name:'3D view preset'})).toBeDisabled();
  await expect(page.locator('.motion-3d-stage canvas')).toHaveAttribute('data-pose-visible','false');
  await expect(page.locator('.motion-empty a')).toHaveAttribute('href','/research');
});

test('CI motion flow: progress, synchronized poses, keyframes, trails, views, exports and cache',async({page})=>{
  await fixtureApp(page);
  await page.getByRole('button',{name:'Analyze Motion',exact:true}).click();
  await expect(page.getByText(/Analyzing motion/)).toBeVisible();
  await expect(page.locator('.motion-analysis-bar')).toContainText('15 analyzed / 15 detected');
  await page.getByRole('slider',{name:'Motion time',exact:true}).fill('0.5');
  await expect.poll(()=>page.locator('.motion-3d-stage canvas').getAttribute('data-sample-time')).toBe('0.5000');
  await page.getByRole('button',{name:'Add Keyframe',exact:true}).click();
  await expect(page.locator('.motion-keyframes')).toContainText('Address');
  await page.getByRole('slider',{name:'Motion time',exact:true}).fill('0.2');
  await page.locator('.motion-keyframes button').first().click();
  await expect.poll(()=>page.locator('video').evaluate(video=>(video as HTMLVideoElement).currentTime)).toBeCloseTo(.5);
  await expect(page.getByRole('button',{name:'4D Video',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Split View',exact:true}).click();
  await page.getByRole('combobox',{name:'3D view preset'}).selectOption('Side');
  await page.getByRole('button',{name:'Play',exact:true}).click();
  await expect.poll(()=>page.locator('video').evaluate(video=>(video as HTMLVideoElement).currentTime)).toBeGreaterThan(.55);
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  await page.getByText('Display & Trails',{exact:true}).click();
  await page.getByRole('checkbox',{name:'Experimental Club Head Annotation'}).check();
  const overlay=page.locator('.motion-pose-overlay'),bounds=await overlay.boundingBox();
  await overlay.click({position:{x:bounds!.width/2,y:bounds!.height/2}});
  const saved=page.waitForRequest(request=>request.method()==='PUT'&&request.url().includes('/api/projects/')&&!!request.postDataJSON().motion);
  await page.getByRole('button',{name:'Save with Project',exact:true}).click();
  const project=(await saved).postDataJSON();expect(project.motion.videoId).toBe('ci-video-fixture');expect(project.motion.keyframes).toHaveLength(1);expect(project.motion.samples).toBeUndefined();
  await page.getByRole('button',{name:'Data',exact:true}).click();
  await expect(page.locator('.motion-table-scroll table')).toBeVisible();
  const json=page.waitForEvent('download');await page.getByRole('button',{name:'Analysis JSON',exact:true}).click();const downloaded=await json;expect(downloaded.suggestedFilename()).toContain('motion.json');const exported=JSON.parse(readFileSync((await downloaded.path())!,'utf8'));expect(exported.club).toHaveLength(1);expect(exported.club[0].x).toBeCloseTo(.5);
  const png=page.waitForEvent('download');await page.getByRole('button',{name:'Capture Current 4D View',exact:true}).click();expect((await png).suggestedFilename()).toContain('.png');
  await expect.poll(async()=>page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('4dlivespace-motion');r.onsuccess=()=>resolve(r.result);});return new Promise<number>(resolve=>{const r=db.transaction('analyses').objectStore('analyses').getAll();r.onsuccess=()=>{db.close();resolve(r.result[0]?.keyframes.length??0);};});})).toBe(1);
  await page.reload();await expect(page.locator('.motion-analysis-bar')).toContainText('cache hit');await expect(page.locator('.motion-keyframes')).toContainText('Address');
});

test('4D video defaults, interactive depth card, freeze, composites, fullscreen and four exports',async({page})=>{
  await fixtureApp(page);
  await expect(page.getByRole('button',{name:'4D Video',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Analyze Motion',exact:true}).click();
  await expect(page.locator('.motion-analysis-bar')).toContainText('15 analyzed');
  await page.getByText('Display & Trails',{exact:true}).click();
  for(const name of ['Current Pose','Ghost Poses','Wrist Trails','Depth'])await expect(page.getByRole('checkbox',{name,exact:true})).toBeChecked();
  await expect(page.getByRole('spinbutton',{name:'Ghost Count'})).toHaveValue('4');await expect(page.getByRole('combobox',{name:'Ghost Interval'})).toHaveValue('0.15');await expect(page.getByRole('combobox',{name:'Trail history'})).toHaveValue('0');
  await page.getByRole('slider',{name:'Motion time',exact:true}).fill('0.5');
  await expect.poll(()=>page.locator('.motion-pose-overlay').getAttribute('data-sample-time')).toBe('0.5');
  await expect(page.getByLabel('Selected video joint')).toContainText('T 0.500');
  await page.getByRole('button',{name:'Hide joint information',exact:true}).click();
  const canvas=page.locator('.motion-pose-overlay'),bounds=(await canvas.boundingBox())!;
  await expect(canvas).toHaveAttribute('data-card','null');
  const imageWidth=bounds.height*160/240,imageX=(bounds.width-imageWidth)/2;
  await canvas.click({position:{x:imageX+imageWidth*.35,y:bounds.height*(.2+16*.015)}});
  await expect(page.getByLabel('Selected video joint')).toContainText('CI joint 16');
  const beforeDrag=JSON.parse((await canvas.getAttribute('data-card'))!);
  const cardX=Math.min(bounds.width-218-8,imageX+imageWidth*.35+16),cardY=Math.min(bounds.height-132-58,bounds.height*.44+12);
  await page.mouse.move(bounds.x+cardX+20,bounds.y+cardY+12);await page.mouse.down();await page.mouse.move(bounds.x+cardX-80,bounds.y+cardY-30);await page.mouse.up();
  await expect.poll(async()=>JSON.parse((await canvas.getAttribute('data-card'))!).x).toBeLessThan(beforeDrag.x);
  await page.getByRole('button',{name:'Hide joint information',exact:true}).click();await expect(canvas).toHaveAttribute('data-card','null');
  await canvas.click({position:{x:imageX+imageWidth*.3,y:bounds.height*.44}});
  await expect(canvas).toHaveAttribute('data-selected-time','0');await expect(page.getByLabel('Selected video joint')).toContainText('T 0.000');
  await page.getByRole('button',{name:'Show joint information',exact:true}).click();await expect(page.getByLabel('Selected video joint')).toContainText('T 0.500');
  await page.getByRole('button',{name:'Freeze Motion',exact:true}).click();await expect(page.locator('video')).toHaveJSProperty('paused',true);
  await page.getByRole('button',{name:'Add Keyframe',exact:true}).click();
  await page.getByRole('checkbox',{name:'Full Motion Composite (whole clip)',exact:true}).check();await page.getByRole('checkbox',{name:'Keyframe Poses',exact:true}).check();
  await page.getByRole('button',{name:'Fullscreen 4D Video',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>document.fullscreenElement?.className)).toContain('motion-presentation');
  await expect(page.getByRole('slider',{name:'Motion time',exact:true})).toBeVisible();
  await page.evaluate(()=>document.exitFullscreen());
  await page.getByRole('button',{name:'Fill',exact:true}).click();await page.getByRole('slider',{name:'Motion time',exact:true}).fill('0.3');await expect(page.getByLabel('Selected video joint')).toContainText('T 0.300');
  await page.getByRole('button',{name:'Next frame',exact:true}).click();await expect(page.getByLabel('Selected video joint')).toContainText('T 0.400');await page.getByRole('button',{name:'Previous frame',exact:true}).click();await expect(page.getByLabel('Selected video joint')).toContainText('T 0.300');
  expect(await page.evaluate(()=>Reflect.get(window,'motionInferenceFrames'))).toBe(15);
  for(const mode of ['original','video','3d','split']){
    await page.getByRole('combobox',{name:'Screenshot view'}).selectOption(mode);const download=page.waitForEvent('download');await page.getByRole('button',{name:'Capture Current 4D View',exact:true}).click();const result=await download,bytes=readFileSync((await result.path())!);expect(bytes.byteLength).toBeGreaterThan(100);expect(result.suggestedFilename()).toContain(`_${mode}_`);
    if(mode==='original'){
      expect(bytes.readUInt32BE(16)).toBe(160);expect(bytes.readUInt32BE(20)).toBe(240);
      expect(await page.evaluate(async url=>{const image=new Image();image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);const exported=ctx.getImageData(0,0,canvas.width,canvas.height).data;ctx.drawImage(document.querySelector('video')!,0,0);const original=ctx.getImageData(0,0,canvas.width,canvas.height).data;return exported.every((value,index)=>value===original[index]);},`data:image/png;base64,${bytes.toString('base64')}`)).toBe(true);
    }
  }
  await page.getByRole('button',{name:'3D Motion',exact:true}).click();await expect(page.locator('.motion-3d-stage')).toBeVisible();await page.getByRole('button',{name:'4D Video',exact:true}).click();
  await page.setViewportSize({width:390,height:844});await expect(canvas).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('CI cancellation retains a responsive player and permits another run',async({page})=>{
  await fixtureApp(page);await page.getByRole('button',{name:'Analyze Motion',exact:true}).click();await page.getByRole('button',{name:'Cancel Analysis',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Analysis cancelled');await expect(page.getByRole('button',{name:'Analyze Motion',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Analyze Motion',exact:true}).click();await expect(page.locator('.motion-analysis-bar')).toContainText('15 analyzed');
});
test('CI Local Media remains independent and switches back to root demo',async({page})=>{
  await fixtureApp(page);
  await page.locator('input[type=file]').setInputFiles({name:'ci-local.mp4',mimeType:'video/mp4',buffer:fixture});
  await expect(page.locator('.motion-metadata')).toContainText('ci-local.mp4');
  await expect(page.locator('.motion-metadata')).toContainText('stepping assumption');
  await expect(page.getByRole('button',{name:'Analyze Motion',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Analyze Motion',exact:true}).click();
  await expect(page.locator('.motion-analysis-bar')).toContainText('15 analyzed');
  await page.getByRole('button',{name:'Demo Video',exact:true}).click();
  await expect(page.locator('.motion-metadata')).toContainText('CI generated video');
  await expect(page.locator('video')).toHaveJSProperty('readyState',4);
});
