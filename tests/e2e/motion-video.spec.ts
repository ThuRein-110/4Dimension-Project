import { test,expect } from '@playwright/test';

test('private root video loads, plays, pauses, seeks and supports byte ranges', async ({ page,request }) => {
  test.setTimeout(120000);
  await page.goto('/'); await page.getByRole('link',{name:'4D Motion Lab',exact:true}).click();
  await expect(page.getByRole('heading',{name:'4D Motion Lab',exact:true})).toBeVisible();
  await expect(page.locator('video')).toHaveJSProperty('readyState',4,{timeout:60000});
  await page.getByRole('button',{name:'Play',exact:true}).click();
  await expect.poll(()=>page.locator('video').evaluate(video=>(video as HTMLVideoElement).currentTime)).toBeGreaterThan(.05);
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  await page.getByRole('slider',{name:'Motion time',exact:true}).fill('1');
  await expect.poll(()=>page.locator('video').evaluate(video=>(video as HTMLVideoElement).currentTime)).toBeCloseTo(1,2);
  const metadata = await (await request.get('/api/motion/demo/info')).json();
  const range = await request.get(metadata.url,{headers:{Range:'bytes=0-99'}});
  expect(range.status()).toBe(206); expect((await range.body()).byteLength).toBe(100);
  expect((await request.get('/api/motion/demo/stream?id=../../package.json')).status()).toBe(400);
  expect((await request.get('/api/motion/demo/info',{headers:{Origin:'https://foreign.example'}})).status()).toBe(403);
});
